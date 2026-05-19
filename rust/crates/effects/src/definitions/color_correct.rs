use std::collections::HashMap;

use crate::{EffectCategory, EffectDefinition, EffectParam, EffectUniformBuffer, UniformValue};

fn pack_uniforms(
    uniforms: &HashMap<String, UniformValue>,
    width: u32,
    height: u32,
) -> EffectUniformBuffer {
    let s0 = uniforms
        .get("u_scalar0")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(0.0);
    let s1 = uniforms
        .get("u_scalar1")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(0.0);
    let s2 = uniforms
        .get("u_scalar2")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(0.0);
    let s3 = uniforms
        .get("u_scalar3")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(0.0);

    EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction: [0.0, 0.0],
        scalars: [s0, s1, s2, s3],
        _cg_expansion: [0u8; 480],
    }
}

pub const COLOR_CORRECT: EffectDefinition = EffectDefinition {
    id: "color-correct",
    name: "Color Correct",
    category: EffectCategory::Color,
    shader_source: include_str!("../shaders/color_correct.wgsl"),
    entry_point: "fragment_main",
    uniform_size: std::mem::size_of::<EffectUniformBuffer>(),
    params: &[
        EffectParam {
            name: "u_scalar0",
            label: "Brightness",
            default: 0.0,
            min: -1.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "u_scalar1",
            label: "Contrast",
            default: 0.0,
            min: -1.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "u_scalar2",
            label: "Saturation",
            default: 1.0,
            min: 0.0,
            max: 2.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "u_scalar3",
            label: "Temperature",
            default: 0.0,
            min: -1.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
    ],
    pack_uniforms,
};
