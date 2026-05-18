import { describe, it, expect } from "bun:test";
import { RegionMerger } from "@/smart-cut/region-merger";
import type { TimeRange } from "@/smart-cut/region-merger";

describe("RegionMerger (smart-cut Task 3)", () => {
	it("Merges overlapping regions", () => {
		const merger = new RegionMerger();
		const ranges: TimeRange[] = [
			{ start: 0, end: 5, type: "filler", label: "um" },
			{ start: 3, end: 8, type: "silence", label: "silence" },
		];
		const merged = merger.merge(ranges);
		expect(merged).toHaveLength(1);
		expect(merged[0].start).toBe(0);
		expect(merged[0].end).toBe(8);
	});

	it("Merges adjacent regions within gap threshold", () => {
		const merger = new RegionMerger();
		const ranges: TimeRange[] = [
			{ start: 0, end: 5, type: "filler", label: "um" },
			{ start: 5.05, end: 10, type: "silence", label: "silence" },
		];
		const merged = merger.merge(ranges, 0.1);
		expect(merged).toHaveLength(1);
		expect(merged[0].end).toBe(10);
	});

	it("Does not merge regions with gap > threshold", () => {
		const merger = new RegionMerger();
		const ranges: TimeRange[] = [
			{ start: 0, end: 5, type: "filler", label: "um" },
			{ start: 6, end: 10, type: "silence", label: "silence" },
		];
		const merged = merger.merge(ranges, 0.1);
		expect(merged).toHaveLength(2);
	});

	it("Property: Merged regions never overlap", () => {
		const merger = new RegionMerger();
		for (let run = 0; run < 200; run++) {
			const count = Math.floor(Math.random() * 20) + 2;
			const ranges: TimeRange[] = Array.from({ length: count }, () => {
				const start = Math.random() * 100;
				const end = start + Math.random() * 10;
				return { start, end, type: Math.random() < 0.5 ? "filler" : "silence" as const };
			});

			const merged = merger.merge(ranges);
			for (let i = 1; i < merged.length; i++) {
				expect(merged[i].start).toBeGreaterThanOrEqual(merged[i - 1].end);
			}
		}
	});

	it("Property: Total merged duration <= sum of input durations", () => {
		const merger = new RegionMerger();
		for (let run = 0; run < 200; run++) {
			const count = Math.floor(Math.random() * 20) + 2;
			const ranges: TimeRange[] = Array.from({ length: count }, () => {
				const start = Math.random() * 100;
				const end = start + Math.random() * 10;
				return { start, end, type: Math.random() < 0.5 ? "filler" : "silence" as const };
			});

			const inputTotal = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
			const merged = merger.merge(ranges);
			const mergedTotal = merged.reduce((sum, r) => sum + (r.end - r.start), 0);

			expect(mergedTotal).toBeLessThanOrEqual(inputTotal + 0.11 * (merged.length - 1));
		}
	});

	it("Returns empty array for empty input", () => {
		const merger = new RegionMerger();
		expect(merger.merge([])).toHaveLength(0);
	});

	it("Property: Sorted output by start time", () => {
		const merger = new RegionMerger();
		for (let run = 0; run < 200; run++) {
			const count = Math.floor(Math.random() * 20) + 2;
			const ranges: TimeRange[] = Array.from({ length: count }, () => {
				const start = Math.random() * 100;
				const end = start + Math.random() * 10;
				return { start, end, type: "filler" as const };
			});

			const merged = merger.merge(ranges);
			for (let i = 1; i < merged.length; i++) {
				expect(merged[i].start).toBeGreaterThanOrEqual(merged[i - 1].start);
			}
		}
	});
});
