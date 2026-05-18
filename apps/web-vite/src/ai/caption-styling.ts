export interface CaptionStyle {
	id: string;
	name: string;
	fontFamily: string;
	fontSize: number;
	fontWeight: string;
	fontStyle: "normal" | "italic";
	color: string;
	backgroundColor: string | null;
	outlineColor: string | null;
	outlineWidth: number;
	shadowColor: string | null;
	shadowBlur: number;
	shadowOffsetX: number;
	shadowOffsetY: number;
	padding: { top: number; right: number; bottom: number; left: number };
	borderRadius: number;
	animation: CaptionAnimation | null;
	position: "bottom" | "top" | "center" | "custom";
	customPosition?: { x: number; y: number };
	maxWidth: number;
	textAlign: "left" | "center" | "right";
	lineHeight: number;
	letterSpacing: number;
}

export interface CaptionAnimation {
	type: "none" | "fade" | "slide-up" | "slide-down" | "typewriter" | "karaoke" | "bounce" | "pop";
	duration: number;
	easing: string;
	delay: number;
}

export const CAPTION_STYLE_PRESETS: CaptionStyle[] = [
	{
		id: "classic",
		name: "Classic",
		fontFamily: "Inter",
		fontSize: 32,
		fontWeight: "bold",
		fontStyle: "normal",
		color: "#FFFFFF",
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		outlineColor: null,
		outlineWidth: 0,
		shadowColor: null,
		shadowBlur: 0,
		shadowOffsetX: 0,
		shadowOffsetY: 0,
		padding: { top: 8, right: 16, bottom: 8, left: 16 },
		borderRadius: 4,
		animation: null,
		position: "bottom",
		maxWidth: 800,
		textAlign: "center",
		lineHeight: 1.4,
		letterSpacing: 0,
	},
	{
		id: "minimal",
		name: "Minimal",
		fontFamily: "Inter",
		fontSize: 28,
		fontWeight: "500",
		fontStyle: "normal",
		color: "#FFFFFF",
		backgroundColor: null,
		outlineColor: "#000000",
		outlineWidth: 2,
		shadowColor: "rgba(0, 0, 0, 0.5)",
		shadowBlur: 4,
		shadowOffsetX: 0,
		shadowOffsetY: 2,
		padding: { top: 0, right: 0, bottom: 0, left: 0 },
		borderRadius: 0,
		animation: null,
		position: "bottom",
		maxWidth: 900,
		textAlign: "center",
		lineHeight: 1.5,
		letterSpacing: 0.5,
	},
	{
		id: "karaoke",
		name: "Karaoke",
		fontFamily: "Inter",
		fontSize: 36,
		fontWeight: "bold",
		fontStyle: "normal",
		color: "#FFFFFF",
		backgroundColor: null,
		outlineColor: "#000000",
		outlineWidth: 3,
		shadowColor: "rgba(0, 0, 0, 0.8)",
		shadowBlur: 8,
		shadowOffsetX: 0,
		shadowOffsetY: 4,
		padding: { top: 0, right: 0, bottom: 0, left: 0 },
		borderRadius: 0,
		animation: {
			type: "karaoke",
			duration: 0.3,
			easing: "linear",
			delay: 0,
		},
		position: "center",
		maxWidth: 1000,
		textAlign: "center",
		lineHeight: 1.3,
		letterSpacing: 1,
	},
	{
		id: "tiktok",
		name: "TikTok Style",
		fontFamily: "Inter",
		fontSize: 40,
		fontWeight: "bold",
		fontStyle: "normal",
		color: "#FFFFFF",
		backgroundColor: null,
		outlineColor: "#000000",
		outlineWidth: 4,
		shadowColor: "rgba(0, 0, 0, 0.9)",
		shadowBlur: 10,
		shadowOffsetX: 0,
		shadowOffsetY: 5,
		padding: { top: 0, right: 0, bottom: 0, left: 0 },
		borderRadius: 0,
		animation: {
			type: "pop",
			duration: 0.15,
			easing: "ease-out",
			delay: 0,
		},
		position: "bottom",
		maxWidth: 600,
		textAlign: "center",
		lineHeight: 1.2,
		letterSpacing: 0,
	},
	{
		id: "elegant",
		name: "Elegant",
		fontFamily: "Georgia",
		fontSize: 30,
		fontWeight: "normal",
		fontStyle: "italic",
		color: "#F5F5DC",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		outlineColor: null,
		outlineWidth: 0,
		shadowColor: "rgba(0, 0, 0, 0.3)",
		shadowBlur: 6,
		shadowOffsetX: 0,
		shadowOffsetY: 2,
		padding: { top: 12, right: 24, bottom: 12, left: 24 },
		borderRadius: 8,
		animation: {
			type: "fade",
			duration: 0.5,
			easing: "ease-in-out",
			delay: 0.1,
		},
		position: "bottom",
		maxWidth: 800,
		textAlign: "center",
		lineHeight: 1.6,
		letterSpacing: 0.5,
	},
	{
		id: "bold-news",
		name: "Bold News",
		fontFamily: "Arial",
		fontSize: 34,
		fontWeight: "900",
		fontStyle: "normal",
		color: "#FFFFFF",
		backgroundColor: "#CC0000",
		outlineColor: null,
		outlineWidth: 0,
		shadowColor: null,
		shadowBlur: 0,
		shadowOffsetX: 0,
		shadowOffsetY: 0,
		padding: { top: 6, right: 12, bottom: 6, left: 12 },
		borderRadius: 0,
		animation: {
			type: "slide-up",
			duration: 0.3,
			easing: "ease-out",
			delay: 0,
		},
		position: "bottom",
		maxWidth: 900,
		textAlign: "left",
		lineHeight: 1.3,
		letterSpacing: 0,
	},
];

export class CaptionStyleManager {
	private styles: Map<string, CaptionStyle> = new Map();
	private activeStyleId: string | null = null;

	constructor() {
		for (const preset of CAPTION_STYLE_PRESETS) {
			this.styles.set(preset.id, preset);
		}
		this.activeStyleId = "classic";
	}

	registerStyle(style: CaptionStyle): void {
		this.styles.set(style.id, style);
	}

	getStyle(id: string): CaptionStyle | undefined {
		return this.styles.get(id);
	}

	getAllStyles(): CaptionStyle[] {
		return Array.from(this.styles.values());
	}

	getActiveStyle(): CaptionStyle | null {
		if (!this.activeStyleId) return null;
		return this.styles.get(this.activeStyleId) ?? null;
	}

	setActiveStyle(id: string): void {
		if (!this.styles.has(id)) {
			throw new Error(`Style ${id} not found`);
		}
		this.activeStyleId = id;
	}

	createCustomStyle(baseStyleId: string, overrides: Partial<CaptionStyle>): CaptionStyle {
		const base = this.styles.get(baseStyleId);
		if (!base) {
			throw new Error(`Base style ${baseStyleId} not found`);
		}

		const customStyle: CaptionStyle = {
			...base,
			id: `custom-${crypto.randomUUID()}`,
			name: `${base.name} (Custom)`,
			...overrides,
		};

		this.styles.set(customStyle.id, customStyle);
		return customStyle;
	}

	applyStyleToCaptions(
		captions: Array<{ text: string; startTime: number; duration: number }>,
		style: CaptionStyle,
	): Array<{
		text: string;
		startTime: number;
		duration: number;
		style: CaptionStyle;
	}> {
		return captions.map(caption => ({
			...caption,
			style,
		}));
	}

	exportStyle(style: CaptionStyle): string {
		return JSON.stringify(style, null, 2);
	}

	importStyle(json: string): CaptionStyle {
		const parsed = JSON.parse(json);
		parsed.id = `imported-${crypto.randomUUID()}`;
		this.styles.set(parsed.id, parsed);
		return parsed;
	}
}

export const captionStyleManager = new CaptionStyleManager();
