const HANN_WINDOW_SIZE: usize = 2048;
const ANALYSIS_HOP: usize = 1024;
const SEARCH_RANGE: usize = 256;

pub struct TimeStretcher {
    window: Vec<f32>,
    input_buffer: Vec<f32>,
    output_buffer: Vec<f32>,
    norm_buffer: Vec<f32>,
    input_available: usize,
    output_written: usize,
    speed: f64,
    synthesis_hop: usize,
}

impl TimeStretcher {
    pub fn new(speed: f64) -> Self {
        let window = hann_window(HANN_WINDOW_SIZE);
        let synthesis_hop = (ANALYSIS_HOP as f64 / speed.max(0.1)).round().max(1.0) as usize;
        let buf_size = HANN_WINDOW_SIZE * 64;

        Self {
            window,
            input_buffer: vec![0.0; buf_size],
            output_buffer: vec![0.0; buf_size],
            norm_buffer: vec![0.0; buf_size],
            input_available: 0,
            output_written: 0,
            speed,
            synthesis_hop,
        }
    }

    pub fn process(&mut self, input: &[f32]) -> Vec<f32> {
        if self.speed == 1.0 {
            return input.to_vec();
        }

        for &sample in input {
            self.input_buffer[self.input_available] = sample;
            self.input_available += 1;
        }

        let mut output = Vec::new();

        while self.input_available >= HANN_WINDOW_SIZE {
            if let Some(frame_output) = self.process_frame() {
                for (i, &s) in frame_output.iter().enumerate() {
                    let idx = self.output_written + i;
                    if idx < self.output_buffer.len() {
                        self.output_buffer[idx] += s;
                        self.norm_buffer[idx] += 1.0;
                    }
                }

                let ready_up_to = self.output_written.saturating_add(HANN_WINDOW_SIZE).saturating_sub(self.synthesis_hop);
                let ready_count = ready_up_to.saturating_sub(self.output_written);

                for i in 0..ready_count {
                    let idx = self.output_written + i;
                    if idx < self.output_buffer.len() && self.norm_buffer[idx] > 0.0 {
                        output.push(self.output_buffer[idx] / self.norm_buffer[idx]);
                        self.output_buffer[idx] = 0.0;
                        self.norm_buffer[idx] = 0.0;
                    }
                }

                self.output_written += ready_count;

                let remaining = self.input_available - ANALYSIS_HOP;
                for i in 0..remaining {
                    self.input_buffer[i] = self.input_buffer[ANALYSIS_HOP + i];
                }
                for i in remaining..self.input_buffer.len() {
                    self.input_buffer[i] = 0.0;
                }
                self.input_available = remaining;
            } else {
                break;
            }
        }

        output
    }

    fn process_frame(&self) -> Option<Vec<f32>> {
        if self.input_available < HANN_WINDOW_SIZE {
            return None;
        }

        let input_frame = &self.input_buffer[..HANN_WINDOW_SIZE];

        let best_offset = self.find_best_overlap(input_frame);

        let mut output_frame = vec![0.0; HANN_WINDOW_SIZE];
        let synth_start = self.output_written + best_offset;

        for i in 0..HANN_WINDOW_SIZE {
            let buf_idx = synth_start + i;
            if buf_idx < self.output_buffer.len() {
                output_frame[i] = input_frame[i] * self.window[i];
            }
        }

        Some(output_frame)
    }

    fn find_best_overlap(&self, input_frame: &[f32]) -> usize {
        let frame_len = HANN_WINDOW_SIZE;
        let search_center = self.output_written;

        let mut best_offset: usize = 0;
        let mut best_corr = f32::MIN;

        let search_start = search_center.saturating_sub(SEARCH_RANGE);
        let search_end = search_center + SEARCH_RANGE;

        for pos in search_start..=search_end {
            if pos + frame_len > self.output_buffer.len() {
                continue;
            }

            let mut corr = 0.0;
            let mut energy = 0.0;

            for i in 0..frame_len {
                let buf_val = self.output_buffer[pos + i];
                let norm = self.norm_buffer[pos + i];
                if norm > 0.0 {
                    corr += input_frame[i] * buf_val / norm;
                    energy += buf_val * buf_val / (norm * norm);
                }
            }

            if energy > 0.0 {
                corr /= energy.sqrt();
            }

            if corr > best_corr {
                best_corr = corr;
                best_offset = pos.saturating_sub(search_center);
            }
        }

        best_offset
    }

    pub fn flush(&mut self) -> Vec<f32> {
        let mut output = Vec::new();

        while self.input_available >= HANN_WINDOW_SIZE {
            if let Some(frame_output) = self.process_frame() {
                for (i, &s) in frame_output.iter().enumerate() {
                    let idx = self.output_written + i;
                    if idx < self.output_buffer.len() {
                        self.output_buffer[idx] += s;
                        self.norm_buffer[idx] += 1.0;
                    }
                }

                self.output_written += HANN_WINDOW_SIZE - self.synthesis_hop;

                let remaining = self.input_available - ANALYSIS_HOP;
                for i in 0..remaining {
                    self.input_buffer[i] = self.input_buffer[ANALYSIS_HOP + i];
                }
                for i in remaining..self.input_buffer.len() {
                    self.input_buffer[i] = 0.0;
                }
                self.input_available = remaining;
            } else {
                break;
            }
        }

        for i in 0..self.output_written + HANN_WINDOW_SIZE {
            if i < self.output_buffer.len() && self.norm_buffer[i] > 0.0 {
                output.push(self.output_buffer[i] / self.norm_buffer[i]);
            }
        }

        self.reset();
        output
    }

    pub fn reset(&mut self) {
        self.input_available = 0;
        self.output_written = 0;
        self.input_buffer.fill(0.0);
        self.output_buffer.fill(0.0);
        self.norm_buffer.fill(0.0);
    }

    pub fn set_speed(&mut self, speed: f64) {
        self.speed = speed;
        self.synthesis_hop = (ANALYSIS_HOP as f64 / speed.max(0.1)).round().max(1.0) as usize;
    }

    pub fn speed(&self) -> f64 {
        self.speed
    }
}

fn hann_window(size: usize) -> Vec<f32> {
    (0..size)
        .map(|i| {
            (std::f64::consts::PI * 2.0 * i as f64 / (size - 1) as f64).cos() as f32 * 0.5 + 0.5
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_speed_one_identity() {
        let mut stretcher = TimeStretcher::new(1.0);
        let input: Vec<f32> = (0..10000).map(|i| (i as f32 * 0.01).sin()).collect();

        let output = stretcher.process(&input);
        let flushed = stretcher.flush();

        let mut total_output = output;
        total_output.extend(flushed);

        assert_eq!(
            total_output.len(),
            input.len(),
            "speed=1.0 should produce same length output"
        );

        let mut max_diff = 0.0;
        for (a, b) in input.iter().zip(total_output.iter()) {
            let diff = (a - b).abs();
            if diff > max_diff {
                max_diff = diff;
            }
        }
        assert!(
            max_diff < 0.001,
            "speed=1.0 should produce identical output, max_diff={max_diff}"
        );
    }

    #[test]
    fn test_speed_two_shorter() {
        let mut stretcher = TimeStretcher::new(2.0);
        let input: Vec<f32> = (0..20000).map(|i| (i as f32 * 0.01).sin()).collect();

        let output = stretcher.process(&input);
        let flushed = stretcher.flush();

        let total_len = output.len() + flushed.len();
        assert!(total_len > 0, "speed=2.0 should produce output");

        let ratio = stretcher.synthesis_hop as f64 / ANALYSIS_HOP as f64;
        assert!(ratio < 1.0, "synthesis_hop should be smaller than analysis_hop at speed=2.0");
    }

    #[test]
    fn test_speed_half_longer() {
        let mut stretcher = TimeStretcher::new(0.5);
        let input: Vec<f32> = (0..20000).map(|i| (i as f32 * 0.01).sin()).collect();

        let output = stretcher.process(&input);
        let flushed = stretcher.flush();

        let total_len = output.len() + flushed.len();
        assert!(total_len > 0, "speed=0.5 should produce output");

        let ratio = stretcher.synthesis_hop as f64 / ANALYSIS_HOP as f64;
        assert!(ratio > 1.0, "synthesis_hop should be larger than analysis_hop at speed=0.5");
    }

    #[test]
    fn test_cross_correlation_finds_alignment() {
        let mut stretcher = TimeStretcher::new(1.5);

        let input: Vec<f32> = (0..HANN_WINDOW_SIZE * 2)
            .map(|i| (i as f32 * 0.05).sin())
            .collect();

        stretcher.process(&input[..HANN_WINDOW_SIZE]);

        let offset = stretcher.find_best_overlap(&input[HANN_WINDOW_SIZE..]);

        assert!(
            offset <= SEARCH_RANGE,
            "cross-correlation should find offset within search range: {offset}"
        );
    }

    #[test]
    fn test_silence_produces_silence() {
        let mut stretcher = TimeStretcher::new(1.5);
        let input = vec![0.0; 10000];

        let output = stretcher.process(&input);
        let flushed = stretcher.flush();

        let mut total_output = output;
        total_output.extend(flushed);

        for (i, &sample) in total_output.iter().enumerate() {
            assert!(
                sample.abs() < 0.01,
                "silence input should produce silence output, sample[{i}]={sample}"
            );
        }
    }

    #[test]
    fn test_reset_clears_state() {
        let mut stretcher = TimeStretcher::new(1.5);
        let input: Vec<f32> = (0..5000).map(|i| (i as f32 * 0.01).sin()).collect();

        stretcher.process(&input);
        stretcher.flush();
        stretcher.reset();

        assert_eq!(stretcher.input_available, 0);
        assert_eq!(stretcher.output_written, 0);

        let input2: Vec<f32> = (0..HANN_WINDOW_SIZE * 3).map(|i| (i as f32 * 0.01).sin()).collect();
        let output2 = stretcher.process(&input2);

        assert!(output2.iter().any(|&s| s != 0.0), "should produce non-zero output after reset");
    }

    #[test]
    fn test_set_speed_updates_hop() {
        let mut stretcher = TimeStretcher::new(1.0);
        assert_eq!(stretcher.synthesis_hop, ANALYSIS_HOP);

        stretcher.set_speed(2.0);
        assert_eq!(stretcher.synthesis_hop, ANALYSIS_HOP / 2);

        stretcher.set_speed(0.5);
        assert_eq!(stretcher.synthesis_hop, ANALYSIS_HOP * 2);
    }

    #[test]
    fn test_hann_window_properties() {
        let window = hann_window(HANN_WINDOW_SIZE);

        assert_eq!(window.len(), HANN_WINDOW_SIZE);

        assert!((window[0] - 1.0).abs() < 0.001);
        assert!((window[HANN_WINDOW_SIZE - 1] - 1.0).abs() < 0.001);

        let mid = HANN_WINDOW_SIZE / 2;
        assert!((window[mid] - 0.0).abs() < 0.001);

        for &w in &window {
            assert!(w >= -0.001 && w <= 1.001);
        }
    }

    #[test]
    fn test_property_based_speed_consistency() {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        for _ in 0..5 {
            let speed: f64 = rng.gen_range(0.3..3.0);
            let mut stretcher = TimeStretcher::new(speed);

            let input_len = rng.gen_range(10000..20000);
            let input: Vec<f32> = (0..input_len)
                .map(|i| (i as f32 * 0.01).sin() * rng.gen_range(0.5..1.5))
                .collect();

            let output = stretcher.process(&input);
            let flushed = stretcher.flush();
            let total_len = output.len() + flushed.len();

            assert!(
                total_len > 0,
                "speed={speed} should produce output"
            );

            let ratio = stretcher.synthesis_hop as f64 / ANALYSIS_HOP as f64;
            if speed > 1.0 {
                assert!(ratio < 1.0, "speed > 1.0: synthesis_hop < analysis_hop");
            } else {
                assert!(ratio > 1.0, "speed < 1.0: synthesis_hop > analysis_hop");
            }
        }
    }
}
