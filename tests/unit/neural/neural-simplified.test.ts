import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { createAddParams } from '../../helpers/test-factory'
import { NounType } from '../../../src/types/graphTypes'

/**
 * Neural API Test Suite - Testing Production Neural Functionality
 * Tests the actual neural methods available in brain.neural()
 */

describe('Neural API - Production Testing', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    brain = new Brainy()
    await brain.init()
  })

  describe('1. Neural API Access', () => {
    it('should provide neural API access', async () => {
      const neural = brain.neural()
      expect(neural).toBeDefined()
      expect(typeof neural.similar).toBe('function')
      expect(typeof neural.clusters).toBe('function')
      expect(typeof neural.neighbors).toBe('function')
      expect(typeof neural.hierarchy).toBe('function')
      expect(typeof neural.outliers).toBe('function')
      expect(typeof neural.visualize).toBe('function')
    })

    it('should provide clustering methods', async () => {
      const neural = brain.neural()
      expect(typeof neural.clusterFast).toBe('function')
      expect(typeof neural.clusterLarge).toBe('function')
      expect(typeof neural.clusterByDomain).toBe('function')
      expect(typeof neural.clusterByTime).toBe('function')
      expect(typeof neural.updateClusters).toBe('function')
    })

    it('should provide streaming and advanced methods', async () => {
      const neural = brain.neural()
      expect(typeof neural.clusterStream).toBe('function')
      expect(typeof neural.clustersWithRelationships).toBe('function')
    })
  })

  describe('2. Similarity Calculations', () => {
    it('should calculate similarity between text strings', async () => {
      const result = await brain.neural().similar(
        'artificial intelligence',
        'machine learning'
      )

      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })

    it('should calculate similarity with different text', async () => {
      const result = await brain.neural().similar(
        'programming languages',
        'cooking recipes'
      )

      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })

    it('should handle similarity with vectors', async () => {
      const vector1 = Array(384).fill(0.1)
      const vector2 = Array(384).fill(0.2)

      const result = await brain.neural().similar(vector1, vector2)

      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })

    it('should provide detailed similarity results with options', async () => {
      const result = await brain.neural().similar(
        'data science',
        'statistics',
        {
          returnDetails: true,
          metric: 'cosine'
        }
      )

      expect(result).toBeDefined()
      if (typeof result === 'object') {
        expect(result).toHaveProperty('similarity')
        expect(typeof result.similarity).toBe('number')
      }
    })
  })

  describe.skip('3. Basic Clustering', () => {
    it('should perform basic clustering with no items', async () => {
      const clusters = await brain.neural().clusters()
      expect(Array.isArray(clusters)).toBe(true)
    })

    it('should perform fast clustering', async () => {
      // Add some test data first
      await brain.add(createAddParams({ data: 'Machine learning algorithm' }))
      await brain.add(createAddParams({ data: 'Deep neural networks' }))
      await brain.add(createAddParams({ data: 'Cooking recipes' }))
      await brain.add(createAddParams({ data: 'Food preparation' }))

      const clusters = await brain.neural().clusterFast({
        level: 0,
        maxClusters: 10
      })

      expect(Array.isArray(clusters)).toBe(true)
      clusters.forEach(cluster => {
        expect(cluster).toHaveProperty('id')
        expect(cluster).toHaveProperty('members')
        expect(cluster).toHaveProperty('centroid')
        expect(Array.isArray(cluster.members)).toBe(true)
      })
    })

    it('should perform large-scale clustering with sampling', async () => {
      // Add test data
      const promises = Array.from({ length: 20 }, (_, i) =>
        brain.add(createAddParams({
          data: `Test document ${i}`,
          metadata: { category: i % 3 === 0 ? 'tech' : 'other' }
        }))
      )
      await Promise.all(promises)

      const clusters = await brain.neural().clusterLarge({
        sampleSize: 10,
        strategy: 'random'
      })

      expect(Array.isArray(clusters)).toBe(true)
    })

    it('should handle empty clustering gracefully', async () => {
      const clusters = await brain.neural().clusters([])
      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBe(0)
    })
  })

  describe.skip('4. Domain-Aware Clustering', () => {
    it('should cluster by metadata domain', async () => {
      // Add entities with different categories
      await brain.add(createAddParams({
        data: 'Python programming',
        metadata: { category: 'tech', language: 'python' }
      }))
      await brain.add(createAddParams({
        data: 'JavaScript development',
        metadata: { category: 'tech', language: 'javascript' }
      }))
      await brain.add(createAddParams({
        data: 'Pasta recipe',
        metadata: { category: 'food', cuisine: 'italian' }
      }))

      const clusters = await brain.neural().clusterByDomain('category', {
        minClusterSize: 1,
        maxClusters: 5
      })

      expect(Array.isArray(clusters)).toBe(true)
    })

    it('should handle missing domain field gracefully', async () => {
      await brain.add(createAddParams({ data: 'No category' }))

      const clusters = await brain.neural().clusterByDomain('nonexistent', {
        minClusterSize: 1
      })

      expect(Array.isArray(clusters)).toBe(true)
    })
  })

  describe('5. Neighbors and Relationships', () => {
    it('should find neighbors for non-existent ID gracefully', async () => {
      const result = await brain.neural().neighbors('non-existent-id', {
        limit: 5
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty('neighbors')
      expect(Array.isArray(result.neighbors)).toBe(true)
    })

    it('should find neighbors with options', async () => {
      const id = await brain.add(createAddParams({
        data: 'Central document for neighbor search'
      }))

      // Add some potential neighbors
      await brain.add(createAddParams({ data: 'Related document 1' }))
      await brain.add(createAddParams({ data: 'Related document 2' }))

      const result = await brain.neural().neighbors(id, {
        limit: 3,
        threshold: 0.1
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty('neighbors')
      expect(Array.isArray(result.neighbors)).toBe(true)
    })
  })

  describe.skip('6. Semantic Hierarchy', () => {
    it('should build hierarchy for entity', async () => {
      const id = await brain.add(createAddParams({
        data: 'Root concept for hierarchy'
      }))

      const hierarchy = await brain.neural().hierarchy(id, {
        depth: 2,
        maxChildren: 5
      })

      expect(hierarchy).toBeDefined()
      expect(hierarchy).toHaveProperty('root')
      expect(hierarchy).toHaveProperty('levels')
      expect(Array.isArray(hierarchy.levels)).toBe(true)
    })

    it('should handle hierarchy for non-existent ID', async () => {
      const hierarchy = await brain.neural().hierarchy('non-existent', {
        depth: 1
      })

      expect(hierarchy).toBeDefined()
      expect(hierarchy).toHaveProperty('root')
      expect(hierarchy).toHaveProperty('levels')
    })
  })

  describe.skip('7. Outlier Detection', () => {
    it('should detect outliers in dataset', async () => {
      // Add some normal documents
      await brain.add(createAddParams({ data: 'Normal document about AI' }))
      await brain.add(createAddParams({ data: 'Another AI document' }))
      await brain.add(createAddParams({ data: 'Machine learning text' }))

      // Add an outlier
      await brain.add(createAddParams({ data: 'Completely unrelated content about medieval history' }))

      const outliers = await brain.neural().outliers({
        threshold: 0.5,
        method: 'cluster'
      })

      expect(Array.isArray(outliers)).toBe(true)
      outliers.forEach(outlier => {
        expect(outlier).toHaveProperty('id')
        expect(outlier).toHaveProperty('score')
        expect(typeof outlier.score).toBe('number')
      })
    })

    it('should handle empty dataset for outlier detection', async () => {
      const outliers = await brain.neural().outliers()
      expect(Array.isArray(outliers)).toBe(true)
    })
  })

  describe('8. Visualization Data', () => {
    it('should generate visualization data', async () => {
      // Add some test data
      await brain.add(createAddParams({ data: 'Node 1' }))
      await brain.add(createAddParams({ data: 'Node 2' }))
      await brain.add(createAddParams({ data: 'Node 3' }))

      const visualization = await brain.neural().visualize({
        maxNodes: 10,
        algorithm: 'force',
        dimensions: 2
      })

      expect(visualization).toBeDefined()
      expect(visualization).toHaveProperty('nodes')
      expect(visualization).toHaveProperty('edges')
      expect(Array.isArray(visualization.nodes)).toBe(true)
      expect(Array.isArray(visualization.edges)).toBe(true)
    })

    it('should handle 3D visualization', async () => {
      await brain.add(createAddParams({ data: '3D visualization test' }))

      const visualization = await brain.neural().visualize({
        maxNodes: 5,
        dimensions: 3
      })

      expect(visualization).toBeDefined()
      expect(visualization).toHaveProperty('nodes')
      expect(visualization).toHaveProperty('edges')
    })
  })

  describe.skip('9. Incremental Clustering', () => {
    it('should update clusters with new items', async () => {
      // Create initial entities
      const id1 = await brain.add(createAddParams({ data: 'Initial cluster item 1' }))
      const id2 = await brain.add(createAddParams({ data: 'Initial cluster item 2' }))

      // Create new items to add
      const id3 = await brain.add(createAddParams({ data: 'New item to cluster' }))
      const id4 = await brain.add(createAddParams({ data: 'Another new item' }))

      const updatedClusters = await brain.neural().updateClusters([id3, id4], {
        algorithm: 'auto',
        minClusterSize: 1
      })

      expect(Array.isArray(updatedClusters)).toBe(true)
    })

    it('should handle empty new items list', async () => {
      const clusters = await brain.neural().updateClusters([])
      expect(Array.isArray(clusters)).toBe(true)
    })
  })

  describe.skip('10. Advanced Clustering Features', () => {
    it('should perform clustering with relationships', async () => {
      // Add entities with potential relationships
      const id1 = await brain.add(createAddParams({ data: 'Entity with relationships 1' }))
      const id2 = await brain.add(createAddParams({ data: 'Entity with relationships 2' }))

      const clusters = await brain.neural().clustersWithRelationships([id1, id2], {
        includeRelationships: true,
        algorithm: 'graph'
      })

      expect(Array.isArray(clusters)).toBe(true)
    })

    it('should handle different clustering algorithms', async () => {
      await brain.add(createAddParams({ data: 'Algorithm test 1' }))
      await brain.add(createAddParams({ data: 'Algorithm test 2' }))

      const algorithms = ['auto', 'semantic', 'hierarchical', 'kmeans', 'dbscan']

      for (const algorithm of algorithms) {
        const clusters = await brain.neural().clusters({
          algorithm: algorithm as any,
          minClusterSize: 1,
          maxClusters: 5
        })

        expect(Array.isArray(clusters)).toBe(true)
      }
    })
  })

  describe.skip('11. Streaming Clustering', () => {
    it('should handle streaming clustering', async () => {
      // Add test data
      const promises = Array.from({ length: 10 }, (_, i) =>
        brain.add(createAddParams({ data: `Streaming item ${i}` }))
      )
      await Promise.all(promises)

      const stream = brain.neural().clusterStream({
        batchSize: 3,
        maxBatches: 2
      })

      let batchCount = 0
      for await (const batch of stream) {
        expect(batch).toBeDefined()
        expect(batch).toHaveProperty('clusters')
        expect(Array.isArray(batch.clusters)).toBe(true)
        batchCount++

        // Prevent infinite loop in tests
        if (batchCount >= 2) break
      }
    })
  })

  describe('12. Error Handling', () => {
    it('should handle invalid similarity inputs gracefully', async () => {
      await expect(brain.neural().similar(null as any, undefined as any))
        .rejects.toThrow()
    })

    it.skip('should handle invalid clustering options', async () => {
      const clusters = await brain.neural().clusters({
        minClusterSize: -1, // Invalid
        maxClusters: 0 // Invalid
      })

      expect(Array.isArray(clusters)).toBe(true)
    })

    it('should handle invalid neighbor requests', async () => {
      await expect(brain.neural().neighbors('', {
        limit: -1 // Invalid
      })).rejects.toThrow()
    })
  })

  describe.skip('13. Performance and Scalability', () => {
    it('should handle moderate dataset sizes efficiently', async () => {
      // Create 50 entities
      const promises = Array.from({ length: 50 }, (_, i) =>
        brain.add(createAddParams({
          data: `Performance test document ${i}`,
          metadata: { index: i, category: i % 5 }
        }))
      )
      await Promise.all(promises)

      const start = Date.now()
      const clusters = await brain.neural().clusterFast({
        maxClusters: 10
      })
      const duration = Date.now() - start

      expect(Array.isArray(clusters)).toBe(true)
      expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle concurrent neural operations', async () => {
      await brain.add(createAddParams({ data: 'Concurrent test 1' }))
      await brain.add(createAddParams({ data: 'Concurrent test 2' }))

      const operations = [
        brain.neural().similar('test1', 'test2'),
        brain.neural().clusters({ maxClusters: 3 }),
        brain.neural().outliers({ threshold: 0.8 })
      ]

      const results = await Promise.all(operations)

      expect(results.length).toBe(3)
      expect(typeof results[0]).toBe('number') // similarity
      expect(Array.isArray(results[1])).toBe(true) // clusters
      expect(Array.isArray(results[2])).toBe(true) // outliers
    })
  })

  describe('14. Configuration and Options', () => {
    it('should respect different similarity metrics', async () => {
      const metrics = ['cosine', 'euclidean', 'manhattan']

      for (const metric of metrics) {
        const result = await brain.neural().similar(
          'test text one',
          'test text two',
          { metric: metric as any }
        )

        expect(typeof result).toBe('number')
        expect(result).toBeGreaterThanOrEqual(0)
      }
    })

    it('should handle different clustering configurations', async () => {
      await brain.add(createAddParams({ data: 'Config test 1' }))
      await brain.add(createAddParams({ data: 'Config test 2' }))

      const configurations = [
        { algorithm: 'auto', minClusterSize: 1 },
        { algorithm: 'semantic', maxClusters: 3 },
        { algorithm: 'hierarchical', threshold: 0.5 }
      ]

      for (const config of configurations) {
        const clusters = await brain.neural().clusters(config as any)
        expect(Array.isArray(clusters)).toBe(true)
      }
    })
  })
})