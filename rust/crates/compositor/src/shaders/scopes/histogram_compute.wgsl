struct ComputeParams {
    src_w: u32,
    src_h: u32,
    _pad0: u32,
    _pad1: u32,
    kr: f32,
    kb: f32,
    range_min: f32,
    range_max: f32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> hist_r: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> hist_g: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> hist_b: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> hist_l: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: ComputeParams;

fn norm_range(v: f32, r_min: f32, r_max: f32) -> f32 {
    return clamp((v - r_min) / max(r_max - r_min, 0.001), 0.0, 1.0);
}

@compute @workgroup_size(16, 16)
fn compute_main(@builtin(global_invocation_id) gid: vec3<u32>) {
    if (gid.x >= params.src_w || gid.y >= params.src_h) {
        return;
    }

    let pixel = textureLoad(input_texture, vec2<i32>(i32(gid.x), i32(gid.y)), 0);

    let rn = norm_range(pixel.r, params.range_min, params.range_max);
    let gn = norm_range(pixel.g, params.range_min, params.range_max);
    let bn = norm_range(pixel.b, params.range_min, params.range_max);

    let r = min(u32(rn * 255.0), 255u);
    let g = min(u32(gn * 255.0), 255u);
    let b = min(u32(bn * 255.0), 255u);

    let kg = 1.0 - params.kr - params.kb;
    let ln = norm_range(params.kr * pixel.r + kg * pixel.g + params.kb * pixel.b, params.range_min, params.range_max);
    let l = min(u32(ln * 255.0), 255u);

    atomicAdd(&hist_r[r], 1u);
    atomicAdd(&hist_g[g], 1u);
    atomicAdd(&hist_b[b], 1u);
    atomicAdd(&hist_l[l], 1u);
}
