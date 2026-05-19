import type { TranscriptionSegment, WordSegment, WordTranscript } from "./types";

export function splitSegmentIntoWords(
	segment: TranscriptionSegment,
	baseWordIndex: number,
): WordSegment[] {
	const trimmed = segment.text.trim();
	if (!trimmed) return [];

	const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
	if (words.length === 0) return [];

	const duration = segment.end - segment.start;
	const avgDuration = duration / words.length;

	return words.map((word, i) => {
		const wordStart = segment.start + i * avgDuration;
		const wordEnd = i === words.length - 1
			? segment.end
			: wordStart + avgDuration;
		return {
			text: cleanWord(word),
			start: Math.max(0, wordStart),
			end: Math.min(segment.end, wordEnd),
			wordIndex: baseWordIndex + i,
		};
	});
}

function cleanWord(word: string): string {
	return word.replace(/^[^\w]+|[^\w]+$/g, "");
}

export function segmentsToWordSegments(
	segments: TranscriptionSegment[],
): WordSegment[] {
	const words: WordSegment[] = [];
	let wordIndex = 0;

	for (const segment of segments) {
		const segmentWords = splitSegmentIntoWords(segment, wordIndex);
		words.push(...segmentWords);
		wordIndex += segmentWords.length;
	}

	return words;
}

export function buildWordTranscript(
	words: WordSegment[],
	fullText: string,
	language: string,
	videoDuration: number,
): WordTranscript {
	return {
		words,
		fullText,
		language,
		videoDuration,
	};
}

export function validateWordSegments(words: WordSegment[]): boolean {
	const epsilon = 1e-10;

	for (const word of words) {
		if (word.start < 0 || word.end < word.start - epsilon) {
			return false;
		}
	}

	for (let i = 1; i < words.length; i++) {
		if (words[i].start < words[i - 1].end - epsilon) {
			return false;
		}
	}

	return true;
}
