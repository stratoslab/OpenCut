import {
	saveClonedVoice,
	loadAllClonedVoices,
	deleteClonedVoice as idbDeleteClonedVoice,
	type ClonedVoice,
	type SpeakerDescriptor,
} from "./tts-idb";
import { useTTSModelStore } from "./tts-model-store";
import {
	normalizeText,
	clampSpeedPitch,
	computeCharacterWeightedTimings,
	scaleWordTimings,
	type TTSWorkerResponse,
} from "./tts-worker";

export type { ClonedVoice, SpeakerDescriptor };

// ── Public interfaces (unchanged) ─────────────────────────────────────────────

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
	speed?: number;
	pitch?: number;
	volume?: number;
	outputFormat?: "wav" | "mp3" | "ogg";
}

export interface VoiceoverResult {
	id: string;
	audioBuffer: AudioBuffer;
	duration: number;
	wordTimings: Array<{ word: string; start: number; end: number }>;
}

// ── Built-in voice presets ────────────────────────────────────────────────────

export const DEFAULT_VOICES: VoiceProfile[] = [
	{
		id: "en-us-male-casual",
		name: "Alex (US Male)",
		language: "en-US",
		gender: "male",
		age: "adult",
		tone: "casual",
		sampleRate: 24000,
	},
	{
		id: "en-us-female-professional",
		name: "Sarah (US Female)",
		language: "en-US",
		gender: "female",
		age: "adult",
		tone: "professional",
		sampleRate: 24000,
	},
	{
		id: "en-us-male-energetic",
		name: "Mike (US Male)",
		language: "en-US",
		gender: "male",
		age: "young",
		tone: "energetic",
		sampleRate: 24000,
	},
	{
		id: "en-gb-female-calm",
		name: "Emma (UK Female)",
		language: "en-GB",
		gender: "female",
		age: "adult",
		tone: "calm",
		sampleRate: 24000,
	},
	{
		id: "en-us-neutral-narrator",
		name: "Narrator (Neutral)",
		language: "en-US",
		gender: "neutral",
		age: "adult",
		tone: "professional",
		sampleRate: 24000,
	},
];

// ── VoiceoverService ──────────────────────────────────────────────────────────

class VoiceoverService {
	private voices: Map<string, VoiceProfile | ClonedVoice> = new Map();
	// Map from requestId → { resolve, reject } for pending synthesize calls
	private pendingSynthesize = new Map<string, {
		resolve: (result: VoiceoverResult) => void;
		reject: (err: Error) => void;
	}>();
	// Map from requestId → { resolve, reject } for pending encode_speaker calls
	private pendingEncode = new Map<string, {
		resolve: (descriptor: SpeakerDescriptor) => void;
		reject: (err: Error) => void;
	}>();

	constructor() {
		for (const voice of DEFAULT_VOICES) {
			this.voices.set(voice.id, voice);
		}
		// Wire up worker message handler
		this.attachWorkerHandler();
	}

	private attachWorkerHandler() {
		// Re-attach whenever the worker changes
		const store = useTTSModelStore.getState();
		if (store.worker) {
			store.worker.addEventListener("message", this.handleWorkerMessage.bind(this));
		}
		// Subscribe to store changes to re-attach on new worker
		useTTSModelStore.subscribe((state, prev) => {
			if (state.worker && state.worker !== prev.worker) {
				state.worker.addEventListener("message", this.handleWorkerMessage.bind(this));
			}
		});
	}

	private handleWorkerMessage(event: MessageEvent<TTSWorkerResponse>) {
		const msg = event.data;

		switch (msg.type) {
			case "synthesize_complete": {
				const pending = this.pendingSynthesize.get(msg.requestId);
				if (!pending) return;
				this.pendingSynthesize.delete(msg.requestId);

				// Convert Float32Array → AudioBuffer
				const audioCtx = new AudioContext({ sampleRate: msg.sampleRate });
				const audioBuffer = audioCtx.createBuffer(1, msg.audioData.length, msg.sampleRate);
				audioBuffer.copyToChannel(msg.audioData, 0);
				audioCtx.close();

				pending.resolve({
					id: `voiceover-${crypto.randomUUID()}`,
					audioBuffer,
					duration: audioBuffer.duration,
					wordTimings: [], // populated by generateVoiceover after receiving this
				});
				break;
			}
			case "synthesize_error": {
				const pending = this.pendingSynthesize.get(msg.requestId);
				if (!pending) return;
				this.pendingSynthesize.delete(msg.requestId);
				pending.reject(new Error(msg.error));
				break;
			}
			case "encode_speaker_complete": {
				const pending = this.pendingEncode.get(msg.requestId);
				if (!pending) return;
				this.pendingEncode.delete(msg.requestId);
				pending.resolve(msg.descriptor);
				break;
			}
			case "encode_speaker_error": {
				const pending = this.pendingEncode.get(msg.requestId);
				if (!pending) return;
				this.pendingEncode.delete(msg.requestId);
				pending.reject(new Error(msg.error));
				break;
			}
			case "cancelled": {
				const sp = this.pendingSynthesize.get(msg.requestId);
				if (sp) {
					this.pendingSynthesize.delete(msg.requestId);
					sp.reject(new Error("Cancelled"));
				}
				const ep = this.pendingEncode.get(msg.requestId);
				if (ep) {
					this.pendingEncode.delete(msg.requestId);
					ep.reject(new Error("Cancelled"));
				}
				break;
			}
		}
	}

	// ── Existing public methods (signatures unchanged) ──────────────────────

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
		// Input validation
		if (!request.text || !request.text.trim()) {
			throw new Error("Text must be non-empty");
		}

		const voice = this.voices.get(request.voiceId);
		if (!voice) {
			throw new Error(`Voice '${request.voiceId}' not found`);
		}

		const speed = clampSpeedPitch(request.speed ?? 1.0);
		const pitch = clampSpeedPitch(request.pitch ?? 1.0);

		// Auto-load model if idle
		const store = useTTSModelStore.getState();
		if (store.stage === "idle") {
			store.initWorker();
		}

		// Get worker
		const worker = useTTSModelStore.getState().worker;
		if (!worker) {
			throw new Error("TTS worker not initialized");
		}

		// Get speaker descriptor for cloned voices
		let speakerDescriptor: SpeakerDescriptor | null = null;
		if ("isCloned" in voice && voice.isCloned) {
			const clonedVoice = voice as ClonedVoice;
			const allVoices = await loadAllClonedVoices();
			const entry = allVoices.find(e => e.voice.id === clonedVoice.id);
			speakerDescriptor = entry?.descriptor ?? null;
		}

		const requestId = crypto.randomUUID();

		// Send synthesize message and wait for response
		const result = await new Promise<VoiceoverResult>((resolve, reject) => {
			this.pendingSynthesize.set(requestId, { resolve, reject });
			worker.postMessage({
				type: "synthesize",
				requestId,
				text: request.text,
				speakerDescriptor,
				speed,
				pitch,
			});
		});

		// Compute word timings (character-weighted, then scale by speed)
		const words = normalizeText(request.text);
		const rawTimings = computeCharacterWeightedTimings(words, result.audioBuffer.duration * speed);
		const wordTimings = speed !== 1.0 ? scaleWordTimings(rawTimings, speed) : rawTimings;

		return { ...result, wordTimings };
	}

	// ── New methods ──────────────────────────────────────────────────────────

	async cloneVoice(name: string, audioBuffer: AudioBuffer): Promise<ClonedVoice> {
		const duration = audioBuffer.duration;

		if (duration < 5) {
			throw new Error(`Reference audio must be at least 5 seconds (got ${duration.toFixed(1)}s)`);
		}

		// Trim to 30 seconds if longer
		let processBuffer = audioBuffer;
		if (duration > 30) {
			const audioCtx = new OfflineAudioContext(1, 30 * audioBuffer.sampleRate, audioBuffer.sampleRate);
			const source = audioCtx.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(audioCtx.destination);
			source.start(0);
			processBuffer = await audioCtx.startRendering();
		}

		// Extract Float32Array from AudioBuffer
		const audioData = processBuffer.getChannelData(0);
		const sampleRate = processBuffer.sampleRate;

		// Auto-load model if needed
		const store = useTTSModelStore.getState();
		if (store.stage === "idle") {
			store.initWorker();
		}

		const worker = useTTSModelStore.getState().worker;
		if (!worker) {
			throw new Error("TTS worker not initialized");
		}

		const requestId = crypto.randomUUID();

		// Encode speaker in worker
		const descriptor = await new Promise<SpeakerDescriptor>((resolve, reject) => {
			this.pendingEncode.set(requestId, { resolve, reject });
			worker.postMessage({
				type: "encode_speaker",
				requestId,
				audioData,
				sampleRate,
			});
		});

		// Build ClonedVoice profile
		const descriptorId = crypto.randomUUID();
		const clonedVoice: ClonedVoice = {
			id: `cloned-${crypto.randomUUID().slice(0, 8)}`,
			name,
			language: "en-US",
			gender: "neutral",
			age: "adult",
			tone: "casual",
			sampleRate,
			isCloned: true,
			createdAt: Date.now(),
			descriptorId,
		};

		// Persist to IndexedDB
		await saveClonedVoice(clonedVoice, descriptor);

		// Register in memory
		this.voices.set(clonedVoice.id, clonedVoice);

		return clonedVoice;
	}

	async deleteClonedVoice(id: string): Promise<void> {
		const voice = this.voices.get(id);
		if (!voice || !("isCloned" in voice)) return;

		const clonedVoice = voice as ClonedVoice;
		await idbDeleteClonedVoice(clonedVoice.id, clonedVoice.descriptorId);
		this.voices.delete(id);
	}

	async loadClonedVoices(): Promise<void> {
		const entries = await loadAllClonedVoices();
		for (const { voice } of entries) {
			this.voices.set(voice.id, voice);
		}
	}
}

export const voiceoverService = new VoiceoverService();
