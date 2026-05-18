# Tasks: Blend Modes Expansion

## Overview

Extend blend.wgsl from 16 to 37 blend modes by adding 21 new switch cases. Update Rust enum, TypeScript mapping, and UI. All modes in a single shader following MasterSelects' architecture.

## Task Dependency Graph

```
Task 1: Rust Enum ──→ Task 2: WGSL Shader ──→ Task 3: TypeScript Mapping ──→ Task 5: Tests
                                                    ↓
                                              Task 4: UI Update
```

## Tasks

- [ ] **Task 1: Extend Blend Mode Enum**
  - **What:** Add 21 new variants to the Rust BlendMode enum with correct u32 values (0-36).
  - **Files:** Modify `rust/crates/compositor/src/blend_mode.rs`
  - **Done when:** Enum compiles with all 37 variants, #[repr(u32)] ensures correct ordering
  - **Depends on:** none

- [ ] **Task 2: Implement 21 New Blend Modes in WGSL**
  - **What:** Add 21 new cases to blend.wgsl switch statement. Implement formulas for Linear Burn, Darker Color, Linear Dodge, Lighter Color, Vivid Light, Linear Light, Pin Light, Hard Mix, Subtract, Divide, Reflect, Glow, Phoenix, Stencil Alpha, Silhouette Alpha, Stencil Luma, Silhouette Luma, and 4 component variants.
  - **Files:** Modify `rust/crates/compositor/src/shaders/blend.wgsl`
  - **Done when:** All 37 modes compile, each produces correct output for test inputs, div-by-zero handled
  - **Depends on:** Task 1

- [ ] **Task 3: Update TypeScript Blend Mode Mapping**
  - **What:** Add 21 new entries to the TypeScript blend mode name → enum value mapping.
  - **Files:** Modify `apps/web-vite/src/compositor/blend-modes.ts`
  - **Done when:** All 37 modes accessible from TypeScript, names match UI labels
  - **Depends on:** Task 2

- [ ] **Task 4: Update Blend Mode UI**
  - **What:** Ensure the blend mode dropdown/selector displays all 37 modes with correct labels, grouped logically (Basic, Darken, Lighten, Contrast, Inverted, Component, Artistic, Stencil).
  - **Files:** Modify blend mode selector component in `apps/web-vite/src/`
  - **Done when:** User can select all 37 modes, dropdown is organized with group headers
  - **Depends on:** Task 3

- [ ] **Task 5: Write Blend Mode Tests**
  - **What:** Property-based tests: identity (Normal with src.a=0 returns dst), commutativity (Multiply), edge cases (src/dst = 0 or 1), alpha correctness. Reference comparison against known values.
  - **Files:** Create `rust/crates/compositor/src/shaders/blend_test.rs` or equivalent
  - **Done when:** All 37 modes pass correctness tests, edge cases handled, no NaN/Infinity outputs
  - **Depends on:** Task 2
