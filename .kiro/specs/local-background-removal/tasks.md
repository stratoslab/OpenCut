# Implementation Plan: Local Background Removal

## Overview

Replace `@imgly/background-removal` with a fully local, on-device engine built on `briaai/RMBG-1.4` via `@huggingface/transformers`. All inference runs inside a dedicated Web Worker with WebGPU-first / WASM-fallback device selection. Four new files are added under `src/background-removal/`, two existing files are updated, and the `@imgly` dependency is removed.

## Tasks

- [x] 1. Set up test infrastructure and worker type definitions
  - Install `vitest` and `fast-check` as dev dependencies in `apps/web-vite/package.json`
  - Add a `vitest.config.ts` at `apps/web-vite/` that targets `src/**/__tests__/**/*.test.ts` with jsdom environment
  - Add a `"test"` script to `apps/web-vite/package.json`: `"test": "vitest --run"`
  - Create `src/background-removal/types.ts` with the `WorkerMessage` and `WorkerResponse` discriminated unions exactly as specified in the design
    - `WorkerMessage`: `load | remove-background | cancel`
    - `WorkerResponse`: `device-selected | load-progress | load-retry | ready | result | cancelled | error`
    - `result` carries `id: string`, `alphaMask: Float32Array`, `width: number`, `height: number`
  - _Requirements: 2.2, 1.3_

- [ ] 2. Implement the BackgroundRemovalWorker
  - [x] 2.1 Create `src/background-removal/worker.ts`
    - Declare `MODEL_ID = "briaai/RMBG-1.4"`, `MAX_RETRIES = 5`, `BASE_DELAY = 2000` as named constants
    - Dynamically import `@huggingface/transformers`; set `env.allowLocalModels = false`
    - Wrap `env.fetch` with exponential-backoff retry (post `load-retry` on each attempt, `error` after exhaustion)
    - On `load` message: attempt `device: "webgpu"`, catch and fall back to `device: "wasm"`; post `device-selected` after device is determined
    - Load `AutoModel.from_pretrained` + `AutoProcessor.from_pretrained` with a `progress_callback` that aggregates byte-weighted progress across all shards and posts `load-progress` (integer [0, 100])
    - Post `ready` when model is fully loaded
    - On `remove-background` message: construct `RawImage(imageData.data, w, h, 4)`, run `processor(image)` → `model(inputs)`, extract `output[0].data as Float32Array`, post `result` with `alphaMask`, `width`, `height`
    - On `cancel` message: set cancellation flag, post `cancelled`
    - Register `self.addEventListener("unhandledrejection", ...)` and `self.addEventListener("error", ...)` to post `{ type: "error", error: string }`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 12.1, 12.2, 12.3_

- [ ] 3. Implement BackgroundRemovalService
  - [x] 3.1 Create `src/background-removal/service.ts` with the `BackgroundRemovalService` class
    - `setWorker(worker: Worker): void` — stores worker reference and attaches message handler that resolves pending requests from `pendingRequests` map
    - `private decodeFile(file: File): Promise<ImageData>` — draws file onto `OffscreenCanvas` (or `<canvas>` fallback), returns `getImageData`
    - `private resizeImageData(src: ImageData, maxDim: number): ImageData` — if `max(width, height) > maxDim`, scale down preserving aspect ratio using `OffscreenCanvas.drawImage`; otherwise return src unchanged
    - `private upscaleAlphaMask(mask, maskW, maskH, targetW, targetH): Float32Array` — nearest-neighbour interpolation
    - `private applyAlphaMask(original: ImageData, alphaMask: Float32Array): ImageData` — `alpha = Math.round(alphaMask[i] * 255)`, RGB copied unchanged
    - `private encodeAsPng(composited: ImageData): Promise<Blob>` — `OffscreenCanvas.convertToBlob({ type: "image/png" })` with `HTMLCanvasElement.toBlob` fallback
    - `private sendToWorker(imageData: ImageData): Promise<{ alphaMask: Float32Array; width: number; height: number }>` — generates `nanoid` request ID, stores resolver in `pendingRequests`, posts `remove-background` message, resolves on matching `result` response
    - Export singleton `backgroundRemovalService`
    - _Requirements: 5.2, 5.4, 5.5_

  - [-] 3.2 Implement `removeBackground(input: File | ImageData): Promise<Blob>` on `BackgroundRemovalService`
    - Decode `File` via `decodeFile` (pass `ImageData` through directly)
    - Downscale to ≤1024×1024 via `resizeImageData`
    - Call `sendToWorker`, receive `alphaMask` + inference dimensions
    - Upscale `alphaMask` back to original dimensions via `upscaleAlphaMask`
    - Composite via `applyAlphaMask`
    - Encode via `encodeAsPng` and return the `Blob`
    - Reject with `"Model not ready"` if worker is null
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [-] 3.3 Implement `removeBackgroundFromFrames(frames, options?): Promise<Blob[]>` on `BackgroundRemovalService`
    - Process frames sequentially (one at a time) to avoid GPU memory exhaustion
    - Check `signal?.aborted` before each frame; if aborted, resolve with results collected so far
    - Call `onProgress?.(Math.round(((framesCompleted) / totalFrames) * 100))` after each frame completes
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3_

- [x] 4. Implement BackgroundRemovalStore
  - [x] 4.1 Create `src/background-removal/store.ts`
    - Import `ModelStage` type from `@/ai/ai-model-store`
    - Define `BackgroundRemovalState`: `stage: ModelStage`, `progress: number`, `error: string | null`, `device: "webgpu" | "wasm" | null`, `worker: Worker | null`
    - Implement `initWorker()`: create `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`, attach message handler mapping `WorkerResponse` types to store state (see design table), call `backgroundRemovalService.setWorker(worker)`, post `{ type: "load" }`, set `stage: "downloading"`
    - Implement `terminateWorker()`: call `worker.terminate()`, set `worker: null`
    - Implement `loadModel()`: set `stage: "downloading"`, `progress: 0`, `error: null`, post `{ type: "load" }`
    - Implement `clearError()`: set `error: null`, set `stage: "idle"` if was `"error"`
    - Mirror the structural pattern of `src/ai/ai-model-store.ts` exactly
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [~] 5. Checkpoint — verify types, worker, service, and store compile
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Update BackgroundRemovalDialog to use local service
  - [~] 6.1 Rewrite `src/background-removal/components/BackgroundRemovalDialog.tsx`
    - Remove the dynamic `import("@imgly/background-removal")` call
    - Import `useBackgroundRemovalStore` from `../store` and `backgroundRemovalService` from `../service`
    - Call `useBackgroundRemovalStore` to read `stage`, `progress`, `error`, `device`; call `initWorker` on mount if `stage === "idle"`
    - When `stage === "downloading" || stage === "loading"`: show a progress bar with the current `progress` percentage value
    - When `stage === "error"`: show an error panel with a "Retry" button that calls `store.loadModel()`
    - Replace `imglyModule.removeBackground(imageFile)` with `backgroundRemovalService.removeBackground(imageFile)`
    - Preserve the existing before/after slider UX (the `sliderPosition` state and `clipPath` rendering) once result is available
    - Read existing component before editing to avoid overriding existing class applications
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 7. Update SegmentationService to delegate to BackgroundRemovalService
  - [~] 7.1 Rewrite `src/ai/segmentation.ts`
    - Import `backgroundRemovalService` from `@/background-removal/service`
    - Rewrite `segmentFrame(imageData, options)`: call `backgroundRemovalService.removeBackground(imageData)`, decode the returned PNG `Blob` back to `ImageData` via `createImageBitmap` + `OffscreenCanvas`, extract the alpha channel as `Uint8Array maskData`, return a `SegmentationResult` with a single `SegmentationMask` (`objectId: "foreground"`, `confidence: 1.0`)
    - Rewrite `segmentVideo(video, times, options, onProgress)`: extract frames at each timestamp using the existing canvas approach, collect into `ImageData[]`, call `backgroundRemovalService.removeBackgroundFromFrames(frames, { signal: options.signal, onProgress })`, map each `Blob` result to a `SegmentationResult` and return `Map<number, SegmentationResult>`
    - Delete `kMeansColorClustering` and `createMaskFromCluster` private methods
    - Preserve `SegmentationMask`, `SegmentationResult`, `SegmentationOptions` interfaces unchanged
    - Preserve `maskToImageData()` and `maskToDataURL()` utility methods unchanged
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [~] 8. Remove @imgly/background-removal dependency
  - Remove `@imgly/background-removal` from `apps/web-vite/package.json` (both `dependencies` and `devDependencies` if present)
  - Verify no `import` or `require` of `@imgly/background-removal` remains anywhere in `apps/web-vite/src/`
  - Confirm `@huggingface/transformers` is present in `dependencies` (it already is at `^3.8.1` — this is a no-op verification)
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 9. Write unit tests for BackgroundRemovalService pure functions
  - [~] 9.1 Create `src/background-removal/__tests__/service.test.ts`
    - Test `applyAlphaMask`: 2×2 `ImageData` with known pixel values; verify RGB channels are preserved and alpha equals `Math.round(mask[i] * 255)` for mask values 0.0, 0.5, and 1.0
    - Test `resizeImageData`: 2048×1024 input → assert output is 1024×512 (aspect ratio preserved, max dim = 1024)
    - Test `resizeImageData`: 512×512 input → assert output dimensions are unchanged (no upscaling)
    - Test `upscaleAlphaMask`: 2×2 mask upscaled to 4×4 → verify correct nearest-neighbour values
    - Test `removeBackgroundFromFrames` with abort: mock worker, abort after frame 2 of 5, assert exactly 2 blobs returned
    - _Requirements: 5.3, 5.5, 6.3_

- [ ] 10. Write property-based tests for BackgroundRemovalService
  - [ ]* 10.1 Write property test for `applyAlphaMask` RGB preservation (Property 1)
    - Generate random `ImageData` (arbitrary W, H, pixel values) and random `Float32Array` mask (values in [0, 1])
    - Assert every output pixel's RGB equals the input RGB and alpha equals `Math.round(mask[i] * 255)`
    - Tag: `// Feature: local-background-removal, Property 1: AlphaMask application preserves RGB channels`
    - **Property 1: AlphaMask application preserves RGB channels**
    - **Validates: Requirements 5.3**

  - [ ]* 10.2 Write property test for downscale/upscale pixel count (Property 2)
    - Generate random `(W, H)` pairs where `max(W, H) > 1024`
    - Downscale via `resizeImageData`, produce a synthetic mask of the downscaled size, upscale back via `upscaleAlphaMask`
    - Assert mask length equals `W * H`
    - Tag: `// Feature: local-background-removal, Property 2: Downscale then upscale preserves pixel count`
    - **Property 2: Downscale then upscale preserves pixel count**
    - **Validates: Requirements 5.5**

  - [ ]* 10.3 Write property test for aspect ratio preservation (Property 3)
    - Generate random `(W, H)` pairs where `max(W, H) > 1024`
    - Assert `newW / newH` is within 0.01 of `W / H` and `max(newW, newH) ≤ 1024`
    - Tag: `// Feature: local-background-removal, Property 3: Aspect ratio is preserved after downscaling`
    - **Property 3: Aspect ratio is preserved after downscaling**
    - **Validates: Requirements 5.5**

  - [ ]* 10.4 Write property test for frame progress monotonicity (Property 4)
    - Generate random arrays of N pre-built `ImageData` frames with a mocked worker
    - Collect all `onProgress` values; assert the sequence is non-decreasing and the last value is 100
    - Tag: `// Feature: local-background-removal, Property 4: Frame progress is monotonically increasing`
    - **Property 4: Frame progress is monotonically increasing**
    - **Validates: Requirements 6.1**

  - [ ]* 10.5 Write property test for abort returning partial results (Property 5)
    - Generate random N frames and a random abort index k in [0, N)
    - Trigger abort after k completions; assert result length equals k
    - Tag: `// Feature: local-background-removal, Property 5: Abort stops processing and returns partial results`
    - **Property 5: Abort stops processing and returns partial results**
    - **Validates: Requirements 6.3, 7.1**

  - [ ]* 10.6 Write property test for PNG round-trip dimension preservation (Property 6)
    - Generate random `(W, H)` pairs and random pixel data; encode as PNG via `encodeAsPng`, decode back via `createImageBitmap`
    - Assert decoded dimensions equal `(W, H)`
    - Tag: `// Feature: local-background-removal, Property 6: PNG encoding round-trip preserves dimensions`
    - **Property 6: PNG encoding round-trip preserves dimensions**
    - **Validates: Requirements 5.4, 7.3**

  - [ ]* 10.7 Write property test for sequential frame count (Property 7)
    - Generate random arrays of N frames (N in [1, 20]) with a mocked worker (no abort)
    - Assert result array length equals N
    - Tag: `// Feature: local-background-removal, Property 7: Sequential frame processing produces one output per input`
    - **Property 7: Sequential frame processing produces one output per input**
    - **Validates: Requirements 7.1**

- [~] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- `@huggingface/transformers` is already in `package.json` at `^3.8.1` — no new runtime dep needed
- `fast-check` and `vitest` must be added as dev dependencies (task 1) before any test tasks run
- The worker uses `AutoModel` + `AutoProcessor` (not the `pipeline` helper) because RMBG-1.4 exposes `ImageMattingOutput` which the generic pipeline task does not surface cleanly
- `nanoid` is already in `dependencies` — use it for request IDs in `sendToWorker`
- All new source files go under `src/background-removal/` (not `src/ai/`)
- Read `BackgroundRemovalDialog.tsx` before editing — it may already apply classes that affect what needs to be passed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["6.1", "7.1", "8"] },
    { "id": 5, "tasks": ["9.1"] },
    { "id": 6, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7"] }
  ]
}
```
