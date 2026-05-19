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
    out_size: f32,
    ref_value: f32,
    _p0: f32,
    _p1: f32,
}

@group(0) @binding(0) var<storage, read> accum_r: array<u32>;
@group(0) @binding(1) var<storage, read> accum_g: array<u32>;
@group(0) @binding(2) var<storage, read> accum_b: array<u32>;
@group(0) @binding(3) var<uniform> params: RenderParams;

fn sample_vs(acc: ptr<storage, array<u32>, read>, fx: f32, fy: f32, sz: u32) -> f32 {
    let x0 = u32(clamp(fx, 0.0, f32(sz - 1u)));
    let y0 = u32(clamp(fy, 0.0, f32(sz - 1u)));
    let x1 = min(x0 + 1u, sz - 1u);
    let y1 = min(y0 + 1u, sz - 1u);
    let dx = fract(fx);
    let dy = fract(fy);
    let v00 = f32((*acc)[y0 * sz + x0]);
    let v10 = f32((*acc)[y0 * sz + x1]);
    let v01 = f32((*acc)[y1 * sz + x0]);
    let v11 = f32((*acc)[y1 * sz + x1]);
    return mix(mix(v00, v10, dx), mix(v01, v11, dx), dy);
}

fn read_vs(acc: ptr<storage, array<u32>, read>, x: i32, y: i32, sz: i32) -> f32 {
    return f32((*acc)[u32(clamp(y, 0, sz - 1)) * u32(sz) + u32(clamp(x, 0, sz - 1))]);
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let uv = input.uv;
    let size = params.out_size;
    let sz = u32(size);
    let isz = i32(sz);
    let center = 0.5;
    let d = distance(uv, vec2<f32>(center));
    let grat_scale = 0.92;

    var color = vec3<f32>(0.04);

    let radius_full = grat_scale * 0.5;
    let radius_75 = grat_scale * 0.5 * 0.75;
    let radius_25 = grat_scale * 0.5 * 0.25;
    let line_w = 1.2 / size;

    let aa = smoothstep(0.0, line_w, abs(d - radius_full));
    color = mix(vec3<f32>(0.20), color, aa);
    let aa_75 = smoothstep(0.0, line_w, abs(d - radius_75));
    color = mix(vec3<f32>(0.14), color, aa_75);
    let aa_25 = smoothstep(0.0, line_w, abs(d - radius_25));
    color = mix(vec3<f32>(0.10), color, aa_25);

    let cross_w = 0.8 / size;
    if (d < radius_full + 0.01) {
        let ax_h = smoothstep(0.0, cross_w, abs(uv.y - center));
        let ax_v = smoothstep(0.0, cross_w, abs(uv.x - center));
        color = mix(vec3<f32>(0.12), color, ax_h);
        color = mix(vec3<f32>(0.12), color, ax_v);
    }

    let angle = atan2(-(uv.y - center), uv.x - center);
    let skin_angle = radians(123.0);
    let skin_aa = smoothstep(0.0, cross_w, abs(angle - skin_angle));
    if (d < radius_full + 0.01 && d > 0.01) {
        color = mix(vec3<f32>(0.28, 0.20, 0.08), color, skin_aa);
    }

    let target_angles = array<f32, 6>(
        radians(103.0), radians(61.0), radians(-13.0),
        radians(-77.0), radians(-119.0), radians(167.0),
    );
    let target_colors = array<vec3<f32>, 6>(
        vec3<f32>(0.6, 0.15, 0.15), vec3<f32>(0.5, 0.15, 0.5), vec3<f32>(0.15, 0.15, 0.6),
        vec3<f32>(0.15, 0.5, 0.5), vec3<f32>(0.15, 0.5, 0.15), vec3<f32>(0.5, 0.5, 0.1),
    );
    let dot_r = 8.0 / size;
    let ring_w = 2.0 / size;
    for (var i: u32 = 0u; i < 6u; i = i + 1u) {
        let ta = target_angles[i];
        let tx = center + cos(ta) * radius_75;
        let ty = center - sin(ta) * radius_75;
        let td = distance(uv, vec2<f32>(tx, ty));
        let dot_aa = smoothstep(dot_r, dot_r - ring_w, td);
        let ring_aa = smoothstep(ring_w * 0.5, 0.0, abs(td - dot_r));
        color = mix(color, target_colors[i] * 0.5, dot_aa);
        color = mix(color, target_colors[i], ring_aa);
    }

    if (uv.x >= 0.0 && uv.x < 1.0 && uv.y >= 0.0 && uv.y < 1.0) {
        let fx = uv.x * size - 0.5;
        let fy = uv.y * size - 0.5;

        let r_center = sample_vs(&accum_r, fx, fy, sz);
        let g_center = sample_vs(&accum_g, fx, fy, sz);
        let b_center = sample_vs(&accum_b, fx, fy, sz);

        let ix = i32(fx + 0.5);
        let iy = i32(fy + 0.5);
        var r_bloom = 0.0;
        var g_bloom = 0.0;
        var b_bloom = 0.0;
        let b_k = array<f32, 3>(0.25, 0.50, 0.25);
        for (var by: i32 = -1; by <= 1; by = by + 1) {
            for (var bx: i32 = -1; bx <= 1; bx = bx + 1) {
                let bw = b_k[u32(bx + 1)] * b_k[u32(by + 1)];
                r_bloom = r_bloom + read_vs(&accum_r, ix + bx * 3, iy + by * 3, isz) * bw;
                g_bloom = g_bloom + read_vs(&accum_g, ix + bx * 3, iy + by * 3, isz) * bw;
                b_bloom = b_bloom + read_vs(&accum_b, ix + bx * 3, iy + by * 3, isz) * bw;
            }
        }

        let rv = params.ref_value;
        let total_center = r_center + g_center + b_center;
        let total_bloom = r_bloom + g_bloom + b_bloom;
        let density = pow(clamp(sqrt(total_center / 3.0) / rv, 0.0, 1.0), 0.7);
        let bloom_d = pow(clamp(sqrt(total_bloom / 3.0) / rv, 0.0, 1.0), 0.6) * 0.18;

        if (total_center > 0.0) {
            let r_ratio = r_center / total_center;
            let g_ratio = g_center / total_center;
            let b_ratio = b_center / total_center;
            let chroma_color = vec3<f32>(r_ratio, g_ratio, b_ratio) * 3.0;
            let white_mix = density * density * 0.5;
            let trace_color = mix(chroma_color, vec3<f32>(1.0), white_mix) * (density + bloom_d);
            color = max(color, clamp(trace_color, vec3<f32>(0.0), vec3<f32>(1.0)));
        }
    }

    return vec4<f32>(color, 1.0);
}
