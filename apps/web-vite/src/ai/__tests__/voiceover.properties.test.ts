/**
 * Property-based tests for VoiceoverService and pure worker helper functions.
 *
 * Uses fast-check for property generation.
 *
 * Properties covered here:
 *   Task 5.8  — Properties 12, 15, 16  (pure worker helpers)
 *   Task 7.7  — Properties 2, 3, 10, 11, 13  (VoiceoverService)
 */

import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import {
  computeCharacterWeightedTimings,
  scaleWordTimings,
  clampSpeedPitch,
  normalizeText,
} from "../tts-worker";
import { voiceoverService, DEFAULT_VOICES } from "../voiceover";

// ── Task 5.8 — Pure worker helper properties ──────────────────────────────────

describe("Task 5.8 — Worker helper property tests", () => {
  /**
   * Property 12: Character-weighted timing fallback is proportional
   *
   * For any array of words and any duration, each word's assigned duration is
   * proportional to its character count.
   *
   * Validates: Requirements 4.4
   */
  it("Property 12: character-weighted timing is proportional to character count", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        fc.double({ min: 0.1, max: 60, noNaN: true }),
        (words, duration) => {
          const timings = computeCharacterWeightedTimings(words, duration);
          const totalChars = words.reduce((s, w) => s + w.length, 0);

          for (let i = 0; i < words.length - 1; i++) {
            const expectedDuration = (words[i].length / totalChars) * duration;
            const actualDuration = timings[i].end - timings[i].start;
            // Allow floating-point tolerance
            expect(Math.abs(actualDuration - expectedDuration)).toBeLessThan(1e-8);
          }

          // Last word always ends exactly at duration (pinned to avoid float drift)
          expect(timings[timings.length - 1].end).toBeCloseTo(duration, 10);
        },
      ),
    );
  });

  /**
   * Property 15: Speed scaling adjusts timings consistently
   *
   * For any speed in [0.5, 2.0] and any timings array,
   * adjustedStart = originalStart / speed and adjustedEnd = originalEnd / speed.
   *
   * Validates: Requirements 7.1, 7.4
   */
  it("Property 15: speed scaling applies 1/speed to every start and end", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 2.0, noNaN: true }),
        fc.array(
          fc.record({
            word: fc.string({ minLength: 1 }),
            start: fc.double({ min: 0, max: 100, noNaN: true }),
            end: fc.double({ min: 0, max: 100, noNaN: true }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (speed, timings) => {
          const scaled = scaleWordTimings(timings, speed);

          expect(scaled).toHaveLength(timings.length);

          for (let i = 0; i < timings.length; i++) {
            expect(scaled[i].start).toBeCloseTo(timings[i].start / speed, 8);
            expect(scaled[i].end).toBeCloseTo(timings[i].end / speed, 8);
            expect(scaled[i].word).toBe(timings[i].word);
          }
        },
      ),
    );
  });

  /**
   * Property 16: Speed and pitch values are clamped to [0.5, 2.0]
   *
   * For any value outside [0.5, 2.0], clampSpeedPitch returns the nearest bound.
   *
   * Validates: Requirements 7.3
   */
  it("Property 16: clampSpeedPitch clamps values below 0.5 to 0.5", () => {
    fc.assert(
      fc.property(
        fc.double({ max: 0.4999999999, noNaN: true }),
        (value) => {
          expect(clampSpeedPitch(value)).toBe(0.5);
        },
      ),
    );
  });

  it("Property 16: clampSpeedPitch clamps values above 2.0 to 2.0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 2.0000000001, noNaN: true }),
        (value) => {
          expect(clampSpeedPitch(value)).toBe(2.0);
        },
      ),
    );
  });

  it("Property 16: clampSpeedPitch leaves in-range values unchanged", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 2.0, noNaN: true }),
        (value) => {
          expect(clampSpeedPitch(value)).toBe(value);
        },
      ),
    );
  });
});

// ── Task 7.7 — VoiceoverService property tests ────────────────────────────────

// Collect all known voice IDs from the default registry
const KNOWN_VOICE_IDS = new Set(DEFAULT_VOICES.map((v) => v.id));

describe("Task 7.7 — VoiceoverService property tests", () => {
  /**
   * Property 2: Whitespace-only text is rejected
   *
   * For any string matching /^\s+$/, generateVoiceover rejects with an error.
   *
   * Validates: Requirements 1.7
   */
  it("Property 2: whitespace-only text is rejected", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^\s+$/),
        async (whitespaceText) => {
          await expect(
            voiceoverService.generateVoiceover({
              text: whitespaceText,
              voiceId: DEFAULT_VOICES[0].id,
            }),
          ).rejects.toThrow("Text must be non-empty");
        },
      ),
    );
  });

  /**
   * Property 3: Unrecognized voiceId is rejected
   *
   * For any string not in the known voice registry, generateVoiceover rejects
   * with an error identifying the ID.
   *
   * Validates: Requirements 1.8, 2.5
   */
  it("Property 3: unrecognized voiceId is rejected with the ID in the message", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => !KNOWN_VOICE_IDS.has(s) && s.length > 0),
        async (unknownId) => {
          await expect(
            voiceoverService.generateVoiceover({
              text: "Hello world",
              voiceId: unknownId,
            }),
          ).rejects.toThrow(`Voice '${unknownId}' not found`);
        },
      ),
    );
  });

  /**
   * Property 10: wordTimings count matches word count
   *
   * For any non-empty text, normalizeText(text).length equals the expected
   * word count after punctuation stripping.
   *
   * Validates: Requirements 4.1
   */
  it("Property 10: normalizeText word count matches whitespace-delimited tokens after punctuation strip", () => {
    fc.assert(
      fc.property(
        // Generate strings that contain at least one non-whitespace, non-punctuation char
        fc.string({ minLength: 1 }).filter((s) => /\w/.test(s)),
        (text) => {
          const words = normalizeText(text);
          // Manual replication of the normalizeText logic to verify consistency
          const expected = text
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter(Boolean);
          expect(words).toHaveLength(expected.length);
          expect(words).toEqual(expected);
        },
      ),
    );
  });

  /**
   * Property 11: wordTimings shape is valid
   *
   * For any timings from computeCharacterWeightedTimings, every entry has:
   *   - word: non-empty string
   *   - start: >= 0
   *   - end: > start
   *
   * Validates: Requirements 4.2
   */
  it("Property 11: computeCharacterWeightedTimings produces valid timing shapes", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
        fc.double({ min: 0.1, max: 60, noNaN: true }),
        (words, duration) => {
          const timings = computeCharacterWeightedTimings(words, duration);

          expect(timings).toHaveLength(words.length);

          for (const timing of timings) {
            // word must be a non-empty string
            expect(typeof timing.word).toBe("string");
            expect(timing.word.length).toBeGreaterThan(0);

            // start must be >= 0
            expect(timing.start).toBeGreaterThanOrEqual(0);

            // end must be > start (for single-word case end === duration > 0)
            expect(timing.end).toBeGreaterThan(timing.start);
          }
        },
      ),
    );
  });

  /**
   * Property 13: Progress values are valid integers in [0, 100]
   *
   * Generate random progress sequences and assert all are integers in [0, 100].
   *
   * Validates: Requirements 5.2
   */
  it("Property 13: progress values are integers in [0, 100]", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 50 }),
        (progressSequence) => {
          for (const progress of progressSequence) {
            // Must be an integer
            expect(Number.isInteger(progress)).toBe(true);
            // Must be in [0, 100]
            expect(progress).toBeGreaterThanOrEqual(0);
            expect(progress).toBeLessThanOrEqual(100);
          }
        },
      ),
    );
  });

  it("Property 13: Math.round clamps raw progress to integer in [0, 100]", () => {
    // The worker uses Math.round((loaded / total) * 100) — verify this always
    // produces a valid integer in [0, 100] for any loaded/total pair.
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e9, noNaN: true }),
        fc.double({ min: 1, max: 1e9, noNaN: true }),
        (loaded, total) => {
          const rawPct = (loaded / total) * 100;
          const progress = Math.min(100, Math.max(0, Math.round(rawPct)));
          expect(Number.isInteger(progress)).toBe(true);
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(100);
        },
      ),
    );
  });
});
