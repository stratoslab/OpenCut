// Shared library functions (from common.wgsl)
const PI: f32 = 3.14159265358979323846;
const TAU: f32 = 6.28318530717958647693;

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

fn luminance(c: vec3f) -> f32 {
    return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct TransitionUniforms {
    transition_type: u32,
    progress: f32,
    direction: f32,
    intensity: f32,
}

@group(0) @binding(0) var clip_a: texture_2d<f32>;
@group(0) @binding(1) var clip_a_sampler: sampler;
@group(1) @binding(0) var clip_b: texture_2d<f32>;
@group(1) @binding(1) var clip_b_sampler: sampler;
@group(2) @binding(0) var<uniform> uniforms: TransitionUniforms;

fn clamp01(color: vec3f) -> vec3f {
    return clamp(color, vec3f(0.0), vec3f(1.0));
}

fn crossfade(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    _ = uv;
    return mix(a, b, uniforms.progress);
}

fn slide(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let offset = uniforms.progress;
    let dir = uniforms.direction;

    if (dir < 0.5) {
        let a_uv = uv + vec2f(offset, 0.0);
        if (a_uv.x > 1.0) {
            return textureSample(clip_b, clip_b_sampler, uv - vec2f(1.0 - offset, 0.0));
        }
        return textureSample(clip_a, clip_a_sampler, a_uv);
    } else if (dir < 1.5) {
        let b_uv = uv - vec2f(offset, 0.0);
        if (b_uv.x < 0.0) {
            return textureSample(clip_a, clip_a_sampler, uv + vec2f(1.0 - offset, 0.0));
        }
        return textureSample(clip_b, clip_b_sampler, b_uv);
    } else if (dir < 2.5) {
        let a_uv = uv + vec2f(0.0, offset);
        if (a_uv.y > 1.0) {
            return textureSample(clip_b, clip_b_sampler, uv - vec2f(0.0, 1.0 - offset));
        }
        return textureSample(clip_a, clip_a_sampler, a_uv);
    } else {
        let b_uv = uv - vec2f(0.0, offset);
        if (b_uv.y < 0.0) {
            return textureSample(clip_a, clip_a_sampler, uv + vec2f(0.0, 1.0 - offset));
        }
        return textureSample(clip_b, clip_b_sampler, b_uv);
    }
}

fn wipe(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let threshold = uniforms.progress;
    let dir = uniforms.direction;

    if (dir < 0.5) {
        return select(a, b, uv.x < threshold);
    } else {
        return select(a, b, uv.x > (1.0 - threshold));
    }
}

fn iris(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let center = vec2f(0.5, 0.5);
    let dist = length(uv - center);
    let radius = uniforms.progress * 0.75;
    return select(a, b, dist < radius);
}

fn clockWipe(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let center = vec2f(0.5, 0.5);
    let angle = atan2(uv.y - center.y, uv.x - center.x);
    let normalized = (angle + 3.14159265) / 6.28318530;
    return select(a, b, normalized < uniforms.progress);
}

fn glitch(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let glitchAmount = sin(uniforms.progress * 3.14159265) * uniforms.intensity;
    let slice = floor(uv.y * 20.0) / 20.0;
    let offset = sin(slice * 10.0 + uniforms.progress * 20.0) * glitchAmount * 0.05;

    let a_uv = clamp(uv + vec2f(offset, 0.0), vec2f(0.0), vec2f(1.0));
    let b_uv = clamp(uv - vec2f(offset, 0.0), vec2f(0.0), vec2f(1.0));

    let r = textureSample(clip_b, clip_b_sampler, b_uv).r;
    let g = mix(
        textureSample(clip_a, clip_a_sampler, a_uv).g,
        textureSample(clip_b, clip_b_sampler, b_uv).g,
        uniforms.progress,
    );
    let b_ch = textureSample(clip_a, clip_a_sampler, a_uv).b;

    return vec4f(r, g, b_ch, 1.0);
}

fn dissolve(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let n = fbm(uv * 8.0, 4u);
    let edgeSoftness = 0.45;
    let threshold = uniforms.progress;
    let t = smoothstep(threshold - edgeSoftness, threshold + edgeSoftness, n);
    let edgeDist = abs(n - threshold);
    let edge = edgeSoftness;
    let edgeGlow = exp(-edgeDist * edgeDist / (edge * edge * 2.0)) * 0.15 * sin(uniforms.progress * PI);
    let color = mix(b, a, t);
    return vec4f(min(color.rgb + edgeGlow, vec3f(1.0)), color.a);
}

fn rotateVec2(v: vec2f, angle: f32) -> vec2f {
    let c = cos(angle);
    let s = sin(angle);
    return vec2f(v.x * c - v.y * s, v.x * s + v.y * c);
}

fn sparkleShape(local: vec2f, size: f32) -> f32 {
    let absLocal = abs(local);
    let core = smoothstep(size * 0.34, 0.0, length(local));
    let horizontal = smoothstep(size * 0.14, 0.0, absLocal.y) * smoothstep(size, 0.0, absLocal.x);
    let vertical = smoothstep(size * 0.14, 0.0, absLocal.x) * smoothstep(size, 0.0, absLocal.y);
    let diagonalA = smoothstep(size * 0.22, 0.0, abs(local.x - local.y)) * smoothstep(size * 0.9, 0.0, length(local));
    let diagonalB = smoothstep(size * 0.22, 0.0, abs(local.x + local.y)) * smoothstep(size * 0.9, 0.0, length(local));
    return max(core, max(horizontal, max(vertical, max(diagonalA, diagonalB) * 0.7)));
}

fn sparkleLayer(scaledUv: vec2f, progress: f32, density: f32, sizeBase: f32, sizeVariance: f32, motionScale: f32, threshold: f32, phase: f32) -> vec4f {
    let cellUv = scaledUv * density;
    let cell = floor(cellUv);
    let local = fract(cellUv) - vec2f(0.5, 0.5);
    let seed = hash(cell + vec2f(phase * 1.37, phase * 2.11));
    let centerSeed = vec2f(hash(cell + vec2f(phase + 1.7, phase + 6.2)), hash(cell + vec2f(phase + 8.4, phase + 3.1))) - vec2f(0.5, 0.5);
    let sizeSeed = hash(cell + vec2f(phase + 2.4, phase + 9.7));
    let orbitSeed = hash(cell + vec2f(phase + 4.6, phase + 11.2));
    let ignitePoint = clamp(0.04 + (seed * 0.72) + (noise2d(cell * 0.17 + vec2f(progress * 0.31, progress * 0.67)) * 0.16), 0.04, 0.94);
    let igniteDuration = 0.14 + (sizeSeed * 0.18);
    let igniteProgress = clamp((progress - ignitePoint) / igniteDuration, 0.0, 1.0);
    let igniteIn = smoothstep(0.0, 0.16, igniteProgress);
    let igniteOut = 1.0 - smoothstep(0.3, 0.95, igniteProgress);
    let pulse = igniteIn * igniteOut;
    let afterglow = smoothstep(0.06, 0.72, igniteProgress);
    let directionAngle = seed * TAU;
    let direction = vec2f(cos(directionAngle), sin(directionAngle));
    let motionEnvelope = pulse * (0.6 + (0.4 * sin(progress * PI)));
    let drift = direction * motionScale * (0.42 + (sizeSeed * 1.45)) * motionEnvelope;
    let orbit = rotateVec2(vec2f(0.0, 1.0), directionAngle + (igniteProgress * (1.5 + (orbitSeed * 2.6)) * PI)) * motionScale * 0.62 * (0.28 + orbitSeed) * motionEnvelope;
    let center = (centerSeed * 0.72) + drift + orbit;
    let rotation = (seed * TAU) + (igniteProgress * (1.2 + (sizeSeed * 3.1)) * PI);
    let size = sizeBase + (sizeSeed * sizeVariance);
    let twinkle = 0.35 + (0.65 * ((sin((igniteProgress * (2.8 + (sizeSeed * 4.5)) + seed) * TAU) + 1.0) * 0.5));
    let activation = smoothstep(threshold, 1.0, seed);
    let starLocal = rotateVec2(local - center, rotation);
    let main = sparkleShape(starLocal, size) * activation * twinkle * pulse;
    let trailCenter = center - direction * motionScale * (0.6 + sizeSeed) * (0.25 + (pulse * 0.95));
    let trailLocal = rotateVec2(local - trailCenter, rotation - 0.4);
    let trailShape = vec2f(trailLocal.x * 1.7, trailLocal.y * 0.58);
    let trail = sparkleShape(trailShape, size * 0.72) * activation * twinkle * pulse * (0.42 + (sizeSeed * 0.28));
    let dustNoise = noise2d(cell * 0.85 + vec2f((igniteProgress * 4.2) + phase, phase * 0.37));
    let dust = smoothstep(0.62, 1.0, dustNoise) * afterglow * activation * (0.16 + (sizeSeed * 0.34));
    let reveal = clamp((main * 0.72) + (trail * 0.34) + (afterglow * activation * 0.24) + (dust * 0.12), 0.0, 1.0);
    let glow = max(main, trail * 0.88) * (0.65 + (sizeSeed * 0.75)) + (dust * 0.3);
    return vec4f(main, reveal, glow, seed);
}

fn sparkles(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let p = uniforms.progress;
    let aspect = 1.0;
    let scaledUv = vec2f(uv.x * aspect, uv.y);
    let coarseLayer = sparkleLayer(scaledUv, p, 10.5, 0.15, 0.28, 0.18, 0.58, 3.7);
    let microLayer = sparkleLayer(scaledUv, p, 19.0, 0.06, 0.14, 0.09, 0.7, 11.4);
    let heroMix = step(microLayer.z, coarseLayer.z);
    let heroSeed = mix(microLayer.w, coarseLayer.w, heroMix);
    let sparkleCore = max(coarseLayer.x, microLayer.x * 0.78);
    let sparkleField = max(coarseLayer.y, microLayer.y * 0.86);
    let glowField = max(coarseLayer.z, microLayer.z * 0.74);
    let macroNoise = fbm(scaledUv * 3.5 + vec2f(0.0, p * 0.7), 3u);
    let dustNoise = noise2d(scaledUv * 20.0 + vec2f((p * 5.2) + (heroSeed * 3.1), heroSeed * 7.4));
    let dissolveCurve = smoothstep(0.03, 0.97, p);
    let sparkleWindow = smoothstep(0.02, 0.28, p) * (1.0 - smoothstep(0.8, 1.0, p));
    let dustField = smoothstep(0.58, 1.0, dustNoise) * (0.12 + (sparkleField * 0.88)) * sin(p * PI);
    let thresholdMap = clamp((macroNoise * 0.58) + (dustNoise * 0.14) + ((1.0 - sparkleField) * 0.18) + ((1.0 - glowField) * 0.08), 0.0, 1.0);
    let dissolveProgress = clamp((dissolveCurve * 1.08) - 0.04 + (sparkleField * 0.4 * sparkleWindow) + (glowField * 0.18) + (dustField * 0.12), 0.0, 1.0);
    let edge = 0.093;
    let leftPresence = 1.0 - smoothstep(thresholdMap - edge, thresholdMap + edge, dissolveProgress);
    let rightPresence = 1.0 - leftPresence;
    var color = mix(b, a, leftPresence);
    let dissolveEdge = clamp(leftPresence * rightPresence * 4.0, 0.0, 1.0);
    let sparkleEnvelope = sin(p * PI);
    let edgeGlow = dissolveEdge * glowField * uniforms.intensity * (0.5 + (sparkleEnvelope * 0.4));
    let sparkleFlash = sparkleCore * (0.38 + (uniforms.intensity * 0.52)) * (0.62 + (sparkleEnvelope * 0.38));
    let glowColor = mix(vec3f(1.0, 0.97, 0.88), vec3f(1.0, 0.82, 0.56), heroSeed);
    let warmVeil = glowColor * glowField * (0.06 + (rightPresence * 0.12));
    let incomingLift = b.rgb * (glowField * rightPresence * 0.05);
    let lifted = color.rgb + warmVeil + incomingLift + (glowColor * edgeGlow * 0.95) + (glowColor * sparkleFlash * 0.72);
    let compressed = 1.0 - exp(-lifted * (1.0 + (edgeGlow * 0.45)));
    return vec4f(clamp(mix(lifted, compressed, 0.46), vec3f(0.0), vec3f(1.0)), color.a);
}

fn lightLeak(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let p = uniforms.progress;
    let dir = u32(uniforms.direction);
    var sweepPos: f32;
    if (dir == 0u) { sweepPos = uv.x; }
    else if (dir == 1u) { sweepPos = 1.0 - uv.x; }
    else if (dir == 2u) { sweepPos = uv.y; }
    else { sweepPos = 1.0 - uv.y; }
    let crossfadeT = smoothstep(p * 1.4 - 0.3, p * 1.4 + 0.1, sweepPos);
    let base = mix(b, a, crossfadeT);
    let leakCenter = p;
    let leakSigma = 0.3;
    let leakAmount = exp(-pow(sweepPos - leakCenter, 2.0) / (2.0 * leakSigma * leakSigma));
    let noiseVal = noise2d(uv * 4.0 + vec2f(p * 2.0, 0.0));
    let organicLeak = leakAmount * (0.7 + 0.3 * noiseVal);
    let warmth = 0.5;
    let warmColor = mix(vec3f(1.0, 0.95, 0.85), vec3f(1.0, 0.8, 0.5), warmth);
    let envelope = sin(p * PI);
    let leakStrength = organicLeak * uniforms.intensity * envelope;
    let leaked = base.rgb + warmColor * leakStrength;
    let compressed = 1.0 - exp(-leaked * 1.2);
    return vec4f(compressed, base.a);
}

fn pixelate(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let pixelProgress = 1.0 - abs(uniforms.progress * 2.0 - 1.0);
    let curved = pixelProgress * pixelProgress;
    let maxBlockSize: f32 = 48.0;
    let blockPx = max(1.0, curved * maxBlockSize);
    let blockU = blockPx / 1920.0;
    let blockV = blockPx / 1080.0;
    let snappedUv = clamp(floor(uv / vec2f(blockU, blockV)) * vec2f(blockU, blockV) + vec2f(blockU, blockV) * 0.5, vec2f(0.0), vec2f(1.0));
    let left = textureSample(clip_a, clip_a_sampler, snappedUv);
    let right = textureSample(clip_b, clip_b_sampler, snappedUv);
    let t = max(0.0, min(1.0, (uniforms.progress - 0.45) / 0.1));
    let crossfade = t * t * (3.0 - 2.0 * t);
    return mix(left, right, crossfade);
}

fn chromatic(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let p = uniforms.progress;
    let envelope = sin(p * PI);
    let strength = envelope * uniforms.intensity;
    let dir = u32(uniforms.direction);
    var aberrationDir: vec2f;
    if (dir == 0u) { aberrationDir = vec2f(1.0, 0.0); }
    else if (dir == 1u) { aberrationDir = vec2f(-1.0, 0.0); }
    else if (dir == 2u) { aberrationDir = vec2f(0.0, 1.0); }
    else { aberrationDir = vec2f(0.0, -1.0); }
    let spreadAmount = 1.5 * strength * 0.02;
    let rOffset = aberrationDir * spreadAmount * 1.0;
    let gOffset = aberrationDir * 0.0;
    let bOffset = aberrationDir * spreadAmount * -1.0;
    let center = uv - vec2f(0.5);
    let radialOffset = center * strength * 0.01;
    let aR = textureSample(clip_a, clip_a_sampler, clamp(uv + rOffset + radialOffset, vec2f(0.0), vec2f(1.0))).r;
    let aG = textureSample(clip_a, clip_a_sampler, clamp(uv + gOffset, vec2f(0.0), vec2f(1.0))).g;
    let aB = textureSample(clip_a, clip_a_sampler, clamp(uv + bOffset - radialOffset, vec2f(0.0), vec2f(1.0))).b;
    let aA = textureSample(clip_a, clip_a_sampler, uv).a;
    let aColor = vec4f(aR, aG, aB, aA);
    let bR = textureSample(clip_b, clip_b_sampler, clamp(uv + rOffset + radialOffset, vec2f(0.0), vec2f(1.0))).r;
    let bG = textureSample(clip_b, clip_b_sampler, clamp(uv + gOffset, vec2f(0.0), vec2f(1.0))).g;
    let bB = textureSample(clip_b, clip_b_sampler, clamp(uv + bOffset - radialOffset, vec2f(0.0), vec2f(1.0))).b;
    let bA = textureSample(clip_b, clip_b_sampler, uv).a;
    let bColor = vec4f(bR, bG, bB, bA);
    var sweepPos: f32;
    if (dir == 0u) { sweepPos = uv.x; }
    else if (dir == 1u) { sweepPos = 1.0 - uv.x; }
    else if (dir == 2u) { sweepPos = uv.y; }
    else { sweepPos = 1.0 - uv.y; }
    let t = smoothstep(p * 1.3 - 0.15, p * 1.3 + 0.15, sweepPos);
    var color = mix(bColor, aColor, t);
    let edgeDist = abs(sweepPos - p);
    let edgeGlow = exp(-edgeDist * edgeDist * 40.0) * 0.08 * envelope;
    color = vec4f(min(color.rgb + edgeGlow, vec3f(1.0)), color.a);
    return color;
}

fn radialBlur(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let p = uniforms.progress;
    let blurEnvelope = sin(p * PI);
    let strength = blurEnvelope * uniforms.intensity * 0.15;
    let spinAmount = blurEnvelope * 0.3;
    let numSamples: u32 = 12u;
    let center = vec2f(0.5, 0.5);
    let dir = uv - center;
    var aColor = vec4f(0.0);
    var bColor = vec4f(0.0);
    var totalWeight = 0.0;
    for (var i: u32 = 0u; i < numSamples; i++) {
        let t = f32(i) / f32(numSamples - 1u) - 0.5;
        let zoomOffset = dir * t * strength;
        let angle = t * spinAmount;
        let cosA = cos(angle);
        let sinA = sin(angle);
        let rotatedDir = vec2f(dir.x * cosA - dir.y * sinA, dir.x * sinA + dir.y * cosA) - dir;
        let spinOffset = rotatedDir * strength;
        let sampleUv = clamp(uv + zoomOffset + spinOffset, vec2f(0.0), vec2f(1.0));
        let weight = exp(-t * t * 4.0);
        aColor += textureSample(clip_a, clip_a_sampler, sampleUv) * weight;
        bColor += textureSample(clip_b, clip_b_sampler, sampleUv) * weight;
        totalWeight += weight;
    }
    aColor /= totalWeight;
    bColor /= totalWeight;
    let crossfadeT = smoothstep(0.3, 0.7, p);
    var color = mix(aColor, bColor, crossfadeT);
    let vignetteCenter = uv - vec2f(0.5);
    let vignette = 1.0 - dot(vignetteCenter, vignetteCenter) * blurEnvelope * 0.5;
    color = vec4f(color.rgb * vignette, color.a);
    return color;
}

fn flip(a: vec4f, b: vec4f, uv: vec2f) -> vec4f {
    let p = uniforms.progress;
    let dir = u32(uniforms.direction);
    let isHorizontal = (dir == 0u || dir == 1u);
    let midpoint = 0.5;
    let centered = uv - vec2f(0.5, 0.5);
    let flipProgress1 = p / midpoint;
    let flipProgress2 = (p - midpoint) / midpoint;
    let scale1 = max(cos(flipProgress1 * PI * 0.5), 0.001);
    let scale2 = max(sin(flipProgress2 * PI * 0.5), 0.001);
    let scale = select(scale2, scale1, p < midpoint);
    let hDistorted = vec2f(centered.x / scale + 0.5, uv.y);
    let vDistorted = vec2f(uv.x, centered.y / scale + 0.5);
    let distorted = select(vDistorted, hDistorted, isHorizontal);
    let left = textureSample(clip_a, clip_a_sampler, distorted);
    let right = textureSample(clip_b, clip_b_sampler, distorted);
    let oob = distorted.x < 0.0 || distorted.x > 1.0 || distorted.y < 0.0 || distorted.y > 1.0;
    let black = vec4f(0.0, 0.0, 0.0, 1.0);
    let texColor = select(right, left, p < midpoint);
    return select(texColor, black, oob);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let a = textureSample(clip_a, clip_a_sampler, input.tex_coord);
    let b = textureSample(clip_b, clip_b_sampler, input.tex_coord);

    let progress = clamp(uniforms.progress, 0.0, 1.0);

    if (progress <= 0.001) { return a; }
    if (progress >= 0.999) { return b; }

    switch uniforms.transition_type {
        case 0u: { return crossfade(a, b, input.tex_coord); }
        case 1u: { return slide(a, b, input.tex_coord); }
        case 2u: { return wipe(a, b, input.tex_coord); }
        case 3u: { return iris(a, b, input.tex_coord); }
        case 4u: { return clockWipe(a, b, input.tex_coord); }
        case 5u: { return glitch(a, b, input.tex_coord); }
        case 6u: { return dissolve(a, b, input.tex_coord); }
        case 7u: { return sparkles(a, b, input.tex_coord); }
        case 8u: { return lightLeak(a, b, input.tex_coord); }
        case 9u: { return pixelate(a, b, input.tex_coord); }
        case 10u: { return chromatic(a, b, input.tex_coord); }
        case 11u: { return radialBlur(a, b, input.tex_coord); }
        case 12u: { return flip(a, b, input.tex_coord); }
        default: { return crossfade(a, b, input.tex_coord); }
    }
}
