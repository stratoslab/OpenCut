export interface AudioEncoderOptions {
	sampleRate: number;
	numberOfChannels: number;
	bitrate: number;
	codec: "aac" | "opus";
}

export class AudioEncoderWrapper {
	private encoder: AudioEncoder | null = null;
	private config: AudioEncoderConfig;
	private sampleRate: number;
	private numberOfChannels: number;
	private pendingData: Float32Array[] = [];

	constructor(options: AudioEncoderOptions) {
		this.sampleRate = options.sampleRate;
		this.numberOfChannels = options.numberOfChannels;

		this.config = {
			codec: options.codec === "aac" ? "mp4a.40.2" : "opus",
			sampleRate: options.sampleRate,
			numberOfChannels: options.numberOfChannels,
			bitrate: options.bitrate,
		};

		this.encoder = new AudioEncoder({
			output: (chunk, metadata) => {
				this.onChunk?.(chunk, metadata);
			},
			error: (e) => {
				console.error("AudioEncoder error:", e);
			},
		});
	}

	private onChunk: ((chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void) | null = null;

	setChunkHandler(handler: (chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void): void {
		this.onChunk = handler;
	}

	async initialize(): Promise<boolean> {
		const support = await AudioEncoder.isConfigSupported(this.config);
		if (!support.supported) {
			console.warn(`Audio codec not supported: ${this.config.codec}`);
			this.encoder = null;
			return false;
		}
		this.encoder!.configure(this.config);
		return true;
	}

	pushAudio(data: Float32Array): void {
		if (!this.encoder) return;
		this.pendingData.push(data);
	}

	async flushPending(timestampUs: number): Promise<void> {
		if (!this.encoder || this.pendingData.length === 0) return;

		const totalSamples = this.pendingData.reduce((sum, d) => sum + d.length, 0);
		if (totalSamples === 0) return;

		const interleaved = this.interleave(this.pendingData);
		const audioData = new AudioData({
			format: "f32-planar",
			sampleRate: this.sampleRate,
			numberOfChannels: this.numberOfChannels,
			numberOfFrames: totalSamples / this.numberOfChannels,
			timestamp: timestampUs,
			data: interleaved,
		});

		this.encoder.encode(audioData);
		audioData.close();

		this.pendingData = [];
	}

	private interleave(buffers: Float32Array[]): ArrayBuffer {
		const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
		const result = new Float32Array(totalLength);
		let offset = 0;
		for (const buf of buffers) {
			result.set(buf, offset);
			offset += buf.length;
		}
		return result.buffer;
	}

	async flush(): Promise<void> {
		if (!this.encoder) return;
		await this.encoder.flush();
	}

	close(): void {
		this.encoder?.close();
	}

	getEncoder(): AudioEncoder | null {
		return this.encoder;
	}
}
