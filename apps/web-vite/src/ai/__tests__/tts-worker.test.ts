import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import {
  normalizeText,
  clampSpeedPitch,
  computeCharacterWeightedTimings,
  scaleWordTimings,
} from "../tts-worker";

// ── normalizeText ─────────────────────────────────────────────────────────────

describe("normalizeText", () => {
  it("splits plain words on whitespace", () => {
    expect(normalizeText("hello world")).toEqual(["hello", "world"]);
  });

  it("strips punctuation", () => {
    expect(normalizeText("Hello, world!")).toEqual(["Hello", "world"]);
  });

  it("filters empty tokens from multiple spaces", () => {
    expect(normalizeText("  foo   bar  ")).toEqual(["foo", "bar"]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(normalizeText("   ")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(normalizeText("")).toEqual([]);
  });

  it("handles mixed punctuation and words", () => {
    expect(normalizeText("It's a test... right?")).toEqual([
      "Its",
      "a",
      "test",
      "right",
    ]);
  });

  it("preserves alphanumeric characters", () => {
    expect(normalizeText("word1 word2")).toEqual(["word1", "word2"]);
  });
});

// ── clampSpeedPitch ───────────────────────────────────────────────────────────

describe("clampSpeedPitch", () => {
  it("returns value unchanged when in range", () => {
    expect(clampSpeedPitch(1.0)).toBe(1.0);
    expect(clampSpeedPitch(0.5)).toBe(0.5);
    expect(clampSpeedPitch(2.0)).toBe(2.0);
    expect(clampSpeedPitch(1.5)).toBe(1.5);
  });

  it("clamps values below 0.5 to 0.5", () => {
    expect(clampSpeedPitch(0.0)).toBe(0.5);
    expect(clampSpeedPitch(0.1)).toBe(0.5);
    expect(clampSpeedPitch(-1.0)).toBe(0.5);
  });

  it("clamps values above 2.0 to 2.0", () => {
    expect(clampSpeedPitch(3.0)).toBe(2.0);
    expect(clampSpeedPitch(2.1)).toBe(2.0);
    expect(clampSpeedPitch(100.0)).toBe(2.0);
  });

  it("Property: output is always in [0.5, 2.0]", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (value) => {
        const result = clampSpeedPitch(value);
        expect(result).toBeGreaterThanOrEqual(0.5);
        expect(result).toBeLessThanOrEqual(2.0);
      }),
    );
  });

  it("Property: in-range values are returned unchanged", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 2.0, noNaN: true }),
        (value) => {
          expect(clampSpeedPitch(value)).toBe(value);
        },
      ),
    );
  });

  it("Property: values below 0.5 clamp to 0.5", () => {
    fc.assert(
      fc.property(
        fc.double({ max: 0.49, noNaN: true }),
        (value) => {
          expect(clampSpeedPitch(value)).toBe(0.5);
        },
      ),
    );
  });

  it("Property: values above 2.0 clamp to 2.0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 2.01, noNaN: true }),
        (value) => {
          expect(clampSpeedPitch(value)).toBe(2.0);
        },
      ),
    );
  });
});

// ── computeCharacterWeightedTimings ───────────────────────────────────────────

describe("computeCharacterWeightedTimings", () => {
  it("returns empty array for empty words", () => {
    expect(computeCharacterWeightedTimings([], 5.0)).toEqual([]);
  });

  it("single word spans the full duration", () => {
    const result = computeCharacterWeightedTimings(["hello"], 3.0);
    expect(result).toHaveLength(1);
    expect(result[0].word).toBe("hello");
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(3.0);
  });

  it("first timing starts at 0", () => {
    const result = computeCharacterWeightedTimings(["foo", "bar"], 4.0);
    expect(result[0].start).toBe(0);
  });

  it("last timing ends at duration", () => {
    const result = computeCharacterWeightedTimings(["foo", "bar", "baz"], 6.0);
    expect(result[result.length - 1].end).toBe(6.0);
  });

  it("timings are contiguous (end of one = start of next)", () => {
    const result = computeCharacterWeightedTimings(
      ["hello", "world", "test"],
      9.0,
    );
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].end).toBeCloseTo(result[i + 1].start, 10);
    }
  });

  it("distributes proportionally by character count", () => {
    // "a" (1 char) and "bbb" (3 chars) → total 4 chars, duration 4.0
    // "a" gets 1/4 = 1.0s, "bbb" gets 3/4 = 3.0s
    const result = computeCharacterWeightedTimings(["a", "bbb"], 4.0);
    expect(result[0].word).toBe("a");
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBeCloseTo(1.0, 10);
    expect(result[1].word).toBe("bbb");
    expect(result[1].start).toBeCloseTo(1.0, 10);
    expect(result[1].end).toBe(4.0);
  });

  it("equal-length words get equal durations", () => {
    const result = computeCharacterWeightedTimings(["ab", "cd", "ef"], 6.0);
    const durations = result.map((t) => t.end - t.start);
    expect(durations[0]).toBeCloseTo(2.0, 10);
    expect(durations[1]).toBeCloseTo(2.0, 10);
    expect(durations[2]).toBeCloseTo(2.0, 10);
  });

  it("preserves word labels in output", () => {
    const words = ["the", "quick", "brown", "fox"];
    const result = computeCharacterWeightedTimings(words, 10.0);
    expect(result.map((t) => t.word)).toEqual(words);
  });

  it("Property: first start is always 0", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
        fc.double({ min: 0.1, max: 60, noNaN: true }),
        (words, duration) => {
          const result = computeCharacterWeightedTimings(words, duration);
          expect(result[0].start).toBe(0);
        },
      ),
    );
  });

  it("Property: last end equals duration", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
        fc.double({ min: 0.1, max: 60, noNaN: true }),
        (words, duration) => {
          const result = computeCharacterWeightedTimings(words, duration);
          expect(result[result.length - 1].end).toBeCloseTo(duration, 10);
        },
      ),
    );
  });

  it("Property: result length equals words length", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 20 }),
        fc.double({ min: 0.1, max: 60, noNaN: true }),
        (words, duration) => {
          const result = computeCharacterWeightedTimings(words, duration);
          expect(result).toHaveLength(words.length);
        },
      ),
    );
  });

  it("Property: each word duration is proportional to character count", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 }),
        fc.double({ min: 0.1, max: 60, noNaN: true }),
        (words, duration) => {
          const result = computeCharacterWeightedTimings(words, duration);
          const totalChars = words.reduce((s, w) => s + w.length, 0);
          for (let i = 0; i < result.length; i++) {
            const expectedDuration = (words[i].length / totalChars) * duration;
            const actualDuration = result[i].end - result[i].start;
            // Last word may have floating-point adjustment; use generous tolerance
            if (i < result.length - 1) {
              expect(actualDuration).toBeCloseTo(expectedDuration, 8);
            }
          }
        },
      ),
    );
  });
});

// ── scaleWordTimings ──────────────────────────────────────────────────────────

describe("scaleWordTimings", () => {
  it("returns empty array for empty input", () => {
    expect(scaleWordTimings([], 1.5)).toEqual([]);
  });

  it("scales start and end by 1/speed", () => {
    const timings = [
      { word: "hello", start: 0, end: 1.0 },
      { word: "world", start: 1.0, end: 2.0 },
    ];
    const result = scaleWordTimings(timings, 2.0);
    expect(result[0].start).toBeCloseTo(0, 10);
    expect(result[0].end).toBeCloseTo(0.5, 10);
    expect(result[1].start).toBeCloseTo(0.5, 10);
    expect(result[1].end).toBeCloseTo(1.0, 10);
  });

  it("speed=1.0 leaves timings unchanged", () => {
    const timings = [
      { word: "foo", start: 0.5, end: 1.5 },
      { word: "bar", start: 1.5, end: 3.0 },
    ];
    const result = scaleWordTimings(timings, 1.0);
    expect(result[0].start).toBeCloseTo(0.5, 10);
    expect(result[0].end).toBeCloseTo(1.5, 10);
    expect(result[1].start).toBeCloseTo(1.5, 10);
    expect(result[1].end).toBeCloseTo(3.0, 10);
  });

  it("preserves word labels", () => {
    const timings = [
      { word: "alpha", start: 0, end: 1 },
      { word: "beta", start: 1, end: 2 },
    ];
    const result = scaleWordTimings(timings, 1.5);
    expect(result.map((t) => t.word)).toEqual(["alpha", "beta"]);
  });

  it("Property: adjustedStart = originalStart / speed", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            word: fc.string({ minLength: 1 }),
            start: fc.double({ min: 0, max: 100, noNaN: true }),
            end: fc.double({ min: 0, max: 100, noNaN: true }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.double({ min: 0.5, max: 2.0, noNaN: true }),
        (timings, speed) => {
          const result = scaleWordTimings(timings, speed);
          for (let i = 0; i < timings.length; i++) {
            expect(result[i].start).toBeCloseTo(timings[i].start / speed, 8);
            expect(result[i].end).toBeCloseTo(timings[i].end / speed, 8);
          }
        },
      ),
    );
  });

  it("Property: result length equals input length", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            word: fc.string({ minLength: 1 }),
            start: fc.double({ min: 0, max: 100, noNaN: true }),
            end: fc.double({ min: 0, max: 100, noNaN: true }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        fc.double({ min: 0.5, max: 2.0, noNaN: true }),
        (timings, speed) => {
          const result = scaleWordTimings(timings, speed);
          expect(result).toHaveLength(timings.length);
        },
      ),
    );
  });
});
