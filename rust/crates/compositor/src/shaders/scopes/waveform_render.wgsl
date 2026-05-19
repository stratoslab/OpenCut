struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VertexOutput {
    var p = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0),
    );
    var out: VertexOutput;
    out.pos = vec4<f32>(p[vid], 0.0, 1.0);
    out.uv = vec2<f32>((p[vid].x + 1.0) * 0.5, (1.0 - p[vid].y) * 0.5);
    return out;
}

struct RenderParams {
    out_w: f32,
    out_h: f32,
    ref_value: f32,
    intensity: f32,
    mode: u32,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
}

@group(0) @binding(0) var<storage, read> accum_r: array<u32>;
@group(0) @binding(1) var<storage, read> accum_g: array<u32>;
@group(0) @binding(2) var<storage, read> accum_b: array<u32>;
@group(0) @binding(3) var<uniform> params: RenderParams;
@group(0) @binding(4) var<storage, read> accum_l: array<u32>;

fn sample_accum(acc: ptr<storage, array<u32>, read>, fx: f32, fy: f32, w: u32, h: u32) -> f32 {
    let x0 = u32(clamp(fx, 0.0, f32(w - 1u)));
    let y0 = u32(clamp(fy, 0.0, f32(h - 1u)));
    let x1 = min(x0 + 1u, w - 1u);
    let y1 = min(y0 + 1u, h - 1u);
    let dx = fract(fx);
    let dy = fract(fy);
    let v00 = f32((*acc)[y0 * w + x0]);
    let v10 = f32((*acc)[y0 * w + x1]);
    let v01 = f32((*acc)[y1 * w + x0]);
    let v11 = f32((*acc)[y1 * w + x1]);
    return mix(mix(v00, v10, dx), mix(v01, v11, dx), dy);
}

fn read_accum(acc: ptr<storage, array<u32>, read>, x: i32, y: i32, w: i32, h: i32) -> f32 {
    return f32((*acc)[u32(clamp(y, 0, h - 1)) * u32(w) + u32(clamp(x, 0, w - 1))]);
}

fn bloom_single(acc: ptr<storage, array<u32>, read>, ix: i32, iy: i32, w: i32, h: i32) -> f32 {
    let b_k = array<f32, 3>(0.25, 0.50, 0.25);
    var total = 0.0;
    for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
            total = total + read_accum(acc, ix + dx * 4, iy + dy * 4, w, h) * b_k[u32(dx + 1)] * b_k[u32(dy + 1)];
        }
    }
    return total;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let uv = input.uv;
    if (uv.x < 0.0 || uv.x >= 1.0 || uv.y < 0.0 || uv.y >= 1.0) {
        return vec4<f32>(0.04, 0.04, 0.04, 1.0);
    }

    let w = u32(params.out_w);
    let h = u32(params.out_h);
    let iw = i32(w);
    let ih = i32(h);
    let mode = params.mode;
    let rv = params.ref_value;
    let s = params.intensity;

    var color: vec3<f32>;

    if (mode == 5u) {
        let section = min(u32(uv.x * 3.0), 2u);
        let local_x = fract(uv.x * 3.0);
        let pfx = local_x * params.out_w - 0.5;
        let pfy = uv.y * params.out_h - 0.5;
        let pix = i32(pfx + 0.5);
        let piy = i32(pfy + 0.5);

        var cv: f32;
        var bv: f32;

        if (section == 0u) {
            cv = sample_accum(&accum_r, pfx, pfy, w, h);
            bv = bloom_single(&accum_r, pix, piy, iw, ih);
        } else if (section == 1u) {
            cv = sample_accum(&accum_g, pfx, pfy, w, h);
            bv = bloom_single(&accum_g, pix, piy, iw, ih);
        } else {
            cv = sample_accum(&accum_b, pfx, pfy, w, h);
            bv = bloom_single(&accum_b, pix, piy, iw, ih);
        }

        let v_t = pow(clamp(sqrt(cv) / rv, 0.0, 1.0), 0.75) * s;
        let v_g = pow(clamp(sqrt(bv) / rv, 0.0, 1.0), 0.65) * 0.12;
        let v = clamp(v_t + v_g, 0.0, 1.0);

        if (section == 0u) {
            color = vec3<f32>(v, v * 0.15, v * 0.15);
        } else if (section == 1u) {
            color = vec3<f32>(v * 0.15, v, v * 0.15);
        } else {
            color = vec3<f32>(v * 0.15, v * 0.15, v);
        }

        let div_w = 2.0 / params.out_w;
        let d1 = smoothstep(div_w, 0.0, abs(uv.x - 1.0 / 3.0));
        let d2 = smoothstep(div_w, 0.0, abs(uv.x - 2.0 / 3.0));
        color = max(color, vec3<f32>(0.18) * max(d1, d2));
    } else {
        let fx = uv.x * params.out_w - 0.5;
        let fy = uv.y * params.out_h - 0.5;

        let r_center = sample_accum(&accum_r, fx, fy, w, h);
        let g_center = sample_accum(&accum_g, fx, fy, w, h);
        let b_center = sample_accum(&accum_b, fx, fy, w, h);
        let l_center = sample_accum(&accum_l, fx, fy, w, h);

        let ix = i32(fx + 0.5);
        let iy = i32(fy + 0.5);
        let r_bloom = bloom_single(&accum_r, ix, iy, iw, ih);
        let g_bloom = bloom_single(&accum_g, ix, iy, iw, ih);
        let b_bloom = bloom_single(&accum_b, ix, iy, iw, ih);
        let l_bloom = bloom_single(&accum_l, ix, iy, iw, ih);

        let r_t = pow(clamp(sqrt(r_center) / rv, 0.0, 1.0), 0.75) * s;
        let g_t = pow(clamp(sqrt(g_center) / rv, 0.0, 1.0), 0.75) * s;
        let b_t = pow(clamp(sqrt(b_center) / rv, 0.0, 1.0), 0.75) * s;
        let l_t = pow(clamp(sqrt(l_center) / rv, 0.0, 1.0), 0.75) * s;

        let r_g = pow(clamp(sqrt(r_bloom) / rv, 0.0, 1.0), 0.65) * 0.12;
        let g_g = pow(clamp(sqrt(g_bloom) / rv, 0.0, 1.0), 0.65) * 0.12;
        let b_g = pow(clamp(sqrt(b_bloom) / rv, 0.0, 1.0), 0.65) * 0.12;
        let l_g = pow(clamp(sqrt(l_bloom) / rv, 0.0, 1.0), 0.65) * 0.12;

        if (mode == 0u) {
            color = clamp(vec3<f32>(r_t + r_g, g_t + g_g, b_t + b_g), vec3<f32>(0.0), vec3<f32>(1.0));
        } else if (mode == 1u) {
            let v = clamp(r_t + r_g, 0.0, 1.0);
            color = vec3<f32>(v, v * 0.15, v * 0.15);
        } else if (mode == 2u) {
            let v = clamp(g_t + g_g, 0.0, 1.0);
            color = vec3<f32>(v * 0.15, v, v * 0.15);
        } else if (mode == 3u) {
            let v = clamp(b_t + b_g, 0.0, 1.0);
            color = vec3<f32>(v * 0.15, v * 0.15, v);
        } else {
            let v = clamp(l_t + l_g, 0.0, 1.0);
            color = vec3<f32>(v);
        }
    }

    let grid_y = fract(uv.y * 10.0);
    let d_grid = min(grid_y, 1.0 - grid_y) * params.out_h * 0.5;
    if (d_grid < 0.8) {
        let a = 0.15 * (1.0 - d_grid / 0.8);
        color = max(color, vec3<f32>(0.55, 0.45, 0.12) * a);
    }

    return vec4<f32>(color, 1.0);
}
