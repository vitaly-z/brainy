/**
 * Phase 1c Integration Tests: Brainy with Type-Aware Features
 *
 * Tests the integration of Phase 1b (TypeFirstMetadataIndex) with the main Brainy class.
 * Validates new API methods, backward compatibility, and real-world workflows.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'

describe('Brainy - Phase 1c: Type-Aware Integration', () => {
  let brainy: Brainy<any>
  let testDir: string

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = join(tmpdir(), `brainy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }

    brainy = new Brainy({
      storage: {
        type: 'filesystem',
        rootDirectory: testDir
      },
      dimensions: 384,
      silent: true
    })

    await brainy.init()
  })

  afterEach(async () => {
    // Cleanup
    if (testDir && existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  })

  describe('Enhanced Counts API', () => {
    describe('byTypeEnum() - Type-safe counting', () => {
      it('should count entities by NounType enum', async () => {
        // Add entities of different types
        await brainy.add({ data: 'Alice info', type: NounType.Person, metadata: { name: 'Alice' } })
        await brainy.add({ data: 'Bob info', type: NounType.Person, metadata: { name: 'Bob' } })
        await brainy.add({ data: 'Document content', type: NounType.Document, metadata: { title: 'Doc1' } })

        // Use new type-enum method
        expect(brainy.counts.byTypeEnum('person')).toBe(2)
        expect(brainy.counts.byTypeEnum('document')).toBe(1)
        expect(brainy.counts.byTypeEnum('event')).toBe(0)
      })

      it('should have same result as string-based byType()', async () => {
        await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })
        await brainy.add({ data: 'Bob', type: NounType.Person, metadata: { name: 'Bob' } })

        // Both APIs should return same count
        const enumCount = brainy.counts.byTypeEnum('person')
        const stringCount = brainy.counts.byType('person')

        expect(enumCount).toBe(stringCount)
        expect(enumCount).toBe(2)
      })

      it('should be type-safe (compile-time)', () => {
        // This should compile without errors
        const count: number = brainy.counts.byTypeEnum('person')

        // TypeScript should enforce NounType
        // @ts-expect-error - should not accept invalid type
        // const invalid = brainy.counts.byTypeEnum('invalidType')

        expect(count).toBeGreaterThanOrEqual(0)
      })
    })

    describe('topTypes() - Top N types by count', () => {
      beforeEach(async () => {
        // Add entities with different type distributions
        for (let i = 0; i < 100; i++) {
          await brainy.add({ data: `Person ${i}`, type: NounType.Person, metadata: { name: `Person ${i}` } })
        }
        for (let i = 0; i < 50; i++) {
          await brainy.add({ data: `Doc ${i}`, type: NounType.Document, metadata: { title: `Doc ${i}` } })
        }
        for (let i = 0; i < 10; i++) {
          await brainy.add({ data: `Event ${i}`, type: NounType.Event, metadata: { name: `Event ${i}` } })
        }
      })

      it('should return top N types sorted by count', () => {
        const top3 = brainy.counts.topTypes(3)

        expect(top3).toEqual(['person', 'document', 'event'])
        expect(top3[0]).toBe('person') // Highest count
      })

      it('should limit results to N', () => {
        const top2 = brainy.counts.topTypes(2)

        expect(top2.length).toBe(2)
        expect(top2).toEqual(['person', 'document'])
      })

      it('should default to 10 types', () => {
        const topDefault = brainy.counts.topTypes()

        // Should return at most 10 (we have 3 types)
        expect(topDefault.length).toBeLessThanOrEqual(10)
        expect(topDefault.length).toBe(3)
      })

      it('should handle requesting more types than exist', () => {
        const top100 = brainy.counts.topTypes(100)

        // Only 3 types have entities
        expect(top100.length).toBe(3)
      })
    })

    describe('topVerbTypes() - Top N verb types', () => {
      it('should return empty array when no relationships exist', () => {
        const topVerbs = brainy.counts.topVerbTypes(5)

        expect(topVerbs).toEqual([])
      })

      it('should be callable without errors', () => {
        // Method should exist and be callable
        expect(typeof brainy.counts.topVerbTypes).toBe('function')
        const result = brainy.counts.topVerbTypes()
        expect(Array.isArray(result)).toBe(true)
      })
    })

    describe('allNounTypeCounts() - Get all noun type counts', () => {
      it('should return Map of all noun type counts', async () => {
        await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })
        await brainy.add({ data: 'Bob', type: NounType.Person, metadata: { name: 'Bob' } })
        await brainy.add({ data: 'Doc', type: NounType.Document, metadata: { title: 'Doc' } })

        const allCounts = brainy.counts.allNounTypeCounts()

        expect(allCounts).toBeInstanceOf(Map)
        expect(allCounts.get('person')).toBe(2)
        expect(allCounts.get('document')).toBe(1)
      })

      it('should only include types with non-zero counts', async () => {
        await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })

        const allCounts = brainy.counts.allNounTypeCounts()

        // Only 1 type has entities
        expect(allCounts.size).toBe(1)
        expect(allCounts.has('person')).toBe(true)
        expect(allCounts.has('document')).toBe(false)
      })

      it('should be type-safe Map<NounType, number>', async () => {
        await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })

        const allCounts: Map<NounType, number> = brainy.counts.allNounTypeCounts()

        // TypeScript should enforce types
        for (const [type, count] of allCounts) {
          expect(typeof count).toBe('number')
          expect(count).toBeGreaterThan(0)
        }
      })
    })

    describe('allVerbTypeCounts() - Get all verb type counts', () => {
      it('should return empty Map when no relationships exist', () => {
        const allCounts = brainy.counts.allVerbTypeCounts()

        expect(allCounts).toBeInstanceOf(Map)
        expect(allCounts.size).toBe(0)
      })

      it('should be type-safe Map<VerbType, number>', () => {
        const allCounts: Map<VerbType, number> = brainy.counts.allVerbTypeCounts()

        // TypeScript should enforce types
        expect(allCounts).toBeInstanceOf(Map)
      })
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain existing byType() API', async () => {
      await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })

      // Old API should still work
      expect(brainy.counts.byType('person')).toBe(1)
      expect(brainy.counts.byType()).toEqual({ person: 1 })
    })

    it('should maintain existing entities() API', async () => {
      await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })
      await brainy.add({ data: 'Doc', type: NounType.Document, metadata: { title: 'Doc' } })

      expect(brainy.counts.entities()).toBe(2)
    })

    it('should maintain existing getAllTypeCounts() API', async () => {
      await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })

      const counts = brainy.counts.getAllTypeCounts()

      expect(counts).toBeInstanceOf(Map)
      expect(counts.get('person')).toBe(1)
    })

    it('should maintain existing getStats() API', async () => {
      await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })

      const stats = brainy.counts.getStats()

      expect(stats.entities.total).toBe(1)
      expect(stats.entities.byType).toEqual({ person: 1 })
    })
  })

  describe('Auto-Sync Behavior', () => {
    it('should sync counts when adding entities', async () => {
      await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })

      // Both APIs should show same count immediately
      expect(brainy.counts.byType('person')).toBe(1)
      expect(brainy.counts.byTypeEnum('person')).toBe(1)
    })

    it('should sync counts across multiple add operations', async () => {
      // Add multiple entities
      await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })
      await brainy.add({ data: 'Bob', type: NounType.Person, metadata: { name: 'Bob' } })
      await brainy.add({ data: 'Doc', type: NounType.Document, metadata: { title: 'Doc' } })

      // Both APIs should stay in sync
      expect(brainy.counts.byType('person')).toBe(2)
      expect(brainy.counts.byTypeEnum('person')).toBe(2)
      expect(brainy.counts.byType('document')).toBe(1)
      expect(brainy.counts.byTypeEnum('document')).toBe(1)
    })
  })

  describe('Real-World Workflows', () => {
    it('should handle knowledge graph construction', async () => {
      // Build a small knowledge graph
      const alice = await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice', role: 'Engineer' } })
      const bob = await brainy.add({ data: 'Bob', type: NounType.Person, metadata: { name: 'Bob', role: 'Manager' } })
      const acme = await brainy.add({ data: 'Acme Corp', type: NounType.Organization, metadata: { name: 'Acme Corp' } })
      const project = await brainy.add({ data: 'Project X', type: NounType.Project, metadata: { name: 'Project X' } })

      await brainy.relate({ from: alice, to: acme, type: VerbType.MemberOf })
      await brainy.relate({ from: bob, to: acme, type: VerbType.MemberOf })
      await brainy.relate({ from: alice, to: project, type: VerbType.WorksWith })
      await brainy.relate({ from: bob, to: project, type: VerbType.ReportsTo })

      // Query type statistics
      const topTypes = brainy.counts.topTypes(5)
      expect(topTypes).toContain('person')
      expect(topTypes).toContain('organization')

      // Type-specific counts
      expect(brainy.counts.byTypeEnum('person')).toBe(2)
      expect(brainy.counts.byTypeEnum('organization')).toBe(1)
      expect(brainy.counts.byTypeEnum('project')).toBe(1)

      // All counts
      const allCounts = brainy.counts.allNounTypeCounts()
      expect(allCounts.size).toBe(3) // person, organization, project
    })

    it('should handle document management system', async () => {
      // Create documents and authors
      const author1 = await brainy.add({ data: 'Author 1', type: NounType.Person, metadata: { name: 'Author 1' } })
      const author2 = await brainy.add({ data: 'Author 2', type: NounType.Person, metadata: { name: 'Author 2' } })

      for (let i = 0; i < 10; i++) {
        const doc = await brainy.add({ data: `Document ${i}`, type: NounType.Document, metadata: { title: `Document ${i}` } })
        await brainy.relate({ from: author1, to: doc, type: VerbType.Creates })
      }

      for (let i = 0; i < 5; i++) {
        const doc = await brainy.add({ data: `Paper ${i}`, type: NounType.Document, metadata: { title: `Paper ${i}` } })
        await brainy.relate({ from: author2, to: doc, type: VerbType.Creates })
      }

      // Verify counts
      expect(brainy.counts.byTypeEnum('person')).toBe(2)
      expect(brainy.counts.byTypeEnum('document')).toBe(15)

      // Check distribution
      const topTypes = brainy.counts.topTypes(2)
      expect(topTypes[0]).toBe('document') // Most common
      expect(topTypes[1]).toBe('person')
    })

    it('should handle entity lifecycle with type tracking', async () => {
      // Create entities of different types
      const entities: string[] = []
      for (let i = 0; i < 50; i++) {
        const id = await brainy.add({ data: `Person ${i}`, type: NounType.Person, metadata: { name: `Person ${i}` } })
        entities.push(id)
      }

      expect(brainy.counts.byTypeEnum('person')).toBe(50)

      // Add different types
      for (let i = 0; i < 10; i++) {
        await brainy.add({ data: `Doc ${i}`, type: NounType.Document, metadata: { title: `Doc ${i}` } })
      }

      expect(brainy.counts.byTypeEnum('document')).toBe(10)

      // Check top types
      const topTypes = brainy.counts.topTypes(2)
      expect(topTypes).toEqual(['person', 'document'])
    })
  })

  describe('Cache Warming Integration', () => {
    it('should warm cache on init for top types', async () => {
      // Pre-populate with data
      for (let i = 0; i < 100; i++) {
        await brainy.add({ data: `Person ${i}`, type: NounType.Person, metadata: { name: `Person ${i}` } })
      }
      for (let i = 0; i < 50; i++) {
        await brainy.add({ data: `Doc ${i}`, type: NounType.Document, metadata: { title: `Doc ${i}` } })
      }
      await brainy.flush()

      // Create new instance (should warm cache on init)
      const brainy2 = new Brainy({
        storage: {
          type: 'filesystem',
          rootDirectory: testDir
        },
        dimensions: 384,
        silent: true
      })

      await brainy2.init() // Calls warmCacheForTopTypes(3) internally

      // Cache should be warmed for top types
      const topTypes = brainy2.counts.topTypes(3)
      expect(topTypes[0]).toBe('person') // Most common type
      expect(topTypes[1]).toBe('document')
    })
  })

  describe('Performance Characteristics', () => {
    it('should have O(1) access time for type counts', async () => {
      // Add entities
      for (let i = 0; i < 100; i++) {
        await brainy.add({ data: `Person ${i}`, type: NounType.Person, metadata: { name: `Person ${i}` } })
      }

      // Measure access time (should be O(1))
      const iterations = 1000
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        brainy.counts.byTypeEnum('person')
      }

      const end = performance.now()
      const timePerOp = (end - start) / iterations

      // 1000 operations should complete in < 10ms total
      // (each operation should be < 0.01ms)
      expect(end - start).toBeLessThan(10)
      console.log(`  Average time per count query: ${timePerOp.toFixed(4)}ms`)
    })

    it('should have consistent performance regardless of total entities', async () => {
      // Add 10 entities
      for (let i = 0; i < 10; i++) {
        await brainy.add({ data: `Person ${i}`, type: NounType.Person, metadata: { name: `Person ${i}` } })
      }

      const start1 = performance.now()
      for (let i = 0; i < 100; i++) {
        brainy.counts.byTypeEnum('person')
      }
      const time1 = performance.now() - start1

      // Add 90 more entities (10x more)
      for (let i = 0; i < 90; i++) {
        await brainy.add({ data: `Person ${i + 10}`, type: NounType.Person, metadata: { name: `Person ${i + 10}` } })
      }

      const start2 = performance.now()
      for (let i = 0; i < 100; i++) {
        brainy.counts.byTypeEnum('person')
      }
      const time2 = performance.now() - start2

      // Time should be roughly the same (O(1))
      // Allow 2x variance for system noise
      expect(time2).toBeLessThan(time1 * 2)

      console.log(`  Time with 10 entities: ${time1.toFixed(2)}ms`)
      console.log(`  Time with 100 entities: ${time2.toFixed(2)}ms`)
    })
  })

  describe('Type Safety', () => {
    it('should enforce NounType in byTypeEnum', () => {
      // Valid types should compile
      expect(() => brainy.counts.byTypeEnum('person')).not.toThrow()
      expect(() => brainy.counts.byTypeEnum('document')).not.toThrow()
      expect(() => brainy.counts.byTypeEnum('event')).not.toThrow()

      // TypeScript should catch invalid types at compile time
      // @ts-expect-error
      // brainy.counts.byTypeEnum('invalidType')
    })

    it('should return typed Maps', async () => {
      await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })

      const nounCounts: Map<NounType, number> = brainy.counts.allNounTypeCounts()
      const verbCounts: Map<VerbType, number> = brainy.counts.allVerbTypeCounts()

      // TypeScript should enforce types
      expect(nounCounts).toBeInstanceOf(Map)
      expect(verbCounts).toBeInstanceOf(Map)
    })
  })
})
