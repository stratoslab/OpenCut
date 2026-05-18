# Tasks: GPU Video Scopes

## Overview

Implement three GPU-accelerated video scopes (Histogram, Vectorscope, Waveform) as WebGPU compute shaders with dockable React panels. Scopes run as post-render passes, reading the composited frame texture.

## Task Dependency Graph

```
Task 1: Histogram Shader ──┐
Task 2: Vectorscope Shader ─┼── Task 4: Scope Manager ──→ Task 5: Panels ──→ Task 6: Tests
Task 3: Waveform Shader ────┘
```

## Tasks

- [ ] **Task 1: Implement Histogram Compute Shader**
  - **What:** WGSL compute shader that counts pixels per brightness level. 256 bins × 4 channels (R, G, B, Luma). Atomic adds for parallel reduction.
  - **Files:** Create `rust/crates/compositor/src/shaders/scopes/histogram.wgsl`, register in compositor
  - **Done when:** Outputs f32[1024] buffer, sum of bins = total pixels, pure white test produces peak at bin 255
  - **Depends on:** none

- [ ] **Task 2: Implement Vectorscope Compute Shader**
  - **What:** WGSL compute shader that maps RGB→YCbCr and plots chrominance on 256×256 circular display.
  - **Files:** Create `rust/crates/compositor/src/shaders/scopes/vectorscope.wgsl`, register in compositor
  - **Done when:** Pure gray at center, saturated colors at edge, hue angles correct (0°=red, 120°=green, 240°=blue)
  - **Depends on:** none

- [ ] **Task 3: Implement Waveform Compute Shader**
  - **What:** WGSL compute shader that plots luminance per column. Output W×128 texture, Y-axis = brightness.
  - **Files:** Create `rust/crates/compositor/src/shaders/scopes/waveform.wgsl`, register in compositor
  - **Done when:** Pure black = bottom row, pure white = top row, column count matches frame width
  - **Depends on:** none

- [ ] **Task 4: Create Scope Manager**
  - **What:** TypeScript manager that dispatches compute shaders after main render, manages async readback, tracks open scopes.
  - **Files:** Create `apps/web-vite/src/scopes/scope-manager.ts`
  - **Done when:** Can compute histogram/vectorscope/waveform from frame texture, async readback works, skip when scope closed
  - **Depends on:** Tasks 1-3

- [ ] **Task 5: Build Scope Panels**
  - **What:** Three React components: HistogramPanel (bar chart with RGB overlay), VectorscopePanel (circular chart), WaveformPanel (column plot). Dockable, resizable.
  - **Files:** Create `apps/web-vite/src/scopes/components/HistogramPanel.tsx`, `VectorscopePanel.tsx`, `WaveformPanel.tsx`
  - **Done when:** All three scopes display real-time data, hover shows values, panels dock/resize correctly
  - **Depends on:** Task 4

- [ ] **Task 6: Write Scope Tests**
  - **What:** Property-based tests for each scope: histogram bin sum, vectorscope center/edge, waveform column count. Performance tests <5ms each.
  - **Files:** Create `apps/web-vite/src/scopes/__tests__/` test files
  - **Done when:** All tests pass, performance targets met, all three scopes open maintains 30fps
  - **Depends on:** Tasks 1-5
