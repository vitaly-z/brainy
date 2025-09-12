import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { createAddParams } from '../../helpers/test-factory'
import { NounType } from '../../../src/types/graphTypes'

describe('Brainy.find()', () => {
  let brain: Brainy<any>
  
  beforeEach(async () => {
    brain = new Brainy()
    await brain.init()
  })
  
  describe('success paths', () => {
    it('should find entities by text query', async () => {
      // Arrange
      const entity1 = await brain.add(createAddParams({
        data: 'JavaScript programming language',
        metadata: { category: 'tech' }
      }))
      
      const entity2 = await brain.add(createAddParams({
        data: 'Python programming language',
        metadata: { category: 'tech' }
      }))
      
      await brain.add(createAddParams({
        data: 'Coffee brewing techniques',
        metadata: { category: 'food' }
      }))
      
      // Act
      const results = await brain.find({
        query: 'programming language',
        limit: 10
      })
      
      // Assert
      expect(results.length).toBeGreaterThanOrEqual(2)
      const ids = results.map(r => r.entity.id)
      expect(ids).toContain(entity1)
      expect(ids).toContain(entity2)
    })
    
    it('should find entities with metadata filter', async () => {
      // Arrange
      await brain.add(createAddParams({
        data: 'Entity 1',
        metadata: { category: 'A', status: 'active' }
      }))
      
      const entity2 = await brain.add(createAddParams({
        data: 'Entity 2',
        metadata: { category: 'B', status: 'active' }
      }))
      
      const entity3 = await brain.add(createAddParams({
        data: 'Entity 3',
        metadata: { category: 'B', status: 'inactive' }
      }))
      
      // Act
      const results = await brain.find({
        query: 'Entity',
        where: { category: 'B' },
        limit: 10
      })
      
      // Assert
      expect(results.length).toBe(2)
      const ids = results.map(r => r.entity.id)
      expect(ids).toContain(entity2)
      expect(ids).toContain(entity3)
    })
    
    it('should respect limit parameter', async () => {
      // Arrange - Add many entities
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => 
          brain.add(createAddParams({
            data: `Test entity number ${i}`,
            metadata: { index: i }
          }))
        )
      )
      
      // Act
      const results = await brain.find({
        query: 'Test entity',
        limit: 5
      })
      
      // Assert
      expect(results.length).toBe(5)
    })
    
    it('should respect offset parameter for pagination', async () => {
      // Arrange
      const ids = await Promise.all(
        Array.from({ length: 10 }, (_, i) => 
          brain.add(createAddParams({
            data: `Same content`,
            metadata: { order: i }
          }))
        )
      )
      
      // Act
      const page1 = await brain.find({
        query: 'Same content',
        limit: 5,
        offset: 0
      })
      
      const page2 = await brain.find({
        query: 'Same content',
        limit: 5,
        offset: 5
      })
      
      // Assert
      expect(page1.length).toBe(5)
      expect(page2.length).toBe(5)
      
      // Pages should have different entities
      const page1Ids = page1.map(r => r.entity.id)
      const page2Ids = page2.map(r => r.entity.id)
      const overlap = page1Ids.filter(id => page2Ids.includes(id))
      expect(overlap.length).toBe(0)
    })
    
    it('should include relevance scores', async () => {
      // Arrange
      await brain.add(createAddParams({
        data: 'Exact match: machine learning',
        metadata: { exact: true }
      }))
      
      await brain.add(createAddParams({
        data: 'Partial: machine',
        metadata: { partial: true }
      }))
      
      await brain.add(createAddParams({
        data: 'Unrelated: cooking recipes',
        metadata: { unrelated: true }
      }))
      
      // Act
      const results = await brain.find({
        query: 'machine learning',
        limit: 10
      })
      
      // Assert
      expect(results.length).toBeGreaterThan(0)
      results.forEach(r => {
        expect(r.score).toBeDefined()
        expect(r.score).toBeGreaterThanOrEqual(0)
        expect(r.score).toBeLessThanOrEqual(1)
      })
      
      // Higher relevance should have higher scores
      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
      }
    })
    
    it('should filter by entity type', async () => {
      // Arrange
      const personId = await brain.add(createAddParams({
        data: 'John Doe',
        type: NounType.Person,
        metadata: { role: 'developer' }
      }))
      
      const placeId = await brain.add(createAddParams({
        data: 'New York City',
        type: NounType.Location,
        metadata: { country: 'USA' }
      }))
      
      await brain.add(createAddParams({
        data: 'Apple Inc',
        type: NounType.Organization,
        metadata: { industry: 'tech' }
      }))
      
      // Act
      const peopleResults = await brain.find({
        query: '',
        type: NounType.Person,
        limit: 10
      })
      
      const placeResults = await brain.find({
        query: '',
        type: NounType.Location,
        limit: 10
      })
      
      // Assert
      expect(peopleResults.some(r => r.entity.id === personId)).toBe(true)
      expect(peopleResults.some(r => r.entity.id === placeId)).toBe(false)
      
      expect(placeResults.some(r => r.entity.id === placeId)).toBe(true)
      expect(placeResults.some(r => r.entity.id === personId)).toBe(false)
    })
    
    it('should find by multiple types', async () => {
      // Arrange
      const personId = await brain.add(createAddParams({
        data: 'Alice',
        type: NounType.Person
      }))
      
      const eventId = await brain.add(createAddParams({
        data: 'Conference',
        type: NounType.Event
      }))
      
      await brain.add(createAddParams({
        data: 'Document',
        type: NounType.Document
      }))
      
      // Act
      const results = await brain.find({
        query: '',
        type: [NounType.Person, NounType.Event],
        limit: 10
      })
      
      // Assert
      const ids = results.map(r => r.entity.id)
      expect(ids).toContain(personId)
      expect(ids).toContain(eventId)
      
      // Should not contain other types
      const types = results.map(r => r.entity.type)
      expect(types.every(t => t === NounType.Person || t === NounType.Event)).toBe(true)
    })
  })
  
  describe('error paths', () => {
    it('should handle empty query', async () => {
      // Arrange
      await brain.add(createAddParams({ data: 'Test entity' }))
      
      // Act
      const results = await brain.find({
        query: '',
        limit: 10
      })
      
      // Assert - Should return all entities
      expect(results.length).toBeGreaterThan(0)
    })
    
    it('should handle query with no matches', async () => {
      // Arrange
      await brain.add(createAddParams({ data: 'Apple' }))
      await brain.add(createAddParams({ data: 'Banana' }))
      
      // Act
      const results = await brain.find({
        query: 'Xylophones and Zebras',
        limit: 10
      })
      
      // Assert - May return results with low scores
      expect(Array.isArray(results)).toBe(true)
    })
    
    it('should handle invalid parameters', async () => {
      // Act & Assert
      await expect(brain.find({
        query: 'test',
        limit: -1
      } as any)).rejects.toThrow()
      
      await expect(brain.find({
        query: 'test',
        offset: -1
      } as any)).rejects.toThrow()
    })
  })
  
  describe('edge cases', () => {
    it('should handle very long queries', async () => {
      // Arrange
      await brain.add(createAddParams({ data: 'Short text' }))
      
      const longQuery = 'Lorem ipsum '.repeat(100)
      
      // Act - Should not throw
      const results = await brain.find({
        query: longQuery,
        limit: 10
      })
      
      // Assert
      expect(Array.isArray(results)).toBe(true)
    })
    
    it('should handle special characters in query', async () => {
      // Arrange
      await brain.add(createAddParams({
        data: 'Email: user@example.com'
      }))
      
      // Act
      const results = await brain.find({
        query: 'user@example.com',
        limit: 10
      })
      
      // Assert
      expect(results.length).toBeGreaterThan(0)
    })
    
    it('should handle unicode in queries', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: '你好世界 Hello World'
      }))
      
      // Act
      const results = await brain.find({
        query: '你好',
        limit: 10
      })
      
      // Assert
      expect(results.some(r => r.entity.id === id)).toBe(true)
    })
    
    it('should handle concurrent searches', async () => {
      // Arrange
      await Promise.all(
        Array.from({ length: 10 }, (_, i) => 
          brain.add(createAddParams({ data: `Entity ${i}` }))
        )
      )
      
      // Act - Run multiple searches concurrently
      const searches = Array.from({ length: 5 }, () => 
        brain.find({
          query: 'Entity',
          limit: 5
        })
      )
      
      const results = await Promise.all(searches)
      
      // Assert
      results.forEach(r => {
        expect(r.length).toBeGreaterThan(0)
        expect(r.length).toBeLessThanOrEqual(5)
      })
    })
  })
  
  describe('performance', () => {
    it('should search quickly', async () => {
      // Arrange
      await brain.add(createAddParams({ data: 'Searchable content' }))
      
      // Act
      const start = Date.now()
      await brain.find({
        query: 'Searchable',
        limit: 10
      })
      const duration = Date.now() - start
      
      // Assert
      expect(duration).toBeLessThan(100)
    })
    
    it('should handle large result sets efficiently', async () => {
      // Arrange - Add many entities
      await Promise.all(
        Array.from({ length: 100 }, (_, i) => 
          brain.add(createAddParams({ data: `Entity ${i}` }))
        )
      )
      
      // Act - Use empty query to test pagination performance on large dataset
      const start = Date.now()
      const results = await brain.find({
        limit: 50
      })
      const duration = Date.now() - start
      
      // Assert
      expect(results.length).toBe(50)
      expect(duration).toBeLessThan(500)
    })
  })
  
  describe('integration', () => {
    it('should work with complex filters', async () => {
      // Arrange
      const target = await brain.add(createAddParams({
        data: 'Target entity',
        type: NounType.Document,
        metadata: {
          status: 'published',
          category: 'tech',
          priority: 'high'
        }
      }))
      
      await brain.add(createAddParams({
        data: 'Other entity',
        type: NounType.Document,
        metadata: {
          status: 'draft',
          category: 'tech',
          priority: 'high'
        }
      }))
      
      // Act
      const results = await brain.find({
        query: '',
        type: NounType.Document,
        where: {
          status: 'published',
          category: 'tech'
        },
        limit: 10
      })
      
      // Assert
      expect(results.some(r => r.entity.id === target)).toBe(true)
      expect(results.every(r => 
        r.entity.metadata.status === 'published' &&
        r.entity.metadata.category === 'tech'
      )).toBe(true)
    })
    
    it('should maintain consistency after updates', async () => {
      // Arrange
      const id = await brain.add(createAddParams({
        data: 'Original content',
        metadata: { version: 1 }
      }))
      
      // Search before update
      const before = await brain.find({ query: 'Original' })
      expect(before.some(r => r.entity.id === id)).toBe(true)
      
      // Act - Update entity
      await brain.update({
        id,
        data: 'Updated content',
        metadata: { version: 2 },
        merge: false
      })
      
      // Assert - Should find with new content
      const afterNew = await brain.find({ query: 'Updated' })
      expect(afterNew.some(r => r.entity.id === id)).toBe(true)
      
      // Should not find with old content (vector changed)
      const afterOld = await brain.find({ query: 'Original' })
      // Score should be lower if found at all
      const oldMatch = afterOld.find(r => r.entity.id === id)
      if (oldMatch) {
        const newMatch = afterNew.find(r => r.entity.id === id)!
        expect(oldMatch.score).toBeLessThan(newMatch.score)
      }
    })
  })
})