use std::collections::HashMap;

use gpu::wgpu;

pub struct BindGroupCache {
    cache: HashMap<String, wgpu::BindGroup>,
    generation: u64,
}

impl BindGroupCache {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
            generation: 0,
        }
    }

    pub fn get(&self, key: &str) -> Option<&wgpu::BindGroup> {
        let full_key = self.full_key(key);
        self.cache.get(&full_key)
    }

    pub fn insert(&mut self, key: &str, bind_group: wgpu::BindGroup) {
        let full_key = self.full_key(key);
        self.cache.insert(full_key, bind_group);
    }

    pub fn invalidate(&mut self, key: &str) {
        let full_key = self.full_key(key);
        self.cache.remove(&full_key);
    }

    pub fn clear(&mut self) {
        self.cache.clear();
    }

    pub fn bump_generation(&mut self) {
        self.generation += 1;
        self.cache.clear();
    }

    pub fn generation(&self) -> u64 {
        self.generation
    }

    pub fn len(&self) -> usize {
        self.cache.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cache.is_empty()
    }

    fn full_key(&self, key: &str) -> String {
        format!("{}:{}", key, self.generation)
    }
}

impl Default for BindGroupCache {
    fn default() -> Self {
        Self::new()
    }
}
