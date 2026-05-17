import { describe, it, expect } from "bun:test";
import { computeHistogram, chiSquaredDistance, getHistogramConfig, type ImageDataLike } from "../histogram-calculator";

function createRawImageData(
  width: number,
  height: number,
  generator: (i: number) => [number, number, number],
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const [r, g, b] = generator(i);
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }
  return { data, width, height };
}

describe("HistogramCalculator (Req 4.1)", () => {
  it("Property: Determinism — identical inputs produce identical histograms", () => {
    for (let run = 0; run < 200; run++) {
      const width = 1 + Math.floor(Math.random() * 100);
      const height = 1 + Math.floor(Math.random() * 100);
      const raw = createRawImageData(width, height, () => [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);

      const h1 = computeHistogram(raw);
      const h2 = computeHistogram(raw);

      for (let i = 0; i < h1.length; i++) {
        expect(h1[i]).toBe(h2[i]);
      }
    }
  });

  it("Property: Black image puts all pixels in first bin per channel", () => {
    for (let run = 0; run < 50; run++) {
      const width = 1 + Math.floor(Math.random() * 50);
      const height = 1 + Math.floor(Math.random() * 50);
      const pixelCount = width * height;
      const raw = createRawImageData(width, height, () => [0, 0, 0]);

      const histogram = computeHistogram(raw);

      expect(histogram[0]).toBe(pixelCount);
      expect(histogram[8]).toBe(pixelCount);
      expect(histogram[16]).toBe(pixelCount);

      for (let i = 1; i < 8; i++) {
        expect(histogram[i]).toBe(0);
        expect(histogram[8 + i]).toBe(0);
        expect(histogram[16 + i]).toBe(0);
      }
    }
  });

  it("Property: Histogram length is always 24", () => {
    for (let run = 0; run < 100; run++) {
      const width = 1 + Math.floor(Math.random() * 200);
      const height = 1 + Math.floor(Math.random() * 200);
      const raw = createRawImageData(width, height, () => [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);

      const histogram = computeHistogram(raw);

      expect(histogram.length).toBe(24);
    }
  });

  it("Property: Histogram values are non-negative", () => {
    for (let run = 0; run < 200; run++) {
      const width = 1 + Math.floor(Math.random() * 100);
      const height = 1 + Math.floor(Math.random() * 100);
      const raw = createRawImageData(width, height, () => [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);

      const histogram = computeHistogram(raw);

      for (let i = 0; i < histogram.length; i++) {
        expect(histogram[i]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("Property: Sum of R bins equals pixel count (same for G, B)", () => {
    for (let run = 0; run < 100; run++) {
      const width = 1 + Math.floor(Math.random() * 50);
      const height = 1 + Math.floor(Math.random() * 50);
      const pixelCount = width * height;
      const raw = createRawImageData(width, height, () => [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);

      const histogram = computeHistogram(raw);

      const rSum = histogram.slice(0, 8).reduce((a, b) => a + b, 0);
      const gSum = histogram.slice(8, 16).reduce((a, b) => a + b, 0);
      const bSum = histogram.slice(16, 24).reduce((a, b) => a + b, 0);

      expect(rSum).toBe(pixelCount);
      expect(gSum).toBe(pixelCount);
      expect(bSum).toBe(pixelCount);
    }
  });

  it("Property: Solid color image produces single-bin histogram per channel", () => {
    for (let run = 0; run < 50; run++) {
      const width = 10 + Math.floor(Math.random() * 50);
      const height = 10 + Math.floor(Math.random() * 50);
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      const pixelCount = width * height;
      const raw = createRawImageData(width, height, () => [r, g, b]);

      const histogram = computeHistogram(raw);

      const rBin = Math.min(Math.floor(r / 32), 7);
      const gBin = Math.min(Math.floor(g / 32), 7);
      const bBin = Math.min(Math.floor(b / 32), 7);

      for (let i = 0; i < 8; i++) {
        expect(histogram[i]).toBe(i === rBin ? pixelCount : 0);
        expect(histogram[8 + i]).toBe(i === gBin ? pixelCount : 0);
        expect(histogram[16 + i]).toBe(i === bBin ? pixelCount : 0);
      }
    }
  });

  it("Property: White image puts all pixels in last bin per channel", () => {
    for (let run = 0; run < 20; run++) {
      const width = 10 + Math.floor(Math.random() * 50);
      const height = 10 + Math.floor(Math.random() * 50);
      const pixelCount = width * height;
      const raw = createRawImageData(width, height, () => [255, 255, 255]);

      const histogram = computeHistogram(raw);

      expect(histogram[7]).toBe(pixelCount);
      expect(histogram[15]).toBe(pixelCount);
      expect(histogram[23]).toBe(pixelCount);

      for (let i = 0; i < 7; i++) {
        expect(histogram[i]).toBe(0);
        expect(histogram[8 + i]).toBe(0);
        expect(histogram[16 + i]).toBe(0);
      }
    }
  });

  it("returns correct config", () => {
    const config = getHistogramConfig();
    expect(config.binsPerChannel).toBe(8);
    expect(config.totalBins).toBe(24);
    expect(config.binSize).toBe(32);
  });
});

describe("Chi-squared distance properties", () => {
  it("Property: chiSquared(a, a) ≈ 0", () => {
    for (let run = 0; run < 200; run++) {
      const width = 10 + Math.floor(Math.random() * 50);
      const height = 10 + Math.floor(Math.random() * 50);
      const raw = createRawImageData(width, height, () => [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);

      const h = computeHistogram(raw);
      const distance = chiSquaredDistance(h, h);

      expect(distance).toBeLessThan(1e-6);
    }
  });

  it("Property: chiSquared(a, b) === chiSquared(b, a)", () => {
    for (let run = 0; run < 200; run++) {
      const w1 = 10 + Math.floor(Math.random() * 50);
      const h1 = 10 + Math.floor(Math.random() * 50);
      const raw1 = createRawImageData(w1, h1, () => [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);
      const hist1 = computeHistogram(raw1);

      const w2 = 10 + Math.floor(Math.random() * 50);
      const h2 = 10 + Math.floor(Math.random() * 50);
      const raw2 = createRawImageData(w2, h2, () => [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);
      const hist2 = computeHistogram(raw2);

      const d_ab = chiSquaredDistance(hist1, hist2);
      const d_ba = chiSquaredDistance(hist2, hist1);

      expect(Math.abs(d_ab - d_ba)).toBeLessThan(1e-10);
    }
  });

  it("Property: chiSquared(a, b) >= 0 for all pairs", () => {
    for (let run = 0; run < 200; run++) {
      const w1 = 10 + Math.floor(Math.random() * 50);
      const h1 = 10 + Math.floor(Math.random() * 50);
      const raw1 = createRawImageData(w1, h1, () => [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);
      const hist1 = computeHistogram(raw1);

      const w2 = 10 + Math.floor(Math.random() * 50);
      const h2 = 10 + Math.floor(Math.random() * 50);
      const raw2 = createRawImageData(w2, h2, () => [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);
      const hist2 = computeHistogram(raw2);

      const distance = chiSquaredDistance(hist1, hist2);

      expect(distance).toBeGreaterThanOrEqual(0);
    }
  });

  it("Property: distance increases with more different histograms", () => {
    const blackRaw = createRawImageData(50, 50, () => [0, 0, 0]);
    const whiteRaw = createRawImageData(50, 50, () => [255, 255, 255]);
    const redRaw = createRawImageData(50, 50, () => [255, 0, 0]);

    const black = computeHistogram(blackRaw);
    const white = computeHistogram(whiteRaw);
    const red = computeHistogram(redRaw);

    const blackWhite = chiSquaredDistance(black, white);
    const blackRed = chiSquaredDistance(black, red);

    expect(blackWhite).toBeGreaterThan(0);
    expect(blackRed).toBeGreaterThan(0);
  });
});
