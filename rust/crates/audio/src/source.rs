use std::collections::BTreeMap;
use std::cmp::Ordering;

const DEFAULT_MAX_BUFFER_SAMPLES: usize = 4_194_304;

#[derive(Debug, Clone, Copy, PartialEq)]
struct OrderedF64(f64);

impl Eq for OrderedF64 {}

impl PartialOrd for OrderedF64 {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for OrderedF64 {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.total_cmp(&other.0)
    }
}

#[derive(Debug, Clone)]
pub struct AudioSegment {
    pub start_time: f64,
    pub end_time: f64,
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

impl AudioSegment {
    pub fn duration(&self) -> f64 {
        self.end_time - self.start_time
    }

    pub fn sample_count(&self) -> usize {
        self.samples.len()
    }

    pub fn time_to_index(&self, time: f64) -> Option<usize> {
        if time < self.start_time || time >= self.end_time {
            return None;
        }
        let offset = (time - self.start_time) * self.sample_rate as f64;
        let idx = offset.floor() as usize;
        if idx < self.samples.len() {
            Some(idx)
        } else {
            None
        }
    }
}

pub struct AudioClipSource {
    segments: BTreeMap<OrderedF64, AudioSegment>,
    max_buffer_samples: usize,
    total_samples: usize,
}

impl AudioClipSource {
    pub fn new(max_buffer_samples: usize) -> Self {
        Self {
            segments: BTreeMap::new(),
            max_buffer_samples,
            total_samples: 0,
        }
    }

    pub fn default() -> Self {
        Self::new(DEFAULT_MAX_BUFFER_SAMPLES)
    }

    pub fn update_buffer(&mut self, segment: AudioSegment) {
        let start_time = OrderedF64(segment.start_time);
        let sample_count = segment.sample_count();

        if let Some(existing) = self.segments.get(&start_time) {
            self.total_samples = self.total_samples.saturating_sub(existing.sample_count());
        }

        self.segments.insert(start_time, segment);
        self.total_samples += sample_count;

        self.evict_if_needed();
    }

    pub fn evict_furthest_from(&mut self, playhead_time: f64) {
        if self.segments.is_empty() {
            return;
        }

        let furthest_key = self
            .segments
            .keys()
            .max_by(|a, b| {
                let dist_a = ((a.0 - playhead_time).abs() * 1_000_000.0) as u64;
                let dist_b = ((b.0 - playhead_time).abs() * 1_000_000.0) as u64;
                dist_a.cmp(&dist_b)
            })
            .copied();

        if let Some(key) = furthest_key {
            if let Some(segment) = self.segments.remove(&key) {
                self.total_samples = self.total_samples.saturating_sub(segment.sample_count());
            }
        }
    }

    fn evict_if_needed(&mut self) {
        while self.total_samples > self.max_buffer_samples && !self.segments.is_empty() {
            if let Some((key, _)) = self.segments.iter().next() {
                let key = *key;
                if let Some(segment) = self.segments.remove(&key) {
                    self.total_samples = self.total_samples.saturating_sub(segment.sample_count());
                }
            } else {
                break;
            }
        }
    }

    pub fn get_sample(&self, time: f64) -> Option<f32> {
        let search = OrderedF64(time);
        let prev_seg = self
            .segments
            .range(..=search)
            .next_back()
            .map(|(_, v)| v)?;

        if let Some(idx) = prev_seg.time_to_index(time) {
            if idx + 1 < prev_seg.samples.len() {
                let offset = (time - prev_seg.start_time) * prev_seg.sample_rate as f64;
                let frac = offset - idx as f64;
                let s0 = prev_seg.samples[idx];
                let s1 = prev_seg.samples[idx + 1];
                return Some(s0 + (s1 - s0) * frac as f32);
            } else if idx < prev_seg.samples.len() {
                return Some(prev_seg.samples[idx]);
            }
        }

        let next_seg = self.segments.range(search..).next().map(|(_, v)| v);
        if let Some(next_seg) = next_seg {
            if let Some(idx) = next_seg.time_to_index(time) {
                if idx < next_seg.samples.len() {
                    return Some(next_seg.samples[idx]);
                }
            }
        }

        None
    }

    pub fn get_samples(&self, start_time: f64, end_time: f64) -> Vec<f32> {
        let mut result = Vec::new();
        let mut current_time = start_time;

        while current_time < end_time {
            if let Some(sample) = self.get_sample(current_time) {
                result.push(sample);
            }
            let seg = self
                .segments
                .range(..=OrderedF64(current_time))
                .next_back()
                .map(|(_, v)| v);

            if let Some(seg) = seg {
                let samples_per_second = seg.sample_rate as f64;
                current_time += 1.0 / samples_per_second;
            } else {
                break;
            }
        }

        result
    }

    pub fn has_sample_at(&self, time: f64) -> bool {
        let search = OrderedF64(time);
        self.segments
            .range(..=search)
            .next_back()
            .map(|(_, seg)| seg.time_to_index(time).is_some())
            .unwrap_or(false)
    }

    pub fn total_samples(&self) -> usize {
        self.total_samples
    }

    pub fn segment_count(&self) -> usize {
        self.segments.len()
    }

    pub fn clear(&mut self) {
        self.segments.clear();
        self.total_samples = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_segment(start: f64, duration: f64, sample_rate: u32, value: f32) -> AudioSegment {
        let count = (duration * sample_rate as f64) as usize;
        AudioSegment {
            start_time: start,
            end_time: start + duration,
            samples: vec![value; count],
            sample_rate,
        }
    }

    fn make_ramp_segment(start: f64, duration: f64, sample_rate: u32) -> AudioSegment {
        let count = (duration * sample_rate as f64) as usize;
        let samples: Vec<f32> = (0..count)
            .map(|i| i as f32 / count as f32)
            .collect();
        AudioSegment {
            start_time: start,
            end_time: start + duration,
            samples,
            sample_rate,
        }
    }

    #[test]
    fn test_get_sample_exact() {
        let mut source = AudioClipSource::default();
        source.update_buffer(make_segment(0.0, 1.0, 48000, 0.5));

        let sample = source.get_sample(0.0).unwrap();
        assert!((sample - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_get_sample_interpolated() {
        let mut source = AudioClipSource::default();
        source.update_buffer(make_ramp_segment(0.0, 1.0, 48000));

        let sample_mid = source.get_sample(0.5).unwrap();
        assert!((sample_mid - 0.5).abs() < 0.01, "expected ~0.5, got {sample_mid}");
    }

    #[test]
    fn test_get_sample_outside_range() {
        let mut source = AudioClipSource::default();
        source.update_buffer(make_segment(1.0, 1.0, 48000, 0.5));

        assert!(source.get_sample(0.0).is_none());
        assert!(source.get_sample(2.5).is_none());
    }

    #[test]
    fn test_update_buffer_replace() {
        let mut source = AudioClipSource::default();
        source.update_buffer(make_segment(0.0, 1.0, 48000, 0.3));
        source.update_buffer(make_segment(0.0, 1.0, 48000, 0.7));

        let sample = source.get_sample(0.5).unwrap();
        assert!((sample - 0.7).abs() < 0.001);
        assert_eq!(source.segment_count(), 1);
    }

    #[test]
    fn test_evict_furthest() {
        let mut source = AudioClipSource::new(50_000);

        source.update_buffer(make_segment(0.0, 0.5, 48000, 0.1));
        source.update_buffer(make_segment(1.0, 0.5, 48000, 0.2));
        source.update_buffer(make_segment(2.0, 0.5, 48000, 0.3));
        source.update_buffer(make_segment(10.0, 0.5, 48000, 0.4));

        assert!(source.segment_count() <= 2, "auto-eviction should have occurred");

        source.evict_furthest_from(2.0);

        assert!(source.has_sample_at(2.0));
        assert!(!source.has_sample_at(10.0));
    }

    #[test]
    fn test_buffer_size_limit() {
        let mut source = AudioClipSource::new(50_000);

        for i in 0..10 {
            let start = i as f64 * 0.1;
            source.update_buffer(make_segment(start, 0.1, 48000, i as f32));
        }

        assert!(source.total_samples() <= 50_000);
    }

    #[test]
    fn test_multiple_segments_adjacent() {
        let mut source = AudioClipSource::default();
        source.update_buffer(make_segment(0.0, 1.0, 48000, 0.1));
        source.update_buffer(make_segment(1.0, 1.0, 48000, 0.2));
        source.update_buffer(make_segment(2.0, 1.0, 48000, 0.3));

        assert!((source.get_sample(0.5).unwrap() - 0.1).abs() < 0.001);
        assert!((source.get_sample(1.5).unwrap() - 0.2).abs() < 0.001);
        assert!((source.get_sample(2.5).unwrap() - 0.3).abs() < 0.001);
    }

    #[test]
    fn test_clear() {
        let mut source = AudioClipSource::default();
        source.update_buffer(make_segment(0.0, 1.0, 48000, 0.5));
        source.clear();

        assert_eq!(source.total_samples(), 0);
        assert_eq!(source.segment_count(), 0);
        assert!(source.get_sample(0.5).is_none());
    }

    #[test]
    fn proptest_buffer_size_invariant() {
        use proptest::prelude::*;

        proptest!(|(
            segment_count in 1usize..20,
            durations in prop::collection::vec(0.01f64..2.0, 1..20),
            start_times in prop::collection::vec(0.0f64..100.0, 1..20),
        )| {
            let max_samples = 100_000;
            let mut source = AudioClipSource::new(max_samples);
            let n = segment_count.min(durations.len()).min(start_times.len());

            for i in 0..n {
                let count = (durations[i] * 48000.0) as usize;
                let segment = AudioSegment {
                    start_time: start_times[i],
                    end_time: start_times[i] + durations[i],
                    samples: vec![i as f32; count],
                    sample_rate: 48000,
                };
                source.update_buffer(segment);
            }

            prop_assert!(source.total_samples() <= max_samples,
                "total_samples {} exceeds max {}", source.total_samples(), max_samples);
        });
    }

    #[test]
    fn proptest_sample_interpolation_bounds() {
        use proptest::prelude::*;

        proptest!(|(
            start_time in 0.0f64..50.0,
            duration in 0.1f64..5.0,
            value in -1.0f32..1.0,
        )| {
            let count = (duration * 48000.0) as usize;
            let samples: Vec<f32> = (0..count).map(|i| {
                let t = i as f32 / count as f32;
                value * t
            }).collect();

            let segment = AudioSegment {
                start_time,
                end_time: start_time + duration,
                samples,
                sample_rate: 48000,
            };

            let mut source = AudioClipSource::default();
            source.update_buffer(segment);

            for offset in 0..10 {
                let time = start_time + offset as f64 / 48000.0;
                if let Some(sample) = source.get_sample(time) {
                    prop_assert!(sample.is_finite(), "sample should be finite: {sample}");
                    prop_assert!(sample.abs() <= value.abs() + 0.001,
                        "sample {sample} exceeds expected bounds");
                }
            }
        });
    }
}
