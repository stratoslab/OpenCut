// ─── Typed message protocol ───────────────────────────────────────────────────
// This file is a Web Worker module. The types below are also imported by
// clip-store.ts for the main-thread side of the message channel.

export type WorkerMessage =
  | { type: "load" }
  | { type: "embedImage"; id: string; imageData: ImageData }
  | { type: "embedTexts"; id: string; texts: string[] };

export type WorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "embedImageResult"; id: string; embedding: number[] }
  | { type: "embedTextsResult"; id: string; embeddings: number[][] };

const MODEL_ID = "Xenova/clip-vit-base-patch32";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any | null = null;

/** L2-normalise a vector (returns a new array). */
export function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

/** Split a flat array into chunks of `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function load(): Promise<void> {
  try {
    // Dynamic import mirrors the pattern in ai-worker.js
    const { CLIPModel, CLIPProcessor, env } = await import(
      "@huggingface/transformers"
    );

    env.allowLocalModels = false;

    // Determine device: prefer WebGPU, fall back to WASM
    let device: "webgpu" | "wasm" = "wasm";
    if (typeof navigator !== "undefined" && navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter !== null) {
          device = "webgpu";
        }
      } catch {
        // requestAdapter() threw — stay on wasm
      }
    }

    // Per-file progress tracking
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
        const totalLoaded = [...fileProgress.values()].reduce(
          (s, e) => s + e.loaded,
          0
        );
        const totalBytes = [...fileProgress.values()].reduce(
          (s, e) => s + e.total,
          0
        );
        const overallPercent =
          totalBytes > 0 ? Math.round((totalLoaded / totalBytes) * 100) : 0;
        self.postMessage({
          type: "progress",
          progress: overallPercent,
        } satisfies WorkerResponse);
      }
    };

    [processor, model] = await Promise.all([
      CLIPProcessor.from_pretrained(MODEL_ID, { progress_callback }),
      CLIPModel.from_pretrained(MODEL_ID, { device, progress_callback }),
    ]);

    self.postMessage({ type: "ready" } satisfies WorkerResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load CLIP model";
    self.postMessage({ type: "error", message } satisfies WorkerResponse);
  }
}

async function embedImage(id: string, imageData: ImageData): Promise<void> {
  if (model === null || processor === null) {
    self.postMessage({
      type: "error",
      message: "Model not loaded",
    } satisfies WorkerResponse);
    return;
  }
  try {
    const inputs = await processor(imageData);
    const { image_embeds } = await model(inputs);
    const embedding = l2Normalize(
      Array.from(image_embeds.data as Float32Array)
    );
    self.postMessage({
      type: "embedImageResult",
      id,
      embedding,
    } satisfies WorkerResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "embedImage failed";
    self.postMessage({ type: "error", message } satisfies WorkerResponse);
  }
}

async function embedTexts(id: string, texts: string[]): Promise<void> {
  if (model === null || processor === null) {
    self.postMessage({
      type: "error",
      message: "Model not loaded",
    } satisfies WorkerResponse);
    return;
  }
  try {
    const inputs = await processor(null, {
      text: texts,
      padding: true,
      truncation: true,
    });
    const { text_embeds } = await model(inputs);
    // text_embeds shape: [texts.length, 512]
    const embeddings = chunk(
      Array.from(text_embeds.data as Float32Array),
      512
    ).map(l2Normalize);
    self.postMessage({
      type: "embedTextsResult",
      id,
      embeddings,
    } satisfies WorkerResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "embedTexts failed";
    self.postMessage({ type: "error", message } satisfies WorkerResponse);
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case "load":
      await load();
      break;
    case "embedImage":
      if (model === null) {
        self.postMessage({
          type: "error",
          message: "Model not loaded",
        } satisfies WorkerResponse);
      } else {
        await embedImage(msg.id, msg.imageData);
      }
      break;
    case "embedTexts":
      if (model === null) {
        self.postMessage({
          type: "error",
          message: "Model not loaded",
        } satisfies WorkerResponse);
      } else {
        await embedTexts(msg.id, msg.texts);
      }
      break;
  }
};

export { MODEL_ID, model, processor };
