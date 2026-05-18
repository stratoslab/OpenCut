import type { EffectDefinition, EffectPass } from "@/effects/types";

export const SHARPEN_SHADER = "sharpen";

export const sharpenEffectDefinition: EffectDefinition = {
	type: "sharpen",
	name: "Sharpen",
	keywords: ["sharpen", "detail", "crisp", "unsharp", "mask"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 0, min: 0, max: 100, step: 1 },
	],
	renderer: {
		passes: [
			{
				shader: SHARPEN_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity: (Number(effectParams.intensity) || 0) / 100,
					u_direction: [1, 0],
				}),
			},
			{
				shader: SHARPEN_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity: (Number(effectParams.intensity) || 0) / 100,
					u_direction: [0, 1],
				}),
			},
		],
	},
};
