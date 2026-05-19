use std::collections::HashMap;

use bytemuck::{Pod, Zeroable};

use crate::UniformValue;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum EffectCategory {
    Color,
    Blur,
    Distort,
    Stylize,
    Keying,
}

#[derive(Clone, Debug)]
pub struct EffectParam {
    pub name: &'static str,
    pub label: &'static str,
    pub default: f32,
    pub min: f32,
    pub max: f32,
    pub step: f32,
    pub animatable: bool,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct EffectUniformBuffer {
    pub resolution: [f32; 2],
    pub direction: [f32; 2],
    pub scalars: [f32; 4],
    pub _cg_expansion: [u8; 480],
}

pub type PackUniformsFn = fn(&HashMap<String, UniformValue>, u32, u32) -> EffectUniformBuffer;

pub struct EffectDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub category: EffectCategory,
    pub shader_source: &'static str,
    pub entry_point: &'static str,
    pub uniform_size: usize,
    pub params: &'static [EffectParam],
    pub pack_uniforms: PackUniformsFn,
}

pub struct EffectRegistry {
    effects: HashMap<&'static str, &'static EffectDefinition>,
}

impl EffectRegistry {
    pub fn new() -> Self {
        Self {
            effects: HashMap::new(),
        }
    }

    pub fn register(&mut self, definition: &'static EffectDefinition) {
        self.effects.insert(definition.id, definition);
    }

    pub fn get(&self, id: &str) -> Option<&'static EffectDefinition> {
        self.effects.get(id).copied()
    }

    pub fn get_by_category(&self, category: EffectCategory) -> Vec<&'static EffectDefinition> {
        self.effects
            .values()
            .filter(|def| def.category == category)
            .copied()
            .collect()
    }

    pub fn all(&self) -> Vec<&'static EffectDefinition> {
        self.effects.values().copied().collect()
    }

    pub fn contains(&self, id: &str) -> bool {
        self.effects.contains_key(id)
    }
}

impl Default for EffectRegistry {
    fn default() -> Self {
        Self::new()
    }
}
