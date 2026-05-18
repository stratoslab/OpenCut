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

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let intensity = uniforms.scalars.x;  // 0.0 to 1.0

    if (intensity <= 0.0) {
        return color;
    }

    let texel_size = vec2f(1.0, 1.0) / uniforms.resolution;
    let dir = uniforms.direction;

    // Unsharp mask: original + intensity * (original - blurred)
    var blurred = vec4f(0.0);
    var total_weight = 0.0;

    // 5-tap separable kernel for sharpening
    let offsets = array<i32, 5>(-2, -1, 0, 1, 2);
    let weights = array<f32, 5>(0.0625, 0.25, 0.375, 0.25, 0.0625);

    for (var i = 0; i < 5; i = i + 1) {
        let offset = f32(offsets[i]);
        let sample_uv = input.tex_coord + texel_size * dir * offset;
        blurred = blurred + textureSample(input_texture, input_sampler, sample_uv) * weights[i];
        total_weight = total_weight + weights[i];
    }

    blurred = blurred / total_weight;

    let sharpened = color + (color - blurred) * intensity;
    return vec4f(clamp01(sharpened.rgb), color.a);
}
