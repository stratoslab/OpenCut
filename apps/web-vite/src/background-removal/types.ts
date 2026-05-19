// Messages sent FROM main thread TO worker
export type WorkerMessage =
  | { type: "load" }
  | { type: "remove-background"; id: string; imageData: ImageData }
  | { type: "cancel" };

// Messages sent FROM worker TO main thread
export type WorkerResponse =
  | { type: "device-selected"; device: "webgpu" | "wasm" }
  | { type: "load-progress"; progress: number } // integer [0, 100]
  | { type: "load-retry"; attempt: number; maxRetries: number; delay: number; url: string }
  | { type: "ready" }
  | { type: "result"; id: string; alphaMask: Float32Array; width: number; height: number }
  | { type: "cancelled" }
  | { type: "error"; error: string };
