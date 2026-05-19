pub struct GpuBackpressure {
    frames_in_flight: u32,
    max_frames_in_flight: u32,
}

impl GpuBackpressure {
    pub fn new() -> Self {
        Self {
            frames_in_flight: 0,
            max_frames_in_flight: 2,
        }
    }

    pub fn with_max(max: u32) -> Self {
        Self {
            frames_in_flight: 0,
            max_frames_in_flight: max,
        }
    }

    pub fn begin_frame(&mut self) -> bool {
        if self.frames_in_flight >= self.max_frames_in_flight {
            return false;
        }
        self.frames_in_flight += 1;
        true
    }

    pub fn end_frame(&mut self) {
        self.frames_in_flight = self.frames_in_flight.saturating_sub(1);
    }

    pub fn reset(&mut self) {
        self.frames_in_flight = 0;
    }

    pub fn frames_in_flight(&self) -> u32 {
        self.frames_in_flight
    }

    pub fn max_frames_in_flight(&self) -> u32 {
        self.max_frames_in_flight
    }
}

impl Default for GpuBackpressure {
    fn default() -> Self {
        Self::new()
    }
}
