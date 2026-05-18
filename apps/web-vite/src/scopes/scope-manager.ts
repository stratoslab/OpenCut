export interface HistogramData {
	red: Uint32Array;
	green: Uint32Array;
	blue: Uint32Array;
	luminance: Uint32Array;
}

export class ScopeManager {
	private histogramBuffer: Uint32Array | null = null;
	private vectorscopeCanvas: OffscreenCanvas | null = null;
	private waveformCanvas: OffscreenCanvas | null = null;
	private activeScopes = new Set<"histogram" | "vectorscope" | "waveform">();

	constructor() {
		this.histogramBuffer = new Uint32Array(1024);
		this.vectorscopeCanvas = new OffscreenCanvas(256, 256);
		this.waveformCanvas = new OffscreenCanvas(1920, 128);
	}

	setActiveScopes(scopes: Set<"histogram" | "vectorscope" | "waveform">): void {
		this.activeScopes = scopes;
	}

	hasScope(scope: "histogram" | "vectorscope" | "waveform"): boolean {
		return this.activeScopes.has(scope);
	}

	clearHistogram(): void {
		if (this.histogramBuffer) {
			this.histogramBuffer.fill(0);
		}
	}

	getHistogramData(): HistogramData | null {
		if (!this.histogramBuffer) return null;
		return {
			red: this.histogramBuffer.slice(0, 256),
			green: this.histogramBuffer.slice(256, 512),
			blue: this.histogramBuffer.slice(512, 768),
			luminance: this.histogramBuffer.slice(768, 1024),
		};
	}

	getVectorscopeCanvas(): OffscreenCanvas | null {
		return this.vectorscopeCanvas;
	}

	getWaveformCanvas(): OffscreenCanvas | null {
		return this.waveformCanvas;
	}

	clearWaveform(): void {
		if (this.waveformCanvas) {
			const ctx = this.waveformCanvas.getContext("2d");
			if (ctx) {
				ctx.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);
			}
		}
	}

	clearVectorscope(): void {
		if (this.vectorscopeCanvas) {
			const ctx = this.vectorscopeCanvas.getContext("2d");
			if (ctx) {
				ctx.clearRect(0, 0, this.vectorscopeCanvas.width, this.vectorscopeCanvas.height);
			}
		}
	}
}
