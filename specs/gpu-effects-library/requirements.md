# Requirements: GPU Effects Library

## Introduction

Expand the GPU effects library from 1 effect (gaussian blur) to 11 effects, all running as WebGPU shaders in the Rust compositor pipeline. Effects include color correction, chromatic aberration, vignette, sharpen, sepia, grayscale, invert, pixelate, noise/grain, lens distortion, and glow/bloom. All effects run client-side with zero CPU overhead during preview.

## Glossary

- **Effect Pass**: A single GPU render pass that applies a transformation to a texture
- **Multi-pass Effect**: An effect requiring multiple sequential passes (e.g., glow = threshold + blur + composite)
- **Effect Registry**: TypeScript-side definition registry that maps effect types to shader passes and UI parameters
- **EffectPipeline**: Rust-side pipeline that holds compiled WGSL shaders and executes render passes
- **Uniform Buffer**: GPU buffer containing effect parameters (resolution, direction, scalars)

## Requirements

### Requirement 1: Color Correction Effect

**User Story:** As a user, I want to adjust brightness, contrast, saturation, temperature, and tint of my clips, so that I can achieve professional color grading

#### Acceptance Criteria

1. WHEN the user adds a color correction effect THEN the system SHALL provide sliders for brightness (-100 to 100), contrast (-100 to 100), saturation (0 to 200), temperature (-100 to 100), and tint (-100 to 100)
2. WHEN any parameter changes THEN the system SHALL update the preview in real-time at 30fps minimum
3. IF all parameters are at default (0 or 100 for saturation) THEN the output SHALL be identical to the input (no-op)
4. WHEN the effect is keyframed THEN the system SHALL interpolate each parameter independently at frame boundaries

#### Correctness Properties

- **Property 1:** Color correction SHALL be applied per-pixel in a single GPU pass
- **Property 2:** Output pixel values SHALL be clamped to [0, 1] range (no overflow/underflow)
- **Property 3:** Applying color correction with all defaults SHALL produce bit-identical output to the input

### Requirement 2: Chromatic Aberration Effect

**User Story:** As a user, I want to apply chromatic aberration to my clips, so that I can create stylized glitch or lens distortion looks

#### Acceptance Criteria

1. WHEN the user adds chromatic aberration THEN the system SHALL provide intensity (0 to 100) and angle (0 to 360) parameters
2. WHEN intensity is 0 THEN the output SHALL be identical to the input
3. WHEN intensity > 0 THEN the system SHALL offset RGB channels radially from center based on angle
4. IF the effect is applied to a grayscale image THEN the output SHALL show visible RGB separation

#### Correctness Properties

- **Property 1:** RGB channel offsets SHALL be proportional to distance from the aberration center
- **Property 2:** The effect SHALL be applied in a single GPU pass
- **Property 3:** Channel values SHALL be clamped to [0, 1] after offset sampling

### Requirement 3: Vignette Effect

**User Story:** As a user, I want to add a vignette (darkened edges) to my clips, so that I can draw attention to the center of the frame

#### Acceptance Criteria

1. WHEN the user adds a vignette effect THEN the system SHALL provide intensity (0 to 100), radius (0 to 100), and softness (0 to 100) parameters
2. WHEN intensity is 0 THEN the output SHALL be identical to the input
3. WHEN intensity > 0 THEN the system SHALL darken pixels based on their distance from the center
4. IF softness is 0 THEN the vignette edge SHALL be hard (step function)
5. IF softness is 100 THEN the vignette SHALL blend smoothly from center to edge

#### Correctness Properties

- **Property 1:** Vignette darkening SHALL be radially symmetric around the frame center
- **Property 2:** The effect SHALL be applied in a single GPU pass
- **Property 3:** Pixel values at the exact center SHALL be unchanged regardless of intensity

### Requirement 4: Sharpen Effect

**User Story:** As a user, I want to sharpen my clips, so that I can enhance detail and reduce softness

#### Acceptance Criteria

1. WHEN the user adds a sharpen effect THEN the system SHALL provide an intensity parameter (0 to 100)
2. WHEN intensity is 0 THEN the output SHALL be identical to the input
3. WHEN intensity > 0 THEN the system SHALL apply unsharp mask enhancement
4. IF the input contains high-frequency noise THEN sharpening SHALL not amplify it excessively (clamping applies)

#### Correctness Properties

- **Property 1:** Sharpening SHALL use a separable kernel (horizontal + vertical passes) for performance
- **Property 2:** Output pixel values SHALL be clamped to [0, 1]
- **Property 3:** The effect SHALL be idempotent at intensity 0 (input === output)

### Requirement 5: Basic Color Transform Effects (Sepia, Grayscale, Invert)

**User Story:** As a user, I want to apply basic color transforms (sepia, grayscale, invert) to my clips, so that I can achieve common stylistic looks quickly

#### Acceptance Criteria

1. WHEN the user adds sepia THEN the system SHALL apply a warm brown tone transformation with an intensity parameter (0 to 100)
2. WHEN the user adds grayscale THEN the system SHALL convert to luminance with an intensity parameter (0 to 100)
3. WHEN the user adds invert THEN the system SHALL invert RGB channels with an intensity parameter (0 to 100)
4. WHEN intensity is 0 for any of these effects THEN the output SHALL be identical to the input
5. WHEN intensity is 100 THEN the effect SHALL be fully applied

#### Correctness Properties

- **Property 1:** Each effect SHALL be applied in a single GPU pass
- **Property 2:** Grayscale conversion SHALL use ITU-R BT.709 luminance coefficients (0.2126R + 0.7152G + 0.0722B)
- **Property 3:** All three effects SHALL support intensity blending (partial application)

### Requirement 6: Pixelate / Mosaic Effect

**User Story:** As a user, I want to pixelate regions of my clips, so that I can censor content or create retro aesthetics

#### Acceptance Criteria

1. WHEN the user adds a pixelate effect THEN the system SHALL provide a block size parameter (2 to 100 pixels)
2. WHEN block size is 1 THEN the output SHALL be identical to the input
3. WHEN block size > 1 THEN the system SHALL sample the center of each block and fill the entire block with that color
4. IF the effect is keyframed THEN the block size SHALL animate smoothly

#### Correctness Properties

- **Property 1:** Block boundaries SHALL align to a grid based on the block size
- **Property 2:** The effect SHALL be applied in a single GPU pass
- **Property 3:** All pixels within a block SHALL have identical output values

### Requirement 7: Noise / Grain Effect

**User Story:** As a user, I want to add film grain or noise to my clips, so that I can achieve a cinematic look or mask compression artifacts

#### Acceptance Criteria

1. WHEN the user adds a noise effect THEN the system SHALL provide intensity (0 to 100) and monochrome (boolean) parameters
2. WHEN intensity is 0 THEN the output SHALL be identical to the input
3. WHEN monochrome is true THEN the system SHALL apply the same noise value to all RGB channels
4. WHEN monochrome is false THEN the system SHALL apply independent noise to each RGB channel
5. IF the effect is applied to a static frame THEN the noise SHALL change each frame (temporal variation)

#### Correctness Properties

- **Property 1:** Noise SHALL be generated using a GPU-friendly pseudo-random function (no CPU involvement)
- **Property 2:** The effect SHALL be applied in a single GPU pass
- **Property 3:** Noise distribution SHALL be approximately uniform across the [0, 1] range

### Requirement 8: Lens Distortion Effect

**User Story:** As a user, I want to apply barrel or pincushion lens distortion, so that I can correct lens artifacts or create stylized fisheye looks

#### Acceptance Criteria

1. WHEN the user adds lens distortion THEN the system SHALL provide distortion (-100 to 100, negative = barrel, positive = pincushion) and zoom (0 to 100) parameters
2. WHEN distortion is 0 THEN the output SHALL be identical to the input
3. WHEN distortion < 0 THEN the system SHALL apply barrel distortion (edges bow outward)
4. WHEN distortion > 0 THEN the system SHALL apply pincushion distortion (edges bow inward)
5. IF zoom is increased THEN the system SHALL compensate for edge cropping caused by distortion

#### Correctness Properties

- **Property 1:** Distortion SHALL be radially symmetric around the frame center
- **Property 2:** The effect SHALL be applied in a single GPU pass
- **Property 3:** The center pixel SHALL remain at the center regardless of distortion amount

### Requirement 9: Glow / Bloom Effect

**User Story:** As a user, I want to add a glow/bloom effect to my clips, so that I can create dreamy, ethereal, or HDR-like looks

#### Acceptance Criteria

1. WHEN the user adds a glow effect THEN the system SHALL provide intensity (0 to 100), threshold (0 to 100), radius (0 to 100), and color parameters
2. WHEN intensity is 0 THEN the output SHALL be identical to the input
3. WHEN intensity > 0 THEN the system SHALL extract bright areas (above threshold), blur them, and additively composite back
4. IF a color is specified THEN the system SHALL tint the glow with that color
5. WHEN the effect is applied THEN the system SHALL execute 3 passes: threshold extraction, blur, additive composite

#### Correctness Properties

- **Property 1:** The threshold pass SHALL only output pixels above the threshold value
- **Property 2:** The blur pass SHALL use the existing gaussian blur shader (reused, not duplicated)
- **Property 3:** The composite pass SHALL use additive blending (output = original + glow * intensity)

### Requirement 10: Effect Registry Integration

**User Story:** As a developer, I want new effects to follow the existing registry pattern, so that adding future effects is consistent and predictable

#### Acceptance Criteria

1. WHEN a new effect is added THEN the system SHALL define a TypeScript effect definition with type, name, keywords, params[], and renderer config
2. WHEN a new effect is added THEN the system SHALL register the WGSL shader in Rust's EffectPipeline::new()
3. WHEN an effect has multiple passes THEN the system SHALL support both static passes[] and dynamic buildPasses() patterns
4. IF an effect reuses another effect's shader (e.g., glow reuses blur) THEN the system SHALL reference the existing shader, not duplicate it

#### Correctness Properties

- **Property 1:** Every effect definition SHALL have a unique type string
- **Property 2:** Every WGSL shader SHALL be registered with a unique shader ID
- **Property 3:** Effect parameters SHALL be serializable to the uniform buffer format (f32 arrays)
