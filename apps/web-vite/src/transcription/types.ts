import type { LanguageCode } from "./languages";

export type TranscriptionLanguage = LanguageCode | "auto";

export interface TranscriptionSegment {
	text: string;
	start: number;
	end: number;
	speaker?: string;
}

export interface SpeakerInfo {
	id: string;
	segments: TranscriptionSegment[];
	totalDuration: number;
	wordCount: number;
}

export interface DiarizationInfo {
	speakers: SpeakerInfo[];
	speakerCount: number;
}

export interface TranscriptionResult {
	text: string;
	segments: TranscriptionSegment[];
	language: string;
	diarization?: DiarizationInfo;
}

export type TranscriptionStatus =
	| "idle"
	| "loading-model"
	| "transcribing"
	| "diarizing"
	| "complete"
	| "error";

export interface TranscriptionProgress {
	status: TranscriptionStatus;
	progress: number;
	message?: string;
	phase?: "loading" | "transcribing" | "diarizing";
}

export type TranscriptionModelId =
	| "whisper-tiny"
	| "whisper-small"
	| "whisper-medium"
	| "whisper-large-v3-turbo";

export interface TranscriptionModel {
	id: TranscriptionModelId;
	name: string;
	huggingFaceId: string;
	description: string;
}

export interface CaptionChunk {
	text: string;
	startTime: number;
	duration: number;
	speaker?: string;
}

export interface WordSegment {
	text: string;
	start: number;
	end: number;
	wordIndex: number;
	speaker?: string;
}

export interface WordTranscript {
	words: WordSegment[];
	fullText: string;
	language: string;
	videoDuration: number;
	diarization?: DiarizationInfo;
}
