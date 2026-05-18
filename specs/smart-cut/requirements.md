# Requirements: Smart Cut

## Introduction

One-click filler word and silence removal that analyzes the transcript for filler words ("um", "uh", "like", "you know") and the audio waveform for silence regions, then removes both from the timeline in a single operation. Serves non-editors who want clean video without manual clip editing.

## Glossary

- **Filler Word**: Common speech disfluencies: "um", "uh", "like", "you know", "so", "basically", "actually"
- **Silence Region**: Audio segment below a configurable amplitude threshold for a minimum duration
- **Smart Cut**: Combined operation that removes both filler words and silence regions
- **Sensitivity**: Threshold controlling how aggressively silence is detected (low/medium/high)

## Requirements

### Requirement 1: Filler Word Detection

**User Story:** As a user, I want the system to identify filler words in my transcript, so that I can remove them without manually finding each one

#### Acceptance Criteria

1. WHEN the user runs filler detection THEN the system SHALL identify all filler words from the transcript using word-level timestamps
2. IF the transcript has no word-level timestamps THEN the system SHALL display "Transcript required — run transcription first"
3. WHEN filler words are found THEN the system SHALL display the count and highlight them in the transcript view
4. IF no filler words are found THEN the system SHALL display "No filler words detected"

#### Correctness Properties

- **Property 1:** Filler detection SHALL be case-insensitive and match whole words only (e.g., "like" matches "like" but not "likely")
- **Property 2:** Detected filler words SHALL have valid timestamps within the video duration

### Requirement 2: Silence Detection

**User Story:** As a user, I want the system to detect silence regions in my audio, so that I can remove dead air from my video

#### Acceptance Criteria

1. WHEN the user runs silence detection THEN the system SHALL analyze the audio waveform using Web Audio API
2. WHEN silence is detected THEN the system SHALL display regions with start/end timestamps and duration
3. IF the silence threshold is adjusted THEN the system SHALL re-detect and update results
4. IF no silence is found THEN the system SHALL display "No silence regions detected"

#### Correctness Properties

- **Property 1:** Silence regions SHALL not overlap with each other
- **Property 2:** All silence regions SHALL have duration >= minimum threshold (configurable, default 0.5s)
- **Property 3:** Silence detection SHALL complete within 10 seconds for a 30-minute video

### Requirement 3: Smart Cut Execution

**User Story:** As a user, I want to remove all filler words and silence with one click, so that I can clean up my video quickly

#### Acceptance Criteria

1. WHEN the user clicks "Smart Cut" THEN the system SHALL remove all detected filler words and silence regions from the timeline
2. WHEN content is removed THEN the system SHALL ripple-close gaps by shifting subsequent clips
3. IF Smart Cut is executed THEN the system SHALL create a single undo entry for the entire operation
4. WHEN Smart Cut completes THEN the system SHALL display the total time removed

#### Correctness Properties

- **Property 1:** After Smart Cut, the timeline SHALL have no gaps where filler/silence was removed
- **Property 2:** The total timeline duration SHALL decrease by the sum of removed regions
- **Property 3:** Undo SHALL restore the timeline to its exact pre-Smart Cut state

### Requirement 4: Sensitivity Control

**User Story:** As a user, I want to control how aggressively silence is detected, so that I can fine-tune the results

#### Acceptance Criteria

1. WHEN the user adjusts the sensitivity slider THEN the system SHALL re-detect silence with the new threshold
2. IF sensitivity is set to "low" THEN the system SHALL use a higher amplitude threshold (only very quiet regions)
3. IF sensitivity is set to "high" THEN the system SHALL use a lower amplitude threshold (include quieter regions)

#### Correctness Properties

- **Property 1:** Higher sensitivity SHALL always detect >= the number of silence regions detected at lower sensitivity
- **Property 2:** Sensitivity changes SHALL not affect filler word detection (only silence)
