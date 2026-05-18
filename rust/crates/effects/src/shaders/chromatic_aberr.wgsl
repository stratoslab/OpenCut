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
    let angle = uniforms.scalars.y;      // 0.0 to 360.0

    if (intensity <= 0.0) {
        return color;
    }

    let center = vec2f(0.5, 0.5);
    let dir = normalize(input.tex_coord - center);
    let dist = length(input.tex_coord - center);

    // Convert angle to radians and create rotation
    let angle_rad = angle * 0.01745329251;  // degrees to radians
    let cos_a = cos(angle_rad);
    let sin_a = sin(angle_rad);
    let rot_dir = vec2f(dir.x * cos_a - dir.y * sin_a, dir.x * sin_a + dir.y * cos_a);

    let offset = rot_dir * dist * intensity * 0.02;

    let texel_size = vec2f(1.0, 1.0) / uniforms.resolution;

    let r = textureSample(input_texture, input_sampler, input.tex_coord + offset).r;
    let g = color.g;
    let b = textureSample(input_texture, input_sampler, input.tex_coord - offset).b;

    return vec4f(clamp01(vec3f(r, g, b)), color.a);
}
