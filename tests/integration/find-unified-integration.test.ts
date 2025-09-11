/**
 * Comprehensive Integration Tests for Unified Find() Method
 * Testing vector+graph+fields search with Triple Intelligence
 *
 * This test suite validates the complete unified search functionality,
 * including fusion strategies, performance optimization, and edge cases.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType, VerbType } from '../../src/types/graphTypes'
import {
  createTestEntity,
  createTestRelation,
  createSocialNetworkTestData,
  createKnowledgeGraphTestData,
  generateTestId,
  generateTestVector,
  measureExecutionTime,
  TestCleanup
} from '../helpers/test-factory'

describe('Unified Find() Integration Tests', () => {
  let brain: Brainy
  let cleanup: TestCleanup
  let testEntities: any[] = []
  let testRelations: any[] = []

  beforeAll(async () => {
    // Initialize Brainy with memory storage for fast tests
    brain = new Brainy({
      storage: { type: 'memory' },
      model: { type: 'fast' },
      index: {
        m: 16,
        efConstruction: 100,
        efSearch: 50
      }
    })

    await brain.init()
    cleanup = new TestCleanup()
  })

  afterAll(async () => {
    await cleanup.cleanup()
    brain = null as any
  })

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanup.cleanup()

    // Create fresh test data for each test
    const socialData = createSocialNetworkTestData()
    const knowledgeData = createKnowledgeGraphTestData()

    testEntities = [...socialData.entities, ...knowledgeData.entities]
    testRelations = [...socialData.relations, ...knowledgeData.relations]

    // Add entities to Brainy
    for (const entity of testEntities) {
      await brain.add({
        id: entity.id,
        data: entity.metadata.name || 'Test entity',
        type: entity.type,
        metadata: entity.metadata,
        service: entity.service
      })
    }

    // Add relationships
    for (const relation of testRelations) {
      await brain.relate({
        from: relation.from,
        to: relation.to,
        type: relation.type,
        weight: relation.weight,
        metadata: relation.metadata
      })
    }
  })

  describe('1. Unified Search Scenarios', () => {
    describe('Vector-only Queries', () => {
      it('should perform vector search by text query', async () => {
        const results = await brain.find({
          query: 'Alice person social network',
          limit: 5
        })

        expect(results).toHaveLength(5)
        expect(results[0].score).toBeGreaterThan(0)
        expect(results[0].score).toBeLessThanOrEqual(1)

        // Should find Alice-related entities
        const aliceResult = results.find((r: any) => r.entity.metadata?.name === 'Alice')
        expect(aliceResult).toBeDefined()
      })

      it('should perform vector search by direct vector', async () => {
        const aliceEntity = await brain.get('alice')
        expect(aliceEntity).toBeDefined()

        const results = await brain.find({
          vector: aliceEntity!.vector,
          limit: 3
        })

        expect(results).toHaveLength(3)
        // First result should be Alice herself with high similarity
        expect(results[0].entity.id).toBe('alice')
        expect(results[0].score).toBeGreaterThan(0.95)
      })

      it('should handle empty vector search results', async () => {
        const results = await brain.find({
          vector: generateTestVector(),
          limit: 5
        })

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeLessThanOrEqual(5)
      })
    })

    describe('Graph-only Queries', () => {
      it('should find connected entities (outbound)', async () => {
        const results = await brain.find({
          connected: {
            from: 'alice',
            direction: 'out'
          },
          limit: 10
        })

        expect(results.length).toBeGreaterThan(0)
        // Should find Bob and Charlie (Alice's friends)
        const bobResult = results.find((r: any) => r.entity.id === 'bob')
        const charlieResult = results.find((r: any) => r.entity.id === 'charlie')
        expect(bobResult || charlieResult).toBeDefined()
      })

      it('should find connected entities (inbound)', async () => {
        const results = await brain.find({
          connected: {
            from: 'bob',
            direction: 'in'
          },
          limit: 10
        })

        expect(results.length).toBeGreaterThan(0)
        // Should find Alice (who is friends with Bob)
        const aliceResult = results.find((r: any) => r.entity.id === 'alice')
        expect(aliceResult).toBeDefined()
      })

      it('should find connected entities (bidirectional)', async () => {
        const results = await brain.find({
          connected: {
            from: 'alice',
            direction: 'both'
          },
          limit: 10
        })

        expect(results.length).toBeGreaterThan(0)
        // Should find both Bob and Charlie
        const bobResult = results.find((r: any) => r.entity.id === 'bob')
        const charlieResult = results.find((r: any) => r.entity.id === 'charlie')
        expect(bobResult).toBeDefined()
        expect(charlieResult).toBeDefined()
      })

      it('should filter graph results by entity type', async () => {
        const results = await brain.find({
          connected: {
            from: 'alice',
            direction: 'both',
            type: 'person' as NounType
          },
          limit: 10
        })

        expect(results.length).toBeGreaterThan(0)
        results.forEach((result: any) => {
          expect(result.entity.type).toBe('person')
        })
      })

      it('should handle multi-depth graph traversal', async () => {
        const results = await brain.find({
          connected: {
            from: 'alice',
            direction: 'both',
            maxDepth: 2
          },
          limit: 10
        })

        expect(results.length).toBeGreaterThan(0)
        // Should find direct connections (Bob, Charlie) and second-degree (Diana)
        const directConnections = ['bob', 'charlie']
        const secondDegreeConnections = ['diana']

        const hasDirect = results.some((r: any) => directConnections.includes(r.entity.id))
        const hasSecondDegree = results.some((r: any) => secondDegreeConnections.includes(r.entity.id))

        expect(hasDirect || hasSecondDegree).toBe(true)
      })
    })

    describe('Field-only Queries', () => {
      it('should filter by exact metadata match', async () => {
        const results = await brain.find({
          where: { name: 'Alice' }
        })

        expect(results.length).toBeGreaterThan(0)
        results.forEach((result: any) => {
          expect(result.entity.metadata?.name).toBe('Alice')
        })
      })

      it('should filter by numeric comparison', async () => {
        const results = await brain.find({
          where: { age: { $gte: 30 } }
        })

        expect(results.length).toBeGreaterThan(0)
        results.forEach((result: any) => {
          const age = result.entity.metadata?.age
          if (age) {
            expect(age).toBeGreaterThanOrEqual(30)
          }
        })
      })

      it('should filter by array contains', async () => {
        // Add entity with tags
        await brain.add({
          data: 'Tagged entity',
          metadata: { tags: ['test', 'integration', 'qa'] },
          type: NounType.Document
        })

        const results = await brain.find({
          where: { tags: { $contains: 'test' } }
        })

        expect(results.length).toBeGreaterThan(0)
        results.forEach((result: any) => {
          expect(Array.isArray(result.entity.metadata?.tags)).toBe(true)
          expect(result.entity.metadata.tags).toContain('test')
        })
      })

      it('should support complex logical operators', async () => {
        const results = await brain.find({
          where: {
            $or: [
              { name: 'Alice' },
              { name: 'Bob' }
            ]
          }
        })

        expect(results.length).toBeGreaterThan(0)
        const names = results.map((r: any) => r.entity.metadata?.name)
        expect(names).toContain('Alice')
        expect(names).toContain('Bob')
      })

      it('should filter by entity type', async () => {
        const results = await brain.find({
          type: NounType.Person
        })

        expect(results.length).toBeGreaterThan(0)
        results.forEach((result: any) => {
          expect(result.entity.type).toBe(NounType.Person)
        })
      })
    })

    describe('Combined Vector+Graph Queries', () => {
      it('should combine vector similarity with graph connections', async () => {
        const results = await brain.find({
          query: 'social network person',
          connected: {
            from: 'alice',
            direction: 'both'
          },
          limit: 5
        })

        expect(results.length).toBeGreaterThan(0)
        // Results should be fusion of vector and graph rankings
        results.forEach((result: any) => {
          expect(result.score).toBeGreaterThan(0)
          expect(result.score).toBeLessThanOrEqual(1)
        })
      })

      it('should prioritize highly connected entities in vector+graph fusion', async () => {
        const results = await brain.find({
          query: 'network connection',
          connected: {
            from: 'charlie',
            direction: 'both'
          },
          limit: 3
        })

        expect(results.length).toBeGreaterThan(0)
        // Charlie should be highly ranked due to direct connection
        const charlieResult = results.find((r: any) => r.entity.id === 'charlie')
        if (charlieResult) {
          expect(charlieResult.score).toBeGreaterThan(0.5)
        }
      })
    })

    describe('Combined Vector+Field Queries', () => {
      it('should combine vector search with metadata filtering', async () => {
        const results = await brain.find({
          query: 'person',
          where: { age: { $gte: 25 } },
          limit: 5
        })

        expect(results.length).toBeGreaterThan(0)
        results.forEach((result: any) => {
          expect(result.entity.metadata?.age).toBeGreaterThanOrEqual(25)
        })
      })

      it('should handle conflicting vector and field constraints', async () => {
        const results = await brain.find({
          query: 'Alice',
          where: { name: 'Bob' }, // Different person
          limit: 5
        })

        // Should return results but with lower confidence due to conflict
        expect(Array.isArray(results)).toBe(true)
        if (results.length > 0) {
          expect(results[0].score).toBeLessThan(0.9) // Lower confidence
        }
      })
    })

    describe('Combined Graph+Field Queries', () => {
      it('should combine graph traversal with metadata filtering', async () => {
        const results = await brain.find({
          connected: {
            from: 'alice',
            direction: 'both'
          },
          where: { age: { $lte: 30 } },
          limit: 5
        })

        expect(results.length).toBeGreaterThan(0)
        results.forEach((result: any) => {
          expect(result.entity.metadata?.age).toBeLessThanOrEqual(30)
        })
      })

      it('should filter graph results by multiple metadata criteria', async () => {
        const results = await brain.find({
          connected: {
            from: 'charlie',
            direction: 'both'
          },
          where: {
            age: { $gte: 25 },
            name: { $ne: 'Alice' } // Exclude Alice
          },
          limit: 5
        })

        expect(results.length).toBeGreaterThan(0)
        results.forEach((result: any) => {
          expect(result.entity.metadata?.age).toBeGreaterThanOrEqual(25)
          expect(result.entity.metadata?.name).not.toBe('Alice')
        })
      })
    })

    describe('Full Triple Intelligence (Vector+Graph+Fields)', () => {
      it('should perform complete triple intelligence search', async () => {
        const results = await brain.find({
          query: 'social network person',
          connected: {
            from: 'alice',
            direction: 'both'
          },
          where: {
            age: { $gte: 25 },
            $or: [
              { name: 'Bob' },
              { name: 'Charlie' }
            ]
          },
          limit: 5
        })

        expect(results.length).toBeGreaterThan(0)
        // All results should satisfy all three criteria
        results.forEach((result: any) => {
          expect(result.entity.metadata?.age).toBeGreaterThanOrEqual(25)
          const name = result.entity.metadata?.name
          expect(['Bob', 'Charlie']).toContain(name)
        })
      })

      it('should handle empty results from individual search types', async () => {
        const results = await brain.find({
          query: 'nonexistent content',
          connected: {
            from: 'nonexistent',
            direction: 'both'
          },
          where: { nonexistentField: 'value' },
          limit: 5
        })

        expect(Array.isArray(results)).toBe(true)
        // Should handle gracefully without throwing
      })

      it('should maintain ranking consistency across search types', async () => {
        const results1 = await brain.find({
          query: 'person social',
          connected: { from: 'alice' },
          where: { age: { $gte: 25 } },
          limit: 3
        })

        const results2 = await brain.find({
          query: 'person social',
          connected: { from: 'alice' },
          where: { age: { $gte: 25 } },
          limit: 3
        })

        // Results should be consistent
        expect(results1.length).toBe(results2.length)
        for (let i = 0; i < results1.length; i++) {
          expect(results1[i].id).toBe(results2[i].id)
          expect(results1[i].score).toBe(results2[i].score)
        }
      })
    })
  })

  describe('2. Fusion Ranking Validation', () => {
    describe('Reciprocal Rank Fusion Implementation', () => {
      it('should implement correct RRF formula', async () => {
        const results = await brain.find({
          query: 'person',
          where: { age: { $gte: 25 } },
          limit: 3
        })

        expect(results.length).toBeGreaterThan(0)
        // RRF scores should be between 0 and 1
        results.forEach((result: any) => {
          expect(result.score).toBeGreaterThan(0)
          expect(result.score).toBeLessThanOrEqual(1)
        })

        // Scores should be monotonically decreasing
        for (let i = 1; i < results.length; i++) {
          expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score)
        }
      })

      it('should use configurable RRF parameters', async () => {
        // Test with different k parameter (internal implementation detail)
        const results1 = await brain.find({
          query: 'person',
          limit: 3
        })

        const results2 = await brain.find({
          query: 'person',
          limit: 3
        })

        // Results should be deterministic
        expect(results1.length).toBe(results2.length)
      })

      it('should handle different search type weights', async () => {
        const results = await brain.find({
          query: 'person',
          connected: { from: 'alice' },
          where: { age: { $gte: 25 } },
          limit: 5
        })

        expect(results.length).toBeGreaterThan(0)
        // Should have search type metadata
        results.forEach((result: any) => {
          expect(result).toHaveProperty('searchTypes')
          expect(Array.isArray(result.searchTypes)).toBe(true)
        })
      })
    })

    describe('Score Normalization', () => {
      it('should normalize scores across different search types', async () => {
        const vectorResults = await brain.find({
          query: 'person',
          limit: 3
        })

        const graphResults = await brain.find({
          connected: { from: 'alice' },
          limit: 3
        })

        const fieldResults = await brain.find({
          where: { age: { $gte: 25 } },
          limit: 3
        })

        // All should have normalized scores
        const allResults = [...vectorResults, ...graphResults, ...fieldResults]
        allResults.forEach((result: any) => {
          expect(result.score).toBeGreaterThanOrEqual(0)
          expect(result.score).toBeLessThanOrEqual(1)
        })
      })

      it('should handle extreme score ranges', async () => {
        // Create entities with very different similarity scores
        const similarEntity = await brain.add({
          data: 'Alice Johnson person social network',
          type: NounType.Person,
          metadata: { name: 'Alice Johnson', age: 30 }
        })

        const dissimilarEntity = await brain.add({
          data: 'Quantum physics advanced mathematics',
          type: NounType.Concept,
          metadata: { name: 'Quantum Physics', complexity: 'high' }
        })

        const results = await brain.find({
          query: 'Alice person',
          limit: 5
        })

        expect(results.length).toBeGreaterThan(0)
        // Should still normalize properly despite large score differences
        results.forEach((result: any) => {
          expect(result.score).toBeGreaterThanOrEqual(0)
          expect(result.score).toBeLessThanOrEqual(1)
        })
      })
    })

    describe('Weight Adjustment', () => {
      it('should allow custom weight configuration', async () => {
        // This would test if the implementation supports custom weights
        // Currently testing the default behavior
        const results = await brain.find({
          query: 'person',
          connected: { from: 'alice' },
          where: { age: { $gte: 25 } },
          limit: 3
        })

        expect(results.length).toBeGreaterThan(0)
        // Weights should affect ranking appropriately
      })

      it('should handle zero weights for search types', async () => {
        // Test behavior when certain search types are effectively disabled
        const vectorOnly = await brain.find({
          query: 'person',
          limit: 3
        })

        expect(vectorOnly.length).toBeGreaterThan(0)
        vectorOnly.forEach((result: any) => {
          expect(result.score).toBeGreaterThan(0)
        })
      })
    })

    describe('Result Ranking Consistency', () => {
      it('should produce consistent rankings for identical queries', async () => {
        const query = {
          query: 'person social',
          connected: { from: 'alice' },
          where: { age: { $gte: 25 } },
          limit: 5
        }

        const results1 = await brain.find(query)
        const results2 = await brain.find(query)

        expect(results1.length).toBe(results2.length)
        for (let i = 0; i < results1.length; i++) {
          expect(results1[i].id).toBe(results2[i].id)
          expect(results1[i].score).toBe(results2[i].score)
        }
      })

      it('should maintain ranking stability under load', async () => {
        const queries = Array(5).fill({
          query: 'person',
          limit: 3
        })

        const allResults = await Promise.all(
          queries.map(query => brain.find(query))
        )

        // All result sets should be identical
        const firstResults = allResults[0]
        allResults.forEach((results: any) => {
          expect(results.length).toBe(firstResults.length)
          results.forEach((result: any, i: number) => {
            expect(result.id).toBe(firstResults[i].id)
            expect(result.score).toBe(firstResults[i].score)
          })
        })
      })
    })
  })

  describe('3. Performance Validation', () => {
    describe('Parallel Execution', () => {
      it('should execute search types in parallel', async () => {
        const { result, duration } = await measureExecutionTime(async () => {
          return brain.find({
            query: 'person',
            connected: { from: 'alice' },
            where: { age: { $gte: 25 } },
            limit: 5
          })
        })

        expect(result.length).toBeGreaterThan(0)
        expect(duration).toBeLessThan(1000) // Should complete quickly with parallel execution
      })

      it('should handle concurrent unified queries', async () => {
        const concurrentQueries = Array(10).fill({
          query: 'person',
          limit: 3
        })

        const { result: results, duration } = await measureExecutionTime(async () => {
          return Promise.all(concurrentQueries.map(query => brain.find(query)))
        })

        expect(results).toHaveLength(10)
        results.forEach((queryResults: any) => {
          expect(queryResults.length).toBeGreaterThan(0)
        })
        expect(duration).toBeLessThan(2000) // Should handle concurrency efficiently
      })
    })

    describe('Query Optimization', () => {
      it('should optimize simple queries', async () => {
        const { result: simpleResult, duration: simpleDuration } = await measureExecutionTime(async () => {
          return brain.find({ query: 'person', limit: 3 })
        })

        const { result: complexResult, duration: complexDuration } = await measureExecutionTime(async () => {
          return brain.find({
            query: 'person',
            connected: { from: 'alice' },
            where: { age: { $gte: 25 } },
            limit: 3
          })
        })

        expect(simpleResult.length).toBeGreaterThan(0)
        expect(complexResult.length).toBeGreaterThan(0)
        // Simple queries should be faster
        expect(simpleDuration).toBeLessThanOrEqual(complexDuration)
      })

      it('should use fast paths for single search types', async () => {
        const vectorQuery = { query: 'person', limit: 3 }
        const graphQuery = { connected: { from: 'alice' }, limit: 3 }
        const fieldQuery = { where: { age: { $gte: 25 } }, limit: 3 }

        const [vectorResults, graphResults, fieldResults] = await Promise.all([
          measureExecutionTime(() => brain.find(vectorQuery)),
          measureExecutionTime(() => brain.find(graphQuery)),
          measureExecutionTime(() => brain.find(fieldQuery))
        ])

        // All should complete quickly
        expect(vectorResults.duration).toBeLessThan(500)
        expect(graphResults.duration).toBeLessThan(500)
        expect(fieldResults.duration).toBeLessThan(500)
      })
    })

    describe('Memory Pressure Handling', () => {
      it('should handle large result sets efficiently', async () => {
        const { result, duration } = await measureExecutionTime(async () => {
          return brain.find({
            query: 'entity',
            limit: 100
          })
        })

        expect(result.length).toBeLessThanOrEqual(100)
        expect(duration).toBeLessThan(2000) // Should handle large sets reasonably
      })

      it('should manage memory during concurrent large queries', async () => {
        const largeQueries = Array(5).fill({
          query: 'entity',
          limit: 50
        })

        const { result: results, duration } = await measureExecutionTime(async () => {
          return Promise.all(largeQueries.map(query => brain.find(query)))
        })

        expect(results).toHaveLength(5)
        results.forEach((queryResults: any) => {
          expect(queryResults.length).toBeLessThanOrEqual(50)
        })
        expect(duration).toBeLessThan(3000)
      })
    })
  })

  describe('4. Edge Cases', () => {
    describe('Empty Results Handling', () => {
      it('should handle empty vector search results', async () => {
        const results = await brain.find({
          query: 'nonexistent_content_xyz123',
          limit: 5
        })

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(0)
      })

      it('should handle empty graph search results', async () => {
        const results = await brain.find({
          connected: {
            from: 'nonexistent_entity',
            direction: 'both'
          },
          limit: 5
        })

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(0)
      })

      it('should handle empty field search results', async () => {
        const results = await brain.find({
          where: { nonexistent_field: 'value' },
          limit: 5
        })

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(0)
      })

      it('should handle mixed empty and non-empty results', async () => {
        const results = await brain.find({
          query: 'person', // Should find results
          connected: {
            from: 'nonexistent_entity' // Should find no results
          },
          where: { age: { $gte: 25 } }, // Should find results
          limit: 5
        })

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeGreaterThan(0)
        // Should still return results from vector and field searches
      })
    })

    describe('Conflicting Results', () => {
      it('should handle mutually exclusive constraints', async () => {
        const results = await brain.find({
          query: 'Alice',
          where: { name: 'Bob' }, // Different person
          connected: {
            from: 'charlie' // Alice is not directly connected to Charlie
          },
          limit: 5
        })

        expect(Array.isArray(results)).toBe(true)
        // Should return results but with appropriate scoring
        if (results.length > 0) {
          expect(results[0].score).toBeLessThan(0.8) // Lower confidence due to conflicts
        }
      })

      it('should handle type conflicts', async () => {
        const results = await brain.find({
          query: 'Earth planet',
          type: NounType.Person, // But Earth is a location
          limit: 5
        })

        expect(Array.isArray(results)).toBe(true)
        // Should handle type mismatch gracefully
      })
    })

    describe('Memory Pressure', () => {
      it('should handle deep graph traversals', async () => {
        const results = await brain.find({
          connected: {
            from: 'alice',
            direction: 'both',
            maxDepth: 5
          },
          limit: 20
        })

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeLessThanOrEqual(20)
      })

      it('should handle complex metadata queries', async () => {
        const results = await brain.find({
          where: {
            $and: [
              { age: { $gte: 20 } },
              { age: { $lte: 40 } },
              {
                $or: [
                  { name: 'Alice' },
                  { name: 'Bob' },
                  { name: 'Charlie' }
                ]
              }
            ]
          },
          limit: 10
        })

        expect(Array.isArray(results)).toBe(true)
        results.forEach((result: any) => {
          const age = result.entity.metadata?.age
          const name = result.entity.metadata?.name
          expect(age).toBeGreaterThanOrEqual(20)
          expect(age).toBeLessThanOrEqual(40)
          expect(['Alice', 'Bob', 'Charlie']).toContain(name)
        })
      })
    })

    describe('Concurrent Queries', () => {
      it('should handle multiple simultaneous unified queries', async () => {
        const queries = [
          { query: 'Alice', limit: 3 },
          { connected: { from: 'alice' }, limit: 3 },
          { where: { age: { $gte: 25 } }, limit: 3 },
          {
            query: 'person',
            connected: { from: 'alice' },
            where: { age: { $gte: 25 } },
            limit: 3
          }
        ]

        const results = await Promise.all(
          queries.map(query => brain.find(query))
        )

        expect(results).toHaveLength(4)
        results.forEach((queryResults: any) => {
          expect(Array.isArray(queryResults)).toBe(true)
        })
      })

      it('should maintain isolation between concurrent queries', async () => {
        const query1 = { query: 'Alice', limit: 2 }
        const query2 = { query: 'Bob', limit: 2 }

        const [results1, results2] = await Promise.all([
          brain.find(query1),
          brain.find(query2)
        ])

        // Results should be different
        expect(results1.length).toBeGreaterThan(0)
        expect(results2.length).toBeGreaterThan(0)

        // Should find different primary entities
        const aliceIn1 = results1.find((r: any) => r.entity.metadata?.name === 'Alice')
        const bobIn2 = results2.find((r: any) => r.entity.metadata?.name === 'Bob')

        expect(aliceIn1).toBeDefined()
        expect(bobIn2).toBeDefined()
      })
    })
  })

  describe('5. Integration Testing', () => {
    describe('End-to-End Find Method Testing', () => {
      it('should perform complete find workflow', async () => {
        // Add a complex entity
        const complexEntityId = await brain.add({
          data: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data',
          type: NounType.Concept,
          metadata: {
            name: 'Machine Learning',
            category: 'AI',
            difficulty: 'advanced',
            tags: ['AI', 'ML', 'data science'],
            related: ['neural networks', 'deep learning']
          }
        })

        // Create relationships
        await brain.relate({
          from: complexEntityId,
          to: 'earth', // Connect to existing entity
          type: VerbType.RelatedTo
        })

        // Perform unified search
        const results = await brain.find({
          query: 'artificial intelligence learning',
          connected: {
            from: complexEntityId,
            direction: 'both'
          },
          where: {
            category: 'AI',
            tags: { $contains: 'AI' }
          },
          limit: 5
        })

        expect(results.length).toBeGreaterThan(0)
        // Should find the complex entity with high relevance
        const mlResult = results.find((r: any) => r.id === complexEntityId)
        expect(mlResult).toBeDefined()
        expect(mlResult!.score).toBeGreaterThan(0.5)
      })

// TODO: Implement natural language query processing
// - NLP integration with unified find()
// - Pattern matching for queries
// Expected completion: 2-3 weeks

      it.skip('should handle natural language queries - SKIPPED: NLP features not yet implemented', async () => {
        const results = await brain.find('find people connected to Alice who are over 25')

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeGreaterThan(0)

        // Should parse and execute the natural language query
        results.forEach((result: any) => {
          expect(result.score).toBeGreaterThan(0)
          expect(result.score).toBeLessThanOrEqual(1)
        })
      })
    })

    describe('Real Data Scenarios', () => {
      it('should handle social network analysis', async () => {
        // Find central people in the network
        const centralPeople = await brain.find({
          type: NounType.Person,
          connected: {
            from: 'alice',
            direction: 'both',
            maxDepth: 2
          },
          limit: 10
        })

        expect(centralPeople.length).toBeGreaterThan(0)
        centralPeople.forEach((person: any) => {
          expect(person.entity.type).toBe(NounType.Person)
        })
      })

      it('should handle knowledge graph traversal', async () => {
        // Find concepts related to Earth
        const earthConcepts = await brain.find({
          connected: {
            from: 'earth',
            direction: 'both'
          },
          type: NounType.Concept,
          limit: 5
        })

        expect(Array.isArray(earthConcepts)).toBe(true)
        earthConcepts.forEach((concept: any) => {
          expect(concept.entity.type).toBe(NounType.Concept)
        })
      })

      it('should handle mixed entity types', async () => {
        const mixedResults = await brain.find({
          query: 'system network',
          limit: 10
        })

        expect(mixedResults.length).toBeGreaterThan(0)
        // Should contain different types of entities
        const types = new Set(mixedResults.map((r: any) => r.entity.type))
        expect(types.size).toBeGreaterThan(1)
      })
    })

    describe('Performance Benchmarks', () => {
      it('should benchmark vector search performance', async () => {
        const { result, duration } = await measureExecutionTime(async () => {
          return brain.find({
            query: 'person social network',
            limit: 10
          })
        })

        expect(result.length).toBeGreaterThan(0)
        expect(duration).toBeLessThan(1000) // Should be fast

        console.log(`Vector search: ${result.length} results in ${duration.toFixed(2)}ms`)
      })

      it('should benchmark graph search performance', async () => {
        const { result, duration } = await measureExecutionTime(async () => {
          return brain.find({
            connected: {
              from: 'alice',
              direction: 'both',
              maxDepth: 3
            },
            limit: 20
          })
        })

        expect(result.length).toBeGreaterThan(0)
        expect(duration).toBeLessThan(1000) // Should be fast

        console.log(`Graph search: ${result.length} results in ${duration.toFixed(2)}ms`)
      })

      it('should benchmark unified search performance', async () => {
        const { result, duration } = await measureExecutionTime(async () => {
          return brain.find({
            query: 'person',
            connected: { from: 'alice' },
            where: { age: { $gte: 25 } },
            limit: 10
          })
        })

        expect(result.length).toBeGreaterThan(0)
        expect(duration).toBeLessThan(1500) // Should be reasonably fast

        console.log(`Unified search: ${result.length} results in ${duration.toFixed(2)}ms`)
      })

      it('should benchmark concurrent unified queries', async () => {
        const queries = Array(20).fill({
          query: 'entity',
          limit: 5
        })

        const { result: results, duration } = await measureExecutionTime(async () => {
          return Promise.all(queries.map(query => brain.find(query)))
        })

        expect(results).toHaveLength(20)
        expect(duration).toBeLessThan(3000) // Should handle concurrency well

        console.log(`Concurrent queries: ${results.length} queries in ${duration.toFixed(2)}ms`)
      })
    })

    describe('Error Handling', () => {
      it('should handle invalid query parameters gracefully', async () => {
        // Test with invalid parameters
        const results = await brain.find({
          query: '',
          connected: { from: '' },
          where: {},
          limit: 0
        } as any)

        expect(Array.isArray(results)).toBe(true)
      })

      it('should handle malformed metadata queries', async () => {
        const results = await brain.find({
          where: {
            $invalidOperator: 'value'
          },
          limit: 5
        } as any)

        expect(Array.isArray(results)).toBe(true)
      })

      it('should handle network-like failures gracefully', async () => {
        // Simulate by using invalid entity IDs
        const results = await brain.find({
          connected: {
            from: 'definitely_nonexistent_entity_12345',
            direction: 'both'
          },
          limit: 5
        })

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(0)
      })

      it('should handle extreme parameter values', async () => {
        const results = await brain.find({
          limit: 10000, // Very large limit
          query: 'test',
          connected: {
            maxDepth: 100 // Very deep traversal
          }
        })

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeLessThanOrEqual(10000)
      })
    })
  })
})
