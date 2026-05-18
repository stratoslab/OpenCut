import { describe, it, expect } from "bun:test";
import { SUBTITLE_PRESETS, getSubtitlePreset } from "@/subtitles/style-presets";
import { DEFAULT_SUBTITLE_STYLE } from "@/subtitles/style-types";
import type { SubtitleStyle } from "@/subtitles/style-types";

describe("Subtitle style presets (subtitle-style-editor Task 1)", () => {
	it("Defines 4 distinct presets", () => {
		expect(SUBTITLE_PRESETS).toHaveLength(4);
		const ids = SUBTITLE_PRESETS.map((p) => p.id);
		expect(ids).toContain("capcut");
		expect(ids).toContain("classic");
		expect(ids).toContain("modern");
		expect(ids).toContain("karaoke");
	});

	it("Property: All presets have all required style properties set", () => {
		const requiredKeys: (keyof SubtitleStyle)[] = [
			"fontFamily", "fontSize", "fontWeight", "color", "backgroundColor",
			"backgroundOpacity", "outlineColor", "outlineWidth", "shadowColor",
			"shadowBlur", "shadowOffsetX", "shadowOffsetY", "position",
			"verticalOffset", "horizontalOffset", "animation", "animationDuration",
			"lineHeight", "letterSpacing", "textAlign",
		];

		for (const preset of SUBTITLE_PRESETS) {
			for (const key of requiredKeys) {
				expect(preset.style[key]).toBeDefined();
			}
		}
	});

	it("Property: All presets have distinct visual configurations", () => {
		for (let i = 0; i < SUBTITLE_PRESETS.length; i++) {
			for (let j = i + 1; j < SUBTITLE_PRESETS.length; j++) {
				const a = SUBTITLE_PRESETS[i].style;
				const b = SUBTITLE_PRESETS[j].style;
				const isDifferent =
					a.color !== b.color ||
					a.fontSize !== b.fontSize ||
					a.animation !== b.animation ||
					a.presetId !== b.presetId;
				expect(isDifferent).toBe(true);
			}
		}
	});

	it("getSubtitlePreset returns correct style by id", () => {
		for (const preset of SUBTITLE_PRESETS) {
			const style = getSubtitlePreset(preset.id);
			expect(style).toBeDefined();
			expect(style?.presetId).toBe(preset.id);
		}
	});

	it("getSubtitlePreset returns undefined for unknown id", () => {
		expect(getSubtitlePreset("nonexistent")).toBeUndefined();
	});

	it("Property: All preset values are within valid ranges", () => {
		for (const preset of SUBTITLE_PRESETS) {
			const s = preset.style;
			expect(s.fontSize).toBeGreaterThan(0);
			expect(s.fontSize).toBeLessThanOrEqual(128);
			expect(s.fontWeight).toBeGreaterThanOrEqual(100);
			expect(s.fontWeight).toBeLessThanOrEqual(900);
			expect(s.backgroundOpacity).toBeGreaterThanOrEqual(0);
			expect(s.backgroundOpacity).toBeLessThanOrEqual(1);
			expect(s.outlineWidth).toBeGreaterThanOrEqual(0);
			expect(s.shadowBlur).toBeGreaterThanOrEqual(0);
			expect(s.animationDuration).toBeGreaterThan(0);
			expect(s.lineHeight).toBeGreaterThan(0);
		}
	});

	it("DEFAULT_SUBTITLE_STYLE has all properties", () => {
		const requiredKeys: (keyof SubtitleStyle)[] = [
			"fontFamily", "fontSize", "fontWeight", "color", "backgroundColor",
			"backgroundOpacity", "outlineColor", "outlineWidth", "shadowColor",
			"shadowBlur", "shadowOffsetX", "shadowOffsetY", "position",
			"verticalOffset", "horizontalOffset", "animation", "animationDuration",
			"lineHeight", "letterSpacing", "textAlign",
		];

		for (const key of requiredKeys) {
			expect(DEFAULT_SUBTITLE_STYLE[key]).toBeDefined();
		}
	});
});
