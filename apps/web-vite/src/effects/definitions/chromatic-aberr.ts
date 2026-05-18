import type { EffectDefinition } from "@/effects/types";

export const CHROMATIC_ABERR_SHADER = "chromatic-aberr";

export const chromaticAberrEffectDefinition: EffectDefinition = {
	type: "chromatic-aberr",
	name: "Chromatic Aberration",
	keywords: ["chromatic", "aberration", "rgb", "split", "glitch", "lens"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 0, min: 0, max: 100, step: 1 },
		{ key: "angle", label: "Angle", type: "number", default: 0, min: 0, max: 360, step: 1 },
	],
	renderer: {
		passes: [{
			shader: CHROMATIC_ABERR_SHADER,
			uniforms: ({ effectParams }) => ({
				u_scalar0: (Number(effectParams.intensity) || 0) / 100,
				u_scalar1: Number(effectParams.angle) || 0,
			}),
		}],
	},
};
