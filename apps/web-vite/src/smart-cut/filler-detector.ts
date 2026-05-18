import type { WordSegment } from "@/transcription/types";

export interface TimeRange {
	start: number;
	end: number;
	type: "filler" | "silence";
	label?: string;
}

const DEFAULT_FILLER_WORDS = [
	"um", "uh", "like", "you know", "so", "basically",
	"actually", "literally", "right", "okay", "well",
	"i mean", "sort of", "kind of", "er", "erm",
];

export class FillerDetector {
	detect(
		words: WordSegment[],
		fillerList: string[] = DEFAULT_FILLER_WORDS,
	): TimeRange[] {
		const lowerFillers = fillerList.map((f) => f.toLowerCase());
		const regions: TimeRange[] = [];

		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			const lowerWord = word.text.toLowerCase().replace(/[^\w\s]/g, "").trim();

			if (lowerFillers.includes(lowerWord)) {
				regions.push({
					start: word.start,
					end: word.end,
					type: "filler",
					label: word.text,
				});
				continue;
			}

			for (const filler of lowerFillers) {
				if (filler.includes(" ")) {
					const fillerWords = filler.split(" ");
					const match = words.slice(i, i + fillerWords.length);
					if (match.length === fillerWords.length) {
						const matchedText = match
							.map((w) => w.text.toLowerCase().replace(/[^\w\s]/g, "").trim())
							.join(" ");
						if (matchedText === filler) {
							regions.push({
								start: match[0].start,
								end: match[match.length - 1].end,
								type: "filler",
								label: match.map((w) => w.text).join(" "),
							});
							break;
						}
					}
				}
			}
		}

		return regions;
	}
}
