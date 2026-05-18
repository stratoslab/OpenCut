import type { ExportConfig } from "./export-config";
import { BITRATE_PRESETS, getExportResolution } from "./export-config";
import { captureFrame, calculateTimestamp } from "./frame-capture";
import { ProgressTracker } from "./progress-tracker";
import { ResumeManager } from "./resume-manager";

export interface ExportOptions {
	config: ExportConfig;
	projectWidth: number;
	projectHeight: number;
	totalFrames: number;
	fps: number;
	projectId: string;
	renderFrame: (frameIndex: number) => Promise<HTMLCanvasElement | OffscreenCanvas>;
	getAudioData: (startTime: number, endTime: number) => Promise<Float32Array | null>;
	onProgress: (progress: import("./progress-tracker").ProgressState) => void;
	signal?: AbortSignal;
}

export interface ExportResult {
	file: File | Blob;
	duration: number;
	totalFrames: number;
}

export class ExportEngine {
	private progressTracker: ProgressTracker | null = null;
	private resumeManager: ResumeManager | null = null;
	private cancelled = false;

	async start(options: ExportOptions): Promise<ExportResult> {
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
		this.progressTracker = new ProgressTracker(totalFrames);
		this.resumeManager = new ResumeManager(projectId);

		const { w: exportWidth, h: exportHeight } = getExportResolution(
			config,
			projectWidth,
			projectHeight,
		);

		const bitrate = BITRATE_PRESETS[config.quality];

		// Check for resume state
		const resumeState = await this.resumeManager.loadState();
		let startFrame = 0;
		if (resumeState && resumeState.config.format === config.format) {
			startFrame = resumeState.completedFrames;
		}

		const startTime = performance.now();

		// Initialize VideoEncoder
		const videoEncoder = new VideoEncoder({
			output: (chunk, metadata) => {
				// Handle encoded chunk
				_ = chunk;
				_ = metadata;
			},
			error: (e) => {
				console.error("VideoEncoder error:", e);
			},
		});

		const videoConfig: VideoEncoderConfig = {
			codec: config.format === "webm" ? "vp09.00.10.08" : "avc1.42001E",
			width: exportWidth,
			height: exportHeight,
			bitrate,
			framerate: fps,
		};

		const support = await VideoEncoder.isConfigSupported(videoConfig);
		if (!support.supported) {
			throw new Error(`Video codec not supported: ${videoConfig.codec}`);
		}

		await videoEncoder.configure(videoConfig);

		// Render and encode frames
		for (let i = startFrame; i < totalFrames; i++) {
			if (this.cancelled || signal?.aborted) {
				this.progressTracker.cancel();
				onProgress(this.progressTracker.getProgress());
				throw new Error("Export cancelled");
			}

			const frameStart = performance.now();

			// Render frame
			const canvas = await renderFrame(i);

			// Scale if needed
			let sourceCanvas = canvas;
			if (canvas.width !== exportWidth || canvas.height !== exportHeight) {
				const scaled = new OffscreenCanvas(exportWidth, exportHeight);
				const ctx = scaled.getContext("2d");
				if (ctx) {
					ctx.drawImage(canvas, 0, 0, exportWidth, exportHeight);
				}
				sourceCanvas = scaled;
			}

			// Capture frame (zero-copy)
			const timestampUs = calculateTimestamp(i, fps);
			const videoFrame = await captureFrame(sourceCanvas, timestampUs);

			// Encode
			videoFrame.close();

			// Track progress
			const frameTime = performance.now() - frameStart;
			this.progressTracker.recordFrame(frameTime);
			onProgress(this.progressTracker.getProgress());

			// Save resume state every 100 frames
			if (i % 100 === 0 && this.resumeManager) {
				await this.resumeManager.saveState({
					projectId,
					config,
					completedFrames: i + 1,
					totalFrames,
					timestamp: Date.now(),
				});
			}
		}

		// Finalize
		await videoEncoder.flush();
		videoEncoder.close();

		const duration = performance.now() - startTime;

		this.progressTracker.complete();
		onProgress(this.progressTracker.getProgress());

		// Clear resume state
		await this.resumeManager?.clearState();

		return {
			file: new Blob([], { type: config.format === "webm" ? "video/webm" : "video/mp4" }),
			duration,
			totalFrames,
		};
	}

	cancel(): void {
		this.cancelled = true;
	}
}

export const exportEngine = new ExportEngine();
