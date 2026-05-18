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
    let brightness = uniforms.scalars.x;    // -1.0 to 1.0
    let contrast = uniforms.scalars.y;      // -1.0 to 1.0
    let saturation = uniforms.scalars.z;    // 0.0 to 2.0
    let temperature = uniforms.scalars.w;   // -1.0 to 1.0

    var rgb = color.rgb;

    // Brightness
    rgb = rgb * (1.0 + brightness);

    // Contrast
    rgb = (rgb - 0.5) * (1.0 + contrast) + 0.5;

    // Saturation
    let luminance = dot(rgb, vec3f(0.2126, 0.7152, 0.0722));
    rgb = mix(vec3f(luminance), rgb, saturation);

    // Temperature (warm/cool)
    rgb.r += temperature * 0.1;
    rgb.b -= temperature * 0.1;

    return vec4f(clamp01(rgb), color.a);
}
