import { describe, it, expect } from "bun:test";
import { FillerDetector } from "@/smart-cut/filler-detector";
import type { WordSegment } from "@/transcription/types";

function makeWords(texts: string[], startTime = 0): WordSegment[] {
	let t = startTime;
	return texts.map((text, i) => {
		const w = { text, start: t, end: t + 0.3, wordIndex: i };
		t += 0.5;
		return w;
	});
}

describe("FillerDetector (smart-cut Task 1)", () => {
	it("Detects single filler words case-insensitively", () => {
		const detector = new FillerDetector();
		const words = makeWords(["hello", "Um", "world", "UH", "test"]);
		const regions = detector.detect(words);

		expect(regions).toHaveLength(2);
		expect(regions[0].label).toBe("Um");
		expect(regions[1].label).toBe("UH");
	});

	it("Property: Only matches whole words, not substrings", () => {
		const detector = new FillerDetector();
		const words = makeWords(["umbrella", "lumber", "like", "dislike", "um"]);
		const regions = detector.detect(words);

		const labels = regions.map((r) => r.label);
		expect(labels).toContain("like");
		expect(labels).toContain("um");
		expect(labels).not.toContain("umbrella");
		expect(labels).not.toContain("lumber");
		expect(labels).not.toContain("dislike");
	});

	it("Property: Returns valid time ranges (start < end, monotonically increasing)", () => {
		const detector = new FillerDetector();
		for (let run = 0; run < 200; run++) {
			const fillerWords = ["um", "uh", "like"];
			const allWords = Array.from({ length: 50 }, (_, i) => ({
				text: Math.random() < 0.2 ? fillerWords[Math.floor(Math.random() * fillerWords.length)] : `word${i}`,
				start: i * 0.5,
				end: i * 0.5 + 0.3,
				wordIndex: i,
			}));

			const regions = detector.detect(allWords);
			for (const region of regions) {
				expect(region.start).toBeLessThan(region.end);
				expect(region.start).toBeGreaterThanOrEqual(0);
			}
			for (let i = 1; i < regions.length; i++) {
				expect(regions[i].start).toBeGreaterThanOrEqual(regions[i - 1].start);
			}
		}
	});

	it("Detects multi-word fillers", () => {
		const detector = new FillerDetector();
		const words = makeWords(["hello", "you", "know", "world"]);
		const regions = detector.detect(words);

		const labels = regions.map((r) => r.label);
		expect(labels).toContain("you know");
	});

	it("Returns empty array when no fillers present", () => {
		const detector = new FillerDetector();
		const words = makeWords(["hello", "world", "test", "video"]);
		const regions = detector.detect(words);
		expect(regions).toHaveLength(0);
	});

	it("Property: Custom filler list works correctly", () => {
		const detector = new FillerDetector();
		const words = makeWords(["hello", "foobar", "world"]);
		const regions = detector.detect(words, ["foobar"]);
		expect(regions).toHaveLength(1);
		expect(regions[0].label).toBe("foobar");
	});
});
