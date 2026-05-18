struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct ColorGradeUniforms {
    resolution: vec2f,
    direction: vec2f,
    scalars: vec4f,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> uniforms: ColorGradeUniforms;

fn clamp01(color: vec3f) -> vec3f {
    return clamp(color, vec3f(0.0), vec3f(1.0));
}

fn rgb_to_hsl(c: vec3f) -> vec3f {
    let max_c = max(c.r, max(c.g, c.b));
    let min_c = min(c.r, min(c.g, c.b));
    let l = (max_c + min_c) * 0.5;
    var h = 0.0;
    var s = 0.0;

    if (max_c != min_c) {
        let d = max_c - min_c;
        s = if (l > 0.5) { d / (2.0 - max_c - min_c) } else { d / (max_c + min_c) };

        if (max_c == c.r) {
            h = (c.g - c.b) / d + (if (c.g < c.b) { 6.0 } else { 0.0 });
        } else if (max_c == c.g) {
            h = (c.b - c.r) / d + 2.0;
        } else {
            h = (c.r - c.g) / d + 4.0;
        }
        h /= 6.0;
    }

    return vec3f(h, s, l);
}

fn hsl_to_rgb(hsl: vec3f) -> vec3f {
    let h = hsl.x;
    let s = hsl.y;
    let l = hsl.z;

    if (s == 0.0) {
        return vec3f(l, l, l);
    }

    let q = if (l < 0.5) { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;

    var r = h + 1.0 / 3.0;
    var g = h;
    var b = h - 1.0 / 3.0;

    if (r > 1.0) { r -= 1.0; }
    if (b < 0.0) { b += 1.0; }

    let rgb = vec3f(r, g, b);
    var result = vec3f(0.0);

    for (var i = 0; i < 3; i++) {
        let c = rgb[i];
        let t = if (c < 1.0 / 3.0) { p + (q - p) * 6.0 * c }
                else if (c < 0.5) { q }
                else if (c < 2.0 / 3.0) { p + (q - p) * (2.0 / 3.0 - c) * 6.0 }
                else { p };
        result[i] = t;
    }

    return result;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let rgb = color.rgb;

    // scalars[0] = shadow tint (warm/cool shift)
    // scalars[1] = highlight tint
    // scalars[2] = contrast multiplier
    // scalars[3] = saturation boost

    let shadow_tint = uniforms.scalars.x;
    let highlight_tint = uniforms.scalars.y;
    let contrast = uniforms.scalars.z;
    let saturation = uniforms.scalars.w;

    // Convert to HSL for manipulation
    let hsl = rgb_to_hsl(rgb);

    // Contrast: stretch lightness around 0.5
    let l = (hsl.z - 0.5) * contrast + 0.5;

    // Shadow tint: warm/cool shift in darks
    let shadow_mix = 1.0 - smoothstep(0.0, 0.4, hsl.z);
    let tinted_l = l + shadow_tint * shadow_mix * 0.1;

    // Highlight tint
    let highlight_mix = smoothstep(0.6, 1.0, hsl.z);
    let final_l = tinted_l + highlight_tint * highlight_mix * 0.05;

    // Saturation boost
    let final_s = clamp(hsl.s * (1.0 + saturation), 0.0, 1.0);

    let graded = hsl_to_rgb(vec3f(hsl.x, final_s, clamp(final_l, 0.0, 1.0)));

    return vec4f(clamp01(graded), color.a);
}
