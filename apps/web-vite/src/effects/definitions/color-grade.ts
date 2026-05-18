import type { EffectDefinition } from "@/effects/types";

export const COLOR_GRADE_SHADER = "color-grade";

export const colorGradeEffectDefinition: EffectDefinition = {
	type: "color-grade",
	name: "Auto Color Grade",
	keywords: ["color", "grade", "cinematic", "warm", "cool", "dramatic", "vintage", "auto"],
	params: [
		{ key: "preset", label: "Preset", type: "select", default: "cinematic", options: [
			{ value: "cinematic", label: "Cinematic" },
			{ value: "warm", label: "Warm" },
			{ value: "cool", label: "Cool" },
			{ value: "dramatic", label: "Dramatic" },
			{ value: "vintage", label: "Vintage" },
			{ value: "neutral", label: "Neutral" },
		]},
		{ key: "intensity", label: "Intensity", type: "number", default: 70, min: 0, max: 100, step: 1 },
	],
	renderer: {
		passes: [{
			shader: COLOR_GRADE_SHADER,
			uniforms: ({ effectParams }) => {
				const presetMap: Record<string, [number, number, number, number]> = {
					cinematic: [0.05, 0.15, 0.9, 0.1],
					warm: [0.0, 0.1, 1.1, 0.2],
					cool: [0.0, 0.1, 0.9, -0.2],
					dramatic: [0.1, 0.3, 0.8, 0.0],
					vintage: [-0.05, 0.05, 0.85, 0.15],
					neutral: [0.0, 0.0, 1.0, 0.0],
				};
				const vals = presetMap[String(effectParams.preset)] || presetMap.neutral;
				const intensity = (Number(effectParams.intensity) || 70) / 100;
				return {
					u_scalar0: vals[0] * intensity,
					u_scalar1: vals[1] * intensity,
					u_scalar2: vals[2] * intensity,
					u_scalar3: vals[3] * intensity,
				};
			},
		}],
	},
};
