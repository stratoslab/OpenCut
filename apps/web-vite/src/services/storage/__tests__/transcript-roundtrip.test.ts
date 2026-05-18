import { describe, it, expect } from "bun:test";
import type { WordTranscript, WordSegment } from "@/transcription/types";

function generateRandomWordSegment(index: number): WordSegment {
	const words = [
		"hello", "world", "test", "foo", "bar", "video", "edit",
		"cut", "scene", "audio", "clip", "track", "timeline",
		"transcript", "word", "segment", "start", "end", "duration",
	];
	const word = words[Math.floor(Math.random() * words.length)];
	const start = Math.random() * 100;
	const end = start + Math.random() * 5;
	return { text: word, start, end, wordIndex: index };
}

function generateRandomTranscript(): WordTranscript {
	const wordCount = Math.floor(Math.random() * 500) + 1;
	const words: WordSegment[] = [];
	for (let i = 0; i < wordCount; i++) {
		words.push(generateRandomWordSegment(i));
	}
	const fullText = words.map((w) => w.text).join(" ");
	const languages = ["en", "es", "fr", "de", "ja", "auto"];
	return {
		words,
		fullText,
		language: languages[Math.floor(Math.random() * languages.length)],
		videoDuration: Math.random() * 600,
	};
}

function generateTranscriptWithSpecialChars(): WordTranscript {
	const specialTexts = [
		"hello `backtick` world",
		"price is ${100} dollars",
		"quote \"inner\" text",
		"line1\nline2\nline3",
		"tab\there",
		"unicode: café résumé naïve",
		"emoji: 🎬🎥🎞️",
		"json: {\"key\": \"value\"}",
		"regex: /pattern/gi",
		"html: <div class=\"test\">content</div>",
	];
	const text = specialTexts[Math.floor(Math.random() * specialTexts.length)];
	return {
		words: [{ text, start: 0, end: 5, wordIndex: 0 }],
		fullText: text,
		language: "en",
		videoDuration: 10,
	};
}

function serializeTranscript(t: WordTranscript): string {
	return JSON.stringify({
		words: t.words,
		fullText: t.fullText,
		language: t.language,
		videoDuration: t.videoDuration,
	});
}

function deserializeTranscript(json: string): WordTranscript {
	const parsed = JSON.parse(json);
	return {
		words: parsed.words,
		fullText: parsed.fullText,
		language: parsed.language,
		videoDuration: parsed.videoDuration,
	};
}

describe("Transcript serialization round-trip (ai-copilot-transcript-context Req 3)", () => {
	it("Property: Random transcripts round-trip without data loss", () => {
		for (let run = 0; run < 100; run++) {
			const original = generateRandomTranscript();
			const serialized = serializeTranscript(original);
			const roundTripped = deserializeTranscript(serialized);

			expect(roundTripped.fullText).toBe(original.fullText);
			expect(roundTripped.language).toBe(original.language);
			expect(roundTripped.videoDuration).toBe(original.videoDuration);
			expect(roundTripped.words).toHaveLength(original.words.length);

			for (let i = 0; i < original.words.length; i++) {
				expect(roundTripped.words[i].text).toBe(original.words[i].text);
				expect(roundTripped.words[i].start).toBe(original.words[i].start);
				expect(roundTripped.words[i].end).toBe(original.words[i].end);
				expect(roundTripped.words[i].wordIndex).toBe(original.words[i].wordIndex);
			}
		}
	});

	it("Property: Transcripts with special characters round-trip correctly", () => {
		for (let run = 0; run < 20; run++) {
			const original = generateTranscriptWithSpecialChars();
			const serialized = serializeTranscript(original);
			const roundTripped = deserializeTranscript(serialized);

			expect(roundTripped.fullText).toBe(original.fullText);
			expect(roundTripped.words[0].text).toBe(original.words[0].text);
		}
	});

	it("Property: Empty transcript round-trips correctly", () => {
		const empty: WordTranscript = {
			words: [],
			fullText: "",
			language: "en",
			videoDuration: 0,
		};
		const serialized = serializeTranscript(empty);
		const roundTripped = deserializeTranscript(serialized);

		expect(roundTripped.fullText).toBe("");
		expect(roundTripped.words).toHaveLength(0);
		expect(roundTripped.language).toBe("en");
		expect(roundTripped.videoDuration).toBe(0);
	});

	it("Property: Very long transcript (10k+ words) round-trips correctly", () => {
		const words: WordSegment[] = [];
		for (let i = 0; i < 10000; i++) {
			words.push({ text: `word${i}`, start: i * 0.5, end: i * 0.5 + 0.3, wordIndex: i });
		}
		const longTranscript: WordTranscript = {
			words,
			fullText: words.map((w) => w.text).join(" "),
			language: "en",
			videoDuration: 5000,
		};

		const serialized = serializeTranscript(longTranscript);
		const roundTripped = deserializeTranscript(serialized);

		expect(roundTripped.words).toHaveLength(10000);
		expect(roundTripped.fullText).toBe(longTranscript.fullText);
	});
});
