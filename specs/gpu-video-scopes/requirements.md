# Requirements: GPU Video Scopes

## Introduction

Add real-time GPU-accelerated video scopes (Histogram, Vectorscope, Waveform) for professional color grading analysis. Scopes run as WebGPU compute shaders that read the composited frame texture and output analysis data, displayed in dockable panels. All processing happens client-side with zero CPU overhead.

## Glossary

- **Histogram**: A chart showing the distribution of pixel brightness values (0-255) across an image
- **Vectorscope**: A circular chart showing chrominance (color) information — hue as angle, saturation as distance from center
- **Waveform**: A chart showing luminance distribution across the frame width, with brightness on the Y-axis
- **Compute Shader**: A WebGPU shader that performs general-purpose computation (not rendering)
- **Dockable Panel**: A UI panel that can be positioned, resized, and docked within the editor layout

## Requirements

### Requirement 1: Histogram Scope

**User Story:** As a user, I want to see a real-time histogram of my video's brightness distribution, so that I can assess exposure and color balance during editing

#### Acceptance Criteria

1. WHEN the user opens the Histogram scope THEN the system SHALL display RGB channels as colored overlays plus a luminance channel as white
2. WHEN the frame changes THEN the system SHALL update the histogram within 1 frame (33ms at 30fps)
3. IF the histogram scope is minimized THEN the system SHALL stop computing to save GPU resources
4. WHEN the user hovers over the histogram THEN the system SHALL show the pixel count at that brightness level

#### Correctness Properties

- **Property 1:** The histogram SHALL have exactly 256 bins (one per brightness level 0-255)
- **Property 2:** The sum of all bin values SHALL equal the total number of pixels in the frame
- **Property 3:** The histogram computation SHALL use a WebGPU compute shader (not CPU)

### Requirement 2: Vectorscope

**User Story:** As a user, I want to see a vectorscope of my video's color information, so that I can accurately assess and correct color casts

#### Acceptance Criteria

1. WHEN the user opens the Vectorscope THEN the system SHALL display a circular chart with chrominance data
2. WHEN the vectorscope updates THEN the system SHALL show hue as angle (0°=red, 120°=green, 240°=blue) and saturation as distance from center
3. IF the vectorscope shows a color cast THEN the user SHALL see an off-center distribution
4. WHEN the user hovers over the vectorscope THEN the system SHALL show the hue angle and saturation at that point

#### Correctness Properties

- **Property 1:** Pure white/gray/black pixels SHALL appear at the center (zero chrominance)
- **Property 2:** Fully saturated colors SHALL appear at the edge of the circle
- **Property 3:** The vectorscope SHALL use YCbCr color space for chrominance calculation

### Requirement 3: Waveform Scope

**User Story:** As a user, I want to see a waveform display of my video's luminance across the frame width, so that I can identify exposure issues and balance lighting

#### Acceptance Criteria

1. WHEN the user opens the Waveform scope THEN the system SHALL display luminance values plotted against frame position
2. WHEN the waveform updates THEN the system SHALL show the X-axis as frame position (left to right) and Y-axis as brightness (0=black at bottom, 100%=white at top)
3. IF the waveform shows clipping THEN values SHALL extend beyond the 0-100% range
4. WHEN the user hovers over the waveform THEN the system SHALL show the luminance value at that position

#### Correctness Properties

- **Property 1:** The waveform SHALL sample every column of the frame (width = frame width)
- **Property 2:** Luminance values SHALL use BT.709 coefficients
- **Property 3:** The waveform computation SHALL use a WebGPU compute shader

### Requirement 4: Scope Panel Management

**User Story:** As a user, I want to open, close, resize, and dock scope panels, so that I can arrange my workspace for efficient color grading

#### Acceptance Criteria

1. WHEN the user opens a scope THEN the system SHALL display it in a dockable panel
2. WHEN the user resizes a scope panel THEN the system SHALL adjust the scope rendering to fit
3. IF multiple scopes are open THEN the system SHALL update all of them from the same frame
4. WHEN a scope panel is closed THEN the system SHALL stop computing that scope

#### Correctness Properties

- **Property 1:** Opening/closing scopes SHALL NOT affect the main video rendering
- **Property 2:** Multiple scopes SHALL share the same input frame texture (no duplicate reads)
- **Property 3:** Scope computation SHALL run after the main frame is composited (post-render pass)

### Requirement 5: Performance

**User Story:** As a user, I want scopes to update in real-time without affecting preview performance, so that I can grade color while scrubbing the timeline

#### Acceptance Criteria

1. WHEN all three scopes are open THEN the system SHALL maintain 30fps preview minimum
2. IF the GPU is overloaded THEN the system SHALL reduce scope update rate (not preview rate)
3. WHEN the scope panel is not visible THEN the system SHALL not compute that scope

#### Correctness Properties

- **Property 1:** Scope computation SHALL NOT block the main render pipeline
- **Property 2:** Each scope SHALL complete in <5ms at 1080p on mid-tier GPU
- **Property 3:** Scope data SHALL be computed from the composited frame (not raw input)
