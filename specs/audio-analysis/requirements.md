# Requirements: Audio Analysis

## Introduction

Client-side audio analysis features: beat detection for music synchronization, auto-ducking to lower background music during speech, and loudness normalization (LUFS) for consistent audio levels across clips. All processing uses Web Audio API — no server required.

## Glossary

- **Beat Detection**: Identifying rhythmic peaks in audio for synchronization purposes
- **Auto Duck**: Automatically lowering background audio volume when speech is detected
- **LUFS**: Loudness Units Full Scale — standard for measuring perceived loudness
- **Loudness Normalization**: Adjusting audio levels to a target LUFS value

## Requirements

### Requirement 1: Beat Detection

**User Story:** As a user, I want to detect beats in my background music, so that I can synchronize cuts and transitions to the rhythm

#### Acceptance Criteria

1. WHEN the user runs beat detection on an audio clip THEN the system SHALL identify beat timestamps using Web Audio API FFT analysis
2. WHEN beats are detected THEN the system SHALL display them as markers on the timeline
3. IF no beats are found THEN the system SHALL display "No beats detected in this audio"

#### Correctness Properties

- **Property 1:** Beat timestamps SHALL be monotonically increasing
- **Property 2:** Beat detection SHALL complete within 5 seconds for a 5-minute audio clip

### Requirement 2: Auto Duck

**User Story:** As a user, I want background music to automatically lower when speech is present, so that my voice is always clearly audible

#### Acceptance Criteria

1. WHEN the user enables auto duck THEN the system SHALL analyze speech regions from the transcript
2. WHEN speech is detected THEN the system SHALL lower background audio by a configurable amount (default -12dB)
3. WHEN speech ends THEN the system SHALL smoothly restore background audio volume
4. IF no transcript exists THEN the system SHALL use silence detection as a proxy for speech regions

#### Correctness Properties

- **Property 1:** Auto duck volume changes SHALL be smooth (no abrupt jumps)
- **Property 2:** Background audio SHALL return to original volume after speech ends

### Requirement 3: Loudness Normalization

**User Story:** As a user, I want all my audio clips to have consistent loudness, so that viewers don't need to adjust volume between clips

#### Acceptance Criteria

1. WHEN the user runs loudness normalization THEN the system SHALL measure LUFS for each audio clip
2. WHEN normalization is applied THEN the system SHALL adjust clip volumes to the target LUFS (default -16 LUFS)
3. IF a clip is already at the target loudness THEN the system SHALL not modify it

#### Correctness Properties

- **Property 1:** After normalization, all clips SHALL be within ±1 LUFS of the target
- **Property 2:** Normalization SHALL not clip (peak > 0dBFS) — apply limiting if needed
