import { describe, it, expect } from "bun:test";
import { ProgressTracker } from "../progress-tracker";

describe("ProgressTracker", () => {
	it("tracks progress correctly", () => {
		const tracker = new ProgressTracker(100);

		for (let i = 0; i < 50; i++) {
			tracker.recordFrame(100);
		}

		const progress = tracker.getProgress();
		expect(progress.completedFrames).toBe(50);
		expect(progress.totalFrames).toBe(100);
		expect(progress.percentage).toBe(50);
	});

	it("calculates ETA based on rolling average", () => {
		const tracker = new ProgressTracker(100);

		// Record 30 frames at 100ms each
		for (let i = 0; i < 30; i++) {
			tracker.recordFrame(100);
		}

		const eta = tracker.getETA();
		// 70 remaining frames * 100ms = 7000ms = 7s
		expect(eta).toBeCloseTo(7, 0);
	});

	it("calculates current FPS", () => {
		const tracker = new ProgressTracker(100);

		// Record frames at 50ms each (20 fps)
		for (let i = 0; i < 10; i++) {
			tracker.recordFrame(50);
		}

		const fps = tracker.getCurrentFps();
		expect(fps).toBeCloseTo(20, 0);
	});

	it("returns 0 FPS when no frames recorded", () => {
		const tracker = new ProgressTracker(100);
		expect(tracker.getCurrentFps()).toBe(0);
	});

	it("returns Infinity ETA when no frames recorded", () => {
		const tracker = new ProgressTracker(100);
		expect(tracker.getETA()).toBe(Infinity);
	});

	it("caps percentage at 100%", () => {
		const tracker = new ProgressTracker(10);

		for (let i = 0; i < 15; i++) {
			tracker.recordFrame(100);
		}

		const progress = tracker.getProgress();
		expect(progress.percentage).toBe(100);
	});

	it("updates status correctly", () => {
		const tracker = new ProgressTracker(100);
		expect(tracker.getProgress().status).toBe("running");

		tracker.complete();
		expect(tracker.getProgress().status).toBe("completed");

		const tracker2 = new ProgressTracker(100);
		tracker2.cancel();
		expect(tracker2.getProgress().status).toBe("cancelled");

		const tracker3 = new ProgressTracker(100);
		tracker3.error();
		expect(tracker3.getProgress().status).toBe("error");
	});

	it("uses rolling window of last 30 frames", () => {
		const tracker = new ProgressTracker(100);

		// Record 50 frames: first 20 at 200ms, next 30 at 50ms
		for (let i = 0; i < 20; i++) {
			tracker.recordFrame(200);
		}
		for (let i = 0; i < 30; i++) {
			tracker.recordFrame(50);
		}

		// ETA should be based on last 30 frames (50ms each)
		const eta = tracker.getETA();
		// 50 remaining * 50ms = 2500ms = 2.5s
		expect(eta).toBeCloseTo(2.5, 0);
	});
});
