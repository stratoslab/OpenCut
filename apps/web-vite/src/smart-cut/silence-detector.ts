export interface TimeRange {
	start: number;
	end: number;
	type: "filler" | "silence";
	label?: string;
}

export interface SilenceDetectOptions {
	threshold?: number;
	minDuration?: number;
	sampleRate?: number;
}

export class SilenceDetector {
	async detect(
		audio: Float32Array,
		options: SilenceDetectOptions = {},
	): Promise<TimeRange[]> {
		const threshold = options.threshold ?? 0.01;
		const minDuration = options.minDuration ?? 0.3;
		const targetSampleRate = options.sampleRate ?? 8000;

		const ctx = new OfflineAudioContext(1, audio.length, targetSampleRate);
		const buffer = ctx.createBuffer(1, audio.length, targetSampleRate);
		buffer.getChannelData(0).set(audio);

		const source = ctx.createBufferSource();
		source.buffer = buffer;
		source.connect(ctx.destination);
		source.start();

		const rendered = await ctx.startRendering();
		const data = rendered.getChannelData(0);
		const actualSampleRate = rendered.sampleRate;

		const samplesPerSecond = actualSampleRate;
		const minSamples = Math.floor(minDuration * samplesPerSecond);

		const regions: TimeRange[] = [];
		let silentStart: number | null = null;

		for (let i = 0; i < data.length; i++) {
			const amplitude = Math.abs(data[i]);
			const isSilent = amplitude < threshold;

			if (isSilent && silentStart === null) {
				silentStart = i;
			} else if (!isSilent && silentStart !== null) {
				const duration = (i - silentStart) / samplesPerSecond;
				if (duration >= minDuration) {
					regions.push({
						start: silentStart / samplesPerSecond,
						end: i / samplesPerSecond,
						type: "silence",
						label: "silence",
					});
				}
				silentStart = null;
			}
		}

		if (silentStart !== null) {
			const duration = (data.length - silentStart) / samplesPerSecond;
			if (duration >= minDuration) {
				regions.push({
					start: silentStart / samplesPerSecond,
					end: data.length / samplesPerSecond,
					type: "silence",
					label: "silence",
				});
			}
		}

		return regions;
	}
}
