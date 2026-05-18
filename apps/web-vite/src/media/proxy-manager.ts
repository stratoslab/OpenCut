export interface ProxyConfig {
	maxResolution: { width: number; height: number };
	quality: number;
	format: "webp" | "jpeg" | "png";
	cacheLocation: "opfs" | "indexeddb";
}

export interface ProxyEntry {
	id: string;
	sourceId: string;
	proxyUrl: string;
	width: number;
	height: number;
	createdAt: number;
	accessedAt: number;
}

export interface ProxyGenerationProgress {
	current: number;
	total: number;
	percent: number;
	eta: number;
}

const DEFAULT_CONFIG: ProxyConfig = {
	maxResolution: { width: 960, height: 540 },
	quality: 0.8,
	format: "webp",
	cacheLocation: "opfs",
};

export class ProxyManager {
	private config: ProxyConfig;
	private cache: Map<string, ProxyEntry> = new Map();
	private isGenerating = false;

	constructor(config: Partial<ProxyConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	async generateProxy(
		sourceId: string,
		video: HTMLVideoElement,
		onProgress?: (progress: ProxyGenerationProgress) => void,
	): Promise<ProxyEntry> {
		const existing = this.cache.get(sourceId);
		if (existing) {
			existing.accessedAt = Date.now();
			return existing;
		}

		this.isGenerating = true;
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get canvas context");

		const { width, height } = this.calculateProxySize(video.videoWidth, video.videoHeight);
		canvas.width = width;
		canvas.height = height;

		const duration = video.duration;
		const interval = 1;
		const totalFrames = Math.ceil(duration / interval);
		const frames: ProxyEntry[] = [];

		for (let i = 0; i <= totalFrames; i++) {
			if (!this.isGenerating) break;

			video.currentTime = Math.min(i * interval, duration - 0.01);
			await new Promise<void>((resolve) => {
				video.addEventListener("seeked", () => resolve(), { once: true });
			});

			ctx.drawImage(video, 0, 0, width, height);
			const dataUrl = canvas.toDataURL(`image/${this.config.format}`, this.config.quality);

			const entry: ProxyEntry = {
				id: `proxy-${sourceId}-${i}`,
				sourceId,
				proxyUrl: dataUrl,
				width,
				height,
				createdAt: Date.now(),
				accessedAt: Date.now(),
			};

			frames.push(entry);
			this.cache.set(entry.id, entry);

			onProgress?.({
				current: i + 1,
				total: totalFrames + 1,
				percent: ((i + 1) / (totalFrames + 1)) * 100,
				eta: ((totalFrames - i) * 0.5),
			});

			if (i % 5 === 0) {
				await new Promise(r => setTimeout(r, 0));
			}
		}

		this.isGenerating = false;
		return frames[0];
	}

	getProxy(sourceId: string): ProxyEntry | undefined {
		return this.cache.get(sourceId);
	}

	getAllProxies(): ProxyEntry[] {
		return Array.from(this.cache.values());
	}

	clearCache(): void {
		this.cache.clear();
	}

	evictOldProxies(maxAgeMs: number = 86400000): void {
		const now = Date.now();
		for (const [id, entry] of this.cache) {
			if (now - entry.accessedAt > maxAgeMs) {
				this.cache.delete(id);
			}
		}
	}

	cancelGeneration(): void {
		this.isGenerating = false;
	}

	private calculateProxySize(sourceWidth: number, sourceHeight: number): { width: number; height: number } {
		const { width: maxWidth, height: maxHeight } = this.config.maxResolution;

		if (sourceWidth <= maxWidth && sourceHeight <= maxHeight) {
			return { width: sourceWidth, height: sourceHeight };
		}

		const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
		return {
			width: Math.round(sourceWidth * scale),
			height: Math.round(sourceHeight * scale),
		};
	}

	updateConfig(config: Partial<ProxyConfig>): void {
		this.config = { ...this.config, ...config };
	}

	getConfig(): ProxyConfig {
		return { ...this.config };
	}
}

export const proxyManager = new ProxyManager();
