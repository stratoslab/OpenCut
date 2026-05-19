import { create } from "zustand";
import type { SceneCategory } from "@/ai/scene-classifier";
import type { WorkerMessage, WorkerResponse } from "./clip-worker";

// ─── Stage type ──────────────────────────────────────────────────────────────

export type ModelStage =
  | "idle"
  | "checking"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

// ─── Label prompts ────────────────────────────────────────────────────────────

export const LABEL_PROMPTS: Record<SceneCategory, string> = {
  "talking-head": "a person talking directly to camera",
  "b-roll":       "cinematic b-roll footage of a scene or environment",
  "action":       "fast-paced action or movement sequence",
  "transition":   "a video transition or dissolve effect",
  "silent":       "a static or near-static scene with no movement",
  "music":        "a music performance or concert",
  "intro":        "an introduction title card or opening sequence",
  "outro":        "an outro, end card, or closing sequence",
  "unknown":      "an unclassifiable or ambiguous scene",
};

// ─── Pure math helpers ────────────────────────────────────────────────────────

/**
 * Dot product of two L2-normalised vectors, which equals cos(θ).
 * Both vectors must already be unit-norm.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Standard softmax at temperature T with numerical stability via max subtraction.
 */
export function softmax(scores: number[], temperature = 1.0): number[] {
  const scaled = scores.map(s => s / temperature);
  const maxVal = Math.max(...scaled);
  const exps = scaled.map(s => Math.exp(s - maxVal));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

/** Index of the maximum value in an array. */
export function argmax(arr: number[]): number {
  return arr.reduce((best, v, i) => (v > arr[best] ? i : best), 0);
}

/** L2-normalise a vector (returns a new array). */
export function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / norm);
}

// ─── Store interfaces ─────────────────────────────────────────────────────────

interface ClipModelState {
  stage: ModelStage;
  progress: number;
  error: string | null;
  worker: Worker | null;
}

interface ClipModelStore extends ClipModelState {
  loadModel(): void;
  terminateWorker(): void;
  embedImage(imageData: ImageData): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
  classifyFrame(imageData: ImageData): Promise<{ category: SceneCategory; confidence: number }>;
}

// ─── Pending-promise map (module-level, not in Zustand state) ─────────────────

const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

// ─── Store ────────────────────────────────────────────────────────────────────

export const useClipModelStore = create<ClipModelStore>((set, get) => ({
  // Initial state
  stage: "idle",
  progress: 0,
  error: null,
  worker: null,

  loadModel(): void {
    const { worker: existingWorker } = get();

    // Reuse existing worker if already present (no-op if already downloading/ready)
    if (existingWorker) {
      set({ stage: "downloading", progress: 0, error: null });
      existingWorker.postMessage({ type: "load" } satisfies WorkerMessage);
      return;
    }

    // Spin up a new worker
    const worker = new Worker(
      new URL("./clip-worker.ts", import.meta.url),
      { type: "module" },
    );

    // Wire the message handler
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      switch (msg.type) {
        case "progress":
          set({ progress: msg.progress });
          break;

        case "ready":
          set({ stage: "ready", progress: 100 });
          break;

        case "error": {
          const err = new Error(msg.message);
          for (const { reject } of pending.values()) reject(err);
          pending.clear();
          set({ stage: "error", error: msg.message });
          break;
        }

        case "embedImageResult": {
          const entry = pending.get(msg.id);
          if (entry) {
            entry.resolve(msg.embedding);
            pending.delete(msg.id);
          }
          break;
        }

        case "embedTextsResult": {
          const entry = pending.get(msg.id);
          if (entry) {
            entry.resolve(msg.embeddings);
            pending.delete(msg.id);
          }
          break;
        }
      }
    };

    set({ stage: "downloading", progress: 0, error: null, worker });
    worker.postMessage({ type: "load" } satisfies WorkerMessage);
  },

  terminateWorker(): void {
    const { worker } = get();
    if (worker) {
      worker.terminate();
    }
    const err = new Error("Worker terminated");
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
    set({ worker: null, stage: "idle" });
  },

  embedImage(imageData: ImageData): Promise<number[]> {
    const { stage, worker } = get();
    if (stage !== "ready") {
      return Promise.reject(new Error("CLIP model not ready"));
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker!.postMessage({ type: "embedImage", id, imageData } satisfies WorkerMessage);
    });
  },

  embedTexts(texts: string[]): Promise<number[][]> {
    const { stage, worker } = get();
    if (stage !== "ready") {
      return Promise.reject(new Error("CLIP model not ready"));
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker!.postMessage({ type: "embedTexts", id, texts } satisfies WorkerMessage);
    });
  },

  async classifyFrame(imageData: ImageData): Promise<{ category: SceneCategory; confidence: number }> {
    const { stage } = get();
    if (stage !== "ready") {
      return Promise.reject(new Error("CLIP model not ready"));
    }
    const [imgEmb, textEmbs] = await Promise.all([
      get().embedImage(imageData),
      get().embedTexts(Object.values(LABEL_PROMPTS)),
    ]);
    const scores = textEmbs.map(t => cosineSimilarity(imgEmb, t));
    const probs = softmax(scores, 1.0);
    const best = argmax(probs);
    const categories = Object.keys(LABEL_PROMPTS) as SceneCategory[];
    return { category: categories[best], confidence: probs[best] };
  },
}));

// Re-export pending for use in subsequent task implementations
export { pending };
