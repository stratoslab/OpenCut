struct HistogramUniforms {
    width: u32,
    height: u32,
    _pad0: u32,
    _pad1: u32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> histogram: array<atomic<u32>, 1024>;
@group(0) @binding(2) var<uniform> uniforms: HistogramUniforms;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= uniforms.width || id.y >= uniforms.height) {
        return;
    }

    let pixel = textureLoad(input_texture, vec2<u32>(id.x, id.y), 0);
    let r = u32(pixel.r * 255.0);
    let g = u32(pixel.g * 255.0);
    let b = u32(pixel.b * 255.0);
    let luma = u32(dot(pixel.rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) * 255.0);

    // Clamp to valid range
    let r_bin = min(r, 255u);
    let g_bin = min(g, 255u);
    let b_bin = min(b, 255u);
    let luma_bin = min(luma, 255u);

    atomicAdd(&histogram[r_bin], 1u);
    atomicAdd(&histogram[256u + g_bin], 1u);
    atomicAdd(&histogram[512u + b_bin], 1u);
    atomicAdd(&histogram[768u + luma_bin], 1u);
}
