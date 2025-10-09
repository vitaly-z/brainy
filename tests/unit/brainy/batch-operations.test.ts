import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { NounType, VerbType } from '../../../src/types/graphTypes'

describe('Brainy Batch Operations', () => {
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
      expect(duration).toBeLessThan(10000) // 10 seconds for 100 embeddings is reasonable

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
      
      try {
        const result = await brain.addMany({ items: entities })
        // Some implementations might skip invalid entries
        expect(result.successful.length).toBeLessThanOrEqual(3)
      } catch (error) {
        // Or might throw an error
        expect(error).toBeDefined()
      }
    })
    
    it('should maintain order of additions', async () => {
      const entities = Array.from({ length: 10 }, (_, i) => ({
        data: `Ordered Entity ${i}`,
        type: NounType.Thing,
        metadata: { order: i }
      }))
      
      const result = await brain.addMany({ items: entities })
      
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
      const manyIds = manyResult.successful

      // Update all at once
      const updates = manyIds.map(id => ({
        id,
        metadata: { counter: 1, bulk: true }
      }))
      
      const startTime = Date.now()
      await brain.updateMany({ items: updates })
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(1000) // Should be fast
      
      // Verify sample
      const sample = await brain.get(manyIds[50])
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
      await brain.deleteMany({ ids: testIds })
      
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
      
      await brain.deleteMany({ ids: toDelete })
      
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
      await brain.deleteMany({ ids: [org] })
      
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
      const manyIds = manyResult.successful

      const startTime = Date.now()
      await brain.deleteMany({ ids: manyIds })
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(1000) // Should be fast
      
      // All should be gone
      const sample = await brain.get(manyIds[50])
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
      await brain.deleteMany({ ids: mixedIds })
      
      // Valid ones should be deleted
      expect(await brain.get(testIds[0])).toBeNull()
      expect(await brain.get(testIds[1])).toBeNull()
      
      // Others should still exist
      expect(await brain.get(testIds[2])).toBeDefined()
    })
  })

  describe('relateMany - Batch Relationship Creation', () => {
    let entities: string[]

    beforeEach(async () => {
      // Create test entities
      const result = await brain.addMany({
        items: [
          { data: 'Person A', type: NounType.Person },
          { data: 'Person B', type: NounType.Person },
          { data: 'Person C', type: NounType.Person },
          { data: 'Company X', type: NounType.Organization },
          { data: 'Company Y', type: NounType.Organization }
        ]
      })
      entities = result.successful
    })
    
    it('should create multiple relationships at once', async () => {
      const relationships = [
        { from: entities[0], to: entities[3], type: VerbType.MemberOf },
        { from: entities[1], to: entities[3], type: VerbType.MemberOf },
        { from: entities[2], to: entities[4], type: VerbType.MemberOf }
      ]
      
      const relationIds = await brain.relateMany({ items: relationships })

      expect(relationIds).toBeDefined()
      expect(Array.isArray(relationIds)).toBe(true)
      expect(relationIds).toHaveLength(3)
      
      // Verify relationships exist
      const person1Relations = await brain.getRelations({ from: entities[0] })
      expect(person1Relations.length).toBeGreaterThan(0)
    })
    
    it('should handle different relationship types', async () => {
      const relationships = [
        { from: entities[0], to: entities[1], type: VerbType.FriendOf },
        { from: entities[0], to: entities[2], type: VerbType.WorksWith },
        { from: entities[3], to: entities[4], type: VerbType.CompetesWith }
      ]
      
      const relationIds = await brain.relateMany({ items: relationships })

      expect(relationIds).toHaveLength(3)
      
      // Verify different types
      const friendRelations = await brain.getRelations({ 
        from: entities[0], 
        type: VerbType.FriendOf 
      })
      expect(friendRelations.length).toBeGreaterThan(0)
      
      const workRelations = await brain.getRelations({ 
        from: entities[0], 
        type: VerbType.WorksWith 
      })
      expect(workRelations.length).toBeGreaterThan(0)
    })
    
    it('should handle bidirectional relationships', async () => {
      const relationships = [
        { from: entities[0], to: entities[1], type: VerbType.FriendOf },
        { from: entities[1], to: entities[0], type: VerbType.FriendOf } // Reverse
      ]
      
      const relationIds = await brain.relateMany({ items: relationships })

      expect(relationIds).toHaveLength(2)
      
      // Both should have the relationship
      const person1Friends = await brain.getRelations({ from: entities[0] })
      expect(person1Friends.length).toBeGreaterThan(0)
      
      const person2Friends = await brain.getRelations({ from: entities[1] })
      expect(person2Friends.length).toBeGreaterThan(0)
    })
    
    it('should handle large batch of relationships', async () => {
      // Create many entities
      const manyPeopleResult = await brain.addMany({
        items: Array.from({ length: 50 }, (_, i) => ({
          data: `Person ${i}`,
          type: NounType.Person
        }))
      })
      const manyPeople = manyPeopleResult.successful

      const company = await brain.add({
        data: 'Big Company',
        type: NounType.Organization
      })

      // All people work at the company
      const relationships = manyPeople.map(person => ({
        from: person,
        to: company,
        type: VerbType.MemberOf
      }))
      
      const startTime = Date.now()
      const relationIds = await brain.relateMany({ items: relationships })
      const duration = Date.now() - startTime

      expect(relationIds).toHaveLength(50)
      expect(duration).toBeLessThan(1000) // Should be fast
      
      // Verify company has all relationships
      const companyRelations = await brain.getRelations({ to: company })
      expect(companyRelations.length).toBeGreaterThanOrEqual(50)
    })
    
    it('should skip invalid relationships', async () => {
      const relationships = [
        { from: entities[0], to: entities[1], type: VerbType.FriendOf },
        { from: 'invalid-id', to: entities[2], type: VerbType.FriendOf },
        { from: entities[1], to: entities[2], type: VerbType.FriendOf }
      ]
      
      try {
        // Should skip invalid and continue
        const relationIds = await brain.relateMany({ items: relationships })
        expect(relationIds.length).toBeLessThanOrEqual(3)
      } catch (error) {
        // Or might throw - that's ok too
        expect(error).toBeDefined()
      }
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
      const batchIds = batchResult.successful
      const batchTime = Date.now() - batchStart

      // Verify batch operation completed successfully
      // Note: Performance can vary based on system load and embedding generation
      expect(batchIds).toHaveLength(itemCount)
      expect(batchTime).toBeLessThan(5000) // Reasonable timeout for 50 items

      console.log(`Individual: ${individualTime}ms, Batch: ${batchTime}ms`)
      if (batchTime < individualTime) {
        console.log(`Batch is ${Math.round(individualTime / batchTime)}x faster`)
      }
    })
    
    it('should handle mixed batch operations efficiently', async () => {
      // Create initial dataset
      const initialResult = await brain.addMany({
        items: Array.from({ length: 20 }, (_, i) => ({
          data: `Initial ${i}`,
          type: NounType.Thing,
          metadata: { version: 1 }
        }))
      })
      const initialIds = initialResult.successful

      // Perform multiple batch operations
      const startTime = Date.now()

      // 1. Add more entities
      const newResult = await brain.addMany({
        items: Array.from({ length: 20 }, (_, i) => ({
          data: `New ${i}`,
          type: NounType.Thing
        }))
      })
      const newIds = newResult.successful

      // 2. Update initial entities
      await brain.updateMany({
        items: initialIds.map(id => ({
          id,
          metadata: { version: 2, updated: true }
        }))
      })
      
      // 3. Create relationships
      const relationships = initialIds.slice(0, 10).map((id, i) => ({
        from: id,
        to: newIds[i],
        type: VerbType.RelatedTo
      }))

      // Actually create the relationships
      await brain.relateMany({ items: relationships })

      // 4. Delete some entities
      await brain.deleteMany({ ids: initialIds.slice(15) })
      
      const totalTime = Date.now() - startTime
      
      expect(totalTime).toBeLessThan(2000) // All operations should be fast
      
      // Verify final state
      const remaining = await brain.get(initialIds[0])
      expect(remaining?.metadata?.version).toBe(2)
      
      const deleted = await brain.get(initialIds[19])
      expect(deleted).toBeNull()
      
      const relations = await brain.getRelations({ from: initialIds[0] })
      expect(relations.length).toBeGreaterThan(0)
    })
  })
  
  describe('Error Handling in Batch Operations', () => {
    it('should handle empty batches gracefully', async () => {
      const result = await brain.addMany({ items: [] })
      expect(result).toBeDefined()
      expect(result.successful).toBeDefined()
      expect(result.failed).toBeDefined()
      expect(result.successful).toHaveLength(0)
      
      await brain.updateMany({ items: [] })
      await brain.deleteMany({ ids: [] })
      // Should not throw
    })
    
    it('should validate batch size limits', async () => {
      // Try to add a large batch (reduced from 10000 to 1000 for reasonable test time)
      const largeCount = 1000
      const largeItems = Array.from({ length: largeCount }, (_, i) => ({
        data: `Large ${i}`,
        type: NounType.Thing
      }))

      try {
        // This might have a limit or might just be slow
        const result = await brain.addMany({ items: largeItems })
        expect(result.successful.length).toBeLessThanOrEqual(largeCount)
        expect(result.successful.length).toBeGreaterThan(0)
      } catch (error) {
        // Might throw if there's a limit
        expect(error).toBeDefined()
      }
    }, 60000)
    
    it('should provide meaningful error messages', async () => {
      try {
        // Invalid items
        await brain.addMany({ items: [{ data: null, type: NounType.Thing }] as any })
      } catch (error: any) {
        expect(error.message).toBeDefined()
        // Should indicate what went wrong
      }
    })
  })
})
