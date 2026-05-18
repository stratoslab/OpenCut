# Tasks: Smart Cut

## Overview

Implement filler word detection, silence detection via Web Audio API, region merging, and timeline editing with ripple close. UI shows bar chart visualization and sensitivity controls.

## Task Dependency Graph

```
Task 1: FillerDetector ──┐
                          ├── Task 3: RegionMerger ── Task 4: SmartCutBar UI ── Task 6: PBTs
Task 2: SilenceDetector ──┘
```

## Tasks

- [ ] **Task 1: Create FillerDetector**
  - **What:** Scan transcript word segments for filler words using case-insensitive whole-word matching. Returns TimeRange[] with timestamps.
  - **Files:** Create `apps/web-vite/src/smart-cut/filler-detector.ts`
  - **Done when:** Given word segments, returns correct time ranges for "um", "uh", "like", etc. Case-insensitive, whole-word only.
  - **Depends on:** none

- [ ] **Task 2: Create SilenceDetector**
  - **What:** Analyze audio Float32Array via OfflineAudioContext, detect silence regions below configurable threshold with minimum duration.
  - **Files:** Create `apps/web-vite/src/smart-cut/silence-detector.ts`
  - **Done when:** `detect(audio, { threshold, minDuration })` returns non-overlapping TimeRange[] with correct boundaries, completes within 10s for 30min audio
  - **Depends on:** none

- [ ] **Task 3: Create RegionMerger**
  - **What:** Combine filler and silence time ranges, sort by start time, merge overlapping/adjacent regions.
  - **Files:** Create `apps/web-vite/src/smart-cut/region-merger.ts`
  - **Done when:** Merged regions never overlap, total duration <= sum of inputs, adjacent regions within 0.1s are merged
  - **Depends on:** none

- [ ] **Task 4: Build SmartCutBar UI**
  - **What:** Panel component showing filler count, silence regions as bar chart visualization, sensitivity slider (low/medium/high), review list, and "Remove All" button with confirmation.
  - **Files:** Create `apps/web-vite/src/smart-cut/components/SmartCutBar.tsx`
  - **Done when:** User can see filler/silence counts, adjust sensitivity, view regions, click "Remove All" to execute Smart Cut with ripple close
  - **Depends on:** Tasks 1-3

- [ ] **Task 5: Implement Timeline Editing**
  - **What:** Execute Smart Cut: split clips at region boundaries, delete filler/silence segments, ripple-close gaps, single undo entry.
  - **Files:** Create `apps/web-vite/src/smart-cut/smart-cut-executor.ts`
  - **Done when:** Timeline duration decreases by removed amount, no gaps remain, undo restores exact pre-cut state
  - **Depends on:** Task 3

- [ ] **Task 6: Write property-based tests**
  - **What:** PBTs for filler detection (case insensitivity, whole-word), silence detection (non-overlapping, min duration, sensitivity monotonicity), region merging (no overlaps), timeline editing (duration decrease, undo)
  - **Files:** Create `apps/web-vite/src/smart-cut/__tests__/filler-detector.test.ts`, `silence-detector.test.ts`, `region-merger.test.ts`
  - **Done when:** All tests pass with 200+ cases each
  - **Depends on:** Tasks 1-5
