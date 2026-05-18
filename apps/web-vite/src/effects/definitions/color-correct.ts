import type { EffectDefinition } from "@/effects/types";

export const COLOR_CORRECT_SHADER = "color-correct";

export const colorCorrectEffectDefinition: EffectDefinition = {
	type: "color-correct",
	name: "Color Correction",
	keywords: ["color", "brightness", "contrast", "saturation", "temperature", "tint", "grade"],
	params: [
		{ key: "brightness", label: "Brightness", type: "number", default: 0, min: -100, max: 100, step: 1 },
		{ key: "contrast", label: "Contrast", type: "number", default: 0, min: -100, max: 100, step: 1 },
		{ key: "saturation", label: "Saturation", type: "number", default: 100, min: 0, max: 200, step: 1 },
		{ key: "temperature", label: "Temperature", type: "number", default: 0, min: -100, max: 100, step: 1 },
		{ key: "tint", label: "Tint", type: "number", default: 0, min: -100, max: 100, step: 1 },
	],
	renderer: {
		passes: [{
			shader: COLOR_CORRECT_SHADER,
			uniforms: ({ effectParams }) => ({
				u_scalar0: (Number(effectParams.brightness) || 0) / 100,
				u_scalar1: (Number(effectParams.contrast) || 0) / 100,
				u_scalar2: (Number(effectParams.saturation) || 100) / 100,
				u_scalar3: (Number(effectParams.temperature) || 0) / 100,
			}),
		}],
	},
};
