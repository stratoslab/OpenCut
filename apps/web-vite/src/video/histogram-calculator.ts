const BINS_PER_CHANNEL = 8;
const CHANNELS = 3; // R, G, B
const TOTAL_BINS = BINS_PER_CHANNEL * CHANNELS; // 24
const BIN_SIZE = 256 / BINS_PER_CHANNEL; // 32

export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function computeHistogram(imageData: ImageDataLike): Float64Array {
  const { data, width, height } = imageData;
  const histogram = new Float64Array(TOTAL_BINS);

  const pixelCount = width * height;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];

    const rBin = Math.min(Math.floor(r / BIN_SIZE), BINS_PER_CHANNEL - 1);
    const gBin = Math.min(Math.floor(g / BIN_SIZE), BINS_PER_CHANNEL - 1);
    const bBin = Math.min(Math.floor(b / BIN_SIZE), BINS_PER_CHANNEL - 1);

    histogram[rBin]++;
    histogram[BINS_PER_CHANNEL + gBin]++;
    histogram[BINS_PER_CHANNEL * 2 + bBin]++;
  }

  return histogram;
}

export function chiSquaredDistance(
  h1: Float64Array | number[],
  h2: Float64Array | number[],
  epsilon = 1e-10,
): number {
  let distance = 0;
  const length = Math.min(h1.length, h2.length);

  const sum1 = Array.from(h1).reduce((a: number, b: number) => a + b, 0);
  const sum2 = Array.from(h2).reduce((a: number, b: number) => a + b, 0);

  for (let i = 0; i < length; i++) {
    const a = sum1 > 0 ? h1[i] / sum1 : 0;
    const b = sum2 > 0 ? h2[i] / sum2 : 0;
    const diff = a - b;
    const total = a + b + epsilon;
    distance += (diff * diff) / total;
  }

  return distance;
}

export function getHistogramConfig(): {
  binsPerChannel: number;
  totalBins: number;
  binSize: number;
} {
  return {
    binsPerChannel: BINS_PER_CHANNEL,
    totalBins: TOTAL_BINS,
    binSize: BIN_SIZE,
  };
}
