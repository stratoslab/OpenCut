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

type ProgressCallback = (progress: TranscriptionProgress) => void;

class TranscriptionService {
	async transcribe({
		audioData,
		language = "auto",
		modelId = DEFAULT_TRANSCRIPTION_MODEL,
		onProgress,
	}: {
		audioData: Float32Array;
		language?: TranscriptionLanguage;
		modelId?: TranscriptionModelId;
		onProgress?: ProgressCallback;
	}): Promise<TranscriptionResult> {
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
							message: "Transcribing audio...",
						});
						break;

					case "transcribe-complete":
						worker.removeEventListener("message", handleMessage);
						resolve({
							text: response.text,
							segments: response.segments,
							language,
						});
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
			} satisfies WorkerMessage);
		});
	}

	async transcribeToWords({
		audioData,
		language = "auto",
		modelId = DEFAULT_TRANSCRIPTION_MODEL,
		videoDuration = 0,
		onProgress,
	}: {
		audioData: Float32Array;
		language?: TranscriptionLanguage;
		modelId?: TranscriptionModelId;
		videoDuration?: number;
		onProgress?: ProgressCallback;
	}): Promise<WordTranscript> {
		const result = await this.transcribe({
			audioData,
			language,
			modelId,
			onProgress,
		});

		const words = segmentsToWordSegments(result.segments);

		return buildWordTranscript(
			words,
			result.text,
			result.language,
			videoDuration,
		);
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
