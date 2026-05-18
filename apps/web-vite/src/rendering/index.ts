import type { ParamValues } from "@/params";

export interface Transform {
	scaleX: number;
	scaleY: number;
	position: {
		x: number;
		y: number;
	};
	rotate: number;
}

export type BlendMode =
	| "normal"
	| "darken"
	| "multiply"
	| "color-burn"
	| "lighten"
	| "screen"
	| "plus-lighter"
	| "color-dodge"
	| "overlay"
	| "soft-light"
	| "hard-light"
	| "difference"
	| "exclusion"
	| "hue"
	| "saturation"
	| "color"
	| "luminosity"
	| "linear-burn"
	| "darker-color"
	| "linear-dodge"
	| "lighter-color"
	| "vivid-light"
	| "linear-light"
	| "pin-light"
	| "hard-mix"
	| "subtract"
	| "divide"
	| "reflect"
	| "glow"
	| "phoenix"
	| "stencil-alpha"
	| "silhouette-alpha"
	| "stencil-luma"
	| "silhouette-luma";

export function buildTransformFromParams({
	params,
}: {
	params: ParamValues;
}): Transform {
	return {
		scaleX: readNumberParam({ params, key: "transform.scaleX", fallback: 1 }),
		scaleY: readNumberParam({ params, key: "transform.scaleY", fallback: 1 }),
		position: {
			x: readNumberParam({ params, key: "transform.positionX", fallback: 0 }),
			y: readNumberParam({ params, key: "transform.positionY", fallback: 0 }),
		},
		rotate: readNumberParam({ params, key: "transform.rotate", fallback: 0 }),
	};
}

export function readOpacityFromParams({
	params,
}: {
	params: ParamValues;
}): number {
	return readNumberParam({ params, key: "opacity", fallback: 1 });
}

export function readBlendModeFromParams({
	params,
}: {
	params: ParamValues;
}): BlendMode {
	const value = params.blendMode;
	return typeof value === "string" && isBlendMode(value) ? value : "normal";
}

function readNumberParam({
	params,
	key,
	fallback,
}: {
	params: ParamValues;
	key: string;
	fallback: number;
}): number {
	const value = params[key];
	return typeof value === "number" ? value : fallback;
}

function isBlendMode(value: string): value is BlendMode {
	return [
		"normal", "darken", "multiply", "color-burn", "lighten", "screen",
		"plus-lighter", "color-dodge", "overlay", "soft-light", "hard-light",
		"difference", "exclusion", "hue", "saturation", "color", "luminosity",
		"linear-burn", "darker-color", "linear-dodge", "lighter-color",
		"vivid-light", "linear-light", "pin-light", "hard-mix",
		"subtract", "divide", "reflect", "glow", "phoenix",
		"stencil-alpha", "silhouette-alpha", "stencil-luma", "silhouette-luma",
	].includes(value);
}
