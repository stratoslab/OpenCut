import type { EffectDefinition } from "@/effects/types";

export const AI_UPSCALE_SHADER = "ai-upscale";

export const aiUpscaleEffectDefinition: EffectDefinition = {
	type: "ai-upscale",
	name: "AI Upscale",
	keywords: ["upscale", "super-resolution", "enhance", "sharpen", "ai", "anime4k"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 50, min: 0, max: 100, step: 1 },
	],
	renderer: {
		passes: [{
			shader: AI_UPSCALE_SHADER,
			uniforms: ({ effectParams }) => ({
				u_scalar0: (Number(effectParams.intensity) || 50) / 100,
			}),
		}],
	},
};
