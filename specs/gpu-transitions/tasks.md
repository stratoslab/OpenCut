# Tasks: GPU Transitions

## Overview

Move 6 transitions from TypeScript canvas renderer to WebGPU. Single `transition.wgsl` shader with switch statement, Rust enum, TypeScript pass builder, and transition registry.

## Task Dependency Graph

```
Task 1: Rust Enum ──→ Task 2: transition.wgsl ──→ Task 3: Pass Builder ──→ Task 5: UI
                          ↓                            ↓
                    Task 4: Registry              Task 6: Tests
```

## Tasks

- [ ] **Task 1: Create Transition Enum**
  - **What:** Define Rust enum with 6 variants (Crossfade, Slide, Wipe, Iris, ClockWipe, Glitch) with #[repr(u32)] values 0-5.
  - **Files:** Create `rust/crates/compositor/src/transition_type.rs`
  - **Done when:** Enum compiles, values 0-5 correctly assigned
  - **Depends on:** none

- [ ] **Task 2: Implement transition.wgsl Shader**
  - **What:** Single WGSL shader with switch statement for all 6 transitions. Functions: crossfade, slide, wipe, iris, clockWipe, glitch. Two input textures + progress uniform.
  - **Files:** Create `rust/crates/compositor/src/shaders/transition.wgsl`, register in compositor
  - **Done when:** All 6 transitions compile, boundary correctness (progress 0/1 = clip A/B), no artifacts
  - **Depends on:** Task 1

- [ ] **Task 3: Create Transition Pass Builder**
  - **What:** TypeScript component that detects transition regions on timeline, calculates progress, builds EffectPass with transition uniforms.
  - **Files:** Create `apps/web-vite/src/services/renderer/transition-builder.ts`
  - **Done when:** Correctly detects transition regions, calculates progress, builds passes for compositor
  - **Depends on:** Task 2

- [ ] **Task 4: Create Transition Registry**
  - **What:** Define 8 transition definitions (crossfade, slide-left/right, wipe-left/right, iris, clock-wipe, glitch) with name, icon, defaultDuration.
  - **Files:** Create `apps/web-vite/src/transitions/definitions.ts`
  - **Done when:** All transitions registered, accessible from UI, default durations correct
  - **Depends on:** none

- [ ] **Task 5: Update Transition UI**
  - **What:** Replace existing canvas-based transition rendering with GPU transition pipeline. Update transition picker to show all 8 transitions.
  - **Files:** Modify transition components in `apps/web-vite/src/transitions/`
  - **Done when:** User can add GPU transitions between clips, preview works in real-time, all 8 transitions accessible
  - **Depends on:** Tasks 2-4

- [ ] **Task 6: Write Transition Tests**
  - **What:** Property-based tests: boundary correctness (progress 0/1), no artifacts at seams, performance <2ms at 1080p. Visual comparison for each transition type.
  - **Files:** Create `rust/crates/compositor/src/shaders/transition_test.rs` or equivalent
  - **Done when:** All tests pass, all 6 transitions correct at boundaries, performance targets met
  - **Depends on:** Task 2
