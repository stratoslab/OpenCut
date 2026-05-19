struct ComputeParams {
    out_size: u32,
    src_w: u32,
    src_h: u32,
    _pad: u32,
    kr: f32,
    kb: f32,
    _pad2: f32,
    _pad3: f32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> accum_r: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> accum_g: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> accum_b: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: ComputeParams;

@compute @workgroup_size(16, 16)
fn compute_main(@builtin(global_invocation_id) gid: vec3<u32>) {
    if (gid.x >= params.src_w || gid.y >= params.src_h) {
        return;
    }

    let pixel = textureLoad(input_texture, vec2<i32>(i32(gid.x), i32(gid.y)), 0);

    let r = pixel.r;
    let g = pixel.g;
    let b = pixel.b;
    let kg = 1.0 - params.kr - params.kb;

    let y = params.kr * r + kg * g + params.kb * b;
    let cb = (b - y) / (2.0 * (1.0 - params.kb));
    let cr = (r - y) / (2.0 * (1.0 - params.kr));

    let center = f32(params.out_size) * 0.5;
    let scale = center * 0.92;

    let px = u32(clamp(center + cb * 2.0 * scale, 0.0, f32(params.out_size - 1u)));
    let py = u32(clamp(center - cr * 2.0 * scale, 0.0, f32(params.out_size - 1u)));

    let idx = py * params.out_size + px;

    atomicAdd(&accum_r[idx], u32(max(r * 255.0, 1.0)));
    atomicAdd(&accum_g[idx], u32(max(g * 255.0, 1.0)));
    atomicAdd(&accum_b[idx], u32(max(b * 255.0, 1.0)));
}
