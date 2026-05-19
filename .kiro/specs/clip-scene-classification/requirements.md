# Requirements Document

## Introduction

This feature connects a CLIP-style vision-language model (`Xenova/clip-vit-base-patch32`) to the existing `SceneClassifier` and `BrollAnalyzer` in OpenCut's `apps/web-vite/` Vite + React SPA. The goal is to enable visual scene understanding — classifying video frames by what they actually contain rather than by transcript keywords alone.

All AI inference runs entirely in the browser via a dedicated Web Worker using `@huggingface/transformers`, with WebGPU as the primary backend and WASM as a fallback. No video frame data leaves the browser process. The existing public interfaces of `SceneClassifier` and `BrollAnalyzer` are preserved; CLIP is an additive enhancement.

## Glossary

- **CLIP_Worker**: The Web Worker that loads and runs the `Xenova/clip-vit-base-patch32` model. Handles all CLIP inference off the main thread.
- **CLIP_Model**: The `Xenova/clip-vit-base-patch32` model loaded inside `CLIP_Worker`. Produces image and text embeddings via `CLIPModel` + `CLIPProcessor` from `@huggingface/transformers`.
- **CLIP_Store**: The Zustand store (`useClipModelStore`) that tracks `CLIP_Worker` lifecycle state and exposes actions to the UI.
- **SceneClassifier**: The existing class in `src/ai/scene-classifier.ts` that assigns `SceneCategory` labels and `isHighlight` flags to detected scenes.
- **BrollAnalyzer**: The existing class in `src/broll/broll-analyzer.ts` that generates `BrollSuggestion` objects with `semanticQuery` strings from transcript text.
- **SceneDetectPanel**: The existing React component in `src/scene-detection/components/SceneDetectPanel.tsx` that runs histogram-based scene detection and displays results.
- **ClassifiedScene**: The existing output type of `SceneClassifier.classify()`, containing `category`, `confidence`, `isHighlight`, and related fields.
- **BrollSuggestion**: The existing output type of `BrollAnalyzer.analyze()`, containing `semanticQuery` and `confidence`.
- **SceneCategory**: The existing union type `"talking-head" | "b-roll" | "action" | "transition" | "silent" | "music" | "intro" | "outro" | "unknown"`.
- **ImageData**: A browser `ImageData` object (or compatible `{ data: Uint8ClampedArray; width: number; height: number }`) representing a decoded video frame.
- **Cosine_Similarity**: The dot product of two L2-normalised embedding vectors, producing a score in [-1, 1] where 1 means identical direction.
- **Label_Prompt**: A natural-language string used as a CLIP text input to represent a `SceneCategory`, e.g. `"a person talking directly to camera"`.
- **ModelStage**: The union type `"idle" | "checking" | "downloading" | "loading" | "ready" | "error"` used in `CLIP_Store`.

---

## Requirements

### Requirement 1: CLIP Web Worker

**User Story:** As a developer, I want CLIP inference to run in a dedicated Web Worker, so that the main thread and UI remain responsive during model loading and embedding computation.

#### Acceptance Criteria

1. THE `CLIP_Worker` SHALL be implemented as a separate worker module (e.g. `src/ai/clip-worker.ts`) that is never imported directly on the main thread.
2. WHEN `CLIP_Worker` receives a `{ type: "load" }` message, THE `CLIP_Worker` SHALL load `CLIP_Model` using `@huggingface/transformers` with WebGPU as the primary device and WASM as the fallback device.
3. WHILE `CLIP_Model` is downloading, THE `CLIP_Worker` SHALL post `{ type: "progress", progress: number }` messages to the main thread at each file-level progress update, where `progress` is a number in [0, 100].
4. WHEN `CLIP_Model` finishes loading, THE `CLIP_Worker` SHALL post a `{ type: "ready" }` message to the main thread.
5. IF `CLIP_Model` loading fails, THEN THE `CLIP_Worker` SHALL post a `{ type: "error", message: string }` message to the main thread with a human-readable description of the failure.
6. WHEN `CLIP_Worker` receives a `{ type: "embedImage", id: string, imageData: ImageData }` message, THE `CLIP_Worker` SHALL compute an image embedding using `CLIP_Model` and post `{ type: "embedImageResult", id: string, embedding: number[] }` back to the main thread.
7. WHEN `CLIP_Worker` receives a `{ type: "embedTexts", id: string, texts: string[] }` message, THE `CLIP_Worker` SHALL compute text embeddings for all strings in `texts` using `CLIP_Model` and post `{ type: "embedTextsResult", id: string, embeddings: number[][] }` back to the main thread.
8. IF `CLIP_Worker` receives an `embedImage` or `embedTexts` message before `CLIP_Model` is ready, THEN THE `CLIP_Worker` SHALL post `{ type: "error", message: "Model not loaded" }` to the main thread.
9. THE `CLIP_Worker` SHALL NOT transfer any `ImageData` pixel data outside the browser process.

---

### Requirement 2: CLIP Model Lifecycle Store

**User Story:** As a developer, I want a Zustand store that tracks the CLIP model's loading state, so that UI components can reactively show download progress, readiness, and errors without polling.

#### Acceptance Criteria

1. THE `CLIP_Store` SHALL expose a `stage` field of type `ModelStage` initialised to `"idle"`.
2. THE `CLIP_Store` SHALL expose a `progress` field (number, 0–100) and an `error` field (string or null).
3. WHEN `CLIP_Store.loadModel()` is called, THE `CLIP_Store` SHALL create or reuse a `CLIP_Worker` instance, set `stage` to `"downloading"`, and send a `{ type: "load" }` message to `CLIP_Worker`.
4. WHEN `CLIP_Store` receives a `progress` message from `CLIP_Worker`, THE `CLIP_Store` SHALL update the `progress` field to the received value.
5. WHEN `CLIP_Store` receives a `ready` message from `CLIP_Worker`, THE `CLIP_Store` SHALL set `stage` to `"ready"` and `progress` to 100.
6. WHEN `CLIP_Store` receives an `error` message from `CLIP_Worker`, THE `CLIP_Store` SHALL set `stage` to `"error"` and `error` to the received message string.
7. THE `CLIP_Store` SHALL expose an `embedImage(imageData: ImageData): Promise<number[]>` method that sends an `embedImage` message to `CLIP_Worker` and resolves with the returned embedding array.
8. THE `CLIP_Store` SHALL expose an `embedTexts(texts: string[]): Promise<number[][]>` method that sends an `embedTexts` message to `CLIP_Worker` and resolves with the returned embeddings array.
9. IF `CLIP_Store.embedImage()` or `CLIP_Store.embedTexts()` is called when `stage` is not `"ready"`, THEN THE `CLIP_Store` SHALL reject the returned Promise with an error message indicating the model is not ready.
10. THE `CLIP_Store` SHALL expose a `terminateWorker()` action that terminates `CLIP_Worker` and resets `stage` to `"idle"`.

---

### Requirement 3: Visual Frame Classification

**User Story:** As a developer, I want a pure function that classifies an `ImageData` frame into a `SceneCategory` using CLIP embeddings, so that scene categories reflect actual visual content rather than transcript keywords.

#### Acceptance Criteria

1. THE `CLIP_Store` SHALL expose a `classifyFrame(imageData: ImageData): Promise<{ category: SceneCategory; confidence: number }>` method.
2. WHEN `classifyFrame` is called, THE `CLIP_Store` SHALL compute an image embedding for `imageData` and compute text embeddings for a fixed set of `Label_Prompt` strings, one per `SceneCategory` value.
3. WHEN embeddings are computed, THE `CLIP_Store` SHALL select the `SceneCategory` whose `Label_Prompt` embedding has the highest `Cosine_Similarity` to the image embedding.
4. THE `CLIP_Store` SHALL set `confidence` to the softmax-normalised `Cosine_Similarity` score of the winning label, scaled to [0, 1].
5. THE `CLIP_Store` SHALL use the following `Label_Prompt` mapping (or a superset thereof):
   - `"talking-head"` → `"a person talking directly to camera"`
   - `"b-roll"` → `"cinematic b-roll footage of a scene or environment"`
   - `"action"` → `"fast-paced action or movement sequence"`
   - `"transition"` → `"a video transition or dissolve effect"`
   - `"silent"` → `"a static or near-static scene with no movement"`
   - `"music"` → `"a music performance or concert"`
   - `"intro"` → `"an introduction title card or opening sequence"`
   - `"outro"` → `"an outro, end card, or closing sequence"`
   - `"unknown"` → `"an unclassifiable or ambiguous scene"`
6. IF `classifyFrame` is called when `stage` is not `"ready"`, THEN THE `CLIP_Store` SHALL reject the returned Promise with an error indicating the model is not ready.

---

### Requirement 4: SceneClassifier Visual Enhancement

**User Story:** As a developer, I want `SceneClassifier` to optionally use CLIP visual embeddings when classifying scenes, so that category labels are more accurate for silent scenes and scenes where transcript keywords are absent or misleading.

#### Acceptance Criteria

1. THE `SceneClassifier` SHALL preserve its existing `classify(scenes, transcript?, videoDuration?)` method signature and return type without modification.
2. THE `SceneClassifier` SHALL preserve its existing `generateHighlightReel(classified, maxDuration?)` method signature and return type without modification.
3. THE `SceneClassifier` SHALL expose a new `classifyWithVision(scenes: SceneChange[], frames: Map<string, ImageData>, transcript?: WordTranscript, videoDuration?: number): Promise<ClassifiedScene[]>` method.
4. WHEN `classifyWithVision` is called, THE `SceneClassifier` SHALL call `CLIP_Store.classifyFrame()` for each entry in `frames` whose key matches a scene id.
5. WHEN a CLIP classification result is available for a scene, THE `SceneClassifier` SHALL use the CLIP-derived `category` and `confidence` in place of the keyword-derived values for that scene.
6. WHEN no CLIP classification result is available for a scene (frame not provided or CLIP unavailable), THE `SceneClassifier` SHALL fall back to the existing keyword-based `categorizeScene` logic for that scene.
7. WHEN `classifyWithVision` is called and `CLIP_Store.stage` is not `"ready"`, THE `SceneClassifier` SHALL fall back to the existing keyword-based `classify` method for all scenes and return its result.
8. THE `SceneClassifier` SHALL NOT modify the `isHighlight` or `highlightReason` logic; those fields SHALL continue to be derived from the existing `isHighlightCandidate` method applied to the final category and transcript snippet.

---

### Requirement 5: BrollAnalyzer Visual Relevance Scoring

**User Story:** As a developer, I want `BrollAnalyzer` to optionally score how well a video frame matches a b-roll semantic query using CLIP, so that `BrollSuggestion.confidence` values reflect actual visual relevance rather than keyword heuristics alone.

#### Acceptance Criteria

1. THE `BrollAnalyzer` SHALL preserve its existing `analyze(transcript: WordTranscript): BrollSuggestion[]` method signature and return type without modification.
2. THE `BrollAnalyzer` SHALL expose a new `scoreFrameRelevance(frame: ImageData, query: string): Promise<number>` method that returns a relevance score in [0, 1].
3. WHEN `scoreFrameRelevance` is called, THE `BrollAnalyzer` SHALL compute an image embedding for `frame` and a text embedding for `query` using `CLIP_Store`, then return the `Cosine_Similarity` between the two embeddings, linearly mapped from [-1, 1] to [0, 1].
4. IF `scoreFrameRelevance` is called when `CLIP_Store.stage` is not `"ready"`, THEN THE `BrollAnalyzer` SHALL return a Promise that resolves to `0.5` as a neutral fallback score.
5. THE `BrollAnalyzer` SHALL expose a new `enrichWithVisualConfidence(suggestions: BrollSuggestion[], getFrame: (startTime: number) => Promise<ImageData | null>): Promise<BrollSuggestion[]>` method.
6. WHEN `enrichWithVisualConfidence` is called, THE `BrollAnalyzer` SHALL call `getFrame` for each suggestion's `startTime`, and for each non-null frame SHALL call `scoreFrameRelevance(frame, suggestion.semanticQuery)` to obtain a visual score.
7. WHEN a visual score is obtained for a suggestion, THE `BrollAnalyzer` SHALL update that suggestion's `confidence` to the average of the original keyword-derived confidence and the visual score.
8. IF `getFrame` returns null for a suggestion, THE `BrollAnalyzer` SHALL leave that suggestion's `confidence` unchanged.

---

### Requirement 6: SceneDetectPanel UI Integration

**User Story:** As a video editor, I want the Scene Detection panel to optionally run CLIP visual classification after histogram detection, so that I can see accurate scene category labels and highlight flags on each detected scene without leaving the panel.

#### Acceptance Criteria

1. THE `SceneDetectPanel` SHALL display a toggle labelled "Visual Classification (CLIP)" that is disabled when `CLIP_Store.stage` is not `"ready"`.
2. WHEN the toggle is enabled and scene detection completes, THE `SceneDetectPanel` SHALL call `SceneClassifier.classifyWithVision()` using the detected scenes and the `afterThumbnail` image data of each scene as the frame input.
3. WHEN `classifyWithVision` results are available, THE `SceneDetectPanel` SHALL display the `category` label and `isHighlight` flag for each scene card alongside the existing timestamp and chi-squared distance.
4. WHILE visual classification is running, THE `SceneDetectPanel` SHALL display a progress indicator and disable the "Detect Scenes" button.
5. IF visual classification fails, THE `SceneDetectPanel` SHALL display an inline error message and show the scene list without category labels.
6. WHEN `CLIP_Store.stage` is `"idle"`, THE `SceneDetectPanel` SHALL display a "Load CLIP Model (~150 MB)" button that calls `CLIP_Store.loadModel()` when clicked.
7. WHILE `CLIP_Store.stage` is `"downloading"` or `"loading"`, THE `SceneDetectPanel` SHALL display a download progress bar showing `CLIP_Store.progress` percent.
8. WHEN `CLIP_Store.stage` is `"error"`, THE `SceneDetectPanel` SHALL display the `CLIP_Store.error` message and a "Retry" button that calls `CLIP_Store.loadModel()`.
9. THE `SceneDetectPanel` SHALL NOT call `CLIP_Store.loadModel()` automatically on mount; model loading SHALL only begin on explicit user action.

---

### Requirement 7: Privacy and Data Containment

**User Story:** As a user, I want all video frame processing to remain entirely within my browser, so that my video content is never transmitted to any external server.

#### Acceptance Criteria

1. THE `CLIP_Worker` SHALL NOT make any network requests that transmit `ImageData` pixel data or derived embeddings to any URL outside the browser process.
2. THE `CLIP_Worker` SHALL only make network requests to `huggingface.co` (or its CDN) for the purpose of downloading `CLIP_Model` weights.
3. THE `SceneClassifier` and `BrollAnalyzer` SHALL NOT pass `ImageData` or embedding vectors to any function that performs an outbound network request.
4. THE `CLIP_Store` SHALL NOT persist `ImageData` or embedding vectors to `localStorage`, `IndexedDB`, or any other browser storage mechanism.
