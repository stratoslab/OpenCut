# StratosCut Improvement Plan — Inspired by the WebGPU AI Video Ecosystem

> **Context:** StratosCut is a browser-native, local-first video editor with a Rust/WASM GPU pipeline, WebGPU rendering, in-browser AI (Whisper + Gemma LLM), multi-track timeline, keyframes, masks, and a command pattern. Currently has 1 effect (blur), 16 blend modes, 8 mask types, and stubbed AI agent execution.

> **Date:** 2026-05-18
> **Source Projects:** OpenReel Video, MasterSelects, KubeezCut, Twick, VideoAgent, Director, WebSR, Video-Use, AI Video Editor Pipeline

---

## Executive Summary

This plan identifies **30 improvements** across 6 categories, prioritized into 3 phases. The guiding principle: **borrow what fits our browser-native, local-first, Rust/WASM architecture** — reject anything that requires cloud dependencies or Python backends.

| Phase | Focus | Timeline | Impact |
|-------|-------|----------|--------|
| **P0 — Foundation** | GPU effects, blend modes, scopes, caching | 4-6 weeks | Critical |
| **P1 — AI Power** | Local AI upscaling, scene detection, agent execution | 6-8 weeks | High |
| **P2 — Polish & Reach** | SDK patterns, 3D, transitions GPU, export engine | 8-12 weeks | Medium |

---

## P0: Foundation — Close the Gap (4-6 weeks)

### 1. GPU Effects Library (from MasterSelects, KubeezCut, OpenReel)
**Inspiration:** MasterSelects has 30 GPU effects, KubeezCut has 13 GPU transitions, OpenReel has GPU-accelerated effects + AI upscaling shaders.

**Current state:** Only 1 effect (gaussian blur). The registry + Rust pipeline architecture is ready for expansion.

**What to build:**
- **Color correction** (brightness, contrast, saturation, temperature, tint) — single pass, ~50 lines WGSL
- **Chromatic aberration** — RGB channel offset, ~40 lines WGSL
- **Vignette** — radial darkening, ~30 lines WGSL
- **Sharpen** — unsharp mask, ~60 lines WGSL
- **Sepia / Grayscale / Invert** — basic color transforms, ~20 lines each
- **Pixelate / Mosaic** — block sampling, ~40 lines WGSL
- **Noise / Grain** — procedural noise overlay, ~30 lines WGSL
- **Lens distortion** — barrel/pincushion, ~80 lines WGSL
- **Glow / Bloom** — threshold + blur + additive blend, ~100 lines WGSL (multi-pass)
- **Color lookup table (LUT)** — 3D texture sampling, ~60 lines WGSL

**Architecture fit:** Perfect. Our `EffectPipeline` in Rust already handles multi-pass effects. Each effect follows the existing pattern: WGSL shader → register in `EffectPipeline::new()` → TypeScript definition → registry.

**Effort:** ~2 weeks for 10 effects (2-3 days each including TS definitions)

**WGSL budget:** ~600 additional lines (MasterSelects has 2,500+ total; we'd reach ~900 from current ~300)

---

### 2. Expand Blend Modes to 37 (from MasterSelects)
**Inspiration:** MasterSelects implements all 37 After Effects blend modes in a single 618-line WGSL composite shader.

**Current state:** 16 blend modes in `blend.wgsl`.

**What to add (21 more):**
- Subtract, Divide, Linear Dodge, Linear Burn
- Linear Light, Vivid Light, Pin Light, Hard Mix
- Reflect, Glow, Phoenix, Exclusion (if not present)
- Stencil Alpha, Silhouette Alpha, Stencil Luma, Silhouette Luma
- Darker Color, Lighter Color
- Component blend variants (Red, Green, Blue channel-specific)

**Architecture fit:** Direct extension of existing `blend.wgsl`. MasterSelects proves all 37 can live in one shader with a switch statement.

**Effort:** ~3-4 days

---

### 3. GPU-Accelerated Video Scopes (from MasterSelects, KubeezCut)
**Inspiration:** Both projects have real-time Histogram, Vectorscope, and Waveform monitors rendered via WebGPU.

**Current state:** No scopes.

**What to build:**
- **Histogram** — RGB + luminance distribution, compute shader reads frame, outputs 256-bin histogram
- **Vectorscope** — chrominance analysis for color grading accuracy
- **Waveform** — luminance distribution across frame width

**Architecture fit:** These are compute shaders that read the composited frame texture and output analysis data. Can run as a post-render pass without affecting the main pipeline. Display in a dockable panel.

**Effort:** ~1 week (3 scopes, ~200 lines WGSL total)

---

### 4. Frame Caching System (from MasterSelects, OpenReel)
**Inspiration:** MasterSelects has a 3-tier cache (300 VRAM textures, per-video cache, 900-frame RAM preview). OpenReel uses LRU cache for smooth playback.

**Current state:** No explicit frame caching. Every scrub re-renders from scratch.

**What to build:**
- **Tier 1 — VRAM cache:** Keep last N composited textures on GPU (evict LRU)
- **Tier 2 — RAM cache:** Keep decoded frames in system memory as ImageData/VideoFrame
- **Tier 3 — OPFS cache:** Persist rendered frames to disk for project reload

**Architecture fit:** Hook into the existing `RendererManager`. Before calling `renderFrame()`, check cache. After render, store result. Cache key: `(sceneId, frameTime, canvasSize, effectsHash)`.

**Effort:** ~1 week

**Impact:** Dramatically smoother scrubbing, especially for effect-heavy timelines.

---

### 5. GPU Transitions (from KubeezCut)
**Inspiration:** KubeezCut has 13 GPU-only transitions (fade, wipe, slide, flip, clockWipe, iris, dissolve, sparkles, glitch, lightLeak, pixelate, chromatic, radialBlur).

**Current state:** Transitions exist but are implemented in the canvas renderer (TypeScript), not on GPU.

**What to build:**
- Move existing transitions (crossfade, slide, wipe, zoom) to WGSL
- Add KubeezCut's best: iris, clockWipe, glitch, lightLeak, dissolve
- Single transition shader with a `transitionType` uniform and `progress` (0→1)

**Architecture fit:** Transitions are essentially a blend between two textures with a spatial/temporal modifier. Our compositor already handles multi-layer rendering — transitions are just a special blend mode between adjacent clips.

**Effort:** ~1 week (6 transitions, ~400 lines WGSL)

---

### 6. Export Engine Improvements (from OpenReel, MasterSelects)
**Inspiration:** OpenReel streams directly to disk during export (no in-memory blobs). MasterSelects captures `VideoFrame` straight from GPU canvas with zero staging buffers.

**Current state:** Export works but likely accumulates frames in memory.

**What to build:**
- Stream frames directly from GPU canvas to `MediaRecorder`/WebCodecs encoder
- Zero-copy path: `canvas.transferToImageBitmap()` → `VideoEncoder`
- Progress tracking with ETA
- Resume interrupted exports (cache completed frames to OPFS)

**Architecture fit:** Our Rust compositor already renders to a canvas surface. The export engine just needs to capture from that surface efficiently.

**Effort:** ~1 week

---

## P1: AI Power — Differentiate (6-8 weeks)

### 7. Real-Time AI Upscaling (from WebSR)
**Inspiration:** WebSR achieves 30fps real-time AI upscaling on integrated GPUs using WebGPU compute shaders with Anime4K CNN architecture. Serves 250k MAU with zero server costs.

**Current state:** No AI upscaling.

**What to build:**
- Port WebSR's Anime4K CNN shaders to our Rust/WASM pipeline
- Support 3 network sizes: small (2x, fast), medium (2x, balanced), large (2x, quality)
- Pre-trained weights for: Animation, Real Life, 3D content
- Dynamic network switching at runtime
- Integrate as an effect in our registry

**Architecture fit:** WebSR's shaders are WGSL compute shaders — directly portable to our Rust `EffectPipeline`. The shader code is open and hand-written. Our pipeline already supports multi-pass effects.

**Effort:** ~2 weeks (port shaders + integrate weights + UI)

**Impact:** This is a killer feature. No other open-source browser editor has real-time AI upscaling.

---

### 8. AI Scene Classification & Auto-Highlights (from AI Video Editor Pipeline)
**Inspiration:** The AI Video Editor Pipeline uses ResNet-50 + CLIP + Qwen2.5-VL to classify scenes and assign speed ratings (Interesting=1x, Boring=6x), then auto-generates highlight reels.

**Current state:** We have basic scene detection (histogram-based chi-squared distance). No semantic understanding.

**What to build (browser-native approach):**
- Use our existing Gemma LLM (already integrated) for scene description
- Sample frames at 2s intervals → encode as base64 → send to Gemma with vision capabilities (or use a lightweight vision model via `@huggingface/transformers`)
- Classify: Showcase, Interesting, Moderate, Low, Boring, Skip
- Auto-generate highlight reel from top-rated scenes
- Speed ramping: assign playback rate based on classification

**Alternative (lighter):** Use CLIP-ViT via `@huggingface/transformers` (already a dependency) for zero-shot classification with prompts like "interesting scene", "boring scene", "action shot".

**Architecture fit:** Our scene detection already extracts frames. Replace chi-squared with AI classification. Output feeds into existing timeline operations (retime, split, delete).

**Effort:** ~2 weeks

---

### 9. SAM2 Object Segmentation (from MasterSelects)
**Inspiration:** MasterSelects has SAM2 (Segment Anything Model 2) for AI object selection — click to mask, propagate across frames. Runs on-device via ONNX Runtime (~220MB model loaded on demand).

**Current state:** We have 8 mask types (split, cinematic-bars, rectangle, ellipse, heart, diamond, star, text) + freeform bezier paths. No AI-assisted masking.

**What to build:**
- Integrate SAM2 via `@huggingface/transformers` (supports ONNX models with WebGPU)
- Click on preview → generate mask → convert to our existing mask format
- Propagate mask across frames (temporal consistency)
- Load model on-demand (don't bloat initial bundle)

**Architecture fit:** Our mask system already supports freeform paths and feathering via JFA. SAM2 output would be a new mask type (`ai-segmentation`) that generates a path or alpha mask.

**Effort:** ~2 weeks (model integration + UI + mask conversion)

---

### 10. Activate AI Agent Execution (from Video-Use, VideoAgent)
**Inspiration:** Video-Use uses coding agents with 12 hard rules, self-evaluation loops, and parallel sub-agents. VideoAgent uses graph-powered multi-agent orchestration for video understanding and editing.

**Current state:** We have 19 action types defined and an AI agent planning system, but `executeStep()` is a stub (`setTimeout`).

**What to build:**
- **Implement `executeStep()`** — map each of the 19 action types to actual `CommandManager` calls
- **Add self-evaluation** — after each action, verify the result (e.g., clip was actually split, effect was actually applied)
- **Add validation layer** — reject impossible actions before execution (e.g., can't split a 0.1s clip)
- **Parallel execution** — independent actions (e.g., add effect to clip A + add effect to clip B) can run in parallel
- **Session memory** — persist agent state to IndexedDB so conversations continue across page reloads

**Architecture fit:** Perfect. Our `CommandManager` already handles all 19 action types. The agent just needs to call the right commands. The command pattern with undo/redo makes self-evaluation trivial (execute → verify → undo if failed).

**Effort:** ~1 week

---

### 11. Auto Color Grading (from Video-Use)
**Inspiration:** Video-Use auto color grades every segment (warm cinematic, neutral punch, or custom ffmpeg chain).

**Current state:** No auto color grading.

**What to build:**
- Analyze scene content using CLIP or Gemma (already integrated)
- Classify mood: warm, cool, dramatic, natural, vintage
- Apply corresponding LUT or color correction parameters
- Per-segment grading with smooth transitions between grades

**Architecture fit:** Our color correction effects (from P0 #1) provide the building blocks. The AI classification determines which preset to apply. Applied as an effect on each clip.

**Effort:** ~1 week (after color correction effects are built)

---

### 12. Local Whisper Transcription Improvements (from KubeezCut, MasterSelects)
**Inspiration:** KubeezCut offers 4 Whisper model sizes (Tiny, Base, Small, Large v3 Turbo) fully local. MasterSelects runs local Whisper via Transformers.js.

**Current state:** We already have Whisper via `@huggingface/transformers` with model selection.

**What to improve:**
- Add model progress indicator during download (currently may feel stuck)
- Cache downloaded models in IndexedDB/OPFS (avoid re-download)
- Add word-level confidence scores (for smart cut accuracy)
- Speaker diarization (multiple speakers in transcript)

**Effort:** ~3-4 days

---

### 13. AI-Powered B-Roll Auto-Insert (from VideoAgent + existing B-Roll spec)
**Inspiration:** VideoAgent's storyboard agent transforms user input into optimized visual queries and auto-assembles content.

**Current state:** We have a `broll-suggestions` spec with keyword-based detection.

**What to build:**
- Use transcript context to suggest relevant B-roll moments (already partially built)
- Auto-insert B-roll from user's media library based on semantic similarity
- Use CLIP embeddings to match B-roll to transcript keywords
- Timeline auto-placement with smart duration calculation

**Architecture fit:** Our B-roll spec already defines the data model. CLIP is available via `@huggingface/transformers`. Auto-insert uses existing `InsertElementCommand`.

**Effort:** ~1 week

---

## P2: Polish & Reach — Go Further (8-12 weeks)

### 14. Modular SDK Architecture (from Twick)
**Inspiration:** Twick is designed as a 12-package SDK with 3 integration levels (Full Studio, Core Editor Shell, Headless/API-only).

**Current state:** Monolithic `web-vite` app with shared Rust crates.

**What to build:**
- Extract `@opencut/timeline` — timeline model, tracks, operations, undo/redo
- Extract `@opencut/renderer` — GPU rendering engine (Rust/WASM wrapper)
- Extract `@opencut/effects` — effect definitions + WGSL shaders
- Extract `@opencut/ai` — transcription, LLM, agent execution
- Keep `@opencut/studio` — full UI (current web-vite app)

**Architecture fit:** Our Rust crates are already modular (`compositor`, `effects`, `gpu`, `masks`, `time`). The TypeScript side needs extraction. This enables headless use cases (API-only video processing).

**Effort:** ~3 weeks (significant refactoring)

---

### 15. Action-Based Serializable Engine (from OpenReel)
**Inspiration:** OpenReel's entire engine is action-based — every edit is a serializable action object, making it scriptable, version-controllable, and natively ready for AI agents.

**Current state:** We have a command pattern, but actions aren't fully serializable/exportable.

**What to build:**
- Make every command JSON-serializable with a versioned schema
- Add action log export/import (replay an entire edit session)
- Add action diff (compare two project states as action sequences)
- Enable "edit scripts" — JSON files that describe edits, runnable headlessly

**Architecture fit:** Our `CommandManager` already has `execute()` and `undo()`. Adding `serialize()` and `deserialize()` is natural. This also makes the AI agent more powerful (it can generate action scripts).

**Effort:** ~1 week

---

### 16. 3D Layer Support (from MasterSelects)
**Inspiration:** MasterSelects has Three.js per-layer 3D transforms, OBJ/glTF/GLB/FBX/PLY/SPLAT model import, and primitive mesh creation.

**Current state:** No 3D support.

**What to build:**
- Lazy-load Three.js (isolated scene renderer, like MasterSelects)
- Per-layer 3D transforms (position, rotation, scale in 3D space)
- Import 3D models (glTF/GLB as primary, OBJ as secondary)
- Composite 3D layers into the 2D timeline

**Architecture fit:** Our compositor already handles layer transforms (position, rotation, scale, opacity, flip in 2D). Extending to 3D requires a separate Three.js renderer that outputs to a texture, which then feeds into our WebGPU compositor.

**Effort:** ~2 weeks

---

### 17. Keyframe Animation System Expansion (from MasterSelects, KubeezCut)
**Inspiration:** MasterSelects has bezier curves, copy/paste, tick marks, 5 easing modes. KubeezCut has graph/sheet/split view with Bezier editor.

**Current state:** We have 3 channel types (Number, Color, Discrete) with basic interpolation.

**What to build:**
- Bezier curve editor UI (visual curve manipulation)
- More easing modes (ease-in-out, bounce, elastic, custom)
- Keyframe copy/paste across properties and clips
- Keyframe tick marks on timeline
- Graph editor view (like KubeezCut's graph view)
- Keyframe snapping

**Effort:** ~2 weeks

---

### 18. Multi-Output Routing (from MasterSelects)
**Inspiration:** MasterSelects has live video output for VJ performances — route different compositions to different outputs simultaneously.

**Current state:** Single output (the preview canvas).

**What to build:**
- Support multiple output canvases
- Route different compositions/scenes to different outputs
- Useful for: live streaming, VJ performances, multi-monitor setups

**Architecture fit:** Our compositor renders to a surface. Supporting multiple surfaces means multiple `renderFrame()` calls with different output targets. The Rust side already supports this pattern.

**Effort:** ~1 week

---

### 19. Native Helper Bridge (from MasterSelects)
**Inspiration:** MasterSelects has a Rust native helper that opens localhost WebSocket/HTTP ports for features the browser can't do (yt-dlp downloads, AI tool bridging).

**Current state:** Pure browser, no native helper.

**What to build:**
- Optional Rust native helper binary
- Localhost HTTP/WebSocket bridge
- Features: download videos from URLs (yt-dlp), bridge to external AI APIs, file system access beyond browser sandbox
- Desktop app (GPUI) would integrate this natively

**Architecture fit:** We already have a `desktop/` app in GPUI and Rust crates. The native helper would be a new crate that both the desktop app and browser (via WebSocket) can use.

**Effort:** ~2 weeks

---

### 20. Proxy System (from MasterSelects)
**Inspiration:** MasterSelects has GPU-accelerated proxy generation with resume and cache indicator for smooth editing of 4K+ footage.

**Current state:** No proxy system.

**What to build:**
- Generate lower-resolution proxies for high-res media
- GPU-accelerated downscaling (WebGPU compute shader)
- Proxy cache with indicator in UI
- Automatic proxy use during editing, full-res during export
- Resume interrupted proxy generation

**Effort:** ~1 week

---

### 21. Audio Engine Expansion (from OpenReel, MasterSelects)
**Inspiration:** OpenReel has Web Audio API with EQ, reverb, compressor, beat detection, audio mixing. MasterSelects has 10-band live EQ, audio master clock, varispeed.

**Current state:** Basic waveform visualization, volume keyframes, sound library.

**What to build:**
- 10-band EQ per audio track
- Audio effects: reverb, compressor, limiter, noise gate
- Beat detection (for auto-sync edits to music)
- Audio master clock (sync playback to audio tempo)
- Varispeed (change speed without changing pitch, via SoundTouch — already a dependency)

**Effort:** ~2 weeks

---

### 22. Text Animation System (from OpenReel)
**Inspiration:** OpenReel has 20+ text animations with keyframe support.

**Current state:** Basic text elements with position/rotation/scale keyframes.

**What to build:**
- Preset text animations: typewriter, fade-in, slide-in, bounce, blur-in, glitch, neon glow
- Per-character animation support
- Text animation keyframe presets (apply with one click)
- Animated text on path

**Effort:** ~1 week

---

### 23. Project Bundling & Portability (from KubeezCut)
**Inspiration:** KubeezCut bundles entire projects (media + edits) into portable files.

**Current state:** Projects saved to IndexedDB, media referenced by URL/blob.

**What to build:**
- Export project as a single bundle file (ZIP or custom format)
- Bundle includes: timeline state, effects, media files, AI model references
- Import bundle on another machine
- Version the bundle format for forward/backward compatibility

**Effort:** ~1 week

---

### 24. Undo/Redo Expansion (from OpenReel)
**Inspiration:** OpenReel has action-based editing history with full undo/redo.

**Current state:** We have undo/redo via `CommandManager`, but limited scope.

**What to build:**
- Expand undo scope to cover ALL operations (currently may miss some)
- Undo history panel (visual list of actions, jump to any point)
- Selective undo (undo a specific action in the middle of the history)
- History persistence across page reloads

**Effort:** ~1 week

---

### 25. Performance Optimizations (from MasterSelects, KubeezCut)
**Inspiration:** MasterSelects achieves 660 KB gzip initial load with only 13-14 production dependencies. KubeezCut has GPU pipeline caching that saves 50-100ms.

**Current state:** Unknown bundle size, no explicit performance targets.

**What to build:**
- Audit bundle size, set target (<1MB gzip)
- Lazy-load heavy features (AI models, Three.js, audio engine)
- GPU pipeline caching (cache WebGPU adapter + device)
- Code splitting by feature chunk
- Vite manual chunk splitting (avoid TDZ cycles)

**Effort:** ~1 week

---

## Features Rejected (Don't Fit Our Architecture)

| Feature | Source | Why Rejected |
|---------|--------|-------------|
| Cloud AI APIs (OpenAI, Gemini, PiAPI) | MasterSelects, Director | We're local-first, browser-native |
| Python-based pipelines | VideoAgent, Director, AI Video Editor Pipeline | We're TypeScript + Rust/WASM |
| AWS Lambda render server | Twick | We render client-side |
| FFmpeg WASM as primary engine | Twick, OpenReel | We use WebCodecs + WebGPU, FFmpeg is heavier |
| Server-side transcription | Twick | We use local Whisper |
| YouTube API integration | AI Video Editor Pipeline | Out of scope for an editor |
| DaVinci Resolve FCPXML export | AI Video Editor Pipeline | We're browser-native, not NLE interchange |
| Multi-LLM orchestration (Claude + GPT + Gemini) | VideoAgent | We use local Gemma, keep it simple |
| External agent HTTP bridge for Claude Code | MasterSelects | Our AI agent runs in-browser |

---

## Implementation Priority Matrix

```
HIGH IMPACT │ 7. AI Upscaling     1. GPU Effects     8. Scene Classification
            │ 10. Agent Execution  2. Blend Modes     4. Frame Caching
            │                      3. Scopes          5. GPU Transitions
            │                      11. Auto Color     6. Export Engine
            │                      12. Whisper++      13. B-Roll Auto
            │                      9. SAM2 Segmentation
            │
LOW IMPACT  │ 14. SDK Architecture 16. 3D Support     18. Multi-Output
            │ 15. Action Serializable 17. Keyframes++  20. Proxy System
            │ 21. Audio Engine      19. Native Helper  22. Text Animations
            │ 23. Project Bundle    24. Undo/Redo++    25. Performance
            │
            └────────────────────────────────────────────────────
              LOW EFFORT          MEDIUM EFFORT       HIGH EFFORT
```

---

## Quick Wins (Under 1 Week Each)

1. **Expand blend modes to 37** — ~3-4 days, high impact
2. **Activate AI agent execution** — ~1 week, critical for AI features
3. **GPU scopes (Histogram, Vectorscope, Waveform)** — ~1 week, professional feel
4. **GPU transitions** — ~1 week, moves off CPU
5. **Auto color grading** — ~1 week (after color effects), wow factor
6. **Action-based serialization** — ~1 week, enables scripting
7. **Proxy system** — ~1 week, 4K editing usability
8. **Whisper improvements** — ~3-4 days, quality of life
9. **Project bundling** — ~1 week, portability
10. **Undo/redo expansion** — ~1 week, reliability

---

## WGSL Shader Budget Projection

| Category | Current | After P0 | After P1 | After P2 |
|----------|---------|----------|----------|----------|
| Core (blit, fullscreen) | ~50 | ~50 | ~50 | ~50 |
| Compositor (layer, blend, mask) | ~200 | ~350 | ~350 | ~350 |
| Effects | ~100 | ~700 | ~900 | ~1,100 |
| Transitions | 0 | ~400 | ~400 | ~400 |
| Scopes | 0 | ~200 | ~200 | ~200 |
| AI Upscaling (WebSR) | 0 | 0 | ~400 | ~400 |
| Masks (JFA) | ~150 | ~150 | ~150 | ~150 |
| **Total** | **~500** | **~1,850** | **~2,450** | **~2,650** |

For reference: MasterSelects has ~2,565 lines WGSL. We'd reach parity by end of P1.

---

## Dependency Impact

| New Dependency | Purpose | Source Inspiration | Size |
|---------------|---------|-------------------|------|
| None (WGSL only) | Effects, transitions, scopes, upscaling | MasterSelects, WebSR, KubeezCut | 0 KB |
| `@huggingface/transformers` (already have) | CLIP, SAM2, vision models | MasterSelects, KubeezCut | Already included |
| Three.js (lazy) | 3D layer support | MasterSelects | ~600 KB lazy |
| SoundTouch (already have) | Varispeed audio | OpenReel, MasterSelects | Already included |
| Native helper (Rust crate) | Browser-limiting features | MasterSelects | ~5 MB binary |

**Key insight:** Most improvements require zero new dependencies. We already have the right stack.

---

## Success Metrics

| Metric | Current | P0 Target | P1 Target | P2 Target |
|--------|---------|-----------|-----------|-----------|
| GPU Effects | 1 | 11 | 15 | 20+ |
| Blend Modes | 16 | 37 | 37 | 37 |
| GPU Transitions | 0 (CPU) | 6 | 10 | 13 |
| AI Features | 3 (Whisper, Gemma, Smart Cut) | 4 | 8 | 12 |
| WGSL Lines | ~500 | ~1,850 | ~2,450 | ~2,650 |
| Frame Cache | None | 3-tier | 3-tier + OPFS | Optimized |
| Bundle Size | Unknown | <1MB gzip | <1MB gzip | <800KB gzip |
| Export | Basic | Stream-to-disk | Resume support | Proxy-aware |

---

## Next Steps

1. **Review this plan** — decide which P0 items to tackle first
2. **Create specs** — each item above needs a `specs/` directory with requirements.md, design.md, tasks.md (following our existing pattern)
3. **Start with GPU Effects** — highest ROI, easiest to implement, builds momentum
4. **Parallelize** — effects can be built while caching system is developed
