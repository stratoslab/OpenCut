import { describe, it, expect } from "bun:test";
import { chiSquaredDistance, computeHistogram, type ImageDataLike } from "../histogram-calculator";

function createSolidImageData(r: number, g: number, b: number, width: number, height: number): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }
  return { data, width, height };
}

function createGradientImageData(
  width: number,
  height: number,
  startR: number,
  startG: number,
  startB: number,
  endR: number,
  endG: number,
  endB: number,
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const r = Math.round(startR + (endR - startR) * t);
    const g = Math.round(startG + (endG - startG) * t);
    const b = Math.round(startB + (endB - startB) * t);
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("SceneDetector algorithm (Req 2.1-2.6)", () => {
  it("detects large color change as scene boundary", () => {
    const black = computeHistogram(createSolidImageData(0, 0, 0, 100, 100));
    const white = computeHistogram(createSolidImageData(255, 255, 255, 100, 100));

    const distance = chiSquaredDistance(black, white);

    expect(distance).toBeGreaterThan(0.5);
  });

  it("small color change stays below threshold", () => {
    const red1 = computeHistogram(createSolidImageData(200, 0, 0, 100, 100));
    const red2 = computeHistogram(createSolidImageData(210, 0, 0, 100, 100));

    const distance = chiSquaredDistance(red1, red2);

    expect(distance).toBeLessThan(0.5);
  });

  it("identical frames produce zero distance", () => {
    const frame = computeHistogram(createSolidImageData(128, 64, 192, 50, 50));

    const distance = chiSquaredDistance(frame, frame);

    expect(distance).toBeLessThan(1e-10);
  });

  it("gradual changes produce lower distance than abrupt cuts", () => {
    const frame1 = computeHistogram(createSolidImageData(0, 0, 0, 100, 100));
    const gradual = computeHistogram(createGradientImageData(100, 100, 0, 0, 0, 50, 50, 50));
    const abrupt = computeHistogram(createSolidImageData(255, 255, 255, 100, 100));

    const gradualDistance = chiSquaredDistance(frame1, gradual);
    const abruptDistance = chiSquaredDistance(frame1, abrupt);

    expect(abruptDistance).toBeGreaterThan(gradualDistance);
  });

  it("handles different image dimensions correctly", () => {
    const small = computeHistogram(createSolidImageData(100, 100, 100, 10, 10));
    const large = computeHistogram(createSolidImageData(100, 100, 100, 100, 100));

    const distance = chiSquaredDistance(small, large);

    expect(distance).toBeLessThan(1e-10);
  });
});
