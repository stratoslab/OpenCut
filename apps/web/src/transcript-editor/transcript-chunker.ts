import type { WordSegment, WordTranscript } from "@/transcription/types";

export interface TranscriptChunk {
	text: string;
	words: WordSegment[];
	tokenCount: number;
	startIndex: number;
	endIndex: number;
}

const AVG_TOKENS_PER_WORD = 1.3;
const MAX_TOKENS = 4096;
const CONTEXT_WINDOW = 5;

export function chunkTranscript(
	transcript: WordTranscript,
	maxTokens: number = MAX_TOKENS,
	query?: string,
): TranscriptChunk[] {
	if (transcript.words.length === 0) return [];

	const totalTokens = estimateTokenCount(transcript.fullText);

	if (totalTokens <= maxTokens) {
		return [
			{
				text: transcript.fullText,
				words: transcript.words,
				tokenCount: totalTokens,
				startIndex: 0,
				endIndex: transcript.words.length - 1,
			},
		];
	}

	if (query) {
		return chunkWithQuery(transcript, maxTokens, query);
	}

	return chunkByBoundaries(transcript, maxTokens);
}

function chunkWithQuery(
	transcript: WordTranscript,
	maxTokens: number,
	query: string,
): TranscriptChunk[] {
	const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
	if (queryWords.length === 0) {
		return chunkByBoundaries(transcript, maxTokens);
	}

	const matchIndices: number[] = [];
	transcript.words.forEach((word, index) => {
		const wordText = word.text.toLowerCase();
		if (queryWords.some((qw) => wordText.includes(qw))) {
			matchIndices.push(index);
		}
	});

	if (matchIndices.length === 0) {
		return chunkByBoundaries(transcript, maxTokens);
	}

	const chunks: TranscriptChunk[] = [];
	const usedIndices = new Set<number>();

	for (const matchIndex of matchIndices) {
		const start = Math.max(0, matchIndex - CONTEXT_WINDOW);
		const end = Math.min(
			transcript.words.length - 1,
			matchIndex + CONTEXT_WINDOW,
		);

		if (usedIndices.has(start)) continue;

		const words = transcript.words.slice(start, end + 1);
		const text = words.map((w) => w.text).join(" ");
		const tokenCount = estimateTokenCount(text);

		if (tokenCount <= maxTokens) {
			chunks.push({
				text,
				words,
				tokenCount,
				startIndex: start,
				endIndex: end,
			});

			for (let i = start; i <= end; i++) {
				usedIndices.add(i);
			}
		}
	}

	return chunks;
}

function chunkByBoundaries(
	transcript: WordTranscript,
	maxTokens: number,
): TranscriptChunk[] {
	const chunks: TranscriptChunk[] = [];
	let currentWords: WordSegment[] = [];
	let currentText = "";
	let startIndex = 0;

	const maxWords = Math.floor(maxTokens / AVG_TOKENS_PER_WORD);

	for (let i = 0; i < transcript.words.length; i++) {
		const word = transcript.words[i];
		currentWords.push(word);
		currentText += (currentText ? " " : "") + word.text;

		const shouldSplit =
			currentWords.length >= maxWords ||
			isParagraphBoundary(transcript.words, i) ||
			isSentenceBoundary(word.text);

		if (shouldSplit && currentWords.length > 0) {
			const tokenCount = estimateTokenCount(currentText);
			chunks.push({
				text: currentText,
				words: currentWords,
				tokenCount,
				startIndex,
				endIndex: i,
			});

			currentWords = [];
			currentText = "";
			startIndex = i + 1;
		}
	}

	if (currentWords.length > 0) {
		const tokenCount = estimateTokenCount(currentText);
		chunks.push({
			text: currentText,
			words: currentWords,
			tokenCount,
			startIndex,
			endIndex: transcript.words.length - 1,
		});
	}

	return chunks;
}

function isParagraphBoundary(
	words: WordSegment[],
	currentIndex: number,
): boolean {
	if (currentIndex === 0 || currentIndex >= words.length - 1) return false;

	const currentWord = words[currentIndex].text;
	const nextWord = words[currentIndex + 1].text;

	return isSentenceBoundary(currentWord) && nextWord[0] === nextWord[0].toUpperCase();
}

function isSentenceBoundary(word: string): boolean {
	return /[.!?]$/.test(word);
}

function estimateTokenCount(text: string): number {
	return Math.ceil(text.split(/\s+/).length * AVG_TOKENS_PER_WORD);
}
