import { create } from "zustand";
import type { TranscriptionModelId } from "@/transcription/types";
import { TRANSCRIPTION_MODELS, DEFAULT_TRANSCRIPTION_MODEL } from "@/transcription/models";

export type TranscriptionModelStage =
  | "idle"
  | "checking"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

export interface TranscriptionModelState {
  stage: TranscriptionModelStage;
  progress: number;
  currentFile: string;
  estimatedTimeRemaining: string;
  error: string | null;
  selectedModel: TranscriptionModelId;
  worker: Worker | null;
  isInitialized: boolean;
}

const initialState: TranscriptionModelState = {
  stage: "idle",
  progress: 0,
  currentFile: "",
  estimatedTimeRemaining: "",
  error: null,
  selectedModel: DEFAULT_TRANSCRIPTION_MODEL,
  worker: null,
  isInitialized: false,
};

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

interface TranscriptionModelStore extends TranscriptionModelState {
  initWorker: () => void;
  terminateWorker: () => void;
  loadModel: () => void;
  selectModel: (modelId: TranscriptionModelId) => void;
  clearError: () => void;
  reset: () => void;
}

export const useTranscriptionModelStore = create<TranscriptionModelStore>((set, get) => ({
  ...initialState,

  initWorker: () => {
    const { worker: existing } = get();
    if (existing) return;

    const worker = new Worker(
      new URL("@/services/transcription/worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.addEventListener("message", (event: MessageEvent) => {
      const { type, progress: prog, error } = event.data;

      switch (type) {
        case "init-progress":
          set({
            stage: "downloading",
            progress: typeof prog === "number" ? prog : 0,
            estimatedTimeRemaining: calculateETA(prog as number),
          });
          break;

        case "init-complete":
          set({
            stage: "ready",
            progress: 100,
            currentFile: "Model ready",
            estimatedTimeRemaining: "",
            isInitialized: true,
          });
          break;

        case "init-error":
          set({
            stage: "error",
            error: typeof error === "string" ? error : "Failed to load model",
            isInitialized: false,
          });
          break;
      }
    });

    set({ worker });
  },

  terminateWorker: () => {
    const { worker } = get();
    if (worker) {
      worker.terminate();
      set({ worker: null, isInitialized: false, stage: "idle" });
    }
  },

  loadModel: () => {
    const { worker, selectedModel } = get();
    if (!worker) return;

    const model = TRANSCRIPTION_MODELS.find((m) => m.id === selectedModel);
    if (!model) return;

    startTime = performance.now();
    set({
      stage: "downloading",
      progress: 0,
      error: null,
      currentFile: `Loading ${model.name} model...`,
    });

    worker.postMessage({
      type: "init",
      modelId: model.huggingFaceId,
    });
  },

  selectModel: (modelId: TranscriptionModelId) => {
    set({ selectedModel: modelId });
  },

  clearError: () => {
    set({ error: null, stage: "idle" });
  },

  reset: () => {
    const { worker } = get();
    if (worker) {
      worker.terminate();
    }
    set({
      ...initialState,
      selectedModel: get().selectedModel,
    });
  },
}));
