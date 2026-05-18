export interface RenderWorkerMessage {
	type: "init" | "render-frame" | "update-texture" | "shutdown";
}

export interface RenderWorkerResponse {
	type: "ready" | "frame-complete" | "error" | "shutdown-complete";
}

export interface RenderFrameRequest extends RenderWorkerMessage {
	type: "render-frame";
	frameId: string;
	time: number;
	canvasWidth: number;
	canvasHeight: number;
	layers: RenderLayer[];
	effects: RenderEffect[];
}

export interface RenderLayer {
	id: string;
	type: "video" | "image" | "text" | "shape";
	startTime: number;
	duration: number;
	opacity: number;
	blendMode: string;
	transform: {
		x: number;
		y: number;
		scaleX: number;
		scaleY: number;
		rotation: number;
	};
	source?: string;
	content?: string;
}

export interface RenderEffect {
	type: string;
	params: Record<string, unknown>;
}

class OffscreenRenderer {
	private worker: Worker | null = null;
	private isReady = false;
	private renderQueue: Array<{
		request: RenderFrameRequest;
		resolve: (result: ImageBitmap) => void;
		reject: (error: Error) => void;
	}> = [];
	private isProcessing = false;

	async initialize(): Promise<void> {
		if (typeof OffscreenCanvas === "undefined") {
			throw new Error("OffscreenCanvas not supported");
		}

		this.worker = new Worker(
			new URL("./render-worker.ts", import.meta.url),
			{ type: "module" },
		);

		return new Promise((resolve, reject) => {
			this.worker!.onmessage = (event: MessageEvent) => {
				if (event.data.type === "ready") {
					this.isReady = true;
					resolve();
				} else if (event.data.type === "error") {
					reject(new Error(event.data.message));
				}
			};

			this.worker!.postMessage({ type: "init" });
		});
	}

	async renderFrame(request: RenderFrameRequest): Promise<ImageBitmap> {
		if (!this.worker || !this.isReady) {
			throw new Error("Renderer not initialized");
		}

		return new Promise((resolve, reject) => {
			this.renderQueue.push({ request, resolve, reject });
			this.processQueue();
		});
	}

	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.renderQueue.length === 0) return;

		this.isProcessing = true;

		while (this.renderQueue.length > 0) {
			const { request, resolve, reject } = this.renderQueue.shift()!;

			try {
				const result = await this.sendRenderRequest(request);
				resolve(result);
			} catch (error) {
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		}

		this.isProcessing = false;
	}

	private sendRenderRequest(request: RenderFrameRequest): Promise<ImageBitmap> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error("Worker not available"));
				return;
			}

			const transfer = new OffscreenCanvas(request.canvasWidth, request.canvasHeight);

			this.worker.onmessage = (event: MessageEvent) => {
				if (event.data.type === "frame-complete") {
					resolve(event.data.imageBitmap);
				} else if (event.data.type === "error") {
					reject(new Error(event.data.message));
				}
			};

			this.worker.postMessage(
				{ ...request, canvas: transfer },
				[transfer],
			);
		});
	}

	async shutdown(): Promise<void> {
		if (this.worker) {
			this.worker.postMessage({ type: "shutdown" });
			this.worker.terminate();
			this.worker = null;
			this.isReady = false;
		}
	}
}

export const offscreenRenderer = new OffscreenRenderer();
