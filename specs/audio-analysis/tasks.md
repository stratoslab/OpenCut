# Tasks: Audio Analysis

## Tasks

- [x] **Task 1: Create BeatDetector**
  - **What:** FFT-based beat detection using OfflineAudioContext. Returns beat timestamps as number[].
  - **Files:** Create `apps/web-vite/src/audio-analysis/beat-detector.ts`
  - **Done when:** Beat detection completes within 5s for 5min audio, timestamps monotonically increasing
  - **Depends on:** none

- [x] **Task 2: Create AutoDucker**
  - **What:** Generate volume automation curves that lower background audio during speech regions with smooth attack/release.
  - **Files:** Create `apps/web-vite/src/audio-analysis/auto-duck.ts`
  - **Done when:** Volume changes are smooth, background returns to original after speech
  - **Depends on:** none

- [x] **Task 3: Create LoudnessNormalizer**
  - **What:** Measure LUFS per clip, calculate gain adjustment, apply normalization without clipping.
  - **Files:** Create `apps/web-vite/src/audio-analysis/loudness-normalizer.ts`
  - **Done when:** All clips within ±1 LUFS of target after normalization, no clipping
  - **Depends on:** none

- [ ] **Task 4: Build AudioAnalysisPanel**
  - **What:** Panel with beat detection button, auto duck toggle + controls, loudness normalization button + target LUFS input
  - **Files:** Create `apps/web-vite/src/audio-analysis/components/AudioAnalysisPanel.tsx`
  - **Done when:** User can run all three analyses, see results, apply changes
  - **Depends on:** Tasks 1-3

- [x] **Task 5: Write tests**
  - **What:** PBTs for beat detection (monotonic timestamps), auto duck (smooth curves), loudness normalization (±1 LUFS accuracy)
  - **Files:** Create `apps/web-vite/src/audio-analysis/__tests__/beat-detector.test.ts`, `auto-duck.test.ts`, `loudness-normalizer.test.ts`
  - **Done when:** All tests pass
  - **Depends on:** Tasks 1-4
