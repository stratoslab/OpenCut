struct ComputeParams {
    out_w: u32,
    out_h: u32,
    src_w: u32,
    src_h: u32,
    kr: f32,
    kb: f32,
    range_min: f32,
    range_max: f32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> accum_r: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> accum_g: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> accum_b: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: ComputeParams;
@group(0) @binding(5) var<storage, read_write> accum_l: array<atomic<u32>>;

fn norm_range(v: f32, r_min: f32, r_max: f32) -> f32 {
    return clamp((v - r_min) / max(r_max - r_min, 0.001), 0.0, 1.0);
}

@compute @workgroup_size(16, 16)
fn compute_main(@builtin(global_invocation_id) gid: vec3<u32>) {
    if (gid.x >= params.src_w || gid.y >= params.src_h) {
        return;
    }

    let pixel = textureLoad(input_texture, vec2<i32>(i32(gid.x), i32(gid.y)), 0);

    let fx_pos = f32(gid.x) * f32(params.out_w) / f32(params.src_w);
    let x0 = u32(fx_pos);
    let x1 = min(x0 + 1u, params.out_w - 1u);
    let frac = fx_pos - f32(x0);
    let w0 = u32((1.0 - frac) * 256.0);
    let w1 = 256u - w0;

    let hm1 = f32(params.out_h - 1u);
    let max_y = i32(params.out_h - 1u);

    let g_k = array<f32, 5>(0.06, 0.24, 0.40, 0.24, 0.06);

    let rn = norm_range(pixel.r, params.range_min, params.range_max);
    let gn = norm_range(pixel.g, params.range_min, params.range_max);
    let bn = norm_range(pixel.b, params.range_min, params.range_max);
    let kg = 1.0 - params.kr - params.kb;
    let ln = norm_range(params.kr * pixel.r + kg * pixel.g + params.kb * pixel.b, params.range_min, params.range_max);

    let ry_c = i32(hm1 - clamp(rn, 0.0, 1.0) * hm1);
    for (var d: i32 = -2; d <= 2; d = d + 1) {
        let y = u32(clamp(ry_c + d, 0, max_y));
        let yw = g_k[u32(d + 2)];
        let idx = y * params.out_w;
        let wa = u32(f32(w0) * yw);
        let wb = u32(f32(w1) * yw);
        if (wa > 0u) { atomicAdd(&accum_r[idx + x0], wa); }
        if (wb > 0u) { atomicAdd(&accum_r[idx + x1], wb); }
    }

    let gy_c = i32(hm1 - clamp(gn, 0.0, 1.0) * hm1);
    for (var d: i32 = -2; d <= 2; d = d + 1) {
        let y = u32(clamp(gy_c + d, 0, max_y));
        let yw = g_k[u32(d + 2)];
        let idx = y * params.out_w;
        let wa = u32(f32(w0) * yw);
        let wb = u32(f32(w1) * yw);
        if (wa > 0u) { atomicAdd(&accum_g[idx + x0], wa); }
        if (wb > 0u) { atomicAdd(&accum_g[idx + x1], wb); }
    }

    let by_c = i32(hm1 - clamp(bn, 0.0, 1.0) * hm1);
    for (var d: i32 = -2; d <= 2; d = d + 1) {
        let y = u32(clamp(by_c + d, 0, max_y));
        let yw = g_k[u32(d + 2)];
        let idx = y * params.out_w;
        let wa = u32(f32(w0) * yw);
        let wb = u32(f32(w1) * yw);
        if (wa > 0u) { atomicAdd(&accum_b[idx + x0], wa); }
        if (wb > 0u) { atomicAdd(&accum_b[idx + x1], wb); }
    }

    let ly_c = i32(hm1 - clamp(ln, 0.0, 1.0) * hm1);
    for (var d: i32 = -2; d <= 2; d = d + 1) {
        let y = u32(clamp(ly_c + d, 0, max_y));
        let yw = g_k[u32(d + 2)];
        let idx = y * params.out_w;
        let wa = u32(f32(w0) * yw);
        let wb = u32(f32(w1) * yw);
        if (wa > 0u) { atomicAdd(&accum_l[idx + x0], wa); }
        if (wb > 0u) { atomicAdd(&accum_l[idx + x1], wb); }
    }
}
