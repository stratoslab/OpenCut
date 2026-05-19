use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EasingType {
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    Bounce,
    Elastic,
    Back,
    Circ,
    Expo,
    Sine,
    Quad,
    Cubic,
    Quart,
    Quint,
}

impl Default for EasingType {
    fn default() -> Self {
        Self::Linear
    }
}

impl EasingType {
    pub fn apply(&self, t: f64) -> f64 {
        match self {
            Self::Linear => t,
            Self::EaseIn => t * t,
            Self::EaseOut => t * (2.0 - t),
            Self::EaseInOut => {
                if t < 0.5 {
                    2.0 * t * t
                } else {
                    -1.0 + (4.0 - 2.0 * t) * t
                }
            }
            Self::Bounce => {
                let n1 = 7.5625;
                let d1 = 2.75;
                if t < 1.0 / d1 {
                    n1 * t * t
                } else if t < 2.0 / d1 {
                    n1 * (t - 1.5 / d1) * (t - 1.5 / d1) + 0.75
                } else if t < 2.5 / d1 {
                    n1 * (t - 2.25 / d1) * (t - 2.25 / d1) + 0.9375
                } else {
                    n1 * (t - 2.625 / d1) * (t - 2.625 / d1) + 0.984375
                }
            }
            Self::Elastic => {
                if t == 0.0 || t == 1.0 {
                    t
                } else {
                    2f64.powf(-10.0 * t)
                        * ((t * 10.0 - 0.75) * (2.0 * std::f64::consts::PI / 3.0)).sin()
                        + 1.0
                }
            }
            Self::Back => {
                let c1 = 1.70158;
                let c3 = c1 + 1.0;
                1.0 + c3 * (t - 1.0).powi(3) + c1 * (t - 1.0).powi(2)
            }
            Self::Circ => 1.0 - (1.0 - (t - 1.0).powi(2)).sqrt(),
            Self::Expo => {
                if t == 0.0 {
                    0.0
                } else {
                    2f64.powf(10.0 * t - 10.0)
                }
            }
            Self::Sine => -((std::f64::consts::PI * t).cos() - 1.0) / 2.0,
            Self::Quad => t * t,
            Self::Cubic => t * t * t,
            Self::Quart => t * t * t * t,
            Self::Quint => t * t * t * t * t,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct BezierPoint {
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub cp1x: Option<f64>,
    #[serde(default)]
    pub cp1y: Option<f64>,
    #[serde(default)]
    pub cp2x: Option<f64>,
    #[serde(default)]
    pub cp2y: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Keyframe {
    pub id: String,
    pub time: f64,
    pub value: f64,
    #[serde(default)]
    pub easing: Option<EasingType>,
    #[serde(default)]
    pub bezier_in: Option<BezierHandle>,
    #[serde(default)]
    pub bezier_out: Option<BezierHandle>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct BezierHandle {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyframeChannel {
    pub id: String,
    pub property: String,
    pub keyframes: Vec<Keyframe>,
    #[serde(default)]
    pub easing: Option<EasingType>,
    #[serde(default)]
    pub bezier_curve: Option<Vec<BezierPoint>>,
}

impl KeyframeChannel {
    pub fn new(id: String, property: String) -> Self {
        Self {
            id,
            property,
            keyframes: Vec::new(),
            easing: None,
            bezier_curve: None,
        }
    }

    pub fn add_keyframe(&mut self, keyframe: Keyframe) {
        self.keyframes.push(keyframe);
        self.keyframes.sort_by(|a, b| a.time.total_cmp(&b.time));
    }

    pub fn remove_keyframe(&mut self, keyframe_id: &str) {
        self.keyframes.retain(|k| k.id != keyframe_id);
    }
}
