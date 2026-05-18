struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct UpscaleUniforms {
    resolution: vec2f,
    direction: vec2f,
    scalars: vec4f,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> uniforms: UpscaleUniforms;

fn clamp01(color: vec3f) -> vec3f {
    return clamp(color, vec3f(0.0), vec3f(1.0));
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let intensity = uniforms.scalars.x;

    if (intensity <= 0.0) {
        return color;
    }

    let texel_size = vec2f(1.0, 1.0) / uniforms.resolution;

    // 3x3 neighborhood
    let tl = textureSample(input_texture, input_sampler, input.tex_coord + texel_size * vec2f(-1.0, -1.0)).rgb;
    let t  = textureSample(input_texture, input_sampler, input.tex_coord + texel_size * vec2f( 0.0, -1.0)).rgb;
    let tr = textureSample(input_texture, input_sampler, input.tex_coord + texel_size * vec2f( 1.0, -1.0)).rgb;
    let l  = textureSample(input_texture, input_sampler, input.tex_coord + texel_size * vec2f(-1.0,  0.0)).rgb;
    let c  = color.rgb;
    let r  = textureSample(input_texture, input_sampler, input.tex_coord + texel_size * vec2f( 1.0,  0.0)).rgb;
    let bl = textureSample(input_texture, input_sampler, input.tex_coord + texel_size * vec2f(-1.0,  1.0)).rgb;
    let b  = textureSample(input_texture, input_sampler, input.tex_coord + texel_size * vec2f( 0.0,  1.0)).rgb;
    let br = textureSample(input_texture, input_sampler, input.tex_coord + texel_size * vec2f( 1.0,  1.0)).rgb;

    // Laplacian edge detection
    let grad = tl + 2.0 * l + bl - tr - 2.0 * r - br;
    let edge_strength = length(grad);

    // Edge-directed sharpening
    let sharpened = c + grad * intensity * 0.5;
    let result = mix(c, sharpened, min(edge_strength * intensity, 1.0));

    return vec4f(clamp01(result), color.a);
}
