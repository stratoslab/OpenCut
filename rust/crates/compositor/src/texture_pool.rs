use std::collections::HashMap;
use std::fmt;

use gpu::{GpuContext, wgpu};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TextureKey {
    width: u32,
    height: u32,
    format: wgpu::TextureFormat,
}

impl fmt::Display for TextureKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}x{}x{:?}", self.width, self.height, self.format)
    }
}

struct PoolEntry {
    texture: wgpu::Texture,
    in_use: bool,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PoolMetrics {
    pub total_created: u64,
    pub total_acquires: u64,
    pub cache_hits: u64,
}

impl PoolMetrics {
    pub fn cache_hit_rate(&self) -> f64 {
        if self.total_acquires == 0 {
            return 0.0;
        }
        self.cache_hits as f64 / self.total_acquires as f64
    }
}

const MAX_UNUSED_PER_KEY: usize = 2;

#[derive(Default)]
pub struct TexturePool {
    available: HashMap<TextureKey, Vec<PoolEntry>>,
    in_use: Vec<(TextureKey, wgpu::Texture)>,
    metrics: PoolMetrics,
}

impl TexturePool {
    pub fn recycle_frame(&mut self) {
        for (key, texture) in self.in_use.drain(..) {
            self.available
                .entry(key)
                .or_default()
                .push(PoolEntry {
                    texture,
                    in_use: false,
                });
        }
    }

    pub fn release(&mut self, texture: &wgpu::Texture) {
        let key = TextureKey {
            width: texture.width(),
            height: texture.height(),
            format: texture.format(),
        };
        if let Some(idx) = self.in_use.iter().position(|(_, t)| {
            t.width() == texture.width()
                && t.height() == texture.height()
                && t.format() == texture.format()
        }) {
            let (_, tex) = self.in_use.remove(idx);
            self.available.entry(key).or_default().push(PoolEntry {
                texture: tex,
                in_use: false,
            });
        }
    }

    pub fn acquire(
        &mut self,
        context: &GpuContext,
        width: u32,
        height: u32,
        label: &'static str,
    ) -> wgpu::Texture {
        self.acquire_with_format(context, width, height, context.texture_format(), label)
    }

    pub fn acquire_with_format(
        &mut self,
        context: &GpuContext,
        width: u32,
        height: u32,
        format: wgpu::TextureFormat,
        label: &'static str,
    ) -> wgpu::Texture {
        let key = TextureKey {
            width,
            height,
            format,
        };
        self.metrics.total_acquires += 1;

        let texture = self
            .available
            .get_mut(&key)
            .and_then(|entries| {
                entries.iter_mut().find(|e| !e.in_use).map(|e| {
                    e.in_use = true;
                    e.texture.clone()
                })
            })
            .unwrap_or_else(|| {
                let texture = context.create_render_texture_with_format(width, height, format, label);
                self.metrics.total_created += 1;
                self.available
                    .entry(key.clone())
                    .or_default()
                    .push(PoolEntry {
                        texture: texture.clone(),
                        in_use: true,
                    });
                texture
            });

        if self.available.get(&key).map_or(false, |entries| {
            entries.iter().any(|e| e.in_use)
        }) {
            self.metrics.cache_hits += 1;
        }

        self.in_use.push((key, texture.clone()));
        texture
    }

    pub fn compact(&mut self) {
        for entries in self.available.values_mut() {
            let unused_count = entries.iter().filter(|e| !e.in_use).count();
            if unused_count > MAX_UNUSED_PER_KEY {
                let mut to_remove = Vec::new();
                let mut kept_unused = 0;
                for (i, entry) in entries.iter().enumerate().rev() {
                    if !entry.in_use {
                        if kept_unused >= MAX_UNUSED_PER_KEY {
                            to_remove.push(i);
                        }
                        kept_unused += 1;
                    }
                }
                for i in to_remove {
                    entries.remove(i);
                }
            }
        }
    }

    pub fn metrics(&self) -> PoolMetrics {
        self.metrics
    }

    pub fn pool_count(&self) -> usize {
        self.available.values().map(|v| v.len()).sum()
    }

    pub fn in_use_count(&self) -> usize {
        self.in_use.len()
    }
}
