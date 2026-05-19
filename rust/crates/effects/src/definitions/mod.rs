mod ai_upscale;
mod chromatic_aberr;
mod color_correct;
mod color_grade;
mod gaussian_blur;
mod glow_composite;
mod glow_threshold;
mod grayscale;
mod invert;
mod lens_distortion;
mod noise;
mod pixelate;
mod sepia;
mod sharpen;
mod vignette;

pub use ai_upscale::AI_UPSCALE;
pub use chromatic_aberr::CHROMATIC_ABERR;
pub use color_correct::COLOR_CORRECT;
pub use color_grade::COLOR_GRADE;
pub use gaussian_blur::GAUSSIAN_BLUR;
pub use glow_composite::GLOW_COMPOSITE;
pub use glow_threshold::GLOW_THRESHOLD;
pub use grayscale::GRAYSCALE;
pub use invert::INVERT;
pub use lens_distortion::LENS_DISTORTION;
pub use noise::NOISE;
pub use pixelate::PIXELATE;
pub use sepia::SEPIA;
pub use sharpen::SHARPEN;
pub use vignette::VIGNETTE;

pub const ALL_EFFECTS: &[&crate::EffectDefinition] = &[
    &GAUSSIAN_BLUR,
    &COLOR_CORRECT,
    &CHROMATIC_ABERR,
    &VIGNETTE,
    &SHARPEN,
    &SEPIA,
    &GRAYSCALE,
    &INVERT,
    &PIXELATE,
    &NOISE,
    &LENS_DISTORTION,
    &GLOW_THRESHOLD,
    &GLOW_COMPOSITE,
    &AI_UPSCALE,
    &COLOR_GRADE,
];
