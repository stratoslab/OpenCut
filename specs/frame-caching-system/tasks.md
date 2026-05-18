# Tasks: Frame Caching System

## Overview

Implement a 3-tier LRU frame caching system (VRAM, RAM, OPFS) integrated into RendererManager. Cache keyed by (sceneId, frameTime, canvasSize, effectsHash). Eliminates redundant rendering during scrubbing.

## Task Dependency Graph

```
Task 1: LRU Map ──→ Task 2: Cache Key ──→ Task 3: FrameCache ──→ Task 5: Stats
                    Task 4: Effects Hash ──┘                          ↓
                                                        Task 6: RendererManager Integration ──→ Task 7: Tests
```

## Tasks

- [ ] **Task 1: Implement LRU Map**
  - **What:** Generic LRU eviction data structure with O(1) get/set/evict. Configurable max size. Tracks access order.
  - **Files:** Create `apps/web-vite/src/services/renderer/lru-map.ts`
  - **Done when:** get/set/evict work correctly, size never exceeds max, oldest entries evicted first
  - **Depends on:** none

- [ ] **Task 2: Implement Cache Key Generator**
  - **What:** Generate unique cache keys from sceneId, frameTime, canvasSize, effectsHash. Format: `${sceneId}:${time}:${W}x${H}:${hash}`.
  - **Files:** Create `apps/web-vite/src/services/renderer/cache-key.ts`
  - **Done when:** Same inputs produce same key, different inputs produce different keys
  - **Depends on:** none

- [ ] **Task 3: Implement Effects Hash Calculator**
  - **What:** Hash effect configuration using SHA-256 (Web Crypto). JSON stringify effects array, hash, truncate to 16 chars.
  - **Files:** Create `apps/web-vite/src/services/renderer/effects-hash.ts`
  - **Done when:** Same effects produce same hash, parameter change produces different hash, async computation
  - **Depends on:** none

- [ ] **Task 4: Implement FrameCache (3-Tier)**
  - **What:** 3-tier cache manager with VRAM (GPUTexture, 300 limit), RAM (ImageData, 900 limit), OPFS (encoded blobs, 500MB limit). LRU eviction per tier. Async OPFS storage.
  - **Files:** Create `apps/web-vite/src/services/renderer/frame-cache.ts`
  - **Done when:** get/set/invalidate work across all tiers, OPFS persists across reloads, eviction correct
  - **Depends on:** Tasks 1-3

- [ ] **Task 5: Implement Cache Statistics**
  - **What:** Track hits, misses, evictions. Calculate hit rate over last 1000 requests. Display stats on demand. Warn at <50% hit rate.
  - **Files:** Add to `apps/web-vite/src/services/renderer/frame-cache.ts`
  - **Done when:** Stats accurate, hit rate calculation correct, warning logged when <50%
  - **Depends on:** Task 4

- [ ] **Task 6: Integrate with RendererManager**
  - **What:** Wrap existing renderFrame() with cache check (Tier 1 → Tier 2 → Tier 3 → render). Store results in all tiers after render. Handle cache invalidation on effect/timeline changes.
  - **Files:** Modify `apps/web-vite/src/services/renderer/renderer-manager.ts`
  - **Done when:** Scrubbing uses cache, cache miss triggers render, invalidation works on effect change
  - **Depends on:** Task 4

- [ ] **Task 7: Write Cache Tests**
  - **What:** Property-based tests: LRU eviction correctness, cached frame bit-identical to fresh render, invalidation on effect change, persistence across reloads. Performance: VRAM <1ms, RAM <5ms, OPFS <50ms.
  - **Files:** Create `apps/web-vite/src/services/renderer/__tests__/frame-cache.test.ts`
  - **Done when:** All tests pass, performance targets met, hit rate >80% on repeated scrub
  - **Depends on:** Tasks 4-6
