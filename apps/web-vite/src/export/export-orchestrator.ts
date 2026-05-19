import Muxer from "mp4-muxer";
import { VideoEncoderWrapper } from "./video-encoder";
import { AudioEncoderWrapper } from "./audio-encoder";
import type { ExportConfig } from "./export-config";
import { BITRATE_PRESETS, getExportResolution } from "./export-config";
import { calculateTimestamp } from "./frame-capture";
import { ProgressTracker } from "./progress-tracker";
import { ResumeManager } from "./resume-manager";

export interface ExportOrchestratorOptions {
	config: ExportConfig;
	projectWidth: number;
	projectHeight: number;
	totalFrames: number;
	fps: number;
	projectId: string;
	renderFrame: (frameIndex: number) => Promise<OffscreenCanvas>;
	getAudioData?: (startTime: number, endTime: number) => Promise<Float32Array | null>;
	onProgress: (progress: import("./progress-tracker").ProgressState) => void;
	signal?: AbortSignal;
}

export interface ExportOrchestratorResult {
	blob: Blob;
	duration: number;
	totalFrames: number;
}

export class ExportOrchestrator {
	private cancelled = false;

	async start(options: ExportOrchestratorOptions): Promise<ExportOrchestratorResult> {
		const {
			config,
			projectWidth,
			projectHeight,
			totalFrames,
			fps,
			projectId,
			renderFrame,
			getAudioData,
			onProgress,
			signal,
		} = options;

		this.cancelled = false;
		const progressTracker = new ProgressTracker(totalFrames);
		const resumeManager = new ResumeManager(projectId);

		const { w: exportWidth, h: exportHeight } = getExportResolution(
			config,
			projectWidth,
			projectHeight,
		);

		const bitrate = BITRATE_PRESETS[config.quality];
		const includeAudio = config.includeAudio && !!getAudioData;

		const resumeState = await resumeManager.loadState();
		let startFrame = 0;
		if (resumeState && resumeState.config.format === config.format) {
			startFrame = resumeState.completedFrames;
		}

		const startTime = performance.now();

		const codec = config.format === "webm" ? "vp9" : "avc";
		const audioCodec = config.format === "webm" ? "opus" : "aac";

		const muxer = new Muxer({
			target: new Muxer.ArrayBufferTarget(),
			video: {
				codec: codec as any,
				width: exportWidth,
				height: exportHeight,
			},
			audio: includeAudio
				? {
						codec: audioCodec as any,
						sampleRate: 48000,
						numberOfChannels: 2,
					}
				: undefined,
			fastStart: "in-memory",
		});

		const videoEncoder = new VideoEncoderWrapper({
			width: exportWidth,
			height: exportHeight,
			fps,
			bitrate,
			codec: codec as "avc" | "vp9",
		});
		videoEncoder.setChunkHandler((chunk, metadata) => {
			muxer.addVideoChunk(chunk, metadata);
		});

		let audioEncoder: AudioEncoderWrapper | null = null;
		if (includeAudio) {
			audioEncoder = new AudioEncoderWrapper({
				sampleRate: 48000,
				numberOfChannels: 2,
				bitrate: 128_000,
				codec: audioCodec as "aac" | "opus",
			});
			const audioSupported = await audioEncoder.initialize();
			if (audioSupported) {
				audioEncoder.setChunkHandler((chunk, metadata) => {
					muxer.addAudioChunk(chunk, metadata);
				});
			} else {
				audioEncoder = null;
			}
		}

		await videoEncoder.initialize();

		const scaleCanvas =
			exportWidth !== projectWidth || exportHeight !== projectHeight
				? new OffscreenCanvas(exportWidth, exportHeight)
				: null;

		for (let i = startFrame; i < totalFrames; i++) {
			if (this.cancelled || signal?.aborted) {
				progressTracker.cancel();
				onProgress(progressTracker.getProgress());
				throw new Error("Export cancelled");
			}

			const frameStart = performance.now();

			const canvas = await renderFrame(i);

			let sourceCanvas: OffscreenCanvas;
			if (scaleCanvas && (canvas.width !== exportWidth || canvas.height !== exportHeight)) {
				const ctx = scaleCanvas.getContext("2d");
				if (ctx) {
					ctx.clearRect(0, 0, exportWidth, exportHeight);
					ctx.drawImage(canvas, 0, 0, exportWidth, exportHeight);
				}
				sourceCanvas = scaleCanvas;
			} else {
				sourceCanvas = canvas as OffscreenCanvas;
			}

			const timestampUs = calculateTimestamp(i, fps);

			const videoFrame = new VideoFrame(sourceCanvas, {
				timestamp: timestampUs,
			});

			await videoEncoder.encodeFrame(videoFrame, i);
			videoFrame.close();

			if (includeAudio && audioEncoder && getAudioData) {
				const frameStartTime = i / fps;
				const frameEndTime = (i + 1) / fps;
				const audioData = await getAudioData(frameStartTime, frameEndTime);
				if (audioData) {
					audioEncoder.pushAudio(audioData);
				}

				if ((i + 1) % 30 === 0 || i === totalFrames - 1) {
					await audioEncoder.flushPending(timestampUs);
				}
			}

			const frameTime = performance.now() - frameStart;
			progressTracker.recordFrame(frameTime);
			onProgress(progressTracker.getProgress());

			if (i % 100 === 0) {
				await resumeManager.saveState({
					projectId,
					config,
					completedFrames: i + 1,
					totalFrames,
					timestamp: Date.now(),
				});
			}
		}

		if (includeAudio && audioEncoder) {
			await audioEncoder.flush();
			audioEncoder.close();
		}

		await videoEncoder.flush();
		videoEncoder.close();

		muxer.finalize();

		const { buffer } = muxer.target as Muxer.ArrayBufferTarget;
		if (!buffer) {
			throw new Error("Muxer did not produce output buffer");
		}

		const duration = performance.now() - startTime;
		progressTracker.complete();
		onProgress(progressTracker.getProgress());

		await resumeManager.clearState();

		const mimeType = config.format === "webm" ? "video/webm" : "video/mp4";
		const blob = new Blob([buffer], { type: mimeType });

		return {
			blob,
			duration,
			totalFrames,
		};
	}

	cancel(): void {
		this.cancelled = true;
	}
}
