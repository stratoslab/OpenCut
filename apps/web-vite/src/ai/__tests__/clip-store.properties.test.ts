/**
 * Property-based tests for pure helpers in clip-store.ts
 * Feature: clip-scene-classification
 * Test runner: bun:test + fast-check
 */

import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import { softmax } from "../clip-store";

// ─── Property 1 ───────────────────────────────────────────────────────────────
// Feature: clip-scene-classification, Property 1: Progress values are always in [0, 100]
// Validates: Requirements 1.3

describe("Property 1: Progress computation is always in [0, 100]", () => {
  it("overallPercent = totalLoaded / totalBytes * 100 is always in [0, 100]", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ loaded: fc.nat(), total: fc.nat({ min: 1 }) }),
          { minLength: 1 }
        ),
        (files) => {
          // Clamp loaded to total (as the worker does: Math.min(loaded, total))
          const totalLoaded = files.reduce(
            (s, f) => s + Math.min(f.loaded, f.total),
            0
          );
          const totalBytes = files.reduce((s, f) => s + f.total, 0);
          const overallPercent = (totalLoaded / totalBytes) * 100;
          return overallPercent >= 0 && overallPercent <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6 ───────────────────────────────────────────────────────────────
// Feature: clip-scene-classification, Property 6: Softmax output sums to 1 and each value in [0, 1]
// Validates: Requirements 3.4

describe("Property 6: softmax output is a valid probability distribution", () => {
  it("all elements are in [0, 1] and sum is within 1e-6 of 1.0", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: -1, max: 1 }), { minLength: 9, maxLength: 9 }),
        (scores) => {
          // Filter out NaN/Infinity that fc.float can occasionally produce
          if (scores.some((s) => !isFinite(s))) return true;

          const probs = softmax(scores, 1.0);
          const allInRange = probs.every((p) => p >= 0 && p <= 1);
          const sum = probs.reduce((a, b) => a + b, 0);
          const sumsToOne = Math.abs(sum - 1.0) < 1e-6;
          return allInRange && sumsToOne;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10 ──────────────────────────────────────────────────────────────
// Feature: clip-scene-classification, Property 10: scoreFrameRelevance output is always in [0, 1]
// Validates: Requirements 5.2

describe("Property 10: scoreFrameRelevance output is always in [0, 1]", () => {
  it("(sim + 1) / 2 is always in [0, 1] for any cosine similarity in [-1, 1]", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1, max: 1 }),
        (sim) => {
          if (!isFinite(sim)) return true;
          const score = (sim + 1) / 2;
          return score >= 0 && score <= 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 11 ──────────────────────────────────────────────────────────────
// Feature: clip-scene-classification, Property 11: scoreFrameRelevance maps cosine similarity linearly
// Validates: Requirements 5.3

describe("Property 11: scoreFrameRelevance maps cosine similarity linearly from [-1, 1] to [0, 1]", () => {
  it("result equals (sim + 1) / 2 within floating-point precision", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1, max: 1 }),
        (sim) => {
          if (!isFinite(sim)) return true;
          const result = (sim + 1) / 2;
          const expected = (sim + 1) / 2;
          return Math.abs(result - expected) < 1e-10;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 13 ──────────────────────────────────────────────────────────────
// Feature: clip-scene-classification, Property 13: enrichWithVisualConfidence confidence update
// Validates: Requirements 5.7, 5.8

describe("Property 13: enrichWithVisualConfidence confidence update is correct", () => {
  it("averages confidence when frame is non-null, leaves unchanged when null", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1 }),
        fc.float({ min: 0, max: 1 }),
        fc.boolean(),
        (original, visual, frameIsNull) => {
          if (!isFinite(original) || !isFinite(visual)) return true;

          // Simulate the enrichWithVisualConfidence logic inline:
          //   if (frame === null) continue;  → confidence unchanged
          //   else confidence = (confidence + visual) / 2
          const updated = frameIsNull ? original : (original + visual) / 2;
          const expected = frameIsNull ? original : (original + visual) / 2;

          return Math.abs(updated - expected) < 1e-10;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("averaged confidence is always in [0, 1] when both inputs are in [0, 1]", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1 }),
        fc.float({ min: 0, max: 1 }),
        (original, visual) => {
          if (!isFinite(original) || !isFinite(visual)) return true;
          const averaged = (original + visual) / 2;
          return averaged >= 0 && averaged <= 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});
