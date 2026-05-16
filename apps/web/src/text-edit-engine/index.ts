import type { WordSegment } from "@/transcription/types";
import { computeDiff, type DiffResult, type TextEditRange } from "./diff-calculator";
import { aggregateTimestamps } from "./diff-calculator";
import {
	computeTimelineCuts,
	applyRippleEdit,
	type TimelineClip,
	type CutOperation,
} from "./timeline-cutter";
import type { EditOperation, EditPreview } from "./types";

export interface TextEditResult {
	operations: EditOperation[];
	preview: EditPreview[];
}

export class TextEditEngine {
	private wordSegments: WordSegment[];
	private clips: TimelineClip[];

	constructor(wordSegments: WordSegment[], clips: TimelineClip[]) {
		this.wordSegments = wordSegments;
		this.clips = clips;
	}

	applyTextEdit(
		originalText: string,
		editedText: string,
	): TextEditResult {
		const diff = computeDiff(originalText, editedText, this.wordSegments);

		if (diff.deletedWordIndices.length === 0) {
			return { operations: [], preview: [] };
		}

		const timeRanges = aggregateTimestamps(
			diff.deletedWordIndices,
			this.wordSegments,
		);

		const cutOperations = computeTimelineCuts(timeRanges, this.clips);

		const operations: EditOperation[] = [];
		const previews: EditPreview[] = [];

		for (let i = 0; i < timeRanges.length; i++) {
			const range = timeRanges[i];
			const affectedIndices = diff.deletedWordIndices.filter((idx) => {
				const word = this.wordSegments[idx];
				return word && word.start >= range.start && word.end <= range.end;
			});

			const deletedText = affectedIndices
				.map((idx) => this.wordSegments[idx]?.text ?? "")
				.join(" ");

			const affectedClips = cutOperations
				.filter((op) => {
					const opStart = op.timeRange.start;
					const opEnd = op.timeRange.end;
					return opStart >= range.start && opEnd <= range.end;
				})
				.map((op) => ({
					clipId: op.clipId,
					clipName:
						this.clips.find((c) => c.id === op.clipId)?.name ?? "Unknown",
					action: op.type,
				}));

			const preview: EditPreview = {
				deletedText,
				timeRange: range,
				durationRemoved: range.end - range.start,
				affectedClips,
			};

			const operation: EditOperation = {
				id: `edit-${i}-${Date.now()}`,
				type: timeRanges.length === 1 ? "delete" : "split",
				timeRange: range,
				affectedWordIndices: affectedIndices,
				affectedClipIds: affectedClips.map((c) => c.clipId),
				deletedText,
				preview,
			};

			operations.push(operation);
			previews.push(preview);
		}

		return { operations, preview: previews };
	}

	applyRippleEdit(
		deletedRanges: { start: number; end: number }[],
	): TimelineClip[] {
		return applyRippleEdit(this.clips, deletedRanges);
	}

	getWordAtTime(time: number): WordSegment | null {
		for (const word of this.wordSegments) {
			if (time >= word.start && time <= word.end) {
				return word;
			}
		}
		return null;
	}

	getWordsInRange(start: number, end: number): WordSegment[] {
		return this.wordSegments.filter(
			(word) => word.start >= start && word.end <= end,
		);
	}
}

export { computeDiff, aggregateTimestamps, computeTimelineCuts, applyRippleEdit };
export type { TimelineClip, CutOperation, DiffResult, TextEditRange };
