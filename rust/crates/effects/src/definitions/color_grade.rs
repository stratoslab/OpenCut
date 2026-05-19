use std::collections::HashMap;

use crate::{EffectCategory, EffectDefinition, EffectParam, EffectUniformBuffer, UniformValue};

fn pack_uniforms(
    uniforms: &HashMap<String, UniformValue>,
    width: u32,
    height: u32,
) -> EffectUniformBuffer {
    let mut buf = EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction: [0.0, 0.0],
        scalars: [0.0; 4],
        _cg_expansion: [0u8; 480],
    };

    let bytes = bytemuck::bytes_of_mut(&mut buf);

    let get_f32 = |name: &str, default: f32| -> f32 {
        uniforms
            .get(name)
            .and_then(|v| match v {
                UniformValue::Number(n) => Some(*n),
                _ => None,
            })
            .unwrap_or(default)
    };

    let get_i32 = |name: &str, default: i32| -> i32 {
        uniforms
            .get(name)
            .and_then(|v| match v {
                UniformValue::Int(n) => Some(*n),
                UniformValue::Number(n) => Some(*n as i32),
                _ => None,
            })
            .unwrap_or(default)
    };

    let get_vec4 = |name: &str, default: [f32; 4]| -> [f32; 4] {
        uniforms
            .get(name)
            .and_then(|v| match v {
                UniformValue::Vector(v) if v.len() >= 4 => {
                    Some([v[0], v[1], v[2], v[3]])
                }
                _ => None,
            })
            .unwrap_or(default)
    };

    // Write CG expansion fields starting at byte offset 32
    // input_cst (u32) at offset 32
    let input_cst = get_i32("input_cst", 0) as u32;
    bytes[32..36].copy_from_slice(&input_cst.to_le_bytes());
    // input_gamut (u32) at offset 36
    let input_gamut = get_i32("input_gamut", 0) as u32;
    bytes[36..40].copy_from_slice(&input_gamut.to_le_bytes());
    // output_gamut (u32) at offset 40
    let output_gamut = get_i32("output_gamut", 0) as u32;
    bytes[40..44].copy_from_slice(&output_gamut.to_le_bytes());
    // output_cst (u32) at offset 44
    let output_cst = get_i32("output_cst", 0) as u32;
    bytes[44..48].copy_from_slice(&output_cst.to_le_bytes());

    // CDL: slope (vec4f) at offset 48
    let slope = get_vec4("slope", [1.0, 1.0, 1.0, 0.0]);
    bytes[48..64].copy_from_slice(bytemuck::bytes_of(&slope));
    // CDL: offset (vec4f) at offset 64
    let offset = get_vec4("offset", [0.0, 0.0, 0.0, 0.0]);
    bytes[64..80].copy_from_slice(bytemuck::bytes_of(&offset));
    // CDL: power (vec4f) at offset 80
    let power = get_vec4("power", [1.0, 1.0, 1.0, 0.0]);
    bytes[80..96].copy_from_slice(bytemuck::bytes_of(&power));

    // Color wheels: lift (vec4f) at offset 96
    let lift = get_vec4("lift", [0.0, 0.0, 0.0, 0.0]);
    bytes[96..112].copy_from_slice(bytemuck::bytes_of(&lift));
    // Color wheels: gamma (vec4f) at offset 112
    let gamma = get_vec4("gamma", [0.0, 0.0, 0.0, 0.0]);
    bytes[112..128].copy_from_slice(bytemuck::bytes_of(&gamma));
    // Color wheels: gain (vec4f) at offset 128
    let gain = get_vec4("gain", [0.0, 0.0, 0.0, 0.0]);
    bytes[128..144].copy_from_slice(bytemuck::bytes_of(&gain));

    // Qualifier: center (vec4f) at offset 144
    let q_center = get_vec4("qualifier_center", [0.0, 0.5, 0.5, 0.0]);
    bytes[144..160].copy_from_slice(bytemuck::bytes_of(&q_center));
    // Qualifier: width (vec4f) at offset 160
    let q_width = get_vec4("qualifier_width", [0.1, 0.5, 0.5, 0.0]);
    bytes[160..176].copy_from_slice(bytemuck::bytes_of(&q_width));
    // Qualifier: softness (vec4f) at offset 176
    let q_softness = get_vec4("qualifier_softness", [0.1, 0.1, 0.1, 0.0]);
    bytes[176..192].copy_from_slice(bytemuck::bytes_of(&q_softness));

    // Flags (u32) at offset 192
    let flags = get_i32("flags", 0) as u32;
    bytes[192..196].copy_from_slice(&flags.to_le_bytes());
    // primary_mix (f32) at offset 196
    let primary_mix = get_f32("primary_mix", 1.0);
    bytes[196..200].copy_from_slice(&primary_mix.to_le_bytes());
    // wheels_mix (f32) at offset 200
    let wheels_mix = get_f32("wheels_mix", 1.0);
    bytes[200..204].copy_from_slice(&wheels_mix.to_le_bytes());
    // lut_mix (f32) at offset 204
    let lut_mix = get_f32("lut_mix", 0.0);
    bytes[204..208].copy_from_slice(&lut_mix.to_le_bytes());
    // qualifier_mix (f32) at offset 208
    let qualifier_mix = get_f32("qualifier_mix", 1.0);
    bytes[208..212].copy_from_slice(&qualifier_mix.to_le_bytes());
    // highlights (f32) at offset 212
    let highlights = get_f32("highlights", 0.0);
    bytes[212..216].copy_from_slice(&highlights.to_le_bytes());
    // shadows (f32) at offset 216
    let shadows = get_f32("shadows", 0.0);
    bytes[216..220].copy_from_slice(&shadows.to_le_bytes());
    // lut_size (f32) at offset 220
    let lut_size = get_f32("lut_size", 33.0);
    bytes[220..224].copy_from_slice(&lut_size.to_le_bytes());

    // Qualifier CDL: q_slope (vec4f) at offset 224
    let q_slope = get_vec4("q_slope", [1.0, 1.0, 1.0, 0.0]);
    bytes[224..240].copy_from_slice(bytemuck::bytes_of(&q_slope));
    // Qualifier CDL: q_offset (vec4f) at offset 240
    let q_offset = get_vec4("q_offset", [0.0, 0.0, 0.0, 0.0]);
    bytes[240..256].copy_from_slice(bytemuck::bytes_of(&q_offset));
    // Qualifier CDL: q_power (vec4f) at offset 256
    let q_power = get_vec4("q_power", [1.0, 1.0, 1.0, 0.0]);
    bytes[256..272].copy_from_slice(bytemuck::bytes_of(&q_power));
    // Qualifier CDL: q_adjustments (vec4f) at offset 272
    let q_adj = get_vec4("q_adjustments", [1.0, 0.0, 0.0, 0.0]);
    bytes[272..288].copy_from_slice(bytemuck::bytes_of(&q_adj));

    // Power window: window_center_scale (vec4f) at offset 288
    let w_cs = get_vec4("window_center_scale", [0.5, 0.5, 1.0, 1.0]);
    bytes[288..304].copy_from_slice(bytemuck::bytes_of(&w_cs));
    // Power window: window_shape (vec4f) at offset 304
    let w_shape = get_vec4("window_shape", [0.5, 0.5, 0.0, 0.0]);
    bytes[304..320].copy_from_slice(bytemuck::bytes_of(&w_shape));
    // Power window: window_params (vec4f) at offset 320
    let w_params = get_vec4("window_params", [0.0, 0.2, 0.2, 0.0]);
    bytes[320..336].copy_from_slice(bytemuck::bytes_of(&w_params));
    // Power window: w_slope (vec4f) at offset 336
    let w_slope = get_vec4("w_slope", [1.0, 1.0, 1.0, 0.0]);
    bytes[336..352].copy_from_slice(bytemuck::bytes_of(&w_slope));
    // Power window: w_offset (vec4f) at offset 352
    let w_offset = get_vec4("w_offset", [0.0, 0.0, 0.0, 0.0]);
    bytes[352..368].copy_from_slice(bytemuck::bytes_of(&w_offset));
    // Power window: w_power (vec4f) at offset 368
    let w_power = get_vec4("w_power", [1.0, 1.0, 1.0, 0.0]);
    bytes[368..384].copy_from_slice(bytemuck::bytes_of(&w_power));
    // Power window: w_adjustments (vec4f) at offset 384
    let w_adj = get_vec4("w_adjustments", [1.0, 0.0, 0.0, 0.0]);
    bytes[384..400].copy_from_slice(bytemuck::bytes_of(&w_adj));
    // Power window: window_mix (vec4f) at offset 400
    let w_mix = get_vec4("window_mix", [1.0, 0.0, 0.0, 0.0]);
    bytes[400..416].copy_from_slice(bytemuck::bytes_of(&w_mix));

    // Tone mapping: method (u32) at offset 416
    let tm_method = get_i32("tone_mapping_method", 0) as u32;
    bytes[416..420].copy_from_slice(&tm_method.to_le_bytes());
    // Tone mapping: a (f32) at offset 420
    let tm_a = get_f32("tone_mapping_a", 1.016852);
    bytes[420..424].copy_from_slice(&tm_a.to_le_bytes());
    // Tone mapping: b (f32) at offset 424
    let tm_b = get_f32("tone_mapping_b", 0.926852);
    bytes[424..428].copy_from_slice(&tm_b.to_le_bytes());
    // Padding f32 at offset 428
    bytes[428..432].copy_from_slice(&0.0f32.to_le_bytes());

    buf
}

pub const COLOR_GRADE: EffectDefinition = EffectDefinition {
    id: "color-grade",
    name: "Color Grade",
    category: EffectCategory::Color,
    shader_source: include_str!("../shaders/color_grade.wgsl"),
    entry_point: "fragment_main",
    uniform_size: std::mem::size_of::<EffectUniformBuffer>(),
    params: &[
        // Color space
        EffectParam {
            name: "input_cst",
            label: "Input Color Space",
            default: 0.0,
            min: 0.0,
            max: 9.0,
            step: 1.0,
            animatable: false,
        },
        EffectParam {
            name: "output_cst",
            label: "Output Color Space",
            default: 0.0,
            min: 0.0,
            max: 9.0,
            step: 1.0,
            animatable: false,
        },
        EffectParam {
            name: "input_gamut",
            label: "Input Gamut",
            default: 0.0,
            min: 0.0,
            max: 10.0,
            step: 1.0,
            animatable: false,
        },
        EffectParam {
            name: "output_gamut",
            label: "Output Gamut",
            default: 0.0,
            min: 0.0,
            max: 10.0,
            step: 1.0,
            animatable: false,
        },
        // CDL
        EffectParam {
            name: "slope",
            label: "CDL Slope",
            default: 1.0,
            min: 0.0,
            max: 2.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "offset",
            label: "CDL Offset",
            default: 0.0,
            min: -1.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "power",
            label: "CDL Power",
            default: 1.0,
            min: 0.0,
            max: 5.0,
            step: 0.01,
            animatable: true,
        },
        // Color wheels
        EffectParam {
            name: "lift",
            label: "Lift",
            default: 0.0,
            min: -1.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "gamma",
            label: "Gamma",
            default: 0.0,
            min: -1.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "gain",
            label: "Gain",
            default: 0.0,
            min: -1.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        // Tone mapping
        EffectParam {
            name: "tone_mapping_method",
            label: "Tone Mapping Method",
            default: 0.0,
            min: 0.0,
            max: 1.0,
            step: 1.0,
            animatable: false,
        },
        EffectParam {
            name: "tone_mapping_a",
            label: "Tone Mapping A",
            default: 1.016852,
            min: 0.0,
            max: 2.0,
            step: 0.0001,
            animatable: true,
        },
        EffectParam {
            name: "tone_mapping_b",
            label: "Tone Mapping B",
            default: 0.926852,
            min: 0.0,
            max: 2.0,
            step: 0.0001,
            animatable: true,
        },
        // Mix controls
        EffectParam {
            name: "primary_mix",
            label: "Primary Mix",
            default: 1.0,
            min: 0.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "wheels_mix",
            label: "Wheels Mix",
            default: 1.0,
            min: 0.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "lut_mix",
            label: "LUT Mix",
            default: 0.0,
            min: 0.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "lut_size",
            label: "LUT Size",
            default: 33.0,
            min: 2.0,
            max: 65.0,
            step: 1.0,
            animatable: false,
        },
        EffectParam {
            name: "qualifier_mix",
            label: "Qualifier Mix",
            default: 1.0,
            min: 0.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        // Flags
        EffectParam {
            name: "flags",
            label: "Flags",
            default: 0.0,
            min: 0.0,
            max: 65535.0,
            step: 1.0,
            animatable: false,
        },
    ],
    pack_uniforms,
};
