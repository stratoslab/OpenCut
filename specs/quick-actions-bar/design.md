# Design: Quick Actions Bar

## Overview

A floating bar component that appears at the bottom of the editor after transcription. Contains action buttons with icons and labels. Each action delegates to existing services (Smart Cut, subtitle generation, etc.).

## Components

### Component 1: QuickActionsBar
- **Responsibility:** Display action buttons, handle click events, show confirmation dialogs
- **Interface:** React component, conditionally rendered based on transcription state
- **Dependencies:** Transcription store, Smart Cut service, subtitle service

### Component 2: Action Buttons
- Smart Cut (scissors icon)
- Find Fillers (text icon)
- Find Silences (waveform icon)
- Add Subtitles (caption icon)
- Popover Subtitles (animation icon)

## Data Flow

1. Transcription completes → store updates → QuickActionsBar appears
2. User clicks action → confirmation (if needed) → execute → bar dismisses or shows progress

## Error Handling

| Situation | Handling |
|-----------|----------|
| Action fails to execute | Show inline error on the button, keep bar visible |
| Multiple actions clicked rapidly | Queue actions — execute serially |
| Transcription is deleted | Dismiss bar automatically |

## Testing Strategy

- **Unit test:** Bar appears only after transcription completion event
- **Unit test:** Bar is hidden when dismissed, re-accessible from AI panel
- **Unit test:** All 5 buttons dispatch correct action calls
- **Integration test:** Click Smart Cut → confirmation dialog → execute → bar updates
