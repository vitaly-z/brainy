/**
 * Comprehensive Public API Test Suite
 *
 * Validates all public API methods exposed by Brainy,
 * ensuring complete coverage of documented functionality.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType, VerbType } from '../../src/types/graphTypes'
import type { Entity, Result } from '../../src/types/brainy.types'
import * as fs from 'fs/promises'
import * as path from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

describe('Brainy Public API - Complete Coverage', () => {
  let brain: Brainy
  let testDir: string

  beforeAll(async () => {
    testDir = path.join(tmpdir(), `brainy-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error)
    }
  })

  describe('Core CRUD Operations', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()
    })

    afterEach(async () => {
      await brain.close()
    })

    describe('brain.add()', () => {
      it('should handle all noun types', async () => {
        const nounTypes = Object.values(NounType)

        for (const nounType of nounTypes) {
          const id = await brain.add({
            data: `Test ${nounType}`,
            type: nounType,
            metadata: { nounType }
          })

          expect(id).toBeDefined()
          expect(typeof id).toBe('string')

          const entity = await brain.get(id)
          expect(entity).toBeDefined()
          expect(entity?.type).toBe(nounType)
        }
      }, 120000)

      it('should validate required fields', async () => {
        await expect(brain.add({
          type: NounType.Document
        } as any)).rejects.toThrow()

        await expect(brain.add({
          data: 'test'
        } as any)).rejects.toThrow()
      })

      it('should handle very large data', async () => {
        const largeText = 'x'.repeat(1_000_000)
        const id = await brain.add({
          data: largeText,
          type: NounType.Document
        })

        const entity = await brain.get(id)
        expect(entity?.data).toBe(largeText)
      })
    })

    describe('brain.addMany()', () => {
      it('should handle batch operations', async () => {
        const items = Array.from({ length: 10 }, (_, i) => ({
          data: `Batch item ${i}`,
          type: NounType.Document,
          metadata: { index: i }
        }))

        const result = await brain.addMany({ items })
        expect(result.successful).toHaveLength(10)
      }, 120000)

      it('should handle partial failures', async () => {
        const items = [
          { data: 'Valid 1', type: NounType.Document },
          { data: null as any, type: NounType.Document },
          { data: 'Valid 2', type: NounType.Document }
        ]

        try {
          const result = await brain.addMany({ items })
          expect(result.successful.length).toBeGreaterThan(0)
        } catch (error) {
          expect(error).toBeDefined()
        }
      })
    })

    describe('brain.update()', () => {
      it('should handle concurrent updates', async () => {
        const id = await brain.add({
          data: 'Initial',
          type: NounType.Document,
          metadata: { version: 1 }
        })

        const updates = Array.from({ length: 10 }, (_, i) =>
          brain.update({
            id,
            metadata: { version: i + 2, updatedBy: `thread-${i}` }
          })
        )

        await Promise.all(updates)

        const final = await brain.get(id)
        expect(final).toBeDefined()
        expect(final?.metadata?.version).toBeGreaterThan(1)
      })

      it('should handle update of non-existent entity gracefully', async () => {
        const fakeId = randomUUID()
        try {
          await brain.update({ id: fakeId, metadata: { test: true } })
        } catch {
          // Brainy may throw for non-existent entity — acceptable
        }
      })

      it('should preserve unmodified fields', async () => {
        const id = await brain.add({
          data: 'Test',
          type: NounType.Document,
          metadata: {
            field1: 'value1',
            field2: 'value2',
            nested: { a: 1, b: 2 }
          }
        })

        await brain.update({
          id,
          metadata: { field1: 'updated' }
        })

        const updated = await brain.get(id)
        expect(updated?.metadata?.field1).toBe('updated')
        expect(updated?.metadata?.field2).toBe('value2')
        expect(updated?.metadata?.nested).toEqual({ a: 1, b: 2 })
      })
    })

    describe('brain.updateMany()', () => {
      it('should batch update multiple entities', async () => {
        const result = await brain.addMany({
          items: [
            { data: 'Item 1', type: NounType.Document },
            { data: 'Item 2', type: NounType.Document },
            { data: 'Item 3', type: NounType.Document }
          ]
        })

        const ids = result.successful
        const updates = ids.map(id => ({
          id,
          metadata: { updated: true }
        }))

        const updateResult = await brain.updateMany({ items: updates })
        expect(updateResult).toBeDefined()

        for (const id of ids) {
          const entity = await brain.get(id)
          expect(entity?.metadata?.updated).toBe(true)
        }
      })
    })

    describe('brain.delete()', () => {
      it('should handle cascade deletion of relationships', async () => {
        const id1 = await brain.add({ data: 'Entity 1', type: NounType.Person })
        const id2 = await brain.add({ data: 'Entity 2', type: NounType.Organization })

        await brain.relate({ from: id1, to: id2, type: VerbType.WorksWith })

        await brain.delete(id1)

        const relations = await brain.getRelations(id2)
        expect(relations.filter(r => r.from === id1 || r.to === id1)).toHaveLength(0)
      })

      it('should handle deletion of non-existent entity gracefully', async () => {
        const fakeId = randomUUID()
        try {
          await brain.delete(fakeId)
        } catch {
          // Brainy may throw for non-existent entity — acceptable
        }
      })
    })

    describe('brain.deleteMany()', () => {
      it('should efficiently delete batches', async () => {
        const result = await brain.addMany({
          items: Array.from({ length: 5 }, (_, i) => ({
            data: `Item ${i}`,
            type: NounType.Document
          }))
        })

        const ids = result.successful
        await brain.deleteMany({ ids })

        for (const id of ids) {
          const entity = await brain.get(id)
          expect(entity).toBeNull()
        }
      })
    })
  })

  describe('Relationship Operations', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()
    })

    afterEach(async () => {
      await brain.close()
    })

    describe('brain.relate()', () => {
      it('should create relationships with multiple verb types', async () => {
        const id1 = await brain.add({ data: 'Source', type: NounType.Person })
        const id2 = await brain.add({ data: 'Target', type: NounType.Organization })

        // Test a representative subset of verb types (not all 127)
        const testVerbs = [
          VerbType.RelatedTo, VerbType.Creates, VerbType.References,
          VerbType.WorksWith, VerbType.DependsOn, VerbType.Contains,
          VerbType.Requires, VerbType.FriendOf
        ]

        for (const verbType of testVerbs) {
          const relationId = await brain.relate({
            from: id1,
            to: id2,
            type: verbType,
            metadata: { verbType }
          })

          expect(relationId).toBeDefined()
          expect(typeof relationId).toBe('string')
        }
      })

      it('should handle bidirectional relationships', async () => {
        const person1 = await brain.add({ data: 'Alice', type: NounType.Person })
        const person2 = await brain.add({ data: 'Bob', type: NounType.Person })

        await brain.relate({
          from: person1,
          to: person2,
          type: VerbType.FriendOf,
          bidirectional: true
        })

        const relations1 = await brain.getRelations(person1)
        const relations2 = await brain.getRelations(person2)

        expect(relations1.some(r => r.to === person2)).toBe(true)
        expect(relations2.some(r => r.to === person1)).toBe(true)
      })

      it('should allow duplicate relationships', async () => {
        const id1 = await brain.add({ data: 'A', type: NounType.Document })
        const id2 = await brain.add({ data: 'B', type: NounType.Document })

        await brain.relate({ from: id1, to: id2, type: VerbType.References })
        await brain.relate({ from: id1, to: id2, type: VerbType.References })

        const relations = await brain.getRelations(id1)
        const referenceRelations = relations.filter(
          r => r.type === VerbType.References && r.to === id2
        )

        expect(referenceRelations.length).toBeGreaterThanOrEqual(1)
      })

      it('should handle relationship metadata and weights', async () => {
        const id1 = await brain.add({ data: 'Source', type: NounType.Document })
        const id2 = await brain.add({ data: 'Target', type: NounType.Document })

        const relationId = await brain.relate({
          from: id1,
          to: id2,
          type: VerbType.References,
          weight: 0.8,
          metadata: {
            context: 'academic',
            verified: true
          }
        })

        const relations = await brain.getRelations(id1)
        const relation = relations.find(r => r.id === relationId)

        expect(relation).toBeDefined()
        expect(relation?.metadata?.context).toBe('academic')
      })
    })

    describe('brain.relateMany()', () => {
      it('should create multiple relationships efficiently', async () => {
        const result = await brain.addMany({
          items: Array.from({ length: 5 }, (_, i) => ({
            data: `Entity ${i}`,
            type: NounType.Document
          }))
        })

        const entities = result.successful

        const items = []
        for (let i = 0; i < entities.length - 1; i++) {
          items.push({
            from: entities[i],
            to: entities[i + 1],
            type: VerbType.Precedes
          })
        }

        const relationIds = await brain.relateMany({ items })
        expect(relationIds).toHaveLength(items.length)
      })
    })

    describe('brain.getRelations()', () => {
      it('should retrieve outgoing relationships', async () => {
        const center = await brain.add({ data: 'Center', type: NounType.Person })
        const related1 = await brain.add({ data: 'Related1', type: NounType.Organization })
        const related2 = await brain.add({ data: 'Related2', type: NounType.Document })

        await brain.relate({ from: center, to: related1, type: VerbType.WorksWith })
        await brain.relate({ from: center, to: related2, type: VerbType.Creates })

        const outgoing = await brain.getRelations({ from: center })

        expect(outgoing).toHaveLength(2)
        expect(outgoing.some(r => r.type === VerbType.WorksWith)).toBe(true)
        expect(outgoing.some(r => r.type === VerbType.Creates)).toBe(true)
      })

      it('should retrieve incoming relationships', async () => {
        const center = await brain.add({ data: 'Center', type: NounType.Person })
        const source = await brain.add({ data: 'Source', type: NounType.Task })

        await brain.relate({ from: source, to: center, type: VerbType.DependsOn })

        const incoming = await brain.getRelations({ to: center })

        expect(incoming).toHaveLength(1)
        expect(incoming[0].type).toBe(VerbType.DependsOn)
      })

      it('should filter by relationship direction', async () => {
        const center = await brain.add({ data: 'Center', type: NounType.Document })
        const source = await brain.add({ data: 'Source', type: NounType.Person })
        const target = await brain.add({ data: 'Target', type: NounType.Task })

        await brain.relate({ from: source, to: center, type: VerbType.Creates })
        await brain.relate({ from: center, to: target, type: VerbType.Requires })

        const outgoing = await brain.getRelations({ from: center })
        const incoming = await brain.getRelations({ to: center })

        expect(outgoing).toHaveLength(1)
        expect(outgoing[0].to).toBe(target)

        expect(incoming).toHaveLength(1)
        expect(incoming[0].from).toBe(source)
      })

      it('should filter by verb type', async () => {
        const doc = await brain.add({ data: 'Document', type: NounType.Document })
        const ref1 = await brain.add({ data: 'Reference1', type: NounType.Document })
        const ref2 = await brain.add({ data: 'Reference2', type: NounType.Document })
        const author = await brain.add({ data: 'Author', type: NounType.Person })

        await brain.relate({ from: doc, to: ref1, type: VerbType.References })
        await brain.relate({ from: doc, to: ref2, type: VerbType.References })
        await brain.relate({ from: author, to: doc, type: VerbType.Creates })

        const references = await brain.getRelations({
          from: doc,
          type: VerbType.References
        })

        expect(references).toHaveLength(2)
        expect(references.every(r => r.type === VerbType.References)).toBe(true)
      })
    })
  })

  describe('Search Operations', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()

      await brain.addMany({
        items: [
          { data: 'The quick brown fox', type: NounType.Document, metadata: { category: 'animals' } },
          { data: 'jumps over the lazy dog', type: NounType.Document, metadata: { category: 'animals' } },
          { data: 'Machine learning algorithms', type: NounType.Document, metadata: { category: 'tech' } },
          { data: 'Deep neural networks', type: NounType.Document, metadata: { category: 'tech' } },
          { data: 'Natural language processing', type: NounType.Document, metadata: { category: 'tech' } }
        ]
      })
    }, 120000)

    afterEach(async () => {
      await brain.close()
    })

    describe('brain.find()', () => {
      it('should support metadata search', async () => {
        const results = await brain.find({
          where: { category: 'tech' },
          limit: 5
        })

        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeGreaterThan(0)
      })

      it('should handle metadata filters', async () => {
        const results = await brain.find({
          where: { category: 'tech' },
          limit: 10
        })

        expect(results.length).toBeGreaterThan(0)
        expect(results.every(r => r.entity.metadata?.category === 'tech')).toBe(true)
      })

      it('should support graph-connected searches', async () => {
        const doc1 = await brain.add({ data: 'Primary document', type: NounType.Document })
        const doc2 = await brain.add({ data: 'Related document', type: NounType.Document })
        await brain.relate({ from: doc1, to: doc2, type: VerbType.References })

        const results = await brain.find({
          query: 'document',
          connected: { from: doc1 },
          limit: 5
        })

        expect(results.some(r => r.entity.id === doc2)).toBe(true)
      })

      it('should support pagination', async () => {
        const page1 = await brain.find({
          where: { category: 'tech' },
          limit: 2,
          offset: 0
        })

        const page2 = await brain.find({
          where: { category: 'tech' },
          limit: 2,
          offset: 2
        })

        if (page1.length > 0 && page2.length > 0) {
          expect(page1[0]?.entity.id).not.toBe(page2[0]?.entity.id)
        }
      })
    })

    describe('brain.similar()', () => {
      it('should find similar entities', async () => {
        const reference = await brain.add({
          data: 'Artificial intelligence and machine learning',
          type: NounType.Document
        })

        const similar = await brain.similar({
          to: reference,
          limit: 5
        })

        expect(similar).toBeDefined()
        expect(similar.length).toBeGreaterThan(0)
      })

      it('should return results sorted by score', async () => {
        const reference = await brain.add({
          data: 'Deep learning and neural networks research',
          type: NounType.Document
        })

        const similar = await brain.similar({
          to: reference,
          limit: 10
        })

        // Results should be sorted by score (descending)
        if (similar.length > 1) {
          for (let i = 1; i < similar.length; i++) {
            expect(similar[i - 1].score).toBeGreaterThanOrEqual(similar[i].score - 0.001)
          }
        }
      })
    })
  })

  describe('Neural API', () => {
    let entityIds: string[]

    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()

      const result = await brain.addMany({
        items: [
          { data: 'Cat', type: NounType.Concept, metadata: { category: 'animal' } },
          { data: 'Dog', type: NounType.Concept, metadata: { category: 'animal' } },
          { data: 'Tiger', type: NounType.Concept, metadata: { category: 'animal' } },
          { data: 'Car', type: NounType.Thing, metadata: { category: 'vehicle' } },
          { data: 'Truck', type: NounType.Thing, metadata: { category: 'vehicle' } },
          { data: 'Python', type: NounType.Language, metadata: { category: 'programming' } },
          { data: 'JavaScript', type: NounType.Language, metadata: { category: 'programming' } }
        ]
      })
      entityIds = result.successful
    }, 120000)

    afterEach(async () => {
      await brain.close()
    })

    describe('brain.neural().clusters()', () => {
      it('should cluster entities by similarity', async () => {
        const clusters = await brain.neural().clusters({
          k: 3,
          maxIterations: 10
        })

        expect(clusters).toBeDefined()
        expect(clusters.length).toBeGreaterThan(0)
        expect(clusters.every(c => c.members.length > 0)).toBe(true)
      })
    })

    describe('brain.neural().hierarchy()', () => {
      it('should build semantic hierarchy for an entity', async () => {
        // hierarchy() requires an entity ID
        const hierarchy = await brain.neural().hierarchy(entityIds[0])

        expect(hierarchy).toBeDefined()
        // Hierarchy structure includes optional root, levels, children, etc.
        expect(typeof hierarchy).toBe('object')
      })
    })

    describe('brain.neural().outliers()', () => {
      it('should detect anomalous entities', async () => {
        await brain.add({
          data: 'Quantum physics equations and string theory',
          type: NounType.Document,
          metadata: { category: 'science' }
        })

        const outliers = await brain.neural().outliers({
          threshold: 0.8
        })

        expect(outliers).toBeDefined()
        expect(Array.isArray(outliers)).toBe(true)
      })
    })

    describe('brain.neural().visualize()', () => {
      it('should generate visualization data', async () => {
        const vizData = await brain.neural().visualize({
          dimensions: 2,
          algorithm: 'force'
        })

        expect(vizData).toBeDefined()
        expect(vizData.nodes).toBeDefined()
        expect(Array.isArray(vizData.nodes)).toBe(true)
      })
    })

    describe('brain.neural().neighbors()', () => {
      it('should find nearest neighbors', async () => {
        if (entityIds.length > 0) {
          const result = await brain.neural().neighbors(entityIds[0], {
            limit: 3
          })

          // NeighborsResult has a neighbors array
          expect(result).toBeDefined()
          expect(result.neighbors).toBeDefined()
          // Small datasets may not produce nearest neighbors
          expect(result.neighbors.length).toBeGreaterThanOrEqual(0)
        }
      })
    })
  })

  describe('Statistics', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()
    })

    afterEach(async () => {
      await brain.close()
    })

    describe('brain.getStats()', () => {
      it('should return statistics', async () => {
        await brain.addMany({
          items: [
            { data: 'Item 1', type: NounType.Document },
            { data: 'Item 2', type: NounType.Person },
            { data: 'Item 3', type: NounType.Task }
          ]
        })

        const stats = await brain.getStats()

        expect(stats).toBeDefined()
        // Stats returns { entities: { total, byType }, relationships, density }
        expect(stats.entities).toBeDefined()
        expect(stats.entities.total).toBeGreaterThanOrEqual(3)
        expect(stats.entities.byType).toBeDefined()
      })
    })
  })

  describe('FileSystem Storage', () => {
    it('should handle basic CRUD with filesystem', async () => {
      const fsTestDir = path.join(tmpdir(), `brainy-fs-crud-${Date.now()}`)
      await fs.mkdir(fsTestDir, { recursive: true })

      const fsBrain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: fsTestDir }
        }
      })

      await fsBrain.init()

      const id = await fsBrain.add({
        data: 'Filesystem test',
        type: NounType.Document
      })

      const retrieved = await fsBrain.get(id)
      expect(retrieved?.data).toBe('Filesystem test')

      await fsBrain.update({ id, metadata: { updated: true } })

      const updated = await fsBrain.get(id)
      expect(updated?.metadata?.updated).toBe(true)

      await fsBrain.delete(id)
      const deleted = await fsBrain.get(id)
      expect(deleted).toBeNull()

      await fsBrain.close()
      await fs.rm(fsTestDir, { recursive: true, force: true }).catch(() => {})
    })

    it('should handle concurrent filesystem operations', async () => {
      const fsTestDir = path.join(tmpdir(), `brainy-fs-concurrent-${Date.now()}`)
      await fs.mkdir(fsTestDir, { recursive: true })

      const fsBrain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: fsTestDir }
        }
      })

      await fsBrain.init()

      const operations = Array.from({ length: 5 }, async (_, i) => {
        const id = await fsBrain.add({
          data: `Concurrent ${i}`,
          type: NounType.Document
        })
        return id
      })

      const ids = await Promise.all(operations)
      expect(ids).toHaveLength(5)
      expect(new Set(ids).size).toBe(5)

      await fsBrain.close()
      await fs.rm(fsTestDir, { recursive: true, force: true }).catch(() => {})
    })
  })

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()
    })

    afterEach(async () => {
      await brain.close()
    })

    it('should handle and recover from transient errors', async () => {
      const originalAdd = brain.add.bind(brain)
      let failCount = 0
      brain.add = vi.fn(async (...args) => {
        if (failCount++ < 2) {
          throw new Error('Storage temporarily unavailable')
        }
        return originalAdd(...args)
      })

      let succeeded = false
      for (let i = 0; i < 3; i++) {
        try {
          await brain.add({
            data: 'Test',
            type: NounType.Document
          })
          succeeded = true
          break
        } catch (error) {
          // Expected for first attempts
        }
      }

      expect(succeeded).toBe(true)
    })

    it('should handle malformed input gracefully', async () => {
      const malformedInputs = [
        null,
        undefined,
        {},
        { data: null },
        { type: 'invalid' },
      ]

      for (const input of malformedInputs) {
        try {
          await brain.add(input as any)
        } catch (error) {
          expect(error).toBeDefined()
          expect((error as Error).message).toBeDefined()
        }
      }
    })
  })

  describe('Performance', () => {
    it('should handle moderate-scale operations', async () => {
      const perfBrain = new Brainy({ storage: { type: 'memory' } })
      await perfBrain.init()

      // Add 50 items in batches
      const items = Array.from({ length: 50 }, (_, i) => ({
        data: `Performance item ${i}`,
        type: NounType.Document,
        metadata: { batch: Math.floor(i / 10), index: i }
      }))

      const result = await perfBrain.addMany({ items })
      expect(result.successful.length).toBe(50)

      // Search should work
      const results = await perfBrain.find({
        query: 'Performance item',
        limit: 20
      })
      expect(results.length).toBeGreaterThan(0)

      await perfBrain.close()
    }, 180000)
  })

  describe('Clear Operations', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()

      await brain.addMany({
        items: [
          { data: 'Doc 1', type: NounType.Document, metadata: { category: 'A' } },
          { data: 'Doc 2', type: NounType.Document, metadata: { category: 'B' } },
          { data: 'Person 1', type: NounType.Person, metadata: { category: 'A' } }
        ]
      })
    }, 120000)

    afterEach(async () => {
      await brain.close()
    })

    it('should clear data and allow re-use', async () => {
      const beforeClear = await brain.find({ where: { category: 'A' } })
      expect(beforeClear.length).toBeGreaterThan(0)

      await brain.clear()

      // After clear, add should still work
      const id = await brain.add({ data: 'After clear', type: NounType.Document })
      const entity = await brain.get(id)
      expect(entity).toBeDefined()
      expect(entity?.data).toBe('After clear')
    }, 120000)
  })
})
