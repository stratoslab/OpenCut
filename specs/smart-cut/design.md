# Design: Smart Cut

## Overview

Three-phase pipeline: (1) Filler word detection from transcript word-level timestamps, (2) Silence detection from audio waveform via Web Audio API offline analysis, (3) Timeline editing that removes detected regions and ripple-closes gaps. All runs client-side.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Smart Cut Pipeline                 │
│                                                       │
│  ┌──────────────┐    ┌──────────────┐                │
│  │ Filler       │    │ Silence      │                │
│  │ Detector     │    │ Detector     │                │
│  │ (transcript) │    │ (audio)      │                │
│  └──────┬───────┘    └──────┬───────┘                │
│         │                   │                         │
│         ▼                   ▼                         │
│  ┌──────────────────────────────┐                    │
│  │    Region Merger             │                    │
│  │  (combine + dedupe regions)  │                    │
│  └──────────────┬───────────────┘                    │
│                 │                                     │
│                 ▼                                     │
│  ┌──────────────────────────────┐                    │
│  │    Timeline Editor           │                    │
│  │  (split + delete + ripple)   │                    │
│  └──────────────────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

## Components

### Component 1: FillerDetector
- **Responsibility:** Scan transcript word segments for filler words, return time ranges
- **Interface:** `detect(words: WordSegment[], fillerList: string[]): TimeRange[]`
- **Dependencies:** None
- **Key design:** Case-insensitive whole-word matching against configurable filler list

### Component 2: SilenceDetector
- **Responsibility:** Analyze audio waveform via OfflineAudioContext, detect silence regions
- **Interface:** `detect(audio: Float32Array, options: { threshold: number, minDuration: number }): TimeRange[]`
- **Dependencies:** Web Audio API (OfflineAudioContext)
- **Key design:** Renders audio through OfflineAudioContext at reduced sample rate, scans for segments below threshold

### Component 3: RegionMerger
- **Responsibility:** Combine filler and silence time ranges, merge overlapping regions
- **Interface:** `merge(ranges: TimeRange[]): TimeRange[]`
- **Dependencies:** None
- **Key design:** Sort by start time, merge overlapping/adjacent ranges

### Component 4: SmartCutBar UI
- **Responsibility:** Display filler count, silence regions as bar chart, sensitivity slider, review/remove buttons
- **Interface:** React component in assets panel
- **Dependencies:** FillerDetector, SilenceDetector, EditorCore
- **Key design:** Visual bar chart showing silence distribution across timeline, color-coded regions

## Data Models

```typescript
interface TimeRange {
  start: number;    // seconds
  end: number;      // seconds
  type: "filler" | "silence";
  label?: string;   // filler word text or "silence"
}

interface SmartCutResult {
  fillerRegions: TimeRange[];
  silenceRegions: TimeRange[];
  mergedRegions: TimeRange[];
  totalDurationRemoved: number;
}
```

## Key Algorithms

### Silence Detection
```
1. Create OfflineAudioContext with audio data
2. Render at reduced sample rate (8kHz for speed)
3. Scan rendered buffer: mark samples below threshold as silent
4. Group consecutive silent samples into regions
5. Filter regions by minimum duration
```

### Region Merging
```
1. Combine filler + silence ranges into single list
2. Sort by start time
3. Iterate: if current overlaps with previous, merge them
4. Return deduplicated, merged ranges
```

## Data Flow

1. User clicks "Smart Cut" → FillerDetector and SilenceDetector run in parallel
2. FillerDetector scans transcript word segments → returns filler TimeRange[]
3. SilenceDetector analyzes audio via OfflineAudioContext → returns silence TimeRange[]
4. RegionMerger combines and deduplicates both sets → merged TimeRange[]
5. SmartCutBar UI displays preview with highlighted regions on timeline
6. User reviews and confirms → TimelineEditor splits clips at region boundaries, removes regions, ripple-closes gaps
7. All cuts grouped as single undoable command

## Error Handling

- No transcript → disable filler detection, show message
- Audio analysis fails → fall back to simpler amplitude scanning
- Timeline edit fails → rollback all changes, display error

## Testing Strategy

- **Filler detection:** Property-based — case insensitivity, whole-word matching, timestamp validity
- **Silence detection:** Property-based — non-overlapping regions, minimum duration, sensitivity monotonicity
- **Region merging:** Property-based — merged regions never overlap, total duration <= sum of inputs
- **Smart Cut execution:** Integration — timeline duration decreases by removed amount, undo restores state
