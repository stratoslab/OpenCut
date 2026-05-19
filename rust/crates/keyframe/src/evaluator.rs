use crate::types::{EasingType, Keyframe, KeyframeChannel};

const FORWARD_SEARCH_LIMIT: usize = 4;
const NEWTON_RAPHSON_ITERATIONS: u32 = 8;
const NEWTON_RAPHSON_EPSILON: f64 = 1e-6;

pub struct KeyframeEvaluator {
    channels: Vec<KeyframeChannel>,
    cache: ChannelCache,
}

struct ChannelCache {
    entries: Vec<CacheEntry>,
}

struct CacheEntry {
    last_index: usize,
    last_time: f64,
}

impl KeyframeEvaluator {
    pub fn new(channels: Vec<KeyframeChannel>) -> Self {
        let cache = ChannelCache {
            entries: channels
                .iter()
                .map(|_| CacheEntry {
                    last_index: 0,
                    last_time: 0.0,
                })
                .collect(),
        };
        Self { channels, cache }
    }

    pub fn evaluate(&mut self, channel_id: &str, time: f64) -> f64 {
        let channel_idx = match self.find_channel(channel_id) {
            Some(idx) => idx,
            None => return 0.0,
        };

        let channel = &self.channels[channel_idx];
        if channel.keyframes.is_empty() {
            return 0.0;
        }

        if time <= channel.keyframes[0].time {
            return channel.keyframes[0].value;
        }
        if time >= channel.keyframes.last().unwrap().time {
            return channel.keyframes.last().unwrap().value;
        }

        let idx = self.find_index_from_cache(channel_idx, time);

        let channel = &self.channels[channel_idx];
        let prev = &channel.keyframes[idx];
        let next = &channel.keyframes[idx + 1];

        self.interpolate(prev, next, time)
    }

    pub fn evaluate_all(&mut self, time: f64) -> Vec<(String, f64)> {
        let count = self.channels.len();
        let mut results = Vec::with_capacity(count);

        for channel_idx in 0..count {
            let channel = &self.channels[channel_idx];
            let id = channel.id.clone();

            if channel.keyframes.is_empty() {
                results.push((id, 0.0));
                continue;
            }
            if time <= channel.keyframes[0].time {
                results.push((id, channel.keyframes[0].value));
                continue;
            }
            if time >= channel.keyframes.last().unwrap().time {
                results.push((id, channel.keyframes.last().unwrap().value));
                continue;
            }

            let idx = self.find_index_from_cache(channel_idx, time);
            let channel = &self.channels[channel_idx];
            let prev = &channel.keyframes[idx];
            let next = &channel.keyframes[idx + 1];
            let value = self.interpolate(prev, next, time);
            results.push((id, value));
        }

        results
    }

    fn find_channel(&self, channel_id: &str) -> Option<usize> {
        self.channels.iter().position(|c| c.id == channel_id)
    }

    fn find_index_from_cache(&mut self, channel_idx: usize, time: f64) -> usize {
        let channel = &self.channels[channel_idx];
        let kf_count = channel.keyframes.len();

        if kf_count <= 1 {
            return 0;
        }

        let cache = &mut self.cache.entries[channel_idx];

        if cache.last_index + 1 < kf_count {
            let prev_time = channel.keyframes[cache.last_index].time;
            let next_time = channel.keyframes[cache.last_index + 1].time;

            if time >= prev_time && time <= next_time {
                cache.last_time = time;
                return cache.last_index;
            }
        }

        if time >= cache.last_time {
            let start = cache.last_index;
            let end = (start + FORWARD_SEARCH_LIMIT).min(kf_count - 2);
            for i in start..=end {
                if time >= channel.keyframes[i].time && time <= channel.keyframes[i + 1].time {
                    cache.last_index = i;
                    cache.last_time = time;
                    return i;
                }
            }
        }

        let idx = self.binary_search(channel_idx, time);
        self.cache.entries[channel_idx].last_index = idx;
        self.cache.entries[channel_idx].last_time = time;
        idx
    }

    fn binary_search(&self, channel_idx: usize, time: f64) -> usize {
        let channel = &self.channels[channel_idx];
        let mut lo = 0;
        let mut hi = channel.keyframes.len() - 2;

        while lo <= hi {
            let mid = lo + (hi - lo) / 2;
            if time >= channel.keyframes[mid].time && time <= channel.keyframes[mid + 1].time {
                return mid;
            } else if time < channel.keyframes[mid].time {
                hi = mid - 1;
            } else {
                lo = mid + 1;
            }
        }

        lo.min(channel.keyframes.len() - 2)
    }

    fn interpolate(&self, prev: &Keyframe, next: &Keyframe, time: f64) -> f64 {
        let duration = next.time - prev.time;
        if duration <= 0.0 {
            return prev.value;
        }

        let t = (time - prev.time) / duration;

        let eased_t = if let Some(ref bezier_in) = prev.bezier_out {
            if let Some(ref bezier_out) = next.bezier_in {
                self.newton_raphson_bezier(t, *bezier_in, *bezier_out)
            } else {
                t
            }
        } else {
            let easing = next.easing.or(Some(EasingType::Linear)).unwrap();
            easing.apply(t)
        };

        prev.value + (next.value - prev.value) * eased_t
    }

    fn newton_raphson_bezier(
        &self,
        target_x: f64,
        p1: crate::types::BezierHandle,
        p2: crate::types::BezierHandle,
    ) -> f64 {
        let mut t = target_x;

        for _ in 0..NEWTON_RAPHSON_ITERATIONS {
            let x = self.cubic_bezier_x(t, p1.x, p2.x);
            let dx = self.cubic_bezier_x_derivative(t, p1.x, p2.x);

            if dx.abs() < NEWTON_RAPHSON_EPSILON {
                break;
            }

            let diff = x - target_x;
            if diff.abs() < NEWTON_RAPHSON_EPSILON {
                break;
            }

            t -= diff / dx;
            t = t.clamp(0.0, 1.0);
        }

        self.cubic_bezier_y(t, p1.y, p2.y)
    }

    fn cubic_bezier_x(&self, t: f64, p1x: f64, p2x: f64) -> f64 {
        let mt = 1.0 - t;
        3.0 * mt * mt * t * p1x + 3.0 * mt * t * t * p2x + t * t * t
    }

    fn cubic_bezier_x_derivative(&self, t: f64, p1x: f64, p2x: f64) -> f64 {
        let mt = 1.0 - t;
        3.0 * mt * mt * p1x + 6.0 * mt * t * (p2x - p1x) + 3.0 * t * t * (1.0 - p2x)
    }

    fn cubic_bezier_y(&self, t: f64, p1y: f64, p2y: f64) -> f64 {
        let mt = 1.0 - t;
        3.0 * mt * mt * t * p1y + 3.0 * mt * t * t * p2y + t * t * t
    }

    pub fn channels(&self) -> &[KeyframeChannel] {
        &self.channels
    }

    pub fn channels_mut(&mut self) -> &mut [KeyframeChannel] {
        &mut self.channels
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Keyframe;

    fn make_kf(id: &str, time: f64, value: f64) -> Keyframe {
        Keyframe {
            id: id.to_string(),
            time,
            value,
            easing: None,
            bezier_in: None,
            bezier_out: None,
        }
    }

    #[test]
    fn test_linear_interpolation() {
        let mut channel = KeyframeChannel::new("ch1".into(), "opacity".into());
        channel.add_keyframe(make_kf("a", 0.0, 0.0));
        channel.add_keyframe(make_kf("b", 1.0, 100.0));

        let mut evaluator = KeyframeEvaluator::new(vec![channel]);
        assert!((evaluator.evaluate("ch1", 0.5) - 50.0).abs() < 0.001);
        assert!((evaluator.evaluate("ch1", 0.25) - 25.0).abs() < 0.001);
        assert!((evaluator.evaluate("ch1", 0.75) - 75.0).abs() < 0.001);
    }

    #[test]
    fn test_cache_hit_sequential() {
        let mut channel = KeyframeChannel::new("ch1".into(), "x".into());
        for i in 0..100 {
            channel.add_keyframe(make_kf(&format!("kf{i}"), i as f64, i as f64 * 10.0));
        }

        let mut evaluator = KeyframeEvaluator::new(vec![channel]);

        for i in 0..50 {
            let time = i as f64 + 0.5;
            let expected = time * 10.0;
            let actual = evaluator.evaluate("ch1", time);
            assert!((actual - expected).abs() < 0.001, "time={time}, expected={expected}, actual={actual}");
        }
    }

    #[test]
    fn test_cache_seek_backward() {
        let mut channel = KeyframeChannel::new("ch1".into(), "y".into());
        for i in 0..20 {
            channel.add_keyframe(make_kf(&format!("kf{i}"), i as f64, i as f64));
        }

        let mut evaluator = KeyframeEvaluator::new(vec![channel]);

        evaluator.evaluate("ch1", 15.0);
        let result = evaluator.evaluate("ch1", 5.0);
        assert!((result - 5.0).abs() < 0.001);
    }

    #[test]
    fn test_before_first_keyframe() {
        let mut channel = KeyframeChannel::new("ch1".into(), "scale".into());
        channel.add_keyframe(make_kf("a", 1.0, 50.0));
        channel.add_keyframe(make_kf("b", 2.0, 100.0));

        let mut evaluator = KeyframeEvaluator::new(vec![channel]);
        assert!((evaluator.evaluate("ch1", 0.0) - 50.0).abs() < 0.001);
        assert!((evaluator.evaluate("ch1", 0.5) - 50.0).abs() < 0.001);
    }

    #[test]
    fn test_after_last_keyframe() {
        let mut channel = KeyframeChannel::new("ch1".into(), "scale".into());
        channel.add_keyframe(make_kf("a", 1.0, 50.0));
        channel.add_keyframe(make_kf("b", 2.0, 100.0));

        let mut evaluator = KeyframeEvaluator::new(vec![channel]);
        assert!((evaluator.evaluate("ch1", 3.0) - 100.0).abs() < 0.001);
        assert!((evaluator.evaluate("ch1", 10.0) - 100.0).abs() < 0.001);
    }

    #[test]
    fn test_easing_functions() {
        let mut channel = KeyframeChannel::new("ch1".into(), "opacity".into());
        let kf1 = make_kf("a", 0.0, 0.0);
        let mut kf2 = make_kf("b", 1.0, 100.0);
        kf2.easing = Some(EasingType::EaseInOut);
        channel.add_keyframe(kf1);
        channel.add_keyframe(kf2);

        let mut evaluator = KeyframeEvaluator::new(vec![channel]);
        let value = evaluator.evaluate("ch1", 0.5);
        assert!((value - 50.0).abs() < 0.001);

        let value_early = evaluator.evaluate("ch1", 0.25);
        assert!(value_early < 25.0, "ease-in-out should be slower at start: {value_early}");
    }

    #[test]
    fn test_bezier_interpolation() {
        use crate::types::BezierHandle;

        let mut channel = KeyframeChannel::new("ch1".into(), "x".into());
        let mut kf1 = make_kf("a", 0.0, 0.0);
        kf1.bezier_out = Some(BezierHandle { x: 0.42, y: 0.0 });
        let mut kf2 = make_kf("b", 1.0, 100.0);
        kf2.bezier_in = Some(BezierHandle { x: 0.58, y: 1.0 });
        channel.add_keyframe(kf1);
        channel.add_keyframe(kf2);

        let mut evaluator = KeyframeEvaluator::new(vec![channel]);
        let value = evaluator.evaluate("ch1", 0.5);
        assert!(value > 0.0 && value < 100.0, "bezier value should be in range: {value}");
    }

    #[test]
    fn test_evaluate_all() {
        let mut ch1 = KeyframeChannel::new("ch1".into(), "x".into());
        ch1.add_keyframe(make_kf("a", 0.0, 0.0));
        ch1.add_keyframe(make_kf("b", 1.0, 100.0));

        let mut ch2 = KeyframeChannel::new("ch2".into(), "y".into());
        ch2.add_keyframe(make_kf("c", 0.0, 50.0));
        ch2.add_keyframe(make_kf("d", 1.0, 150.0));

        let mut evaluator = KeyframeEvaluator::new(vec![ch1, ch2]);
        let results = evaluator.evaluate_all(0.5);

        assert_eq!(results.len(), 2);
        assert!((results[0].1 - 50.0).abs() < 0.001);
        assert!((results[1].1 - 100.0).abs() < 0.001);
    }

    #[test]
    fn test_empty_channel() {
        let channel = KeyframeChannel::new("ch1".into(), "x".into());
        let mut evaluator = KeyframeEvaluator::new(vec![channel]);
        assert!((evaluator.evaluate("ch1", 0.5) - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_single_keyframe() {
        let mut channel = KeyframeChannel::new("ch1".into(), "x".into());
        channel.add_keyframe(make_kf("a", 0.0, 42.0));

        let mut evaluator = KeyframeEvaluator::new(vec![channel]);
        assert!((evaluator.evaluate("ch1", 0.0) - 42.0).abs() < 0.001);
        assert!((evaluator.evaluate("ch1", 10.0) - 42.0).abs() < 0.001);
    }

    #[test]
    fn test_property_based_consistency() {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        let mut channel = KeyframeChannel::new("ch1".into(), "x".into());
        let mut times: Vec<f64> = (0..20).map(|i| i as f64).collect();
        times.sort_by(|a, b| a.partial_cmp(b).unwrap());

        for (i, &t) in times.iter().enumerate() {
            channel.add_keyframe(make_kf(&format!("kf{i}"), t, rng.gen_range(0.0..1000.0)));
        }

        let mut evaluator = KeyframeEvaluator::new(vec![channel.clone()]);

        for _ in 0..100 {
            let time = rng.gen_range(0.0..19.0);

            let cached = evaluator.evaluate("ch1", time);

            let mut no_cache_evaluator = KeyframeEvaluator::new(vec![channel.clone()]);
            let reference = no_cache_evaluator.evaluate("ch1", time);

            assert!(
                (cached - reference).abs() < 0.001,
                "cached={cached}, reference={reference}, time={time}"
            );
        }
    }

    #[test]
    fn proptest_cache_consistency() {
        use proptest::prelude::*;

        proptest!(|(
            num_keyframes in 2usize..50,
            times in prop::collection::vec(0.0f64..100.0, 2..50),
            values in prop::collection::vec(-1000.0f64..1000.0, 2..50),
            query_times in prop::collection::vec(0.0f64..100.0, 1..100),
        )| {
            let n = num_keyframes.min(times.len()).min(values.len());
            let mut sorted_times: Vec<(f64, f64)> = times.iter().zip(values.iter()).take(n).map(|(t, v)| (*t, *v)).collect();
            sorted_times.sort_by(|a, b| a.0.total_cmp(&b.0));
            sorted_times.dedup_by(|a, b| (a.0 - b.0).abs() < 0.001);

            if sorted_times.len() < 2 {
                return Ok(());
            }

            let mut channel = KeyframeChannel::new("ch1".into(), "x".into());
            for (i, (t, v)) in sorted_times.iter().enumerate() {
                channel.add_keyframe(Keyframe {
                    id: format!("kf{i}"),
                    time: *t,
                    value: *v,
                    easing: None,
                    bezier_in: None,
                    bezier_out: None,
                });
            }

            let mut evaluator = KeyframeEvaluator::new(vec![channel.clone()]);

            for &qt in &query_times {
                let cached = evaluator.evaluate("ch1", qt);
                let mut ref_eval = KeyframeEvaluator::new(vec![channel.clone()]);
                let reference = ref_eval.evaluate("ch1", qt);

                prop_assert!(
                    (cached - reference).abs() < 0.001,
                    "cached={cached}, reference={reference}, time={qt}"
                );
            }
        });
    }

    #[test]
    fn proptest_monotonic_time_order() {
        use proptest::prelude::*;

        proptest!(|(
            keyframe_count in 2usize..30,
            base_times in prop::collection::vec(0.0f64..1000.0, 2..30),
        )| {
            let n = keyframe_count.min(base_times.len());
            let mut times: Vec<f64> = base_times.into_iter().take(n).collect();
            times.sort_by(|a, b| a.total_cmp(b));

            let mut channel = KeyframeChannel::new("ch1".into(), "x".into());
            for (i, &t) in times.iter().enumerate() {
                channel.add_keyframe(Keyframe {
                    id: format!("kf{i}"),
                    time: t,
                    value: i as f64,
                    easing: None,
                    bezier_in: None,
                    bezier_out: None,
                });
            }

            let mut evaluator = KeyframeEvaluator::new(vec![channel]);

            for i in 0..times.len() - 1 {
                let mid = (times[i] + times[i + 1]) / 2.0;
                let val = evaluator.evaluate("ch1", mid);
                prop_assert!(val >= i as f64 && val <= (i + 1) as f64,
                    "value at midpoint should be between keyframe values: {val} not in [{i}, {}]", i + 1);
            }
        });
    }
}
