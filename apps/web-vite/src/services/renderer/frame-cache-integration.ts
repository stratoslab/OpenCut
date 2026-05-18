import { FrameCache } from "./frame-cache";
import { generateCacheKey, type CacheKeyParts } from "./cache-key";
import { hashEffects } from "./effects-hash";
import type { EffectElement } from "@/timeline";

let frameCache: FrameCache | null = null;
let lastEffectsHash = "";

export function getFrameCache(): FrameCache {
	if (!frameCache) {
		frameCache = new FrameCache();
	}
	return frameCache;
}

export async function getCachedOrRender({
	sceneId,
	frameTime,
	canvasWidth,
	canvasHeight,
	effects,
	renderFn,
}: {
	sceneId: string;
	frameTime: number;
	canvasWidth: number;
	canvasHeight: number;
	effects: EffectElement[];
	renderFn: () => Promise<ImageBitmap>;
}): Promise<ImageBitmap> {
	const effectsHash = await hashEffects(effects);
	const key: CacheKeyParts = {
		sceneId,
		frameTime,
		canvasWidth,
		canvasHeight,
		effectsHash,
	};

	const cache = getFrameCache();
	const cached = await cache.get(key);

	if (cached instanceof ImageBitmap) {
		return cached;
	}

	const bitmap = await renderFn();

	// Create ImageData from bitmap for cache storage
	const tempCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const ctx = tempCanvas.getContext("2d");
	if (ctx) {
		ctx.drawImage(bitmap, 0, 0);
		const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
		// Store a copy of the bitmap for cache
		const cacheBitmap = await createImageBitmap(
			tempCanvas.transferToImageBitmap(),
		);
		await cache.set(key, cacheBitmap, imageData);
	}

	return bitmap;
}

export function invalidateFrameCacheForEffects(effects: EffectElement[]): void {
	hashEffects(effects).then((hash) => {
		getFrameCache().invalidateByEffectsHash(hash);
	});
}

export function clearFrameCache(): void {
	getFrameCache().invalidateAll();
}

export function getCacheStats() {
	return getFrameCache().getStats();
}
