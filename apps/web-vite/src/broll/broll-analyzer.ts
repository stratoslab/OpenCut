import type { WordTranscript } from "@/transcription/types";

export interface BrollSuggestion {
	id: string;
	text: string;
	startTime: number;
	endTime: number;
	keyword: string;
	thumbnailUrl?: string;
}

export class BrollAnalyzer {
	analyze(transcript: WordTranscript): BrollSuggestion[] {
		const visualKeywords = [
			"show", "see", "look", "watch", "here", "this", "that",
			"image", "photo", "picture", "video", "screen", "display",
			"example", "demonstrate", "illustrate", "visualize",
			"graph", "chart", "diagram", "map", "scene",
		];

		const suggestions: BrollSuggestion[] = [];
		const words = transcript.words;

		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			const lowerWord = word.text.toLowerCase().replace(/[^\w]/g, "");

			if (visualKeywords.includes(lowerWord)) {
				const contextEnd = Math.min(i + 5, words.length);
				const contextWords = words.slice(i, contextEnd);
				if (contextWords.length === 0) continue;
				suggestions.push({
					id: `broll-${i}`,
					text: contextWords.map((w) => w.text).join(" "),
					startTime: word.start,
					endTime: contextWords[contextWords.length - 1].end,
					keyword: lowerWord,
				});
			}
		}

		return suggestions;
	}
}

export class PexelsClient {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async search(query: string, perPage = 5): Promise<Array<{ id: string; url: string; thumbnail: string }>> {
		try {
			const response = await fetch(
				`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}`,
				{ headers: { Authorization: this.apiKey } },
			);
			const data = await response.json();
			return data.videos.map((v: Record<string, unknown>) => ({
				id: String(v.id),
				url: String(v.url),
				thumbnail: String((v.image as Record<string, unknown>)?.medium || ""),
			}));
		} catch {
			return [];
		}
	}
}
