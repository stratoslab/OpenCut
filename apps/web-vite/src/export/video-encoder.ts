export interface VideoEncoderOptions {
	width: number;
	height: number;
	fps: number;
	bitrate: number;
	codec: "avc" | "vp9";
}

export class VideoEncoderWrapper {
	private encoder: VideoEncoder;
	private config: VideoEncoderConfig;
	private nextKeyFrame = 0;
	private keyFrameInterval: number;

	constructor(options: VideoEncoderOptions) {
		this.keyFrameInterval = Math.max(Math.floor(options.fps), 1);

		this.config = {
			codec: options.codec === "avc" ? "avc1.42001E" : "vp09.00.10.08",
			width: options.width,
			height: options.height,
			bitrate: options.bitrate,
			framerate: options.fps,
		};

		this.encoder = new VideoEncoder({
			output: (chunk, metadata) => {
				this.onChunk?.(chunk, metadata);
			},
			error: (e) => {
				console.error("VideoEncoder error:", e);
			},
		});
	}

	private onChunk: ((chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void) | null = null;

	setChunkHandler(handler: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void): void {
		this.onChunk = handler;
	}

	async initialize(): Promise<void> {
		const support = await VideoEncoder.isConfigSupported(this.config);
		if (!support.supported) {
			throw new Error(`Video codec not supported: ${this.config.codec}`);
		}
		this.encoder.configure(this.config);
	}

	async encodeFrame(frame: VideoFrame, frameIndex: number): Promise<void> {
		const keyFrame = frameIndex >= this.nextKeyFrame;
		if (keyFrame) {
			this.nextKeyFrame = frameIndex + this.keyFrameInterval;
		}
		this.encoder.encode(frame, { keyFrame });
	}

	async flush(): Promise<void> {
		await this.encoder.flush();
	}

	close(): void {
		this.encoder.close();
	}

	getPendingCount(): number {
		return this.encoder.encodeQueueSize;
	}
}
