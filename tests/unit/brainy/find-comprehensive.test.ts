import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { NounType, VerbType } from '../../../src/types/graphTypes'
import { createAddParams } from '../../helpers/test-factory'

/**
 * COMPREHENSIVE FIND() API TEST SUITE
 *
 * This test suite thoroughly validates ALL find() functionality:
 * 1. Vector search (semantic)
 * 2. Metadata filtering
 * 3. Graph traversal (connected)
 * 4. Proximity search (near)
 * 5. Fusion scoring
 * 6. Pagination
 * 7. Type filtering
 * 8. Service filtering (multi-tenancy)
 * 9. Empty queries
 * 10. Complex combinations
 * 11. Performance characteristics
 * 12. Error handling
 * 13. Edge cases
 */

describe('Brainy.find() - Comprehensive Test Suite', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
  })

  afterAll(async () => {
    if (brain) await brain.close()
  })

  describe('1. Vector Search (Semantic)', () => {
    it('should find entities by text query', async () => {
      // Setup test data
      const jsId = await brain.add({
        data: 'JavaScript is a programming language for web development',
        type: NounType.Concept,
        metadata: { category: 'technology' }
      })

      const pythonId = await brain.add({
        data: 'Python is a programming language for data science',
        type: NounType.Concept,
        metadata: { category: 'technology' }
      })

      const coffeeId = await brain.add({
        data: 'Coffee is a popular beverage',
        type: NounType.Thing,
        metadata: { category: 'food' }
      })

      // Test semantic search
      const results = await brain.find({
        query: 'programming languages',
        limit: 10
      })

      // Verify results
      expect(results.length).toBeGreaterThanOrEqual(2)
      const ids = results.map(r => r.entity.id)
      expect(ids).toContain(jsId)
      expect(ids).toContain(pythonId)

      // Coffee should have lower score or not be included
      const coffeeResult = results.find(r => r.entity.id === coffeeId)
      if (coffeeResult) {
        expect(coffeeResult.score).toBeLessThan(results[0].score)
      }
    })

    it('should find by pre-computed vector', async () => {
      // Add entity with known vector
      const testVector = new Array(384).fill(0).map((_, i) => Math.sin(i * 0.1))
      const id = await brain.add({
        data: 'Test entity',
        type: NounType.Thing,
        vector: testVector
      })

      // Search with similar vector
      const searchVector = new Array(384).fill(0).map((_, i) => Math.sin(i * 0.1 + 0.01))
      const results = await brain.find({
        vector: searchVector,
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].entity.id).toBe(id)
      expect(results[0].score).toBeGreaterThan(0.9) // Very similar vectors
    })

    it('should respect threshold parameter', async () => {
      // Add diverse entities
      await brain.add({ data: 'Apple fruit', type: NounType.Thing })
      await brain.add({ data: 'Orange fruit', type: NounType.Thing })
      await brain.add({ data: 'Computer technology', type: NounType.Thing })

      // Search with high threshold
      const highThreshold = await brain.find({
        query: 'fruit',
        threshold: 0.8,
        limit: 10
      })

      // Search with low threshold
      const lowThreshold = await brain.find({
        query: 'fruit',
        threshold: 0.3,
        limit: 10
      })

      expect(highThreshold.length).toBeLessThanOrEqual(lowThreshold.length)
      highThreshold.forEach(r => expect(r.score).toBeGreaterThanOrEqual(0.8))
    })
  })

  describe('2. Metadata Filtering', () => {
    it('should filter by simple metadata', async () => {
      const activeId = await brain.add({
        data: 'Active document',
        type: NounType.Document,
        metadata: { status: 'active', priority: 'high' }
      })

      const inactiveId = await brain.add({
        data: 'Inactive document',
        type: NounType.Document,
        metadata: { status: 'inactive', priority: 'low' }
      })

      // Filter by status
      const activeResults = await brain.find({
        where: { status: 'active' },
        limit: 10
      })

      expect(activeResults.some(r => r.entity.id === activeId)).toBe(true)
      expect(activeResults.some(r => r.entity.id === inactiveId)).toBe(false)
    })

    it('should filter by complex metadata conditions', async () => {
      // Add test entities with various metadata
      const entity1 = await brain.add({
        data: 'Entity 1',
        type: NounType.Thing,
        metadata: { age: 25, city: 'New York', active: true }
      })

      const entity2 = await brain.add({
        data: 'Entity 2',
        type: NounType.Thing,
        metadata: { age: 35, city: 'Los Angeles', active: true }
      })

      const entity3 = await brain.add({
        data: 'Entity 3',
        type: NounType.Thing,
        metadata: { age: 30, city: 'New York', active: false }
      })

      // Complex filter: active AND from New York
      const results = await brain.find({
        where: { city: 'New York', active: true },
        limit: 10
      })

      expect(results.length).toBe(1)
      expect(results[0].entity.id).toBe(entity1)
    })

    it('should combine metadata filter with text search', async () => {
      await brain.add({
        data: 'JavaScript tutorial',
        type: NounType.Document,
        metadata: { language: 'en', difficulty: 'beginner' }
      })

      const advancedJsId = await brain.add({
        data: 'JavaScript advanced patterns',
        type: NounType.Document,
        metadata: { language: 'en', difficulty: 'advanced' }
      })

      await brain.add({
        data: 'Python tutorial',
        type: NounType.Document,
        metadata: { language: 'en', difficulty: 'beginner' }
      })

      // Search for JavaScript AND advanced
      const results = await brain.find({
        query: 'JavaScript',
        where: { difficulty: 'advanced' },
        limit: 10
      })

      expect(results.length).toBe(1)
      expect(results[0].entity.id).toBe(advancedJsId)
    })
  })

  describe('3. Graph Traversal (connected)', () => {
    it('should find connected entities at depth 1', async () => {
      // Create a simple graph
      const personId = await brain.add({
        data: 'John Doe',
        type: NounType.Person
      })

      const companyId = await brain.add({
        data: 'TechCorp',
        type: NounType.Organization
      })

      const projectId = await brain.add({
        data: 'Project Alpha',
        type: NounType.Project
      })

      // Create relationships
      await brain.relate({
        from: personId,
        to: companyId,
        type: VerbType.MemberOf
      })

      await brain.relate({
        from: companyId,
        to: projectId,
        type: VerbType.Owns
      })

      // Find entities connected to person
      const results = await brain.find({
        connected: { from: personId, depth: 1 },
        limit: 10
      })

      expect(results.some(r => r.entity.id === companyId)).toBe(true)
      expect(results.some(r => r.entity.id === projectId)).toBe(false) // Depth 2
    })

    it('should traverse graph at multiple depths', async () => {
      // Create a deeper graph
      const aId = await brain.add({ data: 'Node A', type: NounType.Thing })
      const bId = await brain.add({ data: 'Node B', type: NounType.Thing })
      const cId = await brain.add({ data: 'Node C', type: NounType.Thing })
      const dId = await brain.add({ data: 'Node D', type: NounType.Thing })

      // Create chain: A -> B -> C -> D
      await brain.relate({ from: aId, to: bId, type: VerbType.ConnectedTo })
      await brain.relate({ from: bId, to: cId, type: VerbType.ConnectedTo })
      await brain.relate({ from: cId, to: dId, type: VerbType.ConnectedTo })

      // Test different depths
      const depth1 = await brain.find({
        connected: { from: aId, depth: 1 },
        limit: 10
      })

      const depth2 = await brain.find({
        connected: { from: aId, depth: 2 },
        limit: 10
      })

      const depth3 = await brain.find({
        connected: { from: aId, depth: 3 },
        limit: 10
      })

      expect(depth1.some(r => r.entity.id === bId)).toBe(true)
      expect(depth1.some(r => r.entity.id === cId)).toBe(false)

      expect(depth2.some(r => r.entity.id === cId)).toBe(true)
      expect(depth2.some(r => r.entity.id === dId)).toBe(false)

      expect(depth3.some(r => r.entity.id === dId)).toBe(true)
    })

    it('should filter by relationship type', async () => {
      const personId = await brain.add({ data: 'Person', type: NounType.Person })
      const friendId = await brain.add({ data: 'Friend', type: NounType.Person })
      const colleagueId = await brain.add({ data: 'Colleague', type: NounType.Person })

      await brain.relate({ from: personId, to: friendId, type: VerbType.FriendOf })
      await brain.relate({ from: personId, to: colleagueId, type: VerbType.WorksWith })

      // Find only friends
      const friends = await brain.find({
        connected: { from: personId, type: VerbType.FriendOf },
        limit: 10
      })

      expect(friends.some(r => r.entity.id === friendId)).toBe(true)
      expect(friends.some(r => r.entity.id === colleagueId)).toBe(false)
    })
  })

  describe('4. Proximity Search (near)', () => {
    it('should find entities near a specific ID', async () => {
      // Create entities with similar content
      const centralId = await brain.add({
        data: 'Machine learning algorithms',
        type: NounType.Concept
      })

      const nearbyId = await brain.add({
        data: 'Deep learning neural networks',
        type: NounType.Concept
      })

      const farId = await brain.add({
        data: 'Cooking pasta recipes',
        type: NounType.Thing
      })

      // Find entities near the central one
      const results = await brain.find({
        near: centralId,
        radius: 0.5,
        limit: 10
      })

      expect(results.some(r => r.entity.id === nearbyId)).toBe(true)
      // Far entity might not be included or have low score
      const farResult = results.find(r => r.entity.id === farId)
      if (farResult) {
        expect(farResult.score).toBeLessThan(0.5)
      }
    })

    it('should respect radius parameter', async () => {
      const centerId = await brain.add({ data: 'Center point', type: NounType.Thing })

      // Add entities at various distances
      for (let i = 0; i < 10; i++) {
        await brain.add({
          data: `Entity at distance ${i}`,
          type: NounType.Thing
        })
      }

      // Small radius
      const smallRadius = await brain.find({
        near: centerId,
        radius: 0.2,
        limit: 20
      })

      // Large radius
      const largeRadius = await brain.find({
        near: centerId,
        radius: 0.8,
        limit: 20
      })

      expect(smallRadius.length).toBeLessThanOrEqual(largeRadius.length)
    })
  })

  describe('5. Fusion Scoring', () => {
    it('should combine multiple signals with fusion', async () => {
      // Create entity with multiple matching signals
      const perfectMatchId = await brain.add({
        data: 'JavaScript programming',
        type: NounType.Concept,
        metadata: { language: 'JavaScript', category: 'programming' }
      })

      const partialMatchId = await brain.add({
        data: 'Python coding',
        type: NounType.Concept,
        metadata: { language: 'Python', category: 'programming' }
      })

      // Search with fusion
      const results = await brain.find({
        query: 'JavaScript',
        where: { category: 'programming' },
        fusion: {
          weights: {
            vector: 0.6,
            metadata: 0.4
          }
        },
        limit: 10
      })

      // Perfect match should score highest
      expect(results[0].entity.id).toBe(perfectMatchId)
      expect(results[0].score).toBeGreaterThan(results[1]?.score || 0)
    })

    it('should support different fusion strategies', async () => {
      const id1 = await brain.add({
        data: 'Multi-signal entity',
        type: NounType.Thing,
        metadata: { score1: 10, score2: 5 }
      })

      const id2 = await brain.add({
        data: 'Another entity',
        type: NounType.Thing,
        metadata: { score1: 5, score2: 10 }
      })

      // Test different fusion strategies
      const linearFusion = await brain.find({
        query: 'entity',
        fusion: {
          strategy: 'linear',
          weights: { vector: 0.5, metadata: 0.5 }
        },
        limit: 10
      })

      const reciprocalFusion = await brain.find({
        query: 'entity',
        fusion: {
          strategy: 'reciprocal_rank'
        },
        limit: 10
      })

      // Both should return results
      expect(linearFusion.length).toBeGreaterThan(0)
      expect(reciprocalFusion.length).toBeGreaterThan(0)
    })
  })

  describe('6. Type Filtering', () => {
    it('should filter by single noun type', async () => {
      const personId = await brain.add({
        data: 'John Smith',
        type: NounType.Person
      })

      const docId = await brain.add({
        data: 'Document about John',
        type: NounType.Document
      })

      const results = await brain.find({
        type: NounType.Person,
        limit: 10
      })

      expect(results.some(r => r.entity.id === personId)).toBe(true)
      expect(results.some(r => r.entity.id === docId)).toBe(false)
    })

    it('should filter by multiple noun types', async () => {
      const personId = await brain.add({ data: 'Person', type: NounType.Person })
      const placeId = await brain.add({ data: 'Place', type: NounType.Location })
      const thingId = await brain.add({ data: 'Thing', type: NounType.Thing })

      const results = await brain.find({
        type: [NounType.Person, NounType.Location],
        limit: 10
      })

      const ids = results.map(r => r.entity.id)
      expect(ids).toContain(personId)
      expect(ids).toContain(placeId)
      expect(ids).not.toContain(thingId)
    })
  })

  describe('7. Service Filtering (Multi-tenancy)', () => {
    it('should isolate data by service', async () => {
      const service1Id = await brain.add({
        data: 'Service 1 data',
        type: NounType.Thing,
        service: 'service1'
      })

      const service2Id = await brain.add({
        data: 'Service 2 data',
        type: NounType.Thing,
        service: 'service2'
      })

      const globalId = await brain.add({
        data: 'Global data',
        type: NounType.Thing
        // No service specified
      })

      // Query for service1
      const service1Results = await brain.find({
        service: 'service1',
        limit: 10
      })

      expect(service1Results.some(r => r.entity.id === service1Id)).toBe(true)
      expect(service1Results.some(r => r.entity.id === service2Id)).toBe(false)
    })
  })

  describe('8. Pagination', () => {
    it('should paginate results correctly', async () => {
      // Add 20 entities
      const ids: string[] = []
      for (let i = 0; i < 20; i++) {
        const id = await brain.add({
          data: `Entity ${i}`,
          type: NounType.Thing,
          metadata: { index: i }
        })
        ids.push(id)
      }

      // Get first page
      const page1 = await brain.find({
        limit: 5,
        offset: 0
      })

      // Get second page
      const page2 = await brain.find({
        limit: 5,
        offset: 5
      })

      // Get third page
      const page3 = await brain.find({
        limit: 5,
        offset: 10
      })

      expect(page1.length).toBe(5)
      expect(page2.length).toBe(5)
      expect(page3.length).toBe(5)

      // No overlap between pages
      const page1Ids = page1.map(r => r.entity.id)
      const page2Ids = page2.map(r => r.entity.id)
      const page3Ids = page3.map(r => r.entity.id)

      expect(page1Ids.filter(id => page2Ids.includes(id))).toHaveLength(0)
      expect(page2Ids.filter(id => page3Ids.includes(id))).toHaveLength(0)
    })

    it('should handle cursor-based pagination', async () => {
      // Add entities
      for (let i = 0; i < 15; i++) {
        await brain.add({
          data: `Item ${i}`,
          type: NounType.Thing
        })
      }

      // Get first page with cursor
      const firstPage = await brain.find({
        limit: 5
      })

      expect(firstPage.length).toBe(5)

      // If cursor is supported
      if (firstPage[firstPage.length - 1]?.cursor) {
        const nextPage = await brain.find({
          limit: 5,
          cursor: firstPage[firstPage.length - 1].cursor
        })

        expect(nextPage.length).toBe(5)
        // Verify no overlap
        const firstIds = firstPage.map(r => r.entity.id)
        const nextIds = nextPage.map(r => r.entity.id)
        expect(firstIds.filter(id => nextIds.includes(id))).toHaveLength(0)
      }
    })
  })

  describe('9. Complex Combinations', () => {
    it('should combine text search + metadata + graph', async () => {
      // Setup complex scenario
      const jsPersonId = await brain.add({
        data: 'JavaScript Developer',
        type: NounType.Person,
        metadata: { skill: 'JavaScript', level: 'senior' }
      })

      const pyPersonId = await brain.add({
        data: 'Python Developer',
        type: NounType.Person,
        metadata: { skill: 'Python', level: 'senior' }
      })

      const companyId = await brain.add({
        data: 'Tech Company',
        type: NounType.Organization
      })

      // Create relationships
      await brain.relate({ from: jsPersonId, to: companyId, type: VerbType.MemberOf })
      await brain.relate({ from: pyPersonId, to: companyId, type: VerbType.MemberOf })

      // Complex query: JavaScript + senior + connected to company
      const results = await brain.find({
        query: 'JavaScript',
        where: { level: 'senior' },
        connected: { to: companyId },
        limit: 10
      })

      expect(results.length).toBe(1)
      expect(results[0].entity.id).toBe(jsPersonId)
    })

    it('should handle all parameters simultaneously', async () => {
      // Setup comprehensive test data
      const centralId = await brain.add({
        data: 'Central AI concept',
        type: NounType.Concept,
        metadata: { field: 'AI', importance: 'high' },
        service: 'research'
      })

      const relatedId = await brain.add({
        data: 'Machine learning algorithms',
        type: NounType.Concept,
        metadata: { field: 'AI', importance: 'high' },
        service: 'research'
      })

      await brain.relate({ from: centralId, to: relatedId, type: VerbType.RelatedTo })

      // Use ALL parameters
      const results = await brain.find({
        query: 'AI',                           // Text search
        type: NounType.Concept,                // Type filter
        where: { field: 'AI' },                // Metadata filter
        service: 'research',                   // Service filter
        near: centralId,                       // Proximity search
        radius: 0.8,                          // Proximity radius
        connected: { from: centralId },        // Graph search
        fusion: {                             // Fusion scoring
          strategy: 'linear',
          weights: { vector: 0.5, graph: 0.5 }
        },
        threshold: 0.3,                       // Score threshold
        limit: 10,                            // Pagination
        offset: 0
      })

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].entity.id).toBe(relatedId)
    })
  })

  describe('10. Performance Characteristics', () => {
    it('should handle large result sets efficiently', async () => {
      // Add many entities
      const startAdd = Date.now()
      for (let i = 0; i < 100; i++) {
        await brain.add({
          data: `Entity ${i} with some content`,
          type: NounType.Thing,
          metadata: { index: i }
        })
      }
      const addTime = Date.now() - startAdd

      // Search should be fast even with many entities
      const startSearch = Date.now()
      const results = await brain.find({
        query: 'content',
        limit: 50
      })
      const searchTime = Date.now() - startSearch

      expect(results.length).toBeLessThanOrEqual(50)
      expect(searchTime).toBeLessThan(1000) // Should be under 1 second

      // Log performance for monitoring
      console.log(`Added 100 entities in ${addTime}ms`)
      console.log(`Searched in ${searchTime}ms`)
    })

    it('should optimize empty queries', async () => {
      // Add entities
      for (let i = 0; i < 50; i++) {
        await brain.add({
          data: `Item ${i}`,
          type: NounType.Thing
        })
      }

      // Empty query should be fast (no vector computation)
      const start = Date.now()
      const results = await brain.find({
        limit: 20
      })
      const duration = Date.now() - start

      expect(results.length).toBe(20)
      expect(duration).toBeLessThan(100) // Very fast for empty query
    })
  })

  describe('11. Error Handling', () => {
    it('should handle invalid parameters gracefully', async () => {
      // Negative limit
      await expect(brain.find({ limit: -1 })).rejects.toThrow()

      // Invalid threshold
      await expect(brain.find({ threshold: 1.5 })).rejects.toThrow()

      // Both query and vector
      await expect(brain.find({
        query: 'test',
        vector: [1, 2, 3]
      })).rejects.toThrow()
    })

    it('should handle non-existent entity references', async () => {
      // Near non-existent ID
      const results = await brain.find({
        near: 'non-existent-id',
        limit: 10
      })

      expect(results).toEqual([])

      // Connected to non-existent ID
      const connectedResults = await brain.find({
        connected: { from: 'non-existent-id' },
        limit: 10
      })

      expect(connectedResults).toEqual([])
    })

    it('should handle storage errors gracefully', async () => {
      // This would require mocking storage to throw errors
      // For now, just ensure the method handles edge cases

      // Empty database
      const emptyResults = await brain.find({
        query: 'anything',
        limit: 10
      })

      expect(emptyResults).toEqual([])
    })
  })

  describe('12. Edge Cases', () => {
    it('should handle special characters in queries', async () => {
      const id = await brain.add({
        data: 'Special chars: !@#$%^&*()',
        type: NounType.Thing
      })

      const results = await brain.find({
        query: '!@#$%^&*()',
        limit: 10
      })

      expect(results.some(r => r.entity.id === id)).toBe(true)
    })

    it('should handle very long queries', async () => {
      const longText = 'Lorem ipsum '.repeat(100)
      const id = await brain.add({
        data: longText,
        type: NounType.Document
      })

      const results = await brain.find({
        query: longText.substring(0, 500), // Use part of long text
        limit: 10
      })

      expect(results.some(r => r.entity.id === id)).toBe(true)
    })

    it('should handle unicode and emojis', async () => {
      const id = await brain.add({
        data: 'Unicode test: 你好世界 🌍🚀',
        type: NounType.Thing
      })

      const results = await brain.find({
        query: '你好世界',
        limit: 10
      })

      expect(results.some(r => r.entity.id === id)).toBe(true)
    })

    it('should handle concurrent searches', async () => {
      // Add test data
      for (let i = 0; i < 10; i++) {
        await brain.add({
          data: `Concurrent test ${i}`,
          type: NounType.Thing
        })
      }

      // Execute multiple searches concurrently
      const searches = Array(5).fill(null).map((_, i) =>
        brain.find({
          query: `test ${i}`,
          limit: 5
        })
      )

      const results = await Promise.all(searches)

      // All searches should complete
      expect(results.length).toBe(5)
      results.forEach(r => {
        expect(r).toBeDefined()
        expect(Array.isArray(r)).toBe(true)
      })
    })
  })

  describe('13. Augmentation Integration', () => {
    it('should work with augmentations applied', async () => {
      // Add augmentation that modifies find results
      // This would require augmentation setup

      // For now, ensure find works with default augmentations
      const id = await brain.add({
        data: 'Augmented entity',
        type: NounType.Thing
      })

      const results = await brain.find({
        query: 'augmented',
        limit: 10
      })

      expect(results.some(r => r.entity.id === id)).toBe(true)
    })
  })

  describe('14. Consistency and Reliability', () => {
    it('should return consistent results for same query', async () => {
      // Add test data
      for (let i = 0; i < 5; i++) {
        await brain.add({
          data: `Consistency test ${i}`,
          type: NounType.Thing
        })
      }

      // Run same query multiple times
      const results1 = await brain.find({ query: 'consistency', limit: 5 })
      const results2 = await brain.find({ query: 'consistency', limit: 5 })
      const results3 = await brain.find({ query: 'consistency', limit: 5 })

      // Results should be consistent
      expect(results1.length).toBe(results2.length)
      expect(results2.length).toBe(results3.length)

      // Order should be consistent (by score)
      const ids1 = results1.map(r => r.entity.id)
      const ids2 = results2.map(r => r.entity.id)
      expect(ids1).toEqual(ids2)
    })

    it('should maintain data integrity during updates', async () => {
      const id = await brain.add({
        data: 'Original content',
        type: NounType.Thing,
        metadata: { version: 1 }
      })

      // Search before update
      const before = await brain.find({ query: 'original', limit: 10 })
      expect(before.some(r => r.entity.id === id)).toBe(true)

      // Update entity
      await brain.update({
        id,
        data: 'Updated content',
        metadata: { version: 2 }
      })

      // Search after update
      const afterOriginal = await brain.find({ query: 'original', limit: 10 })
      const afterUpdated = await brain.find({ query: 'updated', limit: 10 })

      // Should not find with old content
      expect(afterOriginal.some(r => r.entity.id === id)).toBe(false)
      // Should find with new content
      expect(afterUpdated.some(r => r.entity.id === id)).toBe(true)
    })
  })
})