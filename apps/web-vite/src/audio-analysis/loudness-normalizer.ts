export interface AudioClip { samples: Float32Array; sampleRate: number; }
export interface NormalizedClip { samples: Float32Array; gain: number; measuredLUFS: number; }

export class LoudnessNormalizer {
	measureLUFS(samples: Float32Array): number {
		let sumSquares = 0;
		for (let i = 0; i < samples.length; i++) {
			sumSquares += samples[i] * samples[i];
		}
		const rms = Math.sqrt(sumSquares / samples.length);
		return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
	}

	normalize(clips: AudioClip[], targetLUFS = -16): NormalizedClip[] {
		return clips.map((clip) => {
			const measuredLUFS = this.measureLUFS(clip.samples);
			const gainDb = targetLUFS - measuredLUFS;
			const gainLinear = Math.pow(10, gainDb / 20);
			const normalized = new Float32Array(clip.samples.length);
			for (let i = 0; i < clip.samples.length; i++) {
				normalized[i] = Math.max(-1, Math.min(1, clip.samples[i] * gainLinear));
			}
			return { samples: normalized, gain: gainLinear, measuredLUFS };
		});
	}
}
