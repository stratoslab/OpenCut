import { describe, it, expect } from "bun:test";

function getTranscriptContext(fullText: string | undefined): string | undefined {
	if (!fullText) return undefined;
	const MAX_CHARS = 12_000;
	if (fullText.length <= MAX_CHARS) {
		return fullText;
	}
	return fullText.slice(0, MAX_CHARS) + "... [truncated]";
}

describe("Transcript truncation (ai-copilot-transcript-context Req 2.4)", () => {
	it("Returns undefined for empty transcript", () => {
		expect(getTranscriptContext(undefined)).toBeUndefined();
		expect(getTranscriptContext("")).toBeUndefined();
	});

	it("Returns transcript as-is when under 12,000 chars", () => {
		const short = "Hello world, this is a short transcript.";
		expect(getTranscriptContext(short)).toBe(short);
	});

	it("Returns transcript as-is at exactly 12,000 chars (boundary)", () => {
		const exact = "a".repeat(12_000);
		const result = getTranscriptContext(exact);
		expect(result).toBe(exact);
		expect(result?.length).toBe(12_000);
	});

	it("Truncates transcript over 12,000 chars with suffix", () => {
		const long = "a".repeat(15_000);
		const result = getTranscriptContext(long);

		expect(result).toBeDefined();
		expect(result?.length).toBe(12_000 + "... [truncated]".length);
		expect(result?.endsWith("... [truncated]")).toBe(true);
		expect(result?.slice(0, 100)).toBe("a".repeat(100));
	});

	it("Property: Truncated result never exceeds MAX_CHARS + suffix length", () => {
		const MAX_CHARS = 12_000;
		const suffix = "... [truncated]";
		const maxLength = MAX_CHARS + suffix.length;

		for (let len = 12_001; len < 50_000; len += 1_000) {
			const text = "x".repeat(len);
			const result = getTranscriptContext(text);
			expect(result!.length).toBeLessThanOrEqual(maxLength);
		}
	});

	it("Property: Truncated content preserves beginning of transcript", () => {
		const prefix = "INTRO: Welcome to this video. ";
		const rest = "word ".repeat(10_000);
		const text = prefix + rest;

		const result = getTranscriptContext(text);
		expect(result?.startsWith(prefix)).toBe(true);
	});

	it("Handles transcript with special characters without breaking", () => {
		const special = "Hello `backtick` and ${template} and \"quotes\" and\nnewlines";
		const result = getTranscriptContext(special);
		expect(result).toBe(special);
	});

	it("Property: Truncation is deterministic for same input", () => {
		const long = "test ".repeat(5_000);
		const result1 = getTranscriptContext(long);
		const result2 = getTranscriptContext(long);
		expect(result1).toBe(result2);
	});
});
