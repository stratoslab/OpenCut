import { create } from "zustand";
import { TTS_MODELS, DEFAULT_TTS_MODEL, type TTSModelId } from "./tts-models";
import type { TTSWorkerResponse } from "./tts-worker";

export type TTSModelStage =
  | "idle"
  | "checking"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

export interface TTSModelState {
  stage: TTSModelStage;
  progress: number; // 0-100
  estimatedTimeRemaining: string;
  error: string | null;
  device: "webgpu" | "wasm" | null;
  selectedModel: TTSModelId;
  downloadSizeBytes: number;
  worker: Worker | null;
  isReady: boolean;
}

interface TTSModelStore extends TTSModelState {
  initWorker: () => void;
  terminateWorker: () => void;
  loadModel: () => void;
  selectModel: (id: TTSModelId) => void;
  clearError: () => void;
}

const initialState: TTSModelState = {
  stage: "idle",
  progress: 0,
  estimatedTimeRemaining: "",
  error: null,
  device: null,
  selectedModel: DEFAULT_TTS_MODEL,
  downloadSizeBytes: TTS_MODELS.find((m) => m.id === DEFAULT_TTS_MODEL)!
    .downloadSizeBytes,
  worker: null,
  isReady: false,
};

// Module-level start time for ETA calculation (same pattern as transcription-model-store.ts)
let downloadStartTime = 0;

function calculateETA(progress: number): string {
  if (progress <= 0 || downloadStartTime === 0) return "";
  const elapsed = performance.now() - downloadStartTime;
  const rate = progress / elapsed;
  const remaining = (100 - progress) / rate;
  const seconds = Math.round(remaining / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export const useTTSModelStore = create<TTSModelStore>((set, get) => ({
  ...initialState,

  initWorker: () => {
    const { worker: existing } = get();
    if (existing) return;

    const worker = new Worker(
      new URL("./tts-worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.addEventListener("message", (event: MessageEvent<TTSWorkerResponse>) => {
      const msg = event.data;
      switch (msg.type) {
        case "check":
          // Update device field based on WebGPU support; stage stays "checking"
          // until loadModel() is called
          set({
            device: msg.webgpuSupported ? "webgpu" : "wasm",
            stage: "idle",
          });
          break;

        case "load_progress":
          set({
            stage: "downloading",
            progress: Math.round(msg.progress),
            estimatedTimeRemaining: calculateETA(msg.progress),
          });
          break;

        case "load_complete":
          set({
            stage: "ready",
            progress: 100,
            estimatedTimeRemaining: "",
            isReady: true,
            device: msg.device,
          });
          break;

        case "load_error":
          set({
            stage: "error",
            error: msg.error,
            isReady: false,
            estimatedTimeRemaining: "",
          });
          break;
      }
    });

    set({ worker, stage: "checking" });
    worker.postMessage({ type: "check" });
  },

  terminateWorker: () => {
    const { worker } = get();
    if (worker) {
      worker.terminate();
    }
    set({ worker: null, stage: "idle", isReady: false });
  },

  loadModel: () => {
    const { worker, selectedModel } = get();
    if (!worker) return;

    const model = TTS_MODELS.find((m) => m.id === selectedModel);
    if (!model) return;

    downloadStartTime = performance.now();
    set({ stage: "downloading", progress: 0, error: null, estimatedTimeRemaining: "" });
    worker.postMessage({ type: "load", modelId: model.huggingFaceId, dtype: model.dtype });
  },

  selectModel: (id: TTSModelId) => {
    const model = TTS_MODELS.find((m) => m.id === id);
    if (!model) return;
    set({
      selectedModel: id,
      downloadSizeBytes: model.downloadSizeBytes,
    });
  },

  clearError: () => {
    set((prev) => ({
      error: null,
      stage: prev.stage === "error" ? "idle" : prev.stage,
    }));
  },
}));
