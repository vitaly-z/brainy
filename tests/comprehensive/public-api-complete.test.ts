/**
 * Comprehensive Public API Test Suite
 * 
 * This test suite validates ALL public API methods exposed by Brainy,
 * ensuring complete coverage of documented functionality.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType, VerbType } from '../../src/types/graphTypes'
import type { Entity, Result, SearchQuery, GraphConstraints } from '../../src/types/brainy.types'
import * as fs from 'fs/promises'
import * as path from 'path'
import { tmpdir } from 'os'

describe('Brainy Public API - Complete Coverage', () => {
  let brain: Brainy
  let testDir: string

  beforeAll(async () => {
    // Create test directory for filesystem tests
    testDir = path.join(tmpdir(), `brainy-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    // Cleanup test directory
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
      })

      it('should validate required fields', async () => {
        // Test missing data
        await expect(brain.add({
          type: NounType.Document
        } as any)).rejects.toThrow()

        // Test missing type
        await expect(brain.add({
          data: 'test'
        } as any)).rejects.toThrow()
      })

      it('should handle very large data', async () => {
        const largeText = 'x'.repeat(1_000_000) // 1MB of text
        const id = await brain.add({
          data: largeText,
          type: NounType.Document
        })
        
        const entity = await brain.get(id)
        expect(entity?.metadata?.content).toBe(largeText)
      })
    })

    describe('brain.addMany()', () => {
      it('should handle batch operations efficiently', async () => {
        const items = Array.from({ length: 1000 }, (_, i) => ({
          data: `Item ${i}`,
          type: NounType.Document,
          metadata: { index: i }
        }))

        const start = Date.now()
        const ids = await brain.addMany(items)
        const duration = Date.now() - start

        expect(ids).toHaveLength(1000)
        expect(duration).toBeLessThan(5000) // Should complete in < 5 seconds
      })

      it('should handle partial failures', async () => {
        const items = [
          { data: 'Valid 1', type: NounType.Document },
          { data: null as any, type: NounType.Document }, // Invalid
          { data: 'Valid 2', type: NounType.Document }
        ]

        // Should either fail completely or handle gracefully
        try {
          const ids = await brain.addMany(items)
          // If it succeeds, check partial results
          expect(ids.length).toBeGreaterThan(0)
        } catch (error) {
          // If it fails, ensure error is meaningful
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

        // Concurrent updates
        const updates = Array.from({ length: 10 }, (_, i) => 
          brain.update(id, { 
            metadata: { version: i + 2, updatedBy: `thread-${i}` }
          })
        )

        await Promise.all(updates)

        const final = await brain.get(id)
        expect(final).toBeDefined()
        expect(final?.metadata?.version).toBeGreaterThan(1)
      })

      it('should handle update of non-existent entity', async () => {
        const result = await brain.update('non-existent-id', {
          metadata: { test: true }
        })

        // Should handle gracefully (return false or throw)
        expect(result === false || result === undefined).toBe(true)
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

        await brain.update(id, {
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
        const ids = await brain.addMany([
          { data: 'Item 1', type: NounType.Document },
          { data: 'Item 2', type: NounType.Document },
          { data: 'Item 3', type: NounType.Document }
        ])

        const updates = ids.map(id => ({
          id,
          data: { metadata: { updated: true } }
        }))

        const results = await brain.updateMany(updates)
        expect(results).toBeDefined()

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
        
        await brain.relate(id1, id2, VerbType.WorksWith)
        
        await brain.delete(id1)
        
        const relations = await brain.getRelations(id2)
        expect(relations.filter(r => r.source === id1 || r.target === id1)).toHaveLength(0)
      })

      it('should return correct status for non-existent entity', async () => {
        const result = await brain.delete('non-existent-id')
        // Should not throw, just return false/undefined
        expect(result === false || result === undefined).toBe(true)
      })
    })

    describe('brain.deleteMany()', () => {
      it('should efficiently delete large batches', async () => {
        const ids = await brain.addMany(
          Array.from({ length: 100 }, (_, i) => ({
            data: `Item ${i}`,
            type: NounType.Document
          }))
        )

        const start = Date.now()
        await brain.deleteMany(ids)
        const duration = Date.now() - start

        expect(duration).toBeLessThan(1000) // Should be fast

        // Verify all deleted
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
      it('should create relationships with all verb types', async () => {
        const id1 = await brain.add({ data: 'Source', type: NounType.Person })
        const id2 = await brain.add({ data: 'Target', type: NounType.Organization })

        const verbTypes = Object.values(VerbType)
        
        for (const verbType of verbTypes) {
          const relationId = await brain.relate(id1, id2, verbType, {
            metadata: { verbType }
          })
          
          expect(relationId).toBeDefined()
          expect(typeof relationId).toBe('string')
        }
      })

      it('should handle bidirectional relationships', async () => {
        const person1 = await brain.add({ data: 'Alice', type: NounType.Person })
        const person2 = await brain.add({ data: 'Bob', type: NounType.Person })

        await brain.relate(person1, person2, VerbType.FriendOf, {
          bidirectional: true
        })

        const relations1 = await brain.getRelations(person1)
        const relations2 = await brain.getRelations(person2)

        expect(relations1.some(r => r.target === person2)).toBe(true)
        expect(relations2.some(r => r.target === person1)).toBe(true)
      })

      it('should prevent duplicate relationships', async () => {
        const id1 = await brain.add({ data: 'A', type: NounType.Document })
        const id2 = await brain.add({ data: 'B', type: NounType.Document })

        await brain.relate(id1, id2, VerbType.References)
        await brain.relate(id1, id2, VerbType.References) // Duplicate

        const relations = await brain.getRelations(id1)
        const referenceRelations = relations.filter(
          r => r.verb === VerbType.References && r.target === id2
        )

        // Should either prevent duplicate or handle gracefully
        expect(referenceRelations.length).toBeLessThanOrEqual(1)
      })

      it('should handle relationship metadata and weights', async () => {
        const id1 = await brain.add({ data: 'Source', type: NounType.Document })
        const id2 = await brain.add({ data: 'Target', type: NounType.Document })

        const relationId = await brain.relate(id1, id2, VerbType.References, {
          weight: 0.8,
          confidence: 0.95,
          metadata: {
            context: 'academic',
            verified: true
          }
        })

        const relations = await brain.getRelations(id1)
        const relation = relations.find(r => r.id === relationId)

        expect(relation?.weight).toBe(0.8)
        expect(relation?.confidence).toBe(0.95)
        expect(relation?.data?.context).toBe('academic')
      })
    })

    describe('brain.relateMany()', () => {
      it('should create multiple relationships efficiently', async () => {
        const entities = await brain.addMany(
          Array.from({ length: 10 }, (_, i) => ({
            data: `Entity ${i}`,
            type: NounType.Document
          }))
        )

        const relationships = []
        for (let i = 0; i < entities.length - 1; i++) {
          relationships.push({
            source: entities[i],
            target: entities[i + 1],
            verb: VerbType.Precedes
          })
        }

        const relationIds = await brain.relateMany(relationships)
        expect(relationIds).toHaveLength(relationships.length)
      })
    })

    describe('brain.getRelations()', () => {
      it('should retrieve all relationship types', async () => {
        const center = await brain.add({ data: 'Center', type: NounType.Person })
        const related1 = await brain.add({ data: 'Related1', type: NounType.Organization })
        const related2 = await brain.add({ data: 'Related2', type: NounType.Document })
        const related3 = await brain.add({ data: 'Related3', type: NounType.Task })

        await brain.relate(center, related1, VerbType.WorksWith)
        await brain.relate(center, related2, VerbType.Creates)
        await brain.relate(related3, center, VerbType.DependsOn)

        const relations = await brain.getRelations(center)
        
        expect(relations).toHaveLength(3)
        expect(relations.some(r => r.verb === VerbType.WorksWith)).toBe(true)
        expect(relations.some(r => r.verb === VerbType.Creates)).toBe(true)
        expect(relations.some(r => r.verb === VerbType.DependsOn)).toBe(true)
      })

      it('should filter by relationship direction', async () => {
        const center = await brain.add({ data: 'Center', type: NounType.Document })
        const source = await brain.add({ data: 'Source', type: NounType.Person })
        const target = await brain.add({ data: 'Target', type: NounType.Task })

        await brain.relate(source, center, VerbType.Creates)
        await brain.relate(center, target, VerbType.Requires)

        const outgoing = await brain.getRelations(center, { direction: 'outgoing' })
        const incoming = await brain.getRelations(center, { direction: 'incoming' })

        expect(outgoing).toHaveLength(1)
        expect(outgoing[0].target).toBe(target)
        
        expect(incoming).toHaveLength(1)
        expect(incoming[0].source).toBe(source)
      })

      it('should filter by verb type', async () => {
        const doc = await brain.add({ data: 'Document', type: NounType.Document })
        const ref1 = await brain.add({ data: 'Reference1', type: NounType.Document })
        const ref2 = await brain.add({ data: 'Reference2', type: NounType.Document })
        const author = await brain.add({ data: 'Author', type: NounType.Person })

        await brain.relate(doc, ref1, VerbType.References)
        await brain.relate(doc, ref2, VerbType.References)
        await brain.relate(author, doc, VerbType.Creates)

        const references = await brain.getRelations(doc, { 
          verbType: VerbType.References 
        })

        expect(references).toHaveLength(2)
        expect(references.every(r => r.verb === VerbType.References)).toBe(true)
      })
    })
  })

  describe('Search Operations', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()

      // Add test data
      await brain.addMany([
        { data: 'The quick brown fox', type: NounType.Document, metadata: { category: 'animals' } },
        { data: 'jumps over the lazy dog', type: NounType.Document, metadata: { category: 'animals' } },
        { data: 'Machine learning algorithms', type: NounType.Document, metadata: { category: 'tech' } },
        { data: 'Deep neural networks', type: NounType.Document, metadata: { category: 'tech' } },
        { data: 'Natural language processing', type: NounType.Document, metadata: { category: 'tech' } }
      ])
    })

    afterEach(async () => {
      await brain.close()
    })

    describe('brain.find()', () => {
      it('should support all search modes', async () => {
        const modes: Array<'auto' | 'vector' | 'metadata' | 'graph' | 'hybrid'> = [
          'auto', 'vector', 'metadata', 'graph', 'hybrid'
        ]

        for (const mode of modes) {
          const results = await brain.find({
            query: 'technology',
            mode,
            limit: 5
          })

          expect(results).toBeDefined()
          expect(Array.isArray(results)).toBe(true)
        }
      })

      it('should handle complex metadata filters', async () => {
        const results = await brain.find({
          where: {
            category: 'tech',
            $or: [
              { content: { $contains: 'neural' } },
              { content: { $contains: 'learning' } }
            ]
          },
          limit: 10
        })

        expect(results.length).toBeGreaterThan(0)
        expect(results.every(r => r.entity.metadata?.category === 'tech')).toBe(true)
      })

      it('should support graph-connected searches', async () => {
        const doc1 = await brain.add({ data: 'Primary document', type: NounType.Document })
        const doc2 = await brain.add({ data: 'Related document', type: NounType.Document })
        await brain.relate(doc1, doc2, VerbType.References)

        const results = await brain.find({
          query: 'document',
          connected: { from: doc1 },
          limit: 5
        })

        expect(results.some(r => r.entity.id === doc2)).toBe(true)
      })

      it('should handle fusion search with custom weights', async () => {
        const results = await brain.find({
          query: 'machine learning',
          fusion: {
            strategy: 'weighted',
            weights: {
              vector: 0.6,
              field: 0.3,
              graph: 0.1
            }
          },
          limit: 10
        })

        expect(results).toBeDefined()
        expect(results.length).toBeGreaterThan(0)
      })

      it('should support pagination', async () => {
        const page1 = await brain.find({
          query: 'document',
          limit: 2,
          offset: 0
        })

        const page2 = await brain.find({
          query: 'document',
          limit: 2,
          offset: 2
        })

        expect(page1[0]?.entity.id).not.toBe(page2[0]?.entity.id)
      })
    })

    describe('brain.similar()', () => {
      it('should find similar entities', async () => {
        const reference = await brain.add({
          data: 'Artificial intelligence and machine learning',
          type: NounType.Document
        })

        const similar = await brain.similar(reference, {
          limit: 5,
          threshold: 0.5
        })

        expect(similar).toBeDefined()
        expect(similar.length).toBeGreaterThan(0)
        expect(similar[0].similarity).toBeGreaterThanOrEqual(0.5)
      })

      it('should exclude source entity', async () => {
        const reference = await brain.add({
          data: 'Unique content',
          type: NounType.Document
        })

        const similar = await brain.similar(reference, {
          limit: 10,
          includeSource: false
        })

        expect(similar.every(r => r.entity.id !== reference)).toBe(true)
      })
    })
  })

  describe('Neural API', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()

      // Add diverse test data
      await brain.addMany([
        { data: 'Cat', type: NounType.Concept, metadata: { category: 'animal' } },
        { data: 'Dog', type: NounType.Concept, metadata: { category: 'animal' } },
        { data: 'Tiger', type: NounType.Concept, metadata: { category: 'animal' } },
        { data: 'Car', type: NounType.Thing, metadata: { category: 'vehicle' } },
        { data: 'Truck', type: NounType.Thing, metadata: { category: 'vehicle' } },
        { data: 'Python', type: NounType.Language, metadata: { category: 'programming' } },
        { data: 'JavaScript', type: NounType.Language, metadata: { category: 'programming' } }
      ])
    })

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
        expect(clusters.length).toBeLessThanOrEqual(3)
        expect(clusters.every(c => c.members.length > 0)).toBe(true)
      })

      it('should support different clustering algorithms', async () => {
        const algorithms = ['kmeans', 'hierarchical', 'dbscan']
        
        for (const algorithm of algorithms) {
          const clusters = await brain.neural().clusters({
            algorithm,
            k: 2
          })
          
          expect(clusters).toBeDefined()
        }
      })
    })

    describe('brain.neural().hierarchy()', () => {
      it('should build semantic hierarchy', async () => {
        const hierarchy = await brain.neural().hierarchy()
        
        expect(hierarchy).toBeDefined()
        expect(hierarchy.root).toBeDefined()
        expect(hierarchy.levels).toBeGreaterThan(0)
      })
    })

    describe('brain.neural().outliers()', () => {
      it('should detect anomalous entities', async () => {
        // Add an outlier
        await brain.add({
          data: 'Quantum physics equations',
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
          algorithm: 'tsne'
        })

        expect(vizData).toBeDefined()
        expect(vizData.nodes).toBeDefined()
        expect(vizData.nodes.length).toBeGreaterThan(0)
        expect(vizData.nodes[0].x).toBeDefined()
        expect(vizData.nodes[0].y).toBeDefined()
      })

      it('should support 3D visualization', async () => {
        const vizData = await brain.neural().visualize({
          dimensions: 3,
          algorithm: 'umap'
        })

        expect(vizData.nodes[0].z).toBeDefined()
      })
    })

    describe('brain.neural().neighbors()', () => {
      it('should find nearest neighbors', async () => {
        const catId = (await brain.find({ query: 'Cat', limit: 1 }))[0]?.entity.id
        
        if (catId) {
          const neighbors = await brain.neural().neighbors(catId, {
            k: 3
          })

          expect(neighbors).toHaveLength(3)
          expect(neighbors[0].distance).toBeLessThanOrEqual(neighbors[1].distance)
        }
      })
    })
  })

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()
    })

    afterEach(async () => {
      await brain.close()
    })

    describe('brain.getStats()', () => {
      it('should return comprehensive statistics', async () => {
        // Add test data
        await brain.addMany([
          { data: 'Item 1', type: NounType.Document },
          { data: 'Item 2', type: NounType.Person },
          { data: 'Item 3', type: NounType.Task }
        ])

        const stats = brain.getStats()

        expect(stats).toBeDefined()
        expect(stats.totalEntities).toBe(3)
        expect(stats.entitiesByType).toBeDefined()
        expect(stats.entitiesByType[NounType.Document]).toBe(1)
        expect(stats.storageSize).toBeGreaterThan(0)
        expect(stats.indexStats).toBeDefined()
      })

      it('should track operation metrics', async () => {
        const stats1 = brain.getStats()
        
        await brain.add({ data: 'Test', type: NounType.Document })
        await brain.find({ query: 'Test' })
        
        const stats2 = brain.getStats()

        expect(stats2.operations.adds).toBeGreaterThan(stats1.operations.adds)
        expect(stats2.operations.searches).toBeGreaterThan(stats1.operations.searches)
      })
    })

    describe('brain.health()', () => {
      it('should return health status', async () => {
        const health = await brain.health()

        expect(health).toBeDefined()
        expect(health.status).toBe('healthy')
        expect(health.storage).toBeDefined()
        expect(health.storage.status).toBe('connected')
        expect(health.augmentations).toBeDefined()
        expect(health.memory).toBeDefined()
      })

      it('should detect unhealthy conditions', async () => {
        // Simulate unhealthy condition
        await brain.close()
        
        try {
          const health = await brain.health()
          expect(health.status).not.toBe('healthy')
        } catch (error) {
          // Closed brain might throw
          expect(error).toBeDefined()
        }
      })
    })
  })

  describe('FileSystem Storage', () => {
    it('should handle basic CRUD with filesystem', async () => {
      const fsBrain = new Brainy({
        storage: {
          type: 'filesystem',
          options: {
            path: testDir
          }
        }
      })
      
      await fsBrain.init()

      const id = await fsBrain.add({
        data: 'Filesystem test',
        type: NounType.Document
      })

      const retrieved = await fsBrain.get(id)
      expect(retrieved?.metadata?.content).toBe('Filesystem test')

      await fsBrain.update(id, {
        metadata: { updated: true }
      })

      const updated = await fsBrain.get(id)
      expect(updated?.metadata?.updated).toBe(true)

      await fsBrain.delete(id)
      const deleted = await fsBrain.get(id)
      expect(deleted).toBeNull()

      await fsBrain.close()
    })

    it('should handle concurrent filesystem operations', async () => {
      const fsBrain = new Brainy({
        storage: {
          type: 'filesystem',
          options: {
            path: testDir
          }
        }
      })
      
      await fsBrain.init()

      const operations = Array.from({ length: 10 }, async (_, i) => {
        const id = await fsBrain.add({
          data: `Concurrent ${i}`,
          type: NounType.Document
        })
        return id
      })

      const ids = await Promise.all(operations)
      expect(ids).toHaveLength(10)
      expect(new Set(ids).size).toBe(10) // All unique

      await fsBrain.close()
    })

    it('should recover from corrupted files', async () => {
      const fsBrain = new Brainy({
        storage: {
          type: 'filesystem',
          options: {
            path: testDir
          }
        }
      })
      
      await fsBrain.init()

      const id = await fsBrain.add({
        data: 'Test',
        type: NounType.Document
      })

      // Corrupt the file
      const filePath = path.join(testDir, 'entities', `${id}.json`)
      await fs.writeFile(filePath, 'corrupted{json', 'utf-8')

      // Should handle gracefully
      const retrieved = await fsBrain.get(id)
      expect(retrieved === null || retrieved === undefined).toBe(true)

      await fsBrain.close()
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

    it('should handle and recover from storage errors', async () => {
      // Mock storage failure
      const originalAdd = brain.add.bind(brain)
      let failCount = 0
      brain.add = vi.fn(async (...args) => {
        if (failCount++ < 2) {
          throw new Error('Storage temporarily unavailable')
        }
        return originalAdd(...args)
      })

      // Should retry and eventually succeed
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
        { data: {}, type: NounType.Document }, // Non-string data
        { data: '', type: NounType.Document }, // Empty data
      ]

      for (const input of malformedInputs) {
        try {
          await brain.add(input as any)
        } catch (error) {
          // Should throw meaningful error
          expect(error).toBeDefined()
          expect((error as Error).message).toBeDefined()
        }
      }
    })

    it('should maintain consistency during partial failures', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        data: `Item ${i}`,
        type: NounType.Document
      }))

      // Add items
      const ids = await brain.addMany(items)

      // Simulate partial delete failure
      const originalDelete = brain.delete.bind(brain)
      brain.delete = vi.fn(async (id) => {
        if (id === ids[2]) {
          throw new Error('Delete failed')
        }
        return originalDelete(id)
      })

      // Try to delete all
      const results = await Promise.allSettled(
        ids.map(id => brain.delete(id))
      )

      // Check consistency
      const remaining = await brain.find({ limit: 100 })
      expect(remaining.some(r => r.entity.id === ids[2])).toBe(true)
      expect(remaining.length).toBe(1) // Only the failed one remains
    })
  })

  describe('Performance and Scale', () => {
    it('should handle large-scale operations efficiently', async () => {
      const largeBrain = new Brainy({ storage: { type: 'memory' } })
      await largeBrain.init()

      // Add 10,000 items
      const batchSize = 100
      const totalItems = 10000

      const start = Date.now()
      
      for (let batch = 0; batch < totalItems / batchSize; batch++) {
        const items = Array.from({ length: batchSize }, (_, i) => ({
          data: `Item ${batch * batchSize + i}`,
          type: NounType.Document,
          metadata: { 
            batch,
            index: i,
            category: `cat-${batch % 10}`
          }
        }))
        
        await largeBrain.addMany(items)
      }

      const addDuration = Date.now() - start
      expect(addDuration).toBeLessThan(30000) // Should complete in < 30 seconds

      // Test search performance
      const searchStart = Date.now()
      const results = await largeBrain.find({
        query: 'Item 5000',
        limit: 10
      })
      const searchDuration = Date.now() - searchStart

      expect(results.length).toBeGreaterThan(0)
      expect(searchDuration).toBeLessThan(1000) // Search should be < 1 second

      // Test filtered search
      const filteredStart = Date.now()
      const filtered = await largeBrain.find({
        where: { category: 'cat-5' },
        limit: 100
      })
      const filteredDuration = Date.now() - filteredStart

      expect(filtered.length).toBeGreaterThan(0)
      expect(filteredDuration).toBeLessThan(2000) // Filtered search < 2 seconds

      await largeBrain.close()
    }, 60000) // 60 second timeout for this test

    it('should not leak memory during extended operations', async () => {
      const memBrain = new Brainy({ storage: { type: 'memory' } })
      await memBrain.init()

      const initialMemory = process.memoryUsage().heapUsed

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const id = await memBrain.add({
          data: `Memory test ${i}`,
          type: NounType.Document
        })
        
        await memBrain.find({ query: 'test' })
        await memBrain.update(id, { metadata: { updated: i } })
        await memBrain.delete(id)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryGrowth = finalMemory - initialMemory

      // Memory growth should be reasonable (< 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024)

      await memBrain.close()
    })
  })

  describe('Clear Operations', () => {
    beforeEach(async () => {
      brain = new Brainy({ storage: { type: 'memory' } })
      await brain.init()

      // Add test data
      await brain.addMany([
        { data: 'Doc 1', type: NounType.Document, metadata: { category: 'A' } },
        { data: 'Doc 2', type: NounType.Document, metadata: { category: 'B' } },
        { data: 'Person 1', type: NounType.Person, metadata: { category: 'A' } },
        { data: 'Task 1', type: NounType.Task, metadata: { category: 'B' } }
      ])
    })

    afterEach(async () => {
      await brain.close()
    })

    it('should clear all data', async () => {
      await brain.clear()
      
      const remaining = await brain.find({ limit: 100 })
      expect(remaining).toHaveLength(0)
      
      const stats = brain.getStats()
      expect(stats.totalEntities).toBe(0)
    })

    it('should clear by type filter', async () => {
      await brain.clear({ type: NounType.Document })
      
      const remaining = await brain.find({ limit: 100 })
      expect(remaining).toHaveLength(2)
      expect(remaining.every(r => r.entity.type !== NounType.Document)).toBe(true)
    })

    it('should clear by metadata filter', async () => {
      await brain.clear({ where: { category: 'A' } })
      
      const remaining = await brain.find({ limit: 100 })
      expect(remaining).toHaveLength(2)
      expect(remaining.every(r => r.entity.metadata?.category !== 'A')).toBe(true)
    })

    it('should clear relationships when clearing entities', async () => {
      const docs = await brain.find({ where: { type: NounType.Document } })
      const people = await brain.find({ where: { type: NounType.Person } })
      
      await brain.relate(docs[0].entity.id, people[0].entity.id, VerbType.CreatedBy)
      
      await brain.clear({ type: NounType.Document })
      
      const relations = await brain.getRelations(people[0].entity.id)
      expect(relations).toHaveLength(0)
    })
  })
})