import type { SubtitleStyle, SubtitleAnimation } from "./style-types";

export interface DrawInstruction {
	text: string;
	x: number;
	y: number;
	font: string;
	fillColor: string;
	strokeColor: string;
	strokeWidth: number;
	shadowColor: string;
	shadowBlur: number;
	shadowOffsetX: number;
	shadowOffsetY: number;
	backgroundRect?: {
		x: number;
		y: number;
		width: number;
		height: number;
		color: string;
		opacity: number;
	};
}

export interface AnimationContext {
	ctx: CanvasRenderingContext2D;
	canvasWidth: number;
	canvasHeight: number;
	text: string;
	style: SubtitleStyle;
	progress: number;
	wordIndex?: number;
}

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

function getBaseY(
	style: SubtitleStyle,
	canvasHeight: number,
	textHeight: number,
): number {
	const baseY =
		style.position === "top"
			? canvasHeight * 0.15
			: style.position === "center"
				? canvasHeight * 0.5
				: canvasHeight * 0.85;
	return baseY + style.verticalOffset + textHeight / 2;
}

function getBaseX(
	style: SubtitleStyle,
	canvasWidth: number,
	textWidth: number,
): number {
	const baseX =
		style.textAlign === "left"
			? canvasWidth * 0.1
			: style.textAlign === "right"
				? canvasWidth * 0.9 - textWidth
				: (canvasWidth - textWidth) / 2;
	return baseX + style.horizontalOffset;
}

export function renderAnimation(
	context: AnimationContext,
): DrawInstruction[] {
	const { ctx, canvasWidth, canvasHeight, text, style, progress } = context;

	ctx.save();
	ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
	const metrics = ctx.measureText(text);
	const textWidth = metrics.width;
	const textHeight = style.fontSize * style.lineHeight;

	const baseX = getBaseX(style, canvasWidth, textWidth);
	const baseY = getBaseY(style, canvasHeight, textHeight);

	const instructions: DrawInstruction[] = [];

	switch (style.animation) {
		case "fade":
			instructions.push(
				...renderFade({ ...context, baseX, baseY, textWidth, textHeight, progress }),
			);
			break;
		case "slide":
			instructions.push(
				...renderSlide({ ...context, baseX, baseY, textWidth, textHeight, progress }),
			);
			break;
		case "typewriter":
			instructions.push(
				...renderTypewriter({ ...context, baseX, baseY, textWidth, textHeight, progress }),
			);
			break;
		case "bounce":
			instructions.push(
				...renderBounce({ ...context, baseX, baseY, textWidth, textHeight, progress }),
			);
			break;
		case "karaoke":
			instructions.push(
				...renderKaraoke({ ...context, baseX, baseY, textWidth, textHeight, progress }),
			);
			break;
		default:
			instructions.push(
				...renderStatic({ ...context, baseX, baseY, textWidth, textHeight }),
			);
			break;
	}

	ctx.restore();
	return instructions;
}

function renderStatic({
	baseX,
	baseY,
	textWidth,
	textHeight,
	style,
	text,
}: AnimationContext & { baseX: number; baseY: number; textWidth: number; textHeight: number }): DrawInstruction[] {
	const instructions: DrawInstruction[] = [];

	if (style.backgroundOpacity > 0) {
		instructions.push({
			text,
			x: baseX,
			y: baseY,
			font: `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`,
			fillColor: style.color,
			strokeColor: style.outlineColor,
			strokeWidth: style.outlineWidth,
			shadowColor: style.shadowColor,
			shadowBlur: style.shadowBlur,
			shadowOffsetX: style.shadowOffsetX,
			shadowOffsetY: style.shadowOffsetY,
			backgroundRect: {
				x: baseX - 8,
				y: baseY - textHeight + 4,
				width: textWidth + 16,
				height: textHeight + 8,
				color: style.backgroundColor,
				opacity: style.backgroundOpacity,
			},
		});
	} else {
		instructions.push({
			text,
			x: baseX,
			y: baseY,
			font: `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`,
			fillColor: style.color,
			strokeColor: style.outlineColor,
			strokeWidth: style.outlineWidth,
			shadowColor: style.shadowColor,
			shadowBlur: style.shadowBlur,
			shadowOffsetX: style.shadowOffsetX,
			shadowOffsetY: style.shadowOffsetY,
		});
	}

	return instructions;
}

function renderFade({
	baseX,
	baseY,
	textWidth,
	textHeight,
	style,
	text,
	progress,
}: AnimationContext & { baseX: number; baseY: number; textWidth: number; textHeight: number; progress: number }): DrawInstruction[] {
	const easedProgress = easeOutCubic(Math.min(progress / style.animationDuration, 1));
	const instructions: DrawInstruction[] = [];

	if (style.backgroundOpacity > 0) {
		instructions.push({
			text,
			x: baseX,
			y: baseY,
			font: `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`,
			fillColor: style.color,
			strokeColor: style.outlineColor,
			strokeWidth: style.outlineWidth,
			shadowColor: style.shadowColor,
			shadowBlur: style.shadowBlur,
			shadowOffsetX: style.shadowOffsetX,
			shadowOffsetY: style.shadowOffsetY,
			backgroundRect: {
				x: baseX - 8,
				y: baseY - textHeight + 4,
				width: textWidth + 16,
				height: textHeight + 8,
				color: style.backgroundColor,
				opacity: style.backgroundOpacity * easedProgress,
			},
		});
	} else {
		instructions.push({
			text,
			x: baseX,
			y: baseY,
			font: `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`,
			fillColor: style.color,
			strokeColor: style.outlineColor,
			strokeWidth: style.outlineWidth,
			shadowColor: style.shadowColor,
			shadowBlur: style.shadowBlur,
			shadowOffsetX: style.shadowOffsetX,
			shadowOffsetY: style.shadowOffsetY,
		});
	}

	return instructions;
}

function renderSlide({
	baseX,
	baseY,
	textWidth,
	textHeight,
	style,
	text,
	progress,
}: AnimationContext & { baseX: number; baseY: number; textWidth: number; textHeight: number; progress: number }): DrawInstruction[] {
	const easedProgress = easeOutCubic(Math.min(progress / style.animationDuration, 1));
	const slideOffset = (1 - easedProgress) * 50;

	return [
		{
			text,
			x: baseX,
			y: baseY + slideOffset,
			font: `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`,
			fillColor: style.color,
			strokeColor: style.outlineColor,
			strokeWidth: style.outlineWidth,
			shadowColor: style.shadowColor,
			shadowBlur: style.shadowBlur,
			shadowOffsetX: style.shadowOffsetX,
			shadowOffsetY: style.shadowOffsetY,
			backgroundRect: style.backgroundOpacity > 0
				? {
						x: baseX - 8,
						y: baseY + slideOffset - textHeight + 4,
						width: textWidth + 16,
						height: textHeight + 8,
						color: style.backgroundColor,
						opacity: style.backgroundOpacity * easedProgress,
					}
				: undefined,
		},
	];
}

function renderTypewriter({
	baseX,
	baseY,
	textWidth,
	textHeight,
	style,
	text,
	progress,
}: AnimationContext & { baseX: number; baseY: number; textWidth: number; textHeight: number; progress: number }): DrawInstruction[] {
	const charCount = Math.floor(progress * text.length);
	const visibleText = text.slice(0, charCount);

	return [
		{
			text: visibleText,
			x: baseX,
			y: baseY,
			font: `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`,
			fillColor: style.color,
			strokeColor: style.outlineColor,
			strokeWidth: style.outlineWidth,
			shadowColor: style.shadowColor,
			shadowBlur: style.shadowBlur,
			shadowOffsetX: style.shadowOffsetX,
			shadowOffsetY: style.shadowOffsetY,
		},
	];
}

function renderBounce({
	baseX,
	baseY,
	textWidth,
	textHeight,
	style,
	text,
	progress,
}: AnimationContext & { baseX: number; baseY: number; textWidth: number; textHeight: number; progress: number }): DrawInstruction[] {
	const t = Math.min(progress / style.animationDuration, 1);
	const bounceY = Math.sin(t * Math.PI * 2) * 10 * (1 - t);

	return [
		{
			text,
			x: baseX,
			y: baseY + bounceY,
			font: `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`,
			fillColor: style.color,
			strokeColor: style.outlineColor,
			strokeWidth: style.outlineWidth,
			shadowColor: style.shadowColor,
			shadowBlur: style.shadowBlur,
			shadowOffsetX: style.shadowOffsetX,
			shadowOffsetY: style.shadowOffsetY,
			backgroundRect: style.backgroundOpacity > 0
				? {
						x: baseX - 8,
						y: baseY + bounceY - textHeight + 4,
						width: textWidth + 16,
						height: textHeight + 8,
						color: style.backgroundColor,
						opacity: style.backgroundOpacity,
					}
				: undefined,
		},
	];
}

function renderKaraoke({
	baseX,
	baseY,
	textWidth,
	textHeight,
	style,
	text,
	progress,
}: AnimationContext & { baseX: number; baseY: number; textWidth: number; textHeight: number; progress: number }): DrawInstruction[] {
	const words = text.split(" ");
	const totalWords = words.length;
	const activeWordIndex = Math.floor(progress * totalWords);

	const instructions: DrawInstruction[] = [];
	let currentX = baseX;

	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		const isActive = i <= activeWordIndex;
		const wordColor = isActive ? "#ffeb3b" : style.color;
		const wordWidth = word.length * style.fontSize * 0.6;

		instructions.push({
			text: word,
			x: currentX,
			y: baseY,
			font: `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`,
			fillColor: wordColor,
			strokeColor: style.outlineColor,
			strokeWidth: style.outlineWidth,
			shadowColor: style.shadowColor,
			shadowBlur: style.shadowBlur,
			shadowOffsetX: style.shadowOffsetX,
			shadowOffsetY: style.shadowOffsetY,
		});

		currentX += wordWidth + 8;
	}

	return instructions;
}

export function clampPosition(
	style: SubtitleStyle,
	canvasWidth: number,
	canvasHeight: number,
): SubtitleStyle {
	const maxVerticalOffset = canvasHeight * 0.4;
	const maxHorizontalOffset = canvasWidth * 0.3;

	return {
		...style,
		verticalOffset: Math.max(-maxVerticalOffset, Math.min(maxVerticalOffset, style.verticalOffset)),
		horizontalOffset: Math.max(-maxHorizontalOffset, Math.min(maxHorizontalOffset, style.horizontalOffset)),
	};
}
