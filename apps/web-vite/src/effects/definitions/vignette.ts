import type { EffectDefinition } from "@/effects/types";

export const VIGNETTE_SHADER = "vignette";

export const vignetteEffectDefinition: EffectDefinition = {
	type: "vignette",
	name: "Vignette",
	keywords: ["vignette", "dark", "edges", "center", "focus"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 0, min: 0, max: 100, step: 1 },
		{ key: "radius", label: "Radius", type: "number", default: 50, min: 0, max: 100, step: 1 },
		{ key: "softness", label: "Softness", type: "number", default: 50, min: 0, max: 100, step: 1 },
	],
	renderer: {
		passes: [{
			shader: VIGNETTE_SHADER,
			uniforms: ({ effectParams }) => ({
				u_scalar0: (Number(effectParams.intensity) || 0) / 100,
				u_scalar1: (Number(effectParams.radius) || 50) / 100,
				u_scalar2: (Number(effectParams.softness) || 50) / 100,
			}),
		}],
	},
};
