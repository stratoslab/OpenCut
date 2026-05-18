# Design: Export Engine Improvements

## Overview

Rewrite the export engine to use a zero-copy pipeline: GPU canvas → `transferToImageBitmap()` → `VideoFrame` → `VideoEncoder` → `mp4-muxer` → stream to disk via File System Access API. Add progress tracking with rolling-average ETA, resume support via OPFS state persistence, and configurable export settings (resolution, format, quality). Audio is mixed via Web Audio API and encoded with `AudioEncoder`.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Export Pipeline                             │
│                                                               │
│  ┌─────────────┐                                             │
│  │ GPU Canvas   │  Composited frame                           │
│  └──────┬──────┘                                             │
│         │ transferToImageBitmap() (zero-copy)                 │
│         ▼                                                    │
│  ┌─────────────┐                                             │
│  │ VideoFrame   │  WebCodecs VideoFrame from ImageBitmap      │
│  └──────┬──────┘                                             │
│         │                                                     │
│         ▼                                                    │
│  ┌─────────────┐    ┌─────────────┐                          │
│  │ VideoEncoder │    │ AudioEncoder│                          │
│  │ (H.264/VP9)  │    │ (AAC/Opus)  │                          │
│  └──────┬──────┘    └──────┬──────┘                          │
│         │                  │                                  │
│         ▼                  ▼                                  │
│  ┌─────────────────────────────────┐                         │
│  │         mp4-muxer               │                         │
│  │  (combines video + audio chunks)│                         │
│  └──────────────┬──────────────────┘                         │
│                 │                                             │
│                 ▼                                            │
│  ┌─────────────────────────────────┐                         │
│  │  Stream Writer                   │                         │
│  │  (File System Access API / OPFS) │                         │
│  └──────────────┬──────────────────┘                         │
│                 │                                             │
│                 ▼                                            │
│  ┌─────────────────────────────────┐                         │
│  │  Output File (.mp4 / .webm)      │                         │
│  └─────────────────────────────────┘                         │
│                                                               │
│  Side Channels:                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Progress     │  │ ETA Calc    │  │ Resume State│          │
│  │ Tracker      │  │ (rolling    │  │ (OPFS)      │          │
│  │              │  │  avg 30)    │  │             │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

## Components

### Component 1: ExportEngine (TypeScript)
- **Responsibility:** Orchestrate the entire export pipeline — frame capture, encoding, muxing, streaming
- **Location:** `apps/web-vite/src/export/export-engine.ts`
- **Interface:** `start(config)`, `cancel()`, `resume()`, `getProgress()`
- **Dependencies:** RendererManager, VideoEncoder, AudioEncoder, mp4-muxer, File System Access API

### Component 2: FrameCapture (TypeScript)
- **Responsibility:** Capture frames from GPU canvas with zero-copy path
- **Location:** `apps/web-vite/src/export/frame-capture.ts`
- **Interface:** `captureFrame(canvas) → VideoFrame`
- **Key design:** `canvas.transferToImageBitmap()` → `new VideoFrame(imageBitmap)` → close ImageBitmap immediately

### Component 3: AudioMixer (TypeScript)
- **Responsibility:** Mix multiple audio tracks into a single stream for encoding
- **Location:** `apps/web-vite/src/export/audio-mixer.ts`
- **Interface:** `getAudioFrame(timeRange) → AudioData`
- **Dependencies:** Web Audio API (OfflineAudioContext)

### Component 4: ProgressTracker (TypeScript)
- **Responsibility:** Track export progress, calculate rolling-average ETA
- **Location:** `apps/web-vite/src/export/progress-tracker.ts`
- **Interface:** `recordFrame()`, `getProgress()`, `getETA()`
- **Key design:** Rolling window of last 30 frame encode times for stable ETA

### Component 5: ResumeManager (TypeScript)
- **Responsibility:** Save/restore export state to OPFS for resume support
- **Location:** `apps/web-vite/src/export/resume-manager.ts`
- **Interface:** `saveState(state)`, `loadState() → State | null`, `clearState()`
- **Key design:** Store completed frame count, encoder config, partial file handle reference

### Component 6: Export UI (TypeScript)
- **Responsibility:** Export dialog with configuration options, progress display, cancel/resume buttons
- **Location:** `apps/web-vite/src/export/components/ExportDialog.tsx`
- **Dependencies:** ExportEngine, ProgressTracker

## Data Models

### Export Configuration
```typescript
interface ExportConfig {
  resolution: 'original' | '1080p' | '720p' | '480p';
  format: 'mp4' | 'webm';
  quality: 'low' | 'medium' | 'high';
  fps: number;
  includeAudio: boolean;
}

const BITRATE_PRESETS: Record<string, number> = {
  low: 2_000_000,      // 2 Mbps
  medium: 5_000_000,   // 5 Mbps
  high: 10_000_000,    // 10 Mbps
};

const RESOLUTION_MAP: Record<string, { w: number; h: number }> = {
  '1080p': { w: 1920, h: 1080 },
  '720p': { w: 1280, h: 720 },
  '480p': { w: 854, h: 480 },
};
```

### Export State (for Resume)
```typescript
interface ExportState {
  projectId: string;
  config: ExportConfig;
  completedFrames: number;
  totalFrames: number;
  encoderConfig: VideoEncoderConfig;
  fileHandleId: string;  // Reference to partial file in OPFS
  timestamp: number;     // When state was saved
}
```

### Progress State
```typescript
interface ProgressState {
  completedFrames: number;
  totalFrames: number;
  percentage: number;
  etaSeconds: number;
  fps: number;           // Current encoding speed
  status: 'running' | 'paused' | 'completed' | 'cancelled' | 'error';
}
```

## Data Flow

1. User configures export → `ExportEngine.start(config)` called
2. Check for resume state → if found, offer resume, otherwise start fresh
3. Initialize VideoEncoder + AudioEncoder with config
4. Open output file via File System Access API (or OPFS fallback)
5. Initialize mp4-muxer with encoder configurations
6. For each frame (from 0 to totalFrames):
   a. Render frame via RendererManager (uses cache if available)
   b. Capture frame via `transferToImageBitmap()` → `VideoFrame`
   c. Encode video frame → `VideoEncoder.encode()`
   d. If audio: mix audio for this frame's time range → `AudioEncoder.encode()`
   e. Receive encoded chunks → muxer.addVideoChunk() / muxer.addAudioChunk()
   f. Stream muxed data to file via writer.write()
   g. Record frame time → update progress + ETA
   h. Save resume state every 100 frames
7. Finalize: muxer.finalize() → close file → clean up resume state
8. Notify user: export complete, file ready

## Key Algorithms

### Zero-Copy Frame Capture
```typescript
async function captureFrame(canvas: OffscreenCanvas, timestamp: number): Promise<VideoFrame> {
  const bitmap = canvas.transferToImageBitmap();
  const frame = new VideoFrame(bitmap, { timestamp: timestamp * 1_000_000 }); // microseconds
  bitmap.close();  // Release immediately — VideoFrame holds the data
  return frame;
}
```

### Rolling Average ETA
```typescript
class ProgressTracker {
  private frameTimes: number[] = [];  // Last 30 frame encode times (ms)
  private completed = 0;
  private total: number;

  recordFrame(timeMs: number): void {
    this.frameTimes.push(timeMs);
    if (this.frameTimes.length > 30) this.frameTimes.shift();
    this.completed++;
  }

  getETA(): number {
    if (this.frameTimes.length === 0) return Infinity;
    const avgTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const remaining = this.total - this.completed;
    return (remaining * avgTime) / 1000;  // seconds
  }
}
```

### Resolution Scaling
```typescript
function getExportResolution(config: ExportConfig, projectWidth: number, projectHeight: number): { w: number; h: number } {
  if (config.resolution === 'original') {
    return { w: projectWidth, h: projectHeight };
  }
  const target = RESOLUTION_MAP[config.resolution];
  // Maintain aspect ratio
  const aspect = projectWidth / projectHeight;
  if (aspect > target.w / target.h) {
    return { w: target.w, h: Math.round(target.w / aspect) };
  } else {
    return { w: Math.round(target.h * aspect), h: target.h };
  }
}
```

## Error Handling

- Encoder fails → stop export, display error, save resume state
- File system unavailable → fall back to OPFS, then to in-memory blob as last resort
- Browser tab closes → resume state saved in OPFS, user can resume on reopen
- Out of memory → reduce resolution automatically, notify user
- Audio encoding fails → continue with video-only, notify user

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: Zero-Copy | transferToImageBitmap() → VideoFrame, no intermediate copies |
| Req 2: Stream-to-Disk | File System Access API writer, mp4-muxer chunk streaming |
| Req 3: Progress/ETA | ProgressTracker with rolling 30-frame average |
| Req 4: Resume Support | ResumeManager saves state to OPFS every 100 frames |
| Req 5: Export Config | ExportConfig with resolution/format/quality options |
| Req 6: Audio | AudioMixer via OfflineAudioContext, AudioEncoder, muxed with video |

## Testing Strategy

- **Zero-copy:** Verify peak memory usage does not grow with frame count
- **Stream-to-disk:** Output file valid MP4/WebM, playable in standard players
- **Progress accuracy:** ETA within 20% of actual time after 30 frames
- **Resume correctness:** Resumed export produces bit-identical output to fresh export
- **Audio sync:** Audio-video sync maintained throughout export (no drift > 1 frame)
- **Resolution scaling:** Exported resolution matches config, aspect ratio preserved
