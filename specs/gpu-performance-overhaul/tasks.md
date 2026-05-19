# Tasks: GPU Performance Overhaul

## Overview

18 improvements across 4 phases to bring OpenCut's GPU compositor to professional-grade performance. Ordered by dependency: core infrastructure first, then shaders, then export/audio, then advanced features.

## Task Dependency Graph

```
Task 1 (Texture Pool) ──→ Task 2 (Backpressure) ──→ Task 3 (Bind Group Cache)
                                                        │
Task 4 (WGSL Common) ──→ Task 5 (Inline Effects) ──────┤
                                                        │
Task 6 (Effect Registry) ──────────────────────────────┤
                                                        │
Task 7 (Ping-Pong Compositor) ─────────────────────────┤
                                                        │
Task 8 (Transitions) ──────────────────────────────────┤
                                                        │
Task 9 (Scopes Compute) ───────────────────────────────┤
                                                        │
Task 10 (3D Transforms) ───────────────────────────────┤
                                                        │
Task 11 (Color Grading) ───────────────────────────────┤
                                                        │
Task 12 (SDF Shapes) ──────────────────────────────────┤
                                                        │
Task 13 (Mask Local UV) ───────────────────────────────┤
                                                        │
Task 14 (Device Recovery) ─────────────────────────────┤
                                                        │
Task 15 (WebCodecs Export) ────────────────────────────┤
                                                        │
Task 16 (Keyframe Caching) ────────────────────────────┤
                                                        │
Task 17 (Audio Decode-Ahead) ──────────────────────────┤
                                                        │
Task 18 (WSOLA) ───────────────────────────────────────┘
                                                        │
                                                        ▼
                                              Task 19: Integration + Benchmarks
```

## Tasks

### Phase 1: Core Infrastructure

- [ ] **Task 1: Texture Pool Compaction**
  - **What:** Add `compact()` method to `TexturePool`, include format in key, add metrics tracking
  - **Files:** `rust/crates/compositor/src/texture_pool.rs`
  - **Done when:** `compact()` destroys excess textures (keep max 2 per key), metrics report hit rate, key includes format
  - **Depends on:** none

- [ ] **Task 2: GPU Backpressure**
  - **What:** Add `GpuBackpressure` struct with `begin_frame()`/`end_frame()`, integrate into `render_frame()`
  - **Files:** `rust/crates/gpu/src/backpressure.rs`, `rust/crates/gpu/src/lib.rs`, `rust/wasm/src/compositor.rs`
  - **Done when:** `begin_frame()` returns false when >2 frames in flight, `end_frame()` decrements counter, render skips when busy
  - **Depends on:** none

- [ ] **Task 3: Bind Group Caching**
  - **What:** Add `BindGroupCache` struct with `get_or_create()`, `invalidate()`, `clear()`. Cache layer and blend bind groups by `"{layer_id}:{ping|pong}:{generation}"`
  - **Files:** `rust/crates/compositor/src/bind_group_cache.rs`, `rust/crates/compositor/src/compositor.rs`
  - **Done when:** Bind groups are cached and reused, invalidated on texture change, cleared on resolution change
  - **Depends on:** Task 1 (texture pool changes affect bind group lifecycle)

- [ ] **Task 4: Shared WGSL Library**
  - **What:** Create `common.wgsl` with rgb2hsv, hsv2rgb, rgb2hsl, hsl2rgb, luminance, gaussian, smootherstep, hash, noise2d, fbm, constants (PI, TAU, E). Prepend to all effect shaders at compile time.
  - **Files:** `rust/crates/gpu/src/shaders/common.wgsl`, `rust/crates/gpu/src/lib.rs`, `rust/crates/effects/src/pipeline.rs`
  - **Done when:** `COMMON_WGSL` constant exists, all effect shaders compile with it prepended, functions verified correct
  - **Depends on:** none

### Phase 2: Shader Improvements

- [ ] **Task 5: Inline Color Effects in Layer Shader**
  - **What:** Add `inline_brightness`, `inline_contrast`, `inline_saturation`, `inline_invert` to `LayerUniforms`. Apply in `layer.wgsl` fragment shader after sampling. Extend `FrameDescriptor` with `InlineEffectsDescriptor`.
  - **Files:** `rust/crates/compositor/src/shaders/layer.wgsl`, `rust/crates/compositor/src/frame.rs`, `rust/crates/compositor/src/compositor.rs`
  - **Done when:** Inline effects apply in layer shader, at defaults produce identical output, work with complex effects
  - **Depends on:** Task 4 (common.wgsl provides luminance function)

- [ ] **Task 6: Effect Registry**
  - **What:** Define `EffectDefinition` struct, `EffectCategory` enum, `EffectParam` struct. Create registration macro/function. Refactor `EffectPipeline` to use registry. Move each effect to its own module with definition constant.
  - **Files:** `rust/crates/effects/src/registry.rs`, `rust/crates/effects/src/definitions/*.rs` (one per effect), `rust/crates/effects/src/pipeline.rs`, `rust/crates/effects/src/types.rs`
  - **Done when:** All 15 effects registered, pipelines created from registry, effects queryable by category, unknown effect returns error
  - **Depends on:** Task 4 (common.wgsl used by effect shaders)

- [ ] **Task 7: Ping-Pong Compositing**
  - **What:** Replace per-layer texture pool allocation with 2 alternating textures. Implement `ensure_ping_pong()`, swap logic, bind group cache integration. Refactor `render_frame_to_texture()` and `render_frame()`.
  - **Files:** `rust/crates/compositor/src/compositor.rs`
  - **Done when:** Compositing uses exactly 2 textures regardless of layer count, output is pixel-identical to current implementation, memory doesn't grow with layers
  - **Depends on:** Task 1 (texture pool), Task 3 (bind group cache)

- [ ] **Task 8: Transition Shader Expansion**
  - **What:** Add 7 new transitions to `transition.wgsl`: dissolve (FBM noise + edge glow), sparkles (two-layer field), lightLeak (Gaussian blob + noise), pixelate (block grid + crossfade), chromatic (RGB offset + radial), radialBlur (zoom + spin), flip (3D scale distortion). Update transition type enum.
  - **Files:** `rust/crates/compositor/src/shaders/transition.wgsl`, `rust/crates/compositor/src/frame.rs`
  - **Done when:** 13 transitions total, each verified at progress=0.0 and 1.0, no shader compilation errors
  - **Depends on:** Task 4 (common.wgsl provides fbm, hash functions)

- [ ] **Task 9: Scopes Compute Shader Optimization**
  - **What:** Convert histogram, waveform, vectorscope to two-pass compute-then-render pattern. Create compute pipelines with atomic storage buffers. Add waveform parade mode, vectorscope graticule/skin tone line/color targets.
  - **Files:** `rust/crates/compositor/src/shaders/scopes/histogram_compute.wgsl`, `waveform_compute.wgsl`, `vectorscope_compute.wgsl`, `rust/crates/compositor/src/scopes.rs` (new)
  - **Done when:** Scopes use compute shaders, histogram has 4 atomic buffers, waveform has Gaussian spread + parade mode, vectorscope has graticule + skin tone line
  - **Depends on:** Task 4 (common.wgsl)

- [ ] **Task 10: 3D Transforms in Fragment Shader**
  - **What:** Add `pos_z`, `scale_z`, `rotation_x`, `rotation_y`, `perspective` to `LayerUniforms`. Implement 3D transform math in `layer.wgsl` fragment shader (per-pixel rotation, perspective projection).
  - **Files:** `rust/crates/compositor/src/shaders/layer.wgsl`, `rust/crates/compositor/src/frame.rs`
  - **Done when:** 3D transforms apply per-pixel, identity matches 2D result, perspective clips pixels behind camera
  - **Depends on:** Task 5 (inline effects share uniform buffer space)

- [ ] **Task 11: Color Grading Pipeline**
  - **What:** Create `color_grade.wgsl` with unified 512-byte uniform buffer. Implement: input CST (10 color spaces), gamut conversion (11 gamuts), tone mapping (hyperbolic rolloff), CDL, color wheels, 3D LUT (trilinear), HSL qualifier, power window. Register as effect.
  - **Files:** `rust/crates/effects/src/shaders/color_grade.wgsl`, `rust/crates/effects/src/definitions/color_grade.rs`
  - **Done when:** All 10 processing stages implemented, identity grading produces pixel-identical output, registered in effect registry
  - **Depends on:** Task 6 (effect registry)

- [ ] **Task 12: SDF Shape Rendering**
  - **What:** Create `ShapePipeline` with SDF shader. Implement: rounded rect, ellipse, polygon, line (capsule), arrow, circle, square, diamond. Anti-aliasing via smoothstep. Stroke support via SDF gradient.
  - **Files:** `rust/crates/compositor/src/shape_pipeline.rs` (new), `rust/crates/compositor/src/shaders/shape.wgsl` (new)
  - **Done when:** All 8 shapes render anti-aliased, dimensions match parameters within 1 pixel, stroke renders correctly
  - **Depends on:** Task 4 (common.wgsl)

- [ ] **Task 13: Mask in Layer-Local UV Space**
  - **What:** Modify `mask.wgsl` to transform mask UVs into layer-local coordinate space. Mask follows layer rotation, scale, position.
  - **Files:** `rust/crates/compositor/src/shaders/mask.wgsl`, `rust/crates/compositor/src/compositor.rs`
  - **Done when:** Mask transforms with layer, mask bounds match layer bounds, feathering produces smooth alpha transitions
  - **Depends on:** Task 7 (ping-pong compositor changes mask application flow)

- [ ] **Task 14: Device Loss Auto-Recovery**
  - **What:** Add device lost callback to `GpuContext`. JS-side recovery with 3 retries, 100ms delay. Recreate all pipelines, textures, bind groups on success. Notify user on failure.
  - **Files:** `rust/crates/gpu/src/context.rs`, `rust/wasm/src/gpu.rs`, JS-side integration
  - **Done when:** Device loss triggers recovery, succeeds within 3 attempts, project state preserved on failure
  - **Depends on:** none

### Phase 3: Export + Audio

- [ ] **Task 15: WebCodecs Export Pipeline**
  - **What:** JS-side: Create export orchestrator with `VideoEncoder` + `mp4-muxer`/`webm-muxer`. Pipelined double-buffer encoding (render frame N while encoding frame N-1). Zero-copy via `new VideoFrame(canvas)`. Fast path: packet remux for single unmodified clip. WASM-side: add `render_frame_to_canvas()`.
  - **Files:** `apps/web-vite/src/lib/export/export-orchestrator.ts` (new), `apps/web-vite/src/lib/export/video-encoder.ts` (new), `rust/wasm/src/compositor.rs`
  - **Done when:** Export uses WebCodecs, pipelined encoding works, zero-copy path active, packet remux fast path works, exported video matches timeline duration ±1 frame
  - **Depends on:** Task 7 (ping-pong compositor for efficient frame rendering)

- [ ] **Task 16: Temporal Keyframe Caching**
  - **What:** Create `KeyframeEvaluator` struct with per-property cached index. Implement `find_index_from_cache()` with cached check → forward search (4 frames) → binary search fallback. Newton-Raphson bezier evaluation.
  - **Files:** `rust/crates/keyframe/src/evaluator.rs` (new), `rust/crates/keyframe/src/lib.rs`, `rust/crates/types/src/keyframe.rs`
  - **Done when:** Cached evaluation produces identical results to non-cached, O(1) during sequential playback, binary search fallback works on seeks
  - **Depends on:** none

- [ ] **Task 17: Windowed Audio Decode-Ahead**
  - **What:** Create `AudioClipSource` with windowed buffer. Implement `update_buffer()` (extend/insert/evict), `get_sample()` (binary search + interpolation). JS-side: decode-ahead manager with prefetch for playhead.
  - **Files:** `rust/crates/audio/src/source.rs` (new), `rust/crates/audio/src/lib.rs` (new crate), JS-side decode manager
  - **Done when:** Buffer stays within size limit, evicts furthest segments, playhead always has audio available
  - **Depends on:** none

- [ ] **Task 18: WSOLA Time Stretcher**
  - **What:** Create `TimeStretcher` with WSOLA algorithm. Hann window (2048 samples), analysis hop (1024), cross-correlation search (±256 frames), circular synthesis buffer, normalization weights.
  - **Files:** `rust/crates/audio/src/time_stretcher.rs`
  - **Done when:** Speed=1.0 produces identical output, pitch preserved at other speeds, cross-correlation finds best alignment
  - **Depends on:** Task 17 (audio crate exists)

### Phase 4: Integration + Testing

- [ ] **Task 19: Integration Tests + Benchmarks**
  - **What:** Write integration tests for all 18 improvements. Add benchmark suite: compositing 1/5/10/20 layers, effects 1/5/10 in sequence, export 30s timeline, texture pool 1000 cycles. Property-based tests for correctness invariants.
  - **Files:** `rust/crates/compositor/tests/`, `rust/crates/effects/tests/`, `apps/web-vite/tests/benchmarks/`
  - **Done when:** All property-based tests pass (100+ cases each), benchmarks run and report metrics, 10-layer 1080p maintains ≥30fps
  - **Depends on:** Tasks 1-18

## Property-Based Tests

For each correctness property in requirements.md:

- [ ] **Test 1: Ping-pong compositing invariant** — Generate random layer configs (1-20 layers), verify output matches sequential blend reference, memory constant regardless of layer count
- [ ] **Test 2: Bind group cache invariant** — Generate random texture change patterns, verify bind group creation count ≤ changed layers
- [ ] **Test 3: Texture pool bounded memory** — Generate random acquire/release patterns, verify pool size ≤ 2 per key after compaction
- [ ] **Test 4: GPU backpressure invariant** — Generate random frame submission patterns, verify in-flight counter never exceeds 2 or goes below 0
- [ ] **Test 5: Effect registry validity** — Generate random effect parameter combinations, verify no shader compilation errors, uniform sizes are multiples of 16
- [ ] **Test 6: Transition boundary invariant** — For each of 13 transitions, verify output at progress=0.0 matches clip A, at progress=1.0 matches clip B
- [ ] **Test 7: Color grading identity** — Verify identity grading (all defaults) produces pixel-identical output
- [ ] **Test 8: 3D transform identity** — Verify identity 3D transform matches 2D transform result
- [ ] **Test 9: WSOLA speed=1.0** — Verify speed=1.0 produces identical output within floating-point tolerance
- [ ] **Test 10: Keyframe cache consistency** — Generate random keyframe sequences, verify cached evaluation matches non-cached evaluation
