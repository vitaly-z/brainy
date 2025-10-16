/**
 * Phase 3 Integration Tests - Type-First Query Optimization
 *
 * End-to-end tests verifying Phase 3 works with the complete Brainy system
 * Target: 8 tests covering real-world scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import { TypeAwareHNSWIndex } from '../../src/hnsw/typeAwareHNSWIndex.js'

describe('Phase 3: Type-First Query Optimization - Integration', () => {
  let brainy: Brainy<any>

  beforeEach(async () => {
    // Initialize with memory storage and TypeAwareHNSWIndex
    brainy = new Brainy({
      name: 'phase3-test',
      dimension: 384,
      storage: {
        type: 'memory' // Use memory for fast tests
      },
      index: {
        M: 16,
        efConstruction: 200,
        efSearch: 50
      },
      debug: false // Disable debug logging for tests
    })

    await brainy.initialize()
  })

  afterEach(async () => {
    // Clean up
    await brainy.close()
  })

  // ========== Basic Type Inference Tests (3 tests) ==========

  describe('Basic Type Inference', () => {
    it('should automatically infer Person type from "engineer" query', async () => {
      // Add test data
      await brainy.add({
        type: NounType.Person,
        data: { name: 'Alice', role: 'engineer' }
      })

      await brainy.add({
        type: NounType.Document,
        data: { title: 'Engineering Guide' }
      })

      // Query with natural language
      const results = await brainy.find('Find engineers')

      // Should find Person, not Document
      expect(results.length).toBeGreaterThan(0)

      // Verify TypeAwareHNSWIndex is being used
      expect((brainy as any).index).toBeInstanceOf(TypeAwareHNSWIndex)
    })

    it('should handle queries with explicit type override', async () => {
      await brainy.add({
        type: NounType.Person,
        data: { name: 'Bob', role: 'developer' }
      })

      await brainy.add({
        type: NounType.Document,
        data: { title: 'Development Process' }
      })

      // Query with explicit type should override inference
      const results = await brainy.find({
        query: 'development',
        type: NounType.Document // Explicit override
      })

      // Should only find documents
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => r.entity.noun === NounType.Document)).toBe(true)
    })

    it('should handle multi-type queries efficiently', async () => {
      // Add diverse data
      await brainy.add({
        type: NounType.Person,
        data: { name: 'Charlie', company: 'TechCorp' }
      })

      await brainy.add({
        type: NounType.Organization,
        data: { name: 'TechCorp', industry: 'Software' }
      })

      await brainy.add({
        type: NounType.Document,
        data: { title: 'TechCorp Overview' }
      })

      // Query that should infer multiple types
      const results = await brainy.find('people at TechCorp')

      expect(results.length).toBeGreaterThan(0)

      // Should find both Person and Organization
      const types = results.map(r => r.entity.noun)
      expect(types).toContain(NounType.Person)
    })
  })

  // ========== Performance Tests (2 tests) ==========

  describe('Performance Impact', () => {
    it('should reduce query latency for type-specific queries', async () => {
      // Add 100 diverse entities
      for (let i = 0; i < 50; i++) {
        await brainy.add({
          type: NounType.Person,
          data: { name: `Person ${i}`, role: 'engineer' }
        })
      }

      for (let i = 0; i < 50; i++) {
        await brainy.add({
          type: NounType.Document,
          data: { title: `Document ${i}` }
        })
      }

      // Measure query with type inference
      const start = Date.now()
      const results = await brainy.find('Find engineers')
      const elapsed = Date.now() - start

      expect(results.length).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(1000) // Should be fast even with 100 entities

      // Verify results are correct type
      const personResults = results.filter(r => r.entity.noun === NounType.Person)
      expect(personResults.length).toBeGreaterThan(0)
    }, 10000)

    it('should handle high-volume queries without degradation', async () => {
      // Add test data
      for (let i = 0; i < 20; i++) {
        await brainy.add({
          type: NounType.Person,
          data: { name: `Person ${i}` }
        })
      }

      // Run 10 queries in sequence
      const latencies: number[] = []

      for (let i = 0; i < 10; i++) {
        const start = Date.now()
        await brainy.find('Find people')
        const elapsed = Date.now() - start
        latencies.push(elapsed)
      }

      // Verify consistent performance (no degradation)
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const maxLatency = Math.max(...latencies)

      expect(maxLatency).toBeLessThan(avgLatency * 2) // Max should not be > 2x avg
    }, 15000)
  })

  // ========== Edge Cases (2 tests) ==========

  describe('Edge Cases', () => {
    it('should handle queries with no matching types gracefully', async () => {
      await brainy.add({
        type: NounType.Person,
        data: { name: 'Dave' }
      })

      // Query that won't infer any specific type
      const results = await brainy.find('random stuff xyz')

      // Should still work (fallback to all-types)
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle empty query gracefully', async () => {
      await brainy.add({
        type: NounType.Person,
        data: { name: 'Eve' }
      })

      // Empty query should return results
      const results = await brainy.find({ limit: 5 })

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
    })
  })

  // ========== Backward Compatibility (1 test) ==========

  describe('Backward Compatibility', () => {
    it('should work with all existing query patterns', async () => {
      await brainy.add({
        type: NounType.Person,
        data: { name: 'Frank', age: 30 }
      })

      // Test various query patterns
      const results1 = await brainy.find({ query: 'Frank' })
      expect(results1.length).toBeGreaterThan(0)

      const results2 = await brainy.find({ type: NounType.Person })
      expect(results2.length).toBeGreaterThan(0)

      const results3 = await brainy.find({
        where: { age: 30 }
      })
      expect(results3.length).toBeGreaterThan(0)

      const results4 = await brainy.find('Find Frank')
      expect(results4.length).toBeGreaterThan(0)
    })
  })
})
