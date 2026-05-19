# Requirements: GPU Performance Overhaul

## Introduction

StratosCut's Rust/WASM GPU compositor is functional but has performance gaps compared to leading browser-based video editors (MasterSelects, Tooscut, KubeezCut). This overhaul targets 18 improvements across compositing, effects, transitions, scopes, export, and architecture to achieve professional-grade real-time editing performance.

## Glossary

- **Ping-pong compositing**: Alternating between two textures for layer blending, avoiding per-layer texture allocation
- **Bind group**: WebGPU object that binds textures, samplers, and uniform buffers to a pipeline
- **Texture pool**: Reusable GPU textures keyed by dimensions, avoiding allocation/deallocation per frame
- **GPU backpressure**: Limiting concurrent GPU work to prevent memory pressure and queue buildup
- **Zero-copy video texture**: Using `importExternalTexture` to reference video frames without CPU copy
- **WebCodecs**: Browser API for frame-accurate video encoding/decoding
- **JFA (Jump Flood Algorithm)**: Algorithm used for GPU mask feathering
- **CDL (Color Decision List)**: ASC-CDL color correction formula: `output = (input * slope + offset) ^ power`
- **SDF (Signed Distance Field)**: Mathematical representation of shapes for anti-aliased rendering
- **WSOLA**: Waveform Similarity Overlap-Add, algorithm for pitch-preserving time stretching

---

## Requirements

### Requirement 1: Ping-Pong Compositing

**User Story:** As a video editor, I want smooth real-time preview with multiple layers, so that I can edit complex timelines without lag.

#### Acceptance Criteria

1. WHEN compositing N layers THEN the system SHALL use exactly 2 alternating textures (ping/pong) regardless of N
2. WHEN a layer is rendered THEN the system SHALL write to the write texture and read from the read texture
3. WHEN all layers are composited THEN the system SHALL swap read/write exactly N times
4. IF the resolution changes THEN the system SHALL reallocate both ping/pong textures to the new dimensions
5. WHERE the current implementation creates a new texture per blend THEN the new implementation SHALL reuse the 2 alternating textures

#### Correctness Properties

- **Invariant 1:** The number of texture allocations per frame SHALL be constant (2) regardless of layer count
- **Invariant 2:** The final composite result SHALL be identical to the current implementation (pixel-perfect)
- **Invariant 3:** Memory usage SHALL NOT grow with layer count

---

### Requirement 2: Bind Group Caching

**User Story:** As a video editor, I want fast frame rendering, so that the preview stays at 60fps even with many layers and effects.

#### Acceptance Criteria

1. WHEN a layer's texture has not changed THEN the system SHALL reuse the cached bind group
2. WHEN a layer's texture changes THEN the system SHALL invalidate and recreate the bind group for that layer
3. WHEN the resolution changes THEN the system SHALL clear all bind group caches
4. WHERE bind groups are keyed THEN the key SHALL be `"{layer_id}:{ping|pong}"`
5. IF a bind group is not in cache THEN the system SHALL create it and store it for future reuse

#### Correctness Properties

- **Invariant 1:** Bind group creation count per frame SHALL be ≤ number of changed layers
- **Invariant 2:** Cached bind groups SHALL always reference valid (non-destroyed) textures

---

### Requirement 3: Texture Pool Compaction

**User Story:** As a video editor working on long sessions, I want stable memory usage, so that the editor doesn't slow down or crash over time.

#### Acceptance Criteria

1. WHEN a frame completes THEN the system SHALL return all in-use textures to the available pool
2. WHEN the pool is compacted THEN the system SHALL destroy excess unused textures, keeping at most 2 per dimension key
3. WHEN a texture is acquired THEN the system SHALL reuse an available texture if one exists, or create a new one
4. WHERE texture keys are used THEN the key SHALL include width, height, and format: `"{width}x{height}x{format}"`
5. IF metrics are requested THEN the system SHALL report total created, total acquires, cache hits, and cache hit rate

#### Correctness Properties

- **Invariant 1:** Total pool memory SHALL be bounded by `2 * max_dimensions * bytes_per_pixel`
- **Invariant 2:** No texture SHALL be destroyed while still in use

---

### Requirement 4: GPU Backpressure

**User Story:** As a video editor, I want the editor to remain responsive under heavy GPU load, so that it doesn't freeze or crash when applying complex effects.

#### Acceptance Criteria

1. WHEN the number of GPU frames in flight exceeds 2 THEN the system SHALL skip rendering the next frame
2. WHEN a GPU frame completes THEN the system SHALL decrement the in-flight counter
3. WHEN the in-flight counter reaches 0 THEN the system SHALL resume normal rendering
4. IF the GPU device is lost THEN the system SHALL reset the in-flight counter to 0

#### Correctness Properties

- **Invariant 1:** GPU frames in flight SHALL NEVER exceed 2
- **Invariant 2:** The in-flight counter SHALL NEVER go below 0

---

### Requirement 5: Effect Registry

**User Story:** As a developer adding new effects, I want a clean registration pattern, so that adding effects requires minimal boilerplate and effects are automatically available in the UI.

#### Acceptance Criteria

1. WHEN an effect is defined THEN it SHALL include: id, name, category, shader source, entry point, uniform size, params, and pack_uniforms function
2. WHEN the effect pipeline initializes THEN it SHALL create a render pipeline for each registered effect
3. WHEN effects are categorized THEN they SHALL be grouped into: color, blur, distort, stylize, keying
4. WHERE effect shaders are loaded THEN they SHALL be embedded as Rust constants via `include_str!`
5. IF an unknown effect is requested THEN the system SHALL return an error with the effect name

#### Correctness Properties

- **Invariant 1:** All registered effects SHALL have valid shader sources that compile successfully
- **Invariant 2:** Effect uniform sizes SHALL be multiples of 16 bytes (WebGPU alignment requirement)

---

### Requirement 6: Shared WGSL Library

**User Story:** As a developer writing effect shaders, I want common functions available without duplication, so that shaders are consistent and easier to maintain.

#### Acceptance Criteria

1. WHEN a WGSL shader is compiled THEN common functions SHALL be prepended automatically
2. WHERE common functions are defined THEN they SHALL include: rgb2hsv, hsv2rgb, rgb2hsl, hsl2rgb, luminance, gaussian, smootherstep, hash, noise2d
3. WHEN constants are needed THEN they SHALL include: PI, TAU, E
4. IF a shader needs a function not in the common library THEN the function SHALL be added to the common library, not duplicated

#### Correctness Properties

- **Invariant 1:** All common functions SHALL produce numerically correct results (verified against reference implementations)
- **Invariant 2:** The common library SHALL NOT exceed 200 lines of WGSL

---

### Requirement 7: Transition Shader Expansion

**User Story:** As a video editor, I want diverse transition effects between clips, so that I can create professional-looking videos without external tools.

#### Acceptance Criteria

1. WHEN a transition is applied THEN the system SHALL support at least 13 transition types: crossfade, slide, wipe, iris, clockWipe, glitch, dissolve, sparkles, lightLeak, pixelate, chromatic, radialBlur, flip
2. WHEN a dissolve transition is rendered THEN it SHALL use FBM noise with edge softness and edge glow
3. WHEN a glitch transition is rendered THEN it SHALL include block displacement, RGB split, and digital noise
4. WHEN a sparkles transition is rendered THEN it SHALL use two-layer sparkle field with ignite timing and drift
5. WHERE transition progress is 0.0 THEN the output SHALL be clip A; at 1.0 it SHALL be clip B

#### Correctness Properties

- **Invariant 1:** At progress=0.0, the output SHALL be pixel-identical to clip A
- **Invariant 2:** At progress=1.0, the output SHALL be pixel-identical to clip B
- **Invariant 3:** All transitions SHALL produce valid RGBA output for all progress values in [0, 1]

---

### Requirement 8: Inline Color Effects in Compositing

**User Story:** As a video editor adjusting brightness, contrast, and saturation, I want zero-cost adjustments, so that basic color tweaks don't require an extra render pass.

#### Acceptance Criteria

1. WHEN brightness, contrast, saturation, or invert are at default values THEN the system SHALL apply them at zero cost (no extra pass)
2. WHEN inline effects are enabled THEN they SHALL be applied in the layer shader before blending
3. WHERE inline effect parameters are passed THEN they SHALL be part of the layer uniform buffer
4. IF inline effects are combined with complex effects THEN inline effects SHALL be applied first, then complex effects

#### Correctness Properties

- **Invariant 1:** At default values, inline effects SHALL NOT change the output pixel values
- **Invariant 2:** Inline effects combined with complex effects SHALL produce the same result as applying them sequentially

---

### Requirement 9: Scopes Compute Shader Optimization

**User Story:** As a color grader, I want real-time video scopes, so that I can monitor color values without impacting preview performance.

#### Acceptance Criteria

1. WHEN a scope is rendered THEN it SHALL use a two-pass compute-then-render pattern
2. WHEN the compute pass runs THEN it SHALL accumulate pixel data into atomic storage buffers
3. WHEN the render pass runs THEN it SHALL visualize the accumulated data as a fullscreen triangle
4. WHERE the histogram scope computes THEN it SHALL produce 4 atomic buffers: R[256], G[256], B[256], Luma[256]
5. WHEN the waveform scope renders THEN it SHALL support parade mode (R|G|B side by side)
6. WHEN the vectorscope renders THEN it SHALL display graticule circles, skin tone line, and color targets

#### Correctness Properties

- **Invariant 1:** Scope compute buffers SHALL be cleared before each scope render
- **Invariant 2:** Scope output SHALL be deterministic for identical input frames

---

### Requirement 10: WebCodecs Export Pipeline

**User Story:** As a video editor exporting my project, I want high-quality exports with codec flexibility, so that my videos look professional and work on all platforms.

#### Acceptance Criteria

1. WHEN exporting THEN the system SHALL use WebCodecs VideoEncoder instead of MediaRecorder
2. WHEN encoding THEN the system SHALL support H.264 and VP9 codecs
3. WHEN a frame is captured THEN it SHALL be captured as VideoFrame from OffscreenCanvas (zero-copy)
4. WHEN encoding is pipelined THEN the system SHALL render frame N while encoding frame N-1
5. IF a single unmodified clip is exported THEN the system SHALL attempt packet remux (no re-encoding)
6. WHERE keyframes are needed THEN they SHALL be inserted at configurable intervals (default: every 2 seconds)

#### Correctness Properties

- **Invariant 1:** Exported video duration SHALL match timeline duration within ±1 frame
- **Invariant 2:** Exported video dimensions SHALL match the configured export resolution exactly
- **Invariant 3:** All frames SHALL be encoded in timeline order (no frame reordering)

---

### Requirement 11: Color Grading Pipeline

**User Story:** As a colorist, I want professional color grading tools, so that I can achieve cinematic looks without leaving the browser.

#### Acceptance Criteria

1. WHEN color grading is applied THEN it SHALL support: input CST, gamut conversion, tone mapping, CDL, color wheels, 3D LUT, HSL qualifier, power window, output CST
2. WHEN input color space is specified THEN it SHALL convert from: sRGB, Linear, ACES CG, ARRI LogC, S-Log2, S-Log3, CLog3, V-Log to linear
3. WHEN gamut conversion is applied THEN it SHALL support: Rec.709, S-Gamut, ARRI Wide Gamut, ACES AP1, DCI-P3, Rec.2020
4. WHEN tone mapping is applied THEN it SHALL use hyperbolic rolloff matching DaVinci Resolve's "Simple" method
5. WHERE CDL is applied THEN it SHALL use ASC-CDL formula: `output = (input * slope + offset) ^ power`
6. WHEN a 3D LUT is applied THEN it SHALL use trilinear sampling with half-texel offset

#### Correctness Properties

- **Invariant 1:** Identity color grading (all defaults) SHALL produce pixel-identical output
- **Invariant 2:** Color grading SHALL NOT produce out-of-range values (all outputs clamped to [0, 1])

---

### Requirement 12: 3D Transforms in Fragment Shader

**User Story:** As a motion graphics artist, I want 3D layer transforms, so that I can create perspective effects and 3D compositions.

#### Acceptance Criteria

1. WHEN a layer has 3D transforms THEN the system SHALL apply position (X, Y, Z), scale, rotation (X, Y, Z), and perspective in the fragment shader
2. WHEN perspective is applied THEN it SHALL use the formula: `projected = position / (1 + z / perspective_distance)`
3. WHERE 3D transforms are computed THEN they SHALL be per-pixel (not per-vertex) for accuracy
4. IF perspective distance is ≤ 0.001 THEN the system SHALL clip the pixel (behind camera)

#### Correctness Properties

- **Invariant 1:** With all 3D transforms at identity, the output SHALL match the 2D transform result
- **Invariant 2:** Perspective projection SHALL produce correct vanishing point behavior

---

### Requirement 13: SDF Shape Rendering

**User Story:** As a graphics designer, I want resolution-independent anti-aliased shapes, so that shapes look crisp at any zoom level or resolution.

#### Acceptance Criteria

1. WHEN a shape is rendered THEN it SHALL use signed distance fields in the fragment shader
2. WHERE shapes are supported THEN they SHALL include: rounded rectangle, ellipse, regular polygon, line (capsule), arrow, circle, square, diamond
3. WHEN anti-aliasing is applied THEN it SHALL use smoothstep with a configurable edge width
4. IF a shape has a stroke THEN it SHALL render the outline using the SDF gradient

#### Correctness Properties

- **Invariant 1:** SDF shapes SHALL be anti-aliased at all resolutions
- **Invariant 2:** Shape dimensions SHALL match the specified parameters within 1 pixel

---

### Requirement 14: Temporal Keyframe Caching

**User Story:** As an animator, I want smooth playback with many keyframes, so that I can preview animations without dropped frames.

#### Acceptance Criteria

1. WHEN keyframes are evaluated during sequential playback THEN the system SHALL use cached index for O(1) lookup
2. WHEN a seek occurs THEN the system SHALL fall back to binary search for the new keyframe segment
3. WHERE the cache stores THEN it SHALL map property name to last-used keyframe index
4. WHEN bezier easing is evaluated THEN it SHALL use Newton-Raphson iteration (8 iterations max, 1e-6 tolerance)

#### Correctness Properties

- **Invariant 1:** Cached evaluation SHALL produce identical results to non-cached evaluation
- **Invariant 2:** Binary search fallback SHALL always find the correct segment

---

### Requirement 15: Windowed Audio Decode-Ahead

**User Story:** As an editor working with long audio clips, I want low memory usage, so that I can edit hour-long projects without running out of RAM.

#### Acceptance Criteria

1. WHEN audio is decoded THEN the system SHALL use a windowed buffer with configurable max size
2. WHEN the buffer exceeds the size limit THEN the system SHALL evict segments furthest from the playhead
3. WHEN the playhead moves THEN the system SHALL decode ahead to fill the buffer
4. WHERE audio segments are stored THEN they SHALL support non-contiguous regions with merging

#### Correctness Properties

- **Invariant 1:** Total audio buffer memory SHALL NOT exceed the configured limit
- **Invariant 2:** Audio at the playhead position SHALL always be available (no silence gaps during playback)

---

### Requirement 16: WSOLA Time Stretcher

**User Story:** As a video editor changing clip speed, I want pitch-preserving speed changes, so that voices don't sound chipmunk-like when sped up.

#### Acceptance Criteria

1. WHEN audio is time-stretched THEN the system SHALL use WSOLA (Waveform Similarity Overlap-Add)
2. WHEN speed is changed THEN the pitch SHALL remain unchanged
3. WHERE cross-correlation is computed THEN it SHALL search over ±256 frames for best phase alignment
4. IF the speed is 1.0 THEN the output SHALL be identical to the input

#### Correctness Properties

- **Invariant 1:** At speed=1.0, output SHALL be pixel-identical to input (within floating-point tolerance)
- **Invariant 2:** Pitch (fundamental frequency) SHALL remain constant across speed changes

---

### Requirement 17: Mask in Layer-Local UV Space

**User Story:** As a video editor applying masks to transformed layers, I want masks to follow the layer's transforms, so that masking works correctly with rotation, scale, and position.

#### Acceptance Criteria

1. WHEN a mask is applied to a layer THEN the mask SHALL be evaluated in the layer's local UV space
2. WHEN the layer is rotated THEN the mask SHALL rotate with the layer
3. WHEN the layer is scaled THEN the mask SHALL scale with the layer
4. WHERE mask feathering is applied THEN it SHALL use JFA with configurable feather radius

#### Correctness Properties

- **Invariant 1:** Mask bounds SHALL transform identically to the layer bounds
- **Invariant 2:** Mask feathering SHALL produce smooth alpha transitions at the mask edge

---

### Requirement 18: Device Loss Auto-Recovery

**User Story:** As a video editor, I want the editor to recover from GPU driver updates, so that I don't lose my work when the GPU device is lost.

#### Acceptance Criteria

1. WHEN the GPU device is lost THEN the system SHALL attempt to reinitialize the device
2. WHEN recovery is attempted THEN it SHALL retry up to 3 times with 100ms delay between attempts
3. WHEN recovery succeeds THEN the system SHALL recreate all pipelines, textures, and bind groups
4. IF recovery fails after 3 attempts THEN the system SHALL notify the user and preserve the project state

#### Correctness Properties

- **Invariant 1:** Recovery attempts SHALL NOT exceed 3
- **Invariant 2:** Project state (layers, effects, timeline) SHALL be preserved across device loss and recovery

---

## Non-Functional Requirements

1. **Performance:** Compositing 10 layers at 1080p SHALL maintain ≥ 30fps on mid-range GPU
2. **Memory:** GPU memory usage SHALL NOT exceed 2GB for a typical 10-layer 1080p project
3. **Compatibility:** All features SHALL work on Chrome 113+ with WebGPU support
4. **Backward Compatibility:** Existing projects SHALL load without modification after the overhaul
5. **Build Size:** WASM binary size SHALL NOT increase by more than 30%
