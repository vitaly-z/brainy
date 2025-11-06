/**
 * Unit tests for Brainy.update() method
 * Tests all aspects of updating entities in the neural database
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { 
  createAddParams,
  createTestConfig,
} from '../../helpers/test-factory'
import {
  assertCompletesWithin,
} from '../../helpers/test-assertions'

describe('Brainy.update()', () => {
  let brain: Brainy
  
  beforeEach(async () => {
    brain = new Brainy(createTestConfig())
    await brain.init()
  })
  
  afterEach(async () => {
    await brain.close()
  })
  
  describe('success paths', () => {
    it('should update entity metadata', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Original content',
        type: 'document',
        metadata: { version: 1, status: 'draft' }
      }))
      
      // Act
      await brain.update({
        id,
        metadata: { version: 2, status: 'published' },
        merge: false
      })
      
      // Assert
      const updated = await brain.get(id)
      expect(updated).not.toBeNull()
      expect(updated!.metadata.version).toBe(2)
      expect(updated!.metadata.status).toBe('published')
    })
    
    it('should merge metadata when merge is true', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Test content',
        type: 'thing',
        metadata: { 
          name: 'Original',
          count: 10,
          tags: ['original']
        }
      }))
      
      // Act
      await brain.update({
        id,
        metadata: { 
          count: 20,
          tags: ['updated'],
          newField: 'added'
        },
        merge: true
      })
      
      // Assert
      const updated = await brain.get(id)
      expect(updated).not.toBeNull()
      expect(updated!.metadata.name).toBe('Original') // Preserved
      expect(updated!.metadata.count).toBe(20) // Updated
      expect(updated!.metadata.tags).toEqual(['updated']) // Replaced
      expect(updated!.metadata.newField).toBe('added') // Added
    })
    
    it('should replace metadata when merge is false', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Test content',
        type: 'thing',
        metadata: { 
          name: 'Original',
          count: 10,
          willBeRemoved: true
        }
      }))
      
      // Act
      await brain.update({
        id,
        metadata: { 
          newData: 'replaced',
          count: 99
        },
        merge: false
      })
      
      // Assert
      const updated = await brain.get(id)
      expect(updated).not.toBeNull()
      expect(updated!.metadata.newData).toBe('replaced')
      expect(updated!.metadata.count).toBe(99)
      expect(updated!.metadata.name).toBeUndefined() // Removed
      expect(updated!.metadata.willBeRemoved).toBeUndefined() // Removed
    })
    
    it('should update entity type', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Versatile content',
        type: 'thing',
        metadata: { original: true }
      }))
      
      // Act
      await brain.update({
        id,
        type: 'document'
      })
      
      // Assert
      const updated = await brain.get(id)
      expect(updated).not.toBeNull()
      expect(updated!.type).toBe('document')
      expect(updated!.metadata.original).toBe(true) // Metadata preserved
    })
    
    it('should update entity vector when data changes', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Original text content',
        type: 'thing'
      }))
      
      const original = await brain.get(id)
      const originalVector = original!.vector
      
      // Act - Update with new data triggers re-embedding
      await brain.update({
        id,
        data: 'Completely different text content'
      })
      
      // Assert
      const updated = await brain.get(id)
      expect(updated).not.toBeNull()
      // Vector should be different after re-embedding
      expect(updated!.vector).not.toEqual(originalVector)
      expect(updated!.vector.length).toBe(originalVector.length)
    })
    
    it('should re-embed when data is updated', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Original text',
        type: 'document'
      }))
      
      const original = await brain.get(id)
      
      // Act
      await brain.update({
        id,
        data: 'Completely different text'
      })
      
      // Assert
      const updated = await brain.get(id)
      expect(updated).not.toBeNull()
      // Vector should be different after re-embedding
      expect(updated!.vector).not.toEqual(original!.vector)
    })
    
    it('should update timestamps', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Timestamp test',
        type: 'thing'
      }))
      
      const original = await brain.get(id)
      const originalUpdatedAt = original!.updatedAt || original!.createdAt
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Act
      await brain.update({
        id,
        metadata: { updated: true }
      })
      
      // Assert
      const updated = await brain.get(id)
      expect(updated).not.toBeNull()
      expect(updated!.createdAt).toBe(original!.createdAt) // Created stays same
      expect(updated!.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })
    
    it('should handle multiple updates to same entity', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Multi-update test',
        type: 'thing',
        metadata: { version: 1 }
      }))
      
      // Act - Multiple sequential updates
      await brain.update({ id, metadata: { version: 2 }, merge: true })
      await brain.update({ id, metadata: { version: 3 }, merge: true })
      await brain.update({ id, metadata: { version: 4 }, merge: true })
      
      // Assert
      const final = await brain.get(id)
      expect(final).not.toBeNull()
      expect(final!.metadata.version).toBe(4)
    })
  })
  
  describe('error paths', () => {
    it('should handle updating non-existent entity', async () => {
      // Arrange
      const fakeId = 'non-existent-12345'
      
      // Act & Assert
      await expect(brain.update({
        id: fakeId,
        metadata: { test: 'value' }
      })).rejects.toThrow()
    })
    
    it('should reject invalid entity type on update', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Test',
        type: 'thing'
      }))
      
      // Act & Assert - Should properly validate type
      await expect(brain.update({
        id,
        type: 'invalid_type' as any
      })).rejects.toThrow('invalid NounType')
    })
    
    it('should not update vector directly via update method', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Test',
        type: 'thing'
      }))
      
      const original = await brain.get(id)
      const originalVector = original!.vector
      
      // Create a properly dimensioned but different vector
      const differentVector = originalVector.map(v => v * 2)
      
      // Act - Update with vector param (not supported)
      await brain.update({
        id,
        vector: differentVector
      })
      
      // Assert - Vector should not change (update ignores vector param)
      const updated = await brain.get(id)
      expect(updated).not.toBeNull()
      expect(updated!.vector).toEqual(originalVector)
    })
    
    it('should reject empty update parameters', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Test',
        type: 'thing',
        metadata: { original: true }
      }))
      
      // Act & Assert - Should require at least one field to update
      await expect(brain.update({ id })).rejects.toThrow('must specify at least one field to update')
    })
  })
  
  describe('edge cases', () => {
    it('should reject updating with null metadata', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Test',
        type: 'thing',
        metadata: { existing: 'data', another: 'field' }
      }))
      
      // Act & Assert - null metadata is not a valid update
      // This prevents accidental data loss from null values
      await expect(brain.update({
        id,
        metadata: null as any,
        merge: false
      })).rejects.toThrow('must specify at least one field to update')
      
      // Verify original data is untouched
      const entity = await brain.get(id)
      expect(entity!.metadata.existing).toBe('data')
      expect(entity!.metadata.another).toBe('field')
    })
    
    it('should handle concurrent updates', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Concurrent test',
        type: 'thing',
        metadata: { counter: 0 }
      }))
      
      // Act - Fire 10 concurrent updates
      const updates = Array.from({ length: 10 }, (_, i) => 
        brain.update({
          id,
          metadata: { counter: i + 1 },
          merge: false
        })
      )
      
      await Promise.all(updates)
      
      // Assert - Last update wins
      const final = await brain.get(id)
      expect(final).not.toBeNull()
      expect(final!.metadata.counter).toBeGreaterThan(0)
      expect(final!.metadata.counter).toBeLessThanOrEqual(10)
    })
    
    it('should handle very large metadata updates', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Large metadata test',
        type: 'thing'
      }))
      
      const largeMetadata = {
        bigArray: new Array(1000).fill('item'),
        bigObject: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`key${i}`, `value${i}`])
        ),
        deepNesting: Array(10).fill(null).reduce(
          (acc) => ({ nested: acc }),
          { value: 'deep' }
        )
      }
      
      // Act
      await brain.update({
        id,
        metadata: largeMetadata,
        merge: false
      })
      
      // Assert
      const updated = await brain.get(id)
      expect(updated).not.toBeNull()
      expect(updated!.metadata.bigArray).toHaveLength(1000)
      expect(Object.keys(updated!.metadata.bigObject)).toHaveLength(100)
    })
    
    it('should preserve entity ID during update', async () => {
      // Arrange
      const customId = '00000000-0000-0000-0000-000000000002'
      await brain.add(createAddParams({
        id: customId,
        data: 'Test',
        type: 'thing'
      }))
      
      // Act
      await brain.update({
        id: customId,
        data: 'Updated content',
        type: 'document',
        metadata: { changed: true }
      })
      
      // Assert
      const updated = await brain.get(customId)
      expect(updated).not.toBeNull()
      expect(updated!.id).toBe(customId)
      expect(updated!.type).toBe('document')
      expect(updated!.metadata.changed).toBe(true)
    })
  })
  
  describe('performance', () => {
    it('should update entities quickly', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Performance test',
        type: 'thing'
      }))
      
      // Act & Assert
      await assertCompletesWithin(
        () => brain.update({
          id,
          metadata: { updated: true }
        }),
        100, // Should complete within 100ms
        'Update operation'
      )
    })
    
    it('should handle batch updates efficiently', async () => {
      // Arrange - Create 100 entities
      const ids: string[] = []
      for (let i = 0; i < 100; i++) {
        const id = await brain.add(createAddParams({
          data: `Entity ${i}`,
          type: 'thing',
          metadata: { index: i }
        }))
        ids.push(id)
      }
      
      // Act - Update all entities
      const start = performance.now()
      const updates = ids.map((id, i) => 
        brain.update({
          id,
          metadata: { index: i, updated: true },
          merge: true
        })
      )
      await Promise.all(updates)
      const duration = performance.now() - start

      // Assert
      const opsPerSecond = (100 / duration) * 1000
      expect(opsPerSecond).toBeGreaterThan(40) // v5.4.0: Type-first storage with metadata (realistic: 40+ ops/sec)
      
      // Verify updates
      const entity = await brain.get(ids[0])
      expect(entity!.metadata.updated).toBe(true)
    })
  })
  
  describe('consistency', () => {
    it('should maintain consistency after update', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Consistency test',
        type: 'thing',
        metadata: { important: 'data', version: 1 }
      }))
      
      // Act
      await brain.update({
        id,
        metadata: { version: 2 },
        merge: true
      })
      
      // Assert - Multiple gets should return same updated data
      const get1 = await brain.get(id)
      const get2 = await brain.get(id)
      
      expect(get1).not.toBeNull()
      expect(get2).not.toBeNull()
      expect(get1!.metadata.version).toBe(2)
      expect(get2!.metadata.version).toBe(2)
      expect(get1!.metadata.important).toBe('data') // Preserved
      expect(get2!.metadata.important).toBe('data') // Preserved
    })
    
    it('should reflect updates in vector search', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Original searchable content',
        type: 'document',
        metadata: { category: 'original' }
      }))
      
      // Act
      await brain.update({
        id,
        data: 'Updated searchable content',
        metadata: { category: 'updated' },
        merge: false
      })
      
      // Assert - Vector search should find the updated entity
      const results = await brain.find({
        query: 'Updated searchable content',
        limit: 10
      })
      
      const found = results.find(r => r.id === id)
      expect(found).toBeDefined()
      expect(found!.entity.metadata.category).toBe('updated')
    })
  })
})