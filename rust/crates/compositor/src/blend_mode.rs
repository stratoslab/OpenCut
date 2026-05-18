use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BlendMode {
    Normal,
    Darken,
    Multiply,
    ColorBurn,
    Lighten,
    Screen,
    PlusLighter,
    ColorDodge,
    Overlay,
    SoftLight,
    HardLight,
    Difference,
    Exclusion,
    Hue,
    Saturation,
    Color,
    Luminosity,
    // Additional contrast modes
    LinearBurn,
    DarkerColor,
    LinearDodge,
    LighterColor,
    VividLight,
    LinearLight,
    PinLight,
    HardMix,
    // Additional arithmetic modes
    Subtract,
    Divide,
    // Artistic modes
    Reflect,
    Glow,
    Phoenix,
    // Stencil and silhouette modes
    StencilAlpha,
    SilhouetteAlpha,
    StencilLuma,
    SilhouetteLuma,
}

impl BlendMode {
    pub fn shader_code(self) -> u32 {
        match self {
            Self::Normal => 0,
            Self::Darken => 1,
            Self::Multiply => 2,
            Self::ColorBurn => 3,
            Self::Lighten => 4,
            Self::Screen => 5,
            Self::PlusLighter => 6,
            Self::ColorDodge => 7,
            Self::Overlay => 8,
            Self::SoftLight => 9,
            Self::HardLight => 10,
            Self::Difference => 11,
            Self::Exclusion => 12,
            Self::Hue => 13,
            Self::Saturation => 14,
            Self::Color => 15,
            Self::Luminosity => 16,
            Self::LinearBurn => 17,
            Self::DarkerColor => 18,
            Self::LinearDodge => 19,
            Self::LighterColor => 20,
            Self::VividLight => 21,
            Self::LinearLight => 22,
            Self::PinLight => 23,
            Self::HardMix => 24,
            Self::Subtract => 25,
            Self::Divide => 26,
            Self::Reflect => 27,
            Self::Glow => 28,
            Self::Phoenix => 29,
            Self::StencilAlpha => 30,
            Self::SilhouetteAlpha => 31,
            Self::StencilLuma => 32,
            Self::SilhouetteLuma => 33,
        }
    }
}
