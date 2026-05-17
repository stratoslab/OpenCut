import { extractFrame } from "./frame-extractor";
import { computeHistogram, chiSquaredDistance } from "./histogram-calculator";
import type { ImageDataLike } from "./histogram-calculator";

export interface SceneChange {
  timestamp: number;
  chiSquaredDistance: number;
  beforeThumbnail: string | null;
  afterThumbnail: string | null;
  type: "cut" | "dissolve";
}

export interface SceneDetectOptions {
  intervalSec?: number;
  threshold?: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

const DEFAULT_INTERVAL_SEC = 1;
const DEFAULT_THRESHOLD = 0.5;

function imageDataToThumbnail(imageData: ImageDataLike, maxDim = 160): string | null {
  try {
    const { width, height, data } = imageData;
    const scale = maxDim / Math.max(width, height);
    const thumbWidth = Math.round(width * scale);
    const thumbHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = width;
    fullCanvas.height = height;
    const fullCtx = fullCanvas.getContext("2d");
    if (!fullCtx) return null;

    const imgData = new ImageData(
      Uint8ClampedArray.from(data),
      width,
      height,
    );
    fullCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(fullCanvas, 0, 0, thumbWidth, thumbHeight);

    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

function classifySceneChange(distance: number, threshold: number): "cut" | "dissolve" {
  return distance > threshold * 2 ? "cut" : "dissolve";
}

export async function detectScenes(
  file: File,
  options: SceneDetectOptions = {},
): Promise<SceneChange[]> {
  const intervalSec = options.intervalSec ?? DEFAULT_INTERVAL_SEC;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  const objectUrl = URL.createObjectURL(file);

  try {
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Video load timeout")), 30000);
      video.addEventListener("loadeddata", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      video.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Failed to load video"));
      }, { once: true });
    });

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error("Invalid video duration");
    }

    const frameCount = Math.floor(duration / intervalSec);
    const scenes: SceneChange[] = [];
    let prevHistogram: Float64Array | null = null;
    let prevImageData: ImageDataLike | null = null;

    for (let i = 0; i <= frameCount; i++) {
      if (options.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const time = Math.min(i * intervalSec, duration - 0.01);

      const imageData = await extractFrame(file, time);
      const histogram = computeHistogram(imageData);

      if (prevHistogram) {
        const distance = chiSquaredDistance(prevHistogram, histogram);

        if (distance > threshold) {
          scenes.push({
            timestamp: time,
            chiSquaredDistance: distance,
            beforeThumbnail: prevImageData ? imageDataToThumbnail(prevImageData) : null,
            afterThumbnail: imageDataToThumbnail(imageData),
            type: classifySceneChange(distance, threshold),
          });
        }
      }

      prevHistogram = histogram;
      prevImageData = {
        data: new Uint8ClampedArray(imageData.data),
        width: imageData.width,
        height: imageData.height,
      };

      const progress = ((i + 1) / (frameCount + 1)) * 100;
      options.onProgress?.(progress);

      if (i % 3 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return scenes;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.remove();
  }
}
