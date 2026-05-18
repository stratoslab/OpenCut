# Design: GPU Transitions

## Overview

Create a single `transition.wgsl` shader in the Rust compositor that handles all 6 transition types via a switch statement. The shader receives two input textures (clip A, clip B) and a `progress` uniform (0→1). TypeScript side detects transition regions on the timeline, builds transition passes, and sends them to the compositor. Existing canvas-based transitions are replaced.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Transition Pipeline                        │
│                                                               │
│  Timeline                                                     │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐                    │
│  │ Clip A   │ │ Transition │ │ Clip B   │                    │
│  │          │ │ (duration) │ │          │                    │
│  └──────────┘ └─────┬──────┘ └──────────┘                    │
│                     │                                         │
│  TypeScript                                                 │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Detect transition region → build TransitionPass      │    │
│  │  { shaderId: "transition", uniforms: {                │    │
│  │    type: 0,  // crossfade                             │    │
│  │    progress: 0.5,                                     │    │
│  │    direction: 0,                                      │    │
│  │    intensity: 1.0                                     │    │
│  │  }}                                                   │    │
│  └────────────────────────┬─────────────────────────────┘    │
│                           │                                   │
│  Rust Compositor                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  transition.wgsl                                      │    │
│  │  @fragment fn fs_main(...) -> vec4<f32> {            │    │
│  │    let a = textureSample(clipA, ...);                 │    │
│  │    let b = textureSample(clipB, ...);                 │    │
│  │    switch transition_type {                           │    │
│  │      case 0: return mix(a, b, progress);              │    │
│  │      case 1: return slide(a, b, progress, dir);       │    │
│  │      case 2: return wipe(a, b, progress, dir);        │    │
│  │      case 3: return iris(a, b, progress);             │    │
│  │      case 4: return clockWipe(a, b, progress);        │    │
│  │      case 5: return glitch(a, b, progress, intensity);│    │
│  │    }                                                  │    │
│  │  }                                                    │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Components

### Component 1: transition.wgsl
- **Responsibility:** All 6 transition implementations in a single shader
- **Location:** `rust/crates/compositor/src/shaders/transition.wgsl`
- **Interface:** Fragment shader reading clipA/clipB textures, outputting blended result
- **Uniforms:** `transition_type: u32`, `progress: f32`, `direction: f32`, `intensity: f32`

### Component 2: Transition Enum (Rust)
- **Responsibility:** Define all 6 transition variants
- **Location:** `rust/crates/compositor/src/transition_type.rs`
- **Interface:** `enum TransitionType { Crossfade, Slide, Wipe, Iris, ClockWipe, Glitch }`

### Component 3: Transition Pass Builder (TypeScript)
- **Responsibility:** Detect transition regions on timeline, build transition passes for compositor
- **Location:** `apps/web-vite/src/services/renderer/transition-builder.ts`
- **Interface:** `buildTransitionPass(transition: TransitionElement, time: MediaTime) → EffectPass`
- **Dependencies:** Timeline state, compositor

### Component 4: Transition Registry (TypeScript)
- **Responsibility:** Define transition metadata (name, icon, default duration)
- **Location:** `apps/web-vite/src/transitions/definitions.ts`
- **Interface:** `TransitionDefinition { type, name, icon, defaultDuration }`

## Data Models

### Transition Uniform Buffer
```rust
struct TransitionUniforms {
    transition_type: u32,  // 0-5
    progress: f32,         // 0.0 - 1.0
    direction: f32,        // 0=left, 1=right, 2=up, 3=down
    intensity: f32,        // 0.0 - 1.0 (for glitch)
}
```

### Transition Definition (TypeScript)
```typescript
interface TransitionDefinition {
  type: string;
  name: string;
  icon: string;
  defaultDuration: number;  // seconds
}

const TRANSITIONS: TransitionDefinition[] = [
  { type: 'crossfade', name: 'Crossfade', icon: 'crossfade', defaultDuration: 1.0 },
  { type: 'slide-left', name: 'Slide Left', icon: 'arrow-left', defaultDuration: 0.8 },
  { type: 'slide-right', name: 'Slide Right', icon: 'arrow-right', defaultDuration: 0.8 },
  { type: 'wipe-left', name: 'Wipe Left', icon: 'wipe-left', defaultDuration: 0.6 },
  { type: 'wipe-right', name: 'Wipe Right', icon: 'wipe-right', defaultDuration: 0.6 },
  { type: 'iris', name: 'Iris', icon: 'circle', defaultDuration: 1.0 },
  { type: 'clock-wipe', name: 'Clock Wipe', icon: 'clock', defaultDuration: 1.0 },
  { type: 'glitch', name: 'Glitch', icon: 'zap', defaultDuration: 0.5 },
];
```

## Data Flow

1. User drags transition between two clips on timeline → creates `TransitionElement`
2. During playback/scrub, `TransitionPassBuilder` detects if current time is within transition region
3. If in transition: calculate `progress = (currentTime - transitionStart) / duration`
4. Build `EffectPass` with transition shader ID + uniforms (type, progress, direction, intensity)
5. Compositor receives pass → `transition.wgsl` reads both clip textures → outputs blended result
6. If not in transition: pass through clip normally

## Key Algorithms

### Crossfade
```wgsl
fn crossfade(a: vec4<f32>, b: vec4<f32>, progress: f32) -> vec4<f32> {
    return mix(a, b, progress);
}
```

### Slide
```wgsl
fn slide(a: vec4<f32>, b: vec4<f32>, progress: f32, direction: f32, uv: vec2<f32>) -> vec4<f32> {
    let offset = progress;
    let a_uv = uv + vec2<f32>(offset, 0.0);
    let b_uv = uv - vec2<f32>(1.0 - offset, 0.0);
    let a_sample = textureSample(clipA, sampler, a_uv);
    let b_sample = textureSample(clipB, sampler, b_uv);
    if (a_uv.x > 1.0) { return b_sample; }
    if (b_uv.x < 0.0) { return a_sample; }
    return select(a_sample, b_sample, a_uv.x > 1.0 - offset);
}
```

### Wipe
```wgsl
fn wipe(a: vec4<f32>, b: vec4<f32>, progress: f32, direction: f32, uv: vec2<f32>) -> vec4<f32> {
    let threshold = progress;
    return select(a, b, uv.x < threshold);
}
```

### Iris
```wgsl
fn iris(a: vec4<f32>, b: vec4<f32>, progress: f32, uv: vec2<f32>) -> vec4<f32> {
    let center = vec2<f32>(0.5, 0.5);
    let dist = length(uv - center);
    let radius = progress * 0.75;
    return select(a, b, dist < radius);
}
```

### Clock Wipe
```wgsl
fn clockWipe(a: vec4<f32>, b: vec4<f32>, progress: f32, uv: vec2<f32>) -> vec4<f32> {
    let center = vec2<f32>(0.5, 0.5);
    let angle = atan2(uv.y - center.y, uv.x - center.x);
    let normalized = (angle + 3.14159265) / 6.28318530;
    return select(a, b, normalized < progress);
}
```

### Glitch
```wgsl
fn glitch(a: vec4<f32>, b: vec4<f32>, progress: f32, intensity: f32, uv: vec2<f32>) -> vec4<f32> {
    let glitchAmount = sin(progress * 3.14159265) * intensity;
    let slice = floor(uv.y * 20.0) / 20.0;
    let offset = sin(slice * 10.0 + progress * 20.0) * glitchAmount * 0.05;
    let a_uv = uv + vec2<f32>(offset, 0.0);
    let b_uv = uv - vec2<f32>(offset, 0.0);
    let r = textureSample(clipB, sampler, b_uv).r;
    let g = mix(textureSample(clipA, sampler, a_uv).g, textureSample(clipB, sampler, b_uv).g, progress);
    let b_ch = textureSample(clipA, sampler, a_uv).b;
    return vec4<f32>(r, g, b_ch, 1.0);
}
```

## Error Handling

- Transition type unknown → fall back to crossfade (safe default)
- Progress outside [0, 1] → clamp to range
- One clip texture unavailable → show the available clip

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: Crossfade | mix(a, b, progress) in transition.wgsl |
| Req 2: Slide | slide() function with direction-based offset |
| Req 3: Wipe | wipe() function with threshold comparison |
| Req 4: Iris | iris() function with radial distance check |
| Req 5: Clock Wipe | clockWipe() function with angle comparison |
| Req 6: Glitch | glitch() function with slice displacement + RGB separation |
| Req 7: GPU Architecture | Single transition.wgsl with switch statement, two input textures |

## Testing Strategy

- **Boundary correctness:** Each transition SHALL produce bit-identical output to clip A at progress=0 and clip B at progress=1
- **Progress linearity:** At progress=0.5, transitions SHALL show equal contribution from both clips (where applicable)
- **No artifacts:** No visible seams, gaps, or distortion at transition boundaries
- **Performance:** Each transition SHALL complete in single GPU pass, <2ms at 1080p
