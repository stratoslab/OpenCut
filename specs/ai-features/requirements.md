# Requirements: AI Features Suite

## Introduction

This spec adds three AI-powered features to StratosCut's Vite + React SPA: an AI Co-Pilot Agent that executes multi-step editing plans from natural language, client-side scene detection that identifies visual cuts without server processing, and YouTube chapters export that generates timestamped chapters and descriptions. All processing runs locally in the browser — no video or data leaves the user's machine.

## Glossary

- **AI Co-Pilot** — Local LLM agent that analyzes project state and generates step-by-step editing plans
- **Action Type** — One of 19 predefined editing operations the AI can invoke (split, delete, add effect, etc.)
- **Scene Detection** — Algorithm that identifies visual boundaries between shots using frame histogram analysis
- **Chi-squared Distance** — Statistical measure of difference between two color histograms
- **Chapter Markers** — YouTube-formatted `MM:SS Title` timestamp entries marking topic boundaries
- **Quick Preset** — Predefined AI workflow (e.g., "60-second reel", "remove silences")

## Requirements

### Requirement 1: AI Co-Pilot Agent

**User Story:** As a video editor, I want to describe my editing goal in plain English and have the AI create and execute a step-by-step plan, so that I can accomplish complex editing tasks without manual timeline manipulation.

#### Acceptance Criteria

1. WHEN the user types a natural language goal THEN the system SHALL analyze the current project state (tracks, clips, transcript, duration) and return a multi-step editing plan
2. WHEN the AI returns a plan THEN the system SHALL display each step with a description, affected clips, and estimated impact
3. WHEN the user clicks Execute THEN the system SHALL run steps sequentially with live progress indicators and allow cancellation at any point
4. WHEN a step completes THEN the system SHALL update the timeline preview and mark the step as done before proceeding to the next
5. WHEN the user selects a Quick Preset THEN the system SHALL auto-generate and execute the corresponding plan without requiring step-by-step review
6. IF the LLM is not available or fails THEN the system SHALL display an error and suggest retrying

#### Correctness Properties

- **Property 1:** Each AI-generated step SHALL map to exactly one valid action type from the 19 supported operations
- **Property 2:** The undo stack SHALL capture the entire plan execution as a single reversible operation (undo undoes all steps at once)
- **Property 3:** No step SHALL modify the timeline without explicit user confirmation (either per-step approval or preset selection)
- **Property 4:** The LLM prompt SHALL include only project metadata (clip names, durations, track structure, transcript text) — never raw video binary data

### Requirement 2: Client-Side Scene Detection

**User Story:** As a video editor, I want to automatically detect scene changes (camera cuts, angle changes, lighting shifts) in my imported footage, so that I can quickly identify shot boundaries without watching the entire video.

#### Acceptance Criteria

1. WHEN the user requests scene detection on a video clip THEN the system SHALL extract frames at configurable intervals (default: every 0.5s) using the HTMLVideoElement
2. WHEN frames are extracted THEN the system SHALL compute 24-bin RGB color histograms for each frame using Canvas API
3. WHEN histograms are computed THEN the system SHALL calculate chi-squared distance between consecutive frames
4. WHEN the chi-squared distance exceeds a configurable threshold THEN the system SHALL flag the position as a scene cut or dissolve
5. WHEN scene detection completes THEN the system SHALL display before/after thumbnails for each detected scene change
6. IF the video has no detectable scene changes THEN the system SHALL report that no cuts were found above the threshold

#### Correctness Properties

- **Property 1:** Scene detection SHALL process frames entirely in the browser — no frames SHALL be sent to any external server
- **Property 2:** The histogram computation SHALL be deterministic — running detection twice on the same video at the same interval produces identical results
- **Property 3:** The detection process SHALL not block the main thread for more than 100ms per frame batch (use Web Worker)
- **Property 4:** Memory usage SHALL not exceed 50MB regardless of video length (process frames in streaming fashion, discard old histograms)

### Requirement 3: YouTube Chapters Export

**User Story:** As a content creator, I want to export chapter markers and a full YouTube description from my video, so that I can paste them directly into YouTube without manual formatting.

#### Acceptance Criteria

1. WHEN the user clicks "Export YouTube Chapters" THEN the system SHALL generate chapter markers in `MM:SS Title` format from detected scene boundaries or AI-analyzed topic boundaries
2. WHEN chapters are generated THEN the system SHALL copy the formatted text to the clipboard with one click
3. WHEN the user requests a full YouTube description THEN the system SHALL generate a title, description body, chapter timestamps, and suggested tags
4. IF the video has no transcript THEN the system SHALL use scene detection boundaries as chapter markers with generic titles ("Scene 1", "Scene 2", etc.)
5. IF the video has a transcript THEN the system SHALL use the local LLM to analyze topic boundaries and generate descriptive chapter titles

#### Correctness Properties

- **Property 1:** The first chapter SHALL always start at `0:00`
- **Property 2:** Chapter timestamps SHALL be monotonically increasing and SHALL NOT exceed the video duration
- **Property 3:** The exported format SHALL be plain text — no markdown, HTML, or rich text
- **Property 4:** Chapter generation SHALL not modify the project or timeline in any way (read-only operation)

### Requirement 4: Shared Infrastructure

**User Story:** As a developer, I want all three features to share common infrastructure (LLM access, video frame extraction, UI patterns), so that the codebase stays maintainable and consistent.

#### Acceptance Criteria

1. WHEN any feature needs video frames THEN the system SHALL use a shared `FrameExtractor` service that handles HTMLVideoElement seeking and canvas capture
2. WHEN any feature needs LLM processing THEN the system SHALL use the existing Gemma LLM infrastructure (WebGPU, Web Worker)
3. WHEN any feature displays results THEN the system SHALL use consistent panel UI patterns matching the existing assets panel design

#### Correctness Properties

- **Property 1:** The shared FrameExtractor SHALL support concurrent frame extraction requests from multiple features without race conditions
- **Property 2:** The LLM service SHALL queue requests and process them sequentially to avoid GPU memory exhaustion
