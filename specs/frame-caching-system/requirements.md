# Requirements: Frame Caching System

## Introduction

Implement a 3-tier frame caching system (VRAM, RAM, OPFS) to eliminate redundant frame rendering during timeline scrubbing. Currently every scrub re-renders from scratch. The cache stores composited frames keyed by (sceneId, frameTime, canvasSize, effectsHash), returning cached results instantly when the same frame is requested again.

## Glossary

- **VRAM Cache**: GPU-resident cache of recently composited textures (fastest, limited capacity)
- **RAM Cache**: System memory cache of decoded frames as ImageData/VideoFrame (medium speed, larger capacity)
- **OPFS Cache**: Origin Private File System cache for persistent frame storage across page reloads (slowest, largest)
- **Cache Key**: Unique identifier for a cached frame: `(sceneId, frameTime, canvasSize, effectsHash)`
- **LRU Eviction**: Least Recently Used eviction policy — oldest unused entries are removed when cache is full
- **Effects Hash**: Hash of the current effect configuration (types + parameters) to invalidate cache when effects change

## Requirements

### Requirement 1: VRAM Cache (Tier 1)

**User Story:** As a user, I want recently viewed frames to be instantly available during scrubbing, so that timeline navigation feels smooth and responsive

#### Acceptance Criteria

1. WHEN a frame is rendered THEN the system SHALL store the composited texture in the VRAM cache
2. WHEN a frame is requested AND exists in VRAM cache THEN the system SHALL return it immediately without re-rendering
3. IF the VRAM cache reaches its limit (300 textures) THEN the system SHALL evict the least recently used texture
4. WHEN the user scrubs forward and back within the cached range THEN the system SHALL show zero-latency playback

#### Correctness Properties

- **Property 1:** A cached frame SHALL be bit-identical to a freshly rendered frame
- **Property 2:** The VRAM cache SHALL never exceed 300 textures
- **Property 3:** Cache hits SHALL NOT trigger any GPU rendering

### Requirement 2: RAM Cache (Tier 2)

**User Story:** As a user, I want frames to remain available even after they're evicted from VRAM, so that returning to earlier parts of the timeline is still fast

#### Acceptance Criteria

1. WHEN a frame is rendered AND not in VRAM cache THEN the system SHALL store it in the RAM cache
2. WHEN a frame is requested AND exists in RAM cache but not VRAM THEN the system SHALL upload it to VRAM and return it
3. IF the RAM cache reaches its limit (900 frames) THEN the system SHALL evict the least recently used frame
4. WHEN the user returns to a previously viewed section of the timeline THEN the system SHALL load from RAM cache (faster than re-rendering)

#### Correctness Properties

- **Property 1:** RAM cache entries SHALL be stored as ImageData or VideoFrame (GPU-uploadable format)
- **Property 2:** The RAM cache SHALL never exceed 900 frames
- **Property 3:** Uploading from RAM to VRAM SHALL be faster than re-rendering from scratch

### Requirement 3: OPFS Cache (Tier 3)

**User Story:** As a user, I want my rendered frames to persist across page reloads, so that I don't lose my work when I refresh the browser

#### Acceptance Criteria

1. WHEN a frame is rendered THEN the system SHALL asynchronously store it in the OPFS cache
2. WHEN the page reloads AND the user opens the same project THEN the system SHALL load cached frames from OPFS
3. IF the OPFS cache reaches its size limit (configurable, default 500MB) THEN the system SHALL evict the oldest frames
4. WHEN a frame is requested AND exists in OPFS but not RAM THEN the system SHALL load it from OPFS (slower than RAM but faster than re-rendering)

#### Correctness Properties

- **Property 1:** OPFS cache entries SHALL be stored as encoded blobs (PNG or WebP for compression)
- **Property 2:** The OPFS cache SHALL NOT block the main thread (async I/O only)
- **Property 3:** Cache persistence SHALL survive page reloads and browser restarts

### Requirement 4: Cache Invalidation

**User Story:** As a user, I want the cache to automatically invalidate when I change effects or timeline state, so that I always see the correct rendered output

#### Acceptance Criteria

1. WHEN the user changes an effect parameter THEN the system SHALL invalidate all cached frames for that clip
2. WHEN the user modifies the timeline (add/delete/move clips) THEN the system SHALL invalidate affected cached frames
3. WHEN the canvas size changes THEN the system SHALL invalidate the entire cache
4. IF a frame is requested with a different effects configuration THEN the system SHALL re-render (cache miss)

#### Correctness Properties

- **Property 1:** Cache invalidation SHALL be based on effects hash, not individual parameter checks
- **Property 2:** Invalidated frames SHALL be removed from all three cache tiers
- **Property 3:** Cache invalidation SHALL NOT cause rendering errors or crashes

### Requirement 5: Cache Statistics

**User Story:** As a developer, I want to monitor cache performance, so that I can optimize cache sizes and identify bottlenecks

#### Acceptance Criteria

1. WHEN the cache is active THEN the system SHALL track hit rate, miss rate, and eviction count
2. WHEN requested THEN the system SHALL display cache statistics (hit rate %, entries per tier, memory usage)
3. IF the cache hit rate drops below 50% THEN the system SHALL log a warning

#### Correctness Properties

- **Property 1:** Hit rate = hits / (hits + misses), calculated over the last 1000 requests
- **Property 2:** Statistics tracking SHALL have negligible overhead (<0.1ms per request)
