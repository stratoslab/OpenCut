import type { EffectDefinition, EffectPass } from "@/effects/types";
import { GAUSSIAN_BLUR_SHADER } from "./blur";

export const GLOW_THRESHOLD_SHADER = "glow-threshold";
export const GLOW_COMPOSITE_SHADER = "glow-composite";

export const glowEffectDefinition: EffectDefinition = {
	type: "glow",
	name: "Glow / Bloom",
	keywords: ["glow", "bloom", "hdr", "dreamy", "ethereal", "light"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 50, min: 0, max: 100, step: 1 },
		{ key: "threshold", label: "Threshold", type: "number", default: 70, min: 0, max: 100, step: 1 },
		{ key: "radius", label: "Radius", type: "number", default: 30, min: 0, max: 100, step: 1 },
	],
	renderer: {
		buildPasses: ({ effectParams, width, height }) => {
			const intensity = (Number(effectParams.intensity) || 50) / 100;
			const threshold = (Number(effectParams.threshold) || 70) / 100;
			const radius = (Number(effectParams.radius) || 30) / 100;

			const passes: EffectPass[] = [];

			// Pass 1: Threshold extraction
			passes.push({
				shader: GLOW_THRESHOLD_SHADER,
				uniforms: { u_scalar0: threshold },
			});

			// Pass 2-3: Gaussian blur (H + V) on thresholded image
			const sigma = Math.max(radius * 10, 0.001);
			passes.push({
				shader: GAUSSIAN_BLUR_SHADER,
				uniforms: { u_sigma: sigma, u_step: 1, u_direction: [1, 0] },
			});
			passes.push({
				shader: GAUSSIAN_BLUR_SHADER,
				uniforms: { u_sigma: sigma, u_step: 1, u_direction: [0, 1] },
			});

			// Pass 4: Additive composite
			passes.push({
				shader: GLOW_COMPOSITE_SHADER,
				uniforms: { u_scalar0: intensity },
			});

			return passes;
		},
	},
};
