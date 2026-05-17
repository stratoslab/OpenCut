# Design: AI Features Suite

## Overview

Three new feature modules built on shared infrastructure: a `FrameExtractor` service for browser-native video frame access, an `AiAgent` service that orchestrates LLM-powered editing plans, and a `SceneDetector` service for histogram-based scene boundary detection. All run client-side with Web Workers for non-blocking processing. The existing Gemma LLM infrastructure is reused for AI analysis.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React UI Layer                        │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ AiAgentPanel│  │SceneDetectPanel│ │YouTubeExportPanel  │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                │                    │              │
│  ┌──────▼────────────────▼────────────────────▼──────────┐  │
│  │              Shared Services Layer                     │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │FrameExtractor│  │SceneDetector │  │ChapterExporter│  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  │  │
│  │         │                │                  │          │  │
│  │  ┌──────▼────────────────▼──────────────────▼───────┐  │  │
│  │  │              AiAgent Service                      │  │  │
│  │  │  (LLM prompting, plan parsing, step execution)    │  │  │
│  │  └──────────────────────┬───────────────────────────┘  │  │
│  └─────────────────────────┼──────────────────────────────┘  │
│                            │                                  │
│  ┌─────────────────────────▼──────────────────────────────┐  │
│  │              Browser APIs                               │  │
│  │  HTMLVideoElement │ Canvas API │ Web Workers │ WebGPU   │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Component 1: FrameExtractor
- **Responsibility:** Extract frames from video files at specified timestamps using HTMLVideoElement + Canvas API
- **Interface:** `extractFrame(file: File, time: number): Promise<ImageData>` — returns pixel data for histogram computation or thumbnail display
- **Dependencies:** None (browser-native)
- **Key design:** Uses a shared `<video>` element pool (max 2 concurrent) to avoid memory leaks. Seeks, waits for `seeked` event, draws to OffscreenCanvas, returns ImageData.

### Component 2: HistogramCalculator
- **Responsibility:** Compute 24-bin RGB color histograms from ImageData
- **Interface:** `computeHistogram(imageData: ImageData): Float64Array` — returns 24-element array (8 bins per channel: R, G, B)
- **Dependencies:** None
- **Key design:** Pure function, runs in Web Worker. Bins computed by dividing 0-255 range into 8 equal buckets per channel.

### Component 3: SceneDetector
- **Responsibility:** Detect scene boundaries by analyzing histogram distances across a video
- **Interface:** `detectScenes(file: File, options: { intervalSec?: number, threshold?: number }): Promise<SceneChange[]>`
- **Dependencies:** FrameExtractor, HistogramCalculator
- **Key design:** Streams frames at configurable intervals, computes chi-squared distance between consecutive histograms, flags peaks above threshold. Runs entirely in a Web Worker to avoid blocking UI. Returns scene changes with timestamps and before/after frame thumbnails (as data URLs).

### Component 4: AiAgent
- **Responsibility:** Parse natural language goals, generate multi-step editing plans, execute steps sequentially
- **Interface:** 
  - `generatePlan(goal: string, projectContext: ProjectContext): Promise<EditingPlan>`
  - `executePlan(plan: EditingPlan, callbacks: PlanCallbacks): Promise<void>`
  - `cancelExecution(): void`
- **Dependencies:** Existing Gemma LLM service, CommandManager, TimelineManager
- **Key design:** Uses structured JSON output from LLM (prompted to return `{ steps: [{ actionType, description, params }] }`). Plans are validated against the 19 supported action types before execution. Steps run sequentially via CommandManager with a single undo group.

### Component 5: AiAgentPanel
- **Responsibility:** UI for AI Co-Pilot — goal input, plan display, step-by-step execution, quick presets
- **Interface:** React component in assets panel (new "AI" tab)
- **Dependencies:** AiAgent service, EditorCore
- **Key design:** Three states: idle (text input + presets), planning (loading spinner), reviewing (step list with approve/execute/cancel). Progress bar during execution.

### Component 6: SceneDetectPanel
- **Responsibility:** UI for scene detection — video selection, configuration, results display with thumbnails
- **Interface:** React component in assets panel or as a modal
- **Dependencies:** SceneDetector service, MediaManager
- **Key design:** Dropdown to select video clip, sliders for interval and threshold, progress bar during detection, scrollable results list with before/after thumbnails and "Add markers" button.

### Component 7: YouTubeExportPanel
- **Responsibility:** UI for YouTube chapters export — chapter list editor, copy-to-clipboard, full description generation
- **Interface:** React component, accessible from export menu or assets panel
- **Dependencies:** ChapterExporter, SceneDetector (optional), existing Gemma LLM
- **Key design:** Editable chapter list (add/remove/rename), preview in YouTube format, one-click copy button, "Generate Full Description" button that produces title + description + tags.

### Component 8: ChapterExporter
- **Responsibility:** Format chapter markers and generate YouTube descriptions
- **Interface:** 
  - `formatChapters(chapters: Chapter[]): string` — returns `MM:SS Title` text
  - `generateDescription(videoContext: VideoContext, chapters: Chapter[]): Promise<YouTubeDescription>`
- **Dependencies:** Gemma LLM (for description generation only)
- **Key design:** Pure formatting for chapters. Description generation uses LLM with transcript + chapter context.

## Data Models

### Action Types (19 supported operations)
```typescript
type ActionType =
  | "split-clip"           // Split a clip at playhead position
  | "delete-clip"          // Remove a clip from timeline
  | "trim-start"           // Adjust clip trim start
  | "trim-end"             // Adjust clip trim end
  | "add-transition"       // Add transition between clips
  | "remove-transition"    // Remove transition from clip
  | "add-effect"           // Apply visual effect to clip
  | "remove-effect"        // Remove effect from clip
  | "mute-audio"           // Mute clip audio
  | "unmute-audio"         // Unmute clip audio
  | "adjust-volume"        // Change clip volume level
  | "add-text"             // Insert text overlay
  | "delete-text"          // Remove text overlay
  | "retime-clip"          // Change clip speed/duration
  | "add-marker"           // Add timeline marker/bookmark
  | "delete-marker"        // Remove timeline marker
  | "normalize-audio"      // Normalize audio levels across clips
  | "auto-duck"            // Duck background audio under speech
  | "add-caption";         // Add subtitle/caption track
```

### EditingPlan
```typescript
interface EditingPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  estimatedDuration: number; // seconds
}

interface PlanStep {
  id: string;
  actionType: ActionType;
  description: string;
  params: Record<string, unknown>;
  targetElementId?: string;
  targetTrackId?: string;
}
```

### SceneChange
```typescript
interface SceneChange {
  timestamp: number;      // seconds into video
  chiSquaredDistance: number;
  beforeThumbnail: string; // data URL
  afterThumbnail: string;  // data URL
  type: "cut" | "dissolve";
}
```

### Chapter
```typescript
interface Chapter {
  timestamp: number;  // seconds
  title: string;
}
```

## Data Flow

### AI Co-Pilot Flow
1. User types goal → AiAgentPanel sends to AiAgent
2. AiAgent builds ProjectContext (clip names, durations, track structure, transcript if available)
3. AiAgent prompts Gemma LLM with structured prompt + context
4. LLM returns JSON plan → AiAgent validates action types and targets
5. Plan displayed in AiAgentPanel for review
6. User clicks Execute → AiAgent iterates steps, maps each to existing Command classes
7. Each step executes via CommandManager with progress callback
8. Timeline updates after each step, preview re-renders
9. Plan completes → single undo entry captures all changes

### Scene Detection Flow
1. User selects video + configures interval/threshold
2. SceneDetector spawns Web Worker
3. Worker uses FrameExtractor to seek and capture frames at intervals
4. HistogramCalculator computes 24-bin RGB histogram per frame
5. Chi-squared distance computed between consecutive histograms
6. Peaks above threshold flagged as scene changes
7. Before/after thumbnails captured for each change
8. Results sent back to main thread → SceneDetectPanel displays
9. User can "Add markers" to timeline at detected boundaries

### YouTube Export Flow
1. User clicks "Export YouTube Chapters"
2. If transcript exists → LLM analyzes transcript for topic boundaries → generates chapter titles
3. If no transcript → uses scene detection boundaries with generic titles
4. ChapterExporter formats as `MM:SS Title` text
5. Text copied to clipboard
6. Optional: "Generate Full Description" → LLM produces title + description + tags

## Key Algorithms

### Chi-Squared Distance
```
χ²(H1, H2) = Σ (H1[i] - H2[i])² / (H1[i] + H2[i] + ε)
```
Where H1 and H2 are 24-bin histograms, ε = 1e-10 to avoid division by zero. Threshold default: 0.5 (tunable).

### Histogram Binning
- 256 possible values per channel (0-255)
- Divided into 8 equal bins per channel (32 values each)
- 8 R bins + 8 G bins + 8 B bins = 24 total bins
- Each pixel increments the appropriate bin for each channel

### LLM Prompt Structure (AI Co-Pilot)
```
You are a video editing assistant. Given the project state below, create a step-by-step plan to achieve: "{user_goal}"

Project:
- Duration: {duration}s
- Tracks: {track_count} (main: {main_track_elements}, audio: {audio_track_count})
- Clips: [{clip_name}: {duration}s at {start_time}, ...]
- Transcript: {transcript_text or "none"}

Available actions: {list of 19 action types}

Return a JSON object with a "steps" array. Each step must have:
- "actionType": one of the available actions
- "description": what this step does
- "params": parameters for the action
- "targetElementId": which clip to modify (if applicable)
```

## Error Handling

- **LLM unavailable:** Graceful degradation — display error toast, suggest retry. No partial plan execution.
- **Frame extraction fails:** Skip problematic frames, continue detection. Report skipped frames in results.
- **Worker crashes:** Fall back to main thread with warning about potential UI jank.
- **Invalid LLM response:** Validate JSON schema before accepting plan. If invalid, retry with stricter prompt (max 2 retries).
- **Execution failure mid-plan:** Stop execution, display error at failed step. All completed steps remain applied. User can undo entire plan.

## Testing Strategy

- **FrameExtractor:** Unit tests with mock video files → verify correct frame at known timestamps
- **HistogramCalculator:** Property-based tests — identical images produce identical histograms, black image produces all-zero histogram
- **SceneDetector:** Integration tests with synthetic videos containing known cuts → verify detection accuracy within ±0.5s
- **AiAgent:** Unit tests for plan validation (reject invalid action types, reject missing targets), mock LLM responses
- **ChapterExporter:** Deterministic tests — verify `MM:SS` format, monotonic timestamps, first chapter at 0:00
- **Chi-squared distance:** Property-based — distance(a, a) = 0, distance(a, b) = distance(b, a), triangle inequality approximate

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1.1-1.6: AI Co-Pilot | AiAgent service, AiAgentPanel, LLM prompt structure, CommandManager integration |
| Req 2.1-2.6: Scene Detection | SceneDetector, FrameExtractor, HistogramCalculator, Web Worker |
| Req 3.1-3.5: YouTube Export | ChapterExporter, YouTubeExportPanel, LLM description generation |
| Req 4.1-4.2: Shared Infrastructure | FrameExtractor (shared), existing Gemma LLM, consistent panel UI patterns |
