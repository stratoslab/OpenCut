struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct TransitionUniforms {
    transition_type: u32,
    progress: f32,
    direction: f32,
    intensity: f32,
}

@group(0) @binding(0) var clip_a: texture_2d<f32>;
@group(0) @binding(1) var clip_a_sampler: sampler;
@group(1) @binding(0) var clip_b: texture_2d<f32>;
@group(1) @binding(1) var clip_b_sampler: sampler;
@group(2) @binding(0) var<uniform> uniforms: TransitionUniforms;

fn clamp01(color: vec3f) -> vec3f {
    return clamp(color, vec3f(0.0), vec3f(1.0));
}

fn crossfade(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    _ = uv;
    return mix(a, b, uniforms.progress);
}

fn slide(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let offset = uniforms.progress;
    let dir = uniforms.direction;

    if (dir < 0.5) {
        let a_uv = uv + vec2f(offset, 0.0);
        if (a_uv.x > 1.0) {
            return textureSample(clip_b, clip_b_sampler, uv - vec2f(1.0 - offset, 0.0));
        }
        return textureSample(clip_a, clip_a_sampler, a_uv);
    } else if (dir < 1.5) {
        let b_uv = uv - vec2f(offset, 0.0);
        if (b_uv.x < 0.0) {
            return textureSample(clip_a, clip_a_sampler, uv + vec2f(1.0 - offset, 0.0));
        }
        return textureSample(clip_b, clip_b_sampler, b_uv);
    } else if (dir < 2.5) {
        let a_uv = uv + vec2f(0.0, offset);
        if (a_uv.y > 1.0) {
            return textureSample(clip_b, clip_b_sampler, uv - vec2f(0.0, 1.0 - offset));
        }
        return textureSample(clip_a, clip_a_sampler, a_uv);
    } else {
        let b_uv = uv - vec2f(0.0, offset);
        if (b_uv.y < 0.0) {
            return textureSample(clip_a, clip_a_sampler, uv + vec2f(0.0, 1.0 - offset));
        }
        return textureSample(clip_b, clip_b_sampler, b_uv);
    }
}

fn wipe(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let threshold = uniforms.progress;
    let dir = uniforms.direction;

    if (dir < 0.5) {
        return select(a, b, uv.x < threshold);
    } else {
        return select(a, b, uv.x > (1.0 - threshold));
    }
}

fn iris(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let center = vec2f(0.5, 0.5);
    let dist = length(uv - center);
    let radius = uniforms.progress * 0.75;
    return select(a, b, dist < radius);
}

fn clockWipe(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let center = vec2f(0.5, 0.5);
    let angle = atan2(uv.y - center.y, uv.x - center.x);
    let normalized = (angle + 3.14159265) / 6.28318530;
    return select(a, b, normalized < uniforms.progress);
}

fn glitch(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let glitchAmount = sin(uniforms.progress * 3.14159265) * uniforms.intensity;
    let slice = floor(uv.y * 20.0) / 20.0;
    let offset = sin(slice * 10.0 + uniforms.progress * 20.0) * glitchAmount * 0.05;

    let a_uv = clamp(uv + vec2f(offset, 0.0), vec2f(0.0), vec2f(1.0));
    let b_uv = clamp(uv - vec2f(offset, 0.0), vec2f(0.0), vec2f(1.0));

    let r = textureSample(clip_b, clip_b_sampler, b_uv).r;
    let g = mix(
        textureSample(clip_a, clip_a_sampler, a_uv).g,
        textureSample(clip_b, clip_b_sampler, b_uv).g,
        uniforms.progress,
    );
    let b_ch = textureSample(clip_a, clip_a_sampler, a_uv).b;

    return vec4f(r, g, b_ch, 1.0);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let a = textureSample(clip_a, clip_a_sampler, input.tex_coord);
    let b = textureSample(clip_b, clip_b_sampler, input.tex_coord);

    let progress = clamp(uniforms.progress, 0.0, 1.0);

    if (progress <= 0.001) { return a; }
    if (progress >= 0.999) { return b; }

    switch uniforms.transition_type {
        case 0u: { return crossfade(a, b, input.tex_coord); }
        case 1u: { return slide(a, b, input.tex_coord); }
        case 2u: { return wipe(a, b, input.tex_coord); }
        case 3u: { return iris(a, b, input.tex_coord); }
        case 4u: { return clockWipe(a, b, input.tex_coord); }
        case 5u: { return glitch(a, b, input.tex_coord); }
        default: { return crossfade(a, b, input.tex_coord); }
    }
}
