struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct LayerUniforms {
    resolution: vec2f,
    center: vec2f,
    size: vec2f,
    rotation_radians: f32,
    opacity: f32,
    flip_x: f32,
    flip_y: f32,
    inline_brightness: f32,
    inline_contrast: f32,
    inline_saturation: f32,
    inline_invert: f32,
    pos_z: f32,
    scale_z: f32,
    rotation_x: f32,
    rotation_y: f32,
    perspective: f32,
}

@group(0) @binding(0) var source_texture: texture_2d<f32>;
@group(0) @binding(1) var source_sampler: sampler;
@group(1) @binding(0) var<uniform> uniforms: LayerUniforms;

fn rotate_inverse(point: vec2f, angle: f32) -> vec2f {
    let c = cos(angle);
    let s = sin(angle);
    return vec2f(
        point.x * c + point.y * s,
        -point.x * s + point.y * c,
    );
}

fn luminance(c: vec3f) -> f32 {
    return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let pixel = input.tex_coord * uniforms.resolution;
    let local = rotate_inverse(pixel - uniforms.center, uniforms.rotation_radians);

    var p = vec3f(local.x, local.y, uniforms.pos_z);

    let cosX = cos(-uniforms.rotation_x);
    let sinX = sin(-uniforms.rotation_x);
    p = vec3f(p.x, p.y * cosX - p.z * sinX, p.y * sinX + p.z * cosX);

    let cosY = cos(-uniforms.rotation_y);
    let sinY = sin(-uniforms.rotation_y);
    p = vec3f(p.x * cosY + p.z * sinY, p.y, -p.x * sinY + p.z * cosY);

    let w = 1.0 - p.z / max(uniforms.perspective, 0.5);
    if (w <= 0.001) {
        discard;
    }
    let projected = vec2f(p.x / w, p.y / w);

    let uv = vec2f(
        projected.x / uniforms.size.x + 0.5,
        projected.y / uniforms.size.y + 0.5,
    );

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        return vec4f(0.0, 0.0, 0.0, 0.0);
    }

    let sample_uv = vec2f(
        select(uv.x, 1.0 - uv.x, uniforms.flip_x > 0.5),
        select(uv.y, 1.0 - uv.y, uniforms.flip_y > 0.5),
    );
    var color = textureSampleLevel(source_texture, source_sampler, sample_uv, 0.0);

    // Inline brightness + contrast: clamp((c + brightness - 0.5) * contrast + 0.5, 0, 1)
    color.rgb = clamp(
        (color.rgb + uniforms.inline_brightness - 0.5) * uniforms.inline_contrast + 0.5,
        vec3f(0.0),
        vec3f(1.0)
    );

    // Inline saturation: mix(luminance, color, saturation)
    color.rgb = mix(
        vec3f(luminance(color.rgb)),
        color.rgb,
        uniforms.inline_saturation
    );

    // Inline invert: select(color, 1.0 - color, invert > 0.5)
    color.rgb = select(color.rgb, 1.0 - color.rgb, uniforms.inline_invert > 0.5);

    return vec4f(color.rgb, color.a * uniforms.opacity);
}
