import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { NounType, VerbType } from '../../../src/types/graphTypes'

describe.skip('Brainy Batch Operations - Fixed', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })
  
  describe('addMany - Batch Entity Creation', () => {
    it('should add multiple entities at once', async () => {
      const entities = [
        { data: 'Entity 1', type: NounType.Thing, metadata: { index: 1 } },
        { data: 'Entity 2', type: NounType.Thing, metadata: { index: 2 } },
        { data: 'Entity 3', type: NounType.Thing, metadata: { index: 3 } }
      ]
      
      const result = await brain.addMany({ items: entities })
      
      expect(result).toBeDefined()
      expect(result.successful).toBeDefined()
      expect(result.failed).toBeDefined()
      expect(result.successful).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(result.total).toBe(3)
      
      // Verify all were added
      for (const id of result.successful) {
        const entity = await brain.get(id)
        expect(entity).toBeDefined()
      }
    })
    
    it('should handle large batches efficiently', async () => {
      const batchSize = 100
      const entities = Array.from({ length: batchSize }, (_, i) => ({
        data: `Entity ${i}`,
        type: NounType.Thing,
        metadata: { index: i, batch: true }
      }))
      
      const startTime = Date.now()
      const result = await brain.addMany({ items: entities })
      const duration = Date.now() - startTime
      
      expect(result.successful).toHaveLength(batchSize)
      expect(result.failed).toHaveLength(0)
      expect(duration).toBeLessThan(1000) // Should be fast
      
      // Verify a sample
      const sampleEntity = await brain.get(result.successful[50])
      expect(sampleEntity?.metadata?.index).toBe(50)
    })
    
    it('should handle mixed entity types', async () => {
      const entities = [
        { data: 'John Doe', type: NounType.Person, metadata: { role: 'developer' } },
        { data: 'TechCorp', type: NounType.Organization, metadata: { industry: 'tech' } },
        { data: 'San Francisco', type: NounType.Location, metadata: { country: 'USA' } },
        { data: 'Project Alpha', type: NounType.Project, metadata: { status: 'active' } }
      ]
      
      const result = await brain.addMany({ items: entities })
      
      expect(result.successful).toHaveLength(4)
      expect(result.failed).toHaveLength(0)
      
      // Verify different types were added correctly
      const person = await brain.get(result.successful[0])
      expect(person?.type).toBe(NounType.Person)
      
      const org = await brain.get(result.successful[1])
      expect(org?.type).toBe(NounType.Organization)
    })
    
    it('should handle partial failures gracefully', async () => {
      const entities = [
        { data: 'Valid Entity 1', type: NounType.Thing },
        { data: '', type: NounType.Thing }, // Invalid - empty data
        { data: 'Valid Entity 2', type: NounType.Thing }
      ]
      
      const result = await brain.addMany({ items: entities })
      
      // Should handle invalid entries
      expect(result.successful.length).toBeGreaterThan(0)
      expect(result.successful.length).toBeLessThanOrEqual(3)
      // May have failures
      expect(result.failed.length).toBeGreaterThanOrEqual(0)
    })
    
    it('should maintain order of additions', async () => {
      const entities = Array.from({ length: 10 }, (_, i) => ({
        data: `Ordered Entity ${i}`,
        type: NounType.Thing,
        metadata: { order: i }
      }))
      
      const result = await brain.addMany({ items: entities })
      
      expect(result.successful).toHaveLength(10)
      
      // Verify order is maintained
      for (let i = 0; i < result.successful.length; i++) {
        const entity = await brain.get(result.successful[i])
        expect(entity?.metadata?.order).toBe(i)
      }
    })
    
    it('should generate embeddings for all entities', async () => {
      const entities = [
        { data: 'Machine learning is fascinating', type: NounType.Concept },
        { data: 'Artificial intelligence changes everything', type: NounType.Concept },
        { data: 'Neural networks mimic the brain', type: NounType.Concept }
      ]
      
      const result = await brain.addMany({ items: entities })
      
      expect(result.successful).toHaveLength(3)
      
      // All should have vectors
      for (const id of result.successful) {
        const entity = await brain.get(id)
        expect(entity?.vector).toBeDefined()
        expect(entity?.vector?.length).toBeGreaterThan(0)
      }
    })
  })
  
  describe('updateMany - Batch Updates', () => {
    let testIds: string[]
    
    beforeEach(async () => {
      // Create test entities to update
      const result = await brain.addMany({
        items: [
          { data: 'Update Test 1', type: NounType.Thing, metadata: { version: 1 } },
          { data: 'Update Test 2', type: NounType.Thing, metadata: { version: 1 } },
          { data: 'Update Test 3', type: NounType.Thing, metadata: { version: 1 } }
        ]
      })
      testIds = result.successful
    })
    
    it('should update multiple entities at once', async () => {
      const updates = testIds.map(id => ({
        id,
        metadata: { version: 2, updated: true }
      }))
      
      await brain.updateMany({ items: updates })
      
      // Verify all were updated
      for (const id of testIds) {
        const entity = await brain.get(id)
        expect(entity?.metadata?.version).toBe(2)
        expect(entity?.metadata?.updated).toBe(true)
      }
    })
    
    it('should handle selective field updates', async () => {
      const updates = [
        { id: testIds[0], data: 'New Data 1' },
        { id: testIds[1], metadata: { newField: 'value' } },
        { id: testIds[2], data: 'New Data 3', metadata: { version: 3 } }
      ]
      
      await brain.updateMany({ items: updates })
      
      // Check selective updates
      const entity1 = await brain.get(testIds[0])
      expect(entity1?.data).toBe('New Data 1')
      expect(entity1?.metadata?.version).toBe(1) // Unchanged
      
      const entity2 = await brain.get(testIds[1])
      expect(entity2?.data).toBe('Update Test 2') // Unchanged
      expect(entity2?.metadata?.newField).toBe('value')
      
      const entity3 = await brain.get(testIds[2])
      expect(entity3?.data).toBe('New Data 3')
      expect(entity3?.metadata?.version).toBe(3)
    })
    
    it('should handle merge vs replace updates', async () => {
      const updates = [
        { id: testIds[0], metadata: { newField: 'added' }, merge: true },
        { id: testIds[1], metadata: { replaced: 'completely' }, merge: false }
      ]
      
      await brain.updateMany({ items: updates })
      
      // Merged update should preserve existing fields
      const merged = await brain.get(testIds[0])
      expect(merged?.metadata?.version).toBe(1) // Original preserved
      expect(merged?.metadata?.newField).toBe('added') // New added
      
      // Replaced update should remove existing fields
      const replaced = await brain.get(testIds[1])
      expect(replaced?.metadata?.version).toBeUndefined() // Original gone
      expect(replaced?.metadata?.replaced).toBe('completely')
    })
    
    it('should handle large batch updates efficiently', async () => {
      // Create many entities
      const manyResult = await brain.addMany({
        items: Array.from({ length: 100 }, (_, i) => ({
          data: `Bulk ${i}`,
          type: NounType.Thing,
          metadata: { counter: 0 }
        }))
      })
      
      // Update all at once
      const updates = manyResult.successful.map(id => ({
        id,
        metadata: { counter: 1, bulk: true }
      }))
      
      const startTime = Date.now()
      await brain.updateMany({ items: updates })
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(1000) // Should be fast
      
      // Verify sample
      const sample = await brain.get(manyResult.successful[50])
      expect(sample?.metadata?.counter).toBe(1)
      expect(sample?.metadata?.bulk).toBe(true)
    })
    
    it('should skip non-existent IDs', async () => {
      const updates = [
        { id: testIds[0], metadata: { valid: true } },
        { id: 'non-existent-id', metadata: { invalid: true } },
        { id: testIds[1], metadata: { valid: true } }
      ]
      
      // Should not throw, just skip invalid
      await brain.updateMany({ items: updates })
      
      // Valid ones should be updated
      const entity1 = await brain.get(testIds[0])
      expect(entity1?.metadata?.valid).toBe(true)
      
      const entity2 = await brain.get(testIds[1])
      expect(entity2?.metadata?.valid).toBe(true)
    })
  })
  
  describe('deleteMany - Batch Deletion', () => {
    let testIds: string[]
    
    beforeEach(async () => {
      // Create test entities to delete
      const result = await brain.addMany({
        items: Array.from({ length: 5 }, (_, i) => ({
          data: `Delete Test ${i}`,
          type: NounType.Thing,
          metadata: { deleteMe: true }
        }))
      })
      testIds = result.successful
    })
    
    it('should delete multiple entities at once', async () => {
      const result = await brain.deleteMany({ ids: testIds })
      
      expect(result.successful).toHaveLength(testIds.length)
      expect(result.failed).toHaveLength(0)
      
      // All should be gone
      for (const id of testIds) {
        const entity = await brain.get(id)
        expect(entity).toBeNull()
      }
    })
    
    it('should handle selective deletion', async () => {
      // Delete only some
      const toDelete = [testIds[0], testIds[2], testIds[4]]
      const toKeep = [testIds[1], testIds[3]]
      
      const result = await brain.deleteMany({ ids: toDelete })
      
      expect(result.successful).toHaveLength(3)
      
      // Deleted ones should be gone
      for (const id of toDelete) {
        const entity = await brain.get(id)
        expect(entity).toBeNull()
      }
      
      // Others should remain
      for (const id of toKeep) {
        const entity = await brain.get(id)
        expect(entity).toBeDefined()
        expect(entity?.metadata?.deleteMe).toBe(true)
      }
    })
    
    it('should handle deletion with relationships', async () => {
      // Create entities with relationships
      const person1 = await brain.add({ data: 'Person 1', type: NounType.Person })
      const person2 = await brain.add({ data: 'Person 2', type: NounType.Person })
      const org = await brain.add({ data: 'Org', type: NounType.Organization })
      
      // Create relationships
      await brain.relate({ from: person1, to: org, type: VerbType.MemberOf as any })
      await brain.relate({ from: person2, to: org, type: VerbType.MemberOf as any })
      
      // Delete the organization
      const result = await brain.deleteMany({ ids: [org] })
      
      expect(result.successful).toHaveLength(1)
      
      // Organization should be gone
      const deletedOrg = await brain.get(org)
      expect(deletedOrg).toBeNull()
      
      // People should still exist
      const p1 = await brain.get(person1)
      expect(p1).toBeDefined()
      
      const p2 = await brain.get(person2)
      expect(p2).toBeDefined()
    })
    
    it('should handle large batch deletions efficiently', async () => {
      // Create many entities
      const manyResult = await brain.addMany({
        items: Array.from({ length: 100 }, (_, i) => ({
          data: `Bulk Delete ${i}`,
          type: NounType.Thing
        }))
      })
      
      const startTime = Date.now()
      const deleteResult = await brain.deleteMany({ ids: manyResult.successful })
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(1000) // Should be fast
      expect(deleteResult.successful).toHaveLength(100)
      
      // All should be gone
      const sample = await brain.get(manyResult.successful[50])
      expect(sample).toBeNull()
    })
    
    it('should ignore non-existent IDs', async () => {
      const mixedIds = [
        testIds[0],
        'non-existent-1',
        testIds[1],
        'non-existent-2'
      ]
      
      // Should not throw
      const result = await brain.deleteMany({ ids: mixedIds })
      
      // Should delete the valid ones
      expect(result.successful.length).toBeGreaterThanOrEqual(2)
      
      // Valid ones should be deleted
      expect(await brain.get(testIds[0])).toBeNull()
      expect(await brain.get(testIds[1])).toBeNull()
      
      // Others should still exist
      expect(await brain.get(testIds[2])).toBeDefined()
    })
  })
  
  
  describe('Batch Operations Performance', () => {
    it('should perform better than individual operations', async () => {
      const itemCount = 50
      const items = Array.from({ length: itemCount }, (_, i) => ({
        data: `Performance Test ${i}`,
        type: NounType.Thing,
        metadata: { index: i }
      }))
      
      // Time individual additions
      const individualStart = Date.now()
      const individualIds = []
      for (const item of items) {
        const id = await brain.add(item)
        individualIds.push(id)
      }
      const individualTime = Date.now() - individualStart
      
      // Clear and reset
      await brain.clear()
      
      // Time batch addition
      const batchStart = Date.now()
      const batchResult = await brain.addMany({ items })
      const batchTime = Date.now() - batchStart
      
      // Batch should be significantly faster
      expect(batchTime).toBeLessThan(individualTime)
      expect(batchResult.successful).toHaveLength(itemCount)
      
      console.log(`Individual: ${individualTime}ms, Batch: ${batchTime}ms`)
      console.log(`Batch is ${Math.round(individualTime / batchTime)}x faster`)
    })
  })
  
  describe('Error Handling in Batch Operations', () => {
    it('should handle empty batches gracefully', async () => {
      const addResult = await brain.addMany({ items: [] })
      expect(addResult).toBeDefined()
      expect(addResult.successful).toHaveLength(0)
      expect(addResult.failed).toHaveLength(0)
      
      await brain.updateMany({ items: [] })
      
      const deleteResult = await brain.deleteMany({ ids: [] })
      expect(deleteResult.successful).toHaveLength(0)
      
      // relateMany not implemented yet
    })
  })
})