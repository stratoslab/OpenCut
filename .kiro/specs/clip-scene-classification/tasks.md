# Implementation Plan: CLIP Visual Scene Classification

## Overview

Integrate `Xenova/clip-vit-base-patch32` into OpenCut's `apps/web-vite/` SPA via a dedicated
Web Worker, a Zustand store, additive methods on `SceneClassifier` and `BrollAnalyzer`, and
opt-in UI controls in `SceneDetectPanel`. All inference runs in-browser; existing public
interfaces are untouched.

## Tasks

- [x] 1. Implement the CLIP Web Worker (`src/ai/clip-worker.ts`)
  - [x] 1.1 Define the typed message protocol and worker skeleton
    - Create `src/ai/clip-worker.ts` as a module worker
    - Export `WorkerMessage` and `WorkerResponse` discriminated union types as specified in the design
    - Add `MODEL_ID = "Xenova/clip-vit-base-patch32"` constant
    - Declare module-level `model` and `processor` variables (initially `null`)
    - Wire `self.onmessage` dispatcher that routes to `load`, `embedImage`, `embedTexts` handlers
    - Guard: if `model` is null when an inference message arrives, post `{ type: "error", message: "Model not loaded" }`
    - _Requirements: 1.1, 1.8_

  - [x] 1.2 Implement the `load()` function with WebGPU → WASM fallback and progress tracking
    - Import `CLIPModel`, `CLIPProcessor`, `env` from `@huggingface/transformers`
    - Try `device: "webgpu"` first; if `navigator.gpu` is absent or `requestAdapter()` returns null, fall back to `device: "wasm"`
    - Track per-file `{ loaded, total }` in a `Map`; on each progress callback recompute `overallPercent = totalLoaded / totalBytes * 100` and post `{ type: "progress", progress }`
    - On success post `{ type: "ready" }`; on failure post `{ type: "error", message }`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 1.3 Implement `embedImage()` and `embedTexts()` inference handlers
    - `embedImage`: run `processor(imageData)` → `model(inputs)` → extract `image_embeds` (shape `[1, 512]`) → `l2Normalize(Array.from(image_embeds.data))` → post `embedImageResult`
    - `embedTexts`: run `processor(null, { text: texts, padding: true, truncation: true })` → `model(inputs)` → extract `text_embeds` (shape `[n, 512]`) → chunk into rows of 512 → `l2Normalize` each → post `embedTextsResult`
    - Implement `l2Normalize(v: number[]): number[]` as a pure helper exported from the module
    - _Requirements: 1.6, 1.7, 1.9_

- [x] 2. Implement the CLIP Zustand store (`src/ai/clip-store.ts`)
  - [x] 2.1 Define store state, `LABEL_PROMPTS`, and pure math helpers
    - Create `src/ai/clip-store.ts`
    - Export `ModelStage` union type: `"idle" | "checking" | "downloading" | "loading" | "ready" | "error"`
    - Export `LABEL_PROMPTS: Record<SceneCategory, string>` with all 9 entries from the design
    - Export pure helpers: `cosineSimilarity`, `softmax`, `argmax` (implementations from design)
    - Define `ClipModelState` and `ClipModelStore` interfaces
    - Initialise store with `stage: "idle"`, `progress: 0`, `error: null`, `worker: null`
    - Declare module-level `pending: Map<string, { resolve, reject }>` (not in Zustand state)
    - _Requirements: 2.1, 2.2, 3.5_

  - [x] 2.2 Implement `loadModel()` and worker message dispatch
    - `loadModel()`: reuse existing worker if present; otherwise `new Worker(new URL("./clip-worker.ts", import.meta.url), { type: "module" })`
    - Wire `worker.onmessage` to dispatch on `WorkerResponse.type`: update `progress`, set `stage: "ready"` on ready, set `stage: "error"` + reject all pending promises on error
    - Set `stage: "downloading"`, `progress: 0`, `error: null` then post `{ type: "load" }`
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [x] 2.3 Implement `embedImage()`, `embedTexts()`, and `terminateWorker()`
    - `embedImage` / `embedTexts`: reject immediately if `stage !== "ready"`; otherwise generate `id = crypto.randomUUID()`, register in `pending`, post message to worker, resolve/reject when result arrives
    - `terminateWorker()`: call `worker.terminate()`, reject all pending promises with "Worker terminated", clear `pending`, reset `stage: "idle"`
    - _Requirements: 2.7, 2.8, 2.9, 2.10_

  - [x] 2.4 Implement `classifyFrame()`
    - Call `embedImage` and `embedTexts(Object.values(LABEL_PROMPTS))` in parallel via `Promise.all`
    - Compute `scores = textEmbs.map(t => cosineSimilarity(imgEmb, t))`
    - Apply `softmax(scores, 1.0)` → `argmax` → look up `SceneCategory` from `Object.keys(LABEL_PROMPTS)`
    - Return `{ category, confidence: probs[best] }`
    - Reject immediately if `stage !== "ready"`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [ ]* 2.5 Write unit tests for `clip-store.ts` (`src/ai/__tests__/clip-store.test.ts`)
    - Store initialises with `stage: "idle"`, `progress: 0`, `error: null`
    - `loadModel()` sets `stage: "downloading"` and posts `{ type: "load" }` to worker
    - Simulated `ready` message sets `stage: "ready"` and `progress: 100`
    - Simulated `progress` message updates `progress` field
    - `terminateWorker()` terminates worker and resets `stage: "idle"`
    - `LABEL_PROMPTS` contains exactly 9 entries with the specified strings
    - `embedImage` / `embedTexts` / `classifyFrame` reject when `stage !== "ready"`
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.9, 2.10, 3.5, 3.6_

  - [ ]* 2.6 Write property-based tests for pure helpers (`src/ai/__tests__/clip-store.properties.test.ts`)
    - **Property 1: Progress values are always in [0, 100]**
      - Use `fc.array(fc.record({ loaded: fc.nat(), total: fc.nat({ min: 1 }) }), { minLength: 1 })`
      - Assert `overallPercent = totalLoaded / totalBytes * 100` is in `[0, 100]`
      - **Validates: Requirements 1.3**
    - **Property 6: Softmax output sums to 1 and each value is in [0, 1]**
      - Use `fc.array(fc.float({ min: -1, max: 1 }), { minLength: 9, maxLength: 9 })`
      - Assert all elements in `[0, 1]` and sum within `1e-6` of 1.0
      - **Validates: Requirements 3.4**
    - **Property 10: `scoreFrameRelevance` output is always in [0, 1]**
      - Use `fc.float({ min: -1, max: 1 })` as a mock cosine similarity value
      - Assert `(sim + 1) / 2` is in `[0, 1]`
      - **Validates: Requirements 5.2**
    - **Property 11: `scoreFrameRelevance` maps cosine similarity linearly from [-1, 1] to [0, 1]**
      - Use `fc.float({ min: -1, max: 1 })`
      - Assert `Math.abs(result - (sim + 1) / 2) < 1e-10`
      - **Validates: Requirements 5.3**
    - **Property 13: `enrichWithVisualConfidence` confidence update is correct**
      - Use `fc.float({ min: 0, max: 1 })`, `fc.float({ min: 0, max: 1 })`, `fc.boolean()`
      - Assert averaged when frame non-null, unchanged when null
      - **Validates: Requirements 5.7, 5.8**

- [ ] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add `classifyWithVision()` to `SceneClassifier` (`src/ai/scene-classifier.ts`)
  - [ ] 4.1 Implement `classifyWithVision()` method
    - Add `async classifyWithVision(scenes: SceneChange[], frames: Map<string, ImageData>, transcript?: WordTranscript, videoDuration?: number): Promise<ClassifiedScene[]>` to the `SceneClassifier` class
    - If `useClipModelStore.getState().stage !== "ready"`, delegate to `this.classify(scenes, transcript, videoDuration)` and return
    - For each scene `i`: if `frames.has("scene-${i}")` call `store.classifyFrame(frame)` for `category` + `confidence`; otherwise fall back to `this.categorizeScene()` + `this.computeConfidence()`
    - Always derive `isHighlight` / `highlightReason` via the existing `this.isHighlightCandidate()` using the final `category`
    - Do NOT modify `classify()` or `generateHighlightReel()`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [ ] 5. Add visual relevance methods to `BrollAnalyzer` (`src/broll/broll-analyzer.ts`)
  - [ ] 5.1 Implement `scoreFrameRelevance()` and `enrichWithVisualConfidence()`
    - Add `async scoreFrameRelevance(frame: ImageData, query: string): Promise<number>` to `BrollAnalyzer`
      - If `useClipModelStore.getState().stage !== "ready"` return `0.5`
      - Otherwise `Promise.all([store.embedImage(frame), store.embedTexts([query])])` → `cosineSimilarity(imgEmb, textEmb)` → `(sim + 1) / 2`
    - Add `async enrichWithVisualConfidence(suggestions: BrollSuggestion[], getFrame: (startTime: number) => Promise<ImageData | null>): Promise<BrollSuggestion[]>` to `BrollAnalyzer`
      - Shallow-copy each suggestion; for each call `getFrame(s.startTime)`; if non-null call `scoreFrameRelevance` and set `s.confidence = (s.confidence + visual) / 2`; if null leave unchanged
    - Do NOT modify `analyze()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Integrate CLIP controls into `SceneDetectPanel` (`src/scene-detection/components/SceneDetectPanel.tsx`)
  - [ ] 7.1 Add `decodeDataUrl` helper and CLIP store subscriptions
    - Add `async function decodeDataUrl(dataUrl: string): Promise<ImageData>` inside the component file (Image + canvas pattern from design)
    - Subscribe to `useClipModelStore`: `clipStage`, `clipProgress`, `clipError`, `loadModel`
    - Add local state: `visionEnabled`, `classifiedScenes`, `isClassifying`, `classifyError`
    - _Requirements: 6.2, 6.9_

  - [ ] 7.2 Add model load / progress / error / retry UI elements
    - When `clipStage === "idle"`: render `<button onClick={() => loadModel()}>Load CLIP Model (~150 MB)</button>`
    - When `clipStage === "downloading" | "loading"`: render progress bar `<div style={{ width: \`${clipProgress}%\` }} />`
    - When `clipStage === "error"`: render `clipError` message and a "Retry" button calling `loadModel()`
    - Do NOT call `loadModel()` on mount
    - _Requirements: 6.6, 6.7, 6.8, 6.9_

  - [ ] 7.3 Add the "Visual Classification (CLIP)" toggle
    - Render `<input type="checkbox">` labelled "Visual Classification (CLIP)"
    - Disable the toggle when `clipStage !== "ready"`
    - _Requirements: 6.1_

  - [ ] 7.4 Wire post-detection `classifyWithVision` call and per-scene badges
    - Inside `handleDetect` (after `setScenes(results)`): if `visionEnabled && clipStage === "ready" && results.length > 0`, set `isClassifying: true`, decode each `afterThumbnail` via `decodeDataUrl`, build `frames: Map<string, ImageData>`, call `new SceneClassifier().classifyWithVision(results, frames)`, store result in `classifiedScenes`; catch errors into `classifyError`; always set `isClassifying: false` in finally
    - Disable the "Detect Scenes" button while `isClassifying` is true
    - Show inline error message when `classifyError` is set
    - Add per-scene category label and `★ highlight` badge to each scene card using `classifiedScenes[index]`
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- `classify()`, `generateHighlightReel()`, and `analyze()` are never modified — CLIP is purely additive
- The `pending` map lives at module scope (not in Zustand state) to avoid serialisation issues, matching the `useAiModelStore` pattern
- `decodeDataUrl` runs on the main thread; decoded `ImageData` is never stored beyond the classification call
- Property tests use `fast-check` (already a dev dependency); unit tests use `bun:test` matching the existing test pattern in `src/ai/__tests__/`
- `LABEL_PROMPTS` key order is the canonical index order for `embedTexts` results — `Record<SceneCategory, string>` enforces all 9 categories at compile time

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["1.3", "2.3"] },
    { "id": 3, "tasks": ["2.4"] },
    { "id": 4, "tasks": ["2.5", "2.6", "4.1", "5.1"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4"] }
  ]
}
```
