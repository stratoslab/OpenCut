# Requirements Document

## Introduction

Replace the stub `VoiceoverService` in OpenCut's `apps/web-vite` with a real on-device TTS and voice-cloning engine. All inference runs inside a Web Worker using WebGPU via `@huggingface/transformers`, matching the existing pattern used by the Whisper transcription worker. No audio data or text ever leaves the user's device. The feature must preserve the existing `VoiceoverService` public interface (`generateVoiceover`, `getAllVoices`, `getVoice`, `getVoicesByLanguage`) so that downstream consumers require no changes.

## Glossary

- **TTS_Worker**: The Web Worker that loads and runs the on-device TTS model (OuteTTS or Bark via ONNX/WebGPU).
- **VoiceoverService**: The singleton service in `src/ai/voiceover.ts` that exposes the public API consumed by the rest of the app.
- **VoiceProfile**: A descriptor for a built-in or cloned voice, as defined by the existing `VoiceProfile` interface.
- **ClonedVoice**: A `VoiceProfile` derived from a user-supplied reference audio clip rather than a built-in model preset.
- **ReferenceAudio**: A short audio clip (5–30 seconds) provided by the user as the source for voice cloning. Accepted formats: WAV, MP3, M4A, OGG.
- **WordTiming**: A `{ word: string; start: number; end: number }` record matching the format already produced by the Whisper transcription pipeline.
- **AudioBuffer**: The Web Audio API `AudioBuffer` type returned by `generateVoiceover`.
- **ModelStage**: The lifecycle state of the TTS model: `idle | downloading | loading | ready | error`.
- **BuiltInPreset**: A named voice shipped with the model that requires no reference audio.
- **TTSModelId**: A string identifier for a selectable TTS model variant (e.g. `"oute-tts-small"`, `"oute-tts-large"`).

---

## Requirements

### Requirement 1: On-Device TTS Synthesis

**User Story:** As a video creator, I want to generate spoken audio from text entirely on my device, so that my script content never leaves my machine.

#### Acceptance Criteria

1. WHEN `generateVoiceover` is called with a valid `VoiceoverRequest` (non-empty, non-whitespace `text` and a resolvable `voiceId`), THE `VoiceoverService` SHALL return a `VoiceoverResult` containing an `AudioBuffer` with length greater than 0 samples produced by the on-device TTS model.
2. WHEN `generateVoiceover` is called, THE `TTS_Worker` SHALL perform all model inference and audio synthesis inside the Web Worker without executing inference or synthesis code on the browser main thread.
3. THE `VoiceoverService` SHALL preserve the existing method signatures for `generateVoiceover`, `getAllVoices`, `getVoice`, and `getVoicesByLanguage` so that existing callers require no changes.
4. WHEN the TTS model is not yet loaded and `generateVoiceover` is called, THE `VoiceoverService` SHALL automatically trigger model loading before synthesis begins.
5. THE `TTS_Worker` SHALL use `device: "webgpu"` when loading the TTS model via `@huggingface/transformers`.
6. IF WebGPU is unavailable in the browser, THEN THE `TTS_Worker` SHALL fall back to `device: "wasm"` and set the `useTTSModelStore` `device` field to `"wasm"`.
7. IF `generateVoiceover` is called with an empty or whitespace-only `text` field, THEN THE `VoiceoverService` SHALL reject the request with an error message indicating that text must be non-empty.
8. IF `generateVoiceover` is called with a `voiceId` that does not resolve to any built-in preset or registered `ClonedVoice`, THEN THE `VoiceoverService` SHALL reject the request with an error message identifying the unrecognized `voiceId`.

---

### Requirement 2: Built-In Voice Presets

**User Story:** As a video creator, I want a set of ready-to-use voice presets, so that I can add voiceover without recording a reference clip.

#### Acceptance Criteria

1. THE `VoiceoverService` SHALL expose at least four built-in `VoiceProfile` presets including at least one male voice, at least one female voice, and at least one neutral voice.
2. WHEN `getAllVoices` is called, THE `VoiceoverService` SHALL return all built-in presets plus any user-registered `ClonedVoice` profiles.
3. WHEN `generateVoiceover` is called with a built-in preset `voiceId`, THE `TTS_Worker` SHALL select the corresponding model speaker token without requiring any `ReferenceAudio`.
4. THE `VoiceoverService` SHALL map each existing `VoiceProfile` `id` (e.g. `"en-us-male-casual"`) to a corresponding built-in preset such that `getVoice(oldId)` returns a `VoiceProfile` with the same `language`, `gender`, and `tone` fields as the mapped preset.
5. IF `generateVoiceover` is called with a `voiceId` that is not recognized as a built-in preset or registered `ClonedVoice`, THEN THE `VoiceoverService` SHALL reject the request with an error identifying the unrecognized `voiceId`.

---

### Requirement 3: Voice Cloning from Reference Audio

**User Story:** As a video creator, I want to clone my own voice from a short recording, so that the generated voiceover sounds like me.

#### Acceptance Criteria

1. WHEN a user provides a `ReferenceAudio` clip in WAV, MP3, M4A, or OGG format with a duration between 5 and 30 seconds, THE `VoiceoverService` SHALL register a new `ClonedVoice` profile and return its `VoiceProfile`.
2. WHEN `generateVoiceover` is called with a `ClonedVoice` `voiceId`, THE `TTS_Worker` SHALL condition synthesis on the stored reference audio embedding and return a completed `VoiceoverResult`.
3. IF the supplied `ReferenceAudio` is shorter than 5 seconds, THEN THE `VoiceoverService` SHALL return an error stating that the minimum reference audio duration is 5 seconds.
4. IF the supplied `ReferenceAudio` is longer than 30 seconds, THEN THE `VoiceoverService` SHALL trim the audio to the first 30 seconds before processing and return the resulting `VoiceProfile`.
5. WHILE browser-local storage is available, THE `VoiceoverService` SHALL persist `ClonedVoice` profiles and their embeddings in IndexedDB so that they survive page reloads without any server upload.
6. WHEN a `ClonedVoice` is deleted by the user, THE `VoiceoverService` SHALL remove the profile and its stored embedding from IndexedDB.
7. IF IndexedDB storage is unavailable or the write fails due to quota exhaustion, THEN THE `VoiceoverService` SHALL return an error describing the storage failure and SHALL NOT register the `ClonedVoice` profile.

---

### Requirement 4: Word-Level Timing Output

**User Story:** As a video editor, I want word-level timestamps in the voiceover result, so that I can sync captions and timeline clips to the generated speech.

#### Acceptance Criteria

1. WHEN `generateVoiceover` returns a `VoiceoverResult`, THE `VoiceoverService` SHALL populate `wordTimings` with one entry per whitespace-delimited word (punctuation stripped) in the input text, ordered chronologically, where the first entry's `start` is ≥ 0 and the last entry's `end` equals `audioBuffer.duration`.
2. THE `VoiceoverService` SHALL produce `wordTimings` entries using the `{ word: string; start: number; end: number }` shape defined in the `WordTiming` glossary type, matching the format used by the Whisper transcription pipeline.
3. WHEN the TTS model provides native token-level timestamps, THE `TTS_Worker` SHALL derive `wordTimings` by mapping token boundaries to word boundaries (merging sub-word tokens into their parent word) rather than using a uniform-distribution estimate.
4. IF the TTS model does not provide native timestamps, THEN THE `VoiceoverService` SHALL compute `wordTimings` by distributing the total audio duration across words proportionally by character count.
5. IF the input `text` is empty after whitespace normalization, THEN THE `VoiceoverService` SHALL return a `wordTimings` array of length 0.

---

### Requirement 5: Model Lifecycle and Progress Reporting

**User Story:** As a video creator, I want to see download and loading progress for the TTS model, so that I know how long to wait before I can generate voiceover.

#### Acceptance Criteria

1. THE `VoiceoverService` SHALL expose a Zustand store (`useTTSModelStore`) with at minimum the fields: `stage: ModelStage`, `progress: number` (0–100), `error: string | null`, and `device: "webgpu" | "wasm" | null`.
2. WHILE the TTS model is downloading, THE `TTS_Worker` SHALL emit progress messages that update the store's `progress` field as an integer percentage from 0 to 100.
3. WHEN the TTS model finishes loading, THE `TTS_Worker` SHALL set the store `stage` to `"ready"`.
4. IF the TTS model fails to load, THEN THE `TTS_Worker` SHALL set the store `stage` to `"error"` and populate the `error` field with a string that identifies the failure cause (e.g. network error, out-of-memory, unsupported model format).
5. WHEN `generateVoiceover` is called on the same worker instance after a successful load, THE `VoiceoverService` SHALL use the already-loaded model without re-downloading or re-initializing it.
6. WHEN `terminateWorker` is called, THE `VoiceoverService` SHALL terminate the `TTS_Worker`, set `stage` to `"idle"`, abort any in-flight model download, and reject any pending `generateVoiceover` promises with a cancellation error.

---

### Requirement 6: Privacy and Local-First Guarantee

**User Story:** As a privacy-conscious user, I want all TTS processing to happen on my device, so that my text and voice data are never transmitted to any server.

#### Acceptance Criteria

1. THE `TTS_Worker` SHALL NOT make any network requests other than downloading the model weights from Hugging Face when no valid cached weights exist in the browser.
2. WHEN the model weights are cached in the browser, THE `TTS_Worker` SHALL operate fully offline without any network access.
3. THE `VoiceoverService` SHALL NOT transmit the `text` field of any `VoiceoverRequest` to any network endpoint or cross-origin context.
4. THE `VoiceoverService` SHALL NOT transmit any `ReferenceAudio` data to any network endpoint or cross-origin context.
5. IF the model weight download fails after all retries, THEN THE `TTS_Worker` SHALL set the store `stage` to `"error"` with an error message describing the download failure, and SHALL NOT attempt any further network requests until the user explicitly retries.

---

### Requirement 7: Speed and Pitch Controls

**User Story:** As a video creator, I want to adjust the speed and pitch of generated voiceover, so that I can fine-tune the delivery to match my video pacing.

#### Acceptance Criteria

1. WHEN `generateVoiceover` is called with a `speed` value between 0.5 and 2.0 inclusive, THE `VoiceoverService` SHALL return an `AudioBuffer` whose duration equals the original synthesized duration divided by the `speed` value.
2. WHEN `generateVoiceover` is called with a `pitch` value between 0.5 and 2.0 inclusive, THE `VoiceoverService` SHALL return an `AudioBuffer` whose perceived pitch equals the original synthesized pitch multiplied by the `pitch` value.
3. IF `speed` is below 0.5, THEN THE `VoiceoverService` SHALL clamp it to 0.5 before processing. IF `speed` is above 2.0, THEN THE `VoiceoverService` SHALL clamp it to 2.0 before processing. The same bounds apply to `pitch`.
4. WHEN speed is adjusted, THE `VoiceoverService` SHALL scale each `wordTimings` entry such that `adjustedTimestamp = originalTimestamp / speed`, preserving alignment between the audio and the word timing data.
5. WHEN `generateVoiceover` is called without explicit `speed` or `pitch` values, THE `VoiceoverService` SHALL default both to `1.0`, leaving the audio duration and pitch unchanged.

---

### Requirement 8: TTS Model Selection

**User Story:** As a power user, I want to choose between TTS models of different sizes, so that I can trade off quality against download size and inference speed.

#### Acceptance Criteria

1. THE `VoiceoverService` SHALL support at least two selectable TTS model variants, each declaring its `downloadSizeBytes` as an integer number of bytes.
2. WHEN `selectModel` is called with a valid `TTSModelId`, THE `VoiceoverService` SHALL set `stage` to `"idle"`, unload the currently loaded model, and begin loading the newly selected model. IF the new model fails to load, THEN `stage` SHALL be set to `"error"` with a message identifying the failed model.
3. THE `useTTSModelStore` SHALL expose a `selectedModel: TTSModelId` field and a `selectModel(id: TTSModelId) => void` action, following the same pattern as `useTranscriptionModelStore`.
4. WHEN `selectModel` is called, THE `useTTSModelStore` SHALL immediately update the `downloadSizeBytes` field to reflect the selected model's declared size.
