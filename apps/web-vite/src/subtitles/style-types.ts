export type SubtitleAnimation = "none" | "fade" | "slide" | "typewriter" | "bounce" | "karaoke";

export type SubtitlePosition = "bottom" | "top" | "center" | "custom";

export interface SubtitleStyle {
	fontFamily: string;
	fontSize: number;
	fontWeight: number;
	color: string;
	backgroundColor: string;
	backgroundOpacity: number;
	outlineColor: string;
	outlineWidth: number;
	shadowColor: string;
	shadowBlur: number;
	shadowOffsetX: number;
	shadowOffsetY: number;
	position: SubtitlePosition;
	verticalOffset: number;
	horizontalOffset: number;
	animation: SubtitleAnimation;
	animationDuration: number;
	lineHeight: number;
	letterSpacing: number;
	textAlign: "left" | "center" | "right";
	presetId?: string;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
	fontFamily: "Inter",
	fontSize: 32,
	fontWeight: 700,
	color: "#ffffff",
	backgroundColor: "#000000",
	backgroundOpacity: 0.6,
	outlineColor: "#000000",
	outlineWidth: 2,
	shadowColor: "#000000",
	shadowBlur: 4,
	shadowOffsetX: 0,
	shadowOffsetY: 2,
	position: "bottom",
	verticalOffset: 0,
	horizontalOffset: 0,
	animation: "none",
	animationDuration: 0.3,
	lineHeight: 1.4,
	letterSpacing: 0,
	textAlign: "center",
};
