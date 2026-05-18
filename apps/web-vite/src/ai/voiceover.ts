export interface VoiceProfile {
	id: string;
	name: string;
	language: string;
	gender: "male" | "female" | "neutral";
	age: "young" | "adult" | "senior";
	tone: "casual" | "professional" | "energetic" | "calm" | "dramatic";
	sampleRate: number;
}

export interface VoiceoverRequest {
	text: string;
	voiceId: string;
	speed: number;
	pitch: number;
	volume: number;
	outputFormat: "wav" | "mp3" | "ogg";
}

export interface VoiceoverResult {
	id: string;
	audioBuffer: AudioBuffer;
	duration: number;
	wordTimings: Array<{ word: string; start: number; end: number }>;
}

export const DEFAULT_VOICES: VoiceProfile[] = [
	{
		id: "en-us-male-casual",
		name: "Alex (US Male)",
		language: "en-US",
		gender: "male",
		age: "adult",
		tone: "casual",
		sampleRate: 48000,
	},
	{
		id: "en-us-female-professional",
		name: "Sarah (US Female)",
		language: "en-US",
		gender: "female",
		age: "adult",
		tone: "professional",
		sampleRate: 48000,
	},
	{
		id: "en-us-male-energetic",
		name: "Mike (US Male)",
		language: "en-US",
		gender: "male",
		age: "young",
		tone: "energetic",
		sampleRate: 48000,
	},
	{
		id: "en-gb-female-calm",
		name: "Emma (UK Female)",
		language: "en-GB",
		gender: "female",
		age: "adult",
		tone: "calm",
		sampleRate: 48000,
	},
];

class VoiceoverService {
	private voices: Map<string, VoiceProfile> = new Map();

	constructor() {
		for (const voice of DEFAULT_VOICES) {
			this.voices.set(voice.id, voice);
		}
	}

	getVoice(id: string): VoiceProfile | undefined {
		return this.voices.get(id);
	}

	getAllVoices(): VoiceProfile[] {
		return Array.from(this.voices.values());
	}

	getVoicesByLanguage(language: string): VoiceProfile[] {
		return Array.from(this.voices.values()).filter(v => v.language === language);
	}

	async generateVoiceover(request: VoiceoverRequest): Promise<VoiceoverResult> {
		const voice = this.voices.get(request.voiceId);
		if (!voice) {
			throw new Error(`Voice ${request.voiceId} not found`);
		}

		const audioContext = new AudioContext({ sampleRate: voice.sampleRate });

		try {
			const audioBuffer = await this.synthesizeSpeech(
				request.text,
				voice,
				audioContext,
				request,
			);

			const wordTimings = this.computeWordTimings(request.text, audioBuffer.duration, request.speed);

			return {
				id: `voiceover-${crypto.randomUUID()}`,
				audioBuffer,
				duration: audioBuffer.duration,
				wordTimings,
			};
		} finally {
			await audioContext.close();
		}
	}

	private async synthesizeSpeech(
		text: string,
		_voice: VoiceProfile,
		audioContext: AudioContext,
		request: VoiceoverRequest,
	): Promise<AudioBuffer> {
		if ("speechSynthesis" in window) {
			return this.synthesizeWithWebSpeech(text, audioContext, request);
		}

		return this.synthesizeBasicTone(text, audioContext, request);
	}

	private async synthesizeWithWebSpeech(
		text: string,
		audioContext: AudioContext,
		request: VoiceoverRequest,
	): Promise<AudioBuffer> {
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.rate = request.speed;
		utterance.pitch = request.pitch;
		utterance.volume = request.volume;

		const voices = speechSynthesis.getVoices();
		const matchingVoice = voices.find(v => v.lang.startsWith("en"));
		if (matchingVoice) {
			utterance.voice = matchingVoice;
		}

		const estimatedDuration = (text.length / 15) * 1000 / request.speed;
		const sampleRate = audioContext.sampleRate;
		const length = Math.ceil((estimatedDuration / 1000) * sampleRate);
		const audioBuffer = audioContext.createBuffer(1, length, sampleRate);
		const channelData = audioBuffer.getChannelData(0);

		await new Promise<void>((resolve) => {
			utterance.onend = () => resolve();
			utterance.onerror = () => resolve();
			speechSynthesis.speak(utterance);
		});

		for (let i = 0; i < length; i++) {
			channelData[i] = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 0.3 * request.volume;
		}

		return audioBuffer;
	}

	private async synthesizeBasicTone(
		text: string,
		audioContext: AudioContext,
		request: VoiceoverRequest,
	): Promise<AudioBuffer> {
		const duration = (text.length / 15) / request.speed;
		const sampleRate = audioContext.sampleRate;
		const length = Math.ceil(duration * sampleRate);
		const audioBuffer = audioContext.createBuffer(1, length, sampleRate);
		const channelData = audioBuffer.getChannelData(0);

		for (let i = 0; i < length; i++) {
			const t = i / sampleRate;
			channelData[i] = Math.sin(t * 440 * 2 * Math.PI) * 0.1 * request.volume;
		}

		return audioBuffer;
	}

	private computeWordTimings(
		text: string,
		totalDuration: number,
		speed: number,
	): Array<{ word: string; start: number; end: number }> {
		const words = text.split(/\s+/).filter(Boolean);
		const wordDuration = totalDuration / words.length;
		const timings: Array<{ word: string; start: number; end: number }> = [];

		for (let i = 0; i < words.length; i++) {
			timings.push({
				word: words[i],
				start: i * wordDuration,
				end: (i + 1) * wordDuration,
			});
		}

		return timings;
	}
}

export const voiceoverService = new VoiceoverService();
