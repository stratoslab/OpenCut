import type {
	TranscriptionSegment,
	WordSegment,
	WordTranscript,
} from "./types";

/**
 * Split a transcription segment into individual words with improved timing.
 *
 * Instead of distributing time evenly across all words, this uses
 * character-length weighting: longer words get proportionally more time.
 * This produces more realistic word timings that better match actual speech.
 *
 * For example, in a 2-second segment with words ["hello", "world", "today"],
 * each word gets time proportional to its character count rather than 0.67s each.
 */
export function splitSegmentIntoWords(
	segment: TranscriptionSegment,
	baseWordIndex: number,
): WordSegment[] {
	const trimmed = segment.text.trim();
	if (!trimmed) return [];

	const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
	if (words.length === 0) return [];

	const duration = segment.end - segment.start;

	// Use character-length weighting for more accurate timing
	const charLengths = words.map((w) => cleanWord(w).length || 1);
	const totalChars = charLengths.reduce((sum, len) => sum + len, 0);

	let currentTime = segment.start;
	const result: WordSegment[] = [];

	for (let i = 0; i < words.length; i++) {
		const wordText = cleanWord(words[i]);
		if (!wordText) continue;

		// Proportion of duration based on character length
		const proportion = charLengths[i] / totalChars;
		const wordDuration = duration * proportion;

		const wordStart = currentTime;
		const wordEnd = wordStart + wordDuration;

		result.push({
			text: wordText,
			start: Math.max(0, wordStart),
			end: Math.min(segment.end, wordEnd),
			wordIndex: baseWordIndex + result.length,
		});

		currentTime = wordEnd;
	}

	// Fix floating-point drift: ensure last word ends exactly at segment end
	if (result.length > 0) {
		result[result.length - 1].end = segment.end;
	}

	return result;
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
	const epsilon = 0.000_001;
	for (const word of words) {
		if (word.start < -epsilon || word.end + epsilon < word.start) {
			return false;
		}
	}

	for (let i = 1; i < words.length; i++) {
		if (words[i].start + epsilon < words[i - 1].end) {
			return false;
		}
	}

	return true;
}
