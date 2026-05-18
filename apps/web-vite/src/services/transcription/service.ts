import type {
	TranscriptionLanguage,
	TranscriptionResult,
	TranscriptionProgress,
	TranscriptionModelId,
	WordTranscript,
} from "@/transcription/types";
import {
	DEFAULT_TRANSCRIPTION_MODEL,
} from "@/transcription/models";
import type { WorkerMessage, WorkerResponse } from "./worker";
import {
	segmentsToWordSegments,
	buildWordTranscript,
} from "@/transcription/word-segments";
import { useTranscriptionModelStore } from "@/transcription/transcription-model-store";

export interface DiarizationResult {
	speakers: Array<{ id: string; segments: TranscriptionSegment[] }>;
	speakerCount: number;
}

export interface TranscriptionResultWithDiarization extends TranscriptionResult {
	diarization?: DiarizationResult;
}

type ProgressCallback = (progress: TranscriptionProgress) => void;

class TranscriptionService {
	async transcribe({
		audioData,
		language = "auto",
		modelId = DEFAULT_TRANSCRIPTION_MODEL,
		diarize = false,
		onProgress,
	}: {
		audioData: Float32Array;
		language?: TranscriptionLanguage;
		modelId?: TranscriptionModelId;
		diarize?: boolean;
		onProgress?: ProgressCallback;
	}): Promise<TranscriptionResultWithDiarization> {
		const { worker, isInitialized } = useTranscriptionModelStore.getState();

		if (!worker || !isInitialized) {
			throw new Error("Transcription model not loaded. Call loadModel() first.");
		}

		return new Promise((resolve, reject) => {
			const handleMessage = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;

				switch (response.type) {
					case "transcribe-progress":
						onProgress?.({
							status: "transcribing",
							progress: response.progress,
							message: response.phase === "diarizing"
								? "Identifying speakers..."
								: "Transcribing audio...",
						});
						break;

					case "transcribe-complete":
						worker.removeEventListener("message", handleMessage);
						const result: TranscriptionResultWithDiarization = {
							text: response.text,
							segments: response.segments,
							language,
						};
						if (response.speakers) {
							result.diarization = {
								speakers: response.speakers,
								speakerCount: response.speakers.length,
							};
						}
						resolve(result);
						break;

					case "transcribe-error":
						worker.removeEventListener("message", handleMessage);
						reject(new Error(response.error));
						break;

					case "cancelled":
						worker.removeEventListener("message", handleMessage);
						reject(new Error("Transcription cancelled"));
						break;
				}
			};

			worker.addEventListener("message", handleMessage);

			worker.postMessage({
				type: "transcribe",
				audio: audioData,
				language,
				diarize,
			} satisfies WorkerMessage);
		});
	}

	async transcribeToWords({
		audioData,
		language = "auto",
		modelId = DEFAULT_TRANSCRIPTION_MODEL,
		videoDuration = 0,
		diarize = false,
		onProgress,
	}: {
		audioData: Float32Array;
		language?: TranscriptionLanguage;
		modelId?: TranscriptionModelId;
		videoDuration?: number;
		diarize?: boolean;
		onProgress?: ProgressCallback;
	}): Promise<WordTranscript & { diarization?: DiarizationResult }> {
		const result = await this.transcribe({
			audioData,
			language,
			modelId,
			diarize,
			onProgress,
		});

		const words = segmentsToWordSegments(result.segments);
		const transcript = buildWordTranscript(
			words,
			result.text,
			result.language,
			videoDuration,
		);

		return {
			...transcript,
			diarization: result.diarization,
		};
	}

	cancel() {
		const { worker } = useTranscriptionModelStore.getState();
		worker?.postMessage({ type: "cancel" } satisfies WorkerMessage);
	}

	terminate() {
		useTranscriptionModelStore.getState().terminateWorker();
	}
}

export const transcriptionService = new TranscriptionService();
