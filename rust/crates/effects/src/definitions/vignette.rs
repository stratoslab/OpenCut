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
        .unwrap_or(0.5);
    let s2 = uniforms
        .get("u_scalar2")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(0.5);

    EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction: [0.0, 0.0],
        scalars: [s0, s1, s2, 0.0],
        _cg_expansion: [0u8; 480],
    }
}

pub const VIGNETTE: EffectDefinition = EffectDefinition {
    id: "vignette",
    name: "Vignette",
    category: EffectCategory::Color,
    shader_source: include_str!("../shaders/vignette.wgsl"),
    entry_point: "fragment_main",
    uniform_size: std::mem::size_of::<EffectUniformBuffer>(),
    params: &[
        EffectParam {
            name: "u_scalar0",
            label: "Intensity",
            default: 0.0,
            min: 0.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "u_scalar1",
            label: "Radius",
            default: 0.5,
            min: 0.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "u_scalar2",
            label: "Softness",
            default: 0.5,
            min: 0.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
    ],
    pack_uniforms,
};
