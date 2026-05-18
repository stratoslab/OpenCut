# Design: Background Removal

## Overview

Dialog component that uses `@imgly/background-removal` (WASM, runs in browser) to process images. Shows before/after comparison slider, then allows adding the result to the timeline.

## Components

### Component 1: BackgroundRemovalDialog
- **Responsibility:** Image selection, processing, preview, timeline integration
- **Interface:** React dialog component
- **Dependencies:** `@imgly/background-removal`, MediaManager

### Component 2: BeforeAfterSlider
- **Responsibility:** Interactive comparison between original and processed images
- **Interface:** React component with draggable divider

## Data Flow

1. User opens dialog → selects image
2. Clicks "Remove Background" → WASM model processes image
3. Result shown with before/after slider
4. User clicks "Add to Timeline" → new image element created with transparent PNG

## Error Handling

| Situation | Handling |
|-----------|----------|
| WASM model fails to load | Show retry button with error message |
| Image processing exceeds 30s | Show timeout error, suggest smaller image |
| Model produces all-transparent result | Warn user "No background detected — result may be empty" |

## Testing Strategy

- **Unit test:** BackgroundRemovalDialog renders correct states (idle, processing, result, error)
- **Unit test:** BeforeAfterSlider handles drag events correctly
- **Integration test:** Full flow — select image → process → add to timeline
- **Property-based test:** For any processed image, the output dimensions SHALL match the input dimensions
