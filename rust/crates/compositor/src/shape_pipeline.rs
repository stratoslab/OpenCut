use bytemuck::{Pod, Zeroable};
use gpu::wgpu;
use gpu::GpuContext;
use wgpu::util::DeviceExt;

pub const SHAPE_ROUNDED_RECT: u32 = 0;
pub const SHAPE_ELLIPSE: u32 = 1;
pub const SHAPE_POLYGON: u32 = 2;
pub const SHAPE_LINE: u32 = 3;
pub const SHAPE_ARROW: u32 = 4;
pub const SHAPE_CIRCLE: u32 = 5;
pub const SHAPE_SQUARE: u32 = 6;
pub const SHAPE_DIAMOND: u32 = 7;

pub const HEAD_NONE: u32 = 0;
pub const HEAD_ARROW: u32 = 1;
pub const HEAD_CIRCLE: u32 = 2;
pub const HEAD_SQUARE: u32 = 3;
pub const HEAD_DIAMOND: u32 = 4;

pub const STROKE_SOLID: u32 = 0;
pub const STROKE_DASHED: u32 = 1;
pub const STROKE_DOTTED: u32 = 2;

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct ShapeUniforms {
    pub bbox: [f32; 4],
    pub canvas: [f32; 4],
    pub fill_color: [f32; 4],
    pub stroke_color: [f32; 4],
    pub shape_type: u32,
    pub sides: u32,
    pub corner_radius: f32,
    pub stroke_width: f32,
    pub opacity: f32,
    pub has_stroke: u32,
    pub stroke_style: u32,
    pub _pad1: u32,
    pub line_start: [f32; 2],
    pub line_end: [f32; 2],
    pub start_head_type: u32,
    pub start_head_size: f32,
    pub end_head_type: u32,
    pub end_head_size: f32,
    pub edge_width: f32,
    pub _pad2: u32,
    pub _pad3: u32,
    pub _pad4: u32,
}

const _: () = assert!(std::mem::size_of::<ShapeUniforms>() == 160);

impl Default for ShapeUniforms {
    fn default() -> Self {
        Self {
            bbox: [0.0, 0.0, 100.0, 100.0],
            canvas: [1920.0, 1080.0, 1.0 / 1920.0, 1.0 / 1080.0],
            fill_color: [1.0, 1.0, 1.0, 1.0],
            stroke_color: [0.0, 0.0, 0.0, 1.0],
            shape_type: SHAPE_ROUNDED_RECT,
            sides: 6,
            corner_radius: 0.0,
            stroke_width: 0.0,
            opacity: 1.0,
            has_stroke: 0,
            stroke_style: STROKE_SOLID,
            _pad1: 0,
            line_start: [0.0, 0.0],
            line_end: [100.0, 100.0],
            start_head_type: HEAD_NONE,
            start_head_size: 10.0,
            end_head_type: HEAD_NONE,
            end_head_size: 10.0,
            edge_width: 1.0,
            _pad2: 0,
            _pad3: 0,
            _pad4: 0,
        }
    }
}

impl ShapeUniforms {
    pub fn new_rounded_rect(
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        corner_radius: f32,
        fill_color: [f32; 4],
        canvas_width: u32,
        canvas_height: u32,
    ) -> Self {
        let has_stroke = false;
        let stroke_pad = 0.0;

        Self {
            bbox: [
                x - stroke_pad,
                y - stroke_pad,
                width + stroke_pad * 2.0,
                height + stroke_pad * 2.0,
            ],
            canvas: [
                canvas_width as f32,
                canvas_height as f32,
                1.0 / canvas_width as f32,
                1.0 / canvas_height as f32,
            ],
            fill_color,
            shape_type: SHAPE_ROUNDED_RECT,
            corner_radius,
            ..Default::default()
        }
    }

    pub fn new_ellipse(
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        fill_color: [f32; 4],
        canvas_width: u32,
        canvas_height: u32,
    ) -> Self {
        Self {
            bbox: [x, y, width, height],
            canvas: [
                canvas_width as f32,
                canvas_height as f32,
                1.0 / canvas_width as f32,
                1.0 / canvas_height as f32,
            ],
            fill_color,
            shape_type: SHAPE_ELLIPSE,
            ..Default::default()
        }
    }

    pub fn new_circle(
        center_x: f32,
        center_y: f32,
        radius: f32,
        fill_color: [f32; 4],
        canvas_width: u32,
        canvas_height: u32,
    ) -> Self {
        Self {
            bbox: [
                center_x - radius,
                center_y - radius,
                radius * 2.0,
                radius * 2.0,
            ],
            canvas: [
                canvas_width as f32,
                canvas_height as f32,
                1.0 / canvas_width as f32,
                1.0 / canvas_height as f32,
            ],
            fill_color,
            shape_type: SHAPE_CIRCLE,
            ..Default::default()
        }
    }

    pub fn new_square(
        x: f32,
        y: f32,
        size: f32,
        fill_color: [f32; 4],
        canvas_width: u32,
        canvas_height: u32,
    ) -> Self {
        Self {
            bbox: [x, y, size, size],
            canvas: [
                canvas_width as f32,
                canvas_height as f32,
                1.0 / canvas_width as f32,
                1.0 / canvas_height as f32,
            ],
            fill_color,
            shape_type: SHAPE_SQUARE,
            ..Default::default()
        }
    }

    pub fn new_diamond(
        center_x: f32,
        center_y: f32,
        size: f32,
        fill_color: [f32; 4],
        canvas_width: u32,
        canvas_height: u32,
    ) -> Self {
        Self {
            bbox: [center_x - size, center_y - size, size * 2.0, size * 2.0],
            canvas: [
                canvas_width as f32,
                canvas_height as f32,
                1.0 / canvas_width as f32,
                1.0 / canvas_height as f32,
            ],
            fill_color,
            shape_type: SHAPE_DIAMOND,
            ..Default::default()
        }
    }

    pub fn new_polygon(
        center_x: f32,
        center_y: f32,
        radius: f32,
        sides: u32,
        fill_color: [f32; 4],
        canvas_width: u32,
        canvas_height: u32,
    ) -> Self {
        Self {
            bbox: [
                center_x - radius,
                center_y - radius,
                radius * 2.0,
                radius * 2.0,
            ],
            canvas: [
                canvas_width as f32,
                canvas_height as f32,
                1.0 / canvas_width as f32,
                1.0 / canvas_height as f32,
            ],
            fill_color,
            shape_type: SHAPE_POLYGON,
            sides: sides.max(3),
            ..Default::default()
        }
    }

    pub fn new_line(
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        stroke_width: f32,
        color: [f32; 4],
        canvas_width: u32,
        canvas_height: u32,
    ) -> Self {
        let head_size = 0.0;
        let padding = stroke_width * 2.0 + head_size * 2.0;
        let min_x = x1.min(x2) - padding;
        let min_y = y1.min(y2) - padding;
        let max_x = x1.max(x2) + padding;
        let max_y = y1.max(y2) + padding;

        Self {
            bbox: [min_x, min_y, max_x - min_x, max_y - min_y],
            canvas: [
                canvas_width as f32,
                canvas_height as f32,
                1.0 / canvas_width as f32,
                1.0 / canvas_height as f32,
            ],
            fill_color: color,
            stroke_color: color,
            shape_type: SHAPE_LINE,
            stroke_width,
            opacity: 1.0,
            has_stroke: 0,
            line_start: [x1, y1],
            line_end: [x2, y2],
            start_head_type: HEAD_NONE,
            start_head_size: 0.0,
            end_head_type: HEAD_NONE,
            end_head_size: 0.0,
            ..Default::default()
        }
    }

    pub fn new_arrow(
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        stroke_width: f32,
        color: [f32; 4],
        head_size: f32,
        canvas_width: u32,
        canvas_height: u32,
    ) -> Self {
        let padding = stroke_width * 2.0 + head_size * 2.0;
        let min_x = x1.min(x2) - padding;
        let min_y = y1.min(y2) - padding;
        let max_x = x1.max(x2) + padding;
        let max_y = y1.max(y2) + padding;

        Self {
            bbox: [min_x, min_y, max_x - min_x, max_y - min_y],
            canvas: [
                canvas_width as f32,
                canvas_height as f32,
                1.0 / canvas_width as f32,
                1.0 / canvas_height as f32,
            ],
            fill_color: color,
            stroke_color: color,
            shape_type: SHAPE_ARROW,
            stroke_width,
            opacity: 1.0,
            has_stroke: 0,
            line_start: [x1, y1],
            line_end: [x2, y2],
            start_head_type: HEAD_NONE,
            start_head_size: 0.0,
            end_head_type: HEAD_ARROW,
            end_head_size: head_size,
            ..Default::default()
        }
    }

    pub fn with_stroke(mut self, stroke_color: [f32; 4], stroke_width: f32) -> Self {
        self.stroke_color = stroke_color;
        self.stroke_width = stroke_width;
        self.has_stroke = 1;
        self
    }

    pub fn with_opacity(mut self, opacity: f32) -> Self {
        self.opacity = opacity;
        self
    }

    pub fn with_edge_width(mut self, edge_width: f32) -> Self {
        self.edge_width = edge_width;
        self
    }

    pub fn with_line_heads(
        mut self,
        start_head_type: u32,
        start_head_size: f32,
        end_head_type: u32,
        end_head_size: f32,
    ) -> Self {
        self.start_head_type = start_head_type;
        self.start_head_size = start_head_size;
        self.end_head_type = end_head_type;
        self.end_head_size = end_head_size;
        self
    }

    pub fn with_stroke_style(mut self, style: u32) -> Self {
        self.stroke_style = style;
        self
    }
}

const SHADE_SHADER_SOURCE: &str = include_str!("shaders/shape.wgsl");

pub struct ShapePipeline {
    pipeline: wgpu::RenderPipeline,
    uniform_bind_group_layout: wgpu::BindGroupLayout,
}

impl ShapePipeline {
    pub fn new(context: &GpuContext) -> Self {
        let device = context.device();

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("shape-shader"),
            source: wgpu::ShaderSource::Wgsl(SHADE_SHADER_SOURCE.into()),
        });

        let uniform_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("shape-uniform-layout"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
            });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("shape-pipeline-layout"),
            bind_group_layouts: &[&uniform_bind_group_layout],
            immediate_size: 0,
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("shape-pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: context.texture_format(),
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleStrip,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None,
                unclipped_depth: false,
                polygon_mode: wgpu::PolygonMode::Fill,
                conservative: false,
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });

        Self {
            pipeline,
            uniform_bind_group_layout,
        }
    }

    pub fn render(
        &self,
        context: &GpuContext,
        encoder: &mut wgpu::CommandEncoder,
        target_view: &wgpu::TextureView,
        uniforms: &ShapeUniforms,
    ) {
        let uniform_buffer =
            context
                .device()
                .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some("shape-uniform-buffer"),
                    contents: bytemuck::bytes_of(uniforms),
                    usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                });

        let uniform_bind_group = context
            .device()
            .create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("shape-uniform-bind-group"),
                layout: &self.uniform_bind_group_layout,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                }],
            });

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("shape-render-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: target_view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Load,
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
                multiview_mask: None,
            });

            render_pass.set_pipeline(&self.pipeline);
            render_pass.set_bind_group(0, &uniform_bind_group, &[]);
            render_pass.draw(0..4, 0..1);
        }
    }

    pub fn render_batch(
        &self,
        context: &GpuContext,
        encoder: &mut wgpu::CommandEncoder,
        target_view: &wgpu::TextureView,
        uniforms: &[ShapeUniforms],
    ) {
        for uniform in uniforms {
            self.render(context, encoder, target_view, uniform);
        }
    }

    pub fn bind_group_layout(&self) -> &wgpu::BindGroupLayout {
        &self.uniform_bind_group_layout
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uniforms_size() {
        assert_eq!(std::mem::size_of::<ShapeUniforms>(), 160);
    }

    #[test]
    fn default_uniforms() {
        let uniforms = ShapeUniforms::default();
        assert_eq!(uniforms.opacity, 1.0);
        assert_eq!(uniforms.shape_type, SHAPE_ROUNDED_RECT);
        assert_eq!(uniforms.edge_width, 1.0);
    }

    #[test]
    fn rounded_rect_uniforms() {
        let uniforms = ShapeUniforms::new_rounded_rect(
            100.0,
            100.0,
            200.0,
            150.0,
            10.0,
            [1.0, 0.0, 0.0, 1.0],
            1920,
            1080,
        );
        assert_eq!(uniforms.shape_type, SHAPE_ROUNDED_RECT);
        assert_eq!(uniforms.bbox, [100.0, 100.0, 200.0, 150.0]);
        assert_eq!(uniforms.corner_radius, 10.0);
        assert_eq!(uniforms.fill_color, [1.0, 0.0, 0.0, 1.0]);
    }

    #[test]
    fn circle_uniforms() {
        let uniforms =
            ShapeUniforms::new_circle(500.0, 300.0, 50.0, [0.0, 1.0, 0.0, 1.0], 1920, 1080);
        assert_eq!(uniforms.shape_type, SHAPE_CIRCLE);
        assert_eq!(uniforms.bbox, [450.0, 250.0, 100.0, 100.0]);
    }

    #[test]
    fn line_uniforms() {
        let uniforms = ShapeUniforms::new_line(
            100.0,
            100.0,
            400.0,
            300.0,
            4.0,
            [0.0, 0.0, 1.0, 1.0],
            1920,
            1080,
        );
        assert_eq!(uniforms.shape_type, SHAPE_LINE);
        assert_eq!(uniforms.line_start, [100.0, 100.0]);
        assert_eq!(uniforms.line_end, [400.0, 300.0]);
        assert_eq!(uniforms.stroke_width, 4.0);
    }

    #[test]
    fn arrow_uniforms() {
        let uniforms = ShapeUniforms::new_arrow(
            100.0,
            100.0,
            400.0,
            300.0,
            4.0,
            [1.0, 1.0, 0.0, 1.0],
            20.0,
            1920,
            1080,
        );
        assert_eq!(uniforms.shape_type, SHAPE_ARROW);
        assert_eq!(uniforms.end_head_type, HEAD_ARROW);
        assert_eq!(uniforms.end_head_size, 20.0);
    }

    #[test]
    fn polygon_uniforms() {
        let uniforms =
            ShapeUniforms::new_polygon(500.0, 300.0, 100.0, 6, [1.0, 0.0, 1.0, 1.0], 1920, 1080);
        assert_eq!(uniforms.shape_type, SHAPE_POLYGON);
        assert_eq!(uniforms.sides, 6);
    }

    #[test]
    fn diamond_uniforms() {
        let uniforms =
            ShapeUniforms::new_diamond(500.0, 300.0, 50.0, [0.0, 1.0, 1.0, 1.0], 1920, 1080);
        assert_eq!(uniforms.shape_type, SHAPE_DIAMOND);
        assert_eq!(uniforms.bbox, [450.0, 250.0, 100.0, 100.0]);
    }

    #[test]
    fn square_uniforms() {
        let uniforms =
            ShapeUniforms::new_square(200.0, 200.0, 100.0, [1.0, 1.0, 1.0, 1.0], 1920, 1080);
        assert_eq!(uniforms.shape_type, SHAPE_SQUARE);
        assert_eq!(uniforms.bbox, [200.0, 200.0, 100.0, 100.0]);
    }

    #[test]
    fn stroke_modifier() {
        let uniforms = ShapeUniforms::new_rounded_rect(
            0.0,
            0.0,
            100.0,
            100.0,
            0.0,
            [1.0, 1.0, 1.0, 1.0],
            1920,
            1080,
        )
        .with_stroke([0.0, 0.0, 0.0, 1.0], 2.0);
        assert_eq!(uniforms.has_stroke, 1);
        assert_eq!(uniforms.stroke_width, 2.0);
        assert_eq!(uniforms.stroke_color, [0.0, 0.0, 0.0, 1.0]);
    }

    #[test]
    fn opacity_modifier() {
        let uniforms = ShapeUniforms::default().with_opacity(0.5);
        assert_eq!(uniforms.opacity, 0.5);
    }

    #[test]
    fn edge_width_modifier() {
        let uniforms = ShapeUniforms::default().with_edge_width(2.0);
        assert_eq!(uniforms.edge_width, 2.0);
    }
}
