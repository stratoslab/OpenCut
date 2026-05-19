use bytemuck::{Pod, Zeroable};
use gpu::GpuContext;
use gpu::wgpu;
use wgpu::util::DeviceExt;

const HISTOGRAM_COMPUTE_SOURCE: &str = include_str!("shaders/scopes/histogram_compute.wgsl");
const HISTOGRAM_RENDER_SOURCE: &str = include_str!("shaders/scopes/histogram_render.wgsl");
const WAVEFORM_COMPUTE_SOURCE: &str = include_str!("shaders/scopes/waveform_compute.wgsl");
const WAVEFORM_RENDER_SOURCE: &str = include_str!("shaders/scopes/waveform_render.wgsl");
const VECTORSCOPE_COMPUTE_SOURCE: &str = include_str!("shaders/scopes/vectorscope_compute.wgsl");
const VECTORSCOPE_RENDER_SOURCE: &str = include_str!("shaders/scopes/vectorscope_render.wgsl");

const HIST_BIN_COUNT: usize = 256;
const WAVEFORM_OUT_W: u32 = 1024;
const WAVEFORM_OUT_H: u32 = 512;
const VECTORSCOPE_SIZE: u32 = 512;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct HistogramComputeUniforms {
    src_w: u32,
    src_h: u32,
    _pad0: [u32; 2],
    kr: f32,
    kb: f32,
    range_min: f32,
    range_max: f32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct HistogramRenderUniforms {
    total_pixels: f32,
    mode: f32,
    _pad1: [f32; 2],
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct WaveformComputeUniforms {
    out_w: u32,
    out_h: u32,
    src_w: u32,
    src_h: u32,
    kr: f32,
    kb: f32,
    range_min: f32,
    range_max: f32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct WaveformRenderUniforms {
    out_w: f32,
    out_h: f32,
    ref_value: f32,
    intensity: f32,
    mode: u32,
    _pad0: [u32; 3],
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct VectorscopeComputeUniforms {
    out_size: u32,
    src_w: u32,
    src_h: u32,
    _pad: u32,
    kr: f32,
    kb: f32,
    _pad2: [f32; 2],
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct VectorscopeRenderUniforms {
    out_size: f32,
    ref_value: f32,
    _p0: [f32; 2],
}

pub enum ScopeMode {
    HistogramAll = 0,
    HistogramRed = 1,
    HistogramGreen = 2,
    HistogramBlue = 3,
    HistogramLuma = 4,
    WaveformParade = 5,
}

pub struct ScopeRenderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    format: wgpu::TextureFormat,

    histogram_compute_pipeline: wgpu::ComputePipeline,
    histogram_render_pipeline: wgpu::RenderPipeline,
    histogram_compute_bg_layout: wgpu::BindGroupLayout,
    histogram_render_bg_layout: wgpu::BindGroupLayout,
    hist_r: wgpu::Buffer,
    hist_g: wgpu::Buffer,
    hist_b: wgpu::Buffer,
    hist_l: wgpu::Buffer,
    hist_compute_uniforms: wgpu::Buffer,
    hist_render_uniforms: wgpu::Buffer,

    waveform_compute_pipeline: wgpu::ComputePipeline,
    waveform_render_pipeline: wgpu::RenderPipeline,
    waveform_compute_bg_layout: wgpu::BindGroupLayout,
    waveform_render_bg_layout: wgpu::BindGroupLayout,
    wave_accum_r: wgpu::Buffer,
    wave_accum_g: wgpu::Buffer,
    wave_accum_b: wgpu::Buffer,
    wave_accum_l: wgpu::Buffer,
    wave_compute_uniforms: wgpu::Buffer,
    wave_render_uniforms: wgpu::Buffer,

    vectorscope_compute_pipeline: wgpu::ComputePipeline,
    vectorscope_render_pipeline: wgpu::RenderPipeline,
    vectorscope_compute_bg_layout: wgpu::BindGroupLayout,
    vectorscope_render_bg_layout: wgpu::BindGroupLayout,
    vec_accum_r: wgpu::Buffer,
    vec_accum_g: wgpu::Buffer,
    vec_accum_b: wgpu::Buffer,
    vec_compute_uniforms: wgpu::Buffer,
    vec_render_uniforms: wgpu::Buffer,

    kr: f32,
    kb: f32,
    range_min: f32,
    range_max: f32,
}

impl ScopeRenderer {
    pub fn new(context: &GpuContext) -> Self {
        let device = context.device();
        let queue = context.queue();
        let format = context.texture_format();

        let hist_buf_size = (HIST_BIN_COUNT * 4) as u64;
        let wave_buf_size = (WAVEFORM_OUT_W * WAVEFORM_OUT_H * 4) as u64;
        let vec_buf_size = (VECTORSCOPE_SIZE * VECTORSCOPE_SIZE * 4) as u64;

        let hist_r = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-hist-r"),
            size: hist_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let hist_g = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-hist-g"),
            size: hist_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let hist_b = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-hist-b"),
            size: hist_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let hist_l = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-hist-l"),
            size: hist_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let hist_compute_uniforms = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-hist-compute-uniforms"),
            size: std::mem::size_of::<HistogramComputeUniforms>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let hist_render_uniforms = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-hist-render-uniforms"),
            size: std::mem::size_of::<HistogramRenderUniforms>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let wave_accum_r = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-wave-accum-r"),
            size: wave_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let wave_accum_g = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-wave-accum-g"),
            size: wave_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let wave_accum_b = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-wave-accum-b"),
            size: wave_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let wave_accum_l = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-wave-accum-l"),
            size: wave_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let wave_compute_uniforms = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-wave-compute-uniforms"),
            size: std::mem::size_of::<WaveformComputeUniforms>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let wave_render_uniforms = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-wave-render-uniforms"),
            size: std::mem::size_of::<WaveformRenderUniforms>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let vec_accum_r = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-vec-accum-r"),
            size: vec_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let vec_accum_g = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-vec-accum-g"),
            size: vec_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let vec_accum_b = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-vec-accum-b"),
            size: vec_buf_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let vec_compute_uniforms = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-vec-compute-uniforms"),
            size: std::mem::size_of::<VectorscopeComputeUniforms>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let vec_render_uniforms = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scope-vec-render-uniforms"),
            size: std::mem::size_of::<VectorscopeRenderUniforms>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let hist_compute_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("scope-histogram-compute"),
            source: wgpu::ShaderSource::Wgsl(HISTOGRAM_COMPUTE_SOURCE.into()),
        });
        let hist_render_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("scope-histogram-render"),
            source: wgpu::ShaderSource::Wgsl(HISTOGRAM_RENDER_SOURCE.into()),
        });

        let histogram_compute_bg_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("scope-histogram-compute-layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 4,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 5,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let histogram_compute_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("scope-histogram-compute-pipeline-layout"),
            bind_group_layouts: &[Some(&histogram_compute_bg_layout)],
                immediate_size: 0,
            });

        let histogram_compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("scope-histogram-compute-pipeline"),
            layout: Some(&histogram_compute_pipeline_layout),
            module: &hist_compute_module,
            entry_point: Some("compute_main"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        let histogram_render_bg_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("scope-histogram-render-layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 4,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let histogram_render_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("scope-histogram-render-pipeline-layout"),
            bind_group_layouts: &[Some(&histogram_render_bg_layout)],
                immediate_size: 0,
            });

        let histogram_render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("scope-histogram-render-pipeline"),
            layout: Some(&histogram_render_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &hist_render_module,
                entry_point: Some("vs"),
                buffers: &[],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &hist_render_module,
                entry_point: Some("fs"),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
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

        let wave_compute_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("scope-waveform-compute"),
            source: wgpu::ShaderSource::Wgsl(WAVEFORM_COMPUTE_SOURCE.into()),
        });
        let wave_render_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("scope-waveform-render"),
            source: wgpu::ShaderSource::Wgsl(WAVEFORM_RENDER_SOURCE.into()),
        });

        let waveform_compute_bg_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("scope-waveform-compute-layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 4,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 5,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let waveform_compute_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("scope-waveform-compute-pipeline-layout"),
            bind_group_layouts: &[Some(&waveform_compute_bg_layout)],
                immediate_size: 0,
            });

        let waveform_compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("scope-waveform-compute-pipeline"),
            layout: Some(&waveform_compute_pipeline_layout),
            module: &wave_compute_module,
            entry_point: Some("compute_main"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        let waveform_render_bg_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("scope-waveform-render-layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 4,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let waveform_render_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("scope-waveform-render-pipeline-layout"),
            bind_group_layouts: &[Some(&waveform_render_bg_layout)],
                immediate_size: 0,
            });

        let waveform_render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("scope-waveform-render-pipeline"),
            layout: Some(&waveform_render_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &wave_render_module,
                entry_point: Some("vs"),
                buffers: &[],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &wave_render_module,
                entry_point: Some("fs"),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
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

        let vec_compute_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("scope-vectorscope-compute"),
            source: wgpu::ShaderSource::Wgsl(VECTORSCOPE_COMPUTE_SOURCE.into()),
        });
        let vec_render_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("scope-vectorscope-render"),
            source: wgpu::ShaderSource::Wgsl(VECTORSCOPE_RENDER_SOURCE.into()),
        });

        let vectorscope_compute_bg_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("scope-vectorscope-compute-layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 4,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let vectorscope_compute_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("scope-vectorscope-compute-pipeline-layout"),
            bind_group_layouts: &[Some(&vectorscope_compute_bg_layout)],
                immediate_size: 0,
            });

        let vectorscope_compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("scope-vectorscope-compute-pipeline"),
            layout: Some(&vectorscope_compute_pipeline_layout),
            module: &vec_compute_module,
            entry_point: Some("compute_main"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        let vectorscope_render_bg_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("scope-vectorscope-render-layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let vectorscope_render_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("scope-vectorscope-render-pipeline-layout"),
            bind_group_layouts: &[Some(&vectorscope_render_bg_layout)],
                immediate_size: 0,
            });

        let vectorscope_render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("scope-vectorscope-render-pipeline"),
            layout: Some(&vectorscope_render_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &vec_render_module,
                entry_point: Some("vs"),
                buffers: &[],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &vec_render_module,
                entry_point: Some("fs"),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
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

        Self {
            device: device.clone(),
            queue: queue.clone(),
            format,
            histogram_compute_pipeline,
            histogram_render_pipeline,
            histogram_compute_bg_layout,
            histogram_render_bg_layout,
            hist_r,
            hist_g,
            hist_b,
            hist_l,
            hist_compute_uniforms,
            hist_render_uniforms,
            waveform_compute_pipeline,
            waveform_render_pipeline,
            waveform_compute_bg_layout,
            waveform_render_bg_layout,
            wave_accum_r,
            wave_accum_g,
            wave_accum_b,
            wave_accum_l,
            wave_compute_uniforms,
            wave_render_uniforms,
            vectorscope_compute_pipeline,
            vectorscope_render_pipeline,
            vectorscope_compute_bg_layout,
            vectorscope_render_bg_layout,
            vec_accum_r,
            vec_accum_g,
            vec_accum_b,
            vec_compute_uniforms,
            vec_render_uniforms,
            kr: 0.2126,
            kb: 0.0722,
            range_min: 0.0,
            range_max: 1.0,
        }
    }

    pub fn set_matrix(&mut self, kr: f32, kb: f32) {
        self.kr = kr;
        self.kb = kb;
    }

    pub fn set_range(&mut self, min: f32, max: f32) {
        self.range_min = min;
        self.range_max = max;
    }

    pub fn render_histogram(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        source: &wgpu::Texture,
        target_view: &wgpu::TextureView,
        mode: u32,
    ) {
        let src_w = source.width();
        let src_h = source.height();

        let compute_uniforms = HistogramComputeUniforms {
            src_w,
            src_h,
            _pad0: [0; 2],
            kr: self.kr,
            kb: self.kb,
            range_min: self.range_min,
            range_max: self.range_max,
        };
        self.queue.write_buffer(
            &self.hist_compute_uniforms,
            0,
            bytemuck::bytes_of(&compute_uniforms),
        );

        let render_uniforms = HistogramRenderUniforms {
            total_pixels: (src_w * src_h) as f32,
            mode: mode as f32,
            _pad1: [0.0; 2],
        };
        self.queue.write_buffer(
            &self.hist_render_uniforms,
            0,
            bytemuck::bytes_of(&render_uniforms),
        );

        encoder.clear_buffer(&self.hist_r, 0, None);
        encoder.clear_buffer(&self.hist_g, 0, None);
        encoder.clear_buffer(&self.hist_b, 0, None);
        encoder.clear_buffer(&self.hist_l, 0, None);

        let source_view = source.create_view(&wgpu::TextureViewDescriptor::default());
        let compute_bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("scope-histogram-compute-bg"),
            layout: &self.histogram_compute_bg_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&source_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.hist_r.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.hist_g.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: self.hist_b.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: self.hist_l.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 5,
                    resource: self.hist_compute_uniforms.as_entire_binding(),
                },
            ],
        });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("scope-histogram-compute-pass"),
                timestamp_writes: None,
            });
            compute_pass.set_pipeline(&self.histogram_compute_pipeline);
            compute_pass.set_bind_group(0, &compute_bg, &[]);
            compute_pass.dispatch_workgroups((src_w + 15) / 16, (src_h + 15) / 16, 1);
        }

        let render_bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("scope-histogram-render-bg"),
            layout: &self.histogram_render_bg_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.hist_r.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.hist_g.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.hist_b.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: self.hist_l.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: self.hist_render_uniforms.as_entire_binding(),
                },
            ],
        });

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("scope-histogram-render-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: target_view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.04,
                            g: 0.04,
                            b: 0.04,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
                multiview_mask: None,
            });
            render_pass.set_pipeline(&self.histogram_render_pipeline);
            render_pass.set_bind_group(0, &render_bg, &[]);
            render_pass.draw(0..3, 0..1);
        }
    }

    pub fn render_waveform(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        source: &wgpu::Texture,
        target_view: &wgpu::TextureView,
        mode: u32,
    ) {
        let src_w = source.width();
        let src_h = source.height();

        let compute_uniforms = WaveformComputeUniforms {
            out_w: WAVEFORM_OUT_W,
            out_h: WAVEFORM_OUT_H,
            src_w,
            src_h,
            kr: self.kr,
            kb: self.kb,
            range_min: self.range_min,
            range_max: self.range_max,
        };
        self.queue.write_buffer(
            &self.wave_compute_uniforms,
            0,
            bytemuck::bytes_of(&compute_uniforms),
        );

        let ref_value = ((src_h as f32 / WAVEFORM_OUT_H as f32).sqrt()) * 40.0;
        let render_uniforms = WaveformRenderUniforms {
            out_w: WAVEFORM_OUT_W as f32,
            out_h: WAVEFORM_OUT_H as f32,
            ref_value,
            intensity: 0.9,
            mode,
            _pad0: [0; 3],
        };
        self.queue.write_buffer(
            &self.wave_render_uniforms,
            0,
            bytemuck::bytes_of(&render_uniforms),
        );

        encoder.clear_buffer(&self.wave_accum_r, 0, None);
        encoder.clear_buffer(&self.wave_accum_g, 0, None);
        encoder.clear_buffer(&self.wave_accum_b, 0, None);
        encoder.clear_buffer(&self.wave_accum_l, 0, None);

        let source_view = source.create_view(&wgpu::TextureViewDescriptor::default());
        let compute_bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("scope-waveform-compute-bg"),
            layout: &self.waveform_compute_bg_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&source_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.wave_accum_r.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.wave_accum_g.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: self.wave_accum_b.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: self.wave_compute_uniforms.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 5,
                    resource: self.wave_accum_l.as_entire_binding(),
                },
            ],
        });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("scope-waveform-compute-pass"),
                timestamp_writes: None,
            });
            compute_pass.set_pipeline(&self.waveform_compute_pipeline);
            compute_pass.set_bind_group(0, &compute_bg, &[]);
            compute_pass.dispatch_workgroups((src_w + 15) / 16, (src_h + 15) / 16, 1);
        }

        let render_bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("scope-waveform-render-bg"),
            layout: &self.waveform_render_bg_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.wave_accum_r.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.wave_accum_g.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.wave_accum_b.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: self.wave_render_uniforms.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: self.wave_accum_l.as_entire_binding(),
                },
            ],
        });

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("scope-waveform-render-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: target_view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.04,
                            g: 0.04,
                            b: 0.04,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
                multiview_mask: None,
            });
            render_pass.set_pipeline(&self.waveform_render_pipeline);
            render_pass.set_bind_group(0, &render_bg, &[]);
            render_pass.draw(0..3, 0..1);
        }
    }

    pub fn render_vectorscope(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        source: &wgpu::Texture,
        target_view: &wgpu::TextureView,
    ) {
        let src_w = source.width();
        let src_h = source.height();

        let compute_uniforms = VectorscopeComputeUniforms {
            out_size: VECTORSCOPE_SIZE,
            src_w,
            src_h,
            _pad: 0,
            kr: self.kr,
            kb: self.kb,
            _pad2: [0.0; 2],
        };
        self.queue.write_buffer(
            &self.vec_compute_uniforms,
            0,
            bytemuck::bytes_of(&compute_uniforms),
        );

        let ref_value = ((src_w as f32 * src_h as f32) / (VECTORSCOPE_SIZE as f32 * VECTORSCOPE_SIZE as f32)).sqrt() * 18.0;
        let render_uniforms = VectorscopeRenderUniforms {
            out_size: VECTORSCOPE_SIZE as f32,
            ref_value,
            _p0: [0.0; 2],
        };
        self.queue.write_buffer(
            &self.vec_render_uniforms,
            0,
            bytemuck::bytes_of(&render_uniforms),
        );

        encoder.clear_buffer(&self.vec_accum_r, 0, None);
        encoder.clear_buffer(&self.vec_accum_g, 0, None);
        encoder.clear_buffer(&self.vec_accum_b, 0, None);

        let source_view = source.create_view(&wgpu::TextureViewDescriptor::default());
        let compute_bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("scope-vectorscope-compute-bg"),
            layout: &self.vectorscope_compute_bg_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&source_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.vec_accum_r.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.vec_accum_g.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: self.vec_accum_b.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: self.vec_compute_uniforms.as_entire_binding(),
                },
            ],
        });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("scope-vectorscope-compute-pass"),
                timestamp_writes: None,
            });
            compute_pass.set_pipeline(&self.vectorscope_compute_pipeline);
            compute_pass.set_bind_group(0, &compute_bg, &[]);
            compute_pass.dispatch_workgroups((src_w + 15) / 16, (src_h + 15) / 16, 1);
        }

        let render_bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("scope-vectorscope-render-bg"),
            layout: &self.vectorscope_render_bg_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.vec_accum_r.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.vec_accum_g.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.vec_accum_b.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: self.vec_render_uniforms.as_entire_binding(),
                },
            ],
        });

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("scope-vectorscope-render-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: target_view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.04,
                            g: 0.04,
                            b: 0.04,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
                multiview_mask: None,
            });
            render_pass.set_pipeline(&self.vectorscope_render_pipeline);
            render_pass.set_bind_group(0, &render_bg, &[]);
            render_pass.draw(0..3, 0..1);
        }
    }
}
