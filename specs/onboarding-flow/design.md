# Design: Onboarding Flow

## Overview

A modal dialog with 3 steps, controlled by a step index. Uses localStorage for first-run detection. Integrates with AI model stores to show real-time model status.

## Components

### Component 1: OnboardingDialog
- **Responsibility:** 3-step modal with navigation, localStorage integration
- **Interface:** React dialog component, auto-shows on first visit
- **Key design:** Step content defined as array of {title, description, content} objects

### Component 2: Step Content
- Step 1: Welcome + workflow overview (Import → Edit → Export) with icons
- Step 2: AI model status (Gemma, Whisper) with load buttons
- Step 3: Ready to start + optional guided tour link

## Data Flow

1. App mounts → check localStorage for `onboarding-complete`
2. If not set → show OnboardingDialog
3. User progresses through steps → on "Get Started" → set localStorage flag → close dialog

## Error Handling

| Situation | Handling |
|-----------|----------|
| localStorage unavailable (private browsing) | Treat as first visit — always show onboarding |
| AI model fails to load during onboarding | Show error state in step 2, allow proceeding without models |
| User closes browser mid-onboarding | Flag not set — next visit resumes from step 1 |

## Testing Strategy

- **Unit test:** OnboardingDialog renders correct step content for each step index
- **Unit test:** localStorage flag is set correctly on completion
- **Unit test:** Dialog does not appear on subsequent visits after flag is set
- **Integration test:** Full flow through all 3 steps completes without error
