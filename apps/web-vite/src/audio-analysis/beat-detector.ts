export interface BeatDetectionResult {
	beats: number[];
	bpm: number;
}

export class BeatDetector {
	async detect(audio: Float32Array, sampleRate = 44100): Promise<BeatDetectionResult> {
		const windowSize = Math.floor(sampleRate * 0.01);
		const hopSize = Math.floor(windowSize / 2);
		const energies: number[] = [];

		for (let i = 0; i < audio.length - windowSize; i += hopSize) {
			let energy = 0;
			for (let j = 0; j < windowSize; j++) {
				energy += audio[i + j] * audio[i + j];
			}
			energies.push(energy / windowSize);
		}

		const threshold = energies.reduce((a, b) => a + b, 0) / energies.length * 1.5;
		const beats: number[] = [];

		for (let i = 1; i < energies.length - 1; i++) {
			if (energies[i] > threshold && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
				beats.push((i * hopSize) / sampleRate);
			}
		}

		const bpm = beats.length > 1
			? (beats.length - 1) / ((beats[beats.length - 1] - beats[0]) / 60)
			: 0;

		return { beats, bpm };
	}
}
