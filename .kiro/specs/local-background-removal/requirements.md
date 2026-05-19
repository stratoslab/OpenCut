# Requirements Document

## Introduction

Replace the existing `@imgly/background-removal` dependency in OpenCut's web-vite app with a fully local, on-device background removal engine. The new engine uses a real ONNX segmentation model (`briaai/RMBG-1.4`) loaded via `@huggingface/transformers`, running inference in a Web Worker with WebGPU acceleration and WASM fallback. No user media (images or video frames) ever leaves the browser process. The existing `SegmentationService` in `src/ai/segmentation.ts` is replaced with a model-based implementation, and `BackgroundRemovalDialog.tsx` is updated to use the new local service.

## Glossary

- **BackgroundRemovalWorker**: The Web Worker that loads the RMBG-1.4 ONNX model and runs inference off the main thread.
- **BackgroundRemovalService**: The main-thread TypeScript class that owns the worker reference, sends messages, and exposes `removeBackground()` and `removeBackgroundFromFrames()` methods.
- **BackgroundRemovalStore**: A Zustand store that tracks model stage, download progress, and per-operation progress for the background removal feature.
- **RMBG-1.4**: The `briaai/RMBG-1.4` ONNX model — a state-of-the-art salient object detection model optimised for background removal (~176 MB).
- **SegmentationMask**: The existing interface `{ id, width, height, data: Uint8Array, objectId, confidence, timestamp }` defined in `src/ai/segmentation.ts`.
- **SegmentationResult**: The existing interface `{ masks, objectLabels, processingTime }` defined in `src/ai/segmentation.ts`.
- **ModelStage**: The lifecycle state of the model: `idle | checking | unsupported | downloading | loading | ready | error`.
- **WorkerMessage**: A discriminated union of typed messages sent from the main thread to the BackgroundRemovalWorker.
- **WorkerResponse**: A discriminated union of typed messages sent from the BackgroundRemovalWorker to the main thread.
- **AlphaMask**: A single-channel `Float32Array` of values in [0, 1] representing foreground probability per pixel, produced by RMBG-1.4.
- **TransparentPNG**: A PNG-encoded `Blob` with an alpha channel where background pixels are fully transparent.
- **BackgroundRemovalDialog**: The existing React component at `src/background-removal/components/BackgroundRemovalDialog.tsx`.

## Requirements

### Requirement 1: Model Selection and Justification

**User Story:** As a product owner, I want the background removal engine to use the best available ONNX model for quality and reasonable download size, so that users get accurate results without an excessive first-load penalty.

#### Acceptance Criteria

1. THE BackgroundRemovalWorker SHALL use `briaai/RMBG-1.4` as the segmentation model, because it is purpose-built for salient object / background removal and outperforms general semantic segmentation models (such as `Xenova/segformer-b0-finetuned-ade-512-512`) on this task.
2. THE BackgroundRemovalWorker SHALL load the model with `dtype: "fp32"` on WebGPU and `dtype: "fp32"` on WASM, as RMBG-1.4 does not require quantisation for acceptable inference speed at its input resolution (1024×1024).
3. WHERE a future model upgrade is needed, THE BackgroundRemovalWorker SHALL expose the model identifier as a single named constant so it can be changed in one place.

---

### Requirement 2: Worker Architecture

**User Story:** As a developer, I want all model loading and inference to run in a Web Worker, so that the main thread (and therefore the UI) is never blocked during background removal.

#### Acceptance Criteria

1. THE BackgroundRemovalWorker SHALL run in a dedicated Web Worker module (`src/background-removal/worker.ts`), separate from the existing `ai/ai-worker.js`.
2. THE BackgroundRemovalWorker SHALL communicate with the main thread exclusively via typed `WorkerMessage` / `WorkerResponse` discriminated unions, following the pattern established in `src/services/transcription/worker.ts`.
3. WHEN the BackgroundRemovalWorker receives a `{ type: "load" }` message, THE BackgroundRemovalWorker SHALL initialise the `@huggingface/transformers` pipeline and load the RMBG-1.4 model.
4. WHEN the BackgroundRemovalWorker receives a `{ type: "remove-background", imageData, id }` message, THE BackgroundRemovalWorker SHALL run inference and respond with a `{ type: "result", id, alphaMask }` WorkerResponse.
5. WHEN the BackgroundRemovalWorker receives a `{ type: "cancel" }` message, THE BackgroundRemovalWorker SHALL abort any in-progress inference and respond with `{ type: "cancelled" }`.
6. IF an unhandled exception occurs inside the BackgroundRemovalWorker, THEN THE BackgroundRemovalWorker SHALL post a `{ type: "error", error: string }` WorkerResponse to the main thread.

---

### Requirement 3: WebGPU Acceleration with WASM Fallback

**User Story:** As a user, I want background removal to run as fast as possible on my device, so that I don't wait unnecessarily, and I want it to still work even if my browser doesn't support WebGPU.

#### Acceptance Criteria

1. WHEN the BackgroundRemovalWorker loads the model, THE BackgroundRemovalWorker SHALL attempt to use `device: "webgpu"` first.
2. IF WebGPU is unavailable or the adapter request fails, THEN THE BackgroundRemovalWorker SHALL fall back to `device: "wasm"` automatically without requiring user intervention.
3. THE BackgroundRemovalWorker SHALL post a `{ type: "device-selected", device: "webgpu" | "wasm" }` WorkerResponse after the device is determined, so the UI can display the active backend.

---

### Requirement 4: Model Download Progress Reporting

**User Story:** As a user, I want to see download progress while the model is being fetched for the first time, so that I know the app is working and can estimate how long to wait.

#### Acceptance Criteria

1. WHILE the model is downloading, THE BackgroundRemovalWorker SHALL post `{ type: "load-progress", progress: number }` WorkerResponse messages where `progress` is an integer in [0, 100] representing the aggregate byte-weighted download percentage across all model shards.
2. WHEN a model shard download fails and a retry is scheduled, THE BackgroundRemovalWorker SHALL post `{ type: "load-retry", attempt: number, maxRetries: number, delay: number, url: string }` so the UI can display a retry notice.
3. IF all retry attempts are exhausted, THEN THE BackgroundRemovalWorker SHALL post `{ type: "error", error: string }` with a human-readable message.
4. THE BackgroundRemovalWorker SHALL implement exponential-backoff retry with a base delay of 2 000 ms and a maximum of 5 retries, following the pattern in `src/ai/ai-worker.js`.
5. WHEN the model is fully loaded and ready, THE BackgroundRemovalWorker SHALL post `{ type: "ready" }`.

---

### Requirement 5: Single-Image Background Removal

**User Story:** As a user, I want to remove the background from a single image file, so that I can use the subject of the image in my video project with a transparent background.

#### Acceptance Criteria

1. WHEN a user triggers background removal on an image `File`, THE BackgroundRemovalService SHALL decode the file into `ImageData`, transfer it to the BackgroundRemovalWorker, run RMBG-1.4 inference, and return a `Blob` of type `image/png` with a transparent background.
2. THE BackgroundRemovalService SHALL accept both `File` and `ImageData` as input to `removeBackground()`.
3. WHEN inference completes, THE BackgroundRemovalWorker SHALL apply the AlphaMask to the original RGBA pixel data such that each pixel's alpha channel equals `Math.round(alphaMask[i] * 255)` and the RGB channels are preserved unchanged.
4. THE BackgroundRemovalService SHALL encode the composited RGBA data as a PNG `Blob` using an `OffscreenCanvas` (or a regular `Canvas` as fallback) before returning it to the caller.
5. IF the input image dimensions exceed 1024×1024 pixels, THEN THE BackgroundRemovalService SHALL downscale the image to fit within 1024×1024 (preserving aspect ratio) before inference, and upscale the resulting AlphaMask back to the original dimensions before compositing.

---

### Requirement 6: Per-Frame Progress Reporting During Inference

**User Story:** As a user, I want to see progress while background removal is running on multiple frames, so that I know how far along the operation is.

#### Acceptance Criteria

1. WHILE processing a batch of video frames, THE BackgroundRemovalService SHALL emit progress callbacks with a value in [0, 100] after each frame completes, calculated as `Math.round(((framesCompleted) / totalFrames) * 100)`.
2. THE BackgroundRemovalService SHALL accept an optional `onProgress: (progress: number) => void` callback in `removeBackgroundFromFrames()`.
3. WHEN a batch operation is cancelled via `AbortSignal`, THE BackgroundRemovalService SHALL stop processing remaining frames and resolve with the results collected so far.

---

### Requirement 7: Video Frame Background Removal

**User Story:** As a user, I want to remove the background from multiple video frames in a timeline clip, so that I can composite the subject over a different background in my project.

#### Acceptance Criteria

1. THE BackgroundRemovalService SHALL expose a `removeBackgroundFromFrames(frames: ImageData[], options?: { signal?: AbortSignal; onProgress?: (n: number) => void }): Promise<Blob[]>` method that processes each frame sequentially through the BackgroundRemovalWorker.
2. WHEN processing video frames, THE BackgroundRemovalService SHALL process frames one at a time (not in parallel) to avoid GPU memory exhaustion.
3. THE BackgroundRemovalService SHALL preserve the original frame dimensions in each output `Blob`.

---

### Requirement 8: Zustand Store for Model Lifecycle

**User Story:** As a developer, I want a Zustand store that tracks the background removal model's lifecycle state, so that any React component can reactively display model status, progress, and errors.

#### Acceptance Criteria

1. THE BackgroundRemovalStore SHALL expose `stage: ModelStage`, `progress: number`, `error: string | null`, `device: "webgpu" | "wasm" | null`, and `worker: Worker | null` as observable state.
2. THE BackgroundRemovalStore SHALL expose `initWorker()`, `terminateWorker()`, `loadModel()`, and `clearError()` actions.
3. WHEN `initWorker()` is called, THE BackgroundRemovalStore SHALL create a new `BackgroundRemovalWorker` instance, attach a message handler that updates store state, and post a `{ type: "load" }` message to begin model loading.
4. WHEN `terminateWorker()` is called, THE BackgroundRemovalStore SHALL call `worker.terminate()` and set `worker` to `null`.
5. THE BackgroundRemovalStore SHALL follow the same structural pattern as `src/ai/ai-model-store.ts`.

---

### Requirement 9: Replace `@imgly/background-removal` in BackgroundRemovalDialog

**User Story:** As a developer, I want the BackgroundRemovalDialog to use the new local BackgroundRemovalService instead of `@imgly/background-removal`, so that no user image data is sent to external servers.

#### Acceptance Criteria

1. THE BackgroundRemovalDialog SHALL import and call `BackgroundRemovalService.removeBackground()` instead of `@imgly/background-removal`.
2. THE BackgroundRemovalDialog SHALL display model download progress (from BackgroundRemovalStore) when the model is not yet ready, before the user clicks "Remove Background".
3. WHEN the model is in `downloading` or `loading` stage, THE BackgroundRemovalDialog SHALL show a progress indicator with the current percentage.
4. WHEN background removal completes, THE BackgroundRemovalDialog SHALL display the before/after slider comparison using the returned `Blob` URL, preserving the existing UX.
5. THE BackgroundRemovalDialog SHALL display an error message when the BackgroundRemovalStore `stage` is `"error"`, with a retry button that calls `BackgroundRemovalStore.loadModel()`.

---

### Requirement 10: Remove `@imgly/background-removal` Dependency

**User Story:** As a developer, I want the `@imgly/background-removal` package removed from the project, so that the codebase no longer depends on a library that violates the privacy-first principle.

#### Acceptance Criteria

1. THE System SHALL remove `@imgly/background-removal` from `apps/web-vite/package.json` (both `dependencies` and `devDependencies` if present).
2. THE System SHALL ensure no `import` or `require` of `@imgly/background-removal` remains anywhere in `apps/web-vite/src/`.
3. THE System SHALL add `@huggingface/transformers` to `apps/web-vite/package.json` `dependencies` if it is not already present (it is already used by the transcription service, so this may be a no-op).

---

### Requirement 11: Update SegmentationService to Use Real Model

**User Story:** As a developer, I want the existing `SegmentationService` in `src/ai/segmentation.ts` to delegate to the real RMBG-1.4 model instead of k-means color clustering, so that callers of `segmentFrame()` and `segmentVideo()` get accurate ML-based masks.

#### Acceptance Criteria

1. THE SegmentationService SHALL preserve the existing `SegmentationMask` and `SegmentationResult` interfaces without breaking changes.
2. WHEN `segmentFrame(imageData, options)` is called, THE SegmentationService SHALL delegate to `BackgroundRemovalService.removeBackground(imageData)` and convert the resulting AlphaMask into a `SegmentationMask` with `objectId: "foreground"`.
3. WHEN `segmentVideo(video, times, options, onProgress)` is called, THE SegmentationService SHALL extract frames at the specified timestamps, delegate to `BackgroundRemovalService.removeBackgroundFromFrames()`, and return a `Map<number, SegmentationResult>` in the same shape as before.
4. THE SegmentationService SHALL remove all k-means color clustering code (`kMeansColorClustering`, `createMaskFromCluster`) immediately after the model-based delegation path is implemented, without waiting for production validation.
5. THE SegmentationService SHALL preserve the `maskToImageData()` and `maskToDataURL()` utility methods unchanged.

---

### Requirement 12: Privacy Guarantee

**User Story:** As a user, I want assurance that my images and video frames are never sent to any external server during background removal, so that my private media stays private.

#### Acceptance Criteria

1. THE BackgroundRemovalWorker SHALL load the RMBG-1.4 model weights from HuggingFace Hub CDN (model files only, not user data) and cache them in the browser's Cache Storage.
2. THE BackgroundRemovalWorker SHALL perform all inference locally using the cached model weights; no pixel data from user images or video frames SHALL be transmitted outside the browser process.
3. THE BackgroundRemovalWorker SHALL set `env.allowLocalModels = false` and SHALL NOT make any fetch calls with user image data as the request body.
