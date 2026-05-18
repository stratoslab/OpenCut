struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct EffectUniforms {
    resolution: vec2f,
    direction: vec2f,
    scalars: vec4f,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> uniforms: EffectUniforms;

fn clamp01(color: vec3f) -> vec3f {
    return clamp(color, vec3f(0.0), vec3f(1.0));
}

// Simple hash-based PRNG for GPU noise
fn hash(uv: vec2f, frame: f32) -> f32 {
    let p = fract(sin(vec3f(uv, frame)) * 43758.5453123);
    return fract((p.x + p.y + p.z) * 123.456);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let intensity = uniforms.scalars.x;   // 0.0 to 1.0
    let monochrome = uniforms.scalars.y;  // 0.0 or 1.0

    if (intensity <= 0.0) {
        return color;
    }

    // Use UV + time-based seed for temporal variation
    let seed = input.tex_coord * uniforms.resolution;
    let frame = uniforms.direction.x;  // Use direction.x as frame counter

    var noise: vec3f;
    if (monochrome > 0.5) {
        let n = hash(seed, frame) * 2.0 - 1.0;  // -1 to 1
        noise = vec3f(n);
    } else {
        noise = vec3f(
            hash(seed, frame) * 2.0 - 1.0,
            hash(seed + vec2f(0.1, 0.2), frame) * 2.0 - 1.0,
            hash(seed + vec2f(0.3, 0.4), frame) * 2.0 - 1.0,
        );
    }

    let result = color.rgb + noise * intensity * 0.2;
    return vec4f(clamp01(result), color.a);
}
