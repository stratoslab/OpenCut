import EventEmitter from "eventemitter3";

import type { FrameRate } from "opencut-wasm";
import { mediaTimeToSeconds } from "opencut-wasm";
import { TICKS_PER_SECOND } from "@/wasm";
import { frameRateToFloat } from "@/fps/utils";
import type { RootNode } from "./nodes/root-node";
import type { ExportFormat, ExportQuality } from "@/export";
import { CanvasRenderer } from "./canvas-renderer";

type ExportParams = {
	width: number;
	height: number;
	fps: FrameRate;
	format: ExportFormat;
	quality: ExportQuality;
	shouldIncludeAudio?: boolean;
	audioBuffer?: AudioBuffer;
};

const qualityMap: Record<ExportQuality, number> = {
	low: 1000000,
	medium: 2500000,
	high: 5000000,
	very_high: 8000000,
};

export type SceneExporterEvents = {
	progress: [progress: number];
	complete: [blob: Blob];
	error: [error: Error];
	cancelled: [];
};

export class SceneExporter extends EventEmitter<SceneExporterEvents> {
	private renderer: CanvasRenderer;
	private format: ExportFormat;
	private quality: ExportQuality;
	private shouldIncludeAudio: boolean;
	private audioBuffer?: AudioBuffer;

	private isCancelled = false;

	constructor({
		width,
		height,
		fps,
		format,
		quality,
		shouldIncludeAudio,
		audioBuffer,
	}: ExportParams) {
		super();
		this.renderer = new CanvasRenderer({
			width,
			height,
			fps,
		});

		this.format = format;
		this.quality = quality;
		this.shouldIncludeAudio = shouldIncludeAudio ?? false;
		this.audioBuffer = audioBuffer;
	}

	cancel(): void {
		this.isCancelled = true;
	}

	async export({
		rootNode,
	}: {
		rootNode: RootNode;
	}): Promise<Blob | null> {
		const fps = this.renderer.fps;
		const fpsFloat = frameRateToFloat(fps);
		const ticksPerFrame = Math.round(
			(TICKS_PER_SECOND * fps.denominator) / fps.numerator,
		);
		const frameCount = Math.floor(rootNode.duration / ticksPerFrame);

		const mimeType =
			this.format === "webm" ? "video/webm;codecs=vp9" : "video/webm;codecs=vp9";

		if (!MediaRecorder.isTypeSupported(mimeType)) {
			this.emit("error", new Error(`Mime type ${mimeType} not supported`));
			return null;
		}

		const canvas = this.renderer.getOutputCanvas();
		const stream = canvas.captureStream(0); // 0 = manual frame capture

		let audioStream: MediaStream | null = null;
		if (this.shouldIncludeAudio && this.audioBuffer) {
			const audioContext = new AudioContext();
			const source = audioContext.createBufferSource();
			source.buffer = this.audioBuffer;
			const dest = audioContext.createMediaStreamDestination();
			source.connect(dest);
			source.start();
			audioStream = dest.stream;

			audioStream.getAudioTracks().forEach((track) => {
				stream.addTrack(track);
			});
		}

		const recorder = new MediaRecorder(stream, {
			mimeType,
			videoBitsPerSecond: qualityMap[this.quality],
		});

		const chunks: Blob[] = [];
		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) chunks.push(e.data);
		};

		return new Promise<Blob | null>((resolve) => {
			recorder.onstop = () => {
				const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
				this.emit("progress", 1);
				this.emit("complete", blob);
				resolve(blob);
			};

			recorder.onerror = () => {
				this.emit("error", new Error("MediaRecorder error"));
				resolve(null);
			};

			recorder.start();

			const renderFrames = async () => {
				for (let i = 0; i < frameCount; i++) {
					if (this.isCancelled) {
						recorder.stop();
						stream.getTracks().forEach((t) => t.stop());
						this.emit("cancelled");
						resolve(null);
						return;
					}

					const timeTicks = i * ticksPerFrame;
					await this.renderer.render({ node: rootNode, time: timeTicks });

					// request a frame from the canvas stream
					stream.getVideoTracks()[0]?.requestFrame();

					this.emit("progress", i / frameCount);

					// wait for the frame interval
					await new Promise((r) => setTimeout(r, 1000 / fpsFloat));
				}

				if (this.isCancelled) {
					recorder.stop();
					stream.getTracks().forEach((t) => t.stop());
					this.emit("cancelled");
					resolve(null);
					return;
				}

				recorder.stop();
				stream.getTracks().forEach((t) => t.stop());
			};

			renderFrames();
		});
	}
}
