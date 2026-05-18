# Requirements: Onboarding Flow

## Introduction

A 3-step welcome dialog for first-time users: (1) Welcome + 3-step workflow overview, (2) AI model status check (Gemma, Whisper), (3) Ready to start with guided tour option. Uses localStorage to skip after first visit. Reduces time-to-first-edit for new users.

## Glossary

- **Onboarding**: The first-run experience that introduces the app to new users
- **Workflow Overview**: A summary of the core editing workflow: Import → Edit → Export
- **AI Model Status**: Current state of AI models (downloading, ready, unavailable)

## Requirements

### Requirement 1: First-Run Detection

**User Story:** As a new user, I want to see an introduction to the app on first visit, so that I understand how to use it

#### Acceptance Criteria

1. WHEN the user opens the app for the first time THEN the system SHALL display the onboarding dialog
2. IF the user has previously completed onboarding THEN the system SHALL not display the dialog
3. WHEN the user dismisses the dialog THEN the system SHALL record that onboarding was completed

#### Correctness Properties

- **Property 1:** Onboarding SHALL be shown exactly once per browser (stored in localStorage)
- **Property 2:** Clearing localStorage SHALL cause onboarding to be shown again

### Requirement 2: Step-by-Step Flow

**User Story:** As a user, I want to progress through onboarding steps at my own pace, so that I can absorb the information

#### Acceptance Criteria

1. WHEN the onboarding dialog is displayed THEN the system SHALL show Step 1 of 3
2. WHEN the user clicks "Next" THEN the system SHALL advance to the next step
3. IF the user is on the last step THEN the system SHALL show "Get Started" instead of "Next"
4. WHEN the user clicks "Skip" THEN the system SHALL close the dialog and record completion

#### Correctness Properties

- **Property 1:** Users SHALL be able to navigate forward through all steps
- **Property 2:** Skipping at any step SHALL mark onboarding as complete

### Requirement 3: AI Model Status

**User Story:** As a user, I want to see the status of AI models during onboarding, so that I know what features are available

#### Acceptance Criteria

1. WHEN the user reaches the AI status step THEN the system SHALL display the current state of Gemma and Whisper models
2. IF a model is not loaded THEN the system SHALL show a "Load Model" button
3. IF a model is ready THEN the system SHALL show a green checkmark

#### Correctness Properties

- **Property 1:** Model status SHALL reflect the actual state from the model stores
- **Property 2:** Loading a model from onboarding SHALL transition the UI to show progress
