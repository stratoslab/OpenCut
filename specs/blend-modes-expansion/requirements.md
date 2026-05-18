# Requirements: Blend Modes Expansion

## Introduction

Expand the GPU blend modes from 16 to 37, matching After Effects' full blend mode set. All blend modes are implemented in a single WGSL composite shader (`blend.wgsl`) using a switch statement, following MasterSelects' proven architecture where all 37 modes live in one 618-line shader.

## Glossary

- **Blend Mode**: A per-pixel operation that combines a source (upper layer) color with a destination (lower layer) color
- **Compositing**: The process of combining multiple layers into a single output image
- **Source (Upper)**: The layer being blended on top
- **Destination (Lower)**: The layer being blended underneath
- **Stencil/Silhouette**: Blend modes that use alpha or luminance as a mask rather than combining colors

## Requirements

### Requirement 1: Additional Component Blend Modes

**User Story:** As a user, I want access to component-level blend modes (darker color, lighter color), so that I can blend based on combined color properties rather than individual channels

#### Acceptance Criteria

1. WHEN the user selects "Darker Color" THEN the system SHALL choose the darker of source or destination per-pixel based on luminance
2. WHEN the user selects "Lighter Color" THEN the system SHALL choose the lighter of source or destination per-pixel based on luminance
3. IF source and destination have equal luminance THEN the system SHALL use source

#### Correctness Properties

- **Property 1:** Darker/Lighter Color SHALL use ITU-R BT.709 luminance for comparison
- **Property 2:** The result SHALL be either the source or destination pixel (no interpolation)

### Requirement 2: Additional Contrast Blend Modes

**User Story:** As a user, I want access to advanced contrast blend modes (linear light, vivid light, pin light, hard mix), so that I can achieve professional compositing effects

#### Acceptance Criteria

1. WHEN the user selects "Linear Light" THEN the system SHALL apply linear dodge if source > 0.5, linear burn if source <= 0.5
2. WHEN the user selects "Vivid Light" THEN the system SHALL apply color dodge if source > 0.5, color burn if source <= 0.5
3. WHEN the user selects "Pin Light" THEN the system SHALL replace destination based on source value (lighten if source > 0.5, darken if source < 0.5)
4. WHEN the user selects "Hard Mix" THEN the system SHALL output only pure RGB primaries (0 or 1 per channel)

#### Correctness Properties

- **Property 1:** Linear Light SHALL be equivalent to Linear Dodge + Linear Burn - 1.0
- **Property 2:** Hard Mix SHALL only output values of 0.0 or 1.0 per channel
- **Property 3:** All contrast modes SHALL handle edge cases (source = 0.5) without discontinuity artifacts

### Requirement 3: Additional Arithmetic Blend Modes

**User Story:** As a user, I want access to arithmetic blend modes (subtract, divide, linear dodge, linear burn), so that I can perform mathematical color operations

#### Acceptance Criteria

1. WHEN the user selects "Subtract" THEN the system SHALL output destination - source (clamped to 0)
2. WHEN the user selects "Divide" THEN the system SHALL output destination / source (with division by zero protection)
3. WHEN the user selects "Linear Dodge" THEN the system SHALL output destination + source (clamped to 1)
4. WHEN the user selects "Linear Burn" THEN the system SHALL output destination + source - 1 (clamped to 0)

#### Correctness Properties

- **Property 1:** Subtract SHALL never produce negative values (clamp to 0)
- **Property 2:** Divide SHALL handle source = 0 by returning destination (no NaN)
- **Property 3:** Linear Dodge + Linear Burn SHALL be inverses (applying both returns original)

### Requirement 4: Additional Artistic Blend Modes

**User Story:** As a user, I want access to artistic blend modes (reflect, glow, phoenix), so that I can create stylized visual effects

#### Acceptance Criteria

1. WHEN the user selects "Reflect" THEN the system SHALL apply a reflection-based blend: source² / (1 - destination)
2. WHEN the user selects "Glow" THEN the system SHALL apply the inverse of Reflect: destination² / (1 - source)
3. WHEN the user selects "Phoenix" THEN the system SHALL apply: min(source, destination) - max(source, destination) + 1

#### Correctness Properties

- **Property 1:** Reflect SHALL handle destination = 1 by returning source (no division by zero)
- **Property 2:** Glow SHALL handle source = 1 by returning destination (no division by zero)
- **Property 3:** Phoenix SHALL always produce values in [0, 1] range

### Requirement 5: Stencil and Silhouette Blend Modes

**User Story:** As a user, I want access to stencil and silhouette blend modes, so that I can use layers as masks

#### Acceptance Criteria

1. WHEN the user selects "Stencil Alpha" THEN the system SHALL show destination only where source alpha is opaque
2. WHEN the user selects "Silhouette Alpha" THEN the system SHALL show destination only where source alpha is transparent
3. WHEN the user selects "Stencil Luma" THEN the system SHALL show destination only where source luminance is bright
4. WHEN the user selects "Silhouette Luma" THEN the system SHALL show destination only where source luminance is dark

#### Correctness Properties

- **Property 1:** Stencil Alpha SHALL preserve destination color values (no modification, only masking)
- **Property 2:** Silhouette modes SHALL be the logical inverse of their stencil counterparts
- **Property 3:** Luma-based modes SHALL use BT.709 luminance coefficients

### Requirement 6: Single Shader Architecture

**User Story:** As a developer, I want all 37 blend modes in a single WGSL shader, so that compositing has zero runtime abstraction layers and minimal overhead

#### Acceptance Criteria

1. WHEN the compositor runs THEN the system SHALL use a single `blend.wgsl` shader with a switch statement on blend mode
2. WHEN a new blend mode is added THEN the system SHALL only require adding a case to the switch statement
3. IF the blend mode is "Normal" THEN the system SHALL apply source over destination with alpha compositing
4. WHEN any blend mode runs THEN the system SHALL handle alpha correctly (premultiplied alpha support)

#### Correctness Properties

- **Property 1:** All 37 blend modes SHALL be implemented in a single WGSL file
- **Property 2:** The shader SHALL not branch on blend mode per-pixel (use switch, not if-else chains)
- **Property 3:** Alpha compositing SHALL be correct for all modes (source-over with proper alpha blending)
