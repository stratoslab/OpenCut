use std::collections::HashMap;

use crate::{EffectCategory, EffectDefinition, EffectParam, EffectUniformBuffer, UniformValue};

fn pack_uniforms(
    uniforms: &HashMap<String, UniformValue>,
    width: u32,
    height: u32,
) -> EffectUniformBuffer {
    let intensity = uniforms
        .get("u_intensity")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(0.0);
    let monochrome = uniforms
        .get("u_monochrome")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(0.0);
    let frame = uniforms
        .get("u_frame")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(0.0);

    EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction: [frame, 0.0],
        scalars: [intensity, monochrome, 0.0, 0.0],
        _cg_expansion: [0u8; 480],
    }
}

pub const NOISE: EffectDefinition = EffectDefinition {
    id: "noise",
    name: "Noise",
    category: EffectCategory::Stylize,
    shader_source: include_str!("../shaders/noise.wgsl"),
    entry_point: "fragment_main",
    uniform_size: std::mem::size_of::<EffectUniformBuffer>(),
    params: &[
        EffectParam {
            name: "u_intensity",
            label: "Intensity",
            default: 0.0,
            min: 0.0,
            max: 1.0,
            step: 0.01,
            animatable: true,
        },
        EffectParam {
            name: "u_monochrome",
            label: "Monochrome",
            default: 0.0,
            min: 0.0,
            max: 1.0,
            step: 1.0,
            animatable: true,
        },
        EffectParam {
            name: "u_frame",
            label: "Frame",
            default: 0.0,
            min: 0.0,
            max: 10000.0,
            step: 1.0,
            animatable: true,
        },
    ],
    pack_uniforms,
};
