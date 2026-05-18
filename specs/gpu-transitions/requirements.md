# Requirements: GPU Transitions

## Introduction

Move timeline transitions from the TypeScript canvas renderer to WebGPU shaders in the Rust compositor. Implement 6 GPU-accelerated transitions (crossfade, slide, wipe, iris, clockWipe, glitch) as a single transition shader with a `transitionType` uniform and `progress` (0→1) parameter. All transitions run on GPU with zero CPU overhead during preview.

## Glossary

- **Transition**: A visual effect that plays between two adjacent clips on the timeline
- **Progress**: A value from 0 to 1 representing the transition's completion (0 = clip A fully visible, 1 = clip B fully visible)
- **Transition Duration**: The time span over which the transition plays (typically 0.5-2 seconds)
- **A Clip**: The outgoing clip (source, visible at progress = 0)
- **B Clip**: The incoming clip (destination, visible at progress = 1)

## Requirements

### Requirement 1: Crossfade Transition

**User Story:** As a user, I want a smooth crossfade between clips, so that transitions feel natural and professional

#### Acceptance Criteria

1. WHEN the user adds a crossfade transition THEN the system SHALL blend clip A into clip B linearly over the transition duration
2. WHEN progress is 0 THEN the system SHALL show only clip A
3. WHEN progress is 1 THEN the system SHALL show only clip B
4. WHEN progress is 0.5 THEN the system SHALL show an equal blend of both clips

#### Correctness Properties

- **Property 1:** Crossfade SHALL use linear interpolation: `output = mix(a, b, progress)`
- **Property 2:** At progress = 0, output SHALL be bit-identical to clip A
- **Property 3:** At progress = 1, output SHALL be bit-identical to clip B

### Requirement 2: Slide Transition

**User Story:** As a user, I want slide transitions (left, right, up, down), so that I can create dynamic directional transitions between clips

#### Acceptance Criteria

1. WHEN the user adds a slide-left transition THEN the system SHALL slide clip A to the left while revealing clip B from the right
2. WHEN the user adds a slide-right transition THEN the system SHALL slide clip A to the right while revealing clip B from the left
3. WHEN progress is 0 THEN clip A SHALL be fully visible
4. WHEN progress is 1 THEN clip B SHALL be fully visible
5. IF the user specifies a direction THEN the system SHALL slide in that direction

#### Correctness Properties

- **Property 1:** The sliding clip SHALL move at constant speed across the transition duration
- **Property 2:** No gap SHALL appear between the two clips during the transition
- **Property 3:** Output at boundaries (0, 1) SHALL be bit-identical to the respective clip

### Requirement 3: Wipe Transition

**User Story:** As a user, I want wipe transitions (left, right), so that I can create clean, sharp edge transitions between clips

#### Acceptance Criteria

1. WHEN the user adds a wipe-left transition THEN the system SHALL reveal clip B by wiping from right to left
2. WHEN the user adds a wipe-right transition THEN the system SHALL reveal clip B by wiping from left to right
3. WHEN progress is 0.5 THEN the system SHALL show clip A on one half and clip B on the other half
4. IF the wipe edge is sharp THEN there SHALL be no blending between clips

#### Correctness Properties

- **Property 1:** The wipe boundary SHALL be a vertical line at position `progress * width`
- **Property 2:** Pixels on the A side SHALL be from clip A, pixels on the B side from clip B
- **Property 3:** No interpolation SHALL occur at the boundary (hard edge)

### Requirement 4: Iris Transition

**User Story:** As a user, I want an iris (circular reveal) transition, so that I can create classic cinematic transitions

#### Acceptance Criteria

1. WHEN the user adds an iris transition THEN the system SHALL reveal clip B through a circular opening that expands from center
2. WHEN progress is 0 THEN the system SHALL show only clip A (no opening)
3. WHEN progress is 1 THEN the system SHALL show only clip B (fully opened)
4. WHEN progress is 0.5 THEN the system SHALL show clip B in a circle of radius `0.5 * max(width, height)` centered on the frame

#### Correctness Properties

- **Property 1:** The iris opening SHALL be a perfect circle centered on the frame
- **Property 2:** The radius SHALL grow linearly with progress
- **Property 3:** Pixels inside the circle SHALL be from clip B, outside from clip A

### Requirement 5: Clock Wipe Transition

**User Story:** As a user, I want a clock wipe (radial sweep) transition, so that I can create a sweeping reveal effect

#### Acceptance Criteria

1. WHEN the user adds a clock wipe transition THEN the system SHALL reveal clip B by sweeping clockwise from the top
2. WHEN progress is 0 THEN the system SHALL show only clip A
3. WHEN progress is 0.25 THEN the system SHALL show clip B in the top-right quadrant
4. WHEN progress is 0.5 THEN the system SHALL show clip B in the top half

#### Correctness Properties

- **Property 1:** The sweep angle SHALL be `progress * 2π` radians
- **Property 2:** Pixels within the swept angle SHALL be from clip B, outside from clip A
- **Property 3:** The sweep center SHALL be the frame center

### Requirement 6: Glitch Transition

**User Story:** As a user, I want a glitch transition, so that I can create stylized, modern transitions with digital artifact effects

#### Acceptance Criteria

1. WHEN the user adds a glitch transition THEN the system SHALL apply horizontal slice displacement with RGB channel separation
2. WHEN progress is near 0 or 1 THEN the system SHALL show the respective clip with minimal glitch
3. WHEN progress is near 0.5 THEN the system SHALL show maximum glitch effect
4. IF the glitch intensity is configurable THEN the system SHALL adjust the displacement amount

#### Correctness Properties

- **Property 1:** The glitch effect SHALL be deterministic for the same progress value (no random noise)
- **Property 2:** Horizontal slices SHALL not extend beyond frame boundaries
- **Property 3:** Output at progress = 0 and 1 SHALL be bit-identical to the respective clip

### Requirement 7: GPU Transition Architecture

**User Story:** As a developer, I want all transitions in a single WGSL shader, so that adding new transitions is consistent and the compositor has minimal overhead

#### Acceptance Criteria

1. WHEN the compositor renders a transition THEN the system SHALL use a single `transition.wgsl` shader with a switch on transition type
2. WHEN a transition is rendered THEN the system SHALL receive two input textures (clip A, clip B) and a progress uniform
3. WHEN a new transition is added THEN the system SHALL only require adding a case to the switch statement
4. IF no transition is active THEN the system SHALL pass through clip A unchanged

#### Correctness Properties

- **Property 1:** All transitions SHALL be implemented in a single WGSL file
- **Property 2:** The shader SHALL accept exactly two input textures and one progress uniform
- **Property 3:** All transitions SHALL produce correct output at progress boundaries (0 and 1)
