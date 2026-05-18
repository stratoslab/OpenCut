import type { EffectPass } from "@/effects/types";
import type { MediaTime } from "opencut-wasm";

export interface TransitionElement {
	id: string;
	type: string;
	startTime: MediaTime;
	duration: MediaTime;
	clipAId: string;
	clipBId: string;
}

export const TRANSITION_SHADER = "transition";

export const TRANSITION_TYPE_MAP: Record<string, number> = {
	crossfade: 0,
	"slide-left": 1,
	"slide-right": 1,
	"wipe-left": 2,
	"wipe-right": 2,
	iris: 3,
	"clock-wipe": 4,
	glitch: 5,
};

export const DIRECTION_MAP: Record<string, number> = {
	left: 0,
	right: 1,
	up: 2,
	down: 3,
};

export function buildTransitionPass(
	transition: TransitionElement,
	currentTime: MediaTime,
): EffectPass | null {
	const start = transition.startTime;
	const end = start + transition.duration;

	if (currentTime < start || currentTime > end) {
		return null;
	}

	const progress = (currentTime - start) / transition.duration;
	const type = TRANSITION_TYPE_MAP[transition.type] ?? 0;

	let direction = 0;
	if (transition.type.includes("right")) direction = 1;
	if (transition.type.includes("up")) direction = 2;
	if (transition.type.includes("down")) direction = 3;

	return {
		shader: TRANSITION_SHADER,
		uniforms: {
			u_scalar0: type,
			u_scalar1: progress,
			u_scalar2: direction,
			u_scalar3: 1.0,
		},
	};
}
