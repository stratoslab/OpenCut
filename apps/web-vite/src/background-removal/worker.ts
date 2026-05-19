import type { WorkerMessage, WorkerResponse } from "./types";

const MODEL_ID = "briaai/RMBG-1.4";
const MAX_RETRIES = 5;
const BASE_DELAY = 2000; // ms

// Module-level state
let processor: unknown = null;
let model: unknown = null;
let cancelled = false;

// ---------------------------------------------------------------------------
// Dynamic import of @huggingface/transformers
// ---------------------------------------------------------------------------
let transformersLoaded = false;
let AutoModel: (typeof import("@huggingface/transformers"))["AutoModel"];
let AutoProcessor: (typeof import("@huggingface/transformers"))["AutoProcessor"];
let RawImage: (typeof import("@huggingface/transformers"))["RawImage"];
let env: (typeof import("@huggingface/transformers"))["env"];

async function loadTransformers(): Promise<void> {
  if (transformersLoaded) return;
  const transformers = await import("@huggingface/transformers");
  AutoModel = transformers.AutoModel;
  AutoProcessor = transformers.AutoProcessor;
  RawImage = transformers.RawImage;
  env = transformers.env;

  env.allowLocalModels = false;

  // Wrap env.fetch with exponential-backoff retry
  const originalFetch = (env.fetch as typeof globalThis.fetch) ?? globalThis.fetch.bind(globalThis);
  (env as unknown as { fetch: typeof globalThis.fetch }).fetch = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    let lastError: Error = new Error("Unknown fetch error");
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await originalFetch(url, options);
        if (response.ok || response.status < 500) return response;
        lastError = new Error(`HTTP ${response.status}`);
      } catch (err) {
        lastError = err as Error;
      }
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        self.postMessage({
          type: "load-retry",
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          delay,
          url,
        } satisfies WorkerResponse);
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  };

  transformersLoaded = true;
}

// ---------------------------------------------------------------------------
// Model loading
// ---------------------------------------------------------------------------
async function loadModel(): Promise<void> {
  await loadTransformers();

  const fileProgress = new Map<string, { loaded: number; total: number }>();

  const progress_callback = (info: {
    status: string;
    file?: string;
    name?: string;
    loaded?: number;
    total?: number;
  }) => {
    if (info.status === "progress") {
      const key = info.file ?? info.name ?? "unknown";
      fileProgress.set(key, {
        loaded: info.loaded ?? 0,
        total: info.total ?? 0,
      });
      const totalLoaded = [...fileProgress.values()].reduce((s, e) => s + e.loaded, 0);
      const totalBytes = [...fileProgress.values()].reduce((s, e) => s + e.total, 0);
      const overallPercent = totalBytes > 0 ? Math.round((totalLoaded / totalBytes) * 100) : 0;
      self.postMessage({
        type: "load-progress",
        progress: overallPercent,
      } satisfies WorkerResponse);
    }
  };

  // Try WebGPU first, fall back to WASM
  let selectedDevice: "webgpu" | "wasm" = "webgpu";
  try {
    if (!("gpu" in navigator)) throw new Error("WebGPU not available");
    const adapter = await (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter();
    if (!adapter) throw new Error("No GPU adapter");
    // Device confirmed available — proceed with webgpu
  } catch {
    selectedDevice = "wasm";
  }

  self.postMessage({
    type: "device-selected",
    device: selectedDevice,
  } satisfies WorkerResponse);

  const [loadedProcessor, loadedModel] = await Promise.all([
    AutoProcessor.from_pretrained(MODEL_ID, { progress_callback }),
    AutoModel.from_pretrained(MODEL_ID, {
      dtype: "fp32" as Parameters<typeof AutoModel.from_pretrained>[1] extends { dtype?: infer D } ? D : never,
      device: selectedDevice,
      progress_callback,
    }),
  ]);

  processor = loadedProcessor;
  model = loadedModel;

  self.postMessage({ type: "ready" } satisfies WorkerResponse);
}

// ---------------------------------------------------------------------------
// Inference
// ---------------------------------------------------------------------------
async function runInference(id: string, imageData: ImageData): Promise<void> {
  if (!processor || !model) {
    self.postMessage({
      type: "error",
      error: "Model not loaded",
    } satisfies WorkerResponse);
    return;
  }

  const { width: w, height: h } = imageData;
  const image = new RawImage(imageData.data, w, h, 4);

  const inputs = await (processor as { (img: unknown): Promise<unknown> })(image);
  const output = await (model as { (inp: unknown): Promise<{ output: unknown[] }> })(inputs);

  // output[0] is shape [1, 1, H, W], values in [0, 1]
  const outputTensor = (output as { output: Array<{ data: Float32Array }> }).output[0];
  const alphaMask = outputTensor.data as Float32Array;

  self.postMessage(
    {
      type: "result",
      id,
      alphaMask,
      width: w,
      height: h,
    } satisfies WorkerResponse,
    [alphaMask.buffer]
  );
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case "load":
        await loadModel();
        break;

      case "remove-background":
        if (cancelled) {
          self.postMessage({ type: "cancelled" } satisfies WorkerResponse);
          return;
        }
        await runInference(msg.id, msg.imageData);
        break;

      case "cancel":
        cancelled = true;
        self.postMessage({ type: "cancelled" } satisfies WorkerResponse);
        break;

      default:
        break;
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
});

// ---------------------------------------------------------------------------
// Global error handlers
// ---------------------------------------------------------------------------
self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  self.postMessage({
    type: "error",
    error: reason,
  } satisfies WorkerResponse);
});

self.addEventListener("error", (event: ErrorEvent) => {
  self.postMessage({
    type: "error",
    error: event.message || "Worker error",
  } satisfies WorkerResponse);
});
