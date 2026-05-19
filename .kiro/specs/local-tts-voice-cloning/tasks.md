# Implementation Plan: Local TTS / Voice Cloning

## Overview

Replace the stub `VoiceoverService` with a real on-device TTS and voice-cloning engine using OuteTTS via `@huggingface/transformers`. All inference runs in a dedicated Web Worker (WebGPU with WASM fallback), following the same patterns as the Whisper transcription worker and Gemma AI worker. Voice cloning embeddings are persisted in IndexedDB. The implementation is split into five layers: model registry → IndexedDB helpers → Zustand store → Web Worker → VoiceoverService.

## Tasks

- [x] 1. Add fast-check dev dependency and set up test infrastructure
  - Add `fast-check@^3` to `devDependencies` in `apps/web-vite/package.json`
  - Verify `bun:test` is the test runner (already confirmed by existing `agent.test.ts`)
  - Create `apps/web-vite/src/ai/__tests__/` directory (already exists)
  - _Requirements: Testing infrastructure for Properties 2, 3, 10, 11, 12, 13, 15, 16_

- [x] 2. Create `tts-models.ts` — model registry
  - [x] 2.1 Implement `TTSModelId` type, `TTSModel` interface, `TTS_MODELS` array, and `DEFAULT_TTS_MODEL`
    - Export `TTSModelId = "oute-tts-small" | "oute-tts-large"`
    - Export `TTSModel` interface with fields: `id`, `name`, `huggingFaceId`, `dtype`, `downloadSizeBytes`, `description`
    - Register `oute-tts-small` → `onnx-community/OuteTTS-0.2-500M`, dtype `q4f16`, ~335 MB
    - Register `oute-tts-large` → `OuteAI/Llama-OuteTTS-1.0-1B-ONNX`, dtype `q4f16`, ~630 MB
    - Export `DEFAULT_TTS_MODEL: TTSModelId = "oute-tts-small"`
    - _Requirements: 8.1, 8.4_

- [x] 3. Create `tts-idb.ts` — IndexedDB helpers
  - [x] 3.1 Implement `openTTSDatabase` with schema for `cloned-voices` and `speaker-descriptors` stores
    - DB name: `opencut-tts`, version: `1`
    - `cloned-voices` store: keyPath `id`, fields per design schema
    - `speaker-descriptors` store: keyPath `id`, fields: `id`, `descriptor`, `createdAt`
    - Create both stores in `onupgradeneeded` handler
    - Wrap `IDBRequest` events in Promises; surface errors with descriptive prefixes
    - _Requirements: 3.5_
  - [x] 3.2 Implement `saveClonedVoice`, `loadAllClonedVoices`, and `deleteClonedVoice`
    - `saveClonedVoice(voice, descriptor)`: write both stores in a single transaction
    - `loadAllClonedVoices()`: return `Array<{ voice: ClonedVoice; descriptor: SpeakerDescriptor }>`
    - `deleteClonedVoice(voiceId, descriptorId)`: delete from both stores atomically in one transaction
    - Surface quota errors as `"TTS storage write failed: QuotaExceededError"`
    - _Requirements: 3.5, 3.6, 3.7_
  - [ ]* 3.3 Write unit tests for IndexedDB helpers (`tts-idb.test.ts`)
    - Test `saveClonedVoice` + `loadAllClonedVoices` round-trip
    - Test `deleteClonedVoice` removes both stores atomically
    - Test quota error surfaces as descriptive error message
    - _Requirements: 3.5, 3.6, 3.7_

- [ ] 4. Create `tts-model-store.ts` — Zustand store
  - [x] 4.1 Implement `TTSModelStage` type and `TTSModelState` interface
    - `TTSModelStage`: `"idle" | "checking" | "downloading" | "loading" | "ready" | "error"`
    - `TTSModelState` fields: `stage`, `progress` (0–100), `error`, `device`, `selectedModel`, `downloadSizeBytes`, `worker`, `isReady`
    - _Requirements: 5.1, 8.3_
  - [-] 4.2 Implement `useTTSModelStore` Zustand store with all actions
    - `initWorker()`: create `Worker` from `tts-worker.ts`, wire message handler, post `{ type: "check" }`
    - `terminateWorker()`: terminate worker, set `stage: "idle"`, clear worker ref
    - `loadModel()`: post `{ type: "load", modelId, dtype }` to worker, set `stage: "downloading"`
    - `selectModel(id)`: immediately update `selectedModel` and `downloadSizeBytes` from `TTS_MODELS` registry
    - `clearError()`: reset `error` to null, set `stage: "idle"` if currently `"error"`
    - Handle all `TTSWorkerResponse` message types: `check`, `load_progress`, `load_complete`, `load_error`
    - Follow the same ETA calculation pattern as `transcription-model-store.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 8.2, 8.3, 8.4_

- [ ] 5. Create `tts-worker.ts` — Web Worker
  - [-] 5.1 Define `TTSWorkerMessage` and `TTSWorkerResponse` typed unions and `TokenTimestamp` / `SpeakerDescriptor` types
    - Inbound: `check`, `load`, `synthesize`, `encode_speaker`, `cancel`, `terminate`
    - Outbound: `check`, `load_progress`, `load_complete`, `load_error`, `synthesize_complete`, `synthesize_error`, `encode_speaker_complete`, `encode_speaker_error`, `cancelled`
    - Export all types for use by `tts-model-store.ts` and `voiceover.ts`
    - _Requirements: 1.2, 5.1_
  - [~] 5.2 Implement WebGPU capability check and WASM fallback logic
    - On `{ type: "check" }`: probe `navigator.gpu`, request adapter, post `{ type: "check", webgpuSupported, reason? }`
    - On `load_complete`: include `device: "webgpu" | "wasm"` in response
    - If WebGPU init fails at runtime, retry with `device: "wasm"` before emitting `load_error`
    - _Requirements: 1.5, 1.6_
  - [~] 5.3 Implement model loading with progress reporting and exponential-backoff retry
    - Use `@huggingface/transformers` `InterfaceHF` API to load OuteTTS model
    - Wrap `env.fetch` with retry logic: `MAX_RETRIES=5`, `BASE_RETRY_DELAY=2000ms`, delay = `BASE_RETRY_DELAY * 2^attempt`
    - Emit `{ type: "load_progress", progress }` as integer 0–100 during download (aggregate file bytes, same pattern as `ai-worker.js`)
    - Emit `{ type: "load_complete", device }` on success
    - Emit `{ type: "load_error", error }` after all retries exhausted
    - Cache loaded model instance to avoid re-initialization (Requirement 5.5)
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.1, 6.5_
  - [~] 5.4 Implement pure helper functions: `computeCharacterWeightedTimings`, `scaleWordTimings`, `clampSpeedPitch`, `normalizeText`
    - `normalizeText(text)`: strip punctuation, split on whitespace, filter empty tokens
    - `clampSpeedPitch(value)`: clamp to [0.5, 2.0]
    - `computeCharacterWeightedTimings(words, duration)`: distribute duration proportionally by character count; `timings[0].start = 0`, `timings[last].end = duration`
    - `scaleWordTimings(timings, speed)`: `adjustedStart = originalStart / speed`, `adjustedEnd = originalEnd / speed`
    - Export these functions for unit testing
    - _Requirements: 4.4, 7.1, 7.3, 7.4_
  - [~] 5.5 Implement `synthesize` handler using OuteTTS `InterfaceHF` API
    - On `{ type: "synthesize", requestId, text, speakerDescriptor, speed, pitch }`:
      - Call `tts_interface.generate({ text, speaker: speakerDescriptor ?? undefined })`
      - Apply speed/pitch via `OfflineAudioContext` + `AudioBufferSourceNode.playbackRate` + `detune = 1200 * log2(pitch / speed)` cents
      - Derive `wordTimings` from native timestamps if available, else use `computeCharacterWeightedTimings`
      - Scale timings with `scaleWordTimings(timings, speed)`
      - Post `{ type: "synthesize_complete", requestId, audioData, sampleRate, tokenTimestamps }`
    - On error: post `{ type: "synthesize_error", requestId, error }`
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.4_
  - [~] 5.6 Implement `encode_speaker` handler for voice cloning
    - On `{ type: "encode_speaker", requestId, audioData, sampleRate }`:
      - Call `tts_interface.create_speaker(audioBuffer)` to produce `SpeakerDescriptor`
      - Post `{ type: "encode_speaker_complete", requestId, descriptor }`
    - On error: post `{ type: "encode_speaker_error", requestId, error }`
    - _Requirements: 3.1, 3.2_
  - [ ]* 5.7 Write unit tests for pure worker functions (`tts-worker.test.ts`)
    - Test `computeCharacterWeightedTimings`: proportional distribution, first start = 0, last end = duration
    - Test `scaleWordTimings`: each start/end scaled by `1/speed`
    - Test `clampSpeedPitch`: values below 0.5 → 0.5, above 2.0 → 2.0, in-range unchanged
    - Test `normalizeText`: whitespace stripping, punctuation removal, word tokenization
    - _Requirements: 4.4, 7.3, 7.4_
  - [ ]* 5.8 Write property tests for pure worker functions (`voiceover.properties.test.ts` — partial)
    - **Property 12: Character-weighted timing fallback is proportional**
      - For any array of words and any duration, each word's assigned duration is proportional to its character count
      - **Validates: Requirements 4.4**
    - **Property 15: Speed scaling adjusts duration and word timings consistently**
      - For any speed in [0.5, 2.0] and any timings array, `adjustedStart = originalStart / speed` and `adjustedEnd = originalEnd / speed`
      - **Validates: Requirements 7.1, 7.4**
    - **Property 16: Speed and pitch values are clamped to [0.5, 2.0]**
      - For any value outside [0.5, 2.0], `clampSpeedPitch` returns the nearest bound
      - **Validates: Requirements 7.3**
    - _Use `fast-check` with `fc.array`, `fc.float`, `fc.string`_

- [~] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Update `voiceover.ts` — replace stub with worker-based implementation
  - [~] 7.1 Add `ClonedVoice` interface and update `VoiceoverService` class structure
    - Add `ClonedVoice extends VoiceProfile` with fields: `isCloned: true`, `createdAt: number`, `descriptorId: string`
    - Extend internal `voices` map to hold both `VoiceProfile` and `ClonedVoice` entries
    - Preserve all existing method signatures: `getVoice`, `getAllVoices`, `getVoicesByLanguage`, `generateVoiceover`
    - Map legacy IDs (`en-us-male-casual`, `en-us-female-professional`, `en-us-male-energetic`, `en-gb-female-calm`) to built-in OuteTTS presets via `getVoice()` — same `language`, `gender`, `tone` fields
    - _Requirements: 1.3, 2.1, 2.4_
  - [~] 7.2 Implement input validation in `generateVoiceover`
    - Reject empty/whitespace-only `text` with `"Text must be non-empty"`
    - Reject unrecognized `voiceId` with `"Voice '${voiceId}' not found"`
    - Clamp `speed` and `pitch` to [0.5, 2.0] silently before forwarding to worker
    - Auto-trigger `loadModel()` if `stage === "idle"` before synthesis
    - _Requirements: 1.4, 1.7, 1.8, 7.3, 7.5_
  - [~] 7.3 Implement worker-based `synthesizeSpeech` replacing the stub
    - Get worker ref from `useTTSModelStore`
    - Post `{ type: "synthesize", requestId, text, speakerDescriptor, speed, pitch }` to worker
    - Resolve/reject via `requestId`-keyed Promise map on `synthesize_complete` / `synthesize_error` / `cancelled`
    - Return `VoiceoverResult` with `audioBuffer`, `duration`, `wordTimings` from worker response
    - _Requirements: 1.1, 1.2, 4.1, 4.2_
  - [~] 7.4 Implement `cloneVoice(name, audioBuffer)` method
    - Validate reference audio duration: reject < 5 s with descriptive error; trim to 30 s if > 30 s
    - Post `{ type: "encode_speaker", requestId, audioData, sampleRate }` to worker
    - On `encode_speaker_complete`: call `saveClonedVoice` from `tts-idb.ts`; register profile in `voices` map
    - On IDB failure: do NOT register profile; surface error to caller
    - Return `ClonedVoice` profile
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_
  - [~] 7.5 Implement `deleteClonedVoice(id)` and `loadClonedVoices()` methods
    - `deleteClonedVoice(id)`: call `tts-idb.deleteClonedVoice`, remove from `voices` map
    - `loadClonedVoices()`: call `tts-idb.loadAllClonedVoices`, register each profile in `voices` map
    - _Requirements: 3.5, 3.6_
  - [ ]* 7.6 Write unit tests for `VoiceoverService` (`voiceover.test.ts`)
    - API compatibility: `getAllVoices`, `getVoice`, `getVoicesByLanguage` return correct shapes
    - Legacy ID mapping: each of the four original `DEFAULT_VOICES` IDs resolves via `getVoice`
    - Auto-load: calling `generateVoiceover` with `stage: "idle"` triggers `loadModel`
    - WebGPU fallback: mocking `navigator.gpu` as undefined causes `device: "wasm"` in store
    - `terminateWorker`: pending `generateVoiceover` promise rejects with cancellation error
    - IndexedDB unavailable: `cloneVoice` rejects and does not register the profile
    - Model selection: `selectModel` transitions stage and updates `downloadSizeBytes`
    - _Requirements: 1.3, 1.4, 1.6, 1.7, 1.8, 2.4, 3.7, 5.6, 8.4_
  - [ ]* 7.7 Write property tests for `VoiceoverService` (`voiceover.properties.test.ts` — remaining)
    - **Property 2: Whitespace-only text is rejected**
      - For any string matching `/^\s+$/`, `generateVoiceover` rejects with an error
      - **Validates: Requirements 1.7**
    - **Property 3: Unrecognized voiceId is rejected**
      - For any string not in the known voice registry, `generateVoiceover` rejects with an error identifying the ID
      - **Validates: Requirements 1.8, 2.5**
    - **Property 10: wordTimings count matches word count**
      - For any non-empty text, `wordTimings.length` equals the whitespace-delimited word count after punctuation stripping
      - **Validates: Requirements 4.1**
    - **Property 11: wordTimings shape is valid**
      - For any `VoiceoverResult`, every `wordTimings` entry has `word` (non-empty string), `start` (≥ 0), `end` (> `start`)
      - **Validates: Requirements 4.2**
    - **Property 13: Download progress values are valid and non-decreasing**
      - For any sequence of emitted progress values, all are integers in [0, 100] and the sequence is non-decreasing
      - **Validates: Requirements 5.2**
    - _Use `fast-check` with `fc.stringMatching`, `fc.string`, `fc.array`, `fc.integer`_

- [~] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The project uses `bun:test` as the test runner (confirmed by `agent.test.ts`); `fast-check` integrates via `fc.assert(fc.property(...))` with `bun:test`'s `it`
- `fast-check` must be added as a dev dependency before any property tests are written (Task 1)
- All new files live under `apps/web-vite/src/ai/`; test files under `apps/web-vite/src/ai/__tests__/`
- The worker (`tts-worker.ts`) exports pure helper functions (`computeCharacterWeightedTimings`, `scaleWordTimings`, `clampSpeedPitch`, `normalizeText`) so they can be unit-tested without spinning up a Worker
- Legacy voice IDs must remain resolvable via `getVoice()` — do not remove `DEFAULT_VOICES` entries, map them to OuteTTS built-in presets
- IndexedDB operations use the native `indexedDB` API directly (no third-party library), consistent with the app's zero-server-dependency constraint
- Speed/pitch processing uses `OfflineAudioContext` + `AudioBufferSourceNode.playbackRate`; pitch approximation: `detune = 1200 * log2(pitch / speed)` cents
- Properties 1, 4, 5, 6, 7, 8, 9, 14, and 17 require a running worker and are covered by integration tests in `voiceover.test.ts` rather than pure property tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["3.3", "4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["5.5", "5.6"] },
    { "id": 6, "tasks": ["5.7", "5.8", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4", "7.5"] },
    { "id": 9, "tasks": ["7.6", "7.7"] }
  ]
}
```
