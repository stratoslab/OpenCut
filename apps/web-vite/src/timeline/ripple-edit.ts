import type { TimelineClip } from "@/text-edit-engine/timeline-cutter";

export function applyRippleEditToTimeline(
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

	let cumulativeShift = 0;
	let rangeIndex = 0;

	return filteredClips.map((clip) => {
		const clipStart = clip.startTime;

		while (
			rangeIndex < sortedRanges.length &&
			sortedRanges[rangeIndex].end <= clipStart
		) {
			const range = sortedRanges[rangeIndex];
			cumulativeShift += range.end - range.start;
			rangeIndex++;
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
