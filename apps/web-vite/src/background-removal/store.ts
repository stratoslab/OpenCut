import { create } from "zustand";
import type { ModelStage } from "@/ai/ai-model-store";
import type { WorkerResponse } from "./types";
import { backgroundRemovalService } from "./service";

interface BackgroundRemovalState {
  stage: ModelStage;
  progress: number;
  error: string | null;
  device: "webgpu" | "wasm" | null;
  worker: Worker | null;
}

interface BackgroundRemovalStore extends BackgroundRemovalState {
  initWorker: () => void;
  terminateWorker: () => void;
  loadModel: () => void;
  clearError: () => void;
}

export const useBackgroundRemovalStore = create<BackgroundRemovalStore>(
  (set, get) => ({
    stage: "idle",
    progress: 0,
    error: null,
    device: null,
    worker: null,

    initWorker: () => {
      const worker = new Worker(
        new URL("./worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;

        switch (response.type) {
          case "device-selected":
            set({ device: response.device });
            break;

          case "load-progress":
            set({ stage: "downloading", progress: response.progress });
            break;

          case "load-retry":
            // No stage change — surfaced via retryInfo if needed in the future
            break;

          case "ready":
            set({ stage: "ready", progress: 100 });
            break;

          case "error":
            set({ stage: "error", error: response.error });
            break;
        }
      });

      backgroundRemovalService.setWorker(worker);

      set({ worker, stage: "downloading", progress: 0 });

      worker.postMessage({ type: "load" });
    },

    terminateWorker: () => {
      const { worker } = get();
      if (worker) {
        worker.terminate();
        set({ worker: null });
      }
    },

    loadModel: () => {
      const { worker } = get();
      set({ stage: "downloading", progress: 0, error: null });
      worker?.postMessage({ type: "load" });
    },

    clearError: () => {
      set((prev) => ({
        error: null,
        stage: prev.stage === "error" ? "idle" : prev.stage,
      }));
    },
  }),
);
