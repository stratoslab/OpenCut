export interface TextureHandle {
	id: string;
	width: number;
	height: number;
	format: "rgba8" | "rgba16f" | "rgba32f";
	usage: "sampled" | "storage" | "render";
	refCount: number;
	lastUsed: number;
}

export interface BufferHandle {
	id: string;
	size: number;
	usage: "uniform" | "storage" | "vertex" | "index";
	refCount: number;
	lastUsed: number;
}

export interface GPUMemoryPoolOptions {
	maxTextureMemoryMB?: number;
	maxBufferMemoryMB?: number;
	maxIdleTimeMs?: number;
}

const DEFAULT_OPTIONS: Required<GPUMemoryPoolOptions> = {
	maxTextureMemoryMB: 512,
	maxBufferMemoryMB: 128,
	maxIdleTimeMs: 30000,
};

export class GPUMemoryPool {
	private textures: Map<string, TextureHandle> = new Map();
	private buffers: Map<string, BufferHandle> = new Map();
	private textureMemoryBytes = 0;
	private bufferMemoryBytes = 0;
	private options: Required<GPUMemoryPoolOptions>;

	constructor(options: GPUMemoryPoolOptions = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	allocateTexture(
		id: string,
		width: number,
		height: number,
		format: TextureHandle["format"] = "rgba8",
		usage: TextureHandle["usage"] = "sampled",
	): TextureHandle {
		const bytesPerPixel = this.getBytesPerPixel(format);
		const memoryBytes = width * height * bytesPerPixel;

		const existing = this.textures.get(id);
		if (existing) {
			existing.refCount++;
			existing.lastUsed = performance.now();
			return existing;
		}

		this.evictIfNeeded(memoryBytes, "texture");

		const handle: TextureHandle = {
			id,
			width,
			height,
			format,
			usage,
			refCount: 1,
			lastUsed: performance.now(),
		};

		this.textures.set(id, handle);
		this.textureMemoryBytes += memoryBytes;

		return handle;
	}

	allocateBuffer(
		id: string,
		size: number,
		usage: BufferHandle["usage"] = "uniform",
	): BufferHandle {
		const existing = this.buffers.get(id);
		if (existing) {
			existing.refCount++;
			existing.lastUsed = performance.now();
			return existing;
		}

		this.evictIfNeeded(size, "buffer");

		const handle: BufferHandle = {
			id,
			size,
			usage,
			refCount: 1,
			lastUsed: performance.now(),
		};

		this.buffers.set(id, handle);
		this.bufferMemoryBytes += size;

		return handle;
	}

	releaseTexture(id: string): void {
		const handle = this.textures.get(id);
		if (!handle) return;

		handle.refCount--;
		if (handle.refCount <= 0) {
			const bytesPerPixel = this.getBytesPerPixel(handle.format);
			this.textureMemoryBytes -= handle.width * handle.height * bytesPerPixel;
			this.textures.delete(id);
		}
	}

	releaseBuffer(id: string): void {
		const handle = this.buffers.get(id);
		if (!handle) return;

		handle.refCount--;
		if (handle.refCount <= 0) {
			this.bufferMemoryBytes -= handle.size;
			this.buffers.delete(id);
		}
	}

	getStats(): {
		textureCount: number;
		bufferCount: number;
		textureMemoryMB: number;
		bufferMemoryMB: number;
		totalMemoryMB: number;
	} {
		return {
			textureCount: this.textures.size,
			bufferCount: this.buffers.size,
			textureMemoryMB: this.textureMemoryBytes / (1024 * 1024),
			bufferMemoryMB: this.bufferMemoryBytes / (1024 * 1024),
			totalMemoryMB: (this.textureMemoryBytes + this.bufferMemoryBytes) / (1024 * 1024),
		};
	}

	cleanup(): void {
		const now = performance.now();
		const maxIdleTime = this.options.maxIdleTimeMs;

		for (const [id, handle] of this.textures) {
			if (handle.refCount === 0 && now - handle.lastUsed > maxIdleTime) {
				const bytesPerPixel = this.getBytesPerPixel(handle.format);
				this.textureMemoryBytes -= handle.width * handle.height * bytesPerPixel;
				this.textures.delete(id);
			}
		}

		for (const [id, handle] of this.buffers) {
			if (handle.refCount === 0 && now - handle.lastUsed > maxIdleTime) {
				this.bufferMemoryBytes -= handle.size;
				this.buffers.delete(id);
			}
		}
	}

	private evictIfNeeded(requiredBytes: number, type: "texture" | "buffer"): void {
		const maxBytes = type === "texture"
			? this.options.maxTextureMemoryMB * 1024 * 1024
			: this.options.maxBufferMemoryMB * 1024 * 1024;

		const currentBytes = type === "texture"
			? this.textureMemoryBytes
			: this.bufferMemoryBytes;

		if (currentBytes + requiredBytes <= maxBytes) return;

		if (type === "texture") {
			const sorted = Array.from(this.textures.values())
				.filter(h => h.refCount === 0)
				.sort((a, b) => a.lastUsed - b.lastUsed);

			for (const handle of sorted) {
				const bytesPerPixel = this.getBytesPerPixel(handle.format);
				const handleBytes = handle.width * handle.height * bytesPerPixel;
				this.textureMemoryBytes -= handleBytes;
				this.textures.delete(handle.id);

				if (this.textureMemoryBytes + requiredBytes <= maxBytes) break;
			}
		} else {
			const sorted = Array.from(this.buffers.values())
				.filter(h => h.refCount === 0)
				.sort((a, b) => a.lastUsed - b.lastUsed);

			for (const handle of sorted) {
				this.bufferMemoryBytes -= handle.size;
				this.buffers.delete(handle.id);

				if (this.bufferMemoryBytes + requiredBytes <= maxBytes) break;
			}
		}
	}

	private getBytesPerPixel(format: TextureHandle["format"]): number {
		switch (format) {
			case "rgba8": return 4;
			case "rgba16f": return 8;
			case "rgba32f": return 16;
		}
	}
}

export const gpuMemoryPool = new GPUMemoryPool();
