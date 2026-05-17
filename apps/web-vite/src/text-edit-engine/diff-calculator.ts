import type { WordSegment } from "@/transcription/types";

export interface EditOperation {
	id: string;
	type: "delete" | "trim" | "split";
	timeRange: { start: number; end: number };
	affectedWordIndices: number[];
	affectedClipIds: string[];
	deletedText: string;
	preview: EditPreview;
}

export interface EditPreview {
	deletedText: string;
	timeRange: { start: number; end: number };
	durationRemoved: number;
	affectedClips: { clipId: string; clipName: string; action: string }[];
}

export interface EditSuggestion {
	id: string;
	description: string;
	timeRange: { start: number; end: number };
	confidence: number;
	rawResponse: string;
}

export interface TextEditRange {
	start: number;
	end: number;
	text: string;
}

export interface DiffResult {
	deletedWordIndices: number[];
	deletedRanges: TextEditRange[];
}

export function computeDiff(
	originalText: string,
	editedText: string,
	wordSegments: WordSegment[],
): DiffResult {
	const deletedWordIndices: number[] = [];
	const deletedRanges: TextEditRange[] = [];

	const originalWords = originalText.split(/\s+/).filter((w) => w.length > 0);
	const editedWords = editedText.split(/\s+/).filter((w) => w.length > 0);

	let originalIndex = 0;
	let editedIndex = 0;
	let currentDeletedStart = -1;
	let currentDeletedText: string[] = [];

	while (originalIndex < originalWords.length || editedIndex < editedWords.length) {
		if (
			originalIndex < originalWords.length &&
			editedIndex < editedWords.length &&
			normalizeWord(originalWords[originalIndex]) ===
				normalizeWord(editedWords[editedIndex])
		) {
			if (currentDeletedStart !== -1) {
				deletedRanges.push({
					start: currentDeletedStart,
					end: wordSegments[originalIndex - 1]?.end ?? 0,
					text: currentDeletedText.join(" "),
				});
				currentDeletedStart = -1;
				currentDeletedText = [];
			}
			originalIndex++;
			editedIndex++;
		} else if (originalIndex < originalWords.length) {
			if (currentDeletedStart === -1) {
				currentDeletedStart = wordSegments[originalIndex]?.start ?? 0;
			}
			deletedWordIndices.push(originalIndex);
			currentDeletedText.push(originalWords[originalIndex]);
			originalIndex++;
		} else {
			editedIndex++;
		}
	}

	if (currentDeletedStart !== -1 && currentDeletedText.length > 0) {
		deletedRanges.push({
			start: currentDeletedStart,
			end: wordSegments[originalIndex - 1]?.end ?? 0,
			text: currentDeletedText.join(" "),
		});
	}

	return { deletedWordIndices, deletedRanges };
}

function normalizeWord(word: string): string {
	return word.replace(/[^\w]/g, "").toLowerCase();
}

export function aggregateTimestamps(
	deletedWordIndices: number[],
	wordSegments: WordSegment[],
): { start: number; end: number }[] {
	if (deletedWordIndices.length === 0) return [];

	const sorted = [...deletedWordIndices].sort((a, b) => a - b);
	const timeRanges: { start: number; end: number }[] = [];

	let rangeStart = sorted[0];
	let rangeEnd = sorted[0];

	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i] === rangeEnd + 1) {
			rangeEnd = sorted[i];
		} else {
			timeRanges.push({
				start: wordSegments[rangeStart]?.start ?? 0,
				end: wordSegments[rangeEnd]?.end ?? 0,
			});
			rangeStart = sorted[i];
			rangeEnd = sorted[i];
		}
	}

	timeRanges.push({
		start: wordSegments[rangeStart]?.start ?? 0,
		end: wordSegments[rangeEnd]?.end ?? 0,
	});

	return timeRanges;
}
