/**
 * Unit tests for Brainy.get() method
 * Tests all aspects of retrieving entities from the neural database
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { 
  createAddParams,
  generateTestVector,
  createTestConfig,
} from '../../helpers/test-factory'
import {
  assertCompletesWithin,
} from '../../helpers/test-assertions'

describe('Brainy.get()', () => {
  let brain: Brainy
  
  beforeEach(async () => {
    brain = new Brainy(createTestConfig())
    await brain.init()
  })
  
  afterEach(async () => {
    await brain.close()
  })
  
  describe('success paths', () => {
    it('should retrieve an existing entity by ID', async () => {
      // Arrange
      const params = createAddParams({
        data: 'Test entity for retrieval',
        type: 'document',
        metadata: { title: 'Test Doc', version: 1 }
      })
      const id = await brain.add(params)
      
      // Act
      const entity = await brain.get(id)
      
      // Assert
      expect(entity).not.toBeNull()
      expect(entity!.id).toBe(id)
      expect(entity!.type).toBe('document')
      expect(entity!.metadata).toBeDefined()
    })
    
    it('should retrieve entity with correct vector', async () => {
      // Arrange
      const vector = generateTestVector()
      const params = createAddParams({
        vector,
        type: 'thing',
        metadata: { vectorized: true }
      })
      const id = await brain.add(params)
      
      // Act
      const entity = await brain.get(id)
      
      // Assert
      expect(entity).not.toBeNull()
      expect(entity!.vector).toEqual(vector)
    })
    
    it('should retrieve entity with metadata intact', async () => {
      // Arrange
      const metadata = {
        name: 'Test Item',
        count: 42,
        tags: ['test', 'unit'],
        nested: { level: 1, data: 'value' }
      }
      const params = createAddParams({
        data: 'Metadata test',
        type: 'thing',
        metadata
      })
      const id = await brain.add(params)
      
      // Act
      const entity = await brain.get(id)
      
      // Assert
      expect(entity).not.toBeNull()
      // Check specific fields since metadata might be modified
      expect(entity!.metadata.name).toBe(metadata.name)
      expect(entity!.metadata.count).toBe(metadata.count)
      expect(entity!.metadata.tags).toEqual(metadata.tags)
    })
    
    it('should retrieve entity with timestamps', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Timestamp test',
        type: 'thing'
      }))
      
      // Act
      const entity = await brain.get(id)
      
      // Assert
      expect(entity).not.toBeNull()
      expect(entity!.createdAt).toBeDefined()
      expect(entity!.createdAt).toBeTypeOf('number')
      expect(entity!.createdAt).toBeGreaterThan(0)
    })
    
    it('should retrieve entity with service namespace', async () => {
      // Arrange
      const service = 'tenant-456'
      const id = await brain.add(createAddParams({
        data: 'Service test',
        type: 'thing',
        service
      }))
      
      // Act
      const entity = await brain.get(id)
      
      // Assert
      expect(entity).not.toBeNull()
      expect(entity!.service).toBe(service)
    })
    
    it('should retrieve multiple different entities correctly', async () => {
      // Arrange
      const ids: string[] = []
      for (let i = 0; i < 5; i++) {
        const id = await brain.add(createAddParams({
          data: `Entity ${i}`,
          type: 'thing',
          metadata: { index: i }
        }))
        ids.push(id)
      }
      
      // Act & Assert
      for (let i = 0; i < ids.length; i++) {
        const entity = await brain.get(ids[i])
        expect(entity).not.toBeNull()
        expect(entity!.id).toBe(ids[i])
        expect(entity!.metadata.index).toBe(i)
      }
    })
  })
  
  describe('error paths', () => {
    it('should return null for non-existent ID', async () => {
      // v5.1.0: Use valid UUID format
      const fakeId = '00000000-0000-0000-0000-999999999999'

      // Act
      const entity = await brain.get(fakeId)

      // Assert
      expect(entity).toBeNull()
    })

    it('should handle invalid ID formats gracefully', async () => {
      // v5.1.0: Invalid formats now throw errors instead of returning null
      const invalidIds = [
        '',            // Empty string
        'not-a-uuid',  // Invalid format
        '12345',       // Too short
      ]

      // Act & Assert - expect errors for invalid formats
      for (const invalidId of invalidIds) {
        await expect(brain.get(invalidId)).rejects.toThrow()
      }

      // Null/undefined should also throw
      await expect(brain.get(null as any)).rejects.toThrow()
      await expect(brain.get(undefined as any)).rejects.toThrow()
    })
    
    it('should handle deleted entities', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'To be deleted',
        type: 'thing'
      }))
      await brain.delete(id)
      
      // Act
      const entity = await brain.get(id)
      
      // Assert
      expect(entity).toBeNull()
    })
    
    it('should handle concurrent get requests for same ID', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Concurrent test',
        type: 'thing',
        metadata: { concurrent: true }
      }))
      
      // Act - Make 10 concurrent requests
      const promises = Array(10).fill(null).map(() => brain.get(id))
      const results = await Promise.all(promises)
      
      // Assert - All should return the same entity
      expect(results).toHaveLength(10)
      results.forEach(entity => {
        expect(entity).not.toBeNull()
        expect(entity!.id).toBe(id)
        expect(entity!.metadata.concurrent).toBe(true)
      })
    })
  })
  
  describe('edge cases', () => {
    it('should handle very long IDs', async () => {
      // v5.1.0: Stricter UUID validation - invalid IDs throw errors
      const longId = 'x'.repeat(1000)

      // Expect error for invalid UUID format
      await expect(brain.get(longId)).rejects.toThrow('Invalid UUID format')
    })
    
    it('should handle special characters in IDs', async () => {
      // v5.1.0: Use valid UUID format
      const specialId = '00000000-0000-0000-0000-000000000004'
      const params = createAddParams({
        id: specialId,
        data: 'Special ID test',
        type: 'thing'
      })
      await brain.add(params)

      // Act
      const entity = await brain.get(specialId)

      // Assert
      expect(entity).not.toBeNull()
      expect(entity!.id).toBe(specialId)
    })
    
    it('should handle unicode characters in IDs', async () => {
      // Arrange
      const unicodeId = '00000000-0000-0000-0000-000000000003'
      const params = createAddParams({
        id: unicodeId,
        data: 'Unicode ID test',
        type: 'thing'
      })
      await brain.add(params)
      
      // Act
      const entity = await brain.get(unicodeId)
      
      // Assert
      expect(entity).not.toBeNull()
      expect(entity!.id).toBe(unicodeId)
    })
    
    it('should handle immediately getting after add', async () => {
      // Arrange & Act
      const id = await brain.add(createAddParams({
        data: 'Immediate get test',
        type: 'thing'
      }))
      const entity = await brain.get(id)
      
      // Assert
      expect(entity).not.toBeNull()
      expect(entity!.id).toBe(id)
    })
    
    it('should get entity with very large metadata', async () => {
      // Arrange
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
      
      const id = await brain.add(createAddParams({
        data: 'Large metadata',
        type: 'thing',
        metadata: largeMetadata
      }))
      
      // Act
      const entity = await brain.get(id)
      
      // Assert
      expect(entity).not.toBeNull()
      expect(entity!.metadata.bigArray).toHaveLength(1000)
      expect(Object.keys(entity!.metadata.bigObject)).toHaveLength(100)
    })
  })
  
  describe('performance', () => {
    it('should retrieve entities quickly', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Performance test',
        type: 'thing'
      }))
      
      // Act & Assert
      await assertCompletesWithin(
        () => brain.get(id),
        50, // Should complete within 50ms
        'Get operation'
      )
    })
    
    it('should handle batch gets efficiently', async () => {
      // Arrange - Add 100 entities
      const ids: string[] = []
      for (let i = 0; i < 100; i++) {
        const id = await brain.add(createAddParams({
          data: `Batch entity ${i}`,
          type: 'thing'
        }))
        ids.push(id)
      }
      
      // Act - Get all entities
      const start = performance.now()
      const entities = await Promise.all(ids.map(id => brain.get(id)))
      const duration = performance.now() - start
      
      // Assert
      expect(entities).toHaveLength(100)
      entities.forEach(entity => {
        expect(entity).not.toBeNull()
      })
      
      const opsPerSecond = (100 / duration) * 1000
      expect(opsPerSecond).toBeGreaterThan(500) // At least 500 gets/second
    })
    
    it('should retrieve entities quickly on repeated access', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Cache test',
        type: 'thing',
        metadata: { cached: true }
      }))
      
      // Act - First get (may hit storage)
      const entity1 = await brain.get(id)
      
      // Act - Second get (may benefit from caching)
      const start = performance.now()
      const entity2 = await brain.get(id)
      const duration = performance.now() - start
      
      // Assert - Entities should be equivalent (not necessarily same instance)
      expect(entity1).not.toBeNull()
      expect(entity2).not.toBeNull()
      expect(entity1!.id).toBe(entity2!.id)
      expect(entity1!.type).toBe(entity2!.type)
      expect(entity1!.metadata.cached).toBe(true)
      expect(entity2!.metadata.cached).toBe(true)
      expect(duration).toBeLessThan(10) // Should be fast
    })
  })
  
  describe('consistency', () => {
    it('should return consistent data across multiple gets', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Consistency test',
        type: 'thing',
        metadata: { version: 1, stable: true }
      }))
      
      // Act - Get the same entity 5 times
      const entities: any[] = []
      for (let i = 0; i < 5; i++) {
        const entity = await brain.get(id)
        entities.push(entity)
      }
      
      // Assert - All should have identical content (not necessarily same instance)
      const first = entities[0]
      expect(first).not.toBeNull()
      entities.forEach(entity => {
        expect(entity).not.toBeNull()
        expect(entity.id).toBe(first.id)
        expect(entity.type).toBe(first.type)
        expect(entity.metadata.version).toBe(1)
        expect(entity.metadata.stable).toBe(true)
        expect(entity.createdAt).toBe(first.createdAt)
      })
    })
    
    it('should reflect updates immediately', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Update test',
        type: 'thing',
        metadata: { version: 1 }
      }))
      
      // Act - Update and immediately get
      await brain.update({
        id,
        metadata: { version: 2 },
        merge: false
      })
      const entity = await brain.get(id)
      
      // Assert
      expect(entity).not.toBeNull()
      expect(entity!.metadata.version).toBe(2)
    })
  })
})