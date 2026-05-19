import { describe, it, expect } from "bun:test";
import { getExportResolution, RESOLUTION_MAP } from "../export-config";
import type { ExportConfig } from "../export-config";

describe("Export Config", () => {
	it("returns original resolution when config is original", () => {
		const config: ExportConfig = {
			resolution: "original",
			format: "mp4",
			quality: "medium",
			fps: 30,
			includeAudio: true,
		};

		const result = getExportResolution(config, 1920, 1080);
		expect(result.w).toBe(1920);
		expect(result.h).toBe(1080);
	});

	it("scales to 1080p maintaining aspect ratio (wider)", () => {
		const config: ExportConfig = {
			resolution: "1080p",
			format: "mp4",
			quality: "medium",
			fps: 30,
			includeAudio: true,
		};

		// 21:9 aspect ratio
		const result = getExportResolution(config, 2560, 1080);
		expect(result.w).toBe(1920);
		expect(result.h).toBeLessThanOrEqual(1080);
	});

	it("scales to 1080p maintaining aspect ratio (taller)", () => {
		const config: ExportConfig = {
			resolution: "1080p",
			format: "mp4",
			quality: "medium",
			fps: 30,
			includeAudio: true,
		};

		// 9:16 aspect ratio (vertical video)
		const result = getExportResolution(config, 1080, 1920);
		expect(result.h).toBe(1080);
		expect(result.w).toBeLessThanOrEqual(1920);
	});

	it("has correct resolution map values", () => {
		expect(RESOLUTION_MAP["1080p"]).toEqual({ w: 1920, h: 1080 });
		expect(RESOLUTION_MAP["720p"]).toEqual({ w: 1280, h: 720 });
		expect(RESOLUTION_MAP["480p"]).toEqual({ w: 854, h: 480 });
	});

	it("scales to 720p correctly", () => {
		const config: ExportConfig = {
			resolution: "720p",
			format: "mp4",
			quality: "medium",
			fps: 30,
			includeAudio: true,
		};

		const result = getExportResolution(config, 1920, 1080);
		expect(result.w).toBe(1280);
		expect(result.h).toBe(720);
	});

	it("scales to 480p correctly", () => {
		const config: ExportConfig = {
			resolution: "480p",
			format: "mp4",
			quality: "medium",
			fps: 30,
			includeAudio: true,
		};

		const result = getExportResolution(config, 1920, 1080);
		expect(result.h).toBe(480);
		expect(result.w).toBe(853);
	});
});
