import type { SubtitleCue } from "./types";
import type { WordSegment, WordTranscript } from "@/transcription/types";

/**
 * Convert imported subtitle cues to a WordTranscript.
 *
 * SRT/ASS cues contain phrase-level text with start/end times but no
 * word-level timings. This function splits each cue's text into individual
 * words and distributes the cue's time range using character-length
 * weighting — longer words get proportionally more time.
 *
 * This matches the approach used by `transcription/word-segments.ts` for
 * Whisper segments, ensuring consistent timing accuracy across sources.
 *
 * The resulting WordTranscript enables text-based editing for imported
 * subtitles, closing Gap 3 in the architecture.
 */
export function cuesToWordTranscript({
	cues,
	videoDuration,
	language = "unknown",
}: {
	cues: SubtitleCue[];
	videoDuration: number;
	language?: string;
}): WordTranscript {
	const words: WordSegment[] = [];
	let wordIndex = 0;

	for (const cue of cues) {
		const trimmed = cue.text.trim();
		if (!trimmed) continue;

		const cueWords = trimmed.split(/\s+/).filter((w) => w.length > 0);
		if (cueWords.length === 0) continue;

		// Use character-length weighting for more accurate timing
		const cleanedWords = cueWords.map(cleanWord).filter((w) => w.length > 0);
		if (cleanedWords.length === 0) continue;

		const charLengths = cleanedWords.map((w) => w.length || 1);
		const totalChars = charLengths.reduce((sum, len) => sum + len, 0);
		const duration = cue.duration;

		let currentTime = cue.startTime;

		for (let i = 0; i < cleanedWords.length; i++) {
			const proportion = charLengths[i] / totalChars;
			const wordDuration = duration * proportion;

			const start = currentTime;
			const end = Math.min(cue.startTime + cue.duration, start + wordDuration);

			words.push({
				text: cleanedWords[i],
				start: Math.max(0, start),
				end: Math.max(0, end),
				wordIndex: wordIndex++,
			});

			currentTime = end;
		}

		// Fix floating-point drift: ensure last word ends at cue end
		if (words.length > 0) {
			words[words.length - 1].end = cue.startTime + cue.duration;
		}
	}

	const fullText = words.map((w) => w.text).join(" ");

	return {
		words,
		fullText,
		language,
		videoDuration,
	};
}

function cleanWord(word: string): string {
	return word.replace(/^[^\w]+|[^\w]+$/g, "");
}
