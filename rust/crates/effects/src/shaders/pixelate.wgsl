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
    let block_size = uniforms.scalars.x;  // 1.0 to 100.0

    if (block_size <= 1.0) {
        return color;
    }

    let texel_size = vec2f(1.0, 1.0) / uniforms.resolution;

    // Snap UV to block grid center
    let block_uv = floor(input.tex_coord / (texel_size * block_size)) * texel_size * block_size;
    let center_uv = block_uv + texel_size * block_size * 0.5;

    let block_color = textureSample(input_texture, input_sampler, center_uv);

    return vec4f(clamp01(block_color.rgb), color.a);
}
