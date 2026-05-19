import type { WorkerResponse } from "./types";

export class BackgroundRemovalService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (v: {
        alphaMask: Float32Array;
        width: number;
        height: number;
      }) => void;
      reject: (err: Error) => void;
    }
  >();

  setWorker(worker: Worker): void {
    this.worker = worker;
    worker.addEventListener(
      "message",
      (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === "result") {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            pending.resolve({
              alphaMask: msg.alphaMask,
              width: msg.width,
              height: msg.height,
            });
            this.pendingRequests.delete(msg.id);
          }
        } else if (msg.type === "error") {
          // Reject all pending on error
          for (const [id, p] of this.pendingRequests) {
            p.reject(new Error(msg.error));
            this.pendingRequests.delete(id);
          }
        }
      }
    );
  }

  async removeBackground(input: File | ImageData): Promise<Blob> {
    if (!this.worker) {
      return Promise.reject(new Error("Model not ready"));
    }

    // Decode File → ImageData if needed
    const originalImageData = input instanceof File
      ? await this.decodeFile(input)
      : input;

    const originalW = originalImageData.width;
    const originalH = originalImageData.height;

    // Downscale to ≤1024×1024 for inference
    const inferenceImageData = this.resizeImageData(originalImageData, 1024);

    // Run inference in worker
    const { alphaMask, width: maskW, height: maskH } = await this.sendToWorker(inferenceImageData);

    // Upscale mask back to original dimensions if we downscaled
    const finalMask = (maskW !== originalW || maskH !== originalH)
      ? this.upscaleAlphaMask(alphaMask, maskW, maskH, originalW, originalH)
      : alphaMask;

    // Composite: apply alpha mask to original RGBA pixels
    const composited = this.applyAlphaMask(originalImageData, finalMask);

    // Encode as PNG with transparent background
    return this.encodeAsPng(composited);
  }

  async removeBackgroundFromFrames(
    frames: ImageData[],
    options?: { signal?: AbortSignal; onProgress?: (n: number) => void }
  ): Promise<Blob[]> {
    const results: Blob[] = [];
    const total = frames.length;

    if (total === 0) {
      options?.onProgress?.(100);
      return results;
    }

    options?.onProgress?.(0);

    for (let i = 0; i < total; i++) {
      if (options?.signal?.aborted) {
        return results;
      }

      const blob = await this.removeBackground(frames[i]);
      results.push(blob);

      const progress = Math.round(((i + 1) / total) * 100);
      options?.onProgress?.(progress);
    }

    return results;
  }

  private async decodeFile(file: File): Promise<ImageData> {
    // Draw file onto OffscreenCanvas (or <canvas> fallback), return getImageData
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext(
        "2d"
      ) as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    } catch {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }

  resizeImageData(src: ImageData, maxDim: number): ImageData {
    const { width, height } = src;
    if (Math.max(width, height) <= maxDim) return src;
    const scale = maxDim / Math.max(width, height);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);
    try {
      const canvas = new OffscreenCanvas(newW, newH);
      const ctx = canvas.getContext(
        "2d"
      ) as OffscreenCanvasRenderingContext2D;
      const srcCanvas = new OffscreenCanvas(width, height);
      const srcCtx = srcCanvas.getContext(
        "2d"
      ) as OffscreenCanvasRenderingContext2D;
      srcCtx.putImageData(src, 0, 0);
      ctx.drawImage(srcCanvas, 0, 0, newW, newH);
      return ctx.getImageData(0, 0, newW, newH);
    } catch {
      const canvas = document.createElement("canvas");
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext("2d")!;
      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = width;
      srcCanvas.height = height;
      srcCanvas.getContext("2d")!.putImageData(src, 0, 0);
      ctx.drawImage(srcCanvas, 0, 0, newW, newH);
      return ctx.getImageData(0, 0, newW, newH);
    }
  }

  upscaleAlphaMask(
    mask: Float32Array,
    maskW: number,
    maskH: number,
    targetW: number,
    targetH: number
  ): Float32Array {
    const out = new Float32Array(targetW * targetH);
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const srcX = Math.min(
          Math.round((x / targetW) * maskW),
          maskW - 1
        );
        const srcY = Math.min(
          Math.round((y / targetH) * maskH),
          maskH - 1
        );
        out[y * targetW + x] = mask[srcY * maskW + srcX];
      }
    }
    return out;
  }

  applyAlphaMask(original: ImageData, alphaMask: Float32Array): ImageData {
    const out = new ImageData(original.width, original.height);
    for (let i = 0; i < original.width * original.height; i++) {
      out.data[i * 4 + 0] = original.data[i * 4 + 0];
      out.data[i * 4 + 1] = original.data[i * 4 + 1];
      out.data[i * 4 + 2] = original.data[i * 4 + 2];
      out.data[i * 4 + 3] = Math.round(alphaMask[i] * 255);
    }
    return out;
  }

  async encodeAsPng(composited: ImageData): Promise<Blob> {
    try {
      const canvas = new OffscreenCanvas(
        composited.width,
        composited.height
      );
      const ctx = canvas.getContext(
        "2d"
      ) as OffscreenCanvasRenderingContext2D;
      ctx.putImageData(composited, 0, 0);
      return await canvas.convertToBlob({ type: "image/png" });
    } catch {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = composited.width;
        canvas.height = composited.height;
        canvas.getContext("2d")!.putImageData(composited, 0, 0);
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("toBlob failed")),
          "image/png"
        );
      });
    }
  }

  private sendToWorker(
    imageData: ImageData
  ): Promise<{ alphaMask: Float32Array; width: number; height: number }> {
    if (!this.worker) return Promise.reject(new Error("Model not ready"));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({ type: "remove-background", id, imageData });
    });
  }
}

export const backgroundRemovalService = new BackgroundRemovalService();
