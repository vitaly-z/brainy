/**
 * Brainy 3.0 API Tests
 * Comprehensive tests for the new beautiful, consistent API
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy, NounType, VerbType } from '../src/brainy.js'

describe('Brainy 3.0 API', () => {
  let brain: Brainy
  
  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('Entity Operations', () => {
    it('should add entities with beautiful API', async () => {
      const id = await brain.add({
        data: 'Test document about machine learning',
        type: NounType.Document,
        metadata: {
          title: 'ML Guide',
          author: 'Test Author'
        },
        service: 'test-service'
      })

      expect(id).toBeTypeOf('string')
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('should retrieve entities', async () => {
      const id = await brain.add({
        data: 'Sample data',
        type: NounType.Document,
        metadata: { title: 'Sample Title' }
      })

      // v5.11.1: Need includeVectors to check vectors
      const entity = await brain.get(id, { includeVectors: true })

      expect(entity).toBeDefined()
      expect(entity!.id).toBe(id)
      expect(entity!.type).toBe(NounType.Document)
      expect(entity!.metadata.title).toBe('Sample Title')
      expect(entity!.vector).toBeDefined()
      expect(entity!.vector.length).toBeGreaterThan(0)
    })

    it('should update entities', async () => {
      const id = await brain.add({
        data: 'Original data',
        type: NounType.Document,
        metadata: { title: 'Original Title' }
      })

      await brain.update({
        id,
        metadata: { title: 'Updated Title', version: 2 }
      })

      const entity = await brain.get(id)
      expect(entity!.metadata.title).toBe('Updated Title')
      expect(entity!.metadata.version).toBe(2)
    })

    it('should delete entities', async () => {
      const id = await brain.add({
        data: 'To be deleted',
        type: NounType.Document
      })

      await brain.delete(id)
      
      const entity = await brain.get(id)
      expect(entity).toBeNull()
    })
  })

  describe('Relationship Operations', () => {
    it('should create relationships', async () => {
      const doc1 = await brain.add({
        data: 'First document',
        type: NounType.Document
      })

      const doc2 = await brain.add({
        data: 'Second document', 
        type: NounType.Document
      })

      const relationId = await brain.relate({
        from: doc1,
        to: doc2,
        type: VerbType.References,
        weight: 0.8,
        metadata: { context: 'test' }
      })

      expect(relationId).toBeTypeOf('string')
    })

    it('should get relationships', async () => {
      const doc1 = await brain.add({
        data: 'Document one',
        type: NounType.Document
      })

      const doc2 = await brain.add({
        data: 'Document two',
        type: NounType.Document
      })

      await brain.relate({
        from: doc1,
        to: doc2,
        type: VerbType.References
      })

      const relations = await brain.getRelations({ from: doc1 })
      
      expect(relations).toHaveLength(1)
      expect(relations[0].from).toBe(doc1)
      expect(relations[0].to).toBe(doc2)
      expect(relations[0].type).toBe(VerbType.References)
    })

    it('should create bidirectional relationships', async () => {
      const person = await brain.add({
        data: 'John Smith',
        type: NounType.Person
      })

      const org = await brain.add({
        data: 'Tech Corp',
        type: NounType.Organization
      })

      await brain.relate({
        from: person,
        to: org,
        type: VerbType.WorksWith,
        bidirectional: true
      })

      const fromPerson = await brain.getRelations({ from: person })
      const toPerson = await brain.getRelations({ to: person })

      expect(fromPerson).toHaveLength(1)
      expect(toPerson).toHaveLength(1)
    })

    it('should delete relationships', async () => {
      const doc1 = await brain.add({
        data: 'Doc 1',
        type: NounType.Document
      })

      const doc2 = await brain.add({
        data: 'Doc 2', 
        type: NounType.Document
      })

      const relationId = await brain.relate({
        from: doc1,
        to: doc2,
        type: VerbType.References
      })

      await brain.unrelate(relationId)

      const relations = await brain.getRelations({ from: doc1 })
      expect(relations).toHaveLength(0)
    })
  })

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Add test data
      await brain.add({
        data: 'Machine learning is a subset of artificial intelligence',
        type: NounType.Document,
        metadata: { category: 'AI', importance: 5 }
      })

      await brain.add({
        data: 'Neural networks are used in deep learning',
        type: NounType.Document,
        metadata: { category: 'AI', importance: 4 }
      })

      await brain.add({
        data: 'JavaScript is a programming language',
        type: NounType.Document, 
        metadata: { category: 'Programming', importance: 3 }
      })
    })

    it('should find entities by text query', async () => {
      const results = await brain.find({
        query: 'machine learning artificial intelligence',
        limit: 2
      })

      expect(results).toHaveLength(2)
      expect(results[0].score).toBeGreaterThan(0)
      expect(results[0].entity.type).toBe(NounType.Document)
    })

    it('should find similar entities', async () => {
      const aiDocId = await brain.add({
        data: 'Deep learning algorithms',
        type: NounType.Document
      })

      const results = await brain.similar({
        to: aiDocId,
        limit: 2
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].entity.id).not.toBe(aiDocId) // Shouldn't include self
    })

    it('should filter by metadata', async () => {
      const results = await brain.find({
        query: 'learning',
        where: { category: 'AI' },
        limit: 5
      })

      results.forEach(result => {
        expect(result.entity.metadata.category).toBe('AI')
      })
    })

    it('should filter by entity type', async () => {
      await brain.add({
        data: 'John Doe',
        type: NounType.Person
      })

      const results = await brain.find({
        query: 'learning',
        type: NounType.Document
      })

      results.forEach(result => {
        expect(result.entity.type).toBe(NounType.Document)
      })
    })

    it('should support pagination', async () => {
      const page1 = await brain.find({
        query: 'learning',
        limit: 1,
        offset: 0
      })

      const page2 = await brain.find({
        query: 'learning',
        limit: 1,
        offset: 1
      })

      expect(page1).toHaveLength(1)
      expect(page2).toHaveLength(1)
      expect(page1[0].entity.id).not.toBe(page2[0].entity.id)
    })
  })

  describe('Batch Operations', () => {
    it('should add multiple entities', async () => {
      const result = await brain.addMany({
        items: [
          {
            data: 'Document 1',
            type: NounType.Document,
            metadata: { index: 1 }
          },
          {
            data: 'Document 2', 
            type: NounType.Document,
            metadata: { index: 2 }
          },
          {
            data: 'Document 3',
            type: NounType.Document,
            metadata: { index: 3 }
          }
        ]
      })

      expect(result.successful).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(result.total).toBe(3)
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should handle batch errors gracefully', async () => {
      const result = await brain.addMany({
        items: [
          {
            data: 'Valid document',
            type: NounType.Document
          },
          {
            data: null, // Invalid data to trigger error
            type: NounType.Document
          }
        ],
        continueOnError: true
      })

      expect(result.successful).toHaveLength(1)
      expect(result.failed).toHaveLength(1)
    })

    it('should delete multiple entities', async () => {
      // Add test entities
      const ids = await Promise.all([
        brain.add({ data: 'Delete me 1', type: NounType.Document, metadata: { delete: true } }),
        brain.add({ data: 'Delete me 2', type: NounType.Document, metadata: { delete: true } }),
        brain.add({ data: 'Keep me', type: NounType.Document, metadata: { delete: false } })
      ])

      const result = await brain.deleteMany({
        where: { delete: true }
      })

      expect(result.successful).toHaveLength(2)
      expect(result.failed).toHaveLength(0)

      // Verify entities were deleted
      const remaining = await brain.get(ids[2])
      expect(remaining).toBeDefined()
    })
  })

  describe('Type Safety', () => {
    it('should enforce NounType enum', async () => {
      const id = await brain.add({
        data: 'Test',
        type: NounType.Document // Must use enum
      })

      const entity = await brain.get(id)
      expect(entity!.type).toBe(NounType.Document)
    })

    it('should enforce VerbType enum', async () => {
      const doc1 = await brain.add({ data: 'Doc 1', type: NounType.Document })
      const doc2 = await brain.add({ data: 'Doc 2', type: NounType.Document })

      await brain.relate({
        from: doc1,
        to: doc2,
        type: VerbType.References // Must use enum
      })

      const relations = await brain.getRelations({ from: doc1 })
      expect(relations[0].type).toBe(VerbType.References)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing entities gracefully', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const entity = await brain.get(nonExistentId)
      expect(entity).toBeNull()
    })

    it('should require initialization before operations', async () => {
      const uninitializedBrain = new Brainy()
      
      await expect(uninitializedBrain.add({
        data: 'Test',
        type: NounType.Document
      })).rejects.toThrow('not initialized')
    })

    it('should validate required parameters', async () => {
      // @ts-expect-error - Testing validation
      await expect(brain.add({})).rejects.toThrow()
    })
  })

  describe('Configuration', () => {
    it('should support custom configuration', async () => {
      const customBrain = new Brainy({
        storage: { type: 'memory' },
        model: { type: 'fast' },
        cache: true,
        warmup: false
      })

      await customBrain.init()
      
      const id = await customBrain.add({
        data: 'Test with custom config',
        type: NounType.Document
      })

      expect(id).toBeTypeOf('string')
      await customBrain.close()
    })
  })
})

describe('Brainy 3.0 Neural API', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' },
    })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  it('should provide neural API access', () => {
    expect(brain.neural).toBeDefined()
    expect(typeof brain.neural).toBe('object')
  })

})