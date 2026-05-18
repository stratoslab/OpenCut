# Tasks: AI Co-Pilot Transcript Context

## Overview

Wire the existing Whisper transcript into the AI Co-Pilot's plan generation context. Five files need small, isolated changes: add an optional field to the scene type, store the transcript after transcription, pass it through serialization, and read it in the AiAgentPanel. No new infrastructure needed.

## Task Dependency Graph

```
Task 1 (timeline/types.ts)
  ↓
Task 2 (storage/service.ts + types.ts)
  ↓
Task 3 (subtitles/assets-view.tsx)
  ↓
Task 4 (ai/prompt-templates.ts)
  ↓
Task 5 (ai/components/AiAgentPanel.tsx)
```

Tasks 2–3 could be done in parallel, but Task 3 depends on Task 1 being merged (the `transcript` field must exist on `TScene` before it can be set).

## Tasks

- [x] **Task 1: Add `transcript` field to `TScene` interface**
  - **What:** Add `transcript?: WordTranscript` to the `TScene` interface in `timeline/types.ts`. Import `WordTranscript` from `@/transcription/types`. This is a single-line type addition.
  - **Files:**
    - `apps/web-vite/src/timeline/types.ts` — add import and field
  - **Done when:** `TScene` has an optional `transcript` field typed as `WordTranscript | undefined`, and the project compiles without errors
  - **Depends on:** none

- [x] **Task 2: Wire `transcript` through storage serialization**
  - **What:** The `saveProject()` and `loadProject()` methods in `StorageService` explicitly map each scene field. Add `transcript` to both maps so it round-trips through IndexedDB save/load.
    - In `saveProject()`: add `transcript: scene.transcript` to the serialized scene object
    - In `loadProject()`: add `transcript: scene.transcript` to the deserialized scene object (it's already optional so it'll be `undefined` for old projects)
  - **Files:**
    - `apps/web-vite/src/services/storage/service.ts` — lines ~138-146 (serialization) and ~197-206 (deserialization)
  - **Done when:** A project with a transcript survives page refresh — save, reload, and the transcript is still accessible on the scene
  - **Depends on:** Task 1

- [x] **Task 3: Store `WordTranscript` on scene after transcription**
  - **What:** In the Captions panel (`assets-view.tsx`), after `transcribe()` succeeds:
    1. Call `transcriptionService.transcribeToWords()` with the same audio data instead of (or in addition to) `transcribe()`
    2. Get the resulting `WordTranscript`
    3. Store it on the active scene via the existing `editor.scenes` API (likely `updateScene()` or direct mutation through the ScenesManager)
    - The scene's `transcript` field should be set. If re-transcription happens, it replaces the old value.
  - **Files:**
    - `apps/web-vite/src/subtitles/components/assets-view.tsx` — add `transcribeToWords()` call and scene update after successful transcription
  - **Done when:** After transcription completes, `editor.scenes.getActiveScene().transcript` contains a valid `WordTranscript` with the full text
  - **Depends on:** Task 1

- [x] **Task 4: Escape transcript text in prompt template**
  - **What:** The `buildPlanPrompt()` interpolates transcript text into a template literal. If the transcript contains backticks (`` ` ``) or `${...}` patterns, they would break the template. Add simple sanitization:
    - Replace `` ` `` with `'` in the transcript string
    - Replace `${` with `$` + `{` (or equivalent safe escape)
    - Apply this only to the `transcript` interpolation, not to other fields
  - **Files:**
    - `apps/web-vite/src/ai/prompt-templates.ts` — sanitize transcript text before interpolation (around line 15)
  - **Done when:** A transcript containing backticks, `${...}`, or JSON-special characters produces a valid prompt that the LLM can parse
  - **Depends on:** Task 1

- [x] **Task 5: Read transcript and include in `AiAgentPanel` context**
  - **What:** In `AiAgentPanel.tsx`, when building the `context` object for `generatePlan()`:
    1. After getting the active scene (`editor.scenes.getActiveScene()`), extract `scene.transcript?.fullText`
    2. If the transcript is longer than ~12,000 characters, truncate to 12,000 chars and append `... [truncated]`
    3. Include it as `context.transcript`
    4. If no transcript exists, `context.transcript` remains `undefined` (existing behavior)
  - **Files:**
    - `apps/web-vite/src/ai/components/AiAgentPanel.tsx` — modify `handleGeneratePlan()` around lines 67-80
  - **Done when:** When a transcript exists, the prompt sent to the LLM includes the transcript text. When none exists, the prompt says "none" (existing behavior).
  - **Depends on:** Task 1, Task 4

## Property-Based Tests

- [x] **Task 6: Write property-based tests for transcript serialization round-trip**
  - **What:** Implement a test that:
    - Generates random `WordTranscript` objects (varying lengths, special characters, empty strings)
    - Simulates the serialize/deserialize flow through `SerializedScene`
    - Verifies the round-tripped `WordTranscript` is identical to the original
    - Generates at least 100 random cases
  - **Files:**
    - `apps/web-vite/src/services/storage/__tests__/transcript-roundtrip.test.ts` (new file)
  - **Done when:** Test runs, generates 100+ random cases covering edge chars (`\n`, `${`, `` ` ``, quotes, non-ASCII), and all pass
  - **Depends on:** Task 1, Task 2

- [x] **Task 7: Write unit test for transcript truncation in AiAgentPanel**
  - **What:** Extract the truncation logic from Task 5 into a pure function and test:
    - Transcript under 12,000 chars → returned as-is
    - Transcript over 12,000 chars → truncated with `... [truncated]` suffix
    - Empty transcript → returns `undefined`
    - Exactly 12,000 chars → returned as-is (boundary case)
  - **Files:**
    - `apps/web-vite/src/ai/__tests__/transcript-context.test.ts` (new file, or add to `agent.test.ts`)
  - **Done when:** All truncation edge cases pass with correct output
  - **Depends on:** Task 5
