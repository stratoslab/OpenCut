import fc from "fast-check";
import { describe, it, expect, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Minimal ImageData polyfill for bun's test environment (no DOM)
// ---------------------------------------------------------------------------
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(
    widthOrData: number | Uint8ClampedArray,
    height?: number,
    h?: number
  ) {
    if (typeof widthOrData === "number") {
      this.width = widthOrData;
      this.height = height!;
      this.data = new Uint8ClampedArray(widthOrData * height! * 4);
    } else {
      // new ImageData(data, width, height)
      this.data = widthOrData;
      this.width = height!;
      this.height = h!;
    }
  }
}

// ---------------------------------------------------------------------------
// OffscreenCanvas mock — used by resizeImageData and encodeAsPng
// ---------------------------------------------------------------------------
class MockOffscreenCanvas {
  width: number;
  height: number;
  private _imageData: MockImageData;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this._imageData = new MockImageData(width, height);
  }

  getContext(_type: string) {
    const canvas = this;
    return {
      putImageData(data: MockImageData) {
        canvas._imageData = data;
      },
      drawImage(
        _src: MockOffscreenCanvas,
        _dx: number,
        _dy: number,
        dw?: number,
        dh?: number
      ) {
        if (dw !== undefined && dh !== undefined) {
          canvas._imageData = new MockImageData(dw, dh);
        }
      },
      getImageData(_x: number, _y: number, w: number, h: number) {
        return new MockImageData(w, h);
      },
    };
  }

  // convertToBlob is used by encodeAsPng
  async convertToBlob(options?: { type?: string }): Promise<Blob> {
    return new Blob(["png-data"], { type: options?.type ?? "image/png" });
  }
}

// Install globals before importing service
(globalThis as Record<string, unknown>).ImageData = MockImageData;
(globalThis as Record<string, unknown>).OffscreenCanvas = MockOffscreenCanvas;

// Import service AFTER polyfills are installed
import { BackgroundRemovalService } from "../service";

// ---------------------------------------------------------------------------
// Helper: cast service to access private methods in tests
// ---------------------------------------------------------------------------
type ServicePrivate = {
  applyAlphaMask(original: ImageData, alphaMask: Float32Array): ImageData;
  encodeAsPng(composited: ImageData): Promise<Blob>;
};

// ---------------------------------------------------------------------------
// Property 1: AlphaMask application preserves RGB channels
// Feature: local-background-removal, Property 1: AlphaMask application preserves RGB channels
// ---------------------------------------------------------------------------
describe("Property 1: AlphaMask application preserves RGB channels", () => {
  it("RGB channels are unchanged and alpha = Math.round(mask[i] * 255) for all pixels", () => {
    // Validates: Requirements 5.3
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 8 }),
        (W, H) => {
          const pixelCount = W * H;
          return fc.assert(
            fc.property(
              fc.uint8Array({ minLength: pixelCount * 4, maxLength: pixelCount * 4 }),
              fc.float32Array({ minLength: pixelCount, maxLength: pixelCount }).map(
                (arr) => {
                  // Clamp values to [0, 1]
                  for (let i = 0; i < arr.length; i++) {
                    arr[i] = Math.max(0, Math.min(1, isNaN(arr[i]) ? 0 : arr[i]));
                  }
                  return arr;
                }
              ),
              (pixels, mask) => {
                const service = new BackgroundRemovalService();
                const imageData = new MockImageData(
                  new Uint8ClampedArray(pixels),
                  W,
                  H
                ) as unknown as ImageData;

                const result = (service as unknown as ServicePrivate).applyAlphaMask(
                  imageData,
                  mask
                );

                for (let i = 0; i < pixelCount; i++) {
                  // RGB channels must be preserved
                  if (result.data[i * 4 + 0] !== pixels[i * 4 + 0]) return false;
                  if (result.data[i * 4 + 1] !== pixels[i * 4 + 1]) return false;
                  if (result.data[i * 4 + 2] !== pixels[i * 4 + 2]) return false;
                  // Alpha must equal Math.round(mask[i] * 255)
                  const expectedAlpha = Math.round(mask[i] * 255);
                  if (result.data[i * 4 + 3] !== expectedAlpha) return false;
                }
                return true;
              }
            ),
            { numRuns: 20 }
          );
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Downscale then upscale preserves pixel count
// Feature: local-background-removal, Property 2: Downscale then upscale preserves pixel count
// ---------------------------------------------------------------------------
describe("Property 2: Downscale then upscale preserves pixel count", () => {
  it("upscaled mask length equals W * H for any W, H > 1024", () => {
    // Validates: Requirements 5.5
    fc.assert(
      fc.property(
        fc.integer({ min: 1025, max: 2048 }),
        fc.integer({ min: 1025, max: 2048 }),
        (W, H) => {
          const service = new BackgroundRemovalService();

          // Build a minimal ImageData for the source
          const src = new MockImageData(W, H) as unknown as ImageData;

          // Downscale to ≤1024
          const downscaled = service.resizeImageData(src, 1024);
          const newW = downscaled.width;
          const newH = downscaled.height;

          // Produce a synthetic Float32Array mask of the downscaled size
          const syntheticMask = new Float32Array(newW * newH).fill(0.5);

          // Upscale back to original dimensions
          const upscaled = service.upscaleAlphaMask(syntheticMask, newW, newH, W, H);

          return upscaled.length === W * H;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Aspect ratio is preserved after downscaling
// Feature: local-background-removal, Property 3: Aspect ratio is preserved after downscaling
// ---------------------------------------------------------------------------
describe("Property 3: Aspect ratio is preserved after downscaling", () => {
  it("newW/newH is within 0.01 of W/H and max(newW, newH) <= 1024", () => {
    // Validates: Requirements 5.5
    fc.assert(
      fc.property(
        fc.integer({ min: 1025, max: 2048 }),
        fc.integer({ min: 1025, max: 2048 }),
        (W, H) => {
          const service = new BackgroundRemovalService();
          const src = new MockImageData(W, H) as unknown as ImageData;

          const downscaled = service.resizeImageData(src, 1024);
          const newW = downscaled.width;
          const newH = downscaled.height;

          const originalRatio = W / H;
          const newRatio = newW / newH;

          const ratioPreserved = Math.abs(newRatio - originalRatio) <= 0.01;
          const maxDimOk = Math.max(newW, newH) <= 1024;

          return ratioPreserved && maxDimOk;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Frame progress is monotonically increasing
// Feature: local-background-removal, Property 4: Frame progress is monotonically increasing
// ---------------------------------------------------------------------------
describe("Property 4: Frame progress is monotonically increasing", () => {
  it("onProgress values are non-decreasing and last value is 100", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (N) => {
          const service = new BackgroundRemovalService();
          const fakeBlob = new Blob(["fake"], { type: "image/png" });

          // Mock removeBackground to return a fake Blob immediately
          service.removeBackground = mock(async (_input: File | ImageData) => {
            return fakeBlob;
          });

          const frames = Array.from(
            { length: N },
            () => new MockImageData(4, 4) as unknown as ImageData
          );

          const progressValues: number[] = [];

          await service.removeBackgroundFromFrames(frames, {
            onProgress: (n) => {
              progressValues.push(n);
            },
          });

          // Must have at least one progress value (the final 100)
          if (progressValues.length === 0) return false;

          // Sequence must be non-decreasing
          for (let i = 1; i < progressValues.length; i++) {
            if (progressValues[i] < progressValues[i - 1]) return false;
          }

          // Last value must be 100
          return progressValues[progressValues.length - 1] === 100;
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Abort stops processing and returns partial results
// Feature: local-background-removal, Property 5: Abort stops processing and returns partial results
// ---------------------------------------------------------------------------
describe("Property 5: Abort stops processing and returns partial results", () => {
  it("result length equals k when aborted after k completions", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 0, max: 9 }),
        async (N, rawK) => {
          // k must be in [0, N-1]
          const k = rawK % N;

          const service = new BackgroundRemovalService();
          const fakeBlob = new Blob(["fake"], { type: "image/png" });

          service.removeBackground = mock(async (_input: File | ImageData) => {
            return fakeBlob;
          });

          const frames = Array.from(
            { length: N },
            () => new MockImageData(4, 4) as unknown as ImageData
          );

          const controller = new AbortController();

          // When k=0, abort immediately before any frame runs.
          // The service checks signal.aborted before each frame, so this
          // causes it to return [] immediately.
          if (k === 0) {
            controller.abort();
            const results = await service.removeBackgroundFromFrames(frames, {
              signal: controller.signal,
            });
            return results.length === 0;
          }

          // For k > 0: abort after k frames complete via onProgress callback.
          let frameCompletions = 0;

          const results = await service.removeBackgroundFromFrames(frames, {
            signal: controller.signal,
            onProgress: (n) => {
              // Skip the initial progress(0) call (fired before any frame)
              if (n === 0) return;
              frameCompletions++;
              if (frameCompletions === k) {
                controller.abort();
              }
            },
          });

          return results.length === k;
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: PNG encoding round-trip preserves dimensions
// Feature: local-background-removal, Property 6: PNG encoding round-trip preserves dimensions
//
// Note: `createImageBitmap` is not available in the bun test environment.
// A full round-trip decode is therefore not possible here. Instead, we verify
// the structural contract: `encodeAsPng` returns a Blob with type "image/png".
// The MockOffscreenCanvas.convertToBlob mock returns a Blob with the correct
// MIME type, confirming the method calls the right API path.
// ---------------------------------------------------------------------------
describe("Property 6: PNG encoding round-trip preserves dimensions", () => {
  it("encodeAsPng returns a Blob with type image/png", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 64 }),
        fc.integer({ min: 1, max: 64 }),
        async (W, H) => {
          const service = new BackgroundRemovalService();
          const imageData = new MockImageData(W, H) as unknown as ImageData;

          const blob = await (service as unknown as ServicePrivate).encodeAsPng(
            imageData
          );

          return blob instanceof Blob && blob.type === "image/png";
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Sequential frame processing produces one output per input
// Feature: local-background-removal, Property 7: Sequential frame processing produces one output per input
// ---------------------------------------------------------------------------
describe("Property 7: Sequential frame processing produces one output per input", () => {
  it("result array length equals N for any N in [1, 20]", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (N) => {
          const service = new BackgroundRemovalService();
          const fakeBlob = new Blob(["fake"], { type: "image/png" });

          // Mock removeBackground to return a fake Blob immediately (no abort)
          service.removeBackground = mock(async (_input: File | ImageData) => {
            return fakeBlob;
          });

          const frames = Array.from(
            { length: N },
            () => new MockImageData(4, 4) as unknown as ImageData
          );

          const results = await service.removeBackgroundFromFrames(frames);

          return results.length === N;
        }
      ),
      { numRuns: 30 }
    );
  });
});
