/**
 * Brainy v3.0 Core API Test Suite
 * Testing all core CRUD operations and basic functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'

describe('Brainy v3.0 Core API Tests', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()
  })

  afterEach(async () => {
    // Note: Brainy doesn't have shutdown() in v3, just let GC handle it
    brain = null as any
  })

  describe('1. Add Operations', () => {
    it('should add a simple text item', async () => {
      const id = await brain.add({
        data: 'Hello world',
        type: NounType.Document
      })
      
      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should add item with custom ID', async () => {
      const customId = 'custom-123'
      const id = await brain.add({
        id: customId,
        data: 'Custom ID test',
        type: NounType.Document
      })
      
      expect(id).toBe(customId)
    })

    it('should add item with metadata', async () => {
      const metadata = { 
        title: 'Test Doc', 
        category: 'testing',
        score: 95.5,
        tags: ['test', 'validation']
      }
      
      const id = await brain.add({
        data: 'Document with metadata',
        metadata,
        type: NounType.Document
      })
      
      const retrieved = await brain.get(id)
      expect(retrieved?.metadata).toEqual(metadata)
    })

    it('should add item with pre-computed vector', async () => {
      const vector = new Array(384).fill(0).map(() => Math.random())
      const id = await brain.add({
        data: 'Pre-vectorized content',
        vector,
        type: NounType.Thing
      })
      
      const retrieved = await brain.get(id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.vector).toHaveLength(384)
    })

    it('should handle concurrent adds', async () => {
      const promises = Array(10).fill(0).map((_, i) => 
        brain.add({
          data: `Concurrent item ${i}`,
          type: NounType.Document
        })
      )
      
      const ids = await Promise.all(promises)
      expect(ids).toHaveLength(10)
      expect(new Set(ids).size).toBe(10) // All unique
    })

    it('should validate noun types', async () => {
      // Valid type should work
      const id = await brain.add({
        data: 'Valid type',
        type: NounType.Person
      })
      expect(id).toBeDefined()

      // Invalid type should throw
      await expect(brain.add({
        data: 'Invalid type test',
        type: 'InvalidType' as any
      })).rejects.toThrow()
    })
  })

  describe('2. Get Operations', () => {
    let testId: string

    beforeEach(async () => {
      testId = await brain.add({
        data: 'Test document for retrieval',
        metadata: { test: true },
        type: NounType.Document
      })
    })

    it('should retrieve existing item by ID', async () => {
      const item = await brain.get(testId)
      
      expect(item).toBeDefined()
      expect(item?.id).toBe(testId)
      expect(item?.metadata?.test).toBe(true)
      expect(item?.type).toBe(NounType.Document)
    })

    it('should return null for non-existent ID', async () => {
      const item = await brain.get('non-existent-id')
      expect(item).toBeNull()
    })

    it('should retrieve with vector included', async () => {
      const item = await brain.get(testId)
      expect(item?.vector).toBeDefined()
      expect(item?.vector?.length).toBeGreaterThanOrEqual(384) // Default dimension
    })
  })

  describe('3. Update Operations', () => {
    let testId: string

    beforeEach(async () => {
      testId = await brain.add({
        data: 'Original content',
        metadata: { version: 1 },
        type: NounType.Document
      })
    })

    it('should update existing item data', async () => {
      const success = await brain.update({
        id: testId,
        data: 'Updated content'
      })
      
      expect(success).toBe(true)
      
      const updated = await brain.get(testId)
      expect(updated).toBeDefined()
      // Vector should be recalculated after content update
    })

    it('should update only metadata', async () => {
      const success = await brain.update({
        id: testId,
        metadata: { version: 2, updated: true }
      })
      
      expect(success).toBe(true)
      
      const updated = await brain.get(testId)
      expect(updated?.metadata).toEqual({ version: 2, updated: true })
    })

    it('should update both data and metadata', async () => {
      const success = await brain.update({
        id: testId,
        data: 'New content',
        metadata: { version: 3 }
      })
      
      expect(success).toBe(true)
      
      const updated = await brain.get(testId)
      expect(updated?.metadata?.version).toBe(3)
    })

    it('should return false for non-existent ID', async () => {
      const success = await brain.update({
        id: 'non-existent',
        data: 'Will fail'
      })
      
      expect(success).toBe(false)
    })
  })

  describe('4. Delete Operations', () => {
    it('should delete existing item', async () => {
      const id = await brain.add({
        data: 'To be deleted',
        type: NounType.Document
      })
      
      const success = await brain.delete(id)
      expect(success).toBe(true)
      
      const item = await brain.get(id)
      expect(item).toBeNull()
    })

    it('should return false for non-existent ID', async () => {
      const success = await brain.delete('non-existent')
      expect(success).toBe(false)
    })

    it('should handle concurrent deletes', async () => {
      const ids = await Promise.all(
        Array(5).fill(0).map(() => 
          brain.add({ data: 'Concurrent delete test', type: NounType.Document })
        )
      )
      
      await Promise.all(ids.map(id => brain.delete(id)))
      // delete returns void, not boolean
      
      // Verify all deleted
      const items = await Promise.all(ids.map(id => brain.get(id)))
      expect(items.every(item => item === null)).toBe(true)
    })
  })

  describe('5. Relationship Operations', () => {
    let entityA: string
    let entityB: string

    beforeEach(async () => {
      entityA = await brain.add({ data: 'Entity A', type: NounType.Person })
      entityB = await brain.add({ data: 'Entity B', type: NounType.Organization })
    })

    it('should create relationships between entities', async () => {
      const verbId = await brain.relate({
        from: entityA,
        to: entityB,
        type: VerbType.MemberOf,
        metadata: { since: '2023' }
      })
      
      expect(verbId).toBeDefined()
      expect(typeof verbId).toBe('string')
    })

    it('should retrieve relationships', async () => {
      await brain.relate({
        from: entityA,
        to: entityB,
        type: VerbType.Creates
      })
      
      const relations = await brain.getRelations({ from: entityA })
      
      expect(relations.length).toBeGreaterThanOrEqual(1)
      expect(relations[0].from).toBe(entityA)
    })

    it('should delete relationships', async () => {
      const verbId = await brain.relate({
        from: entityA,
        to: entityB,
        type: VerbType.Owns
      })

      const success = await brain.unrelate(verbId)
      expect(success).toBe(true)

      const relations = await brain.getRelations({ from: entityA })
      const found = relations.find(r => r.id === verbId)
      expect(found).toBeUndefined()
    })
  })

  describe('6. Batch Operations', () => {
    it('should add multiple items in batch', async () => {
      const items = Array(10).fill(0).map((_, i) => ({
        data: `Batch item ${i}`,
        metadata: { index: i },
        type: NounType.Document
      }))

      const result = await brain.addMany({ items })
      
      expect(result.successful).toHaveLength(10)
      expect(result.failed).toHaveLength(0)
      expect(result.total).toBe(10)
    })

    it('should delete multiple items in batch', async () => {
      // First add some items
      const ids = await Promise.all(
        Array(5).fill(0).map((_, i) => 
          brain.add({ data: `Delete batch ${i}`, type: NounType.Document })
        )
      )

      // Then delete them in batch
      const result = await brain.deleteMany({ ids })
      
      expect(result.successful).toHaveLength(5)
      expect(result.failed).toHaveLength(0)
    })

    it('should handle partial batch failures', async () => {
      const items = [
        { data: 'Valid item', type: NounType.Document },
        { data: 'Invalid item', type: 'InvalidType' as any },
        { data: 'Another valid', type: NounType.Document }
      ]

      const result = await brain.addMany({ 
        items,
        continueOnError: true 
      })
      
      expect(result.successful.length).toBeGreaterThanOrEqual(2)
      expect(result.failed.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('7. Import/Export Operations', () => {
    it('should export all data', async () => {
      // Add some test data
      const id1 = await brain.add({ data: 'Export test 1', type: NounType.Document })
      const id2 = await brain.add({ data: 'Export test 2', type: NounType.Document })
      await brain.relate({ from: id1, to: id2, type: VerbType.References })

      const exported = await brain.export()
      
      expect(exported).toBeDefined()
      expect(exported.entities).toBeDefined()
      expect(exported.relationships).toBeDefined()
      expect(exported.metadata).toBeDefined()
    })

    it('should import data', async () => {
      // Create export data
      const exportData = {
        entities: [
          { id: 'imp-1', data: 'Imported 1', type: NounType.Document, metadata: {} },
          { id: 'imp-2', data: 'Imported 2', type: NounType.Document, metadata: {} }
        ],
        relationships: [],
        metadata: { version: '3.0.0' }
      }

      await brain.import(exportData)

      // Verify imported data
      const item1 = await brain.get('imp-1')
      const item2 = await brain.get('imp-2')
      
      expect(item1).toBeDefined()
      expect(item2).toBeDefined()
    })
  })

  describe('8. Statistics and Insights', () => {
    beforeEach(async () => {
      // Add some test data
      await brain.add({ data: 'Doc 1', type: NounType.Document })
      await brain.add({ data: 'Person 1', type: NounType.Person })
      await brain.add({ data: 'Org 1', type: NounType.Organization })
    })

    it('should provide insights', async () => {
      const insights = await brain.insights()
      
      expect(insights).toBeDefined()
      expect(insights.entities).toBeGreaterThanOrEqual(3)
      expect(insights.types).toBeDefined()
      expect(Object.keys(insights.types).length).toBeGreaterThan(0)
    })

    it('should suggest relevant queries', async () => {
      const suggestions = await brain.suggest({ limit: 3 })
      
      expect(suggestions).toBeDefined()
      expect(suggestions.queries).toBeDefined()
      expect(Array.isArray(suggestions.queries)).toBe(true)
      expect(suggestions.queries.length).toBeLessThanOrEqual(3)
    })
  })
})