# Requirements: Quick Actions Bar

## Introduction

A floating action bar that appears after transcription completes, offering one-click workflows: Smart Cut, Find/Remove Fillers, Find/Remove Silences, Add/Remove Subtitles, Popover Subtitles (Hormozi-style word-by-word). Designed for non-editors who want fast video cleanup without navigating complex menus.

## Glossary

- **Quick Action**: A single-click operation that performs a common editing task
- **Popover Subtitles**: Word-by-word animated subtitles that pop up one word at a time (Hormozi style)
- **Post-Transcription**: The state after transcription completes, when quick actions become available

## Requirements

### Requirement 1: Post-Transcription Discovery

**User Story:** As a user, I want to see available actions after transcription, so that I know what I can do next

#### Acceptance Criteria

1. WHEN transcription completes THEN the system SHALL display a floating bar with available quick actions
2. IF no transcript exists THEN the system SHALL not display the quick actions bar
3. WHEN the user dismisses the bar THEN the system SHALL hide it but allow re-access from the AI panel

#### Correctness Properties

- **Property 1:** The bar SHALL only appear after successful transcription with word-level timestamps
- **Property 2:** All actions SHALL be available regardless of transcript language

### Requirement 2: One-Click Actions

**User Story:** As a user, I want to execute common editing tasks with one click, so that I can clean up my video quickly

#### Acceptance Criteria

1. WHEN the user clicks "Smart Cut" THEN the system SHALL remove filler words and silence (per Smart Cut spec)
2. WHEN the user clicks "Add Subtitles" THEN the system SHALL generate subtitles from the transcript
3. WHEN the user clicks "Popover Subtitles" THEN the system SHALL apply Hormozi-style word-by-word animation
4. IF an action requires confirmation THEN the system SHALL show a dialog before executing

#### Correctness Properties

- **Property 1:** Each action SHALL be independently executable (no dependencies between actions)
- **Property 2:** Each action SHALL be undoable as a single operation
