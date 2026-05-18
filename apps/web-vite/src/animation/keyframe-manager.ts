export type EasingType =
	| "linear"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| "bounce"
	| "elastic"
	| "back"
	| "circ"
	| "expo"
	| "sine"
	| "quad"
	| "cubic"
	| "quart"
	| "quint";

export interface BezierPoint {
	x: number;
	y: number;
	cp1x?: number;
	cp1y?: number;
	cp2x?: number;
	cp2y?: number;
}

export interface KeyframeChannel {
	id: string;
	property: string;
	keyframes: Keyframe[];
	easing: EasingType;
	bezierCurve?: BezierPoint[];
}

export interface Keyframe {
	id: string;
	time: number;
	value: number;
	easing?: EasingType;
	bezierIn?: { x: number; y: number };
	bezierOut?: { x: number; y: number };
}

export interface KeyframeCopyBuffer {
	channels: KeyframeChannel[];
	sourceElementId: string;
	timestamp: number;
}

export const EASING_FUNCTIONS: Record<EasingType, (t: number) => number> = {
	linear: (t) => t,
	"ease-in": (t) => t * t,
	"ease-out": (t) => t * (2 - t),
	"ease-in-out": (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
	bounce: (t) => {
		const n1 = 7.5625, d1 = 2.75;
		if (t < 1 / d1) return n1 * t * t;
		if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
		if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
		return n1 * (t -= 2.625 / d1) * t + 0.984375;
	},
	elastic: (t) => {
		if (t === 0 || t === 1) return t;
		return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
	},
	back: (t) => {
		const c1 = 1.70158, c3 = c1 + 1;
		return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
	},
	circ: (t) => 1 - Math.sqrt(1 - Math.pow(t - 1, 2)),
	expo: (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
	sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
	quad: (t) => t * t,
	cubic: (t) => t * t * t,
	quart: (t) => t * t * t * t,
	quint: (t) => t * t * t * t * t,
};

export class KeyframeManager {
	private channels: Map<string, KeyframeChannel> = new Map();
	private copyBuffer: KeyframeCopyBuffer | null = null;

	addChannel(channel: KeyframeChannel): void {
		this.channels.set(channel.id, channel);
	}

	removeChannel(channelId: string): void {
		this.channels.delete(channelId);
	}

	addKeyframe(channelId: string, keyframe: Keyframe): void {
		const channel = this.channels.get(channelId);
		if (!channel) return;

		channel.keyframes.push(keyframe);
		channel.keyframes.sort((a, b) => a.time - b.time);
	}

	removeKeyframe(channelId: string, keyframeId: string): void {
		const channel = this.channels.get(channelId);
		if (!channel) return;

		channel.keyframes = channel.keyframes.filter(k => k.id !== keyframeId);
	}

	getValueAtTime(channelId: string, time: number): number {
		const channel = this.channels.get(channelId);
		if (!channel || channel.keyframes.length === 0) return 0;

		if (time <= channel.keyframes[0].time) return channel.keyframes[0].value;
		if (time >= channel.keyframes[channel.keyframes.length - 1].time) {
			return channel.keyframes[channel.keyframes.length - 1].value;
		}

		let prev = channel.keyframes[0];
		let next = channel.keyframes[channel.keyframes.length - 1];

		for (let i = 0; i < channel.keyframes.length - 1; i++) {
			if (time >= channel.keyframes[i].time && time <= channel.keyframes[i + 1].time) {
				prev = channel.keyframes[i];
				next = channel.keyframes[i + 1];
				break;
			}
		}

		const duration = next.time - prev.time;
		const t = duration === 0 ? 0 : (time - prev.time) / duration;
		const easingFn = EASING_FUNCTIONS[next.easing ?? channel.easing ?? "linear"];
		const easedT = easingFn(t);

		return prev.value + (next.value - prev.value) * easedT;
	}

	copyKeyframes(channelIds: string[], sourceElementId: string): void {
		const channels = channelIds
			.map(id => this.channels.get(id))
			.filter((c): c is KeyframeChannel => c !== undefined);

		this.copyBuffer = {
			channels: channels.map(c => ({ ...c, keyframes: [...c.keyframes] })),
			sourceElementId,
			timestamp: Date.now(),
		};
	}

	pasteKeyframes(targetElementId: string, timeOffset: number = 0): void {
		if (!this.copyBuffer) return;

		for (const sourceChannel of this.copyBuffer.channels) {
			const targetChannel = this.channels.get(`${targetElementId}:${sourceChannel.property}`);
			if (!targetChannel) continue;

			for (const kf of sourceChannel.keyframes) {
				targetChannel.keyframes.push({
					...kf,
					id: `kf-${crypto.randomUUID()}`,
					time: kf.time + timeOffset,
				});
			}

			targetChannel.keyframes.sort((a, b) => a.time - b.time);
		}
	}

	getAllChannels(): KeyframeChannel[] {
		return Array.from(this.channels.values());
	}

	getChannel(channelId: string): KeyframeChannel | undefined {
		return this.channels.get(channelId);
	}

	exportKeyframes(channelIds: string[]): string {
		const channels = channelIds
			.map(id => this.channels.get(id))
			.filter((c): c is KeyframeChannel => c !== undefined);

		return JSON.stringify(channels, null, 2);
	}

	importKeyframes(json: string): KeyframeChannel[] {
		const channels = JSON.parse(json) as KeyframeChannel[];
		for (const channel of channels) {
			this.channels.set(channel.id, channel);
		}
		return channels;
	}
}

export const keyframeManager = new KeyframeManager();
