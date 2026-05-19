/**
 * TTS_Worker — Web Worker for OuteTTS on-device speech synthesis.
 * Runs all model inference off the main thread via WebGPU (WASM fallback).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Opaque speaker descriptor returned by OuteTTS create_speaker().
 * JSON-serializable object containing per-word audio token sequences.
 */
export type SpeakerDescriptor = Record<string, unknown>;

/** Word-level timestamp matching the WordTiming shape used by the Whisper pipeline. */
export interface TokenTimestamp {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

// ── Inbound messages (main thread → worker) ───────────────────────────────────

export type TTSWorkerMessage =
  | { type: "check" }
  | { type: "load"; modelId: string; dtype: string }
  | {
      type: "synthesize";
      requestId: string;
      text: string;
      speakerDescriptor?: SpeakerDescriptor;
      speed: number;
      pitch: number;
    }
  | {
      type: "encode_speaker";
      requestId: string;
      audioData: Float32Array;
      sampleRate: number;
    }
  | { type: "cancel"; requestId: string }
  | { type: "terminate" };

// ── Outbound messages (worker → main thread) ──────────────────────────────────

export type TTSWorkerResponse =
  | { type: "check"; webgpuSupported: boolean; reason?: string }
  | { type: "load_progress"; progress: number }
  | { type: "load_complete"; device: "webgpu" | "wasm" }
  | { type: "load_error"; error: string }
  | {
      type: "synthesize_complete";
      requestId: string;
      audioData: Float32Array;
      sampleRate: number;
      tokenTimestamps: TokenTimestamp[] | null;
    }
  | { type: "synthesize_error"; requestId: string; error: string }
  | {
      type: "encode_speaker_complete";
      requestId: string;
      descriptor: SpeakerDescriptor;
    }
  | { type: "encode_speaker_error"; requestId: string; error: string }
  | { type: "cancelled"; requestId: string };

// ── Pure helper functions (exported for unit testing) ─────────────────────────

/**
 * Strip punctuation (`/[^\w\s]/g` → `""`), split on whitespace, filter empty tokens.
 */
export function normalizeText(text: string): string[] {
  return text
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Clamp speed/pitch to [0.5, 2.0].
 */
export function clampSpeedPitch(value: number): number {
  return Math.min(2.0, Math.max(0.5, value));
}

/**
 * Distribute `duration` across `words` proportionally by character count.
 * `timings[0].start = 0`, `timings[last].end = duration`.
 */
export function computeCharacterWeightedTimings(
  words: string[],
  duration: number,
): TokenTimestamp[] {
  if (words.length === 0) return [];

  const totalChars = words.reduce((s, w) => s + w.length, 0) || 1;
  const timings: TokenTimestamp[] = [];
  let cursor = 0;

  for (let i = 0; i < words.length; i++) {
    const wordDuration = (words[i].length / totalChars) * duration;
    const start = cursor;
    const end = i === words.length - 1 ? duration : cursor + wordDuration;
    timings.push({ word: words[i], start, end });
    cursor = end;
  }

  return timings;
}

/**
 * Scale word timings by 1/speed.
 * `adjustedStart = originalStart / speed`, `adjustedEnd = originalEnd / speed`.
 */
export function scaleWordTimings(
  timings: TokenTimestamp[],
  speed: number,
): TokenTimestamp[] {
  return timings.map((t) => ({
    word: t.word,
    start: t.start / speed,
    end: t.end / speed,
  }));
}

// ── Worker state ──────────────────────────────────────────────────────────────

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY = 2000;

let transformersLoaded = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsInterface: any = null;
let loadedModelId: string | null = null;

// ── Dynamic import ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTransformers(): Promise<any> {
  if (transformersLoaded) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).__tts_transformers_cache;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformers: any = await import("@huggingface/transformers");
  transformers.env.allowLocalModels = false;

  // Wrap env.fetch with exponential-backoff retry (same pattern as ai-worker.js)
  const originalFetch =
    transformers.env.fetch ?? globalThis.fetch.bind(globalThis);
  transformers.env.fetch = async (url: string, options: RequestInit = {}) => {
    let lastError: Error = new Error("Unknown fetch error");
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await originalFetch(url, options);
        // 4xx errors are not retryable; 5xx and network errors are
        if (response.ok || response.status < 500) return response;
        lastError = new Error(`HTTP ${response.status} for ${url}`);
      } catch (err) {
        lastError = err as Error;
      }
      if (attempt < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
        // Preserve current progress during retry wait
        self.postMessage({
          type: "load_progress",
          progress: 0,
        } satisfies TTSWorkerResponse);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  };

  transformersLoaded = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__tts_transformers_cache = transformers;
  return transformers;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleCheck(): Promise<void> {
  const hasGPU =
    typeof navigator !== "undefined" && "gpu" in navigator && !!navigator.gpu;
  if (!hasGPU) {
    self.postMessage({
      type: "check",
      webgpuSupported: false,
      reason: "WebGPU not available",
    } satisfies TTSWorkerResponse);
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
      self.postMessage({
        type: "check",
        webgpuSupported: false,
        reason: "No GPU adapter found",
      } satisfies TTSWorkerResponse);
      return;
    }
    self.postMessage({
      type: "check",
      webgpuSupported: true,
    } satisfies TTSWorkerResponse);
  } catch (e) {
    self.postMessage({
      type: "check",
      webgpuSupported: false,
      reason: (e as Error).message,
    } satisfies TTSWorkerResponse);
  }
}

async function handleLoad(modelId: string, dtype: string): Promise<void> {
  // Return cached instance if already loaded with the same model
  if (ttsInterface && loadedModelId === modelId) {
    // Determine device from cached load
    const device: "webgpu" | "wasm" =
      typeof navigator !== "undefined" && "gpu" in navigator && !!navigator.gpu
        ? "webgpu"
        : "wasm";
    self.postMessage({
      type: "load_complete",
      device,
    } satisfies TTSWorkerResponse);
    return;
  }

  const fileProgress = new Map<string, { loaded: number; total: number }>();

  const progress_callback = (info: {
    status: string;
    file?: string;
    name?: string;
    loaded?: number;
    total?: number;
  }) => {
    if (info.status === "progress") {
      const key = info.file ?? info.name ?? "unknown";
      fileProgress.set(key, {
        loaded: info.loaded ?? 0,
        total: info.total ?? 0,
      });
      const totalLoaded = [...fileProgress.values()].reduce(
        (s, e) => s + e.loaded,
        0,
      );
      const totalBytes = [...fileProgress.values()].reduce(
        (s, e) => s + e.total,
        0,
      );
      const pct =
        totalBytes > 0 ? Math.round((totalLoaded / totalBytes) * 100) : 0;
      self.postMessage({
        type: "load_progress",
        progress: pct,
      } satisfies TTSWorkerResponse);
    }
  };

  // Attempt WebGPU first, then fall back to WASM
  const devicesToTry: Array<"webgpu" | "wasm"> = [];

  const hasGPU =
    typeof navigator !== "undefined" && "gpu" in navigator && !!navigator.gpu;
  if (hasGPU) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        devicesToTry.push("webgpu");
      }
    } catch {
      // WebGPU probe failed — skip it
    }
  }
  devicesToTry.push("wasm");

  let lastError: Error = new Error("Model load failed");

  for (const device of devicesToTry) {
    try {
      const transformers = await loadTransformers();

      // Load OuteTTS via InterfaceHF (the OuteTTS-specific API)
      if (transformers.InterfaceHF) {
        ttsInterface = await transformers.InterfaceHF.from_pretrained(modelId, {
          dtype,
          device,
          progress_callback,
        });
      } else {
        // Fallback: use pipeline API
        ttsInterface = await transformers.pipeline(
          "text-to-speech",
          modelId,
          {
            dtype,
            device,
            progress_callback,
          },
        );
      }

      loadedModelId = modelId;
      self.postMessage({
        type: "load_complete",
        device,
      } satisfies TTSWorkerResponse);
      return; // success — stop trying devices
    } catch (err) {
      lastError = err as Error;
      // If WebGPU failed, loop will try WASM next
    }
  }

  // All devices exhausted
  self.postMessage({
    type: "load_error",
    error: lastError.message,
  } satisfies TTSWorkerResponse);
}

async function handleSynthesize(
  requestId: string,
  text: string,
  speakerDescriptor: SpeakerDescriptor | undefined,
  speed: number,
  pitch: number,
): Promise<void> {
  if (!ttsInterface) {
    self.postMessage({
      type: "synthesize_error",
      requestId,
      error: "Model not loaded",
    } satisfies TTSWorkerResponse);
    return;
  }

  try {
    const clampedSpeed = clampSpeedPitch(speed);
    const clampedPitch = clampSpeedPitch(pitch);

    // Generate audio via OuteTTS
    const generateOptions: Record<string, unknown> = { text };
    if (speakerDescriptor) generateOptions.speaker = speakerDescriptor;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: any = await ttsInterface.generate(generateOptions);

    // Extract audio data — OuteTTS returns audio as Float32Array
    let audioData: Float32Array;
    let sampleRate = 24000; // OuteTTS default

    if (output?.audio instanceof Float32Array) {
      audioData = output.audio;
      sampleRate = output.sample_rate ?? 24000;
    } else if (output instanceof Float32Array) {
      audioData = output;
    } else {
      audioData = new Float32Array(output?.data ?? []);
    }

    // Apply speed/pitch via OfflineAudioContext
    if (clampedSpeed !== 1.0 || clampedPitch !== 1.0) {
      audioData = await applySpeedPitch(
        audioData,
        sampleRate,
        clampedSpeed,
        clampedPitch,
      );
    }

    // Compute word timings (character-weighted fallback — OuteTTS v0.2 has no native timestamps)
    const words = normalizeText(text);
    const originalDuration = audioData.length / sampleRate;
    const rawTimings = computeCharacterWeightedTimings(words, originalDuration);
    const tokenTimestamps =
      clampedSpeed !== 1.0
        ? scaleWordTimings(rawTimings, clampedSpeed)
        : rawTimings;

    self.postMessage(
      {
        type: "synthesize_complete",
        requestId,
        audioData,
        sampleRate,
        tokenTimestamps,
      } satisfies TTSWorkerResponse,
      [audioData.buffer],
    );
  } catch (err) {
    self.postMessage({
      type: "synthesize_error",
      requestId,
      error: (err as Error).message,
    } satisfies TTSWorkerResponse);
  }
}

async function applySpeedPitch(
  audioData: Float32Array,
  sampleRate: number,
  speed: number,
  pitch: number,
): Promise<Float32Array> {
  try {
    const newLength = Math.ceil(audioData.length / speed);
    const offlineCtx = new OfflineAudioContext(1, newLength, sampleRate);

    const buffer = offlineCtx.createBuffer(1, audioData.length, sampleRate);
    buffer.copyToChannel(audioData, 0);

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = speed;
    // Pitch approximation: detune = 1200 * log2(pitch / speed) cents
    source.detune.value = 1200 * Math.log2(pitch / speed);
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  } catch {
    // OfflineAudioContext not available in worker — return original
    return audioData;
  }
}

async function handleEncodeSpeaker(
  requestId: string,
  audioData: Float32Array,
  sampleRate: number,
): Promise<void> {
  if (!ttsInterface) {
    self.postMessage({
      type: "encode_speaker_error",
      requestId,
      error: "Model not loaded",
    } satisfies TTSWorkerResponse);
    return;
  }

  try {
    let descriptor: SpeakerDescriptor;

    if (typeof ttsInterface.create_speaker === "function") {
      // OuteTTS native create_speaker API
      const audioBuffer = { data: audioData, sample_rate: sampleRate };
      descriptor = await ttsInterface.create_speaker(audioBuffer);
    } else {
      // Fallback: store raw audio as descriptor
      descriptor = {
        id: `speaker-${Date.now()}`,
        data: { audioData: Array.from(audioData), sampleRate },
      };
    }

    self.postMessage({
      type: "encode_speaker_complete",
      requestId,
      descriptor,
    } satisfies TTSWorkerResponse);
  } catch (err) {
    self.postMessage({
      type: "encode_speaker_error",
      requestId,
      error: (err as Error).message,
    } satisfies TTSWorkerResponse);
  }
}

// ── Message dispatcher ────────────────────────────────────────────────────────

self.addEventListener(
  "message",
  async (event: MessageEvent<TTSWorkerMessage>) => {
    const msg = event.data;

    try {
      switch (msg.type) {
        case "check":
          await handleCheck();
          break;
        case "load":
          await handleLoad(msg.modelId, msg.dtype);
          break;
        case "synthesize":
          await handleSynthesize(
            msg.requestId,
            msg.text,
            msg.speakerDescriptor,
            msg.speed,
            msg.pitch,
          );
          break;
        case "encode_speaker":
          await handleEncodeSpeaker(
            msg.requestId,
            msg.audioData,
            msg.sampleRate,
          );
          break;
        case "cancel":
          self.postMessage({
            type: "cancelled",
            requestId: msg.requestId,
          } satisfies TTSWorkerResponse);
          break;
        case "terminate":
          self.close();
          break;
      }
    } catch (err) {
      self.postMessage({
        type: "load_error",
        error: (err as Error).message,
      } satisfies TTSWorkerResponse);
    }
  },
);

self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  const reason =
    event.reason instanceof Error
      ? event.reason.message
      : String(event.reason);
  self.postMessage({
    type: "load_error",
    error: reason,
  } satisfies TTSWorkerResponse);
});

self.addEventListener("error", (event: ErrorEvent) => {
  self.postMessage({
    type: "load_error",
    error: event.message || "Worker error",
  } satisfies TTSWorkerResponse);
});
