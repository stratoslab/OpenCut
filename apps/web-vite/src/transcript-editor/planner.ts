import type { SceneTracks, VideoElement } from "@/timeline";
import type { WordTranscript } from "@/transcription/types";
import type { MediaTime } from "@/wasm";

const TICKS_PER_SECOND = 120_000;

export interface TranscriptDeletedRange {
	wordIndices: number[];
	timeRange: { start: number; end: number };
	deletedText: string;
}

export interface TimelineCutOperation {
	operationType: "delete" | "trim-start" | "trim-end" | "split";
	trackId: string;
	clipId: string;
	clipName: string;
	sourceTimeRange: { start: number; end: number };
}

export interface TranscriptEditPlan {
	ranges: TranscriptDeletedRange[];
	cutPlan: {
		operations: TimelineCutOperation[];
		affectedClipIds: string[];
		durationRemoved: number;
	};
	mode: "manual-selection" | "ai-suggestion";
}

export interface TranscriptValidationResult {
	valid: boolean;
	errors: string[];
}

interface WasmTranscriptPlanner {
	validateWordTranscript?: (input: unknown) => TranscriptValidationResult;
	planSelectionTranscriptEdit?: (input: unknown) => TranscriptEditPlan;
	planSuggestionTranscriptEdit?: (input: unknown) => TranscriptEditPlan;
	resolveWordIndicesForTimeRange?: (input: unknown) => number[];
}

export function validateTranscript(
	transcript: WordTranscript | null | undefined,
): TranscriptValidationResult {
	if (!transcript) {
		return { valid: false, errors: ["No transcript is available"] };
	}
	const wasm = getWasmPlanner();
	if (wasm?.validateWordTranscript) {
		try {
			return wasm.validateWordTranscript(transcript);
		} catch {
			// The bundled wasm may not yet expose transcript planning in dev.
		}
	}
	return validateTranscriptLocal(transcript);
}

export function planSelectionEdit({
	transcript,
	selectedWordIndices,
	tracks,
	ripple,
}: {
	transcript: WordTranscript;
	selectedWordIndices: number[];
	tracks: SceneTracks;
	ripple: boolean;
}): TranscriptEditPlan {
	const timeline = buildTimelineContext({ tracks });
	const wasm = getWasmPlanner();
	if (wasm?.planSelectionTranscriptEdit) {
		try {
			return wasm.planSelectionTranscriptEdit({
				transcript,
				selectedWordIndices,
				timeline,
				ripple,
			});
		} catch {
			// Fall through to the local equivalent to keep the editor usable.
		}
	}

	const ranges = selectedWordIndicesToRanges({
		transcript,
		selectedWordIndices,
	});
	return {
		ranges,
		cutPlan: planTimelineCuts({ ranges, clips: timeline.clips }),
		mode: "manual-selection",
	};
}

export function planSuggestionEdit({
	transcript,
	start,
	end,
	tracks,
	ripple,
}: {
	transcript: WordTranscript;
	start: number;
	end: number;
	tracks: SceneTracks;
	ripple: boolean;
}): TranscriptEditPlan {
	const wasm = getWasmPlanner();
	const timeline = buildTimelineContext({ tracks });
	if (wasm?.planSuggestionTranscriptEdit) {
		try {
			return wasm.planSuggestionTranscriptEdit({
				transcript,
				start,
				end,
				timeline,
				ripple,
			});
		} catch {
			// Fall through to local validation.
		}
	}

	const selectedWordIndices = resolveWordIndicesForTimeRange({
		transcript,
		start,
		end,
	});
	return planSelectionEdit({
		transcript,
		selectedWordIndices,
		tracks,
		ripple,
	});
}

export function resolveWordIndicesForTimeRange({
	transcript,
	start,
	end,
}: {
	transcript: WordTranscript;
	start: number;
	end: number;
}): number[] {
	const wasm = getWasmPlanner();
	if (wasm?.resolveWordIndicesForTimeRange) {
		try {
			return wasm.resolveWordIndicesForTimeRange({ transcript, start, end });
		} catch {
			// Fall through to local resolver.
		}
	}
	return transcript.words
		.filter((word) => word.start < end && word.end > start)
		.map((word) => word.wordIndex);
}

export function rangeSecondsToMediaRange(range: {
	start: number;
	end: number;
}): { start: MediaTime; end: MediaTime } {
	return {
		start: mediaTimeFromTranscriptSeconds({ seconds: range.start }),
		end: mediaTimeFromTranscriptSeconds({ seconds: range.end }),
	};
}

export function mediaTimeFromTranscriptSeconds({
	seconds,
}: {
	seconds: number;
}): MediaTime {
	return Math.round(seconds * TICKS_PER_SECOND) as MediaTime;
}

export function mediaTimeToTranscriptSeconds({
	time,
}: {
	time: MediaTime;
}): number {
	return time / TICKS_PER_SECOND;
}

function getWasmPlanner(): WasmTranscriptPlanner | null {
	return null;
}

function validateTranscriptLocal(
	transcript: WordTranscript,
): TranscriptValidationResult {
	const errors: string[] = [];
	if (
		!Number.isFinite(transcript.videoDuration) ||
		transcript.videoDuration < 0
	) {
		errors.push("Transcript duration is invalid");
	}
	let previousEnd = 0;
	transcript.words.forEach((word, index) => {
		if (!word.text.trim()) {
			errors.push(`Word ${index} is empty`);
		}
		if (!Number.isFinite(word.start) || !Number.isFinite(word.end)) {
			errors.push(`Word ${index} has invalid timestamps`);
			return;
		}
		if (word.start < 0 || word.end < word.start) {
			errors.push(`Word ${index} has an invalid time range`);
		}
		if (word.end > transcript.videoDuration) {
			errors.push(`Word ${index} exceeds transcript duration`);
		}
		if (index > 0 && word.start < previousEnd) {
			errors.push(`Word ${index} overlaps the previous word`);
		}
		if (word.wordIndex !== index) {
			errors.push(`Word ${index} has a non-sequential wordIndex`);
		}
		previousEnd = word.end;
	});
	return { valid: errors.length === 0, errors };
}

function selectedWordIndicesToRanges({
	transcript,
	selectedWordIndices,
}: {
	transcript: WordTranscript;
	selectedWordIndices: number[];
}): TranscriptDeletedRange[] {
	const indices = [...new Set(selectedWordIndices)].sort((a, b) => a - b);
	if (indices.length === 0) {
		throw new Error("No transcript words selected");
	}
	if (indices.some((index) => index < 0 || index >= transcript.words.length)) {
		throw new Error("Selected transcript range is invalid");
	}

	const ranges: TranscriptDeletedRange[] = [];
	let current: number[] = [];
	for (const index of indices) {
		const last = current[current.length - 1];
		if (last === undefined || index === last + 1) {
			current.push(index);
		} else {
			ranges.push(buildRange({ transcript, indices: current }));
			current = [index];
		}
	}
	if (current.length > 0) {
		ranges.push(buildRange({ transcript, indices: current }));
	}
	return ranges;
}

function buildRange({
	transcript,
	indices,
}: {
	transcript: WordTranscript;
	indices: number[];
}): TranscriptDeletedRange {
	const first = transcript.words[indices[0]];
	const last = transcript.words[indices[indices.length - 1]];
	return {
		wordIndices: indices,
		timeRange: { start: first.start, end: last.end },
		deletedText: indices.map((index) => transcript.words[index].text).join(" "),
	};
}

function buildTimelineContext({ tracks }: { tracks: SceneTracks }) {
	return {
		clips: tracks.main.elements.map((element) => ({
			trackId: tracks.main.id,
			clipId: element.id,
			name: element.name,
			start: mediaTimeToTranscriptSeconds({ time: element.startTime }),
			duration: mediaTimeToTranscriptSeconds({ time: element.duration }),
			trimStart: mediaTimeToTranscriptSeconds({ time: element.trimStart }),
			trimEnd: mediaTimeToTranscriptSeconds({ time: element.trimEnd }),
			sourceDuration:
				element.sourceDuration !== undefined
					? mediaTimeToTranscriptSeconds({ time: element.sourceDuration })
					: undefined,
		})),
	};
}

function planTimelineCuts({
	ranges,
	clips,
}: {
	ranges: TranscriptDeletedRange[];
	clips: ReturnType<typeof buildTimelineContext>["clips"];
}): TranscriptEditPlan["cutPlan"] {
	const operations: TimelineCutOperation[] = [];
	const affectedClipIds = new Set<string>();
	for (const range of ranges) {
		for (const clip of clips) {
			const clipStart = clip.start;
			const clipEnd = clip.start + clip.duration;
			if (
				range.timeRange.end <= clipStart ||
				range.timeRange.start >= clipEnd
			) {
				continue;
			}
			const overlapStart = Math.max(range.timeRange.start, clipStart);
			const overlapEnd = Math.min(range.timeRange.end, clipEnd);
			if (overlapEnd <= overlapStart) {
				continue;
			}
			const operationType =
				overlapStart <= clipStart && overlapEnd >= clipEnd
					? "delete"
					: overlapStart <= clipStart
						? "trim-start"
						: overlapEnd >= clipEnd
							? "trim-end"
							: "split";
			affectedClipIds.add(clip.clipId);
			operations.push({
				operationType,
				trackId: clip.trackId,
				clipId: clip.clipId,
				clipName: clip.name,
				sourceTimeRange: { start: overlapStart, end: overlapEnd },
			});
		}
	}
	if (operations.length === 0) {
		throw new Error(
			"Selected transcript range does not overlap the main video track",
		);
	}
	return {
		operations,
		affectedClipIds: [...affectedClipIds],
		durationRemoved: mergedDuration(ranges.map((range) => range.timeRange)),
	};
}

function mergedDuration(ranges: Array<{ start: number; end: number }>): number {
	const sorted = [...ranges].sort((a, b) => a.start - b.start);
	let total = 0;
	let active: { start: number; end: number } | null = null;
	for (const range of sorted) {
		if (!active) {
			active = { ...range };
		} else if (range.start <= active.end) {
			active.end = Math.max(active.end, range.end);
		} else {
			total += active.end - active.start;
			active = { ...range };
		}
	}
	if (active) {
		total += active.end - active.start;
	}
	return Math.max(0, total);
}

export function isEditableTranscriptElement(
	element: SceneTracks["main"]["elements"][number],
): element is VideoElement {
	return element.type === "video";
}
