use std::collections::HashMap;

use crate::{EffectCategory, EffectDefinition, EffectParam, EffectUniformBuffer, UniformValue};

fn pack_uniforms(
    uniforms: &HashMap<String, UniformValue>,
    width: u32,
    height: u32,
) -> EffectUniformBuffer {
    let sigma = uniforms
        .get("u_sigma")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(1.0);
    let step = uniforms
        .get("u_step")
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(1.0);
    let direction = uniforms
        .get("u_direction")
        .and_then(|v| match v {
            UniformValue::Vector(vals) if vals.len() == 2 => Some([vals[0], vals[1]]),
            _ => None,
        })
        .unwrap_or([1.0, 0.0]);

    EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction,
        scalars: [sigma, step, 0.0, 0.0],
        _cg_expansion: [0u8; 480],
    }
}

pub const GAUSSIAN_BLUR: EffectDefinition = EffectDefinition {
    id: "gaussian-blur",
    name: "Gaussian Blur",
    category: EffectCategory::Blur,
    shader_source: include_str!("../shaders/gaussian_blur.wgsl"),
    entry_point: "fragment_main",
    uniform_size: std::mem::size_of::<EffectUniformBuffer>(),
    params: &[
        EffectParam {
            name: "u_sigma",
            label: "Sigma",
            default: 1.0,
            min: 0.1,
            max: 10.0,
            step: 0.1,
            animatable: true,
        },
        EffectParam {
            name: "u_step",
            label: "Step",
            default: 1.0,
            min: 0.5,
            max: 5.0,
            step: 0.5,
            animatable: true,
        },
        EffectParam {
            name: "u_direction",
            label: "Direction",
            default: 1.0,
            min: 0.0,
            max: 1.0,
            step: 1.0,
            animatable: false,
        },
    ],
    pack_uniforms,
};
