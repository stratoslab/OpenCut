# Requirements: Background Removal

## Introduction

Remove backgrounds from images using a client-side WASM model (`@imgly/background-removal`). Users can upload an image or select from timeline media, remove the background, preview with a before/after slider, and add the result to the timeline as a transparent overlay.

## Glossary

- **Background Removal**: AI-powered segmentation that separates foreground subject from background
- **Before/After Slider**: Interactive comparison showing original and processed images side by side
- **Transparent Overlay**: Image with alpha channel added to the timeline as a visual element

## Requirements

### Requirement 1: Image Selection

**User Story:** As a user, I want to select an image for background removal, so that I can process the right image

#### Acceptance Criteria

1. WHEN the user opens background removal THEN the system SHALL offer to upload a new image or select from timeline media
2. IF the user selects from timeline THEN the system SHALL show only image-type elements
3. WHEN an image is selected THEN the system SHALL display it in the processing dialog

#### Correctness Properties

- **Property 1:** Only image files (PNG, JPG, WebP) SHALL be selectable for processing
- **Property 2:** The selected image SHALL be displayed at its original resolution

### Requirement 2: Background Removal Processing

**User Story:** As a user, I want the system to remove the background from my image, so that I get a transparent foreground subject

#### Acceptance Criteria

1. WHEN the user clicks "Remove Background" THEN the system SHALL process the image using the WASM model
2. WHILE processing THEN the system SHALL show a progress indicator
3. IF processing fails THEN the system SHALL display an error message with retry option
4. WHEN processing completes THEN the system SHALL display the result with a before/after slider

#### Correctness Properties

- **Property 1:** The output image SHALL have the same dimensions as the input
- **Property 2:** Background pixels SHALL have alpha = 0, foreground pixels SHALL have alpha > 0

### Requirement 3: Timeline Integration

**User Story:** As a user, I want to add the processed image to my timeline, so that I can use it as an overlay

#### Acceptance Criteria

1. WHEN the user clicks "Add to Timeline" THEN the system SHALL add the processed image as a new element
2. WHEN added THEN the system SHALL preserve the transparent background
3. IF the user adds to timeline THEN the system SHALL place it at the current playhead position

#### Correctness Properties

- **Property 1:** The added element SHALL render with transparency in the preview
- **Property 2:** The element SHALL be positioned at the playhead time with default duration of 5 seconds
