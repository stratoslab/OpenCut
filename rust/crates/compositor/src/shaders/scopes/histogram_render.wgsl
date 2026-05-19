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
    total_pixels: f32,
    mode: f32,
    _pad1: f32,
    _pad2: f32,
}

@group(0) @binding(0) var<storage, read> hist_r: array<u32>;
@group(0) @binding(1) var<storage, read> hist_g: array<u32>;
@group(0) @binding(2) var<storage, read> hist_b: array<u32>;
@group(0) @binding(3) var<storage, read> hist_l: array<u32>;
@group(0) @binding(4) var<uniform> params: RenderParams;

fn sample_hist(hist: ptr<storage, array<u32>, read>, fx: f32) -> f32 {
    let b0 = u32(clamp(fx, 0.0, 255.0));
    let b1 = min(b0 + 1u, 255u);
    let t = fract(fx);
    return mix(f32((*hist)[b0]), f32((*hist)[b1]), t);
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let uv = input.uv;
    if (uv.x < 0.0 || uv.x >= 1.0 || uv.y < 0.0 || uv.y >= 1.0) {
        return vec4<f32>(0.04, 0.04, 0.04, 1.0);
    }

    let mode = u32(params.mode);
    let fx = uv.x * 255.0;
    let r_val = sample_hist(&hist_r, fx);
    let g_val = sample_hist(&hist_g, fx);
    let b_val = sample_hist(&hist_b, fx);
    let l_val = sample_hist(&hist_l, fx);

    let scale = 1.0 / sqrt(params.total_pixels * 0.08);
    let r_h = sqrt(r_val) * scale;
    let g_h = sqrt(g_val) * scale;
    let b_h = sqrt(b_val) * scale;
    let l_h = sqrt(l_val) * scale;

    let y = 1.0 - uv.y;
    let aa_w = 0.004;
    var color = vec3<f32>(0.0);

    if (mode == 0u) {
        let l_fill = smoothstep(r_h, r_h - aa_w, y);
        let r_fill = smoothstep(r_h, r_h - aa_w, y);
        let g_fill = smoothstep(g_h, g_h - aa_w, y);
        let b_fill = smoothstep(b_h, b_h - aa_w, y);
        let r_grad = 0.35 + 0.35 * (y / max(r_h, 0.001));
        let g_grad = 0.35 + 0.35 * (y / max(g_h, 0.001));
        let b_grad = 0.35 + 0.35 * (y / max(b_h, 0.001));
        color += vec3<f32>(0.08) * l_fill;
        color += vec3<f32>(r_grad, 0.05, 0.05) * r_fill;
        color += vec3<f32>(0.05, g_grad, 0.05) * g_fill;
        color += vec3<f32>(0.05, 0.05, b_grad) * b_fill;
    } else if (mode == 1u) {
        let fill = smoothstep(r_h, r_h - aa_w, y);
        let grad = 0.3 + 0.5 * (y / max(r_h, 0.001));
        color = vec3<f32>(grad, 0.08, 0.08) * fill;
    } else if (mode == 2u) {
        let fill = smoothstep(g_h, g_h - aa_w, y);
        let grad = 0.3 + 0.5 * (y / max(g_h, 0.001));
        color = vec3<f32>(0.08, grad, 0.08) * fill;
    } else if (mode == 3u) {
        let fill = smoothstep(b_h, b_h - aa_w, y);
        let grad = 0.3 + 0.5 * (y / max(b_h, 0.001));
        color = vec3<f32>(0.08, 0.08, grad) * fill;
    } else {
        let fill = smoothstep(l_h, l_h - aa_w, y);
        let grad = 0.3 + 0.4 * (y / max(l_h, 0.001));
        color = vec3<f32>(grad) * fill;
    }

    let edge_w = 0.006;
    if (mode == 0u) {
        let r_edge = smoothstep(edge_w, 0.0, abs(y - r_h)) * step(y, r_h + edge_w);
        let g_edge = smoothstep(edge_w, 0.0, abs(y - g_h)) * step(y, g_h + edge_w);
        let b_edge = smoothstep(edge_w, 0.0, abs(y - b_h)) * step(y, b_h + edge_w);
        color += vec3<f32>(0.6, 0.12, 0.12) * r_edge;
        color += vec3<f32>(0.12, 0.55, 0.12) * g_edge;
        color += vec3<f32>(0.12, 0.12, 0.6) * b_edge;
    } else if (mode == 1u) {
        let e = smoothstep(edge_w, 0.0, abs(y - r_h)) * step(y, r_h + edge_w);
        color += vec3<f32>(0.7, 0.18, 0.18) * e;
    } else if (mode == 2u) {
        let e = smoothstep(edge_w, 0.0, abs(y - g_h)) * step(y, g_h + edge_w);
        color += vec3<f32>(0.18, 0.65, 0.18) * e;
    } else if (mode == 3u) {
        let e = smoothstep(edge_w, 0.0, abs(y - b_h)) * step(y, b_h + edge_w);
        color += vec3<f32>(0.18, 0.18, 0.7) * e;
    } else {
        let e = smoothstep(edge_w, 0.0, abs(y - l_h)) * step(y, l_h + edge_w);
        color += vec3<f32>(0.6) * e;
    }

    let grid_bins = array<f32, 3>(64.0, 128.0, 192.0);
    for (var i: u32 = 0u; i < 3u; i = i + 1u) {
        let gx = grid_bins[i] / 256.0;
        let g_aa = smoothstep(0.003, 0.001, abs(uv.x - gx));
        color = max(color, vec3<f32>(0.10) * g_aa);
    }
    for (var i: u32 = 1u; i < 4u; i = i + 1u) {
        let gy = f32(i) * 0.25;
        let h_aa = smoothstep(0.004, 0.001, abs(y - gy));
        color = max(color, vec3<f32>(0.07) * h_aa);
    }

    return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
