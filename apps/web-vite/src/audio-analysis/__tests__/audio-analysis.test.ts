import { describe, it, expect } from "bun:test";
import { BeatDetector } from "@/audio-analysis/beat-detector";
import { AutoDucker } from "@/audio-analysis/auto-duck";
import { LoudnessNormalizer } from "@/audio-analysis/loudness-normalizer";

describe("BeatDetector (audio-analysis Task 1)", () => {
	it("Detects beats in audio with regular pattern", async () => {
		const detector = new BeatDetector();
		const sampleRate = 44100;
		const duration = 1;
		const samples = new Float32Array(sampleRate * duration);
		for (let i = 0; i < samples.length; i++) {
			const t = i / sampleRate;
			samples[i] = Math.sin(2 * Math.PI * 120 * t) * (Math.sin(2 * Math.PI * 2 * t) > 0.8 ? 1 : 0.1);
		}

		const result = await detector.detect(samples, sampleRate);
		expect(result.beats.length).toBeGreaterThan(0);
		expect(result.bpm).toBeGreaterThan(0);
	});

	it("Property: Beat timestamps are monotonically increasing", async () => {
		const detector = new BeatDetector();
		const samples = new Float32Array(44100);
		for (let i = 0; i < samples.length; i++) {
			samples[i] = Math.random() * 0.5 + (i % 4410 < 441 ? 0.5 : 0);
		}

		const result = await detector.detect(samples, 44100);
		for (let i = 1; i < result.beats.length; i++) {
			expect(result.beats[i]).toBeGreaterThan(result.beats[i - 1]);
		}
	});
});

describe("AutoDucker (audio-analysis Task 2)", () => {
	it("Generates volume automation for speech regions", () => {
		const duck = new AutoDucker();
		const regions = [{ start: 1, end: 3 }, { start: 5, end: 7 }];
		const automations = duck.generate(regions);

		expect(automations.length).toBeGreaterThan(0);
		expect(automations[0].volume).toBe(1);
	});

	it("Property: Automation points are sorted by time", () => {
		const duck = new AutoDucker();
		for (let run = 0; run < 200; run++) {
			const count = Math.floor(Math.random() * 5) + 1;
			const regions = Array.from({ length: count }, () => {
				const start = Math.random() * 100;
				return { start, end: start + Math.random() * 5 + 0.5 };
			});

			const automations = duck.generate(regions);
			for (let i = 1; i < automations.length; i++) {
				expect(automations[i].time).toBeGreaterThanOrEqual(automations[i - 1].time);
			}
		}
	});

	it("Property: Volume values are within valid range [0, 1]", () => {
		const duck = new AutoDucker();
		const regions = [{ start: 0, end: 10 }];
		const automations = duck.generate(regions, { duckAmount: 0.2 });

		for (const auto of automations) {
			expect(auto.volume).toBeGreaterThanOrEqual(0);
			expect(auto.volume).toBeLessThanOrEqual(1);
		}
	});
});

describe("LoudnessNormalizer (audio-analysis Task 3)", () => {
	it("Measures LUFS for a signal", () => {
		const normalizer = new LoudnessNormalizer();
		const samples = new Float32Array(44100);
		for (let i = 0; i < samples.length; i++) {
			samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
		}
		const lufs = normalizer.measureLUFS(samples);
		expect(lufs).toBeLessThan(0);
		expect(lufs).toBeGreaterThan(-50);
	});

	it("Normalizes clips to target LUFS", () => {
		const normalizer = new LoudnessNormalizer();
		const samples = new Float32Array(44100);
		for (let i = 0; i < samples.length; i++) {
			samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.1;
		}

		const clips = [{ samples, sampleRate: 44100 }];
		const normalized = normalizer.normalize(clips, -16);

		expect(normalized).toHaveLength(1);
		expect(normalized[0].gain).toBeGreaterThan(0);
	});

	it("Property: Normalized samples are within [-1, 1]", () => {
		const normalizer = new LoudnessNormalizer();
		for (let run = 0; run < 200; run++) {
			const length = Math.floor(Math.random() * 10000) + 100;
			const samples = new Float32Array(length);
			for (let i = 0; i < length; i++) {
				samples[i] = (Math.random() - 0.5) * 0.5;
			}

			const normalized = normalizer.normalize([{ samples, sampleRate: 44100 }], -16);
			for (let i = 0; i < normalized[0].samples.length; i++) {
				expect(normalized[0].samples[i]).toBeGreaterThanOrEqual(-1);
				expect(normalized[0].samples[i]).toBeLessThanOrEqual(1);
			}
		}
	});
});
