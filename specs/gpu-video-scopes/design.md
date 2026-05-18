# Design: GPU Video Scopes

## Overview

Three WebGPU compute shaders read the composited frame texture and output analysis data (histogram bins, vectorscope pixels, waveform columns). A post-render pass dispatches these compute shaders after the main frame is composited. Results are read back to CPU and rendered as 2D charts in dockable React panels.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Scope Pipeline                          │
│                                                               │
│  Main Render Pass                                             │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Compositor → Frame Texture (GPU)                     │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │ (shared input)                     │
│                         ▼                                    │
│  Compute Pass (post-render)                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ Histogram  │ │ Vectorscope│ │ Waveform   │               │
│  │ Compute    │ │ Compute    │ │ Compute    │               │
│  │ 256 bins   │ │ 256x256 px │ │ W columns  │               │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘               │
│        │              │              │                       │
│        ▼              ▼              ▼                       │
│  Readback to CPU (async, non-blocking)                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ Float32    │ │ Uint8      │ │ Float32    │               │
│  │ [256*4]    │ │ [256*256*4]│ │ [W*H]      │               │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘               │
│        │              │              │                       │
│        ▼              ▼              ▼                       │
│  React Panels (Canvas 2D rendering)                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ Histogram  │ │ Vectorscope│ │ Waveform   │               │
│  │ Panel      │ │ Panel      │ │ Panel      │               │
│  └────────────┘ └────────────┘ └────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

## Components

### Component 1: Histogram Compute Shader
- **Responsibility:** Count pixels per brightness level (256 bins × 4 channels: R, G, B, Luma)
- **Location:** `rust/crates/compositor/src/shaders/scopes/histogram.wgsl`
- **Interface:** Reads frame texture, outputs to storage buffer `f32[1024]` (256 × 4)
- **Key design:** Atomic adds per bin, parallel reduction across workgroups

### Component 2: Vectorscope Compute Shader
- **Responsibility:** Map chrominance to 2D circular display
- **Location:** `rust/crates/compositor/src/shaders/scopes/vectorscope.wgsl`
- **Interface:** Reads frame texture, outputs to storage texture `256×256 rgba8unorm`
- **Key design:** Convert RGB → YCbCr, plot Cb/Cr as x/y, accumulate brightness

### Component 3: Waveform Compute Shader
- **Responsibility:** Plot luminance per column
- **Location:** `rust/crates/compositor/src/shaders/scopes/waveform.wgsl`
- **Interface:** Reads frame texture, outputs to storage texture `W×128 rgba8unorm`
- **Key design:** For each column, plot luminance as vertical position, accumulate

### Component 4: Scope Manager (TypeScript)
- **Responsibility:** Dispatch compute shaders after main render, manage readback, update panels
- **Location:** `apps/web-vite/src/scopes/scope-manager.ts`
- **Interface:** `computeScopes(frameTexture)`, `getHistogramData()`, `getVectorscopeTexture()`, `getWaveformTexture()`
- **Dependencies:** WASM bridge (compute shader dispatch)

### Component 5: Scope Panels (TypeScript)
- **Responsibility:** Render scope data as 2D charts in dockable panels
- **Location:** `apps/web-vite/src/scopes/components/`
- **Interface:** React components: `HistogramPanel`, `VectorscopePanel`, `WaveformPanel`
- **Dependencies:** Scope Manager, Canvas 2D API

## Data Models

### Histogram Output
```typescript
interface HistogramData {
  red: Float32Array;     // [256] bins
  green: Float32Array;   // [256] bins
  blue: Float32Array;    // [256] bins
  luminance: Float32Array; // [256] bins
}
```

### Vectorscope Output
```typescript
// 256x256 RGBA texture, rendered directly to canvas
// Center = (128, 128), radius = 128
// Angle = hue, distance = saturation
```

### Waveform Output
```typescript
// W×128 RGBA texture, rendered directly to canvas
// X-axis = frame column, Y-axis = luminance (0=bottom, 127=top)
```

## Data Flow

1. Main compositor renders frame → frame texture available on GPU
2. Scope Manager detects open scopes → dispatches corresponding compute shaders
3. Compute shaders read frame texture, write to storage buffers/textures
4. Async readback copies results to CPU (non-blocking)
5. React panels receive updated data → re-render charts via Canvas 2D
6. If panel is closed/minimized, skip that scope's compute dispatch

## Key Algorithms

### Histogram (WGSL Compute)
```wgsl
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pixel = textureLoad(frame, id.xy, 0);
    let luma = dot(pixel.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    atomicAdd(&histogram[u32(pixel.r * 255.0)], 1);          // R
    atomicAdd(&histogram[256 + u32(pixel.g * 255.0)], 1);    // G
    atomicAdd(&histogram[512 + u32(pixel.b * 255.0)], 1);    // B
    atomicAdd(&histogram[768 + u32(luma * 255.0)], 1);       // Luma
}
```

### Vectorscope (WGSL Compute)
```wgsl
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pixel = textureLoad(frame, id.xy, 0);
    // RGB → YCbCr
    let cb = 0.5 + 0.5 * (pixel.b - pixel.r) / 1.772;
    let cr = 0.5 + 0.5 * (pixel.r - pixel.g) / 1.402;
    // Map to 256x256
    let x = u32(cb * 255.0);
    let y = u32(cr * 255.0);
    // Atomic accumulate for brightness
    atomicAdd(&vectorscope[y * 256 + x], pixel.rgb);
}
```

## Error Handling

- Frame texture unavailable → skip scope computation (no error)
- Readback fails → skip panel update, retry next frame
- GPU device lost → disable scopes, show error message

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: Histogram | histogram.wgsl compute shader, 256 bins × 4 channels |
| Req 2: Vectorscope | vectorscope.wgsl, RGB→YCbCr, circular plot |
| Req 3: Waveform | waveform.wgsl, column-based luminance plot |
| Req 4: Panel Management | Scope Manager + React dockable panels |
| Req 5: Performance | Post-render compute, async readback, skip when hidden |

## Testing Strategy

- **Histogram:** Property-based — sum of bins = total pixels, all bins >= 0, pure white = peak at 255
- **Vectorscope:** Property-based — pure gray at center, saturated colors at edge, hue angles correct
- **Waveform:** Property-based — pure black = bottom row, pure white = top row, column count = frame width
- **Performance:** Each scope <5ms at 1080p, all three open maintains 30fps preview
