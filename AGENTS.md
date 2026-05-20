# Agents.md

## Architecture

An ongoing migration is moving all business logic into `rust/`. Each app under `apps/` is a UI shell — it owns rendering, interaction, and platform-specific concerns, but never owns logic. The UI framework for any given app is a replaceable detail.

### `rust/`

The single source of truth for all non-UI code. Everything platform-agnostic belongs here: no components, no hooks, no framework imports.

### `apps/`

Each app is a frontend that calls into Rust. Logic is never duplicated between apps — only UI is, because each platform may use an entirely different framework and language to build it.

- `web/` — Next.js
- `desktop/` — GPUI

## Web

### React

- Read components before using them. They may already apply classes, which affects what you need to pass and how to override them.

## Skills

Installed skills that guide engineering workflows. Load the relevant skill when the trigger conditions match.

### context-engineering
- **Trigger:** Starting a session, switching tasks, agent output degrades, or context needs setup
- **What:** Curates what the agent sees, when it sees it. Uses the context hierarchy: rules files → specs → source files → errors → conversation
- **Key pattern:** Before editing, read the file, find an existing similar pattern, read relevant types

### debugging-and-error-recovery
- **Trigger:** Tests fail, build breaks, unexpected behavior, errors in logs/console, something stopped working
- **What:** Systematic triage: Reproduce → Localize → Reduce → Fix → Guard → Verify
- **Key rule:** Stop-the-Line — never push past a failing test or broken build to work on the next feature

### performance-optimization
- **Trigger:** Performance requirements exist, suspected regressions, Core Web Vitals below thresholds, profiling reveals bottlenecks
- **What:** Measure-first approach. Profile before optimizing, identify the actual bottleneck, fix it, measure again
- **Key rule:** Never optimize without measurement. Performance work without profiling is guessing

### doubt-driven-development
- **Trigger:** Non-trivial decisions (branching logic, module boundaries, invariants the type system can't verify, irreversible changes, high-stakes code)
- **What:** Adversarial fresh-context review: CLAIM → EXTRACT → DOUBT → RECONCILE → STOP
- **Key rule:** Pass ARTIFACT + CONTRACT to the reviewer, never the CLAIM. The reviewer must be adversarial, not validating

### code-simplification
- **Trigger:** Code works but is harder to read than it should be, accumulated complexity, after feature completion
- **What:** Reduce complexity while preserving exact behavior. Chesterton's Fence — understand before changing
- **Key rule:** Separate refactoring from feature work. Mixed changes are harder to review and revert

## Project Map

### Timeline (`apps/web/src/timeline/`)
Handles the video/audio timeline UI: tracks, elements, drag-drop, snapping, keyframes, zoom, playhead.
Key files: `components/index.tsx` (main timeline), `components/timeline-element.tsx` (per-element render), `hooks/` (controller-backed hooks), `placement/` (element placement logic), `snapping/` (snap points)
Pattern: Controller-based hooks (useState + controller instance + subscribe + destroy on unmount). Elements use MemoizedTimelineElement.

### Editor Core (`apps/web/src/core/`)
Manages editor state via Manager pattern: TimelineManager, AudioManager, RendererManager, ProjectManager, MediaManager, SceneManager.
Key files: `managers/` (all managers), `index.ts` (EditorCore composition)
Pattern: Each manager has `subscribe()` for reactive updates. Managers hold references to each other via EditorCore.

### Rendering (`apps/web/src/services/renderer/`)
GPU and canvas rendering pipeline: compositor, effects, WASM renderer, snapshot capture, export.
Key files: `gpu-renderer.ts`, `compositor/`, `effect-preview.ts`, `renderer-manager.ts` (in core)
Pattern: GPU renderer with canvas fallback. RendererManager orchestrates snapshot capture and export.

### Audio (`apps/web/src/media/audio.ts`, `apps/web/src/core/managers/audio-manager.ts`)
Audio decoding, playback scheduling, volume/gain automation, mastering chain.
Key files: `media/audio.ts` (decode utilities), `core/managers/audio-manager.ts` (WebAudio playback scheduling)
Pattern: AudioManager uses lookahead scheduling with setInterval. Decodes via WebAudio AudioContext.

### Media (`apps/web/src/media/`)
Media asset management, file processing, thumbnail generation, paste handling, waveform cache.
Key files: `processing.ts`, `thumbnail.ts`, `use-paste-media.ts`, `waveform-cache/`
Pattern: MediaManager stores assets in IndexedDB. Processing uses mediabunny for video/audio decoding.

### Transcription (`apps/web/src/transcription/`, `apps/web/src/transcript-editor/`)
Speech-to-text via Transformers.js (Whisper), transcript editing, LLM-powered edits via Gemma.
Key files: `transcription/service.ts`, `transcript-editor/TranscriptEditor.tsx`, `transcript-editor/GemmaChatPanel.tsx`
Pattern: Local ML models loaded on-demand. Transcript edits map back to timeline clip trimming.

### Text (`apps/web/src/text/`, `apps/web/src/text-edit-engine/`)
Text element rendering, typography, background styling, diff-based edit engine.
Key files: `text/primitives.ts`, `text-edit-engine/index.ts`, `text-edit-engine/diff-calculator.ts`
Pattern: Text content stored as plain strings with style metadata. Edit engine computes diffs for timeline updates.

### Masks (`apps/web/src/masks/`)
Freeform path masks, rectangular masks, mask compositing on canvas.
Key files: `masks/freeform/path.ts`, `masks/components/masks-tab.tsx`
Pattern: Paths stored as SVG path data. Rendered via canvas 2D context during compositing.

### Stickers (`apps/web/src/stickers/`)
Sticker registry, providers (flags, emojis, etc.), search, timeline insertion.
Key files: `stickers/registry.ts`, `stickers/providers/`, `stickers/stickers-store.ts`
Pattern: Provider-based registry. Each provider implements search/browse interface.

### Sounds (`apps/web/src/sounds/`)
Sound search (Freesound API proxy), preview playback, timeline insertion.
Key files: `sounds/use-sound-search.ts`, `sounds/sounds-store.ts`, `app/api/sounds/search/route.ts`
Pattern: Client calls local API route which proxies to Freesound. Previews use HTMLAudioElement.

### Commands (`apps/web/src/commands/`)
Undo/redo command pattern for all editor operations: timeline, elements, keyframes, scenes, media.
Key files: `commands/timeline/` (all timeline commands), `commands/scene/`, `commands/media/`
Pattern: Each command implements execute/undo. BatchCommand groups multiple commands atomically.

### Rust/WASM (`rust/`)
Shared video editor logic compiled to WebAssembly: time calculations, bridge macros, effects, GPU, masks, compositor.
Key files: `rust/wasm/src/wasm.rs` (WASM entry point), `rust/crates/` (individual crates)
Pattern: Rust owns business logic. WASM exports called from JS via wasm-bindgen.

