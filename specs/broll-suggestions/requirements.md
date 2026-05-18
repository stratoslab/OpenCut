# Requirements: B-Roll Suggestions

## Introduction

Analyze the transcript to suggest B-roll visuals at specific timestamps. For each suggestion: visual description, stock footage keywords, and mood. Users can search Pexels for matching stock photos/videos and insert them directly into the timeline.

## Glossary

- **B-Roll**: Supplementary footage inserted over the main video to illustrate or enhance the narrative
- **Suggestion Card**: UI element showing a B-roll recommendation with description, keywords, and search results
- **Pexels API**: Free stock photo/video API used to find matching visuals

## Requirements

### Requirement 1: Transcript Analysis

**User Story:** As a user, I want the system to analyze my transcript and suggest relevant B-roll, so that I can enhance my video with supporting visuals

#### Acceptance Criteria

1. WHEN the user opens B-Roll suggestions THEN the system SHALL analyze the transcript for visual-worthy moments
2. IF no transcript exists THEN the system SHALL display "Transcript required — run transcription first"
3. WHEN suggestions are generated THEN the system SHALL display them as cards with timestamp, description, and keywords
4. IF no suggestions can be generated THEN the system SHALL display "No B-roll suggestions for this content"

#### Correctness Properties

- **Property 1:** Each suggestion SHALL have a valid timestamp within the video duration
- **Property 2:** Suggestions SHALL be distributed across the video timeline (not clustered)

### Requirement 2: Stock Search and Insertion

**User Story:** As a user, I want to search for stock footage matching each suggestion and insert it into my timeline, so that I can quickly add B-roll

#### Acceptance Criteria

1. WHEN the user clicks "Search" on a suggestion THEN the system SHALL query the Pexels API with the suggestion's keywords
2. WHEN results are returned THEN the system SHALL display them as a grid of thumbnails
3. WHEN the user clicks a result THEN the system SHALL insert it into the timeline at the suggestion's timestamp
4. IF the Pexels API fails THEN the system SHALL display an error with retry option

#### Correctness Properties

- **Property 1:** Inserted B-roll SHALL be positioned at the correct timestamp
- **Property 2:** The B-roll element SHALL have a default duration matching the suggestion's time range
