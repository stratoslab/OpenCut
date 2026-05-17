import { describe, it, expect } from "bun:test";
import { parseLLMResponse } from "@/transcript-editor/llm-parser";

describe("LLM Suggestion Validity (Req 6)", () => {
	it("Property: All suggested time ranges fall within [0, videoDuration]", () => {
		const videoDuration = 120;

		const validResponses = [
			'{"suggestions": [{"description": "Cut intro", "start": 0, "end": 5}]}',
			'{"suggestions": [{"description": "Remove silence", "start": 10.5, "end": 15.2}]}',
			'{"suggestions": [{"description": "Cut middle", "start": 50, "end": 60}, {"description": "Cut end", "start": 100, "end": 110}]}',
		];

		for (const response of validResponses) {
			const suggestions = parseLLMResponse(response, videoDuration);

			for (const suggestion of suggestions) {
				expect(suggestion.timeRange.start).toBeGreaterThanOrEqual(0);
				expect(suggestion.timeRange.end).toBeLessThanOrEqual(videoDuration);
				expect(suggestion.timeRange.start).toBeLessThan(suggestion.timeRange.end);
			}
		}
	});

	it("Property: Invalid time ranges are filtered out", () => {
		const videoDuration = 100;

		const invalidResponses = [
			'{"suggestions": [{"description": "Invalid", "start": -5, "end": 10}]}',
			'{"suggestions": [{"description": "Invalid", "start": 50, "end": 150}]}',
			'{"suggestions": [{"description": "Invalid", "start": 80, "end": 70}]}',
		];

		for (const response of invalidResponses) {
			const suggestions = parseLLMResponse(response, videoDuration);
			expect(suggestions.length).toBe(0);
		}
	});

	it("handles malformed JSON gracefully", () => {
		const videoDuration = 100;

		const malformedResponses = [
			"not json at all",
			"{invalid json}",
			"",
			"null",
			"some text 10.5 to 20.3 more text",
		];

		for (const response of malformedResponses) {
			const suggestions = parseLLMResponse(response, videoDuration);
			expect(Array.isArray(suggestions)).toBe(true);
		}
	});

	it("parses time ranges from plain text", () => {
		const videoDuration = 100;
		const response = "You should cut from 10.5 to 20.3 and also 50 to 60";

		const suggestions = parseLLMResponse(response, videoDuration);

		expect(suggestions.length).toBeGreaterThan(0);

		for (const suggestion of suggestions) {
			expect(suggestion.timeRange.start).toBeGreaterThanOrEqual(0);
			expect(suggestion.timeRange.end).toBeLessThanOrEqual(videoDuration);
		}
	});

	it("handles mixed valid and invalid suggestions", () => {
		const videoDuration = 100;
		const response = JSON.stringify({
			suggestions: [
				{ description: "Valid", start: 10, end: 20 },
				{ description: "Invalid", start: -5, end: 10 },
				{ description: "Valid", start: 50, end: 60 },
				{ description: "Invalid", start: 80, end: 150 },
			],
		});

		const suggestions = parseLLMResponse(response, videoDuration);

		expect(suggestions.length).toBe(2);

		for (const suggestion of suggestions) {
			expect(suggestion.timeRange.start).toBeGreaterThanOrEqual(0);
			expect(suggestion.timeRange.end).toBeLessThanOrEqual(videoDuration);
		}
	});
});
