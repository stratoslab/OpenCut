export interface TimeRange {
	start: number;
	end: number;
	type: "filler" | "silence";
	label?: string;
}

export class RegionMerger {
	merge(ranges: TimeRange[], mergeGap = 0.1): TimeRange[] {
		if (ranges.length === 0) return [];

		const sorted = [...ranges].sort((a, b) => a.start - b.start);
		const merged: TimeRange[] = [
			{ ...sorted[0], type: sorted[0].type === "filler" ? "filler" : "silence" },
		];

		for (let i = 1; i < sorted.length; i++) {
			const current = sorted[i];
			const last = merged[merged.length - 1];

			if (current.start <= last.end + mergeGap) {
				last.end = Math.max(last.end, current.end);
				if (current.type === "filler" && last.type === "silence") {
					last.type = "filler";
				}
				last.label = last.type === "filler" ? "mixed" : "silence";
			} else {
				merged.push({ ...current });
			}
		}

		return merged;
	}
}
