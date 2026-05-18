struct WaveformUniforms {
    width: u32,
    height: u32,
    output_height: u32,
    _pad0: u32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: WaveformUniforms;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= uniforms.width || id.y >= uniforms.height) {
        return;
    }

    let pixel = textureLoad(input_texture, vec2<u32>(id.x, id.y), 0);
    let luma = dot(pixel.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Map luminance to output Y position (0 = bottom, output_height-1 = top)
    let y_pos = u32(clamp((1.0 - luma) * f32(uniforms.output_height - 1), 0.0, f32(uniforms.output_height - 1)));

    // Plot at column = id.x, row = y_pos
    let current = textureLoad(output_texture, vec2<i32>(i32(id.x), i32(y_pos)), 0);
    let brightness = min(current.a + 0.02, 1.0);
    textureStore(output_texture, vec2<i32>(i32(id.x), i32(y_pos)), vec4<f32>(1.0, 1.0, 1.0, brightness));
}
