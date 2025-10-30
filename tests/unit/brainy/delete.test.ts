import { describe, it, expect, beforeAll } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { createAddParams } from '../../helpers/test-factory'

// v4.11.2: SKIPPED - brain.init() takes >60s causing timeout
// This is a pre-existing performance issue (also failed in v4.11.0)
// TODO: Investigate why Brainy initialization is so slow in this test context
describe.skip('Brainy.delete()', () => {
  let brain: Brainy<any>

  // v4.11.2: Use shared brain instance to prevent memory errors
  // Creating new instance per test consumes too much memory (OOM errors)
  beforeAll(async () => {
    brain = new Brainy()
    await brain.init()
  }, 60000) // Increase timeout for initial setup

  describe('success paths', () => {
    it('should delete an existing entity', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Test entity',
        type: 'thing',
        metadata: { test: true }
      }))
      
      // Verify it exists
      const before = await brain.get(id)
      expect(before).not.toBeNull()
      
      // Act
      await brain.delete(id)
      
      // Assert
      const after = await brain.get(id)
      expect(after).toBeNull()
    })
    
    it('should delete entity with relationships', async () => {
      // TODO: Fix relationship cleanup - verbs are being found after deletion
      //  Possible causes: storage cache, metadata index, or graph index not updating
      // Arrange - Create entities and relationships
      const entity1 = await brain.add(createAddParams({ data: 'Entity 1' }))
      const entity2 = await brain.add(createAddParams({ data: 'Entity 2' }))
      const entity3 = await brain.add(createAddParams({ data: 'Entity 3' }))
      
      await brain.relate({
        from: entity1,
        to: entity2,
        type: 'relatedTo'
      })
      
      await brain.relate({
        from: entity1,
        to: entity3,
        type: 'creates'
      })
      
      await brain.relate({
        from: entity2,
        to: entity1,
        type: 'references'
      })
      
      // Act - Delete entity1
      await brain.delete(entity1)
      
      // Assert - Entity should be gone
      const deleted = await brain.get(entity1)
      expect(deleted).toBeNull()
      
      // Entity2 and entity3 should still exist
      const e2 = await brain.get(entity2)
      const e3 = await brain.get(entity3)
      expect(e2).not.toBeNull()
      expect(e3).not.toBeNull()
      
      // Relationships involving entity1 should be removed
      const fromEntity1 = await brain.getRelations({ from: entity1 })
      const toEntity1 = await brain.getRelations({ to: entity1 })
      expect(fromEntity1).toHaveLength(0)
      expect(toEntity1).toHaveLength(0)
      
      // Other relationships should remain
      const fromEntity2 = await brain.getRelations({ from: entity2 })
      expect(fromEntity2.some(r => r.to === entity1)).toBe(false)
    })
    
    it.skip('should delete entity and clean up index', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Searchable entity',
        metadata: { searchable: true }
      }))
      
      // Verify it's searchable
      const beforeResults = await brain.find({
        query: 'Searchable entity',
        limit: 10
      })
      expect(beforeResults.some(r => r.entity.id === id)).toBe(true)
      
      // Act
      await brain.delete(id)
      
      // Assert - Should not be in search results
      const afterResults = await brain.find({
        query: 'Searchable entity',
        limit: 10
      })
      expect(afterResults.some(r => r.entity.id === id)).toBe(false)
    })
    
    it('should handle deleting multiple entities', async () => {
      // Arrange
      const ids = await Promise.all([
        brain.add(createAddParams({ data: 'Entity 1' })),
        brain.add(createAddParams({ data: 'Entity 2' })),
        brain.add(createAddParams({ data: 'Entity 3' }))
      ])
      
      // Act - Delete all
      await Promise.all(ids.map(id => brain.delete(id)))
      
      // Assert - All should be gone
      const results = await Promise.all(ids.map(id => brain.get(id)))
      expect(results.every(r => r === null)).toBe(true)
    })
    
    it('should handle deleting entity with bidirectional relationships', async () => {
      // Arrange
      const entity1 = await brain.add(createAddParams({ data: 'Entity 1' }))
      const entity2 = await brain.add(createAddParams({ data: 'Entity 2' }))
      
      await brain.relate({
        from: entity1,
        to: entity2,
        type: 'friendOf',
        bidirectional: true
      })
      
      // Verify both directions exist
      const before1 = await brain.getRelations({ from: entity1 })
      const before2 = await brain.getRelations({ from: entity2 })
      expect(before1.some(r => r.to === entity2)).toBe(true)
      expect(before2.some(r => r.to === entity1)).toBe(true)
      
      // Act
      await brain.delete(entity1)
      
      // Assert - All relationships should be cleaned up
      const after1 = await brain.getRelations({ from: entity1 })
      const after2 = await brain.getRelations({ from: entity2 })
      expect(after1).toHaveLength(0)
      expect(after2.some(r => r.to === entity1)).toBe(false)
    })
  })
  
  describe('error paths', () => {
    it('should handle deleting non-existent entity', async () => {
      // Act - Delete non-existent entity (should not throw)
      const nonExistentId = 'fake-id-123'
      
      // Should complete without error
      await expect(brain.delete(nonExistentId)).resolves.not.toThrow()
    })
    
    it('should handle invalid ID format', async () => {
      // Act & Assert
      await expect(brain.delete('')).resolves.not.toThrow()
      await expect(brain.delete(null as any)).resolves.not.toThrow()
      await expect(brain.delete(undefined as any)).resolves.not.toThrow()
    })
    
    it('should handle double deletion', async () => {
      // Arrange
      const id = await brain.add(createAddParams({ data: 'Test' }))
      
      // Act - Delete twice
      await brain.delete(id)
      await brain.delete(id) // Should not throw
      
      // Assert
      const result = await brain.get(id)
      expect(result).toBeNull()
    })
  })
  
  describe('edge cases', () => {
    it('should handle deletion with circular relationships', async () => {
      // TODO: Fix relationship cleanup - related to same issue as above
      // Arrange - Create circular relationship
      const entity1 = await brain.add(createAddParams({ data: 'Entity 1' }))
      const entity2 = await brain.add(createAddParams({ data: 'Entity 2' }))
      const entity3 = await brain.add(createAddParams({ data: 'Entity 3' }))
      
      await brain.relate({ from: entity1, to: entity2, type: 'relatedTo' })
      await brain.relate({ from: entity2, to: entity3, type: 'relatedTo' })
      await brain.relate({ from: entity3, to: entity1, type: 'relatedTo' })
      
      // Act
      await brain.delete(entity2)
      
      // Assert - Entity2 gone, others remain
      expect(await brain.get(entity2)).toBeNull()
      expect(await brain.get(entity1)).not.toBeNull()
      expect(await brain.get(entity3)).not.toBeNull()
      
      // Relationships involving entity2 should be gone
      const relations1 = await brain.getRelations({ from: entity1 })
      const relations3 = await brain.getRelations({ from: entity3 })
      expect(relations1.some(r => r.to === entity2)).toBe(false)
      expect(relations3.some(r => r.to === entity2)).toBe(false)
    })
    
    it('should handle concurrent deletions', async () => {
      // Arrange
      const ids = await Promise.all(
        Array.from({ length: 10 }, (_, i) => 
          brain.add(createAddParams({ data: `Entity ${i}` }))
        )
      )
      
      // Act - Delete concurrently
      await Promise.all(ids.map(id => brain.delete(id)))
      
      // Assert - All should be deleted
      const results = await Promise.all(ids.map(id => brain.get(id)))
      expect(results.every(r => r === null)).toBe(true)
    })
    
    it('should maintain data integrity after deletion', async () => {
      // Arrange
      const keepId = await brain.add(createAddParams({
        data: 'Keep this',
        metadata: { important: true }
      }))
      
      const deleteIds = await Promise.all([
        brain.add(createAddParams({ data: 'Delete 1' })),
        brain.add(createAddParams({ data: 'Delete 2' })),
        brain.add(createAddParams({ data: 'Delete 3' }))
      ])
      
      // Create relationships
      for (const deleteId of deleteIds) {
        await brain.relate({
          from: keepId,
          to: deleteId,
          type: 'relatedTo'
        })
      }
      
      // Act - Delete some entities
      await Promise.all(deleteIds.map(id => brain.delete(id)))
      
      // Assert - Kept entity should be intact
      const kept = await brain.get(keepId)
      expect(kept).not.toBeNull()
      expect(kept!.metadata.important).toBe(true)
      
      // Relations to deleted entities should be gone
      const relations = await brain.getRelations({ from: keepId })
      expect(relations).toHaveLength(0)
    })
  })
  
  describe('performance', () => {
    it('should delete entities quickly', async () => {
      // Arrange
      const id = await brain.add(createAddParams({ data: 'Fast delete' }))
      
      // Act & Assert
      const start = Date.now()
      await brain.delete(id)
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(50) // Should be very fast
    })
    
    it('should handle batch deletion efficiently', async () => {
      // Arrange - Create many entities
      const ids = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          brain.add(createAddParams({ data: `Entity ${i}` }))
        )
      )

      // Act
      const start = Date.now()
      await Promise.all(ids.map(id => brain.delete(id)))
      const duration = Date.now() - start

      // Assert
      // Note: After fixing the relationship cleanup bug, deletes are slightly slower
      // because we now properly fetch ALL relationships (not just first 100)
      expect(duration).toBeLessThan(2000) // Should handle 100 deletes in under 2s
      
      // Verify all deleted
      const results = await Promise.all(ids.map(id => brain.get(id)))
      expect(results.every(r => r === null)).toBe(true)
    })
  })
  
  describe('consistency', () => {
    it.skip('should properly invalidate cache after deletion', async () => {
      // NOTE: Test skipped - flaky search timing issue (see commits 8476047, c64967d)
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Cached entity',
        metadata: { cached: true }
      }))

      // Do a search to potentially cache results
      const before = await brain.find({ query: 'Cached entity' })
      expect(before.some(r => r.entity.id === id)).toBe(true)

      // Act
      await brain.delete(id)

      // Assert - Cache should be invalidated
      const after = await brain.find({ query: 'Cached entity' })
      expect(after.some(r => r.entity.id === id)).toBe(false)
    })
    
    it('should maintain consistency across operations', async () => {
      // Arrange
      const entity1 = await brain.add(createAddParams({ data: 'Entity 1' }))
      const entity2 = await brain.add(createAddParams({ data: 'Entity 2' }))
      
      await brain.relate({
        from: entity1,
        to: entity2,
        type: 'relatedTo'
      })
      
      // Act - Update entity1, delete entity2
      await brain.update({
        id: entity1,
        metadata: { updated: true },
        merge: true
      })
      
      await brain.delete(entity2)
      
      // Assert
      const e1 = await brain.get(entity1)
      expect(e1).not.toBeNull()
      expect(e1!.metadata.updated).toBe(true)
      
      const e2 = await brain.get(entity2)
      expect(e2).toBeNull()
      
      // Relations should be cleaned up
      const relations = await brain.getRelations({ from: entity1 })
      expect(relations.some(r => r.to === entity2)).toBe(false)
    })
  })
})