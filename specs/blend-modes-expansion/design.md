# Design: Blend Modes Expansion

## Overview

Extend the existing `blend.wgsl` shader from 16 to 37 blend modes by adding 21 new cases to the switch statement. The architecture follows MasterSelects' proven approach: a single composite shader with all blend modes as switch cases, zero runtime abstraction layers between timeline and GPU.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    blend.wgsl                            │
│                                                          │
│  @fragment fn fs_main(input: VertexOutput) -> @location │
│  (0) vec4<f32> {                                         │
│    let src = textureSample(upper, sampler, input.uv);   │
│    let dst = textureSample(lower, sampler, input.uv);   │
│                                                          │
│    var result: vec4<f32>;                               │
│    switch blend_mode {                                   │
│      case 0: { /* Normal */ }                            │
│      case 1: { /* Darken */ }                            │
│      ...                                                 │
│      case 16: { /* Darker Color */ }                     │
│      case 17: { /* Lighter Color */ }                    │
│      case 18: { /* Subtract */ }                         │
│      ...                                                 │
│      case 36: { /* Silhouette Luma */ }                  │
│    }                                                     │
│    return result;                                        │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
```

## Components

### Component 1: blend.wgsl (Extended)
- **Responsibility:** All 37 blend mode implementations in a single shader
- **Location:** `rust/crates/compositor/src/shaders/blend.wgsl`
- **Interface:** Fragment shader reading upper/lower textures, outputting blended result
- **Dependencies:** gpu crate (texture sampling utilities)

### Component 2: Blend Mode Enum (Rust)
- **Responsibility:** Define all 37 blend mode variants
- **Location:** `rust/crates/compositor/src/blend_mode.rs`
- **Interface:** `enum BlendMode { Normal, Darken, ..., SilhouetteLuma }`
- **Dependencies:** None

### Component 3: Blend Mode Mapping (TypeScript)
- **Responsibility:** Map TypeScript blend mode names to Rust enum values
- **Location:** `apps/web-vite/src/compositor/blend-modes.ts`
- **Interface:** `const BLEND_MODES: Record<string, number>`
- **Dependencies:** None

## Data Models

### Blend Mode Enum (Rust)
```rust
#[repr(u32)]
pub enum BlendMode {
    Normal = 0,
    Darken = 1,
    Multiply = 2,
    ColorBurn = 3,
    LinearBurn = 4,        // NEW
    DarkerColor = 5,       // NEW
    Lighten = 6,
    Screen = 7,
    ColorDodge = 8,
    LinearDodge = 9,       // NEW (aka PlusLighter)
    LighterColor = 10,     // NEW
    Overlay = 11,
    SoftLight = 12,
    HardLight = 13,
    VividLight = 14,       // NEW
    LinearLight = 15,      // NEW
    PinLight = 16,         // NEW
    HardMix = 17,          // NEW
    Difference = 18,
    Exclusion = 19,
    Subtract = 20,         // NEW
    Divide = 21,           // NEW
    Reflect = 22,          // NEW
    Glow = 23,             // NEW
    Phoenix = 24,          // NEW
    Hue = 25,
    Saturation = 26,
    Color = 27,
    Luminosity = 28,
    StencilAlpha = 29,     // NEW
    SilhouetteAlpha = 30,  // NEW
    StencilLuma = 31,      // NEW
    SilhouetteLuma = 32,   // NEW
    // Component variants
    RedDarken = 33,        // NEW
    GreenDarken = 34,      // NEW
    BlueDarken = 35,       // NEW
    RedLighten = 36,       // NEW
}
```

### Blend Mode Implementations
| Mode | Formula | Notes |
|------|---------|-------|
| Linear Burn | `dst + src - 1` | Clamp to 0 |
| Darker Color | `luminance(src) < luminance(dst) ? src : dst` | BT.709 luminance |
| Linear Dodge | `dst + src` | Clamp to 1 (aka PlusLighter) |
| Lighter Color | `luminance(src) > luminance(dst) ? src : dst` | BT.709 luminance |
| Vivid Light | `src > 0.5 ? color_dodge : color_burn` | Contrast-based |
| Linear Light | `src > 0.5 ? linear_dodge : linear_burn` | Contrast-based |
| Pin Light | `src > 0.5 ? max(dst, 2*(src-0.5)) : min(dst, 2*src)` | Replace-based |
| Hard Mix | `floor((dst + src) * 0.5 + 0.5)` | Only 0 or 1 |
| Subtract | `max(dst - src, 0)` | Arithmetic |
| Divide | `src > 0 ? dst / src : dst` | Arithmetic, div-by-zero protection |
| Reflect | `src * src / (1 - dst)` | Artistic, div-by-zero protection |
| Glow | `dst * dst / (1 - src)` | Artistic, inverse of Reflect |
| Phoenix | `min(src, dst) - max(src, dst) + 1` | Artistic |
| Stencil Alpha | `src.a > 0.5 ? dst : vec4(0)` | Mask-based |
| Silhouette Alpha | `src.a <= 0.5 ? dst : vec4(0)` | Inverse mask |
| Stencil Luma | `luminance(src) > 0.5 ? dst : vec4(0)` | Luma mask |
| Silhouette Luma | `luminance(src) <= 0.5 ? dst : vec4(0)` | Inverse luma mask |

## Data Flow

1. TypeScript sets blend mode on layer → maps to enum value
2. Enum value passed to compositor as uniform
3. `blend.wgsl` fragment shader reads both textures, switches on blend mode
4. Single pass computes blended result
5. Output written to frame buffer

## Key Algorithms

### Luminance Calculation (BT.709)
```wgsl
fn luminance(color: vec3<f32>) -> f32 {
    return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}
```

### Division by Zero Protection
```wgsl
fn safe_divide(numerator: f32, denominator: f32) -> f32 {
    return select(numerator / max(denominator, 0.001), numerator, denominator < 0.001);
}
```

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: Component Blend Modes | Darker Color, Lighter Color implementations |
| Req 2: Contrast Blend Modes | Linear Light, Vivid Light, Pin Light, Hard Mix |
| Req 3: Arithmetic Blend Modes | Subtract, Divide, Linear Dodge, Linear Burn |
| Req 4: Artistic Blend Modes | Reflect, Glow, Phoenix |
| Req 5: Stencil/Silhouette | Stencil Alpha, Silhouette Alpha, Stencil Luma, Silhouette Luma |
| Req 6: Single Shader | All 37 modes in single blend.wgsl with switch statement |

## Testing Strategy

- **Correctness:** Compare each blend mode against reference (Photoshop/After Effects) with test images
- **Identity modes:** Normal mode with src.a=0 SHALL return destination unchanged
- **Commutativity:** Test modes that should be commutative (e.g., Multiply)
- **Edge cases:** src=0, src=1, dst=0, dst=1 for all modes
- **Alpha handling:** Verify premultiplied alpha correctness for all modes
- **Performance:** Single pass for all modes, no branching per-pixel beyond switch
