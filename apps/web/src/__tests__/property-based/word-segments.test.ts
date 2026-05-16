import { describe, it, expect } from "bun:test";
import {
	segmentsToWordSegments,
	validateWordSegments,
	splitSegmentIntoWords,
} from "@/transcription/word-segments";
import type { TranscriptionSegment, WordSegment } from "@/transcription/types";

function generateRandomWordSegment(
	index: number,
	minStart: number,
	maxDuration: number,
): WordSegment {
	const start = minStart + Math.random() * 10;
	const duration = 0.1 + Math.random() * maxDuration;
	return {
		text: `word${index}`,
		start: Math.round(start * 100) / 100,
		end: Math.round((start + duration) * 100) / 100,
		wordIndex: index,
	};
}

function generateRandomSegments(count: number): TranscriptionSegment[] {
	const segments: TranscriptionSegment[] = [];
	let currentTime = 0;

	for (let i = 0; i < count; i++) {
		const duration = 1 + Math.random() * 5;
		segments.push({
			text: `Segment ${i} with multiple words here`,
			start: currentTime,
			end: currentTime + duration,
		});
		currentTime += duration;
	}

	return segments;
}

describe("Word Segment Validity (Req 1)", () => {
	it("Property 1: Every word segment has start >= 0 and end >= start", () => {
		for (let run = 0; run < 100; run++) {
			const segment: TranscriptionSegment = {
				text: `Test segment with words number ${run}`,
				start: Math.random() * 100,
				end: Math.random() * 100 + 100,
			};

			const words = splitSegmentIntoWords(segment, 0);

			for (const word of words) {
				expect(word.start).toBeGreaterThanOrEqual(0);
				expect(word.end).toBeGreaterThanOrEqual(word.start);
			}
		}
	});

	it("Property 2: Word segments are contained within [0, videoDuration]", () => {
		for (let run = 0; run < 100; run++) {
			const videoDuration = 50 + Math.random() * 150;
			const segments = generateRandomSegments(3 + Math.floor(Math.random() * 10));

			const words = segmentsToWordSegments(segments);

			for (const word of words) {
				expect(word.start).toBeGreaterThanOrEqual(0);
				expect(word.end).toBeLessThanOrEqual(
					segments[segments.length - 1].end,
				);
			}
		}
	});

	it("Property 3: Word text concatenation matches segment text", () => {
		for (let run = 0; run < 100; run++) {
			const segment: TranscriptionSegment = {
				text: `This is a test segment with several words number ${run}`,
				start: 0,
				end: 10,
			};

			const words = splitSegmentIntoWords(segment, 0);
			const concatenated = words.map((w) => w.text).join(" ");

			const normalizedOriginal = segment.text.trim().split(/\s+/).join(" ");
			const normalizedConcatenated = concatenated.trim().split(/\s+/).join(" ");

			expect(normalizedConcatenated).toBe(normalizedOriginal);
		}
	});

	it("Property 4: No overlapping time ranges", () => {
		for (let run = 0; run < 100; run++) {
			const segments = generateRandomSegments(5 + Math.floor(Math.random() * 10));
			const words = segmentsToWordSegments(segments);

			const isValid = validateWordSegments(words);
			expect(isValid).toBe(true);
		}
	});

	it("handles empty segments", () => {
		const words = segmentsToWordSegments([]);
		expect(words).toEqual([]);
	});

	it("handles segments with empty text", () => {
		const segments: TranscriptionSegment[] = [
			{ text: "", start: 0, end: 5 },
			{ text: "   ", start: 5, end: 10 },
		];

		const words = segmentsToWordSegments(segments);
		expect(words).toEqual([]);
	});
});
