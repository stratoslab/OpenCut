import { create } from "zustand";

export type ModelStage =
  | "idle"
  | "checking"
  | "unsupported"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

export interface AiModelState {
  stage: ModelStage;
  progress: number;
  currentFile: string;
  estimatedTimeRemaining: string;
  error: string | null;
  tps: number | null;
  numTokens: number | null;
  isGenerating: boolean;
  gpuAdapter: string | null;
  gpuBackend: string | null;
  shaderF16: boolean | null;
  downloadRetry: {
    active: boolean;
    attempt: number;
    maxRetries: number;
    delay: number;
    url: string;
  } | null;
  downloadError: {
    message: string;
    cachedPercent: number;
  } | null;
  streamingOutput: string;
}

const initialState: AiModelState = {
  stage: "checking",
  progress: 0,
  currentFile: "",
  estimatedTimeRemaining: "",
  error: null,
  tps: null,
  numTokens: null,
  isGenerating: false,
  gpuAdapter: null,
  gpuBackend: null,
  shaderF16: null,
  downloadRetry: null,
  downloadError: null,
  streamingOutput: "",
};

interface AiModelStore extends AiModelState {
  worker: Worker | null;
  loadModel: () => void;
  resumeDownload: () => void;
  generate: (
    messages: Array<{ role: string; content: string }>,
    options?: { maxNewTokens?: number },
  ) => void;
  interrupt: () => void;
  reset: () => void;
  clearError: () => void;
  clearStreamingOutput: () => void;
  initWorker: () => void;
  terminateWorker: () => void;
}

let startTime = 0;

function calculateETA(progress: number): string {
  if (progress <= 0 || startTime === 0) return "";
  const elapsed = performance.now() - startTime;
  const rate = progress / elapsed;
  const remaining = (100 - progress) / rate;
  const seconds = Math.round(remaining / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export const useAiModelStore = create<AiModelStore>((set, get) => ({
  ...initialState,
  worker: null,

  initWorker: () => {
    const worker = new Worker(
      new URL("./ai-worker.js", import.meta.url),
      { type: "module" },
    );

    worker.addEventListener("message", (event: MessageEvent) => {
      const { status, data, progress } = event.data;

      switch (status) {
        case "check": {
          const msg = event.data;
          const supported = Boolean(msg.supported);
          const reason = typeof msg.reason === "string" ? msg.reason : null;
          if (!supported) {
            set({
              stage: "unsupported",
              error: reason || "WebGPU is not supported in this browser",
            });
            break;
          }
          const shaderF16 = Boolean(msg.shaderF16);
          if (!shaderF16) {
            set({
              stage: "unsupported",
              error: "GPU does not support shader-f16 (required for fp16 inference). Try Chrome on a discrete GPU.",
              gpuAdapter: typeof msg.adapter === "string" ? msg.adapter : null,
              gpuBackend: typeof msg.backend === "string" ? msg.backend : null,
              shaderF16: false,
            });
            break;
          }
          set({
            stage: "idle",
            gpuAdapter: typeof msg.adapter === "string" ? msg.adapter : null,
            gpuBackend: typeof msg.backend === "string" ? msg.backend : null,
            shaderF16: true,
          });
          break;
        }

        case "init":
          set({
            stage: "loading",
            currentFile: typeof data === "string" ? data : "",
          });
          break;

        case "loading":
          set({
            stage: "downloading",
            currentFile: typeof data === "string" ? data : "",
          });
          break;

        case "progress":
          set({
            progress: typeof progress === "number" ? progress : 0,
            estimatedTimeRemaining: calculateETA(progress as number),
          });
          break;

        case "ready":
          set({
            stage: "ready",
            progress: 100,
            currentFile: "Model ready",
            estimatedTimeRemaining: "",
          });
          break;

        case "start":
          set({
            isGenerating: true,
            tps: null,
            numTokens: null,
            streamingOutput: "",
          });
          break;

        case "update":
          set((prev) => ({
            streamingOutput: prev.streamingOutput + (event.data.output || ""),
          }));
          break;

        case "complete":
          set({
            isGenerating: false,
            tps: typeof event.data.tps === "number" ? event.data.tps : null,
            numTokens: typeof event.data.numTokens === "number" ? event.data.numTokens : null,
          });
          break;

        case "error":
          set({
            stage: "error",
            error: typeof data === "string" ? data : "Unknown error",
            isGenerating: false,
          });
          break;

        case "download_retry":
          set({
            downloadRetry: {
              active: true,
              attempt: typeof event.data.attempt === "number" ? event.data.attempt : 0,
              maxRetries: typeof event.data.maxRetries === "number" ? event.data.maxRetries : 5,
              delay: typeof event.data.delay === "number" ? event.data.delay : 2,
              url: typeof event.data.url === "string" ? event.data.url : "",
            },
            downloadError: null,
          });
          break;

        case "download_error":
          set({
            stage: "error",
            error: typeof data === "string" ? data : "Download failed after all retries",
            downloadRetry: null,
            downloadError: {
              message: typeof data === "string" ? data : "Download failed",
              cachedPercent: typeof event.data.cachedPercent === "number" ? event.data.cachedPercent : 0,
            },
          });
          break;
      }
    });

    set({ worker });
    worker.postMessage({ type: "check" });
  },

  terminateWorker: () => {
    const { worker } = get();
    if (worker) {
      worker.terminate();
      set({ worker: null });
    }
  },

  loadModel: () => {
    startTime = performance.now();
    const { worker } = get();
    set({
      stage: "downloading",
      progress: 0,
      error: null,
      downloadRetry: null,
      downloadError: null,
    });
    worker?.postMessage({ type: "load" });
  },

  resumeDownload: () => {
    const { worker, downloadError } = get();
    set({
      stage: "downloading",
      error: null,
      downloadRetry: null,
      downloadError: null,
      progress: downloadError?.cachedPercent ?? 0,
      currentFile: `Resuming from ${downloadError?.cachedPercent ?? 0}%...`,
    });
    startTime = performance.now();
    worker?.postMessage({ type: "load" });
  },

  generate: (messages, options) => {
    const { worker } = get();
    worker?.postMessage({
      type: "generate",
      data: {
        messages,
        maxNewTokens: options?.maxNewTokens ?? 1024,
      },
    });
  },

  interrupt: () => {
    const { worker } = get();
    worker?.postMessage({ type: "interrupt" });
  },

  reset: () => {
    const { worker } = get();
    worker?.postMessage({ type: "reset" });
    set(initialState);
  },

  clearError: () => {
    set((prev) => ({
      error: null,
      stage: prev.stage === "error" ? "idle" : prev.stage,
    }));
  },

  clearStreamingOutput: () => {
    set({ streamingOutput: "" });
  },
}));
