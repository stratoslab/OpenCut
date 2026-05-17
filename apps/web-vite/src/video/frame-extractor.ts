const MAX_POOL_SIZE = 2;
const IDLE_TIMEOUT_MS = 5000;

interface VideoPoolEntry {
  element: HTMLVideoElement;
  objectUrl: string | null;
  inUse: boolean;
  lastUsed: number;
}

const pool: VideoPoolEntry[] = [];
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

function createVideoElement(): VideoPoolEntry {
  const element = document.createElement("video");
  element.preload = "auto";
  element.muted = true;
  return {
    element,
    objectUrl: null,
    inUse: false,
    lastUsed: Date.now(),
  };
}

function acquirePoolEntry(): VideoPoolEntry | null {
  const idle = pool.find((e) => !e.inUse);
  if (idle) {
    idle.inUse = true;
    idle.lastUsed = Date.now();
    return idle;
  }

  if (pool.length < MAX_POOL_SIZE) {
    const entry = createVideoElement();
    entry.inUse = true;
    pool.push(entry);
    return entry;
  }

  return null;
}

function releasePoolEntry(entry: VideoPoolEntry): void {
  entry.inUse = false;
  entry.lastUsed = Date.now();
  scheduleCleanup();
}

function scheduleCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setTimeout(() => {
    cleanupTimer = null;
    const now = Date.now();
    for (let i = pool.length - 1; i >= 0; i--) {
      const entry = pool[i];
      if (!entry.inUse && now - entry.lastUsed > IDLE_TIMEOUT_MS) {
        if (entry.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl);
        }
        entry.element.remove();
        pool.splice(i, 1);
      }
    }
  }, IDLE_TIMEOUT_MS);
}

function seekToTime(
  element: HTMLVideoElement,
  time: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      element.removeEventListener("seeked", onSeeked);
      reject(new Error(`Seek timeout at ${time}s`));
    }, 10000);

    function onSeeked() {
      clearTimeout(timeout);
      element.removeEventListener("seeked", onSeeked);
      resolve();
    }

    element.addEventListener("seeked", onSeeked);
    element.addEventListener("error", onError);

    function onError() {
      clearTimeout(timeout);
      element.removeEventListener("seeked", onSeeked);
      element.removeEventListener("error", onError);
      reject(new Error(`Failed to seek to ${time}s`));
    }

    element.currentTime = time;
  });
}

export async function extractFrame(
  file: File,
  time: number,
): Promise<ImageData> {
  const entry = acquirePoolEntry();
  if (!entry) {
    throw new Error("All video elements are in use");
  }

  const videoEntry = entry;

  try {
    const objectUrl = URL.createObjectURL(file);

    if (videoEntry.objectUrl !== objectUrl) {
      if (videoEntry.objectUrl) {
        URL.revokeObjectURL(videoEntry.objectUrl);
      }
      videoEntry.objectUrl = objectUrl;
      videoEntry.element.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          videoEntry.element.removeEventListener("loadeddata", onLoaded);
          reject(new Error("Failed to load video metadata"));
        }, 10000);

        function onLoaded() {
          clearTimeout(timeout);
          videoEntry.element.removeEventListener("loadeddata", onLoaded);
          videoEntry.element.removeEventListener("error", onError);
          resolve();
        }

        function onError() {
          clearTimeout(timeout);
          videoEntry.element.removeEventListener("loadeddata", onLoaded);
          videoEntry.element.removeEventListener("error", onError);
          reject(new Error("Failed to load video"));
        }

        if (videoEntry.element.readyState >= 2) {
          onLoaded();
        } else {
          videoEntry.element.addEventListener("loadeddata", onLoaded);
          videoEntry.element.addEventListener("error", onError);
        }
      });
    }

    const clampedTime = Math.max(0, Math.min(time, videoEntry.element.duration));
    await seekToTime(videoEntry.element, clampedTime);

    const width = videoEntry.element.videoWidth;
    const height = videoEntry.element.videoHeight;

    if (width === 0 || height === 0) {
      throw new Error("Video has no valid dimensions");
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from OffscreenCanvas");
    }

    ctx.drawImage(videoEntry.element, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } finally {
    releasePoolEntry(videoEntry);
  }
}

export function getPoolStats(): { size: number; inUse: number; idle: number } {
  return {
    size: pool.length,
    inUse: pool.filter((e) => e.inUse).length,
    idle: pool.filter((e) => !e.inUse).length,
  };
}

export function clearPool(): void {
  for (const entry of pool) {
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
    }
    entry.element.remove();
  }
  pool.length = 0;
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
}
