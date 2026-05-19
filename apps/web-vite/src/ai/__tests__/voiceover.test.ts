/**
 * Unit tests for VoiceoverService (voiceover.ts).
 *
 * Tests that require a running Web Worker (auto-load, WebGPU fallback,
 * terminateWorker cancellation, IDB unavailable) are noted as integration
 * tests and are not exercised here — they require a browser environment.
 *
 * What IS tested here:
 *   - API compatibility: getAllVoices, getVoice, getVoicesByLanguage
 *   - Legacy ID mapping: all four original DEFAULT_VOICES IDs resolve
 *   - Input validation: empty text and unknown voiceId rejections
 *   - Speed/pitch clamping via clampSpeedPitch directly
 *   - Model selection: selectModel updates selectedModel and downloadSizeBytes
 */

import { describe, it, expect } from "bun:test";
import {
  voiceoverService,
  DEFAULT_VOICES,
  type VoiceProfile,
} from "../voiceover";
import { clampSpeedPitch } from "../tts-worker";
import { useTTSModelStore } from "../tts-model-store";
import { TTS_MODELS } from "../tts-models";

// ── API compatibility ─────────────────────────────────────────────────────────

describe("VoiceoverService — API compatibility", () => {
  it("getAllVoices() returns an array", () => {
    const voices = voiceoverService.getAllVoices();
    expect(Array.isArray(voices)).toBe(true);
  });

  it("getAllVoices() returns at least the default voices", () => {
    const voices = voiceoverService.getAllVoices();
    expect(voices.length).toBeGreaterThanOrEqual(DEFAULT_VOICES.length);
  });

  it("getAllVoices() entries have the required VoiceProfile shape", () => {
    const voices = voiceoverService.getAllVoices();
    for (const voice of voices) {
      expect(typeof voice.id).toBe("string");
      expect(typeof voice.name).toBe("string");
      expect(typeof voice.language).toBe("string");
      expect(["male", "female", "neutral"]).toContain(voice.gender);
      expect(["young", "adult", "senior"]).toContain(voice.age);
      expect(["casual", "professional", "energetic", "calm", "dramatic"]).toContain(voice.tone);
      expect(typeof voice.sampleRate).toBe("number");
    }
  });

  it("getVoice(id) returns the profile for a known ID", () => {
    const voice = voiceoverService.getVoice("en-us-male-casual");
    expect(voice).toBeDefined();
    expect(voice?.id).toBe("en-us-male-casual");
  });

  it("getVoice(id) returns undefined for an unknown ID", () => {
    const voice = voiceoverService.getVoice("does-not-exist-xyz");
    expect(voice).toBeUndefined();
  });

  it("getVoicesByLanguage(lang) returns only voices matching that language", () => {
    const enUS = voiceoverService.getVoicesByLanguage("en-US");
    expect(Array.isArray(enUS)).toBe(true);
    for (const v of enUS) {
      expect(v.language).toBe("en-US");
    }
  });

  it("getVoicesByLanguage('en-GB') returns only en-GB voices", () => {
    const enGB = voiceoverService.getVoicesByLanguage("en-GB");
    expect(Array.isArray(enGB)).toBe(true);
    for (const v of enGB) {
      expect(v.language).toBe("en-GB");
    }
  });

  it("getVoicesByLanguage with unknown language returns empty array", () => {
    const result = voiceoverService.getVoicesByLanguage("xx-UNKNOWN");
    expect(result).toHaveLength(0);
  });

  it("getVoicesByLanguage results are a subset of getAllVoices", () => {
    const all = voiceoverService.getAllVoices();
    const allIds = new Set(all.map((v) => v.id));
    const enUS = voiceoverService.getVoicesByLanguage("en-US");
    for (const v of enUS) {
      expect(allIds.has(v.id)).toBe(true);
    }
  });
});

// ── Legacy ID mapping ─────────────────────────────────────────────────────────

describe("VoiceoverService — legacy ID mapping", () => {
  const LEGACY_IDS = [
    "en-us-male-casual",
    "en-us-female-professional",
    "en-us-male-energetic",
    "en-gb-female-calm",
  ] as const;

  for (const id of LEGACY_IDS) {
    it(`getVoice("${id}") resolves to a VoiceProfile`, () => {
      const voice = voiceoverService.getVoice(id);
      expect(voice).toBeDefined();
      expect(voice?.id).toBe(id);
    });
  }

  it("all four legacy IDs are present in getAllVoices()", () => {
    const allIds = new Set(voiceoverService.getAllVoices().map((v) => v.id));
    for (const id of LEGACY_IDS) {
      expect(allIds.has(id)).toBe(true);
    }
  });

  it("legacy voices have the expected language/gender/tone fields", () => {
    const expectations: Record<string, Partial<VoiceProfile>> = {
      "en-us-male-casual": { language: "en-US", gender: "male", tone: "casual" },
      "en-us-female-professional": { language: "en-US", gender: "female", tone: "professional" },
      "en-us-male-energetic": { language: "en-US", gender: "male", tone: "energetic" },
      "en-gb-female-calm": { language: "en-GB", gender: "female", tone: "calm" },
    };

    for (const [id, expected] of Object.entries(expectations)) {
      const voice = voiceoverService.getVoice(id);
      expect(voice).toBeDefined();
      if (expected.language) expect(voice?.language).toBe(expected.language);
      if (expected.gender) expect(voice?.gender).toBe(expected.gender);
      if (expected.tone) expect(voice?.tone).toBe(expected.tone);
    }
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("VoiceoverService — input validation", () => {
  it('generateVoiceover with empty text rejects with "Text must be non-empty"', async () => {
    await expect(
      voiceoverService.generateVoiceover({
        text: "",
        voiceId: DEFAULT_VOICES[0].id,
      }),
    ).rejects.toThrow("Text must be non-empty");
  });

  it('generateVoiceover with whitespace-only text rejects with "Text must be non-empty"', async () => {
    await expect(
      voiceoverService.generateVoiceover({
        text: "   \t\n  ",
        voiceId: DEFAULT_VOICES[0].id,
      }),
    ).rejects.toThrow("Text must be non-empty");
  });

  it("generateVoiceover with unknown voiceId rejects with the ID in the message", async () => {
    const unknownId = "voice-that-does-not-exist-abc123";
    await expect(
      voiceoverService.generateVoiceover({
        text: "Hello world",
        voiceId: unknownId,
      }),
    ).rejects.toThrow(`Voice '${unknownId}' not found`);
  });

  it("generateVoiceover with empty voiceId rejects", async () => {
    await expect(
      voiceoverService.generateVoiceover({
        text: "Hello",
        voiceId: "",
      }),
    ).rejects.toThrow("not found");
  });
});

// ── Speed/pitch clamping ──────────────────────────────────────────────────────

describe("clampSpeedPitch — speed and pitch clamping", () => {
  it("values below 0.5 are clamped to 0.5", () => {
    expect(clampSpeedPitch(0.0)).toBe(0.5);
    expect(clampSpeedPitch(0.1)).toBe(0.5);
    expect(clampSpeedPitch(-5.0)).toBe(0.5);
  });

  it("values above 2.0 are clamped to 2.0", () => {
    expect(clampSpeedPitch(2.1)).toBe(2.0);
    expect(clampSpeedPitch(3.0)).toBe(2.0);
    expect(clampSpeedPitch(100.0)).toBe(2.0);
  });

  it("values within [0.5, 2.0] are returned unchanged", () => {
    expect(clampSpeedPitch(0.5)).toBe(0.5);
    expect(clampSpeedPitch(1.0)).toBe(1.0);
    expect(clampSpeedPitch(1.5)).toBe(1.5);
    expect(clampSpeedPitch(2.0)).toBe(2.0);
  });

  it("clamping is silent — no error is thrown for out-of-range values", () => {
    expect(() => clampSpeedPitch(-999)).not.toThrow();
    expect(() => clampSpeedPitch(999)).not.toThrow();
  });
});

// ── Model selection ───────────────────────────────────────────────────────────

describe("useTTSModelStore — selectModel", () => {
  it("selectModel('oute-tts-small') updates selectedModel", () => {
    useTTSModelStore.getState().selectModel("oute-tts-small");
    expect(useTTSModelStore.getState().selectedModel).toBe("oute-tts-small");
  });

  it("selectModel('oute-tts-large') updates selectedModel", () => {
    useTTSModelStore.getState().selectModel("oute-tts-large");
    expect(useTTSModelStore.getState().selectedModel).toBe("oute-tts-large");
  });

  it("selectModel updates downloadSizeBytes to match the model registry", () => {
    for (const model of TTS_MODELS) {
      useTTSModelStore.getState().selectModel(model.id);
      expect(useTTSModelStore.getState().downloadSizeBytes).toBe(
        model.downloadSizeBytes,
      );
    }
  });

  it("selectModel('oute-tts-small') sets downloadSizeBytes to ~335 MB", () => {
    useTTSModelStore.getState().selectModel("oute-tts-small");
    expect(useTTSModelStore.getState().downloadSizeBytes).toBe(335_000_000);
  });

  it("selectModel('oute-tts-large') sets downloadSizeBytes to ~630 MB", () => {
    useTTSModelStore.getState().selectModel("oute-tts-large");
    expect(useTTSModelStore.getState().downloadSizeBytes).toBe(630_000_000);
  });

  it("selectModel does not change stage", () => {
    const stageBefore = useTTSModelStore.getState().stage;
    useTTSModelStore.getState().selectModel("oute-tts-small");
    expect(useTTSModelStore.getState().stage).toBe(stageBefore);
  });
});

// ── Integration test notes ────────────────────────────────────────────────────

describe("Integration test notes (require browser environment)", () => {
  it("documents tests that require a running worker", () => {
    // The following scenarios require a real Web Worker and are integration tests:
    //
    //   - Auto-load: calling generateVoiceover with stage:"idle" triggers loadModel()
    //     → requires Worker constructor and postMessage to be available
    //
    //   - WebGPU fallback: mocking navigator.gpu as undefined causes device:"wasm"
    //     → requires the worker to actually run and respond to "check" messages
    //
    //   - terminateWorker: pending generateVoiceover promise rejects with cancellation
    //     → requires a live worker with a pending synthesize request
    //
    //   - IDB unavailable: cloneVoice rejects and does not register the profile
    //     → requires IndexedDB to be available (or a polyfill) and a live worker
    //
    // These tests should be run in a Playwright browser test or a jsdom/happy-dom
    // environment with Worker support.
    expect(true).toBe(true); // placeholder assertion
  });
});
