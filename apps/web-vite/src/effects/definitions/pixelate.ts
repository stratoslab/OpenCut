import type { EffectDefinition } from "@/effects/types";

export const PIXELATE_SHADER = "pixelate";

export const pixelateEffectDefinition: EffectDefinition = {
	type: "pixelate",
	name: "Pixelate",
	keywords: ["pixelate", "mosaic", "censor", "block", "retro", "8bit"],
	params: [
		{ key: "blockSize", label: "Block Size", type: "number", default: 1, min: 1, max: 100, step: 1 },
	],
	renderer: {
		passes: [{
			shader: PIXELATE_SHADER,
			uniforms: ({ effectParams }) => ({
				u_scalar0: Number(effectParams.blockSize) || 1,
			}),
		}],
	},
};
