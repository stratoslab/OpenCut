import type { EffectDefinition } from "@/effects/types";

export const NOISE_SHADER = "noise";

let frameCounter = 0;

export const noiseEffectDefinition: EffectDefinition = {
	type: "noise",
	name: "Noise / Grain",
	keywords: ["noise", "grain", "film", "texture", "static"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 0, min: 0, max: 100, step: 1 },
		{ key: "monochrome", label: "Monochrome", type: "boolean", default: false },
	],
	renderer: {
		passes: [{
			shader: NOISE_SHADER,
			uniforms: ({ effectParams }) => {
				frameCounter++;
				return {
					u_intensity: (Number(effectParams.intensity) || 0) / 100,
					u_monochrome: effectParams.monochrome ? 1 : 0,
					u_frame: frameCounter,
				};
			},
		}],
	},
};
