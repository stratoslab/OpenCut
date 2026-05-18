export interface ProgressState {
	completedFrames: number;
	totalFrames: number;
	percentage: number;
	etaSeconds: number;
	fps: number;
	status: "running" | "paused" | "completed" | "cancelled" | "error";
}

export class ProgressTracker {
	private frameTimes: number[] = [];
	private completed = 0;
	private total: number;
	private status: ProgressState["status"] = "running";

	constructor(totalFrames: number) {
		this.total = totalFrames;
	}

	recordFrame(timeMs: number): void {
		this.frameTimes.push(timeMs);
		if (this.frameTimes.length > 30) this.frameTimes.shift();
		this.completed++;
	}

	getProgress(): ProgressState {
		const percentage = this.total > 0 ? (this.completed / this.total) * 100 : 0;
		const etaSeconds = this.getETA();
		const fps = this.getCurrentFps();

		return {
			completedFrames: this.completed,
			totalFrames: this.total,
			percentage: Math.min(percentage, 100),
			etaSeconds,
			fps,
			status: this.status,
		};
	}

	getETA(): number {
		if (this.frameTimes.length === 0) return Infinity;
		const avgTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
		const remaining = this.total - this.completed;
		return (remaining * avgTime) / 1000;
	}

	getCurrentFps(): number {
		if (this.frameTimes.length === 0) return 0;
		const avgTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
		return avgTime > 0 ? 1000 / avgTime : 0;
	}

	complete(): void {
		this.status = "completed";
	}

	cancel(): void {
		this.status = "cancelled";
	}

	error(): void {
		this.status = "error";
	}
}
