import { describe, it, expect, beforeEach, mock } from "bun:test";

// ─── Mock Worker ──────────────────────────────────────────────────────────────
// We need to mock the Worker global before importing the store so that
// `new Worker(...)` inside loadModel() uses our fake.

let mockWorkerInstance: {
  postMessage: ReturnType<typeof mock>;
  terminate: ReturnType<typeof mock>;
  onmessage: ((event: MessageEvent) => void) | null;
};

// Replace the global Worker constructor with a factory that captures the instance.
(globalThis as unknown as Record<string, unknown>).Worker = class MockWorker {
  postMessage: ReturnType<typeof mock>;
  terminate: ReturnType<typeof mock>;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor() {
    this.postMessage = mock(() => {});
    this.terminate = mock(() => {});
    // Capture the most-recently created instance for test assertions.
    mockWorkerInstance = this as unknown as typeof mockWorkerInstance;
  }
};

// ─── Import store AFTER mocking Worker ───────────────────────────────────────
import {
  useClipModelStore,
  LABEL_PROMPTS,
  cosineSimilarity,
  softmax,
  argmax,
} from "../clip-store";

// Helper: fire a synthetic worker message into the store's onmessage handler.
function fireWorkerMessage(data: unknown) {
  if (mockWorkerInstance?.onmessage) {
    mockWorkerInstance.onmessage({ data } as MessageEvent);
  }
}

// Reset the store to its initial state between tests.
function resetStore() {
  useClipModelStore.setState({
    stage: "idle",
    progress: 0,
    error: null,
    worker: null,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useClipModelStore — initial state", () => {
  beforeEach(resetStore);

  it("initialises with stage: 'idle', progress: 0, error: null", () => {
    const state = useClipModelStore.getState();
    expect(state.stage).toBe("idle");
    expect(state.progress).toBe(0);
    expect(state.error).toBeNull();
  });
});

describe("useClipModelStore — loadModel()", () => {
  beforeEach(resetStore);

  it("sets stage to 'downloading' after loadModel()", () => {
    useClipModelStore.getState().loadModel();
    expect(useClipModelStore.getState().stage).toBe("downloading");
  });

  it("posts { type: 'load' } to the worker", () => {
    useClipModelStore.getState().loadModel();
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ type: "load" });
  });

  it("resets progress to 0 and clears error on loadModel()", () => {
    // Pre-set some state to verify it gets cleared.
    useClipModelStore.setState({ progress: 50, error: "previous error" });
    useClipModelStore.getState().loadModel();
    const state = useClipModelStore.getState();
    expect(state.progress).toBe(0);
    expect(state.error).toBeNull();
  });
});

describe("useClipModelStore — worker message handling", () => {
  beforeEach(() => {
    resetStore();
    // Spin up a worker so onmessage is wired.
    useClipModelStore.getState().loadModel();
  });

  it("simulated 'ready' message sets stage to 'ready' and progress to 100", () => {
    fireWorkerMessage({ type: "ready" });
    const state = useClipModelStore.getState();
    expect(state.stage).toBe("ready");
    expect(state.progress).toBe(100);
  });

  it("simulated 'progress' message updates the progress field", () => {
    fireWorkerMessage({ type: "progress", progress: 42 });
    expect(useClipModelStore.getState().progress).toBe(42);
  });

  it("simulated 'error' message sets stage to 'error' and stores the message", () => {
    fireWorkerMessage({ type: "error", message: "download failed" });
    const state = useClipModelStore.getState();
    expect(state.stage).toBe("error");
    expect(state.error).toBe("download failed");
  });
});

describe("useClipModelStore — terminateWorker()", () => {
  beforeEach(() => {
    resetStore();
    useClipModelStore.getState().loadModel();
  });

  it("calls terminate() on the underlying worker", () => {
    useClipModelStore.getState().terminateWorker();
    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
  });

  it("resets stage to 'idle' after termination", () => {
    // First advance to ready so we can verify the reset.
    fireWorkerMessage({ type: "ready" });
    expect(useClipModelStore.getState().stage).toBe("ready");

    useClipModelStore.getState().terminateWorker();
    expect(useClipModelStore.getState().stage).toBe("idle");
  });

  it("sets worker to null after termination", () => {
    useClipModelStore.getState().terminateWorker();
    expect(useClipModelStore.getState().worker).toBeNull();
  });
});

describe("LABEL_PROMPTS", () => {
  it("contains exactly 9 entries", () => {
    expect(Object.keys(LABEL_PROMPTS)).toHaveLength(9);
  });

  it("contains all 9 expected SceneCategory keys", () => {
    const expectedKeys = [
      "talking-head",
      "b-roll",
      "action",
      "transition",
      "silent",
      "music",
      "intro",
      "outro",
      "unknown",
    ];
    for (const key of expectedKeys) {
      expect(LABEL_PROMPTS).toHaveProperty(key);
    }
  });

  it("has the correct prompt strings for each category", () => {
    expect(LABEL_PROMPTS["talking-head"]).toBe("a person talking directly to camera");
    expect(LABEL_PROMPTS["b-roll"]).toBe("cinematic b-roll footage of a scene or environment");
    expect(LABEL_PROMPTS["action"]).toBe("fast-paced action or movement sequence");
    expect(LABEL_PROMPTS["transition"]).toBe("a video transition or dissolve effect");
    expect(LABEL_PROMPTS["silent"]).toBe("a static or near-static scene with no movement");
    expect(LABEL_PROMPTS["music"]).toBe("a music performance or concert");
    expect(LABEL_PROMPTS["intro"]).toBe("an introduction title card or opening sequence");
    expect(LABEL_PROMPTS["outro"]).toBe("an outro, end card, or closing sequence");
    expect(LABEL_PROMPTS["unknown"]).toBe("an unclassifiable or ambiguous scene");
  });
});

describe("embedImage / embedTexts / classifyFrame — reject when stage !== 'ready'", () => {
  const nonReadyStages = ["idle", "checking", "downloading", "loading", "error"] as const;

  for (const stage of nonReadyStages) {
    it(`embedImage rejects when stage is '${stage}'`, async () => {
      resetStore();
      useClipModelStore.setState({ stage });
      const fakeImageData = {} as ImageData;
      await expect(
        useClipModelStore.getState().embedImage(fakeImageData)
      ).rejects.toThrow();
    });

    it(`embedTexts rejects when stage is '${stage}'`, async () => {
      resetStore();
      useClipModelStore.setState({ stage });
      await expect(
        useClipModelStore.getState().embedTexts(["hello"])
      ).rejects.toThrow();
    });

    it(`classifyFrame rejects when stage is '${stage}'`, async () => {
      resetStore();
      useClipModelStore.setState({ stage });
      const fakeImageData = {} as ImageData;
      await expect(
        useClipModelStore.getState().classifyFrame(fakeImageData)
      ).rejects.toThrow();
    });
  }
});

describe("pure math helpers", () => {
  describe("cosineSimilarity", () => {
    it("returns 1 for identical unit vectors", () => {
      const v = [1, 0, 0];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
    });

    it("returns 0 for orthogonal unit vectors", () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
    });

    it("returns -1 for opposite unit vectors", () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
    });
  });

  describe("softmax", () => {
    it("output sums to 1", () => {
      const probs = softmax([1, 2, 3]);
      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    });

    it("all values are in [0, 1]", () => {
      const probs = softmax([-1, 0, 1, 2]);
      for (const p of probs) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    });

    it("highest input gets highest probability", () => {
      const probs = softmax([1, 5, 2]);
      expect(argmax(probs)).toBe(1);
    });
  });

  describe("argmax", () => {
    it("returns the index of the maximum value", () => {
      expect(argmax([0.1, 0.7, 0.2])).toBe(1);
    });

    it("returns 0 for a single-element array", () => {
      expect(argmax([42])).toBe(0);
    });
  });
});
