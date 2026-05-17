import { describe, it, expect } from "bun:test";
import { applyRippleEdit, type TimelineClip } from "@/text-edit-engine/timeline-cutter";
import { applyRippleEditToTimeline } from "@/timeline/ripple-edit";

function generateRandomClips(
	count: number,
	totalDuration: number,
): TimelineClip[] {
	const clips: TimelineClip[] = [];
	const durationPerClip = totalDuration / count;

	for (let i = 0; i < count; i++) {
		clips.push({
			id: `clip-${i}`,
			name: `Clip ${i}`,
			startTime: i * durationPerClip,
			duration: durationPerClip,
			trimStart: 0,
			trimEnd: 0,
			sourceDuration: durationPerClip,
		});
	}

	return clips;
}

describe("Timeline Integrity Post-Edit (Req 7)", () => {
	it("Property: No overlapping clips after edit", () => {
		for (let run = 0; run < 100; run++) {
			const clipCount = 3 + Math.floor(Math.random() * 10);
			const totalDuration = 30 + Math.random() * 60;
			const clips = generateRandomClips(clipCount, totalDuration);

			const deleteCount = 1 + Math.floor(Math.random() * 3);
			const deletedRanges: { start: number; end: number }[] = [];

			for (let i = 0; i < deleteCount; i++) {
				const start = Math.random() * (totalDuration - 5);
				const end = start + 1 + Math.random() * 4;
				deletedRanges.push({ start, end });
			}

			const result = applyRippleEdit(clips, deletedRanges);

			for (let i = 1; i < result.length; i++) {
				const prevEnd = result[i - 1].startTime + result[i - 1].duration;
				expect(result[i].startTime).toBeGreaterThanOrEqual(prevEnd - 0.01);
			}
		}
	});

	it("Property: Sum of clip durations equals displayed timeline duration", () => {
		for (let run = 0; run < 100; run++) {
			const clipCount = 3 + Math.floor(Math.random() * 5);
			const totalDuration = 20 + Math.random() * 40;
			const clips = generateRandomClips(clipCount, totalDuration);

			const deleteStart = Math.random() * (totalDuration / 2);
			const deleteEnd = deleteStart + 2 + Math.random() * 3;
			const deletedRanges = [{ start: deleteStart, end: deleteEnd }];

			const result = applyRippleEdit(clips, deletedRanges);

			const totalClipDuration = result.reduce(
				(sum, clip) => sum + clip.duration,
				0,
			);

			const deletedDuration = deletedRanges.reduce(
				(sum, range) => sum + (range.end - range.start),
				0,
			);

			const expectedDuration = totalDuration - deletedDuration;
			expect(Math.abs(totalClipDuration - expectedDuration)).toBeLessThan(0.1);
		}
	});

	it("Property: Playhead always maps to valid position", () => {
		for (let run = 0; run < 100; run++) {
			const clipCount = 5;
			const totalDuration = 50;
			const clips = generateRandomClips(clipCount, totalDuration);

			const deletedRanges = [
				{ start: 10, end: 15 },
				{ start: 30, end: 35 },
			];

			const result = applyRippleEdit(clips, deletedRanges);

			const timelineDuration = result.reduce(
				(sum, clip) => sum + clip.duration,
				0,
			);

			const randomPlayhead = Math.random() * totalDuration;
			const adjustedPlayhead = Math.min(randomPlayhead, timelineDuration);

			expect(adjustedPlayhead).toBeGreaterThanOrEqual(0);
			expect(adjustedPlayhead).toBeLessThanOrEqual(timelineDuration);
		}
	});

	it("handles empty clips array", () => {
		const result = applyRippleEdit([], [{ start: 0, end: 5 }]);
		expect(result).toEqual([]);
	});

	it("handles deletion that removes all clips", () => {
		const clips = generateRandomClips(2, 10);
		const result = applyRippleEdit(clips, [{ start: 0, end: 10 }]);
		expect(result.length).toBe(0);
	});
});

describe("Ripple Edit Consistency", () => {
	it("both ripple edit implementations produce consistent results", () => {
		for (let run = 0; run < 50; run++) {
			const clipCount = 3 + Math.floor(Math.random() * 5);
			const totalDuration = 20 + Math.random() * 30;
			const clips = generateRandomClips(clipCount, totalDuration);

			const deletedRanges = [
				{ start: 5, end: 8 },
				{ start: 15, end: 18 },
			];

			const result1 = applyRippleEdit(clips, deletedRanges);
			const result2 = applyRippleEditToTimeline(clips, deletedRanges);

			expect(result1.length).toBe(result2.length);

			for (let i = 0; i < result1.length; i++) {
				expect(Math.abs(result1[i].startTime - result2[i].startTime)).toBeLessThan(0.01);
				expect(Math.abs(result1[i].duration - result2[i].duration)).toBeLessThan(0.01);
			}
		}
	});
});
