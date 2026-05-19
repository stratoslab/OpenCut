struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct MaskUniforms {
    // Frame resolution
    resolution: vec2f,
    // Layer transform (same as layer.wgsl)
    center: vec2f,
    size: vec2f,
    rotation_radians: f32,
    feather: f32,
    inverted: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
}

@group(0) @binding(0) var layer_texture: texture_2d<f32>;
@group(0) @binding(1) var layer_sampler: sampler;
@group(1) @binding(0) var mask_texture: texture_2d<f32>;
@group(1) @binding(1) var mask_sampler: sampler;
@group(2) @binding(0) var<uniform> uniforms: MaskUniforms;

fn rotate_inverse(point: vec2f, angle: f32) -> vec2f {
    let c = cos(angle);
    let s = sin(angle);
    return vec2f(
        point.x * c + point.y * s,
        -point.x * s + point.y * c,
    );
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    // Transform frame-space UV to layer-local UV (same as layer.wgsl)
    let pixel = input.tex_coord * uniforms.resolution;
    let local = rotate_inverse(pixel - uniforms.center, uniforms.rotation_radians);
    let layer_uv = vec2f(
        local.x / uniforms.size.x + 0.5,
        local.y / uniforms.size.y + 0.5,
    );

    let layer = textureSample(layer_texture, layer_sampler, input.tex_coord);

    // Sample mask in layer-local UV space
    let mask_sample = textureSample(mask_texture, mask_sampler, layer_uv);
    let mask_value = mask_sample.a;

    // Apply feather as smooth edge softening
    let alpha = if (uniforms.feather > 0.0) {
        let edge = uniforms.feather * 0.5;
        smoothstep(0.5 - edge, 0.5 + edge, mask_value)
    } else {
        mask_value
    };

    let final_alpha = select(alpha, 1.0 - alpha, uniforms.inverted > 0.5);
    return vec4f(layer.rgb, layer.a * final_alpha);
}
