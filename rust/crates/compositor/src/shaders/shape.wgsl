const PI: f32 = 3.14159265358979323846;

struct ShapeUniforms {
    bbox: vec4f,
    canvas: vec4f,
    fill_color: vec4f,
    stroke_color: vec4f,
    shape_type: u32,
    sides: u32,
    corner_radius: f32,
    stroke_width: f32,
    opacity: f32,
    has_stroke: u32,
    stroke_style: u32,
    _pad1: u32,
    line_start: vec2f,
    line_end: vec2f,
    start_head_type: u32,
    start_head_size: f32,
    end_head_type: u32,
    end_head_size: f32,
    edge_width: f32,
    _pad2: u32,
    _pad3: u32,
    _pad4: u32,
};

@group(0) @binding(0) var<uniform> uniforms: ShapeUniforms;

const SHAPE_ROUNDED_RECT: u32 = 0u;
const SHAPE_ELLIPSE: u32 = 1u;
const SHAPE_POLYGON: u32 = 2u;
const SHAPE_LINE: u32 = 3u;
const SHAPE_ARROW: u32 = 4u;
const SHAPE_CIRCLE: u32 = 5u;
const SHAPE_SQUARE: u32 = 6u;
const SHAPE_DIAMOND: u32 = 7u;

const HEAD_NONE: u32 = 0u;
const HEAD_ARROW: u32 = 1u;
const HEAD_CIRCLE: u32 = 2u;
const HEAD_SQUARE: u32 = 3u;
const HEAD_DIAMOND: u32 = 4u;

const STROKE_SOLID: u32 = 0u;
const STROKE_DASHED: u32 = 1u;
const STROKE_DOTTED: u32 = 2u;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) pixel_pos: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
    var out: VertexOutput;

    var local_positions = array<vec2f, 4>(
        vec2f(0.0, 0.0),
        vec2f(1.0, 0.0),
        vec2f(0.0, 1.0),
        vec2f(1.0, 1.0),
    );

    let local = local_positions[vi];
    let bbox = uniforms.bbox;
    let canvas = uniforms.canvas;

    let pixel_x = bbox.x + local.x * bbox.z;
    let pixel_y = bbox.y + local.y * bbox.w;
    out.pixel_pos = vec2f(pixel_x, pixel_y);

    let clip_x = (pixel_x / canvas.x) * 2.0 - 1.0;
    let clip_y = 1.0 - (pixel_y / canvas.y) * 2.0;
    out.position = vec4f(clip_x, clip_y, 0.0, 1.0);

    return out;
}

fn sdf_rounded_rect(p: vec2f, half_size: vec2f, radius: f32) -> f32 {
    let d = abs(p) - half_size - radius;
    return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0) - radius;
}

fn sdf_ellipse(p: vec2f, ab: vec2f) -> f32 {
    let k0 = length(p / ab);
    let k1 = length(p / (ab * ab));
    return k0 * (k0 - 1.0) / k1;
}

fn sdf_circle(p: vec2f, radius: f32) -> f32 {
    return length(p) - radius;
}

fn sdf_line_segment(p: vec2f, a: vec2f, b: vec2f, thickness: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - thickness;
}

fn sdf_diamond(p: vec2f, size: f32) -> f32 {
    let d = abs(p) / size;
    return (d.x + d.y - 1.0) * size;
}

fn sdf_polygon(p: vec2f, radius: f32, sides: u32) -> f32 {
    let angle = PI / f32(sides);
    let a = atan2(p.y, p.x);
    let r = length(p);
    let sector = fract(a / (2.0 * angle) - 0.5) * 2.0 * angle - angle;
    return r * cos(sector) - radius * cos(angle);
}

fn sdf_square(p: vec2f, size: f32) -> f32 {
    let q = abs(p);
    return max(q.x, q.y) - size * 0.5;
}

fn sdf_triangle(p: vec2f, p0: vec2f, p1: vec2f, p2: vec2f) -> f32 {
    let e0 = p1 - p0;
    let e1 = p2 - p1;
    let e2 = p0 - p2;
    let v0 = p - p0;
    let v1 = p - p1;
    let v2 = p - p2;

    let pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    let pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    let pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);

    let s = sign(e0.x * e2.y - e0.y * e2.x);
    let d = min(min(
        vec2f(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
        vec2f(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
        vec2f(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));

    return -sqrt(d.x) * sign(d.y);
}

fn sdf_arrow_head(p: vec2f, tip: vec2f, dir: vec2f, size: f32) -> f32 {
    let perp = vec2f(-dir.y, dir.x);
    let base = tip - dir * size;
    let left = base + perp * size * 0.5;
    let right = base - perp * size * 0.5;
    return sdf_triangle(p, tip, left, right);
}

fn sdf_head(p: vec2f, center: vec2f, dir: vec2f, head_type: u32, size: f32) -> f32 {
    let local_p = p - center;

    if head_type == HEAD_ARROW {
        return sdf_arrow_head(p, center, dir, size);
    } else if head_type == HEAD_CIRCLE {
        return sdf_circle(local_p, size * 0.5);
    } else if head_type == HEAD_SQUARE {
        let angle = atan2(dir.y, dir.x);
        let c = cos(-angle);
        let s = sin(-angle);
        let rotated = vec2f(local_p.x * c - local_p.y * s, local_p.x * s + local_p.y * c);
        return sdf_square(rotated, size);
    } else if head_type == HEAD_DIAMOND {
        return sdf_diamond(local_p, size);
    }
    return 1e10;
}

fn compute_sdf(pixel_pos: vec2f) -> f32 {
    let bbox = uniforms.bbox;
    let half_size = bbox.zw * 0.5;
    let center = bbox.xy + bbox.zw * 0.5;
    let p = pixel_pos - center;

    let shape_type = uniforms.shape_type;
    let corner_radius = uniforms.corner_radius;
    let stroke_width = uniforms.stroke_width;
    let has_stroke = uniforms.has_stroke;

    let stroke_pad = select(0.0, stroke_width + 1.0, has_stroke == 1u && shape_type != SHAPE_LINE && shape_type != SHAPE_ARROW);
    let shape_half_size = half_size - vec2f(stroke_pad, stroke_pad);

    if shape_type == SHAPE_ROUNDED_RECT {
        return sdf_rounded_rect(p, shape_half_size, corner_radius);
    } else if shape_type == SHAPE_ELLIPSE {
        return sdf_ellipse(p, shape_half_size);
    } else if shape_type == SHAPE_CIRCLE {
        let radius = min(shape_half_size.x, shape_half_size.y);
        return sdf_circle(p, radius);
    } else if shape_type == SHAPE_SQUARE {
        let size = min(shape_half_size.x, shape_half_size.y) * 2.0;
        return sdf_square(p, size);
    } else if shape_type == SHAPE_DIAMOND {
        let size = min(shape_half_size.x, shape_half_size.y) * 2.0;
        return sdf_diamond(p, size);
    } else if shape_type == SHAPE_POLYGON {
        let radius = min(shape_half_size.x, shape_half_size.y);
        let sides = max(uniforms.sides, 3u);
        return sdf_polygon(p, radius, sides);
    } else if shape_type == SHAPE_LINE || shape_type == SHAPE_ARROW {
        let line_start = uniforms.line_start;
        let line_end = uniforms.line_end;
        let line_vec = line_end - line_start;
        let line_len = length(line_vec);
        var line_dir = vec2f(1.0, 0.0);
        if line_len > 0.001 {
            line_dir = line_vec / line_len;
        }

        var adjusted_start = line_start;
        var adjusted_end = line_end;

        let start_head_type = uniforms.start_head_type;
        let start_head_size = uniforms.start_head_size;
        let end_head_type = uniforms.end_head_type;
        let end_head_size = uniforms.end_head_size;

        if start_head_type != HEAD_NONE && start_head_size > 0.0 {
            adjusted_start = line_start + line_dir * start_head_size * 0.3;
        }
        if end_head_type != HEAD_NONE && end_head_size > 0.0 {
            adjusted_end = line_end - line_dir * end_head_size * 0.3;
        }

        var d = sdf_line_segment(pixel_pos, adjusted_start, adjusted_end, stroke_width * 0.5);

        let stroke_style_u = uniforms.stroke_style;
        if stroke_style_u != STROKE_SOLID && line_len > 0.001 {
            let pa = pixel_pos - adjusted_start;
            let ba = adjusted_end - adjusted_start;
            let t_along = dot(pa, ba) / dot(ba, ba);
            let dist_along = t_along * length(ba);

            if stroke_style_u == STROKE_DASHED {
                let dash_len = stroke_width * 4.0;
                let gap_len = stroke_width * 3.0;
                let period = dash_len + gap_len;
                let phase = dist_along % period;
                if phase > dash_len {
                    d = max(d, 0.5);
                }
            } else if stroke_style_u == STROKE_DOTTED {
                let spacing = stroke_width * 3.0;
                let phase = dist_along % spacing;
                let dot_center = spacing * 0.5;
                let dot_dist = abs(phase - dot_center);
                if dot_dist > stroke_width * 0.5 {
                    d = max(d, 0.5);
                }
            }
        }

        if start_head_type != HEAD_NONE && start_head_size > 0.0 {
            let head_d = sdf_head(pixel_pos, line_start, -line_dir, start_head_type, start_head_size);
            d = min(d, head_d);
        }

        if end_head_type != HEAD_NONE && end_head_size > 0.0 {
            let head_d = sdf_head(pixel_pos, line_end, line_dir, end_head_type, end_head_size);
            d = min(d, head_d);
        }

        if shape_type == SHAPE_ARROW {
            let arrow_size = max(start_head_size, end_head_size);
            if arrow_size > 0.0 && end_head_type == HEAD_NONE {
                let head_d = sdf_arrow_head(pixel_pos, line_end, line_dir, max(arrow_size, stroke_width * 3.0));
                d = min(d, head_d);
            }
        }

        return d;
    }

    return sdf_rounded_rect(p, shape_half_size, corner_radius);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    let fill_color = uniforms.fill_color;
    let stroke_color = uniforms.stroke_color;
    let has_stroke = uniforms.has_stroke;
    let stroke_width = uniforms.stroke_width;
    let opacity = uniforms.opacity;
    let edge_width = uniforms.edge_width;
    let shape_type = uniforms.shape_type;

    let d = compute_sdf(in.pixel_pos);

    if has_stroke == 1u && stroke_width > 0.0 && shape_type != SHAPE_LINE && shape_type != SHAPE_ARROW {
        let fill_d = d + stroke_width;
        let inner_coverage = 1.0 - smoothstep(-edge_width, edge_width, fill_d);
        let outer_coverage = 1.0 - smoothstep(-edge_width, edge_width, d);
        let stroke_coverage = outer_coverage - inner_coverage;
        let fill_alpha = inner_coverage * fill_color.a * opacity;
        let stroke_alpha = stroke_coverage * stroke_color.a * opacity;

        let total_alpha = fill_alpha + max(stroke_alpha, 0.0);
        if total_alpha < 0.001 {
            discard;
        }

        var color = fill_color.rgb * fill_alpha;
        if stroke_alpha > 0.001 {
            color = color + stroke_color.rgb * stroke_alpha;
        }
        return vec4f(color / total_alpha, total_alpha);
    }

    let alpha = (1.0 - smoothstep(-edge_width, edge_width, d)) * fill_color.a * opacity;

    if alpha < 0.001 {
        discard;
    }

    return vec4f(fill_color.rgb, alpha);
}
