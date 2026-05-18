import { describe, expect, it } from "bun:test";
import {
	mediaTimeFromTranscriptSeconds,
	planSelectionEdit,
	validateTranscript,
} from "../planner";
import type { SceneTracks } from "@/timeline";
import type { WordTranscript } from "@/transcription/types";

function transcript(): WordTranscript {
	return {
		fullText: "cut this keep cut this",
		language: "en",
		videoDuration: 5,
		words: [
			{ text: "cut", start: 0, end: 0.5, wordIndex: 0 },
			{ text: "this", start: 0.5, end: 1, wordIndex: 1 },
			{ text: "keep", start: 2, end: 2.5, wordIndex: 2 },
			{ text: "cut", start: 3, end: 3.5, wordIndex: 3 },
			{ text: "this", start: 3.5, end: 4, wordIndex: 4 },
		],
	};
}

function tracks(): SceneTracks {
	return {
		overlay: [],
		audio: [],
		main: {
			id: "main",
			name: "Main",
			type: "video",
			muted: false,
			hidden: false,
			elements: [
				{
					id: "clip-1",
					type: "video",
					name: "Clip 1",
					mediaId: "media-1",
					startTime: mediaTimeFromTranscriptSeconds({ seconds: 0 }),
					duration: mediaTimeFromTranscriptSeconds({ seconds: 5 }),
					trimStart: mediaTimeFromTranscriptSeconds({ seconds: 0 }),
					trimEnd: mediaTimeFromTranscriptSeconds({ seconds: 0 }),
					sourceDuration: mediaTimeFromTranscriptSeconds({ seconds: 5 }),
					params: {},
				},
			],
		},
	};
}

describe("transcript edit planner", () => {
	it("validates a monotonic transcript", () => {
		expect(validateTranscript(transcript()).valid).toBe(true);
	});

	it("plans by word index instead of repeated text", () => {
		const plan = planSelectionEdit({
			transcript: transcript(),
			selectedWordIndices: [3, 4],
			tracks: tracks(),
			ripple: true,
		});

		expect(plan.ranges).toHaveLength(1);
		expect(plan.ranges[0].deletedText).toBe("cut this");
		expect(plan.ranges[0].timeRange.start).toBe(3);
		expect(plan.ranges[0].wordIndices).toEqual([3, 4]);
	});
});
