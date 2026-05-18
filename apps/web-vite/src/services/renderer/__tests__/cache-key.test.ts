import { describe, it, expect } from "bun:test";
import { generateCacheKey, parseCacheKey } from "../cache-key";

describe("CacheKey", () => {
	it("generates consistent keys for same inputs", () => {
		const key1 = generateCacheKey({
			sceneId: "scene-1",
			frameTime: 1.5,
			canvasWidth: 1920,
			canvasHeight: 1080,
			effectsHash: "abc123",
		});

		const key2 = generateCacheKey({
			sceneId: "scene-1",
			frameTime: 1.5,
			canvasWidth: 1920,
			canvasHeight: 1080,
			effectsHash: "abc123",
		});

		expect(key1).toBe(key2);
	});

	it("generates different keys for different inputs", () => {
		const key1 = generateCacheKey({
			sceneId: "scene-1",
			frameTime: 1.5,
			canvasWidth: 1920,
			canvasHeight: 1080,
			effectsHash: "abc123",
		});

		const key2 = generateCacheKey({
			sceneId: "scene-2",
			frameTime: 1.5,
			canvasWidth: 1920,
			canvasHeight: 1080,
			effectsHash: "abc123",
		});

		expect(key1).not.toBe(key2);
	});

	it("parses generated keys correctly", () => {
		const parts = {
			sceneId: "scene-1",
			frameTime: 1.5,
			canvasWidth: 1920,
			canvasHeight: 1080,
			effectsHash: "abc123",
		};

		const key = generateCacheKey(parts);
		const parsed = parseCacheKey(key);

		expect(parsed).not.toBeNull();
		expect(parsed!.sceneId).toBe("scene-1");
		expect(parsed!.canvasWidth).toBe(1920);
		expect(parsed!.canvasHeight).toBe(1080);
		expect(parsed!.effectsHash).toBe("abc123");
	});

	it("returns null for invalid keys", () => {
		expect(parseCacheKey("invalid")).toBeNull();
		expect(parseCacheKey("")).toBeNull();
	});
});
