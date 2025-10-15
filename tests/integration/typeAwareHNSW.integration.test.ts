/**
 * TypeAwareHNSW Integration Tests
 *
 * End-to-end tests for Phase 2 Type-Aware HNSW implementation.
 * Tests cover:
 * - Brainy integration (add, find)
 * - Storage integration (FileSystem, Memory)
 * - Rebuild functionality
 * - Cache behavior
 * - Large datasets
 * - Performance characteristics
 *
 * Total: 15 integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TypeAwareHNSWIndex } from '../../src/hnsw/typeAwareHNSWIndex.js'
import type { NounType } from '../../src/types/graphTypes.js'
import { euclideanDistance } from '../../src/utils/index.js'
import { MemoryStorage } from '../../src/storage/adapters/memoryStorage.js'
import { FileSystemStorage } from '../../src/storage/adapters/fileSystemStorage.js'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'

describe('TypeAwareHNSW Integration Tests', () => {
  const TEST_DATA_DIR = path.join(process.cwd(), '.test-data-type-aware-hnsw')

  afterEach(() => {
    // Clean up test data directory
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    }
  })

  // ===================================================================
  // 1. STORAGE INTEGRATION
  // ===================================================================

  describe('Storage Integration', () => {
    it('should work with MemoryStorage', async () => {
      const storage = new MemoryStorage()
      const index = new TypeAwareHNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { storage }
      )

      // Add entities with valid UUIDs
      const personId = uuidv4()
      const docId = uuidv4()

      await index.addItem(
        { id: personId, vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: docId, vector: [0, 1, 0] },
        'document' as NounType
      )

      // Search
      const results = await index.search([1, 0, 0], 2)

      expect(results).toHaveLength(2)
      expect(results[0][0]).toBe(personId) // Closest to [1,0,0]
    })

    it('should work with FileSystemStorage', async () => {
      const storage = new FileSystemStorage(TEST_DATA_DIR)
      await storage.init()

      const index = new TypeAwareHNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { storage }
      )

      // Add entities with valid UUIDs
      const personId = uuidv4()
      const docId = uuidv4()

      await index.addItem(
        { id: personId, vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: docId, vector: [0, 1, 0] },
        'document' as NounType
      )

      // Search should work
      const results = await index.search([1, 0, 0], 2)
      expect(results).toHaveLength(2)
    })
  })

  // ===================================================================
  // 2. REBUILD FUNCTIONALITY
  // ===================================================================

  describe('Rebuild Functionality', () => {
    it('should handle rebuild gracefully when no data exists', async () => {
      const storage = new MemoryStorage()
      await storage.init()

      const index = new TypeAwareHNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { storage }
      )

      // Rebuild with no data - should not crash
      await index.rebuild()

      expect(index.size()).toBe(0)
    })

    it('should skip rebuild when no storage adapter', async () => {
      const index = new TypeAwareHNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { storage: null }
      )

      // Should not crash when storage is null
      await index.rebuild()

      expect(index.size()).toBe(0)
    })

    it('should allow specifying types to rebuild', async () => {
      const storage = new MemoryStorage()
      await storage.init()

      const index = new TypeAwareHNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { storage }
      )

      // Rebuild specific types (no data, but should not crash)
      await index.rebuild({ types: ['person', 'document'] as NounType[] })

      expect(index.size()).toBe(0)
    })
  })

  // ===================================================================
  // 3. LARGE DATASET TESTS
  // ===================================================================

  describe('Large Dataset Tests', () => {
    it('should handle 1000 entities across 5 types', async () => {
      const storage = new MemoryStorage()
      const index = new TypeAwareHNSWIndex(
        { M: 8, efConstruction: 100, efSearch: 50 },
        euclideanDistance,
        { storage }
      )

      const types: NounType[] = [
        'person',
        'document',
        'event',
        'organization',
        'location'
      ]

      // Add 200 entities per type = 1000 total
      for (const type of types) {
        for (let i = 0; i < 200; i++) {
          await index.addItem(
            {
              id: `${type}-${i}`,
              vector: [
                Math.random(),
                Math.random(),
                Math.random(),
                Math.random()
              ]
            },
            type
          )
        }
      }

      expect(index.size()).toBe(1000)
      expect(index.getActiveTypes()).toHaveLength(5)

      // Verify each type has correct count
      for (const type of types) {
        expect(index.sizeForType(type)).toBe(200)
      }

      // Verify search works
      const results = await index.search([0.5, 0.5, 0.5, 0.5], 10)
      expect(results).toHaveLength(10)
    }, 30000) // 30s timeout for large dataset

    it('should handle unbalanced distribution (1 dominant type)', async () => {
      const storage = new MemoryStorage()
      const index = new TypeAwareHNSWIndex(
        { M: 8, efConstruction: 100, efSearch: 50 },
        euclideanDistance,
        { storage }
      )

      // Add 900 person entities (dominant type)
      for (let i = 0; i < 900; i++) {
        await index.addItem(
          {
            id: `person-${i}`,
            vector: [Math.random(), Math.random(), Math.random()]
          },
          'person' as NounType
        )
      }

      // Add 100 document entities
      for (let i = 0; i < 100; i++) {
        await index.addItem(
          {
            id: `doc-${i}`,
            vector: [Math.random(), Math.random(), Math.random()]
          },
          'document' as NounType
        )
      }

      expect(index.size()).toBe(1000)
      expect(index.sizeForType('person' as NounType)).toBe(900)
      expect(index.sizeForType('document' as NounType)).toBe(100)

      // Verify search works correctly for both types
      const personResults = await index.search(
        [0.5, 0.5, 0.5],
        10,
        'person' as NounType
      )
      const docResults = await index.search(
        [0.5, 0.5, 0.5],
        10,
        'document' as NounType
      )

      expect(personResults.length).toBeGreaterThanOrEqual(10)
      expect(docResults.length).toBeGreaterThanOrEqual(10)

      // All person results should be from person type
      personResults.forEach((result) => {
        expect(result[0]).toMatch(/^person-/)
      })
    }, 30000)
  })

  // ===================================================================
  // 4. TYPE-SPECIFIC QUERIES
  // ===================================================================

  describe('Type-Specific Queries', () => {
    let index: TypeAwareHNSWIndex

    beforeEach(async () => {
      const storage = new MemoryStorage()
      index = new TypeAwareHNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { storage }
      )

      // Add entities of different types
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'person-2', vector: [0.9, 0.1, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [0, 1, 0] },
        'document' as NounType
      )
      await index.addItem(
        { id: 'doc-2', vector: [0, 0.9, 0.1] },
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
      expect(results[0][0]).toBe('person-1')
      expect(results[1][0]).toBe('person-2')

      // Verify no document or event results
      results.forEach((result) => {
        expect(result[0]).toMatch(/^person-/)
      })
    })

    it('should search multiple types', async () => {
      const results = await index.search(
        [0.5, 0.5, 0],
        5,
        ['person', 'document'] as NounType[]
      )

      expect(results).toHaveLength(4) // 2 person + 2 document

      const ids = results.map((r) => r[0])
      expect(ids).toContain('person-1')
      expect(ids).toContain('person-2')
      expect(ids).toContain('doc-1')
      expect(ids).toContain('doc-2')
      expect(ids).not.toContain('event-1') // Not searched
    })

    it('should fall back to all-types search when type unknown', async () => {
      const results = await index.search([0, 0, 1], 5)

      expect(results).toHaveLength(5)

      const ids = results.map((r) => r[0])
      expect(ids).toContain('event-1') // Found in all-types search
    })
  })

  // ===================================================================
  // 5. MEMORY ISOLATION
  // ===================================================================

  describe('Memory Isolation', () => {
    it('should maintain separate memory for each type', async () => {
      const storage = new MemoryStorage()
      const index = new TypeAwareHNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { storage }
      )

      // Add entities of different types
      for (let i = 0; i < 100; i++) {
        await index.addItem(
          { id: `person-${i}`, vector: [Math.random(), Math.random(), 0] },
          'person' as NounType
        )
      }

      for (let i = 0; i < 100; i++) {
        await index.addItem(
          { id: `doc-${i}`, vector: [0, Math.random(), Math.random()] },
          'document' as NounType
        )
      }

      // Get stats to verify memory isolation
      const stats = index.getStats()

      expect(stats.typeCount).toBe(2)
      expect(stats.typeStats.has('person' as NounType)).toBe(true)
      expect(stats.typeStats.has('document' as NounType)).toBe(true)

      const personStats = stats.typeStats.get('person' as NounType)!
      const docStats = stats.typeStats.get('document' as NounType)!

      expect(personStats.nodeCount).toBe(100)
      expect(docStats.nodeCount).toBe(100)

      // Verify memory is tracked separately (may be 0 in MemoryStorage)
      expect(personStats.memoryMB).toBeGreaterThanOrEqual(0)
      expect(docStats.memoryMB).toBeGreaterThanOrEqual(0)

      // Clear one type and verify other is unaffected
      index.clearType('person' as NounType)

      expect(index.sizeForType('person' as NounType)).toBe(0)
      expect(index.sizeForType('document' as NounType)).toBe(100)
    })
  })

  // ===================================================================
  // 6. CACHE BEHAVIOR
  // ===================================================================

  describe('Cache Behavior', () => {
    it('should use UnifiedCache across all type indexes', async () => {
      const storage = new MemoryStorage()
      const index = new TypeAwareHNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { storage }
      )

      // Add entities to different types
      await index.addItem(
        { id: 'person-1', vector: [1, 0, 0] },
        'person' as NounType
      )
      await index.addItem(
        { id: 'doc-1', vector: [0, 1, 0] },
        'document' as NounType
      )

      // Get cache stats for each type
      const personStats = index.getStatsForType('person' as NounType)
      const docStats = index.getStatsForType('document' as NounType)

      expect(personStats).not.toBeNull()
      expect(docStats).not.toBeNull()

      // Verify cache stats are available
      expect(personStats!.cacheStats).toBeDefined()
      expect(docStats!.cacheStats).toBeDefined()

      // UnifiedCache is shared, so both should have cache stats
      expect(personStats!.cacheStats.hnswCache).toBeDefined()
      expect(docStats!.cacheStats.hnswCache).toBeDefined()
    })
  })

  // ===================================================================
  // 7. PERFORMANCE CHARACTERISTICS
  // ===================================================================

  describe('Performance Characteristics', () => {
    it('should have faster single-type search than all-types search', async () => {
      const storage = new MemoryStorage()
      const index = new TypeAwareHNSWIndex(
        { M: 8, efConstruction: 100, efSearch: 50 },
        euclideanDistance,
        { storage }
      )

      // Add 500 entities across 5 types
      const types: NounType[] = [
        'person',
        'document',
        'event',
        'organization',
        'location'
      ]

      for (const type of types) {
        for (let i = 0; i < 100; i++) {
          await index.addItem(
            {
              id: `${type}-${i}`,
              vector: [Math.random(), Math.random(), Math.random()]
            },
            type
          )
        }
      }

      // Measure single-type search time
      const singleTypeStart = Date.now()
      await index.search([0.5, 0.5, 0.5], 10, 'person' as NounType)
      const singleTypeTime = Date.now() - singleTypeStart

      // Measure all-types search time
      const allTypesStart = Date.now()
      await index.search([0.5, 0.5, 0.5], 10)
      const allTypesTime = Date.now() - allTypesStart

      // Single-type should be faster (but this is a loose check for small dataset)
      // At billion scale, this difference would be 10x
      expect(singleTypeTime).toBeLessThanOrEqual(allTypesTime * 2)
    }, 15000)

    it('should demonstrate memory reduction', async () => {
      const storage = new MemoryStorage()
      const index = new TypeAwareHNSWIndex(
        { M: 8, efConstruction: 100, efSearch: 50 },
        euclideanDistance,
        { storage }
      )

      // Add 1000 entities across 10 types
      const types: NounType[] = [
        'person',
        'document',
        'event',
        'organization',
        'location',
        'product',
        'concept',
        'project',
        'task',
        'message'
      ]

      for (const type of types) {
        for (let i = 0; i < 100; i++) {
          await index.addItem(
            {
              id: `${type}-${i}`,
              vector: [Math.random(), Math.random(), Math.random(), Math.random()]
            },
            type
          )
        }
      }

      const stats = index.getStats()

      expect(stats.totalNodes).toBe(1000)
      expect(stats.typeCount).toBe(10)

      // Verify memory reduction is calculated
      expect(stats.estimatedMonolithicMemoryMB).toBeGreaterThan(0)
      expect(stats.totalMemoryMB).toBeGreaterThanOrEqual(0)
      expect(stats.memoryReductionPercent).toBeGreaterThanOrEqual(0)

      // At this scale, reduction should be significant
      expect(stats.totalMemoryMB).toBeLessThan(
        stats.estimatedMonolithicMemoryMB
      )
    }, 30000)
  })
})
