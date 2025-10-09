/**
 * Unit tests for Brainy.relate() method
 * Tests all aspects of creating relationships between entities
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

describe('Brainy.relate()', () => {
  let brain: Brainy
  let entity1Id: string
  let entity2Id: string
  let entity3Id: string
  
  beforeEach(async () => {
    brain = new Brainy(createTestConfig())
    await brain.init()
    
    // Create test entities for relationships
    entity1Id = await brain.add(createAddParams({
      data: 'Entity 1 - Person Alice',
      type: 'person',
      metadata: { name: 'Alice', role: 'developer' }
    }))
    
    entity2Id = await brain.add(createAddParams({
      data: 'Entity 2 - Person Bob',
      type: 'person',
      metadata: { name: 'Bob', role: 'manager' }
    }))
    
    entity3Id = await brain.add(createAddParams({
      data: 'Entity 3 - Project X',
      type: 'project',
      metadata: { name: 'Project X', status: 'active' }
    }))
  })
  
  afterEach(async () => {
    await brain.close()
  })
  
  describe('success paths', () => {
    it('should create a relationship between two entities', async () => {
      // Act
      const relationId = await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'worksWith'
      })
      
      // Assert
      expect(relationId).toBeDefined()
      expect(typeof relationId).toBe('string')
      
      // Verify relationship exists
      const relations = await brain.getRelations({ from: entity1Id })
      expect(relations.length).toBeGreaterThan(0)
      expect(relations.some(r => r.to === entity2Id)).toBe(true)
    })
    
    it('should create relationship with weight', async () => {
      // Act
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'likes',
        weight: 0.8
      })
      
      // Assert
      const relations = await brain.getRelations({ from: entity1Id })
      const relation = relations.find(r => r.to === entity2Id)
      expect(relation).toBeDefined()
      expect(relation!.weight).toBe(0.8)
    })
    
    it('should create relationship with metadata', async () => {
      // Arrange
      const metadata = {
        since: '2024-01-01',
        strength: 'strong',
        notes: 'Worked on multiple projects'
      }
      
      // Act
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'worksWith',
        metadata
      })
      
      // Assert
      const relations = await brain.getRelations({ from: entity1Id })
      const relation = relations.find(r => r.to === entity2Id)
      expect(relation).toBeDefined()
      expect(relation!.metadata || {}).toMatchObject(metadata)
    })
    
    it('should create bidirectional relationship when specified', async () => {
      // Act
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'friendOf',
        bidirectional: true
      })
      
      // Assert - Check both directions
      const forwardRelations = await brain.getRelations({ from: entity1Id })
      const reverseRelations = await brain.getRelations({ from: entity2Id })
      
      expect(forwardRelations.some(r => r.to === entity2Id)).toBe(true)
      expect(reverseRelations.some(r => r.to === entity1Id)).toBe(true)
    })
    
    it('should create multiple relationships from same entity', async () => {
      // Act
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'worksWith'
      })
      
      await brain.relate({
        from: entity1Id,
        to: entity3Id,
        type: 'creates'
      })
      
      // Assert
      const relations = await brain.getRelations({ from: entity1Id })
      expect(relations.length).toBe(2)
      expect(relations.some(r => r.to === entity2Id)).toBe(true)
      expect(relations.some(r => r.to === entity3Id)).toBe(true)
    })
    
    it('should create different relationship types between same entities', async () => {
      // Act
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'worksWith'
      })
      
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'reportsTo'
      })
      
      // Assert
      const relations = await brain.getRelations({ from: entity1Id })
      const toEntity2 = relations.filter(r => r.to === entity2Id)
      expect(toEntity2.length).toBe(2)
      expect(toEntity2.some(r => r.type === 'worksWith')).toBe(true)
      expect(toEntity2.some(r => r.type === 'reportsTo')).toBe(true)
    })
    
    it('should handle self-relationships', async () => {
      // Act
      await brain.relate({
        from: entity1Id,
        to: entity1Id,
        type: 'relatedTo',
        metadata: { type: 'self-reference' }
      })
      
      // Assert
      const relations = await brain.getRelations({ from: entity1Id })
      const selfRelation = relations.find(r => r.to === entity1Id)
      expect(selfRelation).toBeDefined()
      expect(selfRelation!.metadata?.type).toBe('self-reference')
    })
  })
  
  describe('error paths', () => {
    it('should handle relating non-existent entities', async () => {
      // Arrange
      const fakeId = 'non-existent-123'
      
      // Act & Assert - Should handle gracefully or throw
      await expect(brain.relate({
        from: fakeId,
        to: entity2Id,
        type: 'relatedTo'
      })).rejects.toThrow()
    })
    
    it('should handle invalid relationship type', async () => {
      // Act & Assert - Invalid type should throw validation error
      await expect(brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'invalidType' as any
      })).rejects.toThrow('invalid VerbType')
    })
    
    it('should handle missing required parameters', async () => {
      // Act & Assert
      await expect(brain.relate({
        from: '',
        to: entity2Id,
        type: 'relatedTo'
      } as any)).rejects.toThrow()
      
      await expect(brain.relate({
        from: entity1Id,
        to: '',
        type: 'relatedTo'
      } as any)).rejects.toThrow()
    })
  })
  
  describe('edge cases', () => {
    it('should handle duplicate relationships', async () => {
      // Act - Create same relationship twice
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'worksWith',
        weight: 0.5
      })
      
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'worksWith',
        weight: 0.8
      })
      
      // Assert - Both relationships should exist
      const relations = await brain.getRelations({ from: entity1Id })
      const matches = relations.filter(r => 
        r.to === entity2Id && r.type === 'worksWith'
      )
      expect(matches.length).toBe(2)
    })
    
    it('should handle very long metadata', async () => {
      // Arrange
      const largeMetadata = {
        bigArray: new Array(100).fill('item'),
        bigObject: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`key${i}`, `value${i}`])
        ),
        longString: 'x'.repeat(1000)
      }
      
      // Act
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'relatedTo',
        metadata: largeMetadata
      })
      
      // Assert
      const relations = await brain.getRelations({ from: entity1Id })
      const relation = relations.find(r => r.to === entity2Id)
      expect(relation).toBeDefined()
      expect(relation!.metadata?.bigArray).toHaveLength(100)
    })
    
    it('should handle special characters in metadata', async () => {
      // Arrange
      const specialMetadata = {
        emoji: '🚀🎉💻',
        unicode: '你好世界',
        special: '!@#$%^&*()',
        newlines: 'line1\nline2\nline3'
      }
      
      // Act
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'relatedTo',
        metadata: specialMetadata
      })
      
      // Assert
      const relations = await brain.getRelations({ from: entity1Id })
      const relation = relations.find(r => r.to === entity2Id)
      expect(relation!.metadata || {}).toMatchObject(specialMetadata)
    })
    
    it('should handle concurrent relationship creation', async () => {
      // Act - Create 10 relationships concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        brain.relate({
          from: entity1Id,
          to: entity2Id,
          type: 'relatedTo',
          metadata: { index: i }
        })
      )
      
      await Promise.all(promises)
      
      // Assert
      const relations = await brain.getRelations({ from: entity1Id })
      const toEntity2 = relations.filter(r => r.to === entity2Id)
      expect(toEntity2.length).toBe(10)
    })
  })
  
  describe('performance', () => {
    it('should create relationships quickly', async () => {
      // Act & Assert
      await assertCompletesWithin(
        () => brain.relate({
          from: entity1Id,
          to: entity2Id,
          type: 'relatedTo'
        }),
        50, // Should complete within 50ms
        'Relate operation'
      )
    })
    
    it('should handle batch relationship creation efficiently', async () => {
      // Arrange - Create more entities
      const entityIds: string[] = []
      for (let i = 0; i < 20; i++) {
        const id = await brain.add(createAddParams({
          data: `Entity ${i}`,
          type: 'thing'
        }))
        entityIds.push(id)
      }
      
      // Act - Create relationships between all pairs
      const start = performance.now()
      const relates: Promise<string>[] = []
      for (let i = 0; i < entityIds.length - 1; i++) {
        for (let j = i + 1; j < entityIds.length; j++) {
          relates.push(brain.relate({
            from: entityIds[i],
            to: entityIds[j],
            type: 'relatedTo'
          }))
        }
      }
      await Promise.all(relates)
      const duration = performance.now() - start
      
      // Assert
      const relationCount = (entityIds.length * (entityIds.length - 1)) / 2
      const opsPerSecond = (relationCount / duration) * 1000
      expect(opsPerSecond).toBeGreaterThan(100) // At least 100 relations/second
    })
  })
  
  describe('consistency', () => {
    it('should maintain relationship consistency', async () => {
      // Act
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'worksWith',
        metadata: { department: 'Engineering' }
      })
      
      // Assert - Multiple queries should return same data
      const relations1 = await brain.getRelations({ from: entity1Id })
      const relations2 = await brain.getRelations({ from: entity1Id })
      
      expect(relations1.length).toBe(relations2.length)
      const rel1 = relations1.find(r => r.to === entity2Id)
      const rel2 = relations2.find(r => r.to === entity2Id)
      
      expect(rel1).toBeDefined()
      expect(rel2).toBeDefined()
      expect(rel1!.type).toBe(rel2!.type)
      expect(rel1!.metadata?.department).toBe('Engineering')
      expect(rel2!.metadata?.department).toBe('Engineering')
    })
    
    it('should preserve relationships after entity updates', async () => {
      // Arrange
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'worksWith'
      })
      
      // Act - Update an entity
      await brain.update({
        id: entity1Id,
        metadata: { updated: true },
        merge: true
      })
      
      // Assert - Relationship should still exist
      const relations = await brain.getRelations({ from: entity1Id })
      expect(relations.some(r => r.to === entity2Id)).toBe(true)
    })
  })
  
  describe('graph traversal', () => {
    it('should support basic graph traversal', async () => {
      // Arrange - Create a chain: entity1 -> entity2 -> entity3
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'precedes'
      })
      
      await brain.relate({
        from: entity2Id,
        to: entity3Id,
        type: 'precedes'
      })
      
      // Act - Get relationships step by step
      const step1 = await brain.getRelations({ from: entity1Id })
      const entity2Relations = await brain.getRelations({ from: entity2Id })
      
      // Assert
      expect(step1.some(r => r.to === entity2Id)).toBe(true)
      expect(entity2Relations.some(r => r.to === entity3Id)).toBe(true)
    })
    
    it('should handle circular relationships', async () => {
      // Arrange - Create a cycle: entity1 -> entity2 -> entity3 -> entity1
      await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'relatedTo'
      })
      
      await brain.relate({
        from: entity2Id,
        to: entity3Id,
        type: 'relatedTo'
      })
      
      await brain.relate({
        from: entity3Id,
        to: entity1Id,
        type: 'relatedTo'
      })
      
      // Assert - All relationships should exist
      const rel1 = await brain.getRelations({ from: entity1Id })
      const rel2 = await brain.getRelations({ from: entity2Id })
      const rel3 = await brain.getRelations({ from: entity3Id })
      
      expect(rel1.some(r => r.to === entity2Id)).toBe(true)
      expect(rel2.some(r => r.to === entity3Id)).toBe(true)
      expect(rel3.some(r => r.to === entity1Id)).toBe(true)
    })
  })
})