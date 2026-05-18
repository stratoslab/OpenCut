import type { SubtitleCue } from "./types";
import type { WordSegment, WordTranscript } from "@/transcription/types";

/**
 * Convert imported subtitle cues to a WordTranscript.
 *
 * SRT/ASS cues contain phrase-level text with start/end times but no
 * word-level timings. This function splits each cue's text into individual
 * words and distributes the cue's time range evenly across them — the same
 * approach used by `transcription/word-segments.ts` for Whisper segments.
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

		const duration = cue.duration;
		const avgDuration = duration / cueWords.length;

		for (let i = 0; i < cueWords.length; i++) {
			const wordText = cleanWord(cueWords[i]);
			if (!wordText) continue;

			const start = cue.startTime + i * avgDuration;
			const end = Math.min(cue.startTime + cue.duration, start + avgDuration);

			words.push({
				text: wordText,
				start: Math.max(0, start),
				end: Math.max(0, end),
				wordIndex: wordIndex++,
			});
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
