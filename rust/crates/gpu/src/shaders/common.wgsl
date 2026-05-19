pub const COMMON_WGSL: &str = r#"
const PI: f32 = 3.14159265358979323846;
const TAU: f32 = 6.28318530717958647693;
const E: f32 = 2.71828182845904523536;

fn rgb2hsv(c: vec3f) -> vec3f {
    let p = select(vec3f(c.bg, -1.0), vec3f(c.gb, 2.0 / 3.0), c.g < c.b);
    let q = select(vec3f(p.xy, p.w), vec3f(c.rg, -1.0 / 3.0), p.x < c.r);
    let d = q.x - min(q.w, q.y);
    let e = 1.0e-10;
    return vec3f(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

fn hsv2rgb(c: vec3f) -> vec3f {
    let p = abs(fract(c.x + vec3f(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3f(1.0), clamp(p - vec3f(1.0), vec3f(0.0), vec3f(1.0)), c.y);
}

fn rgb2hsl(c: vec3f) -> vec3f {
    let min_c = min(min(c.r, c.g), c.b);
    let max_c = max(max(c.r, c.g), c.b);
    let l = (min_c + max_c) * 0.5;
    var h: f32 = 0.0;
    var s: f32 = 0.0;
    if (min_c != max_c) {
        let d = max_c - min_c;
        s = select(d / (2.0 - max_c - min_c), d / (max_c + min_c), l > 0.5);
        if (max_c == c.r) {
            h = (c.g - c.b) / d + select(0.0, 6.0, c.g < c.b);
        } else if (max_c == c.g) {
            h = (c.b - c.r) / d + 2.0;
        } else {
            h = (c.r - c.g) / d + 4.0;
        }
        h /= 6.0;
    }
    return vec3f(h, s, l);
}

fn hsl2rgb(c: vec3f) -> vec3f {
    if (c.y == 0.0) {
        return vec3f(c.z);
    }
    let q = select(c.z * (1.0 + c.y), c.z + c.y - c.z * c.y, c.z < 0.5);
    let p = 2.0 * c.z - q;
    let r = hue2rgb(p, q, c.x + 1.0 / 3.0);
    let g = hue2rgb(p, q, c.x);
    let b = hue2rgb(p, q, c.x - 1.0 / 3.0);
    return vec3f(r, g, b);
}

fn hue2rgb(p: f32, q: f32, mut t: f32) -> f32 {
    t = select(t - 1.0, t, t < 0.0);
    t = select(t + 1.0, t, t > 1.0);
    if (t < 1.0 / 6.0) { return p + (q - p) * 6.0 * t; }
    if (t < 1.0 / 2.0) { return q; }
    if (t < 2.0 / 3.0) { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
    return p;
}

fn luminance(c: vec3f) -> f32 {
    return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

fn gaussian(x: f32, sigma: f32) -> f32 {
    return exp(-(x * x) / (2.0 * sigma * sigma));
}

fn smootherstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn hash(p: vec2f) -> f32 {
    return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise2d(p: vec2f) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2f(1.0, 0.0)), u.x),
        mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u.x),
        u.y
    );
}

fn fbm(p: vec2f, octaves: u32) -> f32 {
    var value: f32 = 0.0;
    var amplitude: f32 = 0.5;
    var frequency: f32 = 1.0;
    for (var i: u32 = 0u; i < octaves; i++) {
        value += amplitude * noise2d(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}
"#;
