<table width="100%">
  <tr>
    <td align="left" width="120">
      <img src="apps/web-vite/public/logos/opencut/icon.svg" alt="StratosCut Logo" width="100" />
    </td>
    <td align="right">
      <h1>StratosCut</h1>
      <h3 style="margin-top: -10px;">A free, open-source video editor for web, desktop, and mobile.</h3>
    </td>
  </tr>
</table>

> **This is the StratosLab fork of StratosCut.** We're building the video editor that CapCut should have been — fully local, fully private, and packed with AI features that run entirely in your browser via WebGPU. No subscriptions. No uploads. No cloud.

## Sponsors

Thanks to [Vercel](https://vercel.com?utm_source=github-opencut&utm_campaign=oss) and [fal.ai](https://fal.ai?utm_source=github-opencut&utm_campaign=oss) for their support of open-source software.

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>

<a href="https://fal.ai">
  <img alt="Powered by fal.ai" src="https://img.shields.io/badge/Powered%20by-fal.ai-000000?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCAxMEwxMy4wOSAxNS43NEwxMiAyMkwxMC45MSAxNS43NEw0IDEwTDEwLjkxIDguMjZMMTIgMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=" />
</a>

---

## Why StratosCut beats CapCut

| | CapCut | StratosCut |
|---|---|---|
| **Price** | Free tier gutted, AI features paywalled | 100% free, forever |
| **Privacy** | Videos uploaded to ByteDance servers | Everything stays on your device |
| **AI features** | Cloud-only, subscription required | On-device via WebGPU — no internet needed |
| **Background removal** | Paid feature | Free, runs locally (RMBG-1.4) |
| **Voice cloning** | Paid feature | Free, runs locally (OuteTTS) |
| **Text-based editing** | Not available | Edit video by editing its transcript |
| **Open source** | Closed source | MIT licensed |
| **Works offline** | No | Yes — fully offline capable |
| **Data sovereignty** | Your content trains their models | Your data never leaves your browser |

---

## What's inside

### 🎬 Core Editor

A full non-linear video editor that runs entirely in the browser:

- **Multi-track timeline** — video, audio, text, and image tracks with drag-and-drop editing
- **GPU compositing** — 34 blend modes, 6 transitions, hardware-accelerated via WebGPU (Rust/WASM)
- **14 GPU effects** — blur, color correction, chromatic aberration, vignette, sharpen, sepia, grayscale, invert, pixelate, noise, lens distortion, glow, AI upscale, cinematic color grade
- **Keyframe animation** — 13 easing modes, bezier curves, copy/paste keyframes
- **Audio engine** — 10-band EQ, reverb, compressor, limiter, noise gate, beat detection, varispeed
- **Export** — MP4 (H.264) and WebM (VP9) via browser-native MediaRecorder, zero-copy pipeline
- **Undo/redo** — full command history with selective undo and persistent storage

### 🤖 Local AI — Everything Runs On-Device

Every AI feature runs in a Web Worker via WebGPU. Nothing is sent to a server.

#### Text-Based Video Editing
Edit video the way you edit a document. Delete words from the transcript → the video cuts itself.

- **Whisper transcription** — 4 model sizes (Tiny → Large v3 Turbo), word-level timestamps, runs in a Web Worker
- **Transcript editor** — click any word to jump to that moment in the video; scrub the timeline and the word highlights
- **Smart Cut** — one-click removal of filler words ("um", "uh", "like") and silence gaps with sensitivity control
- **Deterministic edit engine** — text diff → timestamp aggregation → ripple edit. No LLM in the execution path — it's pure math

#### CLIP Visual Scene Classification *(new)*
The editor now understands what's actually in your video frames, not just what's said.

- **CLIP model** (`Xenova/clip-vit-base-patch32`) runs in a dedicated Web Worker
- **9 scene categories** — talking head, b-roll, action, transition, silent, music, intro, outro, unknown
- **Visual confidence scoring** — each detected scene gets a category label and confidence score based on what the frame looks like
- **Highlight detection** — automatically flags scenes worth keeping based on visual + transcript signals
- **B-roll scoring** — `BrollAnalyzer` uses CLIP embeddings to score how well a frame matches a semantic query
- **Opt-in** — toggle in the Scene Detection panel; model only loads when you ask for it (~150 MB)

#### Local Background Removal *(new)*
Remove backgrounds from images and video frames entirely on-device. No Canva subscription. No upload.

- **RMBG-1.4** (`briaai/RMBG-1.4`) — state-of-the-art matting model via `@huggingface/transformers`
- **WebGPU-accelerated** with automatic WASM fallback
- **Smart preprocessing** — auto-downscales to ≤1024×1024 for inference, upscales the alpha mask back to original resolution
- **Batch video frames** — remove backgrounds from entire video sequences with abort support and progress tracking
- **Transparent PNG output** — RGB channels preserved exactly, alpha channel from the model mask
- **Replaces `@imgly/background-removal`** — fully local, no third-party cloud dependency

#### Local TTS & Voice Cloning *(new)*
Generate voiceovers and clone voices entirely on-device. No ElevenLabs subscription needed.

- **OuteTTS** — two model variants:
  - Small (`onnx-community/OuteTTS-0.2-500M`, ~335 MB q4f16) — fast, good quality
  - Large (`OuteAI/Llama-OuteTTS-1.0-1B-ONNX`, ~630 MB q4f16) — better voice cloning fidelity
- **Voice cloning** — record 5–30 seconds of any voice, clone it, use it for synthesis. Speaker embeddings stored in IndexedDB
- **Speed & pitch control** — range 0.5×–2.0×, processed via `OfflineAudioContext`
- **Word-level timestamps** — character-weighted timing for subtitle sync
- **4 built-in voice presets** — casual, professional, energetic, calm
- **Persistent cloned voices** — survive page reloads via IndexedDB

#### AI Co-Pilot (Gemma 4)
A conversational assistant that reads your transcript and suggests edits.

- **Gemma 4 E2B** runs locally on WebGPU
- **19 edit action types** — split, delete, trim, add transition, add effect, mute, normalize, auto-duck, add caption, and more
- **Plan → review → execute** — AI generates a step-by-step plan, you review it, then execute with one click
- **Full undo** — every AI-executed action goes through the command stack

### 🎨 Visual Tools

- **Scene detection** — histogram-based boundary detection with chi-squared distance, thumbnail previews, one-click timeline markers
- **Video scopes** — histogram, vectorscope, and waveform via GPU compute shaders
- **3D layer compositing** — import glTF/GLB/OBJ models, animate them, composite into the 2D timeline via Three.js
- **Text animations** — 20+ presets (fade, slide, zoom, bounce, typewriter, glitch, neon, etc.)
- **Caption styles** — 6 presets (Classic, Minimal, Karaoke, TikTok, Elegant, Bold News)
- **Subtitle import** — SRT and ASS file support

### 🔧 Production Features

- **Proxy generation** — GPU-accelerated low-res proxies for smooth 4K editing
- **Project bundles** — export/import entire projects as `.opencut` files with embedded media and checksums
- **Version control** — git-like commits, branches, tags, and diff view for projects
- **Multi-output routing** — route compositions to preview, external monitor, streaming, or recording simultaneously
- **Plugin system** — third-party effects, transitions, and export formats via manifest API
- **Local backup** — automatic backup to external drives or network shares with rotation
- **Accessibility** — 20+ keyboard shortcuts, screen reader announcements, reduced motion support

---

## Architecture

Everything runs in the browser. No server required.

```
Browser
├── React UI (Vite SPA)
├── Rust/WASM Core
│   ├── GPU compositor (wgpu/WebGPU) — 34 blend modes, 6 transitions
│   ├── Effects pipeline — 14 GPU shader effects
│   ├── Mask pipeline — Gaussian blur feathering
│   └── Video scopes — histogram, vectorscope, waveform
└── Web Workers (parallel, off main thread)
    ├── Whisper worker — speech-to-text transcription
    ├── Gemma worker — LLM inference (AI Co-Pilot)
    ├── CLIP worker — visual scene classification (NEW)
    ├── Background removal worker — RMBG-1.4 matting (NEW)
    └── TTS worker — OuteTTS speech synthesis + voice cloning (NEW)
```

All AI models use WebGPU as the primary backend with automatic WASM fallback. Model weights are downloaded once and cached by the browser.

**Interactive architecture diagram:** [`docs/architecture-flows.html`](docs/architecture-flows.html) — 45+ workflows, 90+ nodes, click any flow to see the full data path.

---

## Project Structure

```
apps/
  web-vite/          Active Vite + React SPA
  web/               Original Next.js app (preserved for reference)
  desktop/           Native desktop app (GPUI, in progress)
  mobile/            React Native + Expo shell
rust/
  wasm/              GPU compositor, effects, masks — compiled to WASM
docs/
  architecture-flows.html   Interactive architecture diagram
  architecture-flows.json   JSON source (45+ flows, 90+ nodes)
.kiro/specs/
  clip-scene-classification/    CLIP visual classification spec
  local-background-removal/     RMBG-1.4 background removal spec
  local-tts-voice-cloning/      OuteTTS voice synthesis spec
```

---

## Getting Started

### Recommended: Vite + React SPA

```bash
cd apps/web-vite
bun install
bun dev
```

Open [http://localhost:5173](http://localhost:5173). No database, no auth, no environment variables.

### Prerequisites

- [Bun](https://bun.sh/docs/installation) (recommended) or npm

### Local WASM development

Only needed if you're editing `rust/wasm`:

```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack cargo-watch

# Build once
bun run build:wasm

# Link for local development
cd rust/wasm/pkg && bun link
cd apps/web-vite && bun link opencut-wasm

# Watch mode
bun dev:wasm
```

### Legacy Next.js setup

The original Next.js app requires Docker:

```bash
cp apps/web/.env.example apps/web/.env.local
docker compose up -d db redis serverless-redis-http
bun install && bun dev:web
```

---

## Why Vite instead of Next.js

The original StratosCut used Next.js with PostgreSQL, BetterAuth, and Redis. For a video editor that is 95% client-side, that's the wrong foundation.

| | Next.js | Vite + React SPA |
|---|---|---|
| **Deployment** | Node.js runtime required | Static files on Cloudflare Pages |
| **Database** | PostgreSQL + BetterAuth | IndexedDB — fully local |
| **Cold starts** | Worker spin-up latency | Instant CDN |
| **WASM binaries** | Size limits on Workers | Unlimited on Pages |
| **Dev experience** | Server restarts | Instant HMR |
| **Cost** | Worker invocations + DB | Free tier |

Key changes: replaced `mediabunny` (Node.js FFmpeg) with browser-native `<video>` + `AudioContext` + `MediaRecorder`; dropped all server-side auth and database dependencies; proxied the Freesound API key via a tiny stateless Cloudflare Worker.

---

## Contributing

**Focus areas:** Timeline functionality, AI features, performance, bug fixes, UI polish.

**Hold off on:** Preview panel effects and export — we're reworking those with the new Rust/WASM pipeline.

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for setup and guidelines.

---

## License

[MIT](LICENSE)

---

![Star History Chart](https://api.star-history.com/svg?repos=opencut-app/opencut&type=Date)
