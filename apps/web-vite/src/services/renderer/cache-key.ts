export interface CacheKeyParts {
	sceneId: string;
	frameTime: number;
	canvasWidth: number;
	canvasHeight: number;
	effectsHash: string;
}

export function generateCacheKey(parts: CacheKeyParts): string {
	return `${parts.sceneId}:${parts.frameTime.toFixed(3)}:${parts.canvasWidth}x${parts.canvasHeight}:${parts.effectsHash}`;
}

export function parseCacheKey(key: string): CacheKeyParts | null {
	const parts = key.split(":");
	if (parts.length !== 4) return null;

	const [sceneId, timeStr, sizeStr, effectsHash] = parts;
	const frameTime = Number.parseFloat(timeStr);
	if (Number.isNaN(frameTime)) return null;

	const sizeParts = sizeStr.split("x");
	if (sizeParts.length !== 2) return null;

	const canvasWidth = Number.parseInt(sizeParts[0], 10);
	const canvasHeight = Number.parseInt(sizeParts[1], 10);
	if (Number.isNaN(canvasWidth) || Number.isNaN(canvasHeight)) return null;

	return { sceneId, frameTime, canvasWidth, canvasHeight, effectsHash };
}
