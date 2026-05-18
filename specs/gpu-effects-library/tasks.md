# Tasks: GPU Effects Library

## Overview

Implement 10 new GPU effects following the existing registry pattern. Each effect includes a WGSL shader, Rust pipeline registration, TypeScript definition, and UI parameters. Multi-pass effects (glow) reuse existing shaders.

## Task Dependency Graph

```
Task 1: Color Correction ──┐
Task 2: Chromatic Aberr ───┤
Task 3: Vignette ──────────┤
Task 4: Sharpen ───────────┤
Task 5: Basic Color ───────┤
Task 6: Pixelate ──────────┤── Task 11: Registry Integration
Task 7: Noise ─────────────┤
Task 8: Lens Distortion ───┤
Task 9: Glow (3-pass) ─────┤
Task 10: Effect UI Panel ──┘
```

## Tasks

- [ ] **Task 1: Implement Color Correction Shader**
  - **What:** WGSL shader for brightness, contrast, saturation, temperature, tint. Single pass, per-pixel transform.
  - **Files:** Create `rust/crates/effects/src/shaders/color_correct.wgsl`, register in `EffectPipeline::new()`
  - **Done when:** All 5 parameters work independently, output clamped to [0,1], identity at defaults
  - **Depends on:** none

- [ ] **Task 2: Implement Chromatic Aberration Shader**
  - **What:** WGSL shader that offsets RGB channels radially from center. Intensity + angle parameters.
  - **Files:** Create `rust/crates/effects/src/shaders/chromatic_aberr.wgsl`, register in pipeline
  - **Done when:** RGB separation visible at intensity > 0, no effect at intensity = 0, single pass
  - **Depends on:** none

- [ ] **Task 3: Implement Vignette Shader**
  - **What:** WGSL shader for radial darkening from center. Intensity, radius, softness parameters.
  - **Files:** Create `rust/crates/effects/src/shaders/vignette.wgsl`, register in pipeline
  - **Done when:** Center pixel unchanged, edges darken based on intensity, softness controls blend
  - **Depends on:** none

- [ ] **Task 4: Implement Sharpen Shader**
  - **What:** WGSL shader using unsharp mask. Separable H+V passes for performance.
  - **Files:** Create `rust/crates/effects/src/shaders/sharpen.wgsl`, register in pipeline (2 passes: H + V)
  - **Done when:** Detail enhancement visible at intensity > 0, identity at 0, separable kernel
  - **Depends on:** none

- [ ] **Task 5: Implement Basic Color Transform Shaders**
  - **What:** Three WGSL shaders: sepia (warm brown tone), grayscale (BT.709 luminance), invert (RGB flip). Each with intensity parameter.
  - **Files:** Create `rust/crates/effects/src/shaders/sepia.wgsl`, `grayscale.wgsl`, `invert.wgsl`, register all
  - **Done when:** All three effects work with intensity blending, grayscale uses correct luminance coeffs
  - **Depends on:** none

- [ ] **Task 6: Implement Pixelate Shader**
  - **What:** WGSL shader that samples block centers and fills blocks. Block size parameter (2-100).
  - **Files:** Create `rust/crates/effects/src/shaders/pixelate.wgsl`, register in pipeline
  - **Done when:** Block grid alignment correct, identity at block_size=1, all pixels in block identical
  - **Depends on:** none

- [ ] **Task 7: Implement Noise/Grain Shader**
  - **What:** WGSL shader with GPU PRNG for per-frame noise. Intensity + monochrome parameters.
  - **Files:** Create `rust/crates/effects/src/shaders/noise.wgsl`, register in pipeline
  - **Done when:** Noise changes each frame, monochrome applies same value to RGB, uniform distribution
  - **Depends on:** none

- [ ] **Task 8: Implement Lens Distortion Shader**
  - **What:** WGSL shader for barrel/pincushion distortion. Distortion (-100 to 100) + zoom parameters.
  - **Files:** Create `rust/crates/effects/src/shaders/lens_distortion.wgsl`, register in pipeline
  - **Done when:** Barrel distortion at negative values, pincushion at positive, center pixel unchanged
  - **Depends on:** none

- [ ] **Task 9: Implement Glow/Bloom Effect (3-pass)**
  - **What:** Three-pass effect: threshold extraction → gaussian blur (reuse existing) → additive composite.
  - **Files:** Create `rust/crates/effects/src/shaders/glow_threshold.wgsl`, `glow_composite.wgsl`, register both. Reuse existing gaussian-blur.
  - **Done when:** Bright areas glow above threshold, blur radius adjustable, additive composite correct
  - **Depends on:** none

- [ ] **Task 10: Create TypeScript Effect Definitions**
  - **What:** Define all 10 effects in TypeScript with type, name, keywords, params[], renderer config. Register in index.
  - **Files:** Create `apps/web-vite/src/effects/definitions/color-correct.ts`, `chromatic-aberr.ts`, `vignette.ts`, `sharpen.ts`, `sepia.ts`, `grayscale.ts`, `invert.ts`, `pixelate.ts`, `noise.ts`, `lens-distortion.ts`, `glow.ts`. Update `index.ts`.
  - **Done when:** All effects appear in effects panel, parameters match design, pass configurations correct
  - **Depends on:** Tasks 1-9

- [ ] **Task 11: Update Effect UI Panel**
  - **What:** Ensure the existing effect UI panel renders sliders/inputs for all new effect parameters correctly.
  - **Files:** Modify `apps/web-vite/src/effects/components/` as needed
  - **Done when:** All parameters display with correct labels, ranges, and defaults. Real-time preview works.
  - **Depends on:** Task 10

- [ ] **Task 12: Write Property-Based Tests**
  - **What:** PBTs for each effect: identity at zero intensity, output clamping, single-pass execution, color accuracy for color correction.
  - **Files:** Create `apps/web-vite/src/effects/__tests__/` test files for each effect
  - **Done when:** All tests pass with 100+ cases each, performance <2ms per effect at 1080p
  - **Depends on:** Tasks 1-11
