# Tasks: Export Engine Improvements

## Overview

Rewrite export engine with zero-copy frame capture, stream-to-disk via File System Access API, progress tracking with rolling-average ETA, resume support via OPFS, configurable export settings, and audio mixing.

## Task Dependency Graph

```
Task 1: Frame Capture ──┐
Task 2: Audio Mixer ─────┼── Task 4: Export Engine ──→ Task 5: Progress/ETA ──→ Task 7: UI
Task 3: Resume Manager ──┘         ↓
                             Task 6: Tests
```

## Tasks

- [ ] **Task 1: Implement Zero-Copy Frame Capture**
  - **What:** Capture frames from GPU canvas via `canvas.transferToImageBitmap()` → `new VideoFrame(bitmap)` → close bitmap immediately. No intermediate CPU copies.
  - **Files:** Create `apps/web-vite/src/export/frame-capture.ts`
  - **Done when:** Captures VideoFrame from canvas, peak memory does not grow with frame count, bitmap closed immediately
  - **Depends on:** none

- [ ] **Task 2: Implement Audio Mixer**
  - **What:** Mix multiple audio tracks into single stream using OfflineAudioContext. Extract audio for given time range, output as AudioData for encoding.
  - **Files:** Create `apps/web-vite/src/export/audio-mixer.ts`
  - **Done when:** Multiple tracks mixed correctly, relative volumes preserved, sample rate matches project, no sync drift
  - **Depends on:** none

- [ ] **Task 3: Implement Resume Manager**
  - **What:** Save/restore export state to OPFS. Store completed frame count, encoder config, partial file handle. Save every 100 frames. Clear on successful completion.
  - **Files:** Create `apps/web-vite/src/export/resume-manager.ts`
  - **Done when:** State persists across browser restart, resume continues from last frame, resumed output bit-identical to fresh
  - **Depends on:** none

- [ ] **Task 4: Rewrite Export Engine**
  - **What:** Orchestrate full pipeline: configure encoders, open file, loop through frames (capture → encode → mux → stream), finalize. Support MP4 (H.264) and WebM (VP9). Resolution scaling with aspect ratio preservation.
  - **Files:** Create `apps/web-vite/src/export/export-engine.ts`
  - **Done when:** Full export works with zero-copy, streams to disk, supports MP4/WebM, resolution scaling, audio mixing, cancel support
  - **Depends on:** Tasks 1-3

- [ ] **Task 5: Implement Progress Tracker with ETA**
  - **What:** Track frames encoded, calculate percentage, rolling average of last 30 frame times for ETA. Smooth updates, no jumping.
  - **Files:** Create `apps/web-vite/src/export/progress-tracker.ts`
  - **Done when:** Progress percentage accurate, ETA within 20% after 30 frames, smooth updates
  - **Depends on:** Task 4

- [ ] **Task 6: Write Export Tests**
  - **What:** Integration tests: zero-copy memory usage, valid MP4/WebM output, audio sync, resume correctness, resolution scaling, progress accuracy.
  - **Files:** Create `apps/web-vite/src/export/__tests__/` test files
  - **Done when:** Output files playable in standard players, resumed export bit-identical, audio sync < 1 frame drift, memory stable
  - **Depends on:** Tasks 1-5

- [ ] **Task 7: Build Export UI**
  - **What:** Export dialog with resolution selector (original/1080p/720p/480p), format (MP4/WebM), quality (low/medium/high), audio toggle. Progress bar with percentage + ETA. Cancel and resume buttons.
  - **Files:** Create `apps/web-vite/src/export/components/ExportDialog.tsx`
  - **Done when:** User can configure export, see real-time progress with ETA, cancel, and resume interrupted exports
  - **Depends on:** Tasks 4-5
