interface VideoSinkData {
	video: HTMLVideoElement;
	url: string;
	width: number;
	height: number;
	duration: number;
	lastTime: number;
}

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();

	async getFrameAt({
		mediaId,
		file,
		time,
	}: {
		mediaId: string;
		file: File;
		time: number;
	}): Promise<HTMLCanvasElement | null> {
		await this.ensureSink({ mediaId, file });

		const sinkData = this.sinks.get(mediaId);
		if (!sinkData) return null;

		return this.seekToTime({ sinkData, time });
	}

	private async seekToTime({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<HTMLCanvasElement | null> {
		try {
			const video = sinkData.video;
			video.currentTime = Math.max(0, Math.min(time, sinkData.duration));

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error("Seek timeout")), 5000);
				video.onseeked = () => {
					clearTimeout(timeout);
					resolve();
				};
				video.onerror = () => {
					clearTimeout(timeout);
					reject(new Error("Video error during seek"));
				};
			});

			const canvas = document.createElement("canvas");
			canvas.width = sinkData.width;
			canvas.height = sinkData.height;
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.drawImage(video, 0, 0, sinkData.width, sinkData.height);
			}

			sinkData.lastTime = time;
			return canvas;
		} catch (error) {
			console.warn("Failed to seek video:", error);
			return null;
		}
	}

	private async ensureSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		if (this.sinks.has(mediaId)) return;

		if (this.initPromises.has(mediaId)) {
			await this.initPromises.get(mediaId);
			return;
		}

		const initPromise = this.initializeSink({ mediaId, file });
		this.initPromises.set(mediaId, initPromise);

		try {
			await initPromise;
		} finally {
			this.initPromises.delete(mediaId);
		}
	}

	private async initializeSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		const url = URL.createObjectURL(file);
		const video = document.createElement("video");
		video.preload = "auto";
		video.muted = true;
		video.src = url;

		await new Promise<void>((resolve, reject) => {
			video.onloadedmetadata = () => resolve();
			video.onerror = () => reject(new Error("Failed to load video"));
		});

		this.sinks.set(mediaId, {
			video,
			url,
			width: video.videoWidth,
			height: video.videoHeight,
			duration: video.duration,
			lastTime: -1,
		});
	}

	clearVideo({ mediaId }: { mediaId: string }): void {
		const sinkData = this.sinks.get(mediaId);
		if (sinkData) {
			sinkData.video.pause();
			sinkData.video.src = "";
			URL.revokeObjectURL(sinkData.url);
			this.sinks.delete(mediaId);
		}

		this.initPromises.delete(mediaId);
	}

	clearAll(): void {
		for (const [mediaId] of this.sinks) {
			this.clearVideo({ mediaId });
		}
	}

	getStats() {
		return {
			totalSinks: this.sinks.size,
		};
	}
}

export const videoCache = new VideoCache();
