<table width="100%">
  <tr>
    <td align="left" width="120">
      <img src="apps/web-vite/public/logos/opencut/icon.svg" alt="OpenCut Logo" width="100" />
    </td>
    <td align="right">
      <h1>OpenCut</h1>
      <h3 style="margin-top: -10px;">A free, open-source video editor for web, desktop, and mobile.</h3>
    </td>
  </tr>
</table>

> **This is the StratosLab fork of OpenCut.** We're extending the base editor with local-first AI capabilities — browser-based transcription, text-driven video editing, and an on-device LLM assistant. All processing runs on-device via WebGPU; no video ever leaves the user's machine.

## Sponsors

Thanks to [Vercel](https://vercel.com?utm_source=github-opencut&utm_campaign=oss) and [fal.ai](https://fal.ai?utm_source=github-opencut&utm_campaign=oss) for their support of open-source software.

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>

<a href="https://fal.ai">
  <img alt="Powered by fal.ai" src="https://img.shields.io/badge/Powered%20by-fal.ai-000000?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCAxMEwxMy4wOSAxNS43NEwxMiAyMkwxMC45MSAxNS43NEw0IDEwTDEwLjkxIDguMjZMMTIgMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=" />
</a>

## Why?

- **Privacy**: Your videos stay on your device
- **Free features**: Most basic CapCut features are now paywalled 
- **Simple**: People want editors that are easy to use - CapCut proved that

## StratosLab Fork — What We're Adding

This fork extends OpenCut with **local-first AI video editing** capabilities. The core philosophy: every AI operation runs in the browser via WebGPU — no server-side processing, no cloud dependencies, no video uploads.

### Text-Based Video Editing

Edit video by editing its transcript. Delete words from the text → the corresponding video/audio is automatically cut from the timeline.

- **Whisper transcription** — In-browser audio transcription using ONNX models via Web Workers, producing word-level timestamps
- **Transcript editor** — Interactive text view with bidirectional sync to the timeline (hover a word → highlight on timeline, scrub playhead → highlight word)
- **Deterministic edit mapping** — Text deletions are mapped to precise timeline cuts via word-level timestamp aggregation. No LLM involved in the edit execution — it's pure diff → timestamp → cut
- **Edit preview** — Proposed cuts are shown with timeline highlights before confirmation
- **Undo/redo** — Full undo/redo stack for text-based edits with configurable depth

### AI Chat Assistant (Gemma LLM)

A conversational assistant that runs locally on WebGPU (Gemma 4 E2B model).

- **Content queries** — Ask questions about video content ("what does he say about pricing?")
- **Edit suggestions** — Request edits in natural language ("cut the intro silence", "remove filler words")
- **Context-aware** — Transcript is chunked at paragraph/sentence boundaries and sent with word-level timing data
- **Zero direct timeline access** — The LLM only suggests; all edits require explicit user confirmation

### Architecture Documentation

- **Interactive flow diagram** — [`docs/architecture-flows.html`](docs/architecture-flows.html) documents 17 workflows across the entire app. Click any flow to see highlighted data paths between components with annotations

### New Components Added

| Component | Path | Purpose |
|-----------|------|---------|
| `TranscriptionService` (extended) | `src/transcription/` | Word-level segment output from Whisper |
| `TranscriptEditor` | `src/transcript-editor/` | Interactive transcript UI with timeline sync |
| `TextEditEngine` | `src/text-edit-engine/` | Deterministic text → timestamp → cut mapping |
| `EditPreviewPanel` | `src/transcript-editor/` | Edit confirmation before timeline application |
| `GemmaChatPanel` | `src/transcript-editor/` | Local LLM conversational assistant |
| `TranscriptChunker` | `src/transcript-editor/` | Token-aware transcript splitting for LLM context |
| `TimelineSync` | `src/transcript-editor/` | Controller for transcript ↔ timeline bidirectional sync |
| `ripple-edit.ts` | `src/timeline/` | Ripple edit behavior for gap closing after cuts |

### Deployment

This fork is deployed to **Cloudflare Pages** at `opencut.stratoslab.xyz`. The build pipeline:
- **CI**: GitHub Actions (WASM build → Bun install → Vite build) across Ubuntu, Windows, macOS
- **Production**: Cloudflare Pages — unlimited static file size, zero server infrastructure
- **Storage**: IndexedDB (browser-local) — no database, no auth, fully client-side

### Why Vite + React SPA Instead of Next.js

The original OpenCut used Next.js with server-side infrastructure (PostgreSQL, BetterAuth, Redis, API routes). For a video editor that is **95% client-side**, this was overkill. Here's why we migrated to Vite + React SPA:

| Concern | Next.js | Vite + React SPA |
|---------|---------|------------------|
| **Architecture** | Server + client hybrid | Pure client-side SPA |
| **Deployment** | Node.js runtime required (Cloudflare Workers via `@opennextjs`) | Static files on Cloudflare Pages (unlimited size) |
| **Dependencies** | `gray-matter`, `mediabunny` (Node.js `Buffer` APIs) | Browser-native APIs only (`<video>`, `AudioContext`, `MediaRecorder`) |
| **Runtime crashes** | `Buffer is not defined` errors in browser | Zero Node.js API references |
| **Database** | PostgreSQL + BetterAuth required | IndexedDB — fully local, no server |
| **Auth** | Session management, API routes | Not needed — app is local-first |
| **Build output** | Server bundles + client chunks | `index.html` + JS/CSS (~2 MB gzipped) + WASM (~6 MB gzipped) |
| **Cold starts** | Worker spin-up latency | Instant — static CDN |
| **Cost** | Worker invocations + database | Free tier on Cloudflare Pages |
| **Dev experience** | `next dev` with server restarts | `vite` — instant HMR, no server |

**Key decisions:**

- **Replaced `mediabunny`** (Node.js FFmpeg wrapper) with browser-native `<video>` element, `AudioContext`, and `MediaRecorder` for video/audio processing
- **Replaced `gray-matter`** with a simple browser-compatible frontmatter parser
- **Dropped server-side dependencies** — Better Auth, Kysely, PostgreSQL, Redis — since the app is fully client-side
- **Cloudflare Pages** handles unlimited static file size natively, so the ~8 MB WASM binaries deploy without workarounds
- **Sounds API** proxied via a tiny stateless Worker to hide the Freesound API key — zero server logic

The `apps/web-vite/` directory contains the new Vite + React SPA. The original `apps/web/` Next.js app is preserved for reference.

## Project Structure

- `apps/web/`: Original Next.js web application (preserved for reference)
- `apps/web-vite/`: Vite + React SPA — the active web application
- `apps/desktop/`: Native desktop app built with GPUI (in progress)
- `rust/`: Platform-agnostic core: GPU compositor, effects, masks, and WASM bindings. We're actively migrating business logic here from TypeScript.
- `docs/`: Architecture and subsystem documentation
  - [`docs/architecture-flows.html`](docs/architecture-flows.html) — **Interactive architecture diagram** — click any workflow (Import Media, Text-Based Editing, Export, CI Build, ToDesktop, etc.) to see highlighted data flow between packages/components with annotations
  - [`docs/architecture-flows.json`](docs/architecture-flows.json) — JSON source for all documented flows (17 workflows, 35+ nodes)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation) or [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

> **Note:** Docker is optional but recommended for running the local database and Redis. If you only want to work on frontend features, you can skip it.

### Setup (Vite + React SPA — Recommended)

1. Fork and clone the repository

2. Install dependencies and start the dev server:

    ```bash
    cd apps/web-vite
    bun install
    bun dev
    ```

The application will be available at [http://localhost:5173](http://localhost:5173).

No database, no auth, no environment variables needed.

### Setup (Next.js — Legacy)

The original Next.js app in `apps/web/` is preserved for reference. It requires Docker for the database:

1. Copy the environment file:

    ```bash
    # Unix/Linux/Mac
    cp apps/web/.env.example apps/web/.env.local

    # Windows PowerShell
    Copy-Item apps/web/.env.example apps/web/.env.local
    ```

2. Start the database and Redis:

    ```bash
    docker compose up -d db redis serverless-redis-http
    ```

3. Install dependencies and start the dev server:

    ```bash
    bun install
    bun dev:web
    ```

The application will be available at [http://localhost:3000](http://localhost:3000).

The `.env.example` has sensible defaults that match the Docker Compose config — it should work out of the box.

### Desktop setup

Desktop is opt-in. If you're only working on the web app, skip this entirely.

If you want to get ready for `apps/desktop`, see [`apps/desktop/README.md`](apps/desktop/README.md). It's a two-step setup: Rust toolchain first, then desktop native dependencies.

### Local WASM development

Only needed if you're editing `rust/wasm` and want the web app to use your local build instead of the published package.

**Prerequisites** — install these once before anything else:

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# build the WASM package
cargo install wasm-pack

# reruns the build on file changes, used by bun dev:wasm
cargo install cargo-watch
```

1. Build the package once from the repo root:

   ```bash
   bun run build:wasm
   ```

2. Register the generated package for linking:

   ```bash
   cd rust/wasm/pkg
   bun link
   ```

3. Link `apps/web` to the local package:

   ```bash
   cd apps/web
   bun link opencut-wasm
   ```

4. Rebuild on changes while you work:

   ```bash
   bun dev:wasm
   ```

To switch `apps/web` back to the published package, run:

```bash
cd apps/web
bun add opencut-wasm
```

### Self-Hosting with Docker (Legacy)

To run the original Next.js stack (including a production build of the app) in Docker:

```bash
docker compose up -d
```

The app will be available at [http://localhost:3100](http://localhost:3100).

For the Vite + React SPA, no Docker is needed — just `bun install && bun dev` in `apps/web-vite/`.

## Contributing

We welcome contributions! While we're actively developing and refactoring certain areas, there are plenty of opportunities to contribute effectively.

**🎯 Focus areas:** Timeline functionality, project management, performance, bug fixes, and UI improvements outside the preview panel.

**⚠️ Avoid for now:** Preview panel enhancements (fonts, stickers, effects) and export functionality - we're refactoring these with a new binary rendering approach.

See our [Contributing Guide](.github/CONTRIBUTING.md) for detailed setup instructions, development guidelines, and complete focus area guidance.

**Quick start for contributors:**

- Fork the repo and clone locally
- Follow the setup instructions in CONTRIBUTING.md
- Working on `apps/desktop`? See [`apps/desktop/README.md`](apps/desktop/README.md) for setup
- Create a feature branch and submit a PR

## License

[MIT LICENSE](LICENSE)

---

![Star History Chart](https://api.star-history.com/svg?repos=opencut-app/opencut&type=Date)
