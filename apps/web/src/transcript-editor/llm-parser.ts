import type { EditSuggestion } from "@/text-edit-engine/types";

export interface LLMEditResponse {
	suggestions: Array<{
		description: string;
		start: number;
		end: number;
	}>;
}

export function parseLLMResponse(
	rawResponse: string,
	videoDuration: number,
): EditSuggestion[] {
	const suggestions: EditSuggestion[] = [];

	try {
		const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]) as Partial<LLMEditResponse>;

			if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
				for (const suggestion of parsed.suggestions) {
					if (
						typeof suggestion.start === "number" &&
						typeof suggestion.end === "number" &&
						suggestion.start >= 0 &&
						suggestion.end <= videoDuration &&
						suggestion.start < suggestion.end
					) {
						suggestions.push({
							id: `llm-${Date.now()}-${suggestions.length}`,
							description: suggestion.description,
							timeRange: { start: suggestion.start, end: suggestion.end },
							confidence: 0.8,
							rawResponse,
						});
					}
				}
				return suggestions;
			}
		}
	} catch {
	}

	const timeRangeRegex = /(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/g;
	let match;

	while ((match = timeRangeRegex.exec(rawResponse)) !== null) {
		const start = parseFloat(match[1]);
		const end = parseFloat(match[2]);

		if (
			start >= 0 &&
			end <= videoDuration &&
			start < end
		) {
			const contextStart = Math.max(0, match.index - 50);
			const contextEnd = Math.min(rawResponse.length, match.index + match[0].length + 50);
			const context = rawResponse.slice(contextStart, contextEnd).trim();

			suggestions.push({
				id: `llm-${Date.now()}-${suggestions.length}`,
				description: context,
				timeRange: { start, end },
				confidence: 0.5,
				rawResponse,
			});
		}
	}

	return suggestions;
}

export function formatTranscriptForLLM(
	chunkText: string,
	words: Array<{ text: string; start: number; end: number }>,
): string {
	const wordTimings = words
		.map((w) => `["${w.text}": ${w.start.toFixed(1)}s-${w.end.toFixed(1)}s]`)
		.join(" ");

	return `Transcript: ${chunkText}\n\nWord Timings: ${wordTimings}`;
}
