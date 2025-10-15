/**
 * TypeAwareHNSWIndex Unit Tests
 *
 * Comprehensive test suite for Phase 2 Type-Aware HNSW implementation.
 * Tests cover:
 * - Lazy initialization
 * - Type routing (single/multi/all types)
 * - Edge cases (empty array, null, invalid type)
 * - Error handling
 * - Memory isolation
 * - Statistics
 * - Configuration
 *
 * Total: 25 unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TypeAwareHNSWIndex } from '../src/hnsw/typeAwareHNSWIndex.js'
import type { NounType } from '../src/types/graphTypes.js'
import { euclideanDistance } from '../src/utils/index.js'
import { MemoryStorage } from '../src/storage/adapters/memoryStorage.js'

describe('TypeAwareHNSWIndex', () => {
  let index: TypeAwareHNSWIndex
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
    index = new TypeAwareHNSWIndex(
      { M: 4, efConstruction: 50, efSearch: 20 },
      euclideanDistance,
      { storage }
    )
  })

  // ===================================================================
  // 1. LAZY INITIALIZATION
  // ===================================================================

  describe('Lazy Initialization', () => {
    it('should not create indexes upfront', () => {
      expect(index.getActiveTypes()).toHaveLength(0)
      expect(index.size()).toBe(0)
    })

    it('should create index only when first entity added', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 2, 3] },
        'person' as NounType
      )

      expect(index.getActiveTypes()).toContain('person')
      expect(index.getActiveTypes()).toHaveLength(1)
      expect(index.sizeForType('person' as NounType)).toBe(1)
    })

    it('should create separate indexes for different types', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 2, 3] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [4, 5, 6] },
        'document' as NounType
      )

      expect(index.getActiveTypes()).toHaveLength(2)
      expect(index.getActiveTypes()).toContain('person')
      expect(index.getActiveTypes()).toContain('document')
      expect(index.sizeForType('person' as NounType)).toBe(1)
      expect(index.sizeForType('document' as NounType)).toBe(1)
    })

    it('should not create index for types with no entities', () => {
      expect(index.sizeForType('event' as NounType)).toBe(0)
      expect(index.getActiveTypes()).not.toContain('event')
    })
  })

  // ===================================================================
  // 2. TYPE ROUTING
  // ===================================================================

  describe('Type Routing', () => {
    beforeEach(async () => {
      // Add entities of different types
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'person-2', vector: [1, 0.1, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [0, 1, 0] },
        'document' as NounType
      )
      await index.addItem(
        { id: 'event-1', vector: [0, 0, 1] },
        'event' as NounType
      )
    })

    it('should search single type only (fast path)', async () => {
      const results = await index.search([1, 0, 0], 2, 'person' as NounType)

      expect(results).toHaveLength(2)
      expect(results[0][0]).toBe('person-1') // Exact match
      expect(results[1][0]).toBe('person-2') // Close match
    })

    it('should search multiple types', async () => {
      const results = await index.search(
        [1, 0, 0],
        3,
        ['person', 'document'] as NounType[]
      )

      expect(results).toHaveLength(3)
      const ids = results.map((r) => r[0])
      expect(ids).toContain('person-1')
      expect(ids).toContain('person-2')
      expect(ids).toContain('doc-1')
      expect(ids).not.toContain('event-1') // Not searched
    })

    it('should search all types when type not specified', async () => {
      const results = await index.search([1, 0, 0], 4)

      expect(results).toHaveLength(4)
      const ids = results.map((r) => r[0])
      expect(ids).toContain('person-1')
      expect(ids).toContain('person-2')
      expect(ids).toContain('doc-1')
      expect(ids).toContain('event-1')
    })

    it('should return results sorted by distance', async () => {
      const results = await index.search([1, 0, 0], 4)

      // Distances should be increasing
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i][1]).toBeLessThanOrEqual(results[i + 1][1])
      }
    })
  })

  // ===================================================================
  // 3. EDGE CASE HANDLING
  // ===================================================================

  describe('Edge Cases', () => {
    it('should handle empty array in search() (fall through to all types)', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )

      const results = await index.search([1, 0, 0], 10, [] as NounType[])

      // Should search all types (fallback behavior)
      expect(results).toHaveLength(1)
      expect(results[0][0]).toBe('person-1')
    })

    it('should throw on null item in addItem()', async () => {
      await expect(
        index.addItem(null as any, 'person' as NounType)
      ).rejects.toThrow('Invalid VectorDocument: item or vector is null/undefined')
    })

    it('should throw on undefined vector in addItem()', async () => {
      await expect(
        index.addItem({ id: 'test' } as any, 'person' as NounType)
      ).rejects.toThrow('Invalid VectorDocument: item or vector is null/undefined')
    })

    it('should throw on null type in addItem()', async () => {
      await expect(
        index.addItem({ id: 'test', vector: [1, 2, 3] }, null as any)
      ).rejects.toThrow('Type is required for type-aware indexing')
    })

    it('should throw on invalid type string', async () => {
      await expect(
        index.addItem(
          { id: 'test', vector: [1, 2, 3] },
          'not-a-valid-noun-type-at-all' as any
        )
      ).rejects.toThrow('Invalid NounType')
    })

    it('should handle search with no results', async () => {
      const results = await index.search([1, 2, 3], 10, 'person' as NounType)

      expect(results).toHaveLength(0)
    })

    it('should handle removeItem() for non-existent type', async () => {
      const removed = await index.removeItem('test-id', 'person' as NounType)

      expect(removed).toBe(false)
    })
  })

  // ===================================================================
  // 4. ADD/REMOVE/SEARCH OPERATIONS
  // ===================================================================

  describe('Operations', () => {
    it('should add item and return ID', async () => {
      const id = await index.addItem(
        { id: 'person-1', vector: [1, 2, 3] },
        'person' as NounType
      )

      expect(id).toBe('person-1')
      expect(index.size()).toBe(1)
    })

    it('should remove item from correct type', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 2, 3] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [4, 5, 6] },
        'document' as NounType
      )

      const removed = await index.removeItem('person-1', 'person' as NounType)

      expect(removed).toBe(true)
      expect(index.sizeForType('person' as NounType)).toBe(0)
      expect(index.sizeForType('document' as NounType)).toBe(1) // Unchanged
    })

    it('should search with filter function', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'person-2', vector: [1, 0.1, 0] },
        'person' as NounType
      )

      const filter = async (id: string) => id === 'person-1'
      const results = await index.search(
        [1, 0, 0],
        2,
        'person' as NounType,
        filter
      )

      expect(results).toHaveLength(1)
      expect(results[0][0]).toBe('person-1')
    })
  })

  // ===================================================================
  // 5. MEMORY ISOLATION
  // ===================================================================

  describe('Memory Isolation', () => {
    it('should maintain separate memory for each type', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [0, 1, 0] },
        'document' as NounType
      )

      // Clear person type only
      index.clearType('person' as NounType)

      expect(index.sizeForType('person' as NounType)).toBe(0)
      expect(index.sizeForType('document' as NounType)).toBe(1) // Unchanged
    })

    it('should clear all indexes', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [0, 1, 0] },
        'document' as NounType
      )

      index.clear()

      expect(index.size()).toBe(0)
      expect(index.getActiveTypes()).toHaveLength(0)
    })
  })

  // ===================================================================
  // 6. SIZE AND STATISTICS
  // ===================================================================

  describe('Size and Statistics', () => {
    it('should return total size across all types', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'person-2', vector: [1, 0.1, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [0, 1, 0] },
        'document' as NounType
      )

      expect(index.size()).toBe(3)
    })

    it('should return size for specific type', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'person-2', vector: [1, 0.1, 0] },
        'person' as NounType
      )

      expect(index.sizeForType('person' as NounType)).toBe(2)
      expect(index.sizeForType('document' as NounType)).toBe(0)
    })

    it('should return comprehensive statistics', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [0, 1, 0] },
        'document' as NounType
      )

      const stats = index.getStats()

      expect(stats.totalNodes).toBe(2)
      expect(stats.typeCount).toBe(2)
      expect(stats.typeStats.has('person' as NounType)).toBe(true)
      expect(stats.typeStats.has('document' as NounType)).toBe(true)
      expect(stats.memoryReductionPercent).toBeGreaterThan(0)
    })

    it('should return stats for specific type', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )

      const stats = index.getStatsForType('person' as NounType)

      expect(stats).not.toBeNull()
      expect(stats!.nodeCount).toBe(1)
      expect(stats!.memoryMB).toBeGreaterThanOrEqual(0)
    })

    it('should return null stats for non-existent type', () => {
      const stats = index.getStatsForType('person' as NounType)

      expect(stats).toBeNull()
    })

    it('should calculate memory reduction percentage', async () => {
      // Add multiple entities to make calculation meaningful
      for (let i = 0; i < 100; i++) {
        await index.addItem(
          { id: `person-${i}`, vector: [Math.random(), Math.random(), Math.random()] },
          'person' as NounType
        )
      }

      const stats = index.getStats()

      expect(stats.totalNodes).toBe(100)
      expect(stats.estimatedMonolithicMemoryMB).toBeGreaterThan(0)
      expect(stats.memoryReductionPercent).toBeGreaterThanOrEqual(0)
      expect(stats.memoryReductionPercent).toBeLessThanOrEqual(100)
    })

    it('should handle stats with empty indexes', () => {
      const stats = index.getStats()

      expect(stats.totalNodes).toBe(0)
      expect(stats.typeCount).toBe(0)
      expect(stats.totalMemoryMB).toBe(0)
      expect(stats.memoryReductionPercent).toBe(0)
    })
  })

  // ===================================================================
  // 7. CONFIGURATION
  // ===================================================================

  describe('Configuration', () => {
    it('should return HNSW configuration', () => {
      const config = index.getConfig()

      expect(config.M).toBe(4)
      expect(config.efConstruction).toBe(50)
      expect(config.efSearch).toBe(20)
    })

    it('should return distance function', () => {
      const distFn = index.getDistanceFunction()

      expect(distFn).toBe(euclideanDistance)
    })

    it('should get parallelization setting', () => {
      const parallel = index.getUseParallelization()

      expect(parallel).toBe(true) // Default
    })

    it('should set parallelization for all indexes', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )

      index.setUseParallelization(false)

      expect(index.getUseParallelization()).toBe(false)
    })
  })

  // ===================================================================
  // 8. ACTIVE TYPES
  // ===================================================================

  describe('Active Types', () => {
    it('should return list of types with entities', async () => {
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [0, 1, 0] },
        'document' as NounType
      )

      const activeTypes = index.getActiveTypes()

      expect(activeTypes).toHaveLength(2)
      expect(activeTypes).toContain('person')
      expect(activeTypes).toContain('document')
    })

    it('should return empty array when no types have entities', () => {
      const activeTypes = index.getActiveTypes()

      expect(activeTypes).toHaveLength(0)
    })
  })
})
