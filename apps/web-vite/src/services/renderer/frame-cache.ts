import { LRUMap } from "./lru-map";
import { generateCacheKey, type CacheKeyParts } from "./cache-key";

export interface CacheStats {
	hits: number;
	misses: number;
	hitRate: number;
	tier1Count: number;
	tier2Count: number;
	tier3Size: number;
	evictions: number;
}

export interface FrameCacheOptions {
	tier1MaxSize?: number;    // VRAM textures (default 300)
	tier2MaxSize?: number;    // RAM frames (default 900)
	tier3MaxBytes?: number;   // OPFS bytes (default 500MB)
}

export class FrameCache {
	private tier1: LRUMap<string, ImageBitmap>;  // VRAM (ImageBitmap for GPU upload)
	private tier2: LRUMap<string, ImageData>;    // RAM
	private tier3Size = 0;
	private tier3MaxBytes: number;

	private stats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		recentResults: [] as boolean[],  // Last 1000 for hit rate
	};

	constructor(options: FrameCacheOptions = {}) {
		this.tier1 = new LRUMap(options.tier1MaxSize ?? 300);
		this.tier2 = new LRUMap(options.tier2MaxSize ?? 900);
		this.tier3MaxBytes = options.tier3MaxBytes ?? 500 * 1024 * 1024;
	}

	async get(key: CacheKeyParts): Promise<ImageBitmap | ImageData | null> {
		const cacheKey = generateCacheKey(key);

		// Tier 1: VRAM (ImageBitmap)
		const tier1Result = this.tier1.get(cacheKey);
		if (tier1Result) {
			this.recordHit();
			return tier1Result;
		}

		// Tier 2: RAM (ImageData)
		const tier2Result = this.tier2.get(cacheKey);
		if (tier2Result) {
			this.recordHit();
			// Promote to Tier 1
			try {
				const bitmap = createImageBitmap(tier2Result);
				this.tier1.set(cacheKey, bitmap);
			} catch {
				// If bitmap creation fails, still return ImageData
			}
			return tier2Result;
		}

		// Tier 3: OPFS (not implemented yet - would need async file I/O)
		// TODO: Implement OPFS cache when needed

		this.recordMiss();
		return null;
	}

	async set(key: CacheKeyParts, bitmap: ImageBitmap, imageData: ImageData): Promise<void> {
		const cacheKey = generateCacheKey(key);

		// Store in Tier 1
		this.tier1.set(cacheKey, bitmap);

		// Store in Tier 2
		this.tier2.set(cacheKey, imageData);

		// TODO: Async OPFS storage (Tier 3)
	}

	invalidate(key: CacheKeyParts): void {
		const cacheKey = generateCacheKey(key);
		this.tier1.delete(cacheKey);
		this.tier2.delete(cacheKey);
	}

	invalidateByEffectsHash(effectsHash: string): void {
		// Invalidate all entries with matching effects hash
		for (const key of this.tier1.keys()) {
			if (key.endsWith(`:${effectsHash}`)) {
				this.tier1.delete(key);
			}
		}
		for (const key of this.tier2.keys()) {
			if (key.endsWith(`:${effectsHash}`)) {
				this.tier2.delete(key);
			}
		}
	}

	invalidateAll(): void {
		this.tier1.clear();
		this.tier2.clear();
	}

	getStats(): CacheStats {
		const recent = this.stats.recentResults;
		const hitRate = recent.length > 0
			? recent.filter(Boolean).length / recent.length
			: 0;

		return {
			hits: this.stats.hits,
			misses: this.stats.misses,
			hitRate,
			tier1Count: this.tier1.size,
			tier2Count: this.tier2.size,
			tier3Size: this.tier3Size,
			evictions: this.stats.evictions,
		};
	}

	private recordHit(): void {
		this.stats.hits++;
		this.stats.recentResults.push(true);
		if (this.stats.recentResults.length > 1000) {
			this.stats.recentResults.shift();
		}
	}

	private recordMiss(): void {
		this.stats.misses++;
		this.stats.recentResults.push(false);
		if (this.stats.recentResults.length > 1000) {
			this.stats.recentResults.shift();
		}

		const hitRate = this.stats.recentResults.filter(Boolean).length / this.stats.recentResults.length;
		if (this.stats.recentResults.length >= 100 && hitRate < 0.5) {
			console.warn("[FrameCache] Hit rate dropped below 50%:", hitRate.toFixed(2));
		}
	}
}
