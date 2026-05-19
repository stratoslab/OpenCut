struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct ColorGradingUniforms {
    // Standard fields (offset 0-31)
    resolution: vec2f,
    direction: vec2f,
    scalars: vec4f,

    // Color space & gamut (offset 32-47)
    input_cst: u32,
    input_gamut: u32,
    output_gamut: u32,
    output_cst: u32,

    // CDL (offset 48-95)
    slope: vec4f,
    offset: vec4f,
    power: vec4f,

    // Color wheels (offset 96-143)
    lift: vec4f,
    gamma: vec4f,
    gain: vec4f,

    // Qualifier (offset 144-191)
    qualifier_center: vec4f,
    qualifier_width: vec4f,
    qualifier_softness: vec4f,

    // Flags & mix (offset 192-223)
    flags: u32,
    primary_mix: f32,
    wheels_mix: f32,
    lut_mix: f32,
    qualifier_mix: f32,
    highlights: f32,
    shadows: f32,
    lut_size: f32,

    // Qualifier CDL (offset 224-287)
    q_slope: vec4f,
    q_offset: vec4f,
    q_power: vec4f,
    q_adjustments: vec4f,

    // Power window (offset 288-415)
    window_center_scale: vec4f,
    window_shape: vec4f,
    window_params: vec4f,
    w_slope: vec4f,
    w_offset: vec4f,
    w_power: vec4f,
    w_adjustments: vec4f,
    window_mix: vec4f,

    // Tone mapping (offset 416-431)
    tone_mapping_method: u32,
    tone_mapping_a: f32,
    tone_mapping_b: f32,
    _pad_tone: f32,

    // Padding to 512 bytes (offset 432-511)
    _pad: array<vec4f, 5>,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(0) @binding(2) var t_lut_3d: texture_3d<f32>;
@group(1) @binding(0) var<uniform> uniforms: ColorGradingUniforms;

// ============================================================================
// Color Space Constants
// ============================================================================

const CS_SRGB: u32 = 0u;
const CS_LINEAR: u32 = 1u;
const CS_ACES_CG: u32 = 2u;
const CS_LOGC: u32 = 3u;
const CS_SLOG2: u32 = 4u;
const CS_SLOG3: u32 = 5u;
const CS_CLOG3: u32 = 6u;
const CS_VLOG: u32 = 7u;
const CS_BM_FILM: u32 = 8u;
const CS_RED_LOG3G10: u32 = 9u;

// ============================================================================
// Gamut Constants
// ============================================================================

const GAMUT_REC709: u32 = 0u;
const GAMUT_SGAMUT: u32 = 1u;
const GAMUT_SGAMUT3: u32 = 2u;
const GAMUT_SGAMUT3_CINE: u32 = 3u;
const GAMUT_ARRI_WIDE: u32 = 4u;
const GAMUT_ACES_AP1: u32 = 5u;
const GAMUT_RED_WIDE: u32 = 6u;
const GAMUT_DCI_P3: u32 = 7u;
const GAMUT_REC2020: u32 = 8u;
const GAMUT_VGAMUT: u32 = 9u;
const GAMUT_BMD_WIDE: u32 = 10u;

// ============================================================================
// Tone Mapping Constants
// ============================================================================

const TM_NONE: u32 = 0u;
const TM_SIMPLE: u32 = 1u;

// ============================================================================
// Flag Constants
// ============================================================================

const FLAG_BYPASS: u32 = 1u;
const FLAG_PRIMARY_ENABLED: u32 = 2u;
const FLAG_WHEELS_ENABLED: u32 = 4u;
const FLAG_LUT_ENABLED: u32 = 16u;
const FLAG_QUALIFIER_ENABLED: u32 = 32u;
const FLAG_WINDOW_ENABLED: u32 = 64u;
const FLAG_INPUT_CST: u32 = 128u;
const FLAG_OUTPUT_CST: u32 = 256u;
const FLAG_INPUT_GAMUT: u32 = 512u;
const FLAG_OUTPUT_GAMUT: u32 = 1024u;

// ============================================================================
// Color Space Transforms (CST)
// ============================================================================

fn srgb_to_linear(srgb: vec3f) -> vec3f {
    let cutoff = vec3f(0.04045);
    let linear_low = srgb / 12.92;
    let linear_high = pow((srgb + 0.055) / 1.055, vec3f(2.4));
    return select(linear_low, linear_high, srgb > cutoff);
}

fn linear_to_srgb(linear: vec3f) -> vec3f {
    let cutoff = vec3f(0.0031308);
    let srgb_low = linear * 12.92;
    let srgb_high = 1.055 * pow(linear, vec3f(1.0 / 2.4)) - 0.055;
    return select(srgb_low, srgb_high, linear > cutoff);
}

fn slog2_to_linear(slog: vec3f) -> vec3f {
    let x = (slog * 1023.0 - 64.0) / 876.0;
    let threshold = vec3f(0.088251);
    let linear_low = (x - 0.030001222851889303) / 5.0;
    let linear_high = pow(vec3f(10.0), (x - 0.616596 - 0.03) / 0.432699) - 0.037584;
    let slog_linear = select(linear_low, linear_high, slog >= threshold);
    return slog_linear * 1.2716129032;
}

fn linear_to_slog2(linear: vec3f) -> vec3f {
    let x = linear / 1.2716129032;
    let slog_low = x * 5.0 + 0.030001222851889303;
    let slog_high = 0.432699 * log(x + 0.037584) / log(10.0) + 0.616596 + 0.03;
    let full = select(slog_low, slog_high, x >= vec3f(0.0));
    return (full * 876.0 + 64.0) / 1023.0;
}

fn logc_to_linear(logc: vec3f) -> vec3f {
    let a = 5.555556;
    let b = 0.052272;
    let c = 0.24719;
    let d = 0.385537;
    let e_val = 5.367655;
    let f = 0.092809;
    let breakpoint = vec3f(0.1496578);
    let linear_low = (logc - f) / e_val;
    let linear_high = (pow(vec3f(10.0), (logc - d) / c) - b) / a;
    return select(linear_low, linear_high, logc > breakpoint);
}

fn linear_to_logc(linear: vec3f) -> vec3f {
    let a = 5.555556;
    let b = 0.052272;
    let c = 0.24719;
    let d = 0.385537;
    let e_val = 5.367655;
    let f = 0.092809;
    let cut = vec3f(0.010591);
    let logc_low = e_val * linear + f;
    let logc_high = c * log(a * linear + b) / log(10.0) + d;
    return select(logc_low, logc_high, linear > cut);
}

fn slog3_to_linear(slog: vec3f) -> vec3f {
    let threshold = vec3f(171.2102946929 / 1023.0);
    let linear_low = (slog * 1023.0 - 95.0) * 0.01125000 / (171.2102946929 - 95.0);
    let linear_high = pow(vec3f(10.0), (slog * 1023.0 - 420.0) / 261.5) * 0.19 - 0.01;
    return select(linear_low, linear_high, slog >= threshold);
}

fn linear_to_slog3(linear: vec3f) -> vec3f {
    let cut = vec3f(0.01125000);
    let slog_low = (linear / 0.01125000 * (171.2102946929 - 95.0) + 95.0) / 1023.0;
    let slog_high = (420.0 + log((linear + 0.01) / 0.19) / log(10.0) * 261.5) / 1023.0;
    return select(slog_low, slog_high, linear >= cut);
}

fn clog3_to_linear(clog: vec3f) -> vec3f {
    let cut = 0.097465473;
    let linear_low = (clog - 0.073059361) / 5.0;
    let linear_high = (pow(vec3f(10.0), (clog - 0.449369) / 0.42889912) - 1.0) * 0.08;
    return select(linear_low, linear_high, clog > vec3f(cut));
}

fn linear_to_clog3(linear: vec3f) -> vec3f {
    let cut = 0.014;
    let clog_low = linear * 5.0 + 0.073059361;
    let clog_high = 0.42889912 * log(linear / 0.08 + 1.0) / log(10.0) + 0.449369;
    return select(clog_low, clog_high, linear > vec3f(cut));
}

fn vlog_to_linear(vlog: vec3f) -> vec3f {
    let cut_in = 0.181;
    let linear_low = (vlog - 0.125) / 5.6;
    let linear_high = pow(vec3f(10.0), (vlog - 0.598206) / 0.241514) - 0.00873;
    return select(linear_low, linear_high, vlog >= vec3f(cut_in));
}

fn linear_to_vlog(linear: vec3f) -> vec3f {
    let cut = 0.01;
    let vlog_low = linear * 5.6 + 0.125;
    let vlog_high = 0.241514 * log(linear + 0.00873) / log(10.0) + 0.598206;
    return select(vlog_low, vlog_high, linear >= vec3f(cut));
}

fn to_linear(color: vec3f, cs: u32) -> vec3f {
    switch cs {
        case 0u: { return srgb_to_linear(color); }
        case 1u: { return color; }
        case 2u: { return color; }
        case 3u: { return logc_to_linear(color); }
        case 4u: { return slog2_to_linear(color); }
        case 5u: { return slog3_to_linear(color); }
        case 6u: { return clog3_to_linear(color); }
        case 7u: { return vlog_to_linear(color); }
        case 8u: { return logc_to_linear(color); }
        case 9u: { return slog3_to_linear(color); }
        default: { return srgb_to_linear(color); }
    }
}

fn from_linear(color: vec3f, cs: u32) -> vec3f {
    switch cs {
        case 0u: { return linear_to_srgb(color); }
        case 1u: { return color; }
        case 2u: { return color; }
        case 3u: { return linear_to_logc(color); }
        case 4u: { return linear_to_slog2(color); }
        case 5u: { return linear_to_slog3(color); }
        case 6u: { return linear_to_clog3(color); }
        case 7u: { return linear_to_vlog(color); }
        case 8u: { return linear_to_logc(color); }
        case 9u: { return linear_to_slog3(color); }
        default: { return linear_to_srgb(color); }
    }
}

// ============================================================================
// Gamut Conversion (Color Primaries)
// ============================================================================

fn gamut_to_rec709(color: vec3f, gamut: u32) -> vec3f {
    switch gamut {
        case 0u: { return color; }
        case 1u, 2u: {
            return mat3x3f(
                vec3f( 1.8775895, -0.1768085, -0.0262071),
                vec3f(-0.7940379,  1.3510232, -0.1484570),
                vec3f(-0.0837210, -0.1741716,  1.1747362)
            ) * color;
        }
        case 3u: {
            return mat3x3f(
                vec3f( 1.6266602, -0.1785165, -0.0444460),
                vec3f(-0.5400464,  1.4179576, -0.1959648),
                vec3f(-0.0867831, -0.2393980,  1.2404829)
            ) * color;
        }
        case 4u: {
            return mat3x3f(
                vec3f( 1.6172660, -0.0705744, -0.0211068),
                vec3f(-0.5372011,  1.3346439, -0.2270083),
                vec3f(-0.0802240, -0.2640464,  1.2483551)
            ) * color;
        }
        case 5u: {
            return mat3x3f(
                vec3f( 1.7309784, -0.1316220, -0.0245741),
                vec3f(-0.6039470,  1.1348678, -0.1257806),
                vec3f(-0.0800949, -0.0086797,  1.0658927)
            ) * color;
        }
        case 6u: {
            return mat3x3f(
                vec3f( 1.9816606, -0.1781473, -0.1018204),
                vec3f(-0.9002885,  1.5005030, -0.5353919),
                vec3f(-0.0815312, -0.3223326,  1.6374523)
            ) * color;
        }
        case 7u: {
            return mat3x3f(
                vec3f( 1.2247450, -0.0420578, -0.0196423),
                vec3f(-0.2249043,  1.0420810, -0.0786549),
                vec3f( 0.0000001, -0.0000001,  1.0985372)
            ) * color;
        }
        case 8u: {
            return mat3x3f(
                vec3f( 1.6602266, -0.1245533, -0.0181551),
                vec3f(-0.5875477,  1.1329261, -0.1006030),
                vec3f(-0.0728382, -0.0083497,  1.1189982)
            ) * color;
        }
        case 9u: {
            return mat3x3f(
                vec3f( 1.8062884, -0.1700943, -0.0252119),
                vec3f(-0.6955865,  1.3059854, -0.1545054),
                vec3f(-0.1108609, -0.1358680,  1.1799572)
            ) * color;
        }
        case 10u: {
            return mat3x3f(
                vec3f( 1.5683008, -0.0863812, -0.0520228),
                vec3f(-0.5227529,  1.3449488, -0.2491763),
                vec3f(-0.0457070, -0.2585445,  1.3014390)
            ) * color;
        }
        default: { return color; }
    }
}

fn rec709_to_gamut(color: vec3f, gamut: u32) -> vec3f {
    switch gamut {
        case 0u: { return color; }
        case 1u, 2u: {
            return mat3x3f(
                vec3f( 0.5661472,  0.0769741,  0.0223577),
                vec3f( 0.3427600,  0.7990405,  0.1086252),
                vec3f( 0.0911672,  0.1239551,  0.8689536)
            ) * color;
        }
        case 3u: {
            return mat3x3f(
                vec3f( 0.6457935,  0.0875449,  0.0369684),
                vec3f( 0.2591131,  0.7596906,  0.1292957),
                vec3f( 0.0951848,  0.1527355,  0.8336765)
            ) * color;
        }
        case 4u: {
            return mat3x3f(
                vec3f( 0.6314215,  0.0368258,  0.0173725),
                vec3f( 0.2707945,  0.7930187,  0.1487858),
                vec3f( 0.0978548,  0.1701023,  0.8336410)
            ) * color;
        }
        case 5u: {
            return mat3x3f(
                vec3f( 0.6032028,  0.0701291,  0.0221824),
                vec3f( 0.3263270,  0.9198951,  0.1160756),
                vec3f( 0.0479841,  0.0127606,  0.9407928)
            ) * color;
        }
        case 6u: {
            return mat3x3f(
                vec3f( 0.5420324,  0.0770016,  0.0588817),
                vec3f( 0.3601398,  0.7679506,  0.2734883),
                vec3f( 0.0978822,  0.1550052,  0.6674728)
            ) * color;
        }
        case 7u: {
            return mat3x3f(
                vec3f( 0.8225930,  0.0331994,  0.0170854),
                vec3f( 0.1775339,  0.9667835,  0.0723957),
                vec3f( 0.0000000,  0.0000000,  0.9103014)
            ) * color;
        }
        case 8u: {
            return mat3x3f(
                vec3f( 0.6275038,  0.0691083,  0.0163941),
                vec3f( 0.3292755,  0.9195191,  0.0880113),
                vec3f( 0.0433026,  0.0113596,  0.8953803)
            ) * color;
        }
        case 9u: {
            return mat3x3f(
                vec3f( 0.5852893,  0.0786011,  0.0227979),
                vec3f( 0.3226342,  0.8196082,  0.1142144),
                vec3f( 0.0921401,  0.1017599,  0.8627817)
            ) * color;
        }
        case 10u: {
            return mat3x3f(
                vec3f( 0.6549678,  0.0488989,  0.0355435),
                vec3f( 0.2687242,  0.7919967,  0.1623791),
                vec3f( 0.0763876,  0.1590558,  0.8018868)
            ) * color;
        }
        default: { return color; }
    }
}

// ============================================================================
// Tone Mapping
// ============================================================================

fn apply_tone_mapping(color: vec3f) -> vec3f {
    if (uniforms.tone_mapping_method == TM_NONE) { return color; }

    let a = uniforms.tone_mapping_a;
    let b = uniforms.tone_mapping_b;

    let c = max(color, vec3f(0.0));

    return vec3f(
        a * c.x / (c.x + b),
        a * c.y / (c.y + b),
        a * c.z / (c.z + b)
    );
}

// ============================================================================
// Color Grading Core Functions
// ============================================================================

fn cg_luminance(rgb: vec3f) -> f32 {
    return dot(rgb, vec3f(0.2126, 0.7152, 0.0722));
}

// ASC-CDL: output = (input * slope + offset) ^ power
fn apply_cdl(color: vec3f, slope: vec3f, offset: vec3f, power: vec3f) -> vec3f {
    return pow(max(color * slope + offset, vec3f(0.0)), power);
}

fn apply_primary_correction(color: vec3f) -> vec3f {
    var result = apply_cdl(color, uniforms.slope.xyz, uniforms.offset.xyz, uniforms.power.xyz);

    // Temperature
    let t = uniforms.scalars.z * 0.01;
    result = result * vec3f(1.0 + t * 0.1, 1.0, 1.0 - t * 0.1);

    // Tint
    let tint = uniforms.scalars.w;
    if (tint > 0.0) {
        result = result * vec3f(1.0 + tint * 0.1, 1.0, 1.0);
    } else {
        result = result * vec3f(1.0, 1.0 + abs(tint) * 0.1, 1.0);
    }

    // Saturation
    let lum = cg_luminance(result);
    result = mix(vec3f(lum), result, uniforms.scalars.x);

    // Highlights
    if (abs(uniforms.highlights) > 0.001) {
        let lum_hi = cg_luminance(result);
        let hi_weight = smoothstep(0.3, 1.0, lum_hi);
        result = result * (1.0 + uniforms.highlights * hi_weight);
    }

    // Shadows
    if (abs(uniforms.shadows) > 0.001) {
        let lum_sh = cg_luminance(result);
        let sh_weight = 1.0 - smoothstep(0.0, 0.5, lum_sh);
        result = result + uniforms.shadows * sh_weight * 0.5;
    }

    return mix(color, result, uniforms.primary_mix);
}

fn apply_lift_gamma_gain(color: vec3f) -> vec3f {
    var result = color;

    // Lift (shadows)
    let lift_color = uniforms.lift.xyz + uniforms.lift.w;
    result = result + lift_color * (1.0 - result) * 0.5;

    // Gamma (midtones)
    let gamma_factor = 1.0 / max(1.0 + uniforms.gamma.xyz + uniforms.gamma.w, vec3f(0.01));
    result = pow(max(result, vec3f(0.0)), gamma_factor);

    // Gain (highlights)
    let gain_factor = 1.0 + uniforms.gain.xyz + uniforms.gain.w;
    result = result * gain_factor;

    return mix(color, result, uniforms.wheels_mix);
}

// ============================================================================
// HSL Qualifier
// ============================================================================

fn rgb_to_hsl(rgb: vec3f) -> vec3f {
    let max_c = max(max(rgb.r, rgb.g), rgb.b);
    let min_c = min(min(rgb.r, rgb.g), rgb.b);
    let delta = max_c - min_c;
    let l = (max_c + min_c) * 0.5;

    if (delta < 0.00001) {
        return vec3f(0.0, 0.0, l);
    }

    let s = select(delta / (2.0 - max_c - min_c), delta / (max_c + min_c), l < 0.5);

    var h: f32;
    if (max_c == rgb.r) {
        h = (rgb.g - rgb.b) / delta + select(0.0, 6.0, rgb.g < rgb.b);
    } else if (max_c == rgb.g) {
        h = (rgb.b - rgb.r) / delta + 2.0;
    } else {
        h = (rgb.r - rgb.g) / delta + 4.0;
    }
    h /= 6.0;

    return vec3f(h, s, l);
}

fn hsl_qualifier_mask(hsl: vec3f) -> f32 {
    var hue_diff = abs(hsl.x - uniforms.qualifier_center.x);
    hue_diff = min(hue_diff, 1.0 - hue_diff);
    let sat_diff = abs(hsl.y - uniforms.qualifier_center.y);
    let lum_diff = abs(hsl.z - uniforms.qualifier_center.z);

    let hue_inner = uniforms.qualifier_width.x * (1.0 - uniforms.qualifier_softness.x);
    let hue_mask = 1.0 - smoothstep(hue_inner, uniforms.qualifier_width.x, hue_diff);
    let sat_inner = uniforms.qualifier_width.y * (1.0 - uniforms.qualifier_softness.y);
    let sat_mask = 1.0 - smoothstep(sat_inner, uniforms.qualifier_width.y, sat_diff);
    let lum_inner = uniforms.qualifier_width.z * (1.0 - uniforms.qualifier_softness.z);
    let lum_mask = 1.0 - smoothstep(lum_inner, uniforms.qualifier_width.z, lum_diff);

    var mask = hue_mask * sat_mask * lum_mask;
    if (uniforms.qualifier_softness.w > 0.5) {
        mask = 1.0 - mask;
    }
    return mask;
}

fn apply_qualifier(color: vec3f) -> vec3f {
    let hsl = rgb_to_hsl(color);
    let mask = hsl_qualifier_mask(hsl);

    var corrected = apply_cdl(color, uniforms.q_slope.xyz, uniforms.q_offset.xyz, uniforms.q_power.xyz);
    corrected = corrected * pow(2.0, uniforms.q_adjustments.y);
    let lum_q = cg_luminance(corrected);
    corrected = mix(vec3f(lum_q), corrected, uniforms.q_adjustments.x);

    let outside = mix(vec3f(cg_luminance(color)), color, 0.3);
    return mix(outside, corrected, mask * uniforms.qualifier_mix);
}

// ============================================================================
// Power Window
// ============================================================================

fn power_window_mask(uv: vec2f) -> f32 {
    let center = uniforms.window_center_scale.xy;
    let scale = uniforms.window_center_scale.zw;
    let rotation = uniforms.window_params.x * 6.28318530718;
    let softness_inner = uniforms.window_params.y;
    let softness_outer = uniforms.window_params.z;
    let invert_flag = uniforms.window_params.w;
    let shape_type = uniforms.window_shape.w;

    var p = uv - center;
    let cos_r = cos(rotation);
    let sin_r = sin(rotation);
    p = vec2f(p.x * cos_r + p.y * sin_r, -p.x * sin_r + p.y * cos_r);
    p = p / max(scale, vec2f(0.001));

    var dist: f32;
    if (shape_type < 0.5) {
        let r = uniforms.window_shape.xy;
        let d = p / max(r, vec2f(0.001));
        dist = length(d);
    } else if (shape_type < 1.5) {
        let half_size = uniforms.window_shape.xy * 0.5;
        let corner = uniforms.window_shape.z;
        let d = abs(p) - half_size + corner;
        dist = (length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0) - corner)
            / max(min(half_size.x, half_size.y), 0.001) + 1.0;
    } else {
        let angle = uniforms.window_shape.x * 6.28318530718;
        let dir = vec2f(cos(angle), sin(angle));
        dist = dot(p, dir) + 0.5;
    }

    let edge_start = 1.0 - softness_inner;
    let edge_end = 1.0 + softness_outer;
    var mask = 1.0 - smoothstep(edge_start, edge_end, dist);

    if (invert_flag > 0.5) {
        mask = 1.0 - mask;
    }
    return mask;
}

fn apply_window(color: vec3f, uv: vec2f) -> vec3f {
    let mask = power_window_mask(uv);
    if (mask < 0.001) {
        return color;
    }

    var corrected = apply_cdl(color, uniforms.w_slope.xyz, uniforms.w_offset.xyz, uniforms.w_power.xyz);
    corrected = corrected * pow(2.0, uniforms.w_adjustments.y);
    let lum_w = cg_luminance(corrected);
    corrected = mix(vec3f(lum_w), corrected, uniforms.w_adjustments.x);

    return mix(color, corrected, mask * uniforms.window_mix.x);
}

// ============================================================================
// 3D LUT
// ============================================================================

fn apply_lut(color: vec3f) -> vec3f {
    let lut_size = uniforms.lut_size;
    let half_texel = 0.5 / lut_size;
    let scale = (lut_size - 1.0) / lut_size;
    let lut_coord = clamp(color, vec3f(0.0), vec3f(1.0)) * scale + half_texel;
    let lut_color = textureSampleLevel(t_lut_3d, input_sampler, lut_coord, 0.0).rgb;
    return mix(color, lut_color, uniforms.lut_mix);
}

// ============================================================================
// Combined Color Grading Pipeline
// ============================================================================

fn apply_color_grading(color: vec3f, uv: vec2f) -> vec3f {
    if ((uniforms.flags & FLAG_BYPASS) != 0u) {
        return color;
    }

    var result = color;

    // Step 1: Input CST - convert from source color space to linear
    if ((uniforms.flags & FLAG_INPUT_CST) != 0u) {
        result = to_linear(result, uniforms.input_cst);
    }

    // Step 2: Input gamut - convert from source primaries to Rec.709
    if ((uniforms.flags & FLAG_INPUT_GAMUT) != 0u) {
        result = gamut_to_rec709(result, uniforms.input_gamut);
    }

    // Step 3: Tone mapping - compress dynamic range for display
    result = apply_tone_mapping(result);

    // Step 4: Primary correction (ASC-CDL)
    if ((uniforms.flags & FLAG_PRIMARY_ENABLED) != 0u) {
        result = apply_primary_correction(result);
    }

    // Step 5: Color wheels (lift/gamma/gain)
    if ((uniforms.flags & FLAG_WHEELS_ENABLED) != 0u) {
        result = apply_lift_gamma_gain(result);
    }

    // Step 6: 3D LUT
    if ((uniforms.flags & FLAG_LUT_ENABLED) != 0u) {
        result = apply_lut(result);
    }

    // Step 7: HSL qualifier (secondary correction)
    if ((uniforms.flags & FLAG_QUALIFIER_ENABLED) != 0u) {
        result = apply_qualifier(result);
    }

    // Step 8: Power window (regional correction)
    if ((uniforms.flags & FLAG_WINDOW_ENABLED) != 0u) {
        result = apply_window(result, uv);
    }

    // Step 9: Output gamut - convert from Rec.709 to target primaries
    if ((uniforms.flags & FLAG_OUTPUT_GAMUT) != 0u) {
        result = rec709_to_gamut(result, uniforms.output_gamut);
    }

    // Step 10: Output CST - convert from linear to output color space
    if ((uniforms.flags & FLAG_OUTPUT_CST) != 0u) {
        result = from_linear(result, uniforms.output_cst);
    }

    return clamp(result, vec3f(0.0), vec3f(1.0));
}

// ============================================================================
// Fragment Entry Point
// ============================================================================

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(input_texture, input_sampler, input.tex_coord);

    let graded = apply_color_grading(color.rgb, input.tex_coord);

    return vec4f(graded, color.a);
}
