export interface MultiOutputConfig {
	outputs: OutputTarget[];
	activeOutputId: string | null;
}

export interface OutputTarget {
	id: string;
	name: string;
	type: "preview" | "external-monitor" | "streaming" | "recording";
	canvas: HTMLCanvasElement | OffscreenCanvas | null;
	resolution: { width: number; height: number };
	enabled: boolean;
}

export class MultiOutputRouter {
	private outputs: Map<string, OutputTarget> = new Map();
	private activeOutputId: string | null = null;

	addOutput(target: OutputTarget): void {
		this.outputs.set(target.id, target);
		if (!this.activeOutputId) {
			this.activeOutputId = target.id;
		}
	}

	removeOutput(outputId: string): void {
		this.outputs.delete(outputId);
		if (this.activeOutputId === outputId) {
			const next = this.outputs.keys().next().value;
			this.activeOutputId = next ?? null;
		}
	}

	setActiveOutput(outputId: string): void {
		if (this.outputs.has(outputId)) {
			this.activeOutputId = outputId;
		}
	}

	getActiveOutput(): OutputTarget | null {
		if (!this.activeOutputId) return null;
		return this.outputs.get(this.activeOutputId) ?? null;
	}

	getAllOutputs(): OutputTarget[] {
		return Array.from(this.outputs.values());
	}

	async renderToAll(frameData: ImageBitmap): Promise<void> {
		for (const output of this.outputs.values()) {
			if (!output.enabled || !output.canvas) continue;

			const ctx = output.canvas.getContext("2d");
			if (!ctx) continue;

			output.canvas.width = output.resolution.width;
			output.canvas.height = output.resolution.height;
			ctx.drawImage(frameData, 0, 0, output.resolution.width, output.resolution.height);
		}
	}

	async renderToOutput(outputId: string, frameData: ImageBitmap): Promise<void> {
		const output = this.outputs.get(outputId);
		if (!output || !output.enabled || !output.canvas) return;

		const ctx = output.canvas.getContext("2d");
		if (!ctx) return;

		output.canvas.width = output.resolution.width;
		output.canvas.height = output.resolution.height;
		ctx.drawImage(frameData, 0, 0, output.resolution.width, output.resolution.height);
	}

	toggleOutput(outputId: string): void {
		const output = this.outputs.get(outputId);
		if (output) {
			output.enabled = !output.enabled;
		}
	}
}

export const multiOutputRouter = new MultiOutputRouter();
