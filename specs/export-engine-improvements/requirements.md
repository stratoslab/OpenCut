# Requirements: Export Engine Improvements

## Introduction

Improve the video export engine to stream frames directly from the GPU canvas to the encoder with zero-copy paths, eliminating in-memory frame accumulation. Add progress tracking with ETA, and resume support for interrupted exports using OPFS caching. The export should handle large projects (4K, 30+ minutes) without running out of memory.

## Glossary

- **Zero-Copy**: Transferring frame data without intermediate CPU copies — directly from GPU texture to encoder
- **Stream-to-Disk**: Writing encoded frames directly to a file (via File System Access API or OPFS) rather than accumulating in memory
- **VideoEncoder**: WebCodecs API encoder that compresses VideoFrame objects into encoded chunks
- **MP4 Muxer**: Combines encoded video/audio chunks into a valid MP4 container
- **Export Resume**: The ability to continue an interrupted export from the last completed frame

## Requirements

### Requirement 1: Zero-Copy Frame Capture

**User Story:** As a user, I want exports to use minimal memory, so that I can export large projects without running out of memory

#### Acceptance Criteria

1. WHEN the export starts THEN the system SHALL capture frames directly from the GPU canvas using `canvas.transferToImageBitmap()` or equivalent
2. WHEN a frame is captured THEN the system SHALL feed it directly to the VideoEncoder without intermediate CPU copies
3. IF the browser supports `VideoFrame` construction from `ImageBitmap` THEN the system SHALL use that path
4. WHEN export completes THEN the system SHALL have used minimal peak memory (no frame accumulation)

#### Correctness Properties

- **Property 1:** Peak memory usage during export SHALL NOT exceed `frame_size * 3` (current + next + encoder buffer)
- **Property 2:** Each frame SHALL be captured and encoded before the next frame is rendered
- **Property 3:** The export pipeline SHALL NOT create any in-memory blob of the full video

### Requirement 2: Stream-to-Disk Export

**User Story:** As a user, I want the exported video to be written directly to disk, so that I don't need to wait for a final blob assembly step

#### Acceptance Criteria

1. WHEN the export runs THEN the system SHALL write encoded chunks directly to a file using the File System Access API
2. IF the File System Access API is unavailable THEN the system SHALL fall back to OPFS streaming
3. WHEN the export completes THEN the system SHALL have a valid MP4 file ready for download
4. IF the user cancels the export THEN the system SHALL clean up any partial files

#### Correctness Properties

- **Property 1:** The output file SHALL be a valid MP4 that plays in standard media players
- **Property 2:** The file SHALL grow incrementally during export (not appear all at once at the end)
- **Property 3:** Cancelled exports SHALL leave no orphaned files

### Requirement 3: Progress Tracking with ETA

**User Story:** As a user, I want to see export progress and estimated time remaining, so that I know when my video will be ready

#### Acceptance Criteria

1. WHEN the export is running THEN the system SHALL display a progress bar with percentage complete
2. WHEN the export is running THEN the system SHALL display an estimated time remaining (ETA)
3. IF the export speed varies THEN the system SHALL update the ETA based on a rolling average of the last 30 frames
4. WHEN the export completes THEN the system SHALL display the total time taken

#### Correctness Properties

- **Property 1:** Progress percentage SHALL be `(frames_encoded / total_frames) * 100`
- **Property 2:** ETA SHALL be calculated as `(remaining_frames / frames_per_second_average)`
- **Property 3:** ETA updates SHALL be smoothed (no jumping between wildly different values)

### Requirement 4: Export Resume Support

**User Story:** As a user, I want to resume an interrupted export, so that I don't lose progress if the browser crashes or I accidentally close the tab

#### Acceptance Criteria

1. WHEN the export is interrupted THEN the system SHALL save the export state (completed frames, encoder state) to OPFS
2. WHEN the user reopens the project AND an interrupted export exists THEN the system SHALL offer to resume
3. WHEN the user chooses to resume THEN the system SHALL continue from the last completed frame
4. IF the export completes successfully THEN the system SHALL clean up any resume state

#### Correctness Properties

- **Property 1:** Resumed exports SHALL produce bit-identical output to a fresh export
- **Property 2:** The resume state SHALL include: completed frame count, encoder configuration, partial file handle
- **Property 3:** Resume SHALL work even after a full browser restart (not just tab close)

### Requirement 5: Export Configuration

**User Story:** As a user, I want to configure export settings (resolution, format, quality), so that I can balance file size and quality for my needs

#### Acceptance Criteria

1. WHEN the user opens the export dialog THEN the system SHALL display options for resolution (original, 1080p, 720p, 480p), format (MP4, WebM), and quality (low, medium, high)
2. WHEN the user selects a resolution different from the project THEN the system SHALL scale frames during export
3. IF the user selects WebM THEN the system SHALL use VP9 encoder
4. IF the user selects MP4 THEN the system SHALL use H.264 encoder (via WebCodecs)

#### Correctness Properties

- **Property 1:** Exported resolution SHALL match the user's selection
- **Property 2:** Exported format SHALL produce a valid file playable in standard media players
- **Property 3:** Quality settings SHALL map to appropriate encoder bitrate presets

### Requirement 6: Audio During Export

**User Story:** As a user, I want audio to be included in my exported video, so that the final output has both video and audio

#### Acceptance Criteria

1. WHEN the export runs THEN the system SHALL encode audio tracks alongside video
2. IF the project has multiple audio tracks THEN the system SHALL mix them during export
3. WHEN the export completes THEN the system SHALL produce a file with synchronized audio and video
4. IF the project has no audio THEN the system SHALL export video-only

#### Correctness Properties

- **Property 1:** Audio-video sync SHALL be maintained throughout the export (no drift)
- **Property 2:** Mixed audio SHALL preserve relative volume levels from the timeline
- **Property 3:** Exported audio SHALL match the project's sample rate
