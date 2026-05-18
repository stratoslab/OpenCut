export interface EQBand {
	frequency: number;
	gain: number;
	q: number;
	type: "lowshelf" | "peaking" | "highshelf";
}

export interface AudioEffectChain {
	eq: EQBand[];
	reverb: ReverbConfig;
	compressor: CompressorConfig;
	limiter: LimiterConfig;
	noiseGate: NoiseGateConfig;
}

export interface ReverbConfig {
	enabled: boolean;
	decay: number;
	preDelay: number;
	mix: number;
	damping: number;
}

export interface CompressorConfig {
	enabled: boolean;
	threshold: number;
	ratio: number;
	attack: number;
	release: number;
	knee: number;
}

export interface LimiterConfig {
	enabled: boolean;
	threshold: number;
	attack: number;
	release: number;
}

export interface NoiseGateConfig {
	enabled: boolean;
	threshold: number;
	attack: number;
	hold: number;
	release: number;
	range: number;
}

export interface BeatDetectionResult {
	beats: number[];
	bpm: number;
	confidence: number;
}

export interface VarispeedConfig {
	speed: number;
	pitchPreservation: boolean;
}

export class AudioEngine {
	private audioContext: AudioContext | null = null;
	private effectChains: Map<string, AudioEffectChain> = new Map();
	private analyserNodes: Map<string, AnalyserNode> = new Map();

	getContext(): AudioContext {
		if (!this.audioContext) {
			this.audioContext = new AudioContext();
		}
		return this.audioContext;
	}

	createEffectChain(trackId: string): AudioEffectChain {
		const chain: AudioEffectChain = {
			eq: this.createDefaultEQ(),
			reverb: { enabled: false, decay: 1.5, preDelay: 0.01, mix: 0.3, damping: 0.5 },
			compressor: { enabled: false, threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 6 },
			limiter: { enabled: false, threshold: -1, attack: 0.001, release: 0.05 },
			noiseGate: { enabled: false, threshold: -40, attack: 0.001, hold: 0.01, release: 0.01, range: -60 },
		};
		this.effectChains.set(trackId, chain);
		return chain;
	}

	createDefaultEQ(): EQBand[] {
		return [
			{ frequency: 32, gain: 0, q: 1, type: "lowshelf" },
			{ frequency: 64, gain: 0, q: 1, type: "peaking" },
			{ frequency: 125, gain: 0, q: 1, type: "peaking" },
			{ frequency: 250, gain: 0, q: 1, type: "peaking" },
			{ frequency: 500, gain: 0, q: 1, type: "peaking" },
			{ frequency: 1000, gain: 0, q: 1, type: "peaking" },
			{ frequency: 2000, gain: 0, q: 1, type: "peaking" },
			{ frequency: 4000, gain: 0, q: 1, type: "peaking" },
			{ frequency: 8000, gain: 0, q: 1, type: "peaking" },
			{ frequency: 16000, gain: 0, q: 1, type: "highshelf" },
		];
	}

	async detectBeats(audioBuffer: AudioBuffer, sensitivity: number = 0.5): Promise<BeatDetectionResult> {
		const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
		const source = offlineCtx.createBufferSource();
		source.buffer = audioBuffer;

		const analyser = offlineCtx.createAnalyser();
		analyser.fftSize = 2048;
		source.connect(analyser);
		analyser.connect(offlineCtx.destination);
		source.start();

		const renderedBuffer = await offlineCtx.startRendering();
		const data = renderedBuffer.getChannelData(0);

		const beats: number[] = [];
		const bufferSize = 512;
		let lastBeatTime = 0;
		let energyHistory: number[] = [];

		for (let i = 0; i < data.length - bufferSize; i += bufferSize) {
			let energy = 0;
			for (let j = 0; j < bufferSize; j++) {
				energy += data[i + j] * data[i + j];
			}
			energy = Math.sqrt(energy / bufferSize);

			const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / (energyHistory.length || 1);
			energyHistory.push(energy);
			if (energyHistory.length > 43) energyHistory.shift();

			const time = i / audioBuffer.sampleRate;
			if (energy > avgEnergy * (1 + sensitivity) && time - lastBeatTime > 0.2) {
				beats.push(time);
				lastBeatTime = time;
			}
		}

		const bpm = this.calculateBPM(beats);
		return { beats, bpm, confidence: beats.length > 10 ? 0.8 : 0.5 };
	}

	calculateBPM(beats: number[]): number {
		if (beats.length < 2) return 0;

		const intervals: number[] = [];
		for (let i = 1; i < beats.length; i++) {
			intervals.push(beats[i] - beats[i - 1]);
		}

		const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
		return Math.round(60 / avgInterval);
	}

	async applyVarispeed(audioBuffer: AudioBuffer, config: VarispeedConfig): Promise<AudioBuffer> {
		const ctx = this.getContext();
		const sampleRate = audioBuffer.sampleRate;
		const newLength = Math.ceil(audioBuffer.length / config.speed);
		const newBuffer = ctx.createBuffer(audioBuffer.numberOfChannels, newLength, sampleRate);

		for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
			const sourceData = audioBuffer.getChannelData(channel);
			const destData = newBuffer.getChannelData(channel);

			if (config.pitchPreservation) {
				for (let i = 0; i < newLength; i++) {
					const srcIndex = i * config.speed;
					const idx = Math.floor(srcIndex);
					const frac = srcIndex - idx;
					const s0 = sourceData[Math.min(idx, sourceData.length - 1)];
					const s1 = sourceData[Math.min(idx + 1, sourceData.length - 1)];
					destData[i] = s0 + (s1 - s0) * frac;
				}
			} else {
				for (let i = 0; i < newLength; i++) {
					const srcIndex = Math.floor(i * config.speed);
					destData[i] = srcIndex < sourceData.length ? sourceData[srcIndex] : 0;
				}
			}
		}

		return newBuffer;
	}

	getEffectChain(trackId: string): AudioEffectChain | undefined {
		return this.effectChains.get(trackId);
	}

	removeEffectChain(trackId: string): void {
		this.effectChains.delete(trackId);
	}

	close(): void {
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}
	}
}

export const audioEngine = new AudioEngine();
