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

    // ITU-R BT.709 luminance
    let luminance = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));
    let gray = vec3f(luminance);
    let result = mix(color.rgb, gray, intensity);

    return vec4f(clamp01(result), color.a);
}
