struct VectorscopeUniforms {
    width: u32,
    height: u32,
    output_size: u32,
    _pad0: u32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: VectorscopeUniforms;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= uniforms.width || id.y >= uniforms.height) {
        return;
    }

    let pixel = textureLoad(input_texture, vec2<u32>(id.x, id.y), 0);

    // RGB to YCbCr (simplified)
    let y = dot(pixel.rgb, vec3<f32>(0.299, 0.587, 0.114));
    let cb = (pixel.b - y) * 0.565 + 0.5;
    let cr = (pixel.r - y) * 0.713 + 0.5;

    // Map to output coordinates (256x256)
    let size = f32(uniforms.output_size);
    let x = u32(clamp(cb * size, 0.0, size - 1.0));
    let y_coord = u32(clamp(cr * size, 0.0, size - 1.0));

    // Atomic accumulate for brightness (using additive blend via storage)
    let current = textureLoad(output_texture, vec2<u32>(x, y_coord), 0);
    let brightness = min(current.a + 0.01, 1.0);
    textureStore(output_texture, vec2<i32>(i32(x), i32(y_coord)), vec4<f32>(1.0, 1.0, 1.0, brightness));
}
