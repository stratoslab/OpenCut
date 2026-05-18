import {
	pipeline,
	type AutomaticSpeechRecognitionPipeline,
	type AutomaticSpeechRecognitionOutput,
} from "@huggingface/transformers";
import type { TranscriptionSegment } from "@/transcription/types";
import {
	DEFAULT_CHUNK_LENGTH_SECONDS,
	DEFAULT_STRIDE_SECONDS,
} from "@/transcription/audio";

export type WorkerMessage =
	| { type: "init"; modelId: string }
	| { type: "transcribe"; audio: Float32Array; language: string; diarize?: boolean }
	| { type: "cancel" };

export type WorkerResponse =
	| { type: "init-progress"; progress: number }
	| { type: "init-complete" }
	| { type: "init-error"; error: string }
	| { type: "transcribe-progress"; progress: number; phase: "loading" | "transcribing" | "diarizing" }
	| {
			type: "transcribe-complete";
			text: string;
			segments: TranscriptionSegment[];
			speakers?: Array<{ id: string; segments: TranscriptionSegment[] }>;
	  }
	| { type: "transcribe-error"; error: string }
	| { type: "cancelled" };

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let cancelled = false;
let lastReportedProgress = -1;
const fileBytes = new Map<string, { loaded: number; total: number }>();
const modelCache = new Map<string, AutomaticSpeechRecognitionPipeline>();

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;

	switch (message.type) {
		case "init":
			await handleInit({ modelId: message.modelId });
			break;
		case "transcribe":
			await handleTranscribe({
				audio: message.audio,
				language: message.language,
				diarize: message.diarize ?? false,
			});
			break;
		case "cancel":
			cancelled = true;
			self.postMessage({ type: "cancelled" } satisfies WorkerResponse);
			break;
	}
};

async function handleInit({ modelId }: { modelId: string }) {
	lastReportedProgress = -1;
	fileBytes.clear();

	const cached = modelCache.get(modelId);
	if (cached) {
		transcriber = cached;
		self.postMessage({ type: "init-complete" } satisfies WorkerResponse);
		return;
	}

	try {
		transcriber = (await pipeline("automatic-speech-recognition", modelId, {
			dtype: "q4",
			device: "auto",
			progress_callback: (progressInfo: {
				status?: string;
				file?: string;
				loaded?: number;
				total?: number;
			}) => {
				const file = progressInfo.file;
				if (!file) return;

				const loaded = progressInfo.loaded ?? 0;
				const total = progressInfo.total ?? 0;

				if (progressInfo.status === "progress" && total > 0) {
					fileBytes.set(file, { loaded, total });
				} else if (progressInfo.status === "done") {
					const existing = fileBytes.get(file);
					if (existing) {
						fileBytes.set(file, {
							loaded: existing.total,
							total: existing.total,
						});
					}
				}

				let totalLoaded = 0;
				let totalSize = 0;
				for (const { loaded, total } of fileBytes.values()) {
					totalLoaded += loaded;
					totalSize += total;
				}

				if (totalSize === 0) return;

				const overallProgress = (totalLoaded / totalSize) * 100;
				const roundedProgress = Math.floor(overallProgress);

				if (roundedProgress !== lastReportedProgress) {
					lastReportedProgress = roundedProgress;
					self.postMessage({
						type: "init-progress",
						progress: roundedProgress,
					} satisfies WorkerResponse);
				}
			},
		})) as unknown as AutomaticSpeechRecognitionPipeline;

		modelCache.set(modelId, transcriber);

		self.postMessage({ type: "init-complete" } satisfies WorkerResponse);
	} catch (error) {
		self.postMessage({
			type: "init-error",
			error: error instanceof Error ? error.message : "Failed to load model",
		} satisfies WorkerResponse);
	}
}

async function handleTranscribe({
	audio,
	language,
	diarize,
}: {
	audio: Float32Array;
	language: string;
	diarize: boolean;
}) {
	if (!transcriber) {
		self.postMessage({
			type: "transcribe-error",
			error: "Model not initialized",
		} satisfies WorkerResponse);
		return;
	}

	cancelled = false;

	try {
		self.postMessage({
			type: "transcribe-progress",
			progress: 0,
			phase: "transcribing",
		} satisfies WorkerResponse);

		const rawResult = await transcriber(audio, {
			chunk_length_s: DEFAULT_CHUNK_LENGTH_SECONDS,
			stride_length_s: DEFAULT_STRIDE_SECONDS,
			language: language === "auto" ? undefined : language,
			return_timestamps: true,
		});

		if (cancelled) return;

		const result: AutomaticSpeechRecognitionOutput = Array.isArray(rawResult)
			? rawResult[0]
			: rawResult;

		const segments: TranscriptionSegment[] = [];

		if (result.chunks) {
			const totalChunks = result.chunks.length;
			for (let i = 0; i < result.chunks.length; i++) {
				const chunk = result.chunks[i];
				if (chunk.timestamp && chunk.timestamp.length >= 2) {
					segments.push({
						text: chunk.text,
						start: chunk.timestamp[0] ?? 0,
						end: chunk.timestamp[1] ?? chunk.timestamp[0] ?? 0,
					});
				}

				const progress = ((i + 1) / totalChunks) * (diarize ? 70 : 100);
				self.postMessage({
					type: "transcribe-progress",
					progress: Math.floor(progress),
					phase: "transcribing",
				} satisfies WorkerResponse);
			}
		}

		let speakers: Array<{ id: string; segments: TranscriptionSegment[] }> | undefined;

		if (diarize && segments.length > 0) {
			self.postMessage({
				type: "transcribe-progress",
				progress: 70,
				phase: "diarizing",
			} satisfies WorkerResponse);

			speakers = simpleDiarization(segments, audio.length);

			self.postMessage({
				type: "transcribe-progress",
				progress: 100,
				phase: "diarizing",
			} satisfies WorkerResponse);
		}

		self.postMessage({
			type: "transcribe-complete",
			text: result.text,
			segments,
			speakers,
		} satisfies WorkerResponse);
	} catch (error) {
		if (cancelled) return;
		self.postMessage({
			type: "transcribe-error",
			error: error instanceof Error ? error.message : "Transcription failed",
		} satisfies WorkerResponse);
	}
}

function simpleDiarization(
	segments: TranscriptionSegment[],
	audioLength: number,
): Array<{ id: string; segments: TranscriptionSegment[] }> {
	const speakerCount = estimateSpeakerCount(segments);
	const segmentDuration = audioLength / segments.length;

	const speakerAssignments: number[] = [];
	let currentSpeaker = 0;
	let silenceThreshold = segmentDuration * 2;
	let lastEndTime = 0;

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		const gap = seg.start - lastEndTime;

		if (gap > silenceThreshold && i > 0) {
			currentSpeaker = (currentSpeaker + 1) % speakerCount;
		}

		speakerAssignments.push(currentSpeaker);
		lastEndTime = seg.end;
	}

	const speakers: Array<{ id: string; segments: TranscriptionSegment[] }> = [];
	for (let s = 0; s < speakerCount; s++) {
		const speakerSegments = segments.filter((_, i) => speakerAssignments[i] === s);
		if (speakerSegments.length > 0) {
			speakers.push({
				id: `speaker-${s + 1}`,
				segments: speakerSegments,
			});
		}
	}

	return speakers;
}

function estimateSpeakerCount(segments: TranscriptionSegment[]): number {
	if (segments.length < 3) return 1;

	const durations = segments.map(s => s.end - s.start);
	const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

	const gaps: number[] = [];
	for (let i = 1; i < segments.length; i++) {
		gaps.push(segments[i].start - segments[i - 1].end);
	}

	const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
	const largeGaps = gaps.filter(g => g > avgGap * 1.5).length;

	return Math.min(Math.max(1, largeGaps + 1), 4);
}
