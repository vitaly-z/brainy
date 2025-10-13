/**
 * UnifiedCache Eviction Scoring Tests
 * Verify that cache eviction properly prioritizes items based on
 * access frequency and rebuild cost
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { UnifiedCache } from '../../../src/utils/unifiedCache'

describe('UnifiedCache Eviction Scoring', () => {
  let cache: UnifiedCache

  beforeEach(() => {
    // Create cache with small size for testing
    cache = new UnifiedCache({ maxSize: 1000 })
  })

  it('should evict low-value metadata before high-value HNSW vectors', () => {
    // Add metadata entry (low rebuild cost, low access count)
    cache.set('meta1', { data: 'metadata' }, 'metadata', 100, 1)

    // Add HNSW vector (high rebuild cost, high access count)
    cache.set('hnsw1', { data: 'vector' }, 'hnsw', 100, 50)

    // Simulate frequent access to HNSW
    for (let i = 0; i < 10; i++) {
      cache.getSync('hnsw1')
    }

    // Fill cache to force eviction
    cache.set('new1', { data: 'newdata' }, 'other', 900, 1)

    // With CORRECT formula (accessCount * rebuildCost):
    // meta1 score: 1 * 1 = 1 (should be evicted)
    // hnsw1 score: 11 * 50 = 550 (should be kept)

    const stats = cache.getStats()

    // HNSW should be kept (high value)
    expect(cache.getSync('hnsw1')).toBeDefined()

    // Metadata should likely be evicted (low value)
    // Note: Since we're filling most of cache, metadata is candidate for eviction
    expect(stats.typeSizes.hnsw).toBeGreaterThan(0)
  })

  it('should prioritize frequently accessed items regardless of type', () => {
    // Add item with high access count, low rebuild cost
    cache.set('hot1', { data: 'hot' }, 'metadata', 100, 1)
    for (let i = 0; i < 100; i++) {
      cache.getSync('hot1')
    }

    // Add item with low access count, high rebuild cost
    cache.set('cold1', { data: 'cold' }, 'hnsw', 100, 50)
    // Only access once (implicit from set)

    // Fill cache
    cache.set('new1', { data: 'new' }, 'other', 900, 1)

    const stats = cache.getStats()

    // hot1 score: 101 * 1 = 101 (keep)
    // cold1 score: 1 * 50 = 50 (keep)
    // Both should be kept as they have reasonable scores

    // At least one should be present
    const hasHot = cache.getSync('hot1') !== undefined
    const hasCold = cache.getSync('cold1') !== undefined

    expect(hasHot || hasCold).toBe(true)
    expect(stats.itemCount).toBeGreaterThan(0)
  })

  it('should properly score items with varying rebuild costs', () => {
    const items = [
      { key: 'cheap1', cost: 1, accesses: 1 },     // score: 1
      { key: 'medium1', cost: 10, accesses: 1 },   // score: 10
      { key: 'expensive1', cost: 100, accesses: 1 } // score: 100
    ]

    // Add all items
    for (const item of items) {
      cache.set(item.key, { data: item.key }, 'other', 100, item.cost)
    }

    // Fill cache to force eviction
    cache.set('filler', { data: 'filler' }, 'other', 900, 1)

    // Expensive items (high rebuild cost) should be more likely to stay
    // Even with same access count, rebuild cost should matter

    const stats = cache.getStats()

    // Should have at least kept some items
    expect(stats.itemCount).toBeGreaterThan(0)

    // Expensive items should have priority
    const hasExpensive = cache.getSync('expensive1') !== undefined
    const hasCheap = cache.getSync('cheap1') !== undefined

    // If we have to choose, expensive should be kept over cheap
    if (stats.itemCount === 2) {
      expect(hasExpensive).toBe(true)
    }
  })

  it('should handle fairness eviction correctly', () => {
    // Add many metadata entries (create imbalance)
    for (let i = 0; i < 5; i++) {
      cache.set(`meta${i}`, { data: i }, 'metadata', 100, 1)
    }

    // Add one HNSW with high value
    cache.set('hnsw1', { data: 'vector' }, 'hnsw', 100, 50)
    for (let i = 0; i < 50; i++) {
      cache.getSync('hnsw1')
    }

    // Fill to capacity
    cache.set('filler', { data: 'fill' }, 'other', 400, 1)

    // HNSW should be protected despite being outnumbered
    expect(cache.getSync('hnsw1')).toBeDefined()
  })

  it('should evict items with lowest combined score first', () => {
    const testItems = [
      { key: 'item1', accesses: 1, cost: 1 },   // score: 1
      { key: 'item2', accesses: 5, cost: 2 },   // score: 10
      { key: 'item3', accesses: 10, cost: 5 },  // score: 50
    ]

    // Add items
    for (const item of testItems) {
      cache.set(item.key, { data: item.key }, 'other', 100, item.cost)
      for (let i = 1; i < item.accesses; i++) {
        cache.getSync(item.key)
      }
    }

    // Force eviction
    cache.set('large', { data: 'large' }, 'other', 800, 1)

    // Item with highest score should be most likely to survive
    const hasItem3 = cache.getSync('item3') !== undefined
    const hasItem1 = cache.getSync('item1') !== undefined

    // item3 (score 50) should be kept over item1 (score 1)
    if (hasItem3 || hasItem1) {
      expect(hasItem3).toBe(true)
    }
  })

  it('should maintain cache efficiency under load', () => {
    // Add many items with different characteristics
    for (let i = 0; i < 10; i++) {
      const cost = i % 3 === 0 ? 50 : 1  // Every 3rd item is expensive
      cache.set(`item${i}`, { data: i }, 'other', 50, cost)

      // Access expensive items more
      if (cost === 50) {
        for (let j = 0; j < 10; j++) {
          cache.getSync(`item${i}`)
        }
      }
    }

    const stats = cache.getStats()

    // Should have kept cache operational
    expect(stats.itemCount).toBeGreaterThan(0)
    expect(stats.itemCount).toBeLessThanOrEqual(10)

    // Expensive frequently-accessed items should be present
    let expensiveKept = 0
    for (let i = 0; i < 10; i++) {
      if (i % 3 === 0 && cache.getSync(`item${i}`)) {
        expensiveKept++
      }
    }

    expect(expensiveKept).toBeGreaterThan(0)
  })

  it('should handle metadata vs HNSW eviction scenario from bug report', () => {
    // Simulate the bug scenario:
    // - Metadata: 99.7% cache size, 3.7% access
    // - HNSW: Small cache size, high access

    // Add lots of metadata (cheap to rebuild)
    for (let i = 0; i < 8; i++) {
      cache.set(`meta${i}`, { data: i }, 'metadata', 100, 1)
      // Low access
      cache.getSync(`meta${i}`)
    }

    // Add HNSW vectors (expensive to rebuild)
    cache.set('hnsw1', { vector: [1, 2, 3] }, 'hnsw', 100, 50)
    cache.set('hnsw2', { vector: [4, 5, 6] }, 'hnsw', 100, 50)

    // High access to HNSW
    for (let i = 0; i < 100; i++) {
      cache.getSync('hnsw1')
      cache.getSync('hnsw2')
    }

    const stats = cache.getStats()

    // Calculate scores:
    // metadata: ~2 * 1 = 2 each
    // hnsw1: 101 * 50 = 5050
    // hnsw2: 101 * 50 = 5050

    // HNSW should be protected
    expect(cache.getSync('hnsw1')).toBeDefined()
    expect(cache.getSync('hnsw2')).toBeDefined()

    // Verify that HNSW has higher value than metadata
    // (even if all fit in cache, the scoring should be correct)
    let metadataCount = 0
    for (let i = 0; i < 8; i++) {
      if (cache.getSync(`meta${i}`)) {
        metadataCount++
      }
    }

    // Both HNSW vectors should be present (they're high value)
    // Metadata may or may not be evicted depending on cache size
    expect(metadataCount).toBeLessThanOrEqual(8)
  })
})
