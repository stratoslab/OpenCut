import { describe, it, expect } from "bun:test";
import { BrollAnalyzer } from "@/broll/broll-analyzer";
import type { WordTranscript } from "@/transcription/types";
import { SuggestionCard, suggestionQueue, type Suggestion, type SuggestionSeverity } from "@/smart-suggestions/suggestion-queue.tsx";

describe("BrollAnalyzer (broll-suggestions Task 1)", () => {
	it("Detects visual-worthy moments in transcript", () => {
		const analyzer = new BrollAnalyzer();
		const transcript: WordTranscript = {
			words: [
				{ text: "Let", start: 0, end: 0.2, wordIndex: 0 },
				{ text: "me", start: 0.2, end: 0.4, wordIndex: 1 },
				{ text: "show", start: 0.4, end: 0.6, wordIndex: 2 },
				{ text: "you", start: 0.6, end: 0.8, wordIndex: 3 },
				{ text: "this", start: 0.8, end: 1, wordIndex: 4 },
				{ text: "chart", start: 1, end: 1.2, wordIndex: 5 },
			],
			fullText: "Let me show you this chart",
			language: "en",
			videoDuration: 5,
		};

		const suggestions = analyzer.analyze(transcript);
		expect(suggestions.length).toBeGreaterThan(0);
		expect(suggestions[0].keyword).toBe("show");
	});

	it("Property: Suggestions have valid time ranges", () => {
		const analyzer = new BrollAnalyzer();
		const words = Array.from({ length: 100 }, (_, i) => ({
			text: i % 10 === 0 ? "show" : `word${i}`,
			start: i * 0.5,
			end: i * 0.5 + 0.3,
			wordIndex: i,
		}));

		const transcript: WordTranscript = {
			words,
			fullText: words.map((w) => w.text).join(" "),
			language: "en",
			videoDuration: 50,
		};

		const suggestions = analyzer.analyze(transcript);
		for (const s of suggestions) {
			expect(typeof s.startTime).toBe("number");
			expect(typeof s.endTime).toBe("number");
			expect(s.startTime).toBeLessThan(s.endTime);
			expect(s.startTime).toBeGreaterThanOrEqual(0);
		}
	});
});

describe("SmartSuggestions (smart-suggestions Task 1)", () => {
	it("Queue sorts by severity", () => {
		const queue = new (suggestionQueue.constructor as new () => typeof suggestionQueue)();

		queue.add({ id: "1", title: "Info", description: "", severity: "info" as SuggestionSeverity });
		queue.add({ id: "2", title: "Warning", description: "", severity: "warning" as SuggestionSeverity });
		queue.add({ id: "3", title: "Improvement", description: "", severity: "improvement" as SuggestionSeverity });

		const all = queue.getAll();
		expect(all[0].severity).toBe("warning");
		expect(all[1].severity).toBe("improvement");
		expect(all[2].severity).toBe("info");
	});

	it("Removes suggestions by id", () => {
		const queue = new (suggestionQueue.constructor as new () => typeof suggestionQueue)();

		queue.add({ id: "1", title: "Test", description: "", severity: "info" as SuggestionSeverity });
		queue.remove("1");
		expect(queue.getAll()).toHaveLength(0);
	});
});
