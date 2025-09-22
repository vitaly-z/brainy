/**
 * Unit tests for Brainy.add() method
 * Tests all aspects of adding entities to the neural database
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { 
  createAddParams,
  generateTestVector,
  createTestConfig,
} from '../../helpers/test-factory'
import {
  assertRejectsWithError,
  assertCompletesWithin,
} from '../../helpers/test-assertions'

describe('Brainy.add()', () => {
  let brain: Brainy
  
  beforeEach(async () => {
    brain = new Brainy(createTestConfig())
    await brain.init()
  })
  
  afterEach(async () => {
    await brain.close()
  })
  
  describe('success paths', () => {
    it('should add an entity with text content', async () => {
      // Arrange
      const params = createAddParams({
        data: 'This is a test document about machine learning',
        type: 'document',
        metadata: { title: 'ML Guide', category: 'education' }
      })
      
      // Act
      const id = await brain.add(params)
      
      // Assert
      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      
      // Verify entity was stored
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity!.type).toBe('document')
      expect(entity!.metadata.title).toBe('ML Guide')
      expect(entity!.metadata.category).toBe('education')
    })
    
    it('should add an entity with pre-computed vector', async () => {
      // Arrange
      const vector = generateTestVector(384) // Use correct dimensions for all-MiniLM-L6-v2
      const params = createAddParams({
        vector,
        type: 'thing',
        metadata: { name: 'Pre-vectorized item' }
      })
      
      // Act
      const id = await brain.add(params)
      
      // Assert
      expect(id).toBeDefined()
      
      // Verify entity was stored with correct vector
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity!.vector).toEqual(vector)
      expect(entity!.metadata.name).toBe('Pre-vectorized item')
    })
    
    it('should add an entity with custom ID', async () => {
      // Arrange
      const customId = 'custom-entity-123'
      const params = createAddParams({
        id: customId,
        data: 'Entity with custom ID',
        type: 'thing'
      })
      
      // Act
      const id = await brain.add(params)
      
      // Assert
      expect(id).toBe(customId)
      
      // Verify entity exists with custom ID
      const entity = await brain.get(customId)
      expect(entity).toBeDefined()
    })
    
    it('should add multiple entities sequentially', async () => {
      // Arrange
      const params1 = createAddParams({ data: 'First entity', type: 'thing' })
      const params2 = createAddParams({ data: 'Second entity', type: 'document' })
      const params3 = createAddParams({ data: 'Third entity', type: 'concept' })
      
      // Act
      const id1 = await brain.add(params1)
      const id2 = await brain.add(params2)
      const id3 = await brain.add(params3)
      
      // Assert
      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      
      // Verify all entities exist
      const entity1 = await brain.get(id1)
      const entity2 = await brain.get(id2)
      const entity3 = await brain.get(id3)
      
      expect(entity1).not.toBeNull()
      expect(entity2).not.toBeNull()
      expect(entity3).not.toBeNull()
      expect(entity1!.type).toBe('thing')
      expect(entity2!.type).toBe('document')
      expect(entity3!.type).toBe('concept')
    })
    
    it('should add entity with complex metadata', async () => {
      // Arrange
      const complexMetadata = {
        name: 'Complex Item',
        tags: ['test', 'complex', 'metadata'],
        nested: {
          level1: {
            level2: {
              value: 'deep'
            }
          }
        },
        array: [1, 2, 3],
        boolean: true,
        number: 42.5,
        null: null,
      }
      
      const params = createAddParams({
        data: 'Complex metadata test',
        type: 'thing',
        metadata: complexMetadata
      })
      
      // Act
      const id = await brain.add(params)
      
      // Assert
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      // The metadata will have the spread string data, so check specific fields
      expect(entity!.metadata.name).toBe('Complex Item')
      expect(entity!.metadata.tags).toEqual(['test', 'complex', 'metadata'])
      expect(entity!.metadata.nested).toEqual({
        level1: {
          level2: {
            value: 'deep'
          }
        }
      })
      expect(entity!.metadata.array).toEqual([1, 2, 3])
      expect(entity!.metadata.boolean).toBe(true)
      expect(entity!.metadata.number).toBe(42.5)
      expect(entity!.metadata.null).toBe(null)
    })
    
    it('should add entity with service namespace', async () => {
      // Arrange
      const params = createAddParams({
        data: 'Service-specific entity',
        type: 'thing',
        service: 'tenant-123'
      })
      
      // Act
      const id = await brain.add(params)
      
      // Assert
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity!.service).toBe('tenant-123')
    })
    
    it('should handle JSON objects as data', async () => {
      // Arrange
      const jsonData = {
        title: 'Product',
        description: 'A great product',
        price: 99.99
      }
      
      const params = createAddParams({
        data: jsonData,
        type: 'product'
      })
      
      // Act
      const id = await brain.add(params)
      
      // Assert
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity!.type).toBe('product')
      // The JSON should be embedded as a string representation
      expect(entity!.vector).toBeDefined()
      expect(entity!.vector.length).toBeGreaterThan(0)
    })
    
    it('should set timestamps correctly', async () => {
      // Arrange
      const beforeAdd = Date.now()
      const params = createAddParams({
        data: 'Timestamp test',
        type: 'thing'
      })
      
      // Act
      const id = await brain.add(params)
      const afterAdd = Date.now()
      
      // Assert
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity!.createdAt).toBeGreaterThanOrEqual(beforeAdd)
      expect(entity!.createdAt).toBeLessThanOrEqual(afterAdd)
      // updatedAt should be very close to createdAt for new entities (within 10ms)
      expect(Math.abs(entity!.updatedAt! - entity!.createdAt)).toBeLessThanOrEqual(10)
    })
  })
  
  describe('error paths', () => {
    it('should throw error when data and vector are both missing', async () => {
      // Arrange
      const params = {
        type: 'thing',
        metadata: { name: 'Invalid' }
      } as any
      
      // Act & Assert
      await assertRejectsWithError(
        brain.add(params),
        'Invalid add() parameters: Missing required field \'data\''
      )
    })
    
    it('should throw error for invalid entity type', async () => {
      // Arrange
      const params = createAddParams({
        data: 'Invalid type test',
        type: 'invalid_type' as any
      })
      
      // Act & Assert
      await assertRejectsWithError(
        brain.add(params),
        'Invalid NounType: \'invalid_type\''
      )
    })
    
    it('should allow duplicate custom ID (overwrites)', async () => {
      // Arrange
      const duplicateId = 'duplicate-123'
      const params1 = createAddParams({
        id: duplicateId,
        data: 'First entity',
        type: 'thing',
        metadata: { version: 1 }
      })
      const params2 = createAddParams({
        id: duplicateId,
        data: 'Second entity',
        type: 'thing',
        metadata: { version: 2 }
      })
      
      // Act
      await brain.add(params1)
      const entity1 = await brain.get(duplicateId)
      
      await brain.add(params2)
      const entity2 = await brain.get(duplicateId)
      
      // Assert - Second add overwrites the first
      expect(entity1).not.toBeNull()
      expect(entity1!.metadata.version).toBe(1)
      
      expect(entity2).not.toBeNull()
      expect(entity2!.metadata.version).toBe(2)
    })
    
    it('should throw error for invalid vector dimensions', async () => {
      // Arrange
      // First add sets the expected dimensions (384 for mock embeddings)
      await brain.add(createAddParams({
        data: 'Set dimensions',
        type: 'thing'
      }))
      
      const wrongDimensionVector = [1, 2, 3] // Wrong dimension (not 384)
      const params = createAddParams({
        vector: wrongDimensionVector,
        type: 'thing'
      })
      
      // Act & Assert
      await expect(brain.add(params)).rejects.toThrow('dimension')
    })
    
    it('should handle null/undefined metadata gracefully', async () => {
      // Arrange
      const params1 = createAddParams({
        data: 'No metadata',
        type: 'thing',
        metadata: null as any
      })
      
      const params2 = createAddParams({
        data: 'Undefined metadata',
        type: 'thing',
        metadata: undefined
      })
      
      // Act
      const id1 = await brain.add(params1)
      const id2 = await brain.add(params2)
      
      // Assert - should not throw, metadata should be empty object or undefined
      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
    })
  })
  
  describe('edge cases', () => {
    it('should reject empty string as data', async () => {
      // Arrange
      const params = createAddParams({
        data: '',
        type: 'thing'
      })
      
      // Act & Assert - Empty string is not valid data
      await expect(brain.add(params)).rejects.toThrow('Invalid add() parameters: Missing required field \'data\'')
    })
    
    it('should handle very long text content', async () => {
      // Arrange
      const longText = 'Lorem ipsum '.repeat(10000) // ~120KB of text
      const params = createAddParams({
        data: longText,
        type: 'document'
      })
      
      // Act
      const id = await brain.add(params)
      
      // Assert
      expect(id).toBeDefined()
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity!.type).toBe('document')
    })
    
    it('should handle special characters in metadata', async () => {
      // Arrange
      const specialMetadata = {
        name: '🚀 Rocket Science! @#$%^&*()',
        description: 'Line 1\nLine 2\tTabbed\r\nWindows line',
        unicode: '你好世界 مرحبا بالعالم',
        quotes: 'He said "Hello" and she said \'Hi\''
      }
      
      const params = createAddParams({
        data: 'Special characters test',
        type: 'thing',
        metadata: specialMetadata
      })
      
      // Act
      const id = await brain.add(params)
      
      // Assert
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      // Check each field individually due to metadata spreading
      expect(entity!.metadata.name).toBe(specialMetadata.name)
      expect(entity!.metadata.description).toBe(specialMetadata.description)
      expect(entity!.metadata.unicode).toBe(specialMetadata.unicode)
      expect(entity!.metadata.quotes).toBe(specialMetadata.quotes)
    })
    
    it('should handle concurrent adds', async () => {
      // Arrange
      const promises = Array.from({ length: 10 }, (_, i) => 
        brain.add(createAddParams({
          data: `Concurrent entity ${i}`,
          type: 'thing',
          metadata: { index: i }
        }))
      )
      
      // Act
      const ids = await Promise.all(promises)
      
      // Assert
      expect(ids).toHaveLength(10)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(10) // All IDs should be unique
      
      // Check metadata preserved correctly
      for (let i = 0; i < ids.length; i++) {
        const entity = await brain.get(ids[i])
        expect(entity).not.toBeNull()
        expect(entity!.metadata.index).toBe(i)
      }
    })
    
    it('should store vectors as provided without normalization', async () => {
      // Arrange
      const unnormalizedVector = new Array(384).fill(2) // Not unit length, correct dimensions
      const params = createAddParams({
        vector: unnormalizedVector,
        type: 'thing'
      })
      
      // Act
      const id = await brain.add(params)
      
      // Assert - Brainy stores vectors as-is without normalization
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity!.vector).toEqual(unnormalizedVector)
      
      // Verify it's not normalized
      const magnitude = Math.sqrt(
        entity!.vector.reduce((sum: number, val: number) => sum + val * val, 0)
      )
      expect(magnitude).toBeGreaterThan(1) // Not normalized
    })
  })
  
  describe('performance', () => {
    it('should add entities quickly', async () => {
      // Arrange
      const params = createAddParams({
        data: 'Performance test entity',
        type: 'thing'
      })
      
      // Act & Assert
      await assertCompletesWithin(
        () => brain.add(params),
        100, // Should complete within 100ms
        'Add operation'
      )
    })
    
    it('should handle batch adds efficiently', async () => {
      // Arrange
      const count = 100
      const params = Array.from({ length: count }, (_, i) => 
        createAddParams({
          data: `Batch entity ${i}`,
          type: 'thing'
        })
      )
      
      // Act
      const start = performance.now()
      const ids = await Promise.all(params.map(p => brain.add(p)))
      const duration = performance.now() - start
      
      // Assert
      expect(ids).toHaveLength(count)
      const opsPerSecond = (count / duration) * 1000
      expect(opsPerSecond).toBeGreaterThan(100) // At least 100 ops/second
    })
  })
  
  describe('augmentations', () => {
    it('should apply augmentations during add', async () => {
      // This would test augmentation pipeline if configured
      // For now, just verify the entity is added correctly
      const params = createAddParams({
        data: 'Augmentation test',
        type: 'thing',
        metadata: { augment: true }
      })
      
      const id = await brain.add(params)
      const entity = await brain.get(id)
      
      expect(entity).not.toBeNull()
      expect(entity!.metadata.augment).toBe(true)
    })
  })
  
  describe('caching behavior', () => {
    it('should retrieve consistent entities', async () => {
      // Arrange
      const params = createAddParams({
        id: 'cached-entity',
        data: 'Cached content',
        type: 'thing',
        metadata: { test: 'cache' }
      })
      
      // Act
      const id = await brain.add(params)
      const entity1 = await brain.get(id)
      const entity2 = await brain.get(id)
      
      // Assert - Both gets should return equivalent entities
      expect(entity1).not.toBeNull()
      expect(entity2).not.toBeNull()
      expect(entity1!.id).toBe(entity2!.id)
      expect(entity1!.type).toBe(entity2!.type)
      expect(entity1!.metadata.test).toBe('cache')
      expect(entity2!.metadata.test).toBe('cache')
    })
  })
})