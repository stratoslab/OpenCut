# Design: GPU Performance Overhaul

## Overview

This overhaul restructures OpenCut's Rust/WASM GPU compositor to match the architecture of leading browser-based video editors. The core changes are: (1) ping-pong compositing replacing per-layer texture allocation, (2) bind group caching to avoid per-frame GPU object creation, (3) texture pool compaction for bounded memory, (4) expanded effect/transition registries, (5) compute shader scopes, (6) WebCodecs export pipeline, and (7) professional color grading with 3D transforms.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WASM Entry Points                         │
│  initializeGpu()  uploadTexture()  renderFrame()  applyEffects() │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     GpuRuntime (thread-local)                    │
│  GpuContext │ EffectPipeline │ MaskFeatherPipeline               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      Compositor                                  │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ TextureStore│ │ TexturePool  │ │ EffectRegistry│              │
│  │ (by ID)     │ │ (ping/pong)  │ │ (by shader ID)│              │
│  └──────┬──────┘ └──────┬───────┘ └──────┬───────┘              │
│         │               │                │                       │
│  ┌──────▼───────────────▼────────────────▼───────┐              │
│  │              Render Pipelines                  │              │
│  │  Layer │ Blend │ Mask │ Effects │ Transitions  │              │
│  └───────────────────────────────────────────────┘              │
│                                                                 │
│  ┌───────────────────────────────────────────────┐              │
│  │              WGSL Shaders                      │              │
│  │  layer.wgsl │ blend.wgsl │ mask.wgsl │ common.wgsl│          │
│  │  effects/*.wgsl │ transitions/*.wgsl │ scopes/*.wgsl│        │
│  └───────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    WebGPU Device                                │
│  Adapter │ Queue │ Surface │ SwapChain                           │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Component 1: Ping-Pong Compositor

**Responsibility:** Composite N layers using exactly 2 alternating textures, eliminating per-layer texture allocation.

**Interface:**
- `render_frame_to_texture(frame: &FrameDescriptor) -> Result<wgpu::Texture>`
- `render_frame(frame: &FrameDescriptor, surface: &wgpu::Surface) -> Result<()>`

**Dependencies:** TexturePool (for ping/pong textures), EffectPipeline, MaskFeatherPipeline

**Design:**
```
struct PingPongCompositor {
    ping_texture: Option<wgpu::Texture>,
    pong_texture: Option<wgpu::Texture>,
    ping_view: Option<wgpu::TextureView>,
    pong_view: Option<wgpu::TextureView>,
    current_width: u32,
    current_height: u32,
    // Pipelines
    layer_pipeline: wgpu::RenderPipeline,
    blend_pipeline: wgpu::RenderPipeline,
    mask_pipeline: wgpu::RenderPipeline,
    // Bind group caches
    layer_bind_group_cache: HashMap<String, wgpu::BindGroup>,
    blend_bind_group_cache: HashMap<String, wgpu::BindGroup>,
}
```

**Algorithm:**
1. Ensure ping/pong textures exist at current resolution
2. Clear ping texture to transparent (first frame)
3. For each layer (bottom to top):
   a. Render layer source → read texture (using layer pipeline)
   b. Apply inline effects (brightness/contrast/saturation) in layer shader
   c. Apply per-layer effects (if any) using EffectPipeline
   d. Apply mask (if any) using MaskFeatherPipeline
   e. Blend read texture + accumulated → write texture (using blend pipeline)
   f. Swap read/write
4. Return accumulated texture

### Component 2: Bind Group Cache

**Responsibility:** Cache WebGPU bind groups to avoid per-frame recreation.

**Interface:**
- `get_or_create(key: &str, create_fn: impl FnOnce() -> wgpu::BindGroup) -> &wgpu::BindGroup`
- `invalidate(key: &str)`
- `clear()`

**Design:**
```
struct BindGroupCache {
    cache: HashMap<String, wgpu::BindGroup>,
    generation: u64,  // Incremented on resolution change
}
```

**Cache key format:** `"{layer_id}:{ping|pong}:{generation}"`

**Invalidation triggers:**
- Resolution change (clear all)
- Texture replacement for a layer (invalidate that layer's entries)
- Pipeline recreation (clear all)

### Component 3: Texture Pool with Compaction

**Responsibility:** Manage reusable GPU textures with bounded memory.

**Interface:**
- `acquire(context: &GpuContext, width: u32, height: u32, format: wgpu::TextureFormat) -> wgpu::Texture`
- `release(texture: &wgpu::Texture)`
- `recycle_frame()` — return all in-use textures to available pool
- `compact()` — destroy excess unused textures, keep max 2 per key
- `metrics() -> PoolMetrics`

**Design:**
```
struct TexturePool {
    available: HashMap<TextureKey, Vec<PoolEntry>>,
    in_use: Vec<(TextureKey, wgpu::Texture)>,
    metrics: PoolMetrics,
}

struct PoolEntry {
    texture: wgpu::Texture,
    in_use: bool,
}

struct TextureKey {
    width: u32,
    height: u32,
    format: wgpu::TextureFormat,
}

struct PoolMetrics {
    total_created: u64,
    total_acquires: u64,
    cache_hits: u64,
}
```

**Compaction algorithm:**
1. For each key in available pool:
   a. Keep at most 2 entries
   b. Destroy excess entries
2. Log metrics if enabled

### Component 4: GPU Backpressure

**Responsibility:** Limit concurrent GPU work to prevent memory pressure.

**Interface:**
- `begin_frame() -> bool` — returns false if GPU is busy
- `end_frame()` — decrement in-flight counter

**Design:**
```
struct GpuBackpressure {
    frames_in_flight: u32,
    max_frames_in_flight: u32,  // Default: 2
}
```

**Integration:** Called at the start of `render_frame()`. If `begin_frame()` returns false, skip rendering and return early.

### Component 5: Effect Registry

**Responsibility:** Register and manage effect definitions with automatic pipeline creation.

**Interface:**
- `register_effect(definition: EffectDefinition)`
- `get_effect(id: &str) -> Option<&EffectDefinition>`
- `get_effects_by_category(category: EffectCategory) -> Vec<&EffectDefinition>`
- `create_all_pipelines(context: &GpuContext) -> HashMap<String, wgpu::RenderPipeline>`

**Design:**
```
struct EffectDefinition {
    id: &'static str,
    name: &'static str,
    category: EffectCategory,
    shader_source: &'static str,
    entry_point: &'static str,
    uniform_size: usize,
    params: &'static [EffectParam],
    pack_uniforms: fn(&HashMap<String, UniformValue>, u32, u32) -> EffectUniformBuffer,
}

enum EffectCategory {
    Color, Blur, Distort, Stylize, Keying,
}

struct EffectParam {
    name: &'static str,
    label: &'static str,
    default: f32,
    min: f32,
    max: f32,
    step: f32,
    animatable: bool,
}
```

**Registration pattern:**
```rust
// In effects crate, each effect file defines a constant:
pub const GAUSSIAN_BLUR: EffectDefinition = EffectDefinition {
    id: "gaussian-blur",
    name: "Gaussian Blur",
    category: EffectCategory::Blur,
    shader_source: include_str!("shaders/gaussian_blur.wgsl"),
    // ...
};

// At init time:
register_effect(GAUSSIAN_BLUR);
```

### Component 6: Shared WGSL Library

**Responsibility:** Provide common WGSL functions for all shaders.

**Design:**
```rust
// In gpu crate:
pub const COMMON_WGSL: &str = include_str!("shaders/common.wgsl");

// When compiling any effect shader:
let full_source = format!("{}\n{}", COMMON_WGSL, effect.shader_source);
```

**Common functions:**
- `rgb2hsv`, `hsv2rgb`, `rgb2hsl`, `hsl2rgb`
- `luminance` (BT.709 weights: 0.2126, 0.7152, 0.0722)
- `gaussian(x, sigma)`
- `smootherstep(edge0, edge1, x)`
- `hash(p: vec2f)`, `noise2d(p: vec2f)`
- `fbm(p: vec2f, octaves: u32)` — fractal Brownian motion
- Constants: `PI`, `TAU`, `E`

### Component 7: Transition Pipeline

**Responsibility:** Render transitions between clips using GPU shaders.

**Interface:**
- `render_transition(transition_type: u32, progress: f32, direction: f32, intensity: f32, clip_a: &wgpu::Texture, clip_b: &wgpu::Texture, width: u32, height: u32) -> wgpu::Texture`

**Design:**
```
struct TransitionPipeline {
    pipeline: wgpu::RenderPipeline,
    uniform_bind_group_layout: wgpu::BindGroupLayout,
}

struct TransitionUniforms {
    transition_type: u32,
    progress: f32,
    direction: f32,
    intensity: f32,
}
```

**Transition shaders:** 13 transitions in a single WGSL file with switch dispatch. Each transition is a function `fn transition_name(a: vec4f, b: vec4f, uv: vec2f) -> vec4f`.

### Component 8: Inline Color Effects

**Responsibility:** Apply brightness, contrast, saturation, and invert in the layer shader at zero cost when defaults.

**Design:** Modify `layer.wgsl` to accept inline effect parameters in the uniform buffer:

```wgsl
struct LayerUniforms {
    resolution: vec2f,
    center: vec2f,
    size: vec2f,
    rotation_radians: f32,
    opacity: f32,
    flip_x: f32,
    flip_y: f32,
    // Inline effects (default: no-op)
    inline_brightness: f32,  // default: 0.0
    inline_contrast: f32,    // default: 1.0
    inline_saturation: f32,  // default: 1.0
    inline_invert: f32,      // default: 0.0
}
```

**In fragment shader, after sampling:**
```wgsl
var color = textureSampleLevel(source_texture, source_sampler, sample_uv, 0.0);
color.rgb = clamp((color.rgb + inline_brightness - 0.5) * inline_contrast + 0.5, vec3f(0.0), vec3f(1.0));
color.rgb = mix(vec3f(luminance(color.rgb)), color.rgb, inline_saturation);
color.rgb = select(color.rgb, 1.0 - color.rgb, inline_invert > 0.5);
```

### Component 9: Scopes Compute Pipeline

**Responsibility:** Render video scopes (histogram, waveform, vectorscope) using compute shaders.

**Design:**
```
struct ScopeRenderer {
    device: wgpu::Device,
    // Compute pipelines
    histogram_compute: wgpu::ComputePipeline,
    waveform_compute: wgpu::ComputePipeline,
    vectorscope_compute: wgpu::ComputePipeline,
    // Render pipelines
    histogram_render: wgpu::RenderPipeline,
    waveform_render: wgpu::RenderPipeline,
    vectorscope_render: wgpu::RenderPipeline,
    // Storage buffers
    hist_buffers: [wgpu::Buffer; 4],  // R, G, B, Luma
    waveform_buffers: [wgpu::Buffer; 4],
    vectorscope_buffer: wgpu::Buffer,
}
```

**Two-pass pattern:**
1. Compute pass: `dispatch_workgroups(width/16, height/16)` — accumulate into atomic buffers
2. Render pass: fullscreen triangle reads accumulated buffers and visualizes

### Component 10: WebCodecs Export Pipeline

**Responsibility:** Export video using WebCodecs VideoEncoder with pipelined encoding.

**Design:** This is primarily a JavaScript-side change. The WASM side provides:
- `render_frame_to_pixels(frame: &FrameDescriptor) -> Result<Vec<u8>>` — already exists
- New: `render_frame_to_canvas(frame: &FrameDescriptor, canvas: &OffscreenCanvas) -> Result<()>` — zero-copy path

**JS-side export orchestrator:**
```typescript
let pendingEncode: Promise<void> | null = null;
for (let frame = 0; frame < totalFrames; frame++) {
  await renderFrameToCanvas(frame);  // Render to OffscreenCanvas
  if (pendingEncode) await pendingEncode;  // Wait for previous encode
  const videoFrame = new VideoFrame(canvas, { timestamp, duration });
  pendingEncode = encoder.encode(videoFrame);  // Start encode (not awaited)
}
if (pendingEncode) await pendingEncode;  // Drain final encode
```

### Component 11: Color Grading Pipeline

**Responsibility:** Professional color grading in a single fragment shader pass.

**Design:** New WGSL shader `color_grade.wgsl` with unified uniform buffer (512 bytes):

```wgsl
struct ColorGradingUniforms {
    // Input CST
    input_cst: u32,  // sRGB, LogC, S-Log2, S-Log3, CLog3, V-Log
    // Gamut
    input_gamut: u32, output_gamut: u32,
    // CDL
    slope: vec4f, offset: vec4f, power: vec4f,
    // Color wheels
    lift: vec4f, gamma: vec4f, gain: vec4f,
    // Qualifier
    qualifier_center: vec4f, qualifier_width: vec4f, qualifier_softness: vec4f,
    // Flags
    flags: u32, primary_mix: f32, wheels_mix: f32, lut_mix: f32,
    // ... more fields to fill 512 bytes
}
```

**Processing order in fragment shader:**
1. Input CST → linear
2. Input gamut → Rec.709
3. Tone mapping (hyperbolic rolloff)
4. Primary correction (ASC-CDL)
5. Color wheels (lift/gamma/gain)
6. 3D LUT (trilinear sampling)
7. HSL qualifier (secondary correction)
8. Power window (regional correction)
9. Output gamut
10. Output CST

### Component 12: 3D Transforms

**Responsibility:** Apply 3D transforms (position, scale, rotation X/Y/Z, perspective) in fragment shader.

**Design:** Extend `LayerUniforms` with 3D transform fields:

```wgsl
struct LayerUniforms {
    // ... existing fields ...
    pos_z: f32,
    scale_z: f32,
    rotation_x: f32,
    rotation_y: f32,
    perspective: f32,
}
```

**In fragment shader, after computing local UV:**
```wgsl
var p = vec3f(local.x, local.y / output_aspect, pos_z);

// X rotation
let cosX = cos(-rotation_x); let sinX = sin(-rotation_x);
p = vec3f(p.x, p.y * cosX - p.z * sinX, p.y * sinX + p.z * cosX);

// Y rotation
let cosY = cos(-rotation_y); let sinY = sin(-rotation_y);
p = vec3f(p.x * cosY + p.z * sinY, p.y, -p.x * sinY + p.z * cosY);

// Perspective projection
let w = 1.0 - p.z / max(perspective, 0.5);
let projected = vec2f(p.x / w, p.y / w);
```

### Component 13: SDF Shape Rendering

**Responsibility:** Render anti-aliased shapes using signed distance fields.

**Design:** New pipeline `ShapePipeline` with SDF shader:

```wgsl
fn sdf_rounded_rect(p: vec2f, half_size: vec2f, radius: f32) -> f32 { ... }
fn sdf_ellipse(p: vec2f, ab: vec2f) -> f32 { ... }
fn sdf_line_segment(p: vec2f, a: vec2f, b: vec2f, thickness: f32) -> f32 { ... }

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let dist = compute_sdf(input.uv, shape_type, shape_params);
    let alpha = 1.0 - smoothstep(-edge_width, edge_width, dist);
    return vec4f(fill_color.rgb, alpha * opacity);
}
```

### Component 14: Temporal Keyframe Caching

**Responsibility:** O(1) keyframe evaluation during sequential playback.

**Design:**
```rust
struct KeyframeEvaluator {
    tracks: HashMap<String, Vec<Keyframe>>,
    cache: HashMap<String, usize>,  // property -> last keyframe index
}

impl KeyframeEvaluator {
    fn evaluate(&mut self, property: &str, time: f64) -> f32 {
        let keyframes = self.tracks.get(property).unwrap();
        let idx = self.find_index_from_cache(keyframes, time);
        self.cache.insert(property.to_string(), idx);
        interpolate(keyframes[idx], keyframes[idx + 1], time)
    }

    fn find_index_from_cache(&self, keyframes: &[Keyframe], time: f64, cached_idx: usize) -> usize {
        // Check cached segment
        if cached_idx < keyframes.len() - 1
            && keyframes[cached_idx].time <= time
            && time < keyframes[cached_idx + 1].time
        {
            return cached_idx;
        }
        // Forward linear search (common case during playback)
        for i in 0..4 {
            let check = cached_idx + i + 1;
            if check < keyframes.len() - 1
                && keyframes[check].time <= time
                && time < keyframes[check + 1].time
            {
                return check;
            }
        }
        // Binary search fallback (seeks)
        self.binary_search(keyframes, time)
    }
}
```

### Component 15: Windowed Audio Decode-Ahead

**Responsibility:** Low-memory audio buffering with decode-ahead.

**Design:**
```rust
struct AudioClipSource {
    segments: Vec<PcmSegment>,
    max_samples: usize,
    last_requested_time: f64,
}

struct PcmSegment {
    start_time: f64,
    data: Vec<f32>,
}

impl AudioClipSource {
    fn update_buffer(&mut self, start_time: f64, pcm_data: Vec<f32>) {
        // Extend last segment if contiguous, or insert new segment
        // Evict segments furthest from last_requested_time if over budget
    }

    fn get_sample(&self, time: f64) -> (f32, f32) {
        // Binary search for segment, linear interpolation
    }
}
```

### Component 16: WSOLA Time Stretcher

**Responsibility:** Pitch-preserving speed changes.

**Design:**
```rust
struct TimeStretcher {
    analysis_buffer: Vec<f32>,
    synthesis_buffer: CircularBuffer,
    analysis_hop: usize,  // 1024
    synthesis_hop: usize, // analysis_hop / speed
    window: Vec<f32>,     // Hann window, 2048 samples
}

impl TimeStretcher {
    fn process(&mut self, input: &[f32], speed: f32) -> Vec<f32> {
        // 1. Extract analysis frame with Hann window
        // 2. Cross-correlation search over ±256 frames for best alignment
        // 3. Overlap-add into synthesis buffer
        // 4. Extract synthesis frame at synthesis_hop
    }
}
```

### Component 17: Mask in Layer-Local UV Space

**Responsibility:** Apply masks in the layer's local coordinate system.

**Design:** Modify `mask.wgsl` to transform mask UVs into layer-local space:

```wgsl
// In mask fragment shader:
let layer_uv = transform_to_layer_uv(input.tex_coord, layer_transform);
let mask_value = textureSample(mask_texture, mask_sampler, layer_uv).r;
```

### Component 18: Device Loss Auto-Recovery

**Responsibility:** Recover from GPU device loss.

**Design:**
```rust
impl GpuContext {
    pub async fn new() -> Result<Self> {
        // ... existing init ...
        device.on_uncaptured_error(Box::new(|error| {
            // Log error
        }));
        // Store device lost callback
        Self { device_lost: Arc::new(Mutex::new(None)), ... }
    }

    pub fn set_device_lost_callback(&mut self, callback: Box<dyn Fn()>) {
        *self.device_lost.lock().unwrap() = Some(callback);
    }
}
```

**JS-side recovery:**
```typescript
async function handleDeviceLost() {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await initializeGpu();
            // Recreate all pipelines, textures, bind groups
            return;
        } catch (e) {
            await new Promise(r => setTimeout(r, 100));
        }
    }
    // Notify user, preserve project state
}
```

## Data Models

### FrameDescriptor (extended)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameDescriptor {
    pub width: u32,
    pub height: u32,
    pub clear: CanvasClearDescriptor,
    pub items: Vec<FrameItemDescriptor>,
    // NEW: inline color effects (applied in layer shader)
    #[serde(default)]
    pub inline_effects: InlineEffectsDescriptor,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InlineEffectsDescriptor {
    pub brightness: f32,    // default: 0.0
    pub contrast: f32,      // default: 1.0
    pub saturation: f32,    // default: 1.0
    pub invert: bool,       // default: false
}
```

### LayerDescriptor (extended)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerDescriptor {
    pub texture_id: String,
    pub transform: QuadTransformDescriptor,
    pub opacity: f32,
    pub blend_mode: BlendMode,
    #[serde(default)]
    pub effect_pass_groups: Vec<Vec<EffectPassDescriptor>>,
    pub mask: Option<LayerMaskDescriptor>,
    // NEW: 3D transforms
    #[serde(default)]
    pub transform_3d: Transform3DDescriptor,
    // NEW: color grading
    #[serde(default)]
    pub color_grading: Option<ColorGradingDescriptor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Transform3DDescriptor {
    pub pos_z: f32,
    pub scale_z: f32,
    pub rotation_x_degrees: f32,
    pub rotation_y_degrees: f32,
    pub perspective: f32,
}
```

### EffectDefinition (new)

```rust
pub struct EffectDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub category: EffectCategory,
    pub shader_source: &'static str,
    pub entry_point: &'static str,
    pub uniform_size: usize,
    pub params: &'static [EffectParam],
    pub pack_uniforms: fn(&HashMap<String, UniformValue>, u32, u32) -> EffectUniformBuffer,
}
```

## Data Flow

### Render Frame Flow (New)

```
JS: renderFrame(frameDescriptor)
    │
    ▼
WASM: render_frame()
    │
    ├── gpu_backpressure.begin_frame()?  (skip if GPU busy)
    │
    ├── ensure_ping_pong_textures(width, height)
    │
    ├── clear ping texture to transparent
    │
    ├── for each layer:
    │   ├── render_layer() → layer_texture
    │   │   ├── apply inline effects (in layer shader)
    │   │   ├── apply per-layer effects (EffectPipeline)
    │   │   └── apply mask (MaskFeatherPipeline)
    │   │
    │   └── blend_texture(accumulated, layer_texture) → new_accumulated
    │       └── swap ping/pong
    │
    ├── blit accumulated → surface view
    │
    ├── queue.submit()
    │
    ├── gpu_backpressure.end_frame()
    │
    └── surface.present()
```

### Export Flow (New)

```
JS: exportProject(project, settings)
    │
    ├── Check fast path: single clip, no modifications → packet remux
    │
    ├── For each frame:
    │   ├── renderFrameToCanvas(frame)  → OffscreenCanvas
    │   ├── if pendingEncode: await pendingEncode
    │   ├── videoFrame = new VideoFrame(canvas)
    │   ├── pendingEncode = encoder.encode(videoFrame)
    │   └── videoFrame.close()
    │
    └── await pendingEncode  (drain)
```

## Key Algorithms

### Ping-Pong Compositing

```
read = ping, write = pong
clear(read) to transparent

for layer in layers:
    render layer source → read
    apply effects to read (if any)
    apply mask to read (if any)
    blend(read, write)  // write = blend(read, accumulated)
    swap(read, write)

return read  // final composite
```

### Texture Pool Compaction

```
for each key in available:
    entries = available[key]
    unused = entries.filter(!in_use)
    if unused.len() > 2:
        for entry in unused[2..]:
            entry.texture.destroy()
        available[key] = unused[..2]
```

### WSOLA Time Stretching

```
analysis_hop = 1024
synthesis_hop = analysis_hop / speed

for each analysis frame:
    extract frame with Hann window
    cross_correlate with previous synthesis frame (±256 samples)
    find best alignment offset
    overlap-add into synthesis buffer at best alignment
    extract synthesis frame at synthesis_hop position
    normalize by overlap weights
```

## Error Handling

### GPU Device Loss

1. `device.lost` callback fires
2. JS-side `handleDeviceLost()` attempts recovery (3 retries, 100ms delay)
3. On success: recreate all pipelines, textures, bind groups
4. On failure: notify user, preserve project state in IndexedDB

### Shader Compilation Failure

1. `shader_module.get_compilation_info()` returns errors
2. Log error with line number and message
3. Fall back to no-op effect (pass-through)
4. Continue rendering (don't crash)

### Export Failure

1. If `VideoEncoder` fails: fall back to MediaRecorder
2. If frame capture fails: retry with `copyExternalImageToTexture`
3. If muxer fails: report error, preserve partial output

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: Ping-Pong Compositing | Component 1: PingPongCompositor |
| Req 2: Bind Group Caching | Component 2: BindGroupCache |
| Req 3: Texture Pool Compaction | Component 3: TexturePool with compaction |
| Req 4: GPU Backpressure | Component 4: GpuBackpressure |
| Req 5: Effect Registry | Component 5: EffectRegistry |
| Req 6: Shared WGSL Library | Component 6: COMMON_WGSL |
| Req 7: Transition Expansion | Component 7: TransitionPipeline (13 shaders) |
| Req 8: Inline Color Effects | Component 8: layer.wgsl extensions |
| Req 9: Scopes Compute | Component 9: ScopeRenderer |
| Req 10: WebCodecs Export | Component 10: JS export orchestrator |
| Req 11: Color Grading | Component 11: color_grade.wgsl |
| Req 12: 3D Transforms | Component 12: layer.wgsl 3D extensions |
| Req 13: SDF Shapes | Component 13: ShapePipeline |
| Req 14: Keyframe Caching | Component 14: KeyframeEvaluator |
| Req 15: Audio Decode-Ahead | Component 15: AudioClipSource |
| Req 16: WSOLA | Component 16: TimeStretcher |
| Req 17: Mask Local UV | Component 17: mask.wgsl transform |
| Req 18: Device Recovery | Component 18: GpuContext recovery |

## Testing Strategy

### Property-Based Tests

1. **Ping-pong compositing:** Generate random layer configurations (1-20 layers), verify output matches sequential blend reference
2. **Bind group caching:** Generate random texture change patterns, verify bind group creation count ≤ changed layers
3. **Texture pool:** Generate random acquire/release patterns, verify pool size ≤ 2 per key after compaction
4. **GPU backpressure:** Generate random frame submission patterns, verify in-flight counter never exceeds 2
5. **Effect registry:** Generate random effect parameter combinations, verify no shader compilation errors
6. **Transitions:** For each transition, verify output at progress=0.0 matches clip A, at progress=1.0 matches clip B
7. **Color grading:** Verify identity grading produces pixel-identical output
8. **3D transforms:** Verify identity 3D transform matches 2D transform result
9. **WSOLA:** Verify speed=1.0 produces identical output
10. **Keyframe caching:** Generate random keyframe sequences, verify cached evaluation matches non-cached

### Integration Tests

1. Render a 10-layer 1080p timeline, verify ≥ 30fps
2. Export a 30-second timeline, verify duration matches within ±1 frame
3. Apply all 13 transitions, verify no shader errors
4. Simulate device loss, verify recovery succeeds
5. Apply all 15 effects in sequence, verify output is valid RGBA

### Benchmark Tests

1. Compositing 1, 5, 10, 20 layers at 1080p — measure fps
2. Applying 1, 5, 10 effects in sequence — measure fps
3. Export 30-second timeline — measure total time
4. Texture pool with 1000 acquire/release cycles — measure memory
