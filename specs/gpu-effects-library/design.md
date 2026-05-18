# Design: GPU Effects Library

## Overview

Extend the existing Rust `EffectPipeline` and TypeScript `EffectsRegistry` with 10 new GPU effects. Each effect follows the established pattern: WGSL shader in `rust/crates/effects/src/shaders/` → register in `EffectPipeline::new()` → TypeScript definition in `apps/web-vite/src/effects/definitions/` → register in index. Multi-pass effects (glow) reuse the existing gaussian blur shader.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Effects System                            │
│                                                              │
│  TypeScript Side                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  EffectsRegistry                                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │   │
│  │  │ Blur     │ │ Color    │ │ Chromatic│ │ Glow   │  │   │
│  │  │ (exist)  │ │ Correct  │ │ Aberr    │ │        │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │   │
│  │  │ Vignette │ │ Sharpen  │ │ Pixelate │ │ Noise  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │   │
│  │  │ Sepia    │ │ Lens     │ │ Grayscale│             │   │
│  │  │ Grayscale│ │ Distort  │ │ Invert   │             │   │
│  │  └──────────┘ └──────────┘ └──────────┘             │   │
│  └────────────────────────┬─────────────────────────────┘   │
│                           │ EffectPass[] (serialized)        │
│                           ▼                                  │
│  WASM Bridge                                                   
│  ┌──────────────────────────────────────────────────────┐   │
│  │  applyEffectPasses(passes, inputTexture)              │   │
│  └────────────────────────┬─────────────────────────────┘   │
│                           │                                 │
│  Rust Side                         ▼                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  EffectPipeline                                       │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ HashMap<shader_id, RenderPipeline>              │  │   │
│  │  │  "gaussian-blur"  (existing)                    │  │   │
│  │  │  "color-correct"  (new)                         │  │   │
│  │  │  "chromatic-aberr" (new)                        │  │   │
│  │  │  "vignette"       (new)                         │  │   │
│  │  │  "sharpen"        (new)                         │  │   │
│  │  │  "sepia"          (new)                         │  │   │
│  │  │  "grayscale"      (new)                         │  │   │
│  │  │  "invert"         (new)                         │  │   │
│  │  │  "pixelate"       (new)                         │  │   │
│  │  │  "noise"          (new)                         │  │   │
│  │  │  "lens-distortion" (new)                        │  │   │
│  │  │  "glow-threshold"  (new)                        │  │   │
│  │  │  "glow-composite"  (new)                        │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Component 1: WGSL Shaders (Rust)
- **Responsibility:** GPU shader implementations for each effect
- **Location:** `rust/crates/effects/src/shaders/`
- **Interface:** Each shader reads input texture, writes output texture, accepts uniform buffer
- **Uniform buffer layout:** `resolution[2]`, `direction[2]`, `scalars[4]` (reused from existing blur)

### Component 2: EffectPipeline (Rust)
- **Responsibility:** Compile and cache WGSL shaders, execute render passes
- **Location:** `rust/crates/effects/src/pipeline.rs`
- **Interface:** `new()` registers all shaders, `apply_passes()` executes pass sequence
- **Dependencies:** gpu crate (context, fullscreen quad, blit pipeline)

### Component 3: Effect Definitions (TypeScript)
- **Responsibility:** Define effect metadata, parameters, and pass configurations
- **Location:** `apps/web-vite/src/effects/definitions/`
- **Interface:** `EffectDefinition { type, name, keywords, params[], renderer }`
- **Dependencies:** EffectsRegistry

### Component 4: Effect UI Panel (TypeScript)
- **Responsibility:** Display effect parameters as sliders/inputs, update in real-time
- **Location:** `apps/web-vite/src/effects/components/`
- **Dependencies:** Effect definitions, EditorCore

## Data Models

### Uniform Buffer (Rust)
```rust
// Shared uniform buffer layout for all effects
struct EffectUniforms {
    resolution: [f32; 2],  // canvas width, height
    direction: [f32; 2],   // pass direction (H/V) or zero
    scalars: [f32; 4],     // effect-specific parameters
}
```

### Effect Definition (TypeScript)
```typescript
interface EffectDefinition {
  type: string;           // unique identifier
  name: string;           // display name
  keywords: string[];     // search keywords
  params: EffectParam[];  // user-adjustable parameters
  renderer: {
    passes: EffectPass[];           // static passes
    buildPasses?: (params) => EffectPass[]; // dynamic passes
  };
}

interface EffectParam {
  name: string;
  label: string;
  type: "number" | "color" | "boolean";
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
}

interface EffectPass {
  shaderId: string;
  uniforms: Record<string, number>;
}
```

### Shader Parameter Mapping
| Effect | scalars[0] | scalars[1] | scalars[2] | scalars[3] |
|--------|-----------|-----------|-----------|-----------|
| color-correct | brightness | contrast | saturation | temperature |
| chromatic-aberr | intensity | angle | 0 | 0 |
| vignette | intensity | radius | softness | 0 |
| sharpen | intensity | 0 | 0 | 0 |
| sepia | intensity | 0 | 0 | 0 |
| grayscale | intensity | 0 | 0 | 0 |
| invert | intensity | 0 | 0 | 0 |
| pixelate | blockSize | 0 | 0 | 0 |
| noise | intensity | monochrome(0/1) | 0 | 0 |
| lens-distortion | distortion | zoom | 0 | 0 |
| glow-threshold | threshold | 0 | 0 | 0 |
| glow-composite | intensity | 0 | 0 | 0 |

## Data Flow

1. User adds effect to clip → TypeScript creates `EffectElement` with default params
2. Renderer builds `EffectPass[]` from effect definition + current params
3. Passes serialized and sent to WASM via `applyEffectPasses()`
4. Rust maps each pass's `shaderId` to precompiled pipeline
5. Each pass: create output texture → bind input + uniforms → dispatch → output becomes next input
6. Final output returned to TypeScript for display

## Key Algorithms

### Color Correction
```
per-pixel:
  rgb = input.rgb
  rgb = rgb * (1.0 + brightness)                    // brightness
  rgb = (rgb - 0.5) * (1.0 + contrast) + 0.5       // contrast
  luminance = dot(rgb, vec3(0.2126, 0.7152, 0.0722))
  rgb = mix(vec3(luminance), rgb, saturation)       // saturation
  // temperature/tint: shift red-blue and green-magenta
  rgb.r += temperature * 0.1
  rgb.b -= temperature * 0.1
  rgb.g += tint * 0.05
  output = clamp(rgb, 0.0, 1.0)
```

### Chromatic Aberration
```
per-pixel:
  center = resolution * 0.5
  dir = normalize(uv - center * 0.5)
  dist = length(uv - center * 0.5)
  offset = dir * dist * intensity * 0.01
  // rotate offset by angle
  output.r = textureSample(input, uv + offset)
  output.g = textureSample(input, uv)
  output.b = textureSample(input, uv - offset)
```

### Glow (3-pass)
```
Pass 1 (threshold): output = input > threshold ? input : 0
Pass 2 (blur): output = gaussian_blur(threshold_output)  // reuse existing
Pass 3 (composite): output = original + blur * intensity
```

## Error Handling

- Unknown shader ID → panic with descriptive message during pipeline initialization (fail fast)
- Invalid uniform values → clamp to valid range in shader (never crash)
- Texture dimension mismatch → return error, fall back to passthrough

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: Color Correction | color-correct.wgsl, scalars[0-3] mapping |
| Req 2: Chromatic Aberration | chromatic-aberr.wgsl, radial offset algorithm |
| Req 3: Vignette | vignette.wgsl, radial distance darkening |
| Req 4: Sharpen | sharpen.wgsl, unsharp mask separable kernel |
| Req 5: Basic Color Transforms | sepia.wgsl, grayscale.wgsl, invert.wgsl |
| Req 6: Pixelate | pixelate.wgsl, block grid sampling |
| Req 7: Noise | noise.wgsl, GPU PRNG |
| Req 8: Lens Distortion | lens-distortion.wgsl, radial distortion function |
| Req 9: Glow/Bloom | glow-threshold.wgsl + gaussian-blur (reuse) + glow-composite.wgsl |
| Req 10: Registry Integration | Existing EffectsRegistry + EffectPipeline pattern |

## Testing Strategy

- **Shader correctness:** Property-based — identity at zero intensity, output clamping, single-pass execution
- **Color accuracy:** Compare against reference implementations (CSS filters, FFmpeg) for color correction
- **Performance:** Each effect SHALL complete in <2ms at 1080p on mid-tier GPU
- **Multi-pass effects:** Glow output = threshold(blur(original)) composited correctly
- **Registry:** Every effect definition has unique type, every shader has unique ID
