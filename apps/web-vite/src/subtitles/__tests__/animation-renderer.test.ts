import { describe, it, expect } from "bun:test";
import { renderAnimation, clampPosition } from "@/subtitles/animation-renderer";
import type { SubtitleStyle } from "@/subtitles/style-types";
import { DEFAULT_SUBTITLE_STYLE } from "@/subtitles/style-types";

function makeContext(overrides: Partial<SubtitleStyle> & { progress: number; text: string }) {
	const { progress, text, ...styleOverrides } = overrides;
	const style = { ...DEFAULT_SUBTITLE_STYLE, ...styleOverrides };
	const canvas = { width: 1920, height: 1080 };
	const ctx = {
		save: () => {},
		restore: () => {},
		font: "",
		measureText: (t: string) => ({ width: t.length * style.fontSize * 0.6 }),
	} as unknown as CanvasRenderingContext2D;

	return {
		ctx,
		canvasWidth: canvas.width,
		canvasHeight: canvas.height,
		text,
		style,
		progress,
	};
}

describe("AnimationRenderer (subtitle-style-editor Task 3)", () => {
	it("Renders static text with no animation", () => {
		const ctx = makeContext({ text: "Hello world", progress: 1, animation: "none" });
		const instructions = renderAnimation(ctx);
		expect(instructions.length).toBeGreaterThan(0);
		expect(instructions[0].text).toBe("Hello world");
	});

	it("Property: Fade animation returns instructions at all progress values", () => {
		for (let p = 0; p <= 100; p += 5) {
			const ctx = makeContext({ text: "Fade test", progress: p / 100, animation: "fade" });
			const instructions = renderAnimation(ctx);
			expect(instructions.length).toBeGreaterThan(0);
		}
	});

	it("Property: Slide animation moves text position based on progress", () => {
		const ctx1 = makeContext({ text: "Slide test", progress: 0, animation: "slide" });
		const ctx2 = makeContext({ text: "Slide test", progress: 1, animation: "slide" });
		const inst1 = renderAnimation(ctx1);
		const inst2 = renderAnimation(ctx2);
		expect(inst1[0].y).not.toBe(inst2[0].y);
	});

	it("Property: Typewriter shows increasing text length with progress", () => {
		const text = "Hello world this is a test";
		const lengths: number[] = [];
		for (let p = 0; p <= 100; p += 10) {
			const ctx = makeContext({ text, progress: p / 100, animation: "typewriter" });
			const instructions = renderAnimation(ctx);
			lengths.push(instructions[0].text.length);
		}
		for (let i = 1; i < lengths.length; i++) {
			expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
		}
	});

	it("Property: Bounce animation returns valid instructions", () => {
		for (let p = 0; p <= 100; p += 5) {
			const ctx = makeContext({ text: "Bounce test", progress: p / 100, animation: "bounce" });
			const instructions = renderAnimation(ctx);
			expect(instructions.length).toBeGreaterThan(0);
			expect(instructions[0].text).toBe("Bounce test");
		}
	});

	it("Property: Karaoke animation returns multiple word instructions", () => {
		const ctx = makeContext({ text: "one two three four five", progress: 0.5, animation: "karaoke" });
		const instructions = renderAnimation(ctx);
		expect(instructions.length).toBeGreaterThan(1);
	});

	it("Property: All animations return at least one instruction", () => {
		const animations = ["none", "fade", "slide", "typewriter", "bounce", "karaoke"] as const;
		for (const anim of animations) {
			const ctx = makeContext({ text: "Test", progress: 0.5, animation: anim });
			const instructions = renderAnimation(ctx);
			expect(instructions.length).toBeGreaterThan(0);
		}
	});

	it("clampPosition keeps offsets within canvas bounds", () => {
		const style = {
			...DEFAULT_SUBTITLE_STYLE,
			verticalOffset: 9999,
			horizontalOffset: 9999,
		};
		const clamped = clampPosition(style, 1920, 1080);
		expect(Math.abs(clamped.verticalOffset)).toBeLessThanOrEqual(1080 * 0.4);
		expect(Math.abs(clamped.horizontalOffset)).toBeLessThanOrEqual(1920 * 0.3);
	});

	it("Property: clampPosition is idempotent", () => {
		const style = {
			...DEFAULT_SUBTITLE_STYLE,
			verticalOffset: 500,
			horizontalOffset: 500,
		};
		const clamped1 = clampPosition(style, 1920, 1080);
		const clamped2 = clampPosition(clamped1, 1920, 1080);
		expect(clamped1.verticalOffset).toBe(clamped2.verticalOffset);
		expect(clamped1.horizontalOffset).toBe(clamped2.horizontalOffset);
	});
});
