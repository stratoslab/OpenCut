import type { EffectDefinition } from "@/effects/types";

export const SEPIA_SHADER = "sepia";
export const GRAYSCALE_SHADER = "grayscale";
export const INVERT_SHADER = "invert";

export const sepiaEffectDefinition: EffectDefinition = {
	type: "sepia",
	name: "Sepia",
	keywords: ["sepia", "vintage", "warm", "brown", "old"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 100, min: 0, max: 100, step: 1 },
	],
	renderer: {
		passes: [{
			shader: SEPIA_SHADER,
			uniforms: ({ effectParams }) => ({
				u_scalar0: (Number(effectParams.intensity) || 100) / 100,
			}),
		}],
	},
};

export const grayscaleEffectDefinition: EffectDefinition = {
	type: "grayscale",
	name: "Grayscale",
	keywords: ["grayscale", "black", "white", "mono", "bw"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 100, min: 0, max: 100, step: 1 },
	],
	renderer: {
		passes: [{
			shader: GRAYSCALE_SHADER,
			uniforms: ({ effectParams }) => ({
				u_scalar0: (Number(effectParams.intensity) || 100) / 100,
			}),
		}],
	},
};

export const invertEffectDefinition: EffectDefinition = {
	type: "invert",
	name: "Invert",
	keywords: ["invert", "negative", "reverse", "flip"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 100, min: 0, max: 100, step: 1 },
	],
	renderer: {
		passes: [{
			shader: INVERT_SHADER,
			uniforms: ({ effectParams }) => ({
				u_scalar0: (Number(effectParams.intensity) || 100) / 100,
			}),
		}],
	},
};
