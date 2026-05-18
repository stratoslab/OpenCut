# Design: Frame Caching System

## Overview

A 3-tier LRU cache system integrated into the RendererManager. Before calling `renderFrame()`, check cache by key `(sceneId, frameTime, canvasSize, effectsHash)`. On hit, return cached result. On miss, render and store in all three tiers. VRAM cache holds GPU textures, RAM cache holds ImageData, OPFS cache holds encoded blobs. Cache invalidation uses effects hash comparison.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Frame Cache System                       │
│                                                               │
│  Request Frame (sceneId, time, size, effectsHash)             │
│  │                                                            │
│  ▼                                                            │
│  ┌─────────────────┐                                          │
│  │  Tier 1: VRAM   │  300 textures, GPU-resident             │
│  │  LRU Map        │  Key → GPUTexture                        │
│  └────────┬────────┘                                          │
│           │ HIT → return immediately                          │
│           │ MISS                                              │
│           ▼                                                   │
│  ┌─────────────────┐                                          │
│  │  Tier 2: RAM    │  900 frames, system memory              │
│  │  LRU Map        │  Key → ImageData                         │
│  └────────┬────────┘                                          │
│           │ HIT → upload to VRAM, return                      │
│           │ MISS                                              │
│           ▼                                                   │
│  ┌─────────────────┐                                          │
│  │  Tier 3: OPFS   │  500MB limit, persistent                │
│  │  LRU Map        │  Key → file handle                       │
│  └────────┬────────┘                                          │
│           │ HIT → decode → upload to RAM + VRAM, return       │
│           │ MISS                                              │
│           ▼                                                   │
│  ┌─────────────────┐                                          │
│  │  Render Frame   │  Full GPU render                         │
│  │  (existing)     │                                          │
│  └────────┬────────┘                                          │
│           │                                                   │
│           ▼                                                   │
│  Store in all 3 tiers (async for OPFS)                        │
│  Return frame                                                 │
└──────────────────────────────────────────────────────────────┘
```

## Components

### Component 1: FrameCache (TypeScript)
- **Responsibility:** 3-tier LRU cache management, key generation, invalidation
- **Location:** `apps/web-vite/src/services/renderer/frame-cache.ts`
- **Interface:** `get(key)`, `set(key, frame)`, `invalidate(key)`, `invalidateAll()`, `stats()`
- **Dependencies:** IndexedDB/OPFS APIs

### Component 2: CacheKey Generator
- **Responsibility:** Generate unique cache keys from scene state
- **Location:** `apps/web-vite/src/services/renderer/cache-key.ts`
- **Interface:** `generateKey(sceneId, time, canvasSize, effectsConfig) → string`
- **Key design:** Hash effects config to string, combine with sceneId + time + size

### Component 3: LRU Map
- **Responsibility:** Generic LRU eviction data structure
- **Location:** `apps/web-vite/src/services/renderer/lru-map.ts`
- **Interface:** `get(key)`, `set(key, value)`, `delete(key)`, `size`, `maxSize`
- **Key design:** Doubly-linked list + Map for O(1) get/set/evict

### Component 4: RendererManager Integration
- **Responsibility:** Check cache before render, store after render
- **Location:** Modify `apps/web-vite/src/services/renderer/renderer-manager.ts`
- **Interface:** Wrap existing `renderFrame()` with cache check/store

### Component 5: Effects Hash Calculator
- **Responsibility:** Hash effect configuration for cache key
- **Location:** `apps/web-vite/src/services/renderer/effects-hash.ts`
- **Interface:** `hashEffects(effects: EffectElement[]) → string`
- **Key design:** JSON stringify + SHA-256 (Web Crypto API), or simple hash for speed

## Data Models

### Cache Key
```typescript
interface CacheKey {
  sceneId: string;
  frameTime: number;       // MediaTime as number (seconds)
  canvasWidth: number;
  canvasHeight: number;
  effectsHash: string;     // Hash of effect configuration
}

// Serialized as: `${sceneId}:${frameTime}:${width}x${height}:${effectsHash}`
```

### Cache Entry
```typescript
interface CacheEntry<T> {
  value: T;
  lastAccessed: number;    // Date.now()
  size: number;            // bytes (for OPFS size tracking)
}
```

### Cache Statistics
```typescript
interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;         // hits / (hits + misses) over last 1000
  tier1Count: number;      // VRAM entries
  tier2Count: number;      // RAM entries
  tier3Count: number;      // OPFS entries
  tier3Size: number;       // OPFS bytes used
  evictions: number;
}
```

## Data Flow

1. `RendererManager.renderFrame()` called with scene descriptor
2. Generate cache key from scene state
3. Check Tier 1 (VRAM): hit → return texture immediately
4. Check Tier 2 (RAM): hit → upload to VRAM, store in Tier 1, return
5. Check Tier 3 (OPFS): hit → decode blob → store in Tier 2 + Tier 1, return
6. Miss → call existing `renderFrame()` → store result in all 3 tiers → return
7. OPFS storage is async (fire-and-forget, doesn't block return)

## Key Algorithms

### LRU Eviction
```typescript
class LRUMap<K, V> {
  private map = new Map<K, { value: V; lastAccessed: number }>();
  private accessOrder: K[] = [];  // Doubly-linked list in production

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    // Move to end (most recently used)
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    return this.map.get(key)!.value;
  }

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      // Evict least recently used (first in accessOrder)
      const oldest = this.accessOrder.shift()!;
      this.map.delete(oldest);
    }
    this.map.set(key, { value, lastAccessed: Date.now() });
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }
}
```

### Effects Hash
```typescript
async function hashEffects(effects: EffectElement[]): Promise<string> {
  const config = effects.map(e => ({
    type: e.type,
    params: e.params,
    keyframes: e.keyframes,
  }));
  const data = new TextEncoder().encode(JSON.stringify(config));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);  // Truncate for shorter keys
}
```

## Error Handling

- OPFS unavailable → skip Tier 3, use Tier 1 + 2 only
- Cache corruption → invalidate affected entry, re-render
- Memory pressure → browser may evict VRAM/RAM automatically, handle gracefully
- Hash collision → extremely unlikely with SHA-256, but re-render on mismatch detection

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: VRAM Cache | Tier 1 LRU Map, 300 texture limit, GPU-resident |
| Req 2: RAM Cache | Tier 2 LRU Map, 900 frame limit, ImageData storage |
| Req 3: OPFS Cache | Tier 3 LRU Map, 500MB limit, async blob storage |
| Req 4: Cache Invalidation | Effects hash comparison, invalidate on change |
| Req 5: Cache Statistics | Hit/miss tracking, stats display, warning at <50% |

## Testing Strategy

- **LRU eviction:** Property-based — after filling cache, oldest entries evicted first, size never exceeds limit
- **Cache correctness:** Cached frame bit-identical to fresh render
- **Invalidation:** Changing effects → cache miss → re-render
- **Performance:** VRAM hit <1ms, RAM hit <5ms (including upload), OPFS hit <50ms
- **Persistence:** Page reload → OPFS entries still accessible
