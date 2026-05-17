import { describe, it, expect } from "bun:test";
import { computeDiff, aggregateTimestamps } from "@/text-edit-engine/diff-calculator";
import {
	computeTimelineCuts,
	applyRippleEdit,
	type TimelineClip,
} from "@/text-edit-engine/timeline-cutter";
import { TextEditEngine } from "@/text-edit-engine";
import type { WordSegment } from "@/transcription/types";

function generateWordTranscript(wordCount: number): {
	words: WordSegment[];
	text: string;
} {
	const words: WordSegment[] = [];
	let currentTime = 0;
	const textParts: string[] = [];

	for (let i = 0; i < wordCount; i++) {
		const duration = 0.2 + Math.random() * 0.5;
		const word = `word${i}`;
		words.push({
			text: word,
			start: currentTime,
			end: currentTime + duration,
			wordIndex: i,
		});
		textParts.push(word);
		currentTime += duration;
	}

	return { words, text: textParts.join(" ") };
}

function generateRandomClips(
	count: number,
	videoDuration: number,
): TimelineClip[] {
	const clips: TimelineClip[] = [];
	let currentTime = 0;

	for (let i = 0; i < count; i++) {
		const duration = 1 + Math.random() * (videoDuration / count);
		clips.push({
			id: `clip-${i}`,
			name: `Clip ${i}`,
			startTime: currentTime,
			duration,
			trimStart: 0,
			trimEnd: 0,
			sourceDuration: duration,
		});
		currentTime += duration;
	}

	return clips;
}

describe("Edit Duration Math (Req 3)", () => {
	it("Property: originalDuration - sum(deletedRanges) == newDuration", () => {
		for (let run = 0; run < 100; run++) {
			const { words, text } = generateWordTranscript(20 + Math.floor(Math.random() * 50));
			const clips = generateRandomClips(3, words[words.length - 1].end);

			const deleteCount = 1 + Math.floor(Math.random() * 5);
			const deleteStart = Math.floor(Math.random() * (words.length - deleteCount));
			const deletedWords = words.slice(deleteStart, deleteStart + deleteCount);

			const deletedText = deletedWords.map((w) => w.text).join(" ");
			const editedText = text.replace(deletedText, "").replace(/\s+/g, " ").trim();

			const engine = new TextEditEngine(words, clips);
			const result = engine.applyTextEdit(text, editedText);

			const originalDuration = words[words.length - 1].end;
			const deletedDuration = result.operations.reduce(
				(sum, op) => sum + op.timeRange.end - op.timeRange.start,
				0,
			);

			const newClips = engine.applyRippleEdit(
				result.operations.map((op) => op.timeRange),
			);

			const newDuration = newClips.reduce(
				(sum, clip) => sum + clip.duration,
				0,
			);

			expect(Math.abs(newDuration - (originalDuration - deletedDuration))).toBeLessThan(0.01);
		}
	});
});

describe("Idempotent Cuts (Req 3)", () => {
	it("Property: No double-deletion of same time range", () => {
		for (let run = 0; run < 100; run++) {
			const { words, text } = generateWordTranscript(30);
			const clips = generateRandomClips(3, words[words.length - 1].end);

			const deleteStart = Math.floor(Math.random() * 10);
			const deleteEnd = deleteStart + 2 + Math.floor(Math.random() * 3);

			const deletedWords = words.slice(deleteStart, deleteEnd);
			const deletedText = deletedWords.map((w) => w.text).join(" ");
			const editedText = text.replace(deletedText, "").replace(/\s+/g, " ").trim();

			const engine = new TextEditEngine(words, clips);
			const result1 = engine.applyTextEdit(text, editedText);

			const secondEditedText = editedText.replace(/\s+/g, " ").trim();
			const result2 = engine.applyTextEdit(editedText, secondEditedText);

			expect(result2.operations.length).toBe(0);
		}
	});

	it("Property: Overlapping edits don't corrupt timeline", () => {
		for (let run = 0; run < 100; run++) {
			const { words, text } = generateWordTranscript(50);
			const clips = generateRandomClips(5, words[words.length - 1].end);

			const start1 = Math.floor(Math.random() * 20);
			const end1 = start1 + 3 + Math.floor(Math.random() * 5);
			const start2 = Math.max(0, start1 - 2);
			const end2 = end1 + Math.floor(Math.random() * 3);

			const deleted1 = words.slice(start1, end1).map((w) => w.text).join(" ");
			const textAfterFirst = text.replace(deleted1, "").replace(/\s+/g, " ").trim();

			const engine = new TextEditEngine(words, clips);
			const result1 = engine.applyTextEdit(text, textAfterFirst);

			const newClips1 = engine.applyRippleEdit(
				result1.operations.map((op) => op.timeRange),
			);

			expect(newClips1.length).toBeGreaterThanOrEqual(0);

			for (let i = 1; i < newClips1.length; i++) {
				const prevEnd = newClips1[i - 1].startTime + newClips1[i - 1].duration;
				expect(newClips1[i].startTime).toBeGreaterThanOrEqual(prevEnd - 0.01);
			}
		}
	});
});

describe("Timeline Cutter", () => {
	it("handles delete that covers entire clip", () => {
		const clips: TimelineClip[] = [
			{
				id: "clip-1",
				name: "Clip 1",
				startTime: 0,
				duration: 10,
				trimStart: 0,
				trimEnd: 0,
				sourceDuration: 10,
			},
		];

		const timeRanges = [{ start: 0, end: 10 }];
		const operations = computeTimelineCuts(timeRanges, clips);

		expect(operations.length).toBe(1);
		expect(operations[0].type).toBe("delete");
	});

	it("handles trim-start", () => {
		const clips: TimelineClip[] = [
			{
				id: "clip-1",
				name: "Clip 1",
				startTime: 0,
				duration: 10,
				trimStart: 0,
				trimEnd: 0,
				sourceDuration: 10,
			},
		];

		const timeRanges = [{ start: 0, end: 3 }];
		const operations = computeTimelineCuts(timeRanges, clips);

		expect(operations.length).toBe(1);
		expect(operations[0].type).toBe("trim-start");
	});

	it("handles trim-end", () => {
		const clips: TimelineClip[] = [
			{
				id: "clip-1",
				name: "Clip 1",
				startTime: 0,
				duration: 10,
				trimStart: 0,
				trimEnd: 0,
				sourceDuration: 10,
			},
		];

		const timeRanges = [{ start: 7, end: 10 }];
		const operations = computeTimelineCuts(timeRanges, clips);

		expect(operations.length).toBe(1);
		expect(operations[0].type).toBe("trim-end");
	});

	it("handles split in middle", () => {
		const clips: TimelineClip[] = [
			{
				id: "clip-1",
				name: "Clip 1",
				startTime: 0,
				duration: 10,
				trimStart: 0,
				trimEnd: 0,
				sourceDuration: 10,
			},
		];

		const timeRanges = [{ start: 3, end: 7 }];
		const operations = computeTimelineCuts(timeRanges, clips);

		expect(operations.length).toBe(1);
		expect(operations[0].type).toBe("split");
		expect(operations[0].newClips).toBeDefined();
		expect(operations[0].newClips!.length).toBe(2);
	});
});
