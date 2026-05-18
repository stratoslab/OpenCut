import type { EffectDefinition } from "@/effects/types";

export const LENS_DISTORTION_SHADER = "lens-distortion";

export const lensDistortionEffectDefinition: EffectDefinition = {
	type: "lens-distortion",
	name: "Lens Distortion",
	keywords: ["lens", "distortion", "barrel", "pincushion", "fisheye", "warp"],
	params: [
		{ key: "distortion", label: "Distortion", type: "number", default: 0, min: -100, max: 100, step: 1 },
		{ key: "zoom", label: "Zoom", type: "number", default: 0, min: 0, max: 100, step: 1 },
	],
	renderer: {
		passes: [{
			shader: LENS_DISTORTION_SHADER,
			uniforms: ({ effectParams }) => ({
				u_scalar0: (Number(effectParams.distortion) || 0) / 100,
				u_scalar1: (Number(effectParams.zoom) || 0) / 100,
			}),
		}],
	},
};
