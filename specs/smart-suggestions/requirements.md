# Requirements: Smart Suggestions

## Introduction

Floating notification cards that appear at the bottom-right of the editor showing AI-generated improvement suggestions with severity levels (warning, improvement, info), Apply/Dismiss buttons, and auto-dismiss after 30 seconds. Provides progressive disclosure of editing suggestions without interrupting the user's workflow.

## Glossary

- **Suggestion**: An AI-generated recommendation for improving the video
- **Severity**: Classification of suggestion importance — warning (critical issue), improvement (enhancement), info (tip)
- **Auto-dismiss**: Automatic removal of suggestion after a timeout if not interacted with

## Requirements

### Requirement 1: Suggestion Display

**User Story:** As a user, I want to see editing suggestions as floating cards, so that I can improve my video without searching for issues

#### Acceptance Criteria

1. WHEN a suggestion is generated THEN the system SHALL display it as a floating card at the bottom-right
2. IF multiple suggestions exist THEN the system SHALL queue them and show one at a time
3. WHEN a suggestion is displayed THEN the system SHALL show severity icon, description, and Apply/Dismiss buttons
4. IF no suggestions exist THEN the system SHALL not display any cards

#### Correctness Properties

- **Property 1:** Only one suggestion card SHALL be visible at a time
- **Property 2:** Suggestions SHALL be displayed in order of severity (warning > improvement > info)

### Requirement 2: Auto-Dismiss

**User Story:** As a user, I want suggestions to disappear automatically if I don't act on them, so that they don't clutter my workspace

#### Acceptance Criteria

1. WHEN a suggestion is displayed THEN the system SHALL auto-dismiss it after 30 seconds
2. IF the user hovers over the card THEN the system SHALL pause the auto-dismiss timer
3. WHEN the user moves away THEN the system SHALL resume the timer

#### Correctness Properties

- **Property 1:** Auto-dismiss SHALL not fire if the card is hovered
- **Property 2:** Each suggestion SHALL be dismissed exactly once (either by user action or auto-dismiss)

### Requirement 3: Action Execution

**User Story:** As a user, I want to apply or dismiss suggestions with one click, so that I can quickly act on recommendations

#### Acceptance Criteria

1. WHEN the user clicks "Apply" THEN the system SHALL execute the suggested action
2. WHEN the user clicks "Dismiss" THEN the system SHALL remove the card and show the next suggestion
3. IF the applied action modifies the timeline THEN the system SHALL make it undoable

#### Correctness Properties

- **Property 1:** Applying a suggestion SHALL produce the same result as manually performing the action
- **Property 2:** Dismissing a suggestion SHALL not affect the project state
