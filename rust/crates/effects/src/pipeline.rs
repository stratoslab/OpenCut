use std::collections::HashMap;

use bytemuck::{Pod, Zeroable};
use gpu::{FULLSCREEN_SHADER_SOURCE, GpuContext};
use thiserror::Error;
use wgpu::util::DeviceExt;

use crate::{EffectPass, UniformValue};

const GAUSSIAN_BLUR_SHADER_ID: &str = "gaussian-blur";
const GAUSSIAN_BLUR_SHADER_SOURCE: &str = include_str!("shaders/gaussian_blur.wgsl");
const COLOR_CORRECT_SHADER_ID: &str = "color-correct";
const COLOR_CORRECT_SHADER_SOURCE: &str = include_str!("shaders/color_correct.wgsl");
const CHROMATIC_ABERR_SHADER_ID: &str = "chromatic-aberr";
const CHROMATIC_ABERR_SHADER_SOURCE: &str = include_str!("shaders/chromatic_aberr.wgsl");
const VIGNETTE_SHADER_ID: &str = "vignette";
const VIGNETTE_SHADER_SOURCE: &str = include_str!("shaders/vignette.wgsl");
const SHARPEN_SHADER_ID: &str = "sharpen";
const SHARPEN_SHADER_SOURCE: &str = include_str!("shaders/sharpen.wgsl");
const SEPIA_SHADER_ID: &str = "sepia";
const SEPIA_SHADER_SOURCE: &str = include_str!("shaders/sepia.wgsl");
const GRAYSCALE_SHADER_ID: &str = "grayscale";
const GRAYSCALE_SHADER_SOURCE: &str = include_str!("shaders/grayscale.wgsl");
const INVERT_SHADER_ID: &str = "invert";
const INVERT_SHADER_SOURCE: &str = include_str!("shaders/invert.wgsl");
const PIXELATE_SHADER_ID: &str = "pixelate";
const PIXELATE_SHADER_SOURCE: &str = include_str!("shaders/pixelate.wgsl");
const NOISE_SHADER_ID: &str = "noise";
const NOISE_SHADER_SOURCE: &str = include_str!("shaders/noise.wgsl");
const LENS_DISTORTION_SHADER_ID: &str = "lens-distortion";
const LENS_DISTORTION_SHADER_SOURCE: &str = include_str!("shaders/lens_distortion.wgsl");
const GLOW_THRESHOLD_SHADER_ID: &str = "glow-threshold";
const GLOW_THRESHOLD_SHADER_SOURCE: &str = include_str!("shaders/glow_threshold.wgsl");
const GLOW_COMPOSITE_SHADER_ID: &str = "glow-composite";
const GLOW_COMPOSITE_SHADER_SOURCE: &str = include_str!("shaders/glow_composite.wgsl");
const AI_UPSCALE_SHADER_ID: &str = "ai-upscale";
const AI_UPSCALE_SHADER_SOURCE: &str = include_str!("shaders/ai_upscale.wgsl");
const COLOR_GRADE_SHADER_ID: &str = "color-grade";
const COLOR_GRADE_SHADER_SOURCE: &str = include_str!("shaders/color_grade.wgsl");

pub struct ApplyEffectsOptions<'a> {
    pub source: &'a wgpu::Texture,
    pub width: u32,
    pub height: u32,
    pub passes: &'a [EffectPass],
}

pub struct EffectPipeline {
    uniform_bind_group_layout: wgpu::BindGroupLayout,
    pipelines: HashMap<String, wgpu::RenderPipeline>,
}

#[derive(Debug, Error)]
pub enum EffectsError {
    #[error("At least one effect pass is required")]
    MissingEffectPasses,
    #[error("Unknown effect shader '{shader}'")]
    UnknownEffectShader { shader: String },
    #[error("Missing uniform '{uniform}' for shader '{shader}'")]
    MissingUniform { shader: String, uniform: String },
    #[error("Uniform '{uniform}' for shader '{shader}' must be a number")]
    InvalidNumberUniform { shader: String, uniform: String },
    #[error(
        "Uniform '{uniform}' for shader '{shader}' must be a vector of length {expected_length}"
    )]
    InvalidVectorUniform {
        shader: String,
        uniform: String,
        expected_length: usize,
    },
    #[error("Shader '{shader}' does not support uniform '{uniform}'")]
    UnsupportedUniform { shader: String, uniform: String },
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct EffectUniformBuffer {
    resolution: [f32; 2],
    direction: [f32; 2],
    scalars: [f32; 4],
}

impl EffectPipeline {
    pub fn new(context: &GpuContext) -> Self {
        let uniform_bind_group_layout =
            context
                .device()
                .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                    label: Some("effects-uniform-bind-group-layout"),
                    entries: &[wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    }],
                });
        let vertex_shader_module =
            context
                .device()
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("effects-fullscreen-shader"),
                    source: wgpu::ShaderSource::Wgsl(FULLSCREEN_SHADER_SOURCE.into()),
                });

        let shader_sources = [
            (GAUSSIAN_BLUR_SHADER_ID, GAUSSIAN_BLUR_SHADER_SOURCE, "gaussian-blur"),
            (COLOR_CORRECT_SHADER_ID, COLOR_CORRECT_SHADER_SOURCE, "color-correct"),
            (CHROMATIC_ABERR_SHADER_ID, CHROMATIC_ABERR_SHADER_SOURCE, "chromatic-aberr"),
            (VIGNETTE_SHADER_ID, VIGNETTE_SHADER_SOURCE, "vignette"),
            (SHARPEN_SHADER_ID, SHARPEN_SHADER_SOURCE, "sharpen"),
            (SEPIA_SHADER_ID, SEPIA_SHADER_SOURCE, "sepia"),
            (GRAYSCALE_SHADER_ID, GRAYSCALE_SHADER_SOURCE, "grayscale"),
            (INVERT_SHADER_ID, INVERT_SHADER_SOURCE, "invert"),
            (PIXELATE_SHADER_ID, PIXELATE_SHADER_SOURCE, "pixelate"),
            (NOISE_SHADER_ID, NOISE_SHADER_SOURCE, "noise"),
            (LENS_DISTORTION_SHADER_ID, LENS_DISTORTION_SHADER_SOURCE, "lens-distortion"),
            (GLOW_THRESHOLD_SHADER_ID, GLOW_THRESHOLD_SHADER_SOURCE, "glow-threshold"),
            (GLOW_COMPOSITE_SHADER_ID, GLOW_COMPOSITE_SHADER_SOURCE, "glow-composite"),
            (AI_UPSCALE_SHADER_ID, AI_UPSCALE_SHADER_SOURCE, "ai-upscale"),
            (COLOR_GRADE_SHADER_ID, COLOR_GRADE_SHADER_SOURCE, "color-grade"),
        ];

        let mut pipelines = HashMap::new();

        for (shader_id, source, label) in shader_sources {
            let shader_module = context.device().create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some(label),
                source: wgpu::ShaderSource::Wgsl(source.into()),
            });
            let pipeline_layout = context.device().create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some(&format!("{}-pipeline-layout", label)),
                bind_group_layouts: &[
                    Some(context.texture_sampler_bind_group_layout()),
                    Some(&uniform_bind_group_layout),
                ],
                immediate_size: 0,
            });
            let pipeline = context.device().create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some(&format!("{}-pipeline", label)),
                layout: Some(&pipeline_layout),
                vertex: wgpu::VertexState {
                    module: &vertex_shader_module,
                    entry_point: Some("vertex_main"),
                    buffers: &[wgpu::VertexBufferLayout {
                        array_stride: std::mem::size_of::<[f32; 2]>() as u64,
                        step_mode: wgpu::VertexStepMode::Vertex,
                        attributes: &[wgpu::VertexAttribute {
                            format: wgpu::VertexFormat::Float32x2,
                            offset: 0,
                            shader_location: 0,
                        }],
                    }],
                    compilation_options: wgpu::PipelineCompilationOptions::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: &shader_module,
                    entry_point: Some("fragment_main"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: context.texture_format(),
                        blend: None,
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                    compilation_options: wgpu::PipelineCompilationOptions::default(),
                }),
                primitive: wgpu::PrimitiveState::default(),
                depth_stencil: None,
                multisample: wgpu::MultisampleState::default(),
                multiview_mask: None,
                cache: None,
            });
            pipelines.insert(shader_id.to_string(), pipeline);
        }

        Self {
            uniform_bind_group_layout,
            pipelines,
        }
    }

    pub fn apply(
        &self,
        context: &GpuContext,
        ApplyEffectsOptions {
            source,
            width,
            height,
            passes,
        }: ApplyEffectsOptions<'_>,
    ) -> Result<wgpu::Texture, EffectsError> {
        let mut encoder =
            context
                .device()
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("effects-command-encoder"),
                });
        let output = self.apply_with_encoder(
            context,
            &mut encoder,
            ApplyEffectsOptions {
                source,
                width,
                height,
                passes,
            },
        )?;
        context.queue().submit([encoder.finish()]);
        Ok(output)
    }

    pub fn apply_with_encoder(
        &self,
        context: &GpuContext,
        encoder: &mut wgpu::CommandEncoder,
        ApplyEffectsOptions {
            source,
            width,
            height,
            passes,
        }: ApplyEffectsOptions<'_>,
    ) -> Result<wgpu::Texture, EffectsError> {
        let mut current_texture: Option<wgpu::Texture> = None;

        for pass in passes {
            let input_texture = current_texture.as_ref().unwrap_or(source);
            let output_texture =
                context.create_render_texture(width, height, "effects-pass-output");
            let input_view = input_texture.create_view(&wgpu::TextureViewDescriptor::default());
            let output_view = output_texture.create_view(&wgpu::TextureViewDescriptor::default());
            let texture_bind_group =
                context
                    .device()
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("effects-texture-bind-group"),
                        layout: context.texture_sampler_bind_group_layout(),
                        entries: &[
                            wgpu::BindGroupEntry {
                                binding: 0,
                                resource: wgpu::BindingResource::TextureView(&input_view),
                            },
                            wgpu::BindGroupEntry {
                                binding: 1,
                                resource: wgpu::BindingResource::Sampler(context.linear_sampler()),
                            },
                        ],
                    });
            let uniform_buffer =
                context
                    .device()
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some("effects-uniform-buffer"),
                        contents: bytemuck::bytes_of(&pack_effect_uniforms(pass, width, height)?),
                        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                    });
            let uniform_bind_group =
                context
                    .device()
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("effects-uniform-bind-group"),
                        layout: &self.uniform_bind_group_layout,
                        entries: &[wgpu::BindGroupEntry {
                            binding: 0,
                            resource: uniform_buffer.as_entire_binding(),
                        }],
                    });
            let pipeline = self.pipelines.get(&pass.shader).ok_or_else(|| {
                EffectsError::UnknownEffectShader {
                    shader: pass.shader.clone(),
                }
            })?;

            {
                let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("effects-render-pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &output_view,
                        resolve_target: None,
                        depth_slice: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    occlusion_query_set: None,
                    timestamp_writes: None,
                    multiview_mask: None,
                });
                render_pass.set_pipeline(pipeline);
                render_pass.set_vertex_buffer(0, context.fullscreen_quad().slice(..));
                render_pass.set_bind_group(0, &texture_bind_group, &[]);
                render_pass.set_bind_group(1, &uniform_bind_group, &[]);
                render_pass.draw(0..6, 0..1);
            }

            current_texture = Some(output_texture);
        }

        current_texture.ok_or(EffectsError::MissingEffectPasses)
    }
}

fn pack_effect_uniforms(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<EffectUniformBuffer, EffectsError> {
    let shader = pass.shader.as_str();

    // Gaussian blur: uses u_sigma, u_step, u_direction (legacy)
    if shader == GAUSSIAN_BLUR_SHADER_ID {
        let sigma = read_number_uniform(pass, "u_sigma")?;
        let step = read_number_uniform(pass, "u_step")?;
        let direction = read_vec2_uniform(pass, "u_direction")?;
        return Ok(EffectUniformBuffer {
            resolution: [width as f32, height as f32],
            direction,
            scalars: [sigma, step, 0.0, 0.0],
        });
    }

    // Sharpen: uses u_intensity, u_direction (separable H+V passes)
    if shader == SHARPEN_SHADER_ID {
        let intensity = read_number_uniform(pass, "u_intensity")?;
        let direction = read_vec2_uniform(pass, "u_direction")?;
        return Ok(EffectUniformBuffer {
            resolution: [width as f32, height as f32],
            direction,
            scalars: [intensity, 0.0, 0.0, 0.0],
        });
    }

    // Noise: uses u_intensity, u_monochrome, u_direction.x as frame counter
    if shader == NOISE_SHADER_ID {
        let intensity = read_number_uniform(pass, "u_intensity")?;
        let monochrome = read_number_uniform(pass, "u_monochrome")?;
        let frame = read_number_uniform(pass, "u_frame")?;
        return Ok(EffectUniformBuffer {
            resolution: [width as f32, height as f32],
            direction: [frame, 0.0],
            scalars: [intensity, monochrome, 0.0, 0.0],
        });
    }

    // All other effects: use scalars[0-3] via u_scalar0, u_scalar1, u_scalar2, u_scalar3
    let s0 = read_number_uniform(pass, "u_scalar0").unwrap_or(0.0);
    let s1 = read_number_uniform(pass, "u_scalar1").unwrap_or(0.0);
    let s2 = read_number_uniform(pass, "u_scalar2").unwrap_or(0.0);
    let s3 = read_number_uniform(pass, "u_scalar3").unwrap_or(0.0);

    // Validate no unsupported uniforms
    let supported = ["u_scalar0", "u_scalar1", "u_scalar2", "u_scalar3"];
    for uniform in pass.uniforms.keys() {
        if !supported.contains(&uniform.as_str()) {
            return Err(EffectsError::UnsupportedUniform {
                shader: shader.to_string(),
                uniform: uniform.clone(),
            });
        }
    }

    Ok(EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction: [0.0, 0.0],
        scalars: [s0, s1, s2, s3],
    })
}

fn read_number_uniform(pass: &EffectPass, uniform: &str) -> Result<f32, EffectsError> {
    let Some(value) = pass.uniforms.get(uniform) else {
        return Err(EffectsError::MissingUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        });
    };
    match value {
        UniformValue::Number(value) => Ok(*value),
        UniformValue::Vector(_) => Err(EffectsError::InvalidNumberUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        }),
    }
}

fn read_vec2_uniform(pass: &EffectPass, uniform: &str) -> Result<[f32; 2], EffectsError> {
    let Some(value) = pass.uniforms.get(uniform) else {
        return Err(EffectsError::MissingUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        });
    };
    let UniformValue::Vector(values) = value else {
        return Err(EffectsError::InvalidVectorUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
            expected_length: 2,
        });
    };
    if values.len() != 2 {
        return Err(EffectsError::InvalidVectorUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
            expected_length: 2,
        });
    }
    Ok([values[0], values[1]])
}
