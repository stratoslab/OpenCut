export interface SegmentationMask {
	id: string;
	width: number;
	height: number;
	data: Uint8Array;
	objectId: string;
	confidence: number;
	timestamp: number;
}

export interface SegmentationResult {
	masks: SegmentationMask[];
	objectLabels: string[];
	processingTime: number;
}

export interface SegmentationOptions {
	numObjects?: number;
	minObjectSize?: number;
	threshold?: number;
	signal?: AbortSignal;
}

const DEFAULT_OPTIONS: SegmentationOptions = {
	numObjects: 3,
	minObjectSize: 100,
	threshold: 0.5,
};

export class SegmentationService {
	async segmentFrame(
		imageData: ImageData,
		options: SegmentationOptions = {},
	): Promise<SegmentationResult> {
		const opts = { ...DEFAULT_OPTIONS, ...options };
		const start = performance.now();

		const { width, height, data } = imageData;
		const masks: SegmentationMask[] = [];

		const colorClusters = this.kMeansColorClustering(data, width, height, opts.numObjects);

		for (let i = 0; i < colorClusters.length; i++) {
			if (opts.signal?.aborted) break;

			const mask = this.createMaskFromCluster(colorClusters[i], width, height, opts);
			if (mask && mask.confidence >= opts.threshold) {
				masks.push(mask);
			}
		}

		const processingTime = performance.now() - start;

		return {
			masks,
			objectLabels: masks.map((_, i) => `Object ${i + 1}`),
			processingTime,
		};
	}

	async segmentVideo(
		video: HTMLVideoElement,
		times: number[],
		options: SegmentationOptions = {},
		onProgress?: (progress: number) => void,
	): Promise<Map<number, SegmentationResult>> {
		const results = new Map<number, SegmentationResult>();
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d", { willReadFrequently: true });

		if (!ctx) {
			throw new Error("Failed to get canvas context");
		}

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		for (let i = 0; i < times.length; i++) {
			if (options.signal?.aborted) break;

			video.currentTime = times[i];
			await new Promise<void>((resolve) => {
				video.addEventListener("seeked", () => resolve(), { once: true });
			});

			ctx.drawImage(video, 0, 0);
			const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);

			const result = await this.segmentFrame(frameData, options);
			results.set(i, result);

			onProgress?.(((i + 1) / times.length) * 100);

			if (i % 5 === 0) {
				await new Promise((r) => setTimeout(r, 0));
			}
		}

		return results;
	}

	maskToImageData(mask: SegmentationMask): ImageData {
		const imageData = new ImageData(mask.width, mask.height);
		for (let i = 0; i < mask.data.length; i++) {
			const value = mask.data[i];
			imageData.data[i * 4] = value;
			imageData.data[i * 4 + 1] = value;
			imageData.data[i * 4 + 2] = value;
			imageData.data[i * 4 + 3] = value > 0 ? 255 : 0;
		}
		return imageData;
	}

	maskToDataURL(mask: SegmentationMask): string {
		const imageData = this.maskToImageData(mask);
		const canvas = document.createElement("canvas");
		canvas.width = mask.width;
		canvas.height = mask.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return "";
		ctx.putImageData(imageData, 0, 0);
		return canvas.toDataURL("image/png");
	}

	private kMeansColorClustering(
		data: Uint8ClampedArray,
		width: number,
		height: number,
		k: number,
		maxIterations = 10,
	): Array<{ clusterId: number; pixels: number[]; center: number[] }> {
		const pixelCount = width * height;
		const assignments = new Int32Array(pixelCount);
		const centers: number[][] = [];

		for (let i = 0; i < k; i++) {
			const idx = Math.floor(Math.random() * pixelCount) * 4;
			centers.push([data[idx], data[idx + 1], data[idx + 2]]);
		}

		for (let iter = 0; iter < maxIterations; iter++) {
			let changed = false;

			for (let p = 0; p < pixelCount; p++) {
				const idx = p * 4;
				const r = data[idx], g = data[idx + 1], b = data[idx + 2];

				let minDist = Infinity;
				let closestCluster = 0;

				for (let c = 0; c < k; c++) {
					const dr = r - centers[c][0];
					const dg = g - centers[c][1];
					const db = b - centers[c][2];
					const dist = dr * dr + dg * dg + db * db;

					if (dist < minDist) {
						minDist = dist;
						closestCluster = c;
					}
				}

				if (assignments[p] !== closestCluster) {
					assignments[p] = closestCluster;
					changed = true;
				}
			}

			if (!changed) break;

			const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
			for (let p = 0; p < pixelCount; p++) {
				const idx = p * 4;
				const c = assignments[p];
				sums[c][0] += data[idx];
				sums[c][1] += data[idx + 1];
				sums[c][2] += data[idx + 2];
				sums[c][3] += 1;
			}

			for (let c = 0; c < k; c++) {
				if (sums[c][3] > 0) {
					centers[c] = [
						sums[c][0] / sums[c][3],
						sums[c][1] / sums[c][3],
						sums[c][2] / sums[c][3],
					];
				}
			}
		}

		const clusters = Array.from({ length: k }, (_, i) => ({
			clusterId: i,
			pixels: [] as number[],
			center: centers[i],
		}));

		for (let p = 0; p < pixelCount; p++) {
			clusters[assignments[p]].pixels.push(p);
		}

		return clusters;
	}

	private createMaskFromCluster(
		cluster: { clusterId: number; pixels: number[]; center: number[] },
		width: number,
		height: number,
		options: Required<SegmentationOptions>,
	): SegmentationMask | null {
		if (cluster.pixels.length < options.minObjectSize) {
			return null;
		}

		const maskData = new Uint8Array(width * height);
		for (const p of cluster.pixels) {
			maskData[p] = 255;
		}

		const confidence = cluster.pixels.length / (width * height);

		return {
			id: `mask-${cluster.clusterId}-${crypto.randomUUID().slice(0, 8)}`,
			width,
			height,
			data: maskData,
			objectId: `object-${cluster.clusterId}`,
			confidence,
			timestamp: performance.now(),
		};
	}
}

export const segmentationService = new SegmentationService();
