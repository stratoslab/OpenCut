import type { TimelineClip } from "@/text-edit-engine/timeline-cutter";

export function applyRippleEditToTimeline(
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

		kept.forEach((segment, index) => {
			const shift = removedDurationBefore(ranges, segment.start);
			result.push({
				...clip,
				id: index === 0 ? clip.id : `${clip.id}-split-${index}`,
				startTime: Math.max(0, segment.start - shift),
				duration: segment.end - segment.start,
				trimStart: clip.trimStart + (segment.start - clipStart),
				trimEnd: clip.trimEnd + (clipEnd - segment.end),
			});
		});
	}

	return result.sort((a, b) => a.startTime - b.startTime);
}

function mergeRanges(
	ranges: { start: number; end: number }[],
): { start: number; end: number }[] {
	const merged: { start: number; end: number }[] = [];
	for (const range of [...ranges]
		.filter((range) => range.end > range.start)
		.sort((a, b) => a.start - b.start)) {
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
