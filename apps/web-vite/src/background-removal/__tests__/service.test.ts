import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { BackgroundRemovalService } from "../service";

// ---------------------------------------------------------------------------
// Minimal ImageData polyfill for bun's test environment (no DOM)
// ---------------------------------------------------------------------------
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(widthOrData: number | Uint8ClampedArray, height?: number, h?: number) {
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
// OffscreenCanvas mock — used by resizeImageData
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
      drawImage(_src: MockOffscreenCanvas, _dx: number, _dy: number, dw?: number, dh?: number) {
        // When drawing with explicit destination dimensions, update canvas size
        if (dw !== undefined && dh !== undefined) {
          canvas._imageData = new MockImageData(dw, dh);
        }
      },
      getImageData(x: number, y: number, w: number, h: number) {
        return new MockImageData(w, h);
      },
    };
  }
}

// Install globals before importing service
const originalImageData = (globalThis as Record<string, unknown>).ImageData;
const originalOffscreenCanvas = (globalThis as Record<string, unknown>).OffscreenCanvas;

(globalThis as Record<string, unknown>).ImageData = MockImageData;
(globalThis as Record<string, unknown>).OffscreenCanvas = MockOffscreenCanvas;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImageData(width: number, height: number, fillR = 100, fillG = 150, fillB = 200, fillA = 255): MockImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 0] = fillR;
    data[i * 4 + 1] = fillG;
    data[i * 4 + 2] = fillB;
    data[i * 4 + 3] = fillA;
  }
  return new MockImageData(data, width, height);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BackgroundRemovalService", () => {
  let service: BackgroundRemovalService;

  beforeEach(() => {
    service = new BackgroundRemovalService();
  });

  // -------------------------------------------------------------------------
  // applyAlphaMask
  // -------------------------------------------------------------------------
  describe("applyAlphaMask", () => {
    it("preserves RGB channels and sets alpha = Math.round(mask[i] * 255) for mask values 0.0, 0.5, 1.0", () => {
      // 2×2 ImageData with known pixel values
      const original = makeImageData(2, 2, 10, 20, 30, 255);

      // mask: [0.0, 0.5, 1.0, 0.75] for the 4 pixels
      const mask = new Float32Array([0.0, 0.5, 1.0, 0.75]);

      const result = (service as unknown as { applyAlphaMask: (img: MockImageData, mask: Float32Array) => MockImageData }).applyAlphaMask(original as unknown as ImageData, mask);

      // Pixel 0 — mask 0.0 → alpha 0
      expect(result.data[0]).toBe(10);  // R
      expect(result.data[1]).toBe(20);  // G
      expect(result.data[2]).toBe(30);  // B
      expect(result.data[3]).toBe(0);   // alpha = Math.round(0.0 * 255) = 0

      // Pixel 1 — mask 0.5 → alpha 128
      expect(result.data[4]).toBe(10);
      expect(result.data[5]).toBe(20);
      expect(result.data[6]).toBe(30);
      expect(result.data[7]).toBe(Math.round(0.5 * 255)); // 128

      // Pixel 2 — mask 1.0 → alpha 255
      expect(result.data[8]).toBe(10);
      expect(result.data[9]).toBe(20);
      expect(result.data[10]).toBe(30);
      expect(result.data[11]).toBe(255); // Math.round(1.0 * 255) = 255

      // Pixel 3 — mask 0.75 → alpha 191
      expect(result.data[12]).toBe(10);
      expect(result.data[13]).toBe(20);
      expect(result.data[14]).toBe(30);
      expect(result.data[15]).toBe(Math.round(0.75 * 255)); // 191
    });

    it("output dimensions match input dimensions", () => {
      const original = makeImageData(2, 2);
      const mask = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const result = (service as unknown as { applyAlphaMask: (img: MockImageData, mask: Float32Array) => MockImageData }).applyAlphaMask(original as unknown as ImageData, mask);
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // resizeImageData
  // -------------------------------------------------------------------------
  describe("resizeImageData", () => {
    it("downscales 2048×1024 to 1024×512 (aspect ratio preserved, max dim = 1024)", () => {
      const src = makeImageData(2048, 1024);
      const result = service.resizeImageData(src as unknown as ImageData, 1024);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(512);
    });

    it("does not upscale a 512×512 image (returns same dimensions)", () => {
      const src = makeImageData(512, 512);
      const result = service.resizeImageData(src as unknown as ImageData, 1024);
      // Should return the original src unchanged (no upscaling)
      expect(result.width).toBe(512);
      expect(result.height).toBe(512);
    });

    it("returns the same object reference when no resize is needed", () => {
      const src = makeImageData(512, 512);
      const result = service.resizeImageData(src as unknown as ImageData, 1024);
      expect(result).toBe(src as unknown as ImageData);
    });
  });

  // -------------------------------------------------------------------------
  // upscaleAlphaMask
  // -------------------------------------------------------------------------
  describe("upscaleAlphaMask", () => {
    it("upscales a 2×2 mask to 4×4 with correct nearest-neighbour values", () => {
      // 2×2 mask:
      //   [0.1, 0.2]
      //   [0.3, 0.4]
      const mask = new Float32Array([0.1, 0.2, 0.3, 0.4]);

      const result = service.upscaleAlphaMask(mask, 2, 2, 4, 4);

      expect(result.length).toBe(16);

      // The nearest-neighbour mapping for a 4×4 output from a 2×2 source:
      // For each output pixel (x, y):
      //   srcX = Math.min(Math.round((x / 4) * 2), 1)
      //   srcY = Math.min(Math.round((y / 4) * 2), 1)
      //
      // Row 0 (y=0): srcY = Math.min(Math.round(0), 1) = 0
      //   x=0: srcX = Math.min(Math.round(0), 1) = 0 → mask[0*2+0] = 0.1
      //   x=1: srcX = Math.min(Math.round(0.5), 1) = 1 → mask[0*2+1] = 0.2
      //   x=2: srcX = Math.min(Math.round(1.0), 1) = 1 → mask[0*2+1] = 0.2
      //   x=3: srcX = Math.min(Math.round(1.5), 1) = 1 → mask[0*2+1] = 0.2
      // Row 1 (y=1): srcY = Math.min(Math.round(0.5), 1) = 1
      //   x=0: srcX=0 → mask[1*2+0] = 0.3
      //   x=1: srcX=1 → mask[1*2+1] = 0.4
      //   x=2: srcX=1 → mask[1*2+1] = 0.4
      //   x=3: srcX=1 → mask[1*2+1] = 0.4
      // Row 2 (y=2): srcY = Math.min(Math.round(1.0), 1) = 1
      //   same as row 1
      // Row 3 (y=3): srcY = Math.min(Math.round(1.5), 1) = 1
      //   same as row 1

      const expected = [
        0.1, 0.2, 0.2, 0.2, // row 0
        0.3, 0.4, 0.4, 0.4, // row 1
        0.3, 0.4, 0.4, 0.4, // row 2
        0.3, 0.4, 0.4, 0.4, // row 3
      ];

      for (let i = 0; i < 16; i++) {
        expect(result[i]).toBeCloseTo(expected[i], 5);
      }
    });

    it("output length equals targetW * targetH", () => {
      const mask = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const result = service.upscaleAlphaMask(mask, 2, 2, 4, 4);
      expect(result.length).toBe(16);
    });
  });

  // -------------------------------------------------------------------------
  // removeBackgroundFromFrames with abort
  // -------------------------------------------------------------------------
  describe("removeBackgroundFromFrames with abort", () => {
    it("aborts after frame 2 of 5 and returns exactly 2 blobs", async () => {
      // Mock removeBackground to return a fake Blob
      let callCount = 0;
      const fakeBlob = new Blob(["fake"], { type: "image/png" });

      // Replace removeBackground with a mock that resolves immediately
      service.removeBackground = mock(async (_input: File | ImageData) => {
        callCount++;
        return fakeBlob;
      });

      const controller = new AbortController();
      const frames = Array.from({ length: 5 }, () => makeImageData(4, 4) as unknown as ImageData);

      // Track actual frame completions (n > 0 means at least one frame done;
      // the service also calls onProgress(0) at the very start before any frame)
      let frameCompletions = 0;
      const results = await service.removeBackgroundFromFrames(frames, {
        signal: controller.signal,
        onProgress: (n) => {
          // n === 0 is the initial call before any frame is processed; skip it
          if (n === 0) return;
          frameCompletions++;
          // Abort after the 2nd frame completes
          if (frameCompletions === 2) {
            controller.abort();
          }
        },
      });

      expect(results.length).toBe(2);
      expect(callCount).toBe(2);
    });
  });
});
