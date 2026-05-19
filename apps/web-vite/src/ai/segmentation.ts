import { backgroundRemovalService } from "@/background-removal/service";

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

export class SegmentationService {
	async segmentFrame(
		imageData: ImageData,
		options: SegmentationOptions = {},
	): Promise<SegmentationResult> {
		const start = performance.now();

		// Delegate to BackgroundRemovalService
		const blob = await backgroundRemovalService.removeBackground(imageData);

		// Decode the returned PNG Blob back to ImageData
		const bitmap = await createImageBitmap(blob);
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const ctx = canvas.getContext("2d")!;
		ctx.drawImage(bitmap, 0, 0);
		const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
		bitmap.close();

		// Extract alpha channel as Uint8Array mask
		const maskData = new Uint8Array(imgData.width * imgData.height);
		for (let i = 0; i < maskData.length; i++) {
			maskData[i] = imgData.data[i * 4 + 3]; // alpha channel
		}

		const mask: SegmentationMask = {
			id: `mask-foreground-${crypto.randomUUID().slice(0, 8)}`,
			width: imgData.width,
			height: imgData.height,
			data: maskData,
			objectId: "foreground",
			confidence: 1.0,
			timestamp: performance.now(),
		};

		const processingTime = performance.now() - start;

		return {
			masks: [mask],
			objectLabels: ["foreground"],
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

		if (times.length === 0) return results;

		// Extract frames at each timestamp using canvas
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d", { willReadFrequently: true });

		if (!ctx) {
			throw new Error("Failed to get canvas context");
		}

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		const frames: ImageData[] = [];

		for (let i = 0; i < times.length; i++) {
			if (options.signal?.aborted) break;

			video.currentTime = times[i];
			await new Promise<void>((resolve) => {
				video.addEventListener("seeked", () => resolve(), { once: true });
			});

			ctx.drawImage(video, 0, 0);
			frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
		}

		// Process all collected frames via BackgroundRemovalService
		const blobs = await backgroundRemovalService.removeBackgroundFromFrames(frames, {
			signal: options.signal,
			onProgress,
		});

		// Map each Blob result to a SegmentationResult
		for (let i = 0; i < blobs.length; i++) {
			const blob = blobs[i];
			const start = performance.now();

			const bitmap = await createImageBitmap(blob);
			const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
			const offCtx = offscreen.getContext("2d")!;
			offCtx.drawImage(bitmap, 0, 0);
			const imgData = offCtx.getImageData(0, 0, bitmap.width, bitmap.height);
			bitmap.close();

			const maskData = new Uint8Array(imgData.width * imgData.height);
			for (let j = 0; j < maskData.length; j++) {
				maskData[j] = imgData.data[j * 4 + 3];
			}

			const mask: SegmentationMask = {
				id: `mask-foreground-${crypto.randomUUID().slice(0, 8)}`,
				width: imgData.width,
				height: imgData.height,
				data: maskData,
				objectId: "foreground",
				confidence: 1.0,
				timestamp: performance.now(),
			};

			results.set(i, {
				masks: [mask],
				objectLabels: ["foreground"],
				processingTime: performance.now() - start,
			});
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
}

export const segmentationService = new SegmentationService();
