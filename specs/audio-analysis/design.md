# Design: Audio Analysis

## Overview

Three audio analysis services using Web Audio API: BeatDetector (FFT energy peaks), AutoDucker (volume automation based on speech regions), LoudnessNormalizer (LUFS measurement and gain adjustment).

## Components

### Component 1: BeatDetector
- **Responsibility:** Detect beats in audio via OfflineAudioContext + FFT energy analysis
- **Interface:** `detect(audio: Float32Array): number[]` — returns beat timestamps in seconds
- **Key design:** Uses energy-based onset detection with adaptive threshold

### Component 2: AutoDucker
- **Responsibility:** Generate volume automation curves that lower background audio during speech
- **Interface:** `generate(speechRegions: TimeRange[], options: { duckAmount: number, attackTime: number, releaseTime: number }): VolumeAutomation[]`
- **Key design:** Smooth attack/release curves to avoid abrupt volume changes

### Component 3: LoudnessNormalizer
- **Responsibility:** Measure LUFS per clip, calculate gain adjustment, apply normalization
- **Interface:** `normalize(clips: AudioClip[], targetLUFS: number): NormalizedClip[]`
- **Key design:** ITU-R BS.1770-4 compliant loudness measurement

## Data Flow

1. User selects audio clip → runs analysis → results displayed
2. For auto duck: speech regions from transcript → volume automation → applied to audio track
3. For loudness: measure LUFS → calculate gain → apply to clip volume

## Error Handling

| Situation | Handling |
|-----------|----------|
| Audio clip too short for analysis | Return empty results with warning message |
| OfflineAudioContext fails (unsupported sample rate) | Fall back to ScriptProcessorNode |
| Beat detection finds no beats | Return empty array — UI shows "No beats detected" |

## Testing Strategy

- **Unit test:** BeatDetector returns expected timestamps for known audio patterns (sine wave at known BPM)
- **Unit test:** AutoDucker attack/release curves don't exceed 0dB
- **Unit test:** LoudnessNormalizer matches ITU-R BS.1770-4 reference values
- **Property-based test:** For any valid audio input, AutoDucker output SHALL never exceed input peak level
