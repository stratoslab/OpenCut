export interface TimelineClip {
	id: string;
	name: string;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
	sourceDuration: number;
}

export interface CutOperation {
	type: "delete" | "trim-start" | "trim-end" | "split";
	clipId: string;
	timeRange: { start: number; end: number };
	newClips?: TimelineClip[];
}

export function computeTimelineCuts(
	timeRanges: { start: number; end: number }[],
	clips: TimelineClip[],
): CutOperation[] {
	const operations: CutOperation[] = [];

	for (const range of timeRanges) {
		for (const clip of clips) {
			const clipStart = clip.startTime;
			const clipEnd = clip.startTime + clip.duration;

			if (range.end <= clipStart || range.start >= clipEnd) {
				continue;
			}

			const cutStart = Math.max(range.start, clipStart);
			const cutEnd = Math.min(range.end, clipEnd);

			if (cutStart <= clipStart && cutEnd >= clipEnd) {
				operations.push({
					type: "delete",
					clipId: clip.id,
					timeRange: range,
				});
			} else if (cutStart <= clipStart) {
				operations.push({
					type: "trim-start",
					clipId: clip.id,
					timeRange: { start: cutStart, end: cutEnd },
				});
			} else if (cutEnd >= clipEnd) {
				operations.push({
					type: "trim-end",
					clipId: clip.id,
					timeRange: { start: cutStart, end: cutEnd },
				});
			} else {
				operations.push({
					type: "split",
					clipId: clip.id,
					timeRange: { start: cutStart, end: cutEnd },
					newClips: [
						{
							...clip,
							id: `${clip.id}-left`,
							duration: cutStart - clipStart,
							trimEnd: clip.trimEnd + (clipEnd - cutEnd),
						},
						{
							...clip,
							id: `${clip.id}-right`,
							startTime: cutStart,
							duration: clipEnd - cutEnd,
							trimStart: clip.trimStart + (cutStart - clipStart),
						},
					],
				});
			}
		}
	}

	return operations;
}

export function applyRippleEdit(
	clips: TimelineClip[],
	deletedRanges: { start: number; end: number }[],
): TimelineClip[] {
	const sortedRanges = [...deletedRanges].sort((a, b) => a.start - b.start);

	const filteredClips = clips.filter((clip) => {
		const clipStart = clip.startTime;
		const clipEnd = clipStart + clip.duration;

		for (const range of sortedRanges) {
			if (clipStart >= range.start && clipEnd <= range.end) {
				return false;
			}
		}
		return true;
	});

	return filteredClips.map((clip) => {
		const clipStart = clip.startTime;

		let cumulativeShift = 0;
		for (const range of sortedRanges) {
			if (range.end <= clipStart) {
				cumulativeShift += range.end - range.start;
			}
		}

		const adjustedStart = Math.max(0, clipStart - cumulativeShift);

		let adjustedDuration = clip.duration;
		for (const range of sortedRanges) {
			const overlapStart = Math.max(clipStart, range.start);
			const overlapEnd = Math.min(clipStart + clip.duration, range.end);

			if (overlapStart < overlapEnd) {
				adjustedDuration -= overlapEnd - overlapStart;
			}
		}

		return {
			...clip,
			startTime: adjustedStart,
			duration: Math.max(0, adjustedDuration),
		};
	});
}
