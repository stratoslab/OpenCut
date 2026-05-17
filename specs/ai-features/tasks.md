# Tasks: AI Features Suite

## Overview

Implement three AI-powered features (Co-Pilot Agent, Scene Detection, YouTube Chapters Export) with shared infrastructure for video frame extraction and histogram computation. All processing runs client-side in the browser.

## Task Dependency Graph

```
Task 1: FrameExtractor ──┬── Task 3: SceneDetector ── Task 4: SceneDetectPanel ──┐
                         │                                                      │
Task 2: HistogramCalc ───┘                                                      ├── Task 7: AiAgent
                                                                                │
Task 5: ChapterExporter ── Task 6: YouTubeExportPanel ──────────────────────────┘
                                                                                │
Task 8: AiAgentPanel ───────────────────────────────────────────────────────────┘
                                                                                │
Task 9: PBTs ───────────────────────────────────────────────────────────────────┘
```

## Tasks

- [x] **Task 1: Create FrameExtractor service**
  - **What:** Implement a shared service that extracts frames from video File objects at specified timestamps using HTMLVideoElement + OffscreenCanvas. Supports a pool of max 2 concurrent video elements to avoid memory leaks.
  - **Files:** Create `apps/web-vite/src/video/frame-extractor.ts`
  - **Done when:** `extractFrame(file, time)` returns ImageData at the correct timestamp, handles seek errors gracefully, and releases video elements when idle
  - **Depends on:** none

- [x] **Task 2: Create HistogramCalculator service**
  - **What:** Implement a pure function that computes 24-bin RGB color histograms from ImageData (8 bins per channel: R, G, B). Values 0-255 divided into 8 equal buckets of 32 values each.
  - **Files:** Create `apps/web-vite/src/video/histogram-calculator.ts`
  - **Done when:** `computeHistogram(imageData)` returns Float64Array of length 24, identical inputs produce identical outputs, black image produces all-zero histogram
  - **Depends on:** none

- [x] **Task 3: Create SceneDetector service with Web Worker**
  - **What:** Implement scene detection that extracts frames at configurable intervals, computes histograms, calculates chi-squared distance between consecutive frames, and flags peaks above threshold. Runs in a Web Worker. Returns SceneChange[] with timestamps, distances, and before/after thumbnails.
  - **Files:** Create `apps/web-vite/src/video/scene-detector.ts`, `apps/web-vite/src/video/scene-detector.worker.ts`
  - **Done when:** `detectScenes(file, { intervalSec, threshold })` returns correct scene changes for a test video with known cuts, processes without blocking main thread, memory stays under 50MB for long videos
  - **Depends on:** Task 1, Task 2

- [x] **Task 4: Build SceneDetectPanel UI**
  - **What:** React component for scene detection — video clip selector, interval/threshold sliders, progress bar, results list with before/after thumbnails, "Add markers" button that creates timeline bookmarks at detected boundaries.
  - **Files:** Create `apps/web-vite/src/scene-detection/components/SceneDetectPanel.tsx`, add to assets panel tab bar
  - **Done when:** User can select a video, configure settings, run detection, see results with thumbnails, and click "Add markers" to create bookmarks on the timeline
  - **Depends on:** Task 3

- [x] **Task 5: Create ChapterExporter service**
  - **What:** Implement chapter formatting (`MM:SS Title` text output) and YouTube description generation. Chapter formatting is pure string manipulation. Description generation uses existing Gemma LLM with transcript + chapter context.
  - **Files:** Create `apps/web-vite/src/export/chapter-exporter.ts`
  - **Done when:** `formatChapters(chapters)` returns correctly formatted text with first chapter at 0:00 and monotonic timestamps, `generateDescription()` returns structured YouTube description object
  - **Depends on:** none

- [x] **Task 6: Build YouTubeExportPanel UI**
  - **What:** React component with editable chapter list (add/remove/rename), YouTube-format preview, one-click copy-to-clipboard, and "Generate Full Description" button that produces title + description + tags.
  - **Files:** Create `apps/web-vite/src/export/components/YouTubeExportPanel.tsx`, add entry point from export menu
  - **Done when:** User can view/edit chapters, copy formatted text to clipboard, and generate a full YouTube description with one click
  - **Depends on:** Task 5

- [x] **Task 7: Create AiAgent service**
  - **What:** Implement AI Co-Pilot service with plan generation (LLM prompting with project context), plan validation (verify action types and targets against 19 supported operations), and sequential step execution via CommandManager with single undo group and cancellation support.
  - **Files:** Create `apps/web-vite/src/ai/agent.ts`, `apps/web-vite/src/ai/types.ts`, `apps/web-vite/src/ai/prompt-templates.ts`, `apps/web-vite/src/ai/action-mapper.ts`
  - **Done when:** `generatePlan(goal, context)` returns validated EditingPlan, `executePlan(plan, callbacks)` runs steps sequentially with progress updates, `cancelExecution()` stops mid-plan, undo reverses all completed steps
  - **Depends on:** Task 4 (uses existing CommandManager patterns established across timeline)

- [x] **Task 8: Build AiAgentPanel UI**
  - **What:** React component for AI Co-Pilot — text input for goals, 6 quick preset buttons, plan review view (step list with descriptions), execute/cancel controls, progress bar during execution. Add as new tab in assets panel.
  - **Files:** Create `apps/web-vite/src/ai/components/AiAgentPanel.tsx`, register in assets panel tab bar
  - **Done when:** User can type a goal, see generated plan, review steps, execute with progress, cancel mid-execution, and use quick presets for common workflows
  - **Depends on:** Task 7

- [x] **Task 9: Write property-based tests**
  - **What:** Implement property-based tests for all correctness properties defined in requirements: histogram determinism, chi-squared symmetry, chapter format validation, action type validation, plan undo atomicity.
  - **Files:** Create `apps/web-vite/src/video/__tests__/histogram-calculator.test.ts`, `apps/web-vite/src/video/__tests__/scene-detector.test.ts`, `apps/web-vite/src/export/__tests__/chapter-exporter.test.ts`, `apps/web-vite/src/ai/__tests__/agent.test.ts`
  - **Done when:** All tests run with 100+ generated cases each, all correctness properties verified, test suite passes in CI
  - **Depends on:** Tasks 1-8

## Property-Based Tests

For each correctness property defined in requirements.md:

- [ ] **Task 9a: Histogram determinism**
  - **What:** Property-based test that generates random ImageData inputs and verifies `computeHistogram(a) === computeHistogram(a)` and `computeHistogram(black) === zeros`
  - **Files:** `apps/web-vite/src/video/__tests__/histogram-calculator.test.ts`
  - **Done when:** Test runs 200+ cases, all pass
  - **Depends on:** Task 2

- [ ] **Task 9b: Chi-squared properties**
  - **What:** Property-based test verifying `chiSquared(a, a) ≈ 0`, `chiSquared(a, b) === chiSquared(b, a)`, and `chiSquared(a, b) >= 0` for all random histogram pairs
  - **Files:** `apps/web-vite/src/video/__tests__/scene-detector.test.ts`
  - **Done when:** Test runs 200+ cases, all pass
  - **Depends on:** Task 3

- [ ] **Task 9c: Chapter format validation**
  - **What:** Property-based test generating random chapter lists and verifying output matches `/^\d{1,2}:\d{2} .+$/gm`, first line is `0:00`, timestamps are monotonic and ≤ duration
  - **Files:** `apps/web-vite/src/export/__tests__/chapter-exporter.test.ts`
  - **Done when:** Test runs 200+ cases, all pass
  - **Depends on:** Task 5

- [ ] **Task 9d: Action type validation**
  - **What:** Property-based test generating random action type strings and verifying only the 19 defined types are accepted, all others rejected
  - **Files:** `apps/web-vite/src/ai/__tests__/agent.test.ts`
  - **Done when:** Test runs 200+ cases, all pass
  - **Depends on:** Task 7

- [ ] **Task 9e: Plan undo atomicity**
  - **What:** Integration test that executes a multi-step plan, verifies undo reverses all steps (not just the last one), and timeline state matches pre-execution state
  - **Files:** `apps/web-vite/src/ai/__tests__/agent.test.ts`
  - **Done when:** Test covers 3+ step plans, undo restores exact pre-execution state
  - **Depends on:** Task 7, Task 8
