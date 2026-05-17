import type { Transition, TransitionType } from "@/timeline";
import { TICKS_PER_SECOND } from "@/wasm";

export type TransitionRenderState = {
	type: TransitionType;
	progress: number;
	width: number;
	height: number;
};

export function renderTransition(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	state: TransitionRenderState,
	drawOutgoing: () => void,
	drawIncoming: () => void,
) {
	const { type, progress, width, height } = state;
	const t = Math.max(0, Math.min(1, progress));

	switch (type) {
		case "crossfade":
			renderCrossfade(ctx, t, drawOutgoing, drawIncoming);
			break;
		case "slide-left":
			renderSlide(ctx, t, "left", width, height, drawOutgoing, drawIncoming);
			break;
		case "slide-right":
			renderSlide(ctx, t, "right", width, height, drawOutgoing, drawIncoming);
			break;
		case "slide-up":
			renderSlide(ctx, t, "up", width, height, drawOutgoing, drawIncoming);
			break;
		case "slide-down":
			renderSlide(ctx, t, "down", width, height, drawOutgoing, drawIncoming);
			break;
		case "wipe-left":
			renderWipe(ctx, t, "left", width, height, drawOutgoing, drawIncoming);
			break;
		case "wipe-right":
			renderWipe(ctx, t, "right", width, height, drawOutgoing, drawIncoming);
			break;
		case "zoom-in":
			renderZoom(ctx, t, "in", width, height, drawOutgoing, drawIncoming);
			break;
		case "zoom-out":
			renderZoom(ctx, t, "out", width, height, drawOutgoing, drawIncoming);
			break;
	}
}

function renderCrossfade(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	t: number,
	drawOutgoing: () => void,
	drawIncoming: () => void,
) {
	ctx.save();
	ctx.globalAlpha = 1 - t;
	drawOutgoing();
	ctx.globalAlpha = t;
	drawIncoming();
	ctx.restore();
}

function renderSlide(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	t: number,
	direction: "left" | "right" | "up" | "down",
	width: number,
	height: number,
	drawOutgoing: () => void,
	drawIncoming: () => void,
) {
	ctx.save();

	const easeT = easeInOutCubic(t);

	drawOutgoing();

	ctx.save();
	let offsetX = 0;
	let offsetY = 0;

	switch (direction) {
		case "left":
			offsetX = -width * (1 - easeT);
			ctx.beginPath();
			ctx.rect(0, 0, width * easeT, height);
			ctx.clip();
			break;
		case "right":
			offsetX = width * (1 - easeT);
			ctx.beginPath();
			ctx.rect(width * (1 - easeT), 0, width * easeT, height);
			ctx.clip();
			break;
		case "up":
			offsetY = -height * (1 - easeT);
			ctx.beginPath();
			ctx.rect(0, 0, width, height * easeT);
			ctx.clip();
			break;
		case "down":
			offsetY = height * (1 - easeT);
			ctx.beginPath();
			ctx.rect(0, height * (1 - easeT), width, height * easeT);
			ctx.clip();
			break;
	}

	ctx.translate(offsetX, offsetY);
	drawIncoming();
	ctx.restore();
	ctx.restore();
}

function renderWipe(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	t: number,
	direction: "left" | "right",
	width: number,
	height: number,
	drawOutgoing: () => void,
	drawIncoming: () => void,
) {
	ctx.save();

	const easeT = easeInOutCubic(t);

	drawOutgoing();

	ctx.save();
	if (direction === "left") {
		ctx.beginPath();
		ctx.rect(0, 0, width * easeT, height);
		ctx.clip();
	} else {
		ctx.beginPath();
		ctx.rect(width * (1 - easeT), 0, width * easeT, height);
		ctx.clip();
	}

	drawIncoming();
	ctx.restore();
	ctx.restore();
}

function renderZoom(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	t: number,
	direction: "in" | "out",
	width: number,
	height: number,
	drawOutgoing: () => void,
	drawIncoming: () => void,
) {
	ctx.save();

	const easeT = easeInOutCubic(t);

	if (direction === "in") {
		const scale = 1 + easeT * 0.5;
		const alpha = 1 - easeT;
		ctx.globalAlpha = alpha;
		ctx.translate(width / 2, height / 2);
		ctx.scale(scale, scale);
		ctx.translate(-width / 2, -height / 2);
		drawOutgoing();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = easeT;
		drawIncoming();
	} else {
		ctx.globalAlpha = 1 - easeT;
		drawOutgoing();
		ctx.globalAlpha = easeT;
		const scale = 0.5 + easeT * 0.5;
		ctx.translate(width / 2, height / 2);
		ctx.scale(scale, scale);
		ctx.translate(-width / 2, -height / 2);
		drawIncoming();
	}

	ctx.restore();
}

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function getTransitionOverlap(
	transition: Transition | undefined,
	elementEndTime: number,
	currentTime: number,
): { isInTransition: boolean; progress: number } | null {
	if (!transition || transition.duration <= 0) {
		return null;
	}

	const transitionDurationTicks = transition.duration * TICKS_PER_SECOND;
	const transitionStart = elementEndTime - transitionDurationTicks;
	const transitionEnd = elementEndTime;

	if (currentTime >= transitionStart && currentTime < transitionEnd) {
		const progress = (currentTime - transitionStart) / transitionDurationTicks;
		return { isInTransition: true, progress: Math.max(0, Math.min(1, progress)) };
	}

	return null;
}
