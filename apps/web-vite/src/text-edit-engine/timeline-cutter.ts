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
	const ranges = mergeRanges(deletedRanges);
	const result: TimelineClip[] = [];

	for (const clip of clips) {
		const clipStart = clip.startTime;
		const clipEnd = clip.startTime + clip.duration;
		let kept = [{ start: clipStart, end: clipEnd }];

		for (const range of ranges) {
			const nextKept: typeof kept = [];
			for (const segment of kept) {
				if (range.end <= segment.start || range.start >= segment.end) {
					nextKept.push(segment);
					continue;
				}
				if (range.start > segment.start) {
					nextKept.push({ start: segment.start, end: range.start });
				}
				if (range.end < segment.end) {
					nextKept.push({ start: range.end, end: segment.end });
				}
			}
			kept = nextKept;
		}

		for (let i = 0; i < kept.length; i++) {
			const segment = kept[i];
			const shift = removedDurationBefore(ranges, segment.start);
			result.push({
				...clip,
				id: i === 0 ? clip.id : `${clip.id}-split-${i}`,
				startTime: Math.max(0, segment.start - shift),
				duration: segment.end - segment.start,
				trimStart: clip.trimStart + (segment.start - clipStart),
				trimEnd: clip.trimEnd + (clipEnd - segment.end),
			});
		}
	}

	return result.sort((a, b) => a.startTime - b.startTime);
}

function mergeRanges(
	ranges: { start: number; end: number }[],
): { start: number; end: number }[] {
	const sorted = ranges
		.filter((range) => range.end > range.start)
		.sort((a, b) => a.start - b.start);
	const merged: { start: number; end: number }[] = [];
	for (const range of sorted) {
		const last = merged[merged.length - 1];
		if (last && range.start <= last.end) {
			last.end = Math.max(last.end, range.end);
		} else {
			merged.push({ ...range });
		}
	}
	return merged;
}

function removedDurationBefore(
	ranges: { start: number; end: number }[],
	time: number,
): number {
	return ranges.reduce((total, range) => {
		if (range.end <= time) {
			return total + range.end - range.start;
		}
		if (range.start < time) {
			return total + time - range.start;
		}
		return total;
	}, 0);
}
