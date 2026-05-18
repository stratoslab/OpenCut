export type TextAnimationType =
	| "none"
	| "fade-in"
	| "fade-out"
	| "slide-in-left"
	| "slide-in-right"
	| "slide-in-up"
	| "slide-in-down"
	| "slide-out-left"
	| "slide-out-right"
	| "slide-out-up"
	| "slide-out-down"
	| "zoom-in"
	| "zoom-out"
	| "bounce-in"
	| "bounce-out"
	| "typewriter"
	| "glitch"
	| "neon-glow"
	| "blur-in"
	| "rotate-in"
	| "flip-in"
	| "pop-in"
	| "elastic-in";

export interface TextAnimation {
	type: TextAnimationType;
	duration: number;
	delay: number;
	easing: string;
	params: Record<string, unknown>;
}

export interface TextAnimationPreset {
	id: string;
	name: string;
	category: "entrance" | "exit" | "emphasis" | "special";
	animation: TextAnimation;
}

export const TEXT_ANIMATION_PRESETS: TextAnimationPreset[] = [
	{
		id: "fade-in",
		name: "Fade In",
		category: "entrance",
		animation: { type: "fade-in", duration: 0.5, delay: 0, easing: "ease-out", params: {} },
	},
	{
		id: "fade-out",
		name: "Fade Out",
		category: "exit",
		animation: { type: "fade-out", duration: 0.5, delay: 0, easing: "ease-in", params: {} },
	},
	{
		id: "slide-in-left",
		name: "Slide In Left",
		category: "entrance",
		animation: { type: "slide-in-left", duration: 0.6, delay: 0, easing: "ease-out", params: { distance: 50 } },
	},
	{
		id: "slide-in-right",
		name: "Slide In Right",
		category: "entrance",
		animation: { type: "slide-in-right", duration: 0.6, delay: 0, easing: "ease-out", params: { distance: 50 } },
	},
	{
		id: "slide-in-up",
		name: "Slide In Up",
		category: "entrance",
		animation: { type: "slide-in-up", duration: 0.6, delay: 0, easing: "ease-out", params: { distance: 30 } },
	},
	{
		id: "slide-in-down",
		name: "Slide In Down",
		category: "entrance",
		animation: { type: "slide-in-down", duration: 0.6, delay: 0, easing: "ease-out", params: { distance: 30 } },
	},
	{
		id: "zoom-in",
		name: "Zoom In",
		category: "entrance",
		animation: { type: "zoom-in", duration: 0.5, delay: 0, easing: "ease-out", params: { fromScale: 0.5 } },
	},
	{
		id: "zoom-out",
		name: "Zoom Out",
		category: "exit",
		animation: { type: "zoom-out", duration: 0.5, delay: 0, easing: "ease-in", params: { toScale: 1.5 } },
	},
	{
		id: "bounce-in",
		name: "Bounce In",
		category: "entrance",
		animation: { type: "bounce-in", duration: 0.8, delay: 0, easing: "ease-out", params: { bounces: 3 } },
	},
	{
		id: "bounce-out",
		name: "Bounce Out",
		category: "exit",
		animation: { type: "bounce-out", duration: 0.8, delay: 0, easing: "ease-in", params: { bounces: 3 } },
	},
	{
		id: "typewriter",
		name: "Typewriter",
		category: "emphasis",
		animation: { type: "typewriter", duration: 1.5, delay: 0, easing: "linear", params: { charDelay: 0.05 } },
	},
	{
		id: "glitch",
		name: "Glitch",
		category: "special",
		animation: { type: "glitch", duration: 0.3, delay: 0, easing: "steps(5)", params: { intensity: 5 } },
	},
	{
		id: "neon-glow",
		name: "Neon Glow",
		category: "emphasis",
		animation: { type: "neon-glow", duration: 1.0, delay: 0, easing: "ease-in-out", params: { color: "#00ffff", pulseSpeed: 2 } },
	},
	{
		id: "blur-in",
		name: "Blur In",
		category: "entrance",
		animation: { type: "blur-in", duration: 0.6, delay: 0, easing: "ease-out", params: { fromBlur: 10 } },
	},
	{
		id: "rotate-in",
		name: "Rotate In",
		category: "entrance",
		animation: { type: "rotate-in", duration: 0.7, delay: 0, easing: "ease-out", params: { fromAngle: -15 } },
	},
	{
		id: "flip-in",
		name: "Flip In",
		category: "entrance",
		animation: { type: "flip-in", duration: 0.8, delay: 0, easing: "ease-out", params: { axis: "y" } },
	},
	{
		id: "pop-in",
		name: "Pop In",
		category: "entrance",
		animation: { type: "pop-in", duration: 0.3, delay: 0, easing: "ease-out", params: { overshoot: 1.2 } },
	},
	{
		id: "elastic-in",
		name: "Elastic In",
		category: "entrance",
		animation: { type: "elastic-in", duration: 1.0, delay: 0, easing: "ease-out", params: { amplitude: 1, period: 0.3 } },
	},
	{
		id: "slide-out-left",
		name: "Slide Out Left",
		category: "exit",
		animation: { type: "slide-out-left", duration: 0.6, delay: 0, easing: "ease-in", params: { distance: 50 } },
	},
	{
		id: "slide-out-right",
		name: "Slide Out Right",
		category: "exit",
		animation: { type: "slide-out-right", duration: 0.6, delay: 0, easing: "ease-in", params: { distance: 50 } },
	},
];

export class TextAnimationManager {
	private presets: Map<string, TextAnimationPreset> = new Map();

	constructor() {
		for (const preset of TEXT_ANIMATION_PRESETS) {
			this.presets.set(preset.id, preset);
		}
	}

	getPreset(id: string): TextAnimationPreset | undefined {
		return this.presets.get(id);
	}

	getAllPresets(): TextAnimationPreset[] {
		return Array.from(this.presets.values());
	}

	getPresetsByCategory(category: TextAnimationPreset["category"]): TextAnimationPreset[] {
		return Array.from(this.presets.values()).filter(p => p.category === category);
	}

	getAnimationCSS(animation: TextAnimation): string {
		const { type, duration, delay, easing } = animation;

		switch (type) {
			case "fade-in":
				return `animation: fadeIn ${duration}s ${delay}s ${easing} both`;
			case "slide-in-up":
				return `animation: slideInUp ${duration}s ${delay}s ${easing} both`;
			case "typewriter":
				return `animation: typewriter ${duration}s ${delay}s steps(${Math.floor(duration / ((animation.params.charDelay as number) || 0.05))}) both`;
			default:
				return `animation: ${type} ${duration}s ${delay}s ${easing} both`;
		}
	}

	registerCustomPreset(preset: TextAnimationPreset): void {
		this.presets.set(preset.id, preset);
	}
}

export const textAnimationManager = new TextAnimationManager();
