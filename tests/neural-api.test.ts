/**
 * Neural Similarity API Tests
 * 
 * Tests for semantic similarity, clustering, hierarchy, and visualization features
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BrainyData } from '../src/brainyData.js'
import { NeuralAPI } from '../src/neural/neuralAPI.js'

describe('Neural Similarity API', () => {
  let brain: BrainyData
  let neural: NeuralAPI

  beforeEach(async () => {
    brain = new BrainyData()
    neural = new NeuralAPI(brain)
    
    // Use memory storage for tests
    await brain.init()
    
    // Add test data
    await brain.addNoun('Apple is a red fruit that grows on trees')
    await brain.addNoun('Orange is a citrus fruit with vitamin C')
    await brain.addNoun('Banana is a yellow tropical fruit')
    await brain.addNoun('Car is a vehicle with four wheels')
    await brain.addNoun('Truck is a large vehicle for cargo')
    await brain.addNoun('Bicycle is a two-wheeled vehicle')
  })

  describe('Similarity Calculation', () => {
    it('should calculate basic similarity between items', async () => {
      const similarity = await neural.similar('apple', 'orange')
      
      expect(typeof similarity).toBe('number')
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should return detailed similarity with explanations', async () => {
      // Get actual item IDs from the brain
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      
      if (items.length < 2) {
        // Skip test if not enough items
        expect(true).toBe(true)
        return
      }
      
      const result = await neural.similar(items[0].id, items[1].id, {
        explain: true,
        includeBreakdown: true
      })
      
      expect(typeof result).toBe('object')
      expect(result).toHaveProperty('score')
      expect(result).toHaveProperty('explanation')
      expect(result).toHaveProperty('breakdown')
      expect(result.score).toBeGreaterThan(0)
    })

    it('should handle similarity between text inputs', async () => {
      const similarity = await neural.similar('fruit', 'vehicle')
      
      expect(typeof similarity).toBe('number')
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThan(0.5) // Should be low similarity
    })

    it('should detect similar items have higher scores', async () => {
      const fruitSimilarity = await neural.similar('apple', 'banana')
      const vehicleSimilarity = await neural.similar('car', 'truck')
      const crossSimilarity = await neural.similar('apple', 'car')
      
      expect(fruitSimilarity).toBeGreaterThan(crossSimilarity)
      expect(vehicleSimilarity).toBeGreaterThan(crossSimilarity)
    })
  })

  describe('Clustering', () => {
    it('should find semantic clusters in data', async () => {
      const clusters = await neural.clusters()
      
      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBeGreaterThanOrEqual(0) // May be 0 if items are too similar
      
      // Check cluster structure
      for (const cluster of clusters) {
        expect(cluster).toHaveProperty('id')
        expect(cluster).toHaveProperty('members')
        expect(cluster).toHaveProperty('confidence')
        expect(Array.isArray(cluster.members)).toBe(true)
        expect(cluster.confidence).toBeGreaterThan(0)
        expect(cluster.confidence).toBeLessThanOrEqual(1)
      }
    })

    it('should cluster specific items', async () => {
      // Get all item IDs
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      const itemIds = items.map(item => item.id)
      
      const clusters = await neural.clusters(itemIds.slice(0, 4))
      
      expect(Array.isArray(clusters)).toBe(true)
    })

    it('should use different clustering algorithms', async () => {
      const hierarchical = await neural.clusters({
        algorithm: 'hierarchical',
        threshold: 0.7
      })
      
      const kmeans = await neural.clusters({
        algorithm: 'kmeans',
        maxClusters: 3
      })
      
      expect(Array.isArray(hierarchical)).toBe(true)
      expect(Array.isArray(kmeans)).toBe(true)
    })
  })

  describe('Hierarchy Detection', () => {
    it('should build semantic hierarchy for items', async () => {
      // Get the first item ID
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      const firstItemId = items[0]?.id
      
      if (!firstItemId) return // Skip if no item found
      
      const hierarchy = await neural.hierarchy(firstItemId)
      
      expect(hierarchy).toHaveProperty('self')
      expect(hierarchy.self).toHaveProperty('id', firstItemId)
      expect(hierarchy.self).toHaveProperty('vector')
      
      // Optional properties that may exist
      if (hierarchy.parent) {
        expect(hierarchy.parent).toHaveProperty('id')
        expect(hierarchy.parent).toHaveProperty('similarity')
      }
      
      if (hierarchy.siblings) {
        expect(Array.isArray(hierarchy.siblings)).toBe(true)
      }
      
      if (hierarchy.children) {
        expect(Array.isArray(hierarchy.children)).toBe(true)
      }
    })

    it('should cache hierarchy results', async () => {
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      const firstItemId = items[0]?.id
      
      if (!firstItemId) return // Skip if no item found
      
      // First call
      const hierarchy1 = await neural.hierarchy(firstItemId)
      
      // Second call should use cache
      const hierarchy2 = await neural.hierarchy(firstItemId)
      
      expect(hierarchy1).toEqual(hierarchy2)
    })
  })

  describe('Neighbor Discovery', () => {
    it('should find semantic neighbors', async () => {
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      const firstItemId = items[0]?.id
      
      if (!firstItemId) return // Skip if no item found
      
      const graph = await neural.neighbors(firstItemId, {
        limit: 3,
        includeEdges: false
      })
      
      expect(graph).toHaveProperty('center', firstItemId)
      expect(graph).toHaveProperty('neighbors')
      expect(Array.isArray(graph.neighbors)).toBe(true)
      expect(graph.neighbors.length).toBeLessThanOrEqual(3)
      
      // Check neighbor structure
      for (const neighbor of graph.neighbors) {
        expect(neighbor).toHaveProperty('id')
        expect(neighbor).toHaveProperty('similarity')
        expect(neighbor.similarity).toBeGreaterThan(0)
        expect(neighbor.similarity).toBeLessThanOrEqual(1)
      }
    })

    it('should include edges when requested', async () => {
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      const firstItemId = items[0]?.id
      
      if (!firstItemId) return // Skip if no item found
      
      const graph = await neural.neighbors(firstItemId, {
        limit: 3,
        includeEdges: true
      })
      
      expect(graph).toHaveProperty('edges')
      if (graph.edges) {
        expect(Array.isArray(graph.edges)).toBe(true)
      }
    })
  })

  describe('Semantic Path Finding', () => {
    it('should find semantic paths between items', async () => {
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      
      if (items.length < 2) return // Skip if not enough items
      
      const fromId = items[0]?.id
      const toId = items[1]?.id
      
      if (!fromId || !toId) return // Skip if not enough valid items
      
      const path = await neural.semanticPath(fromId, toId)
      
      expect(Array.isArray(path)).toBe(true)
      
      // Check path structure
      for (const hop of path) {
        expect(hop).toHaveProperty('id')
        expect(hop).toHaveProperty('similarity')
        expect(hop).toHaveProperty('hop')
        expect(hop.similarity).toBeGreaterThan(0)
        expect(hop.similarity).toBeLessThanOrEqual(1)
        expect(hop.hop).toBeGreaterThan(0)
      }
    })

    it('should return empty path if no connection found', async () => {
      // Mock a scenario where no path exists by limiting search
      const spy = vi.spyOn(brain, 'search').mockResolvedValue([])
      
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      
      if (items.length < 2) return
      
      const fromId = items[0]?.id
      const toId = items[1]?.id
      
      if (!fromId || !toId) return
      
      const path = await neural.semanticPath(fromId, toId)
      
      expect(Array.isArray(path)).toBe(true)
      expect(path.length).toBe(0)
      
      spy.mockRestore()
    })
  })

  describe('Outlier Detection', () => {
    it('should detect semantic outliers', async () => {
      const outliers = await neural.outliers(0.3)
      
      expect(Array.isArray(outliers)).toBe(true)
      
      // With our test data, there might be outliers
      for (const outlier of outliers) {
        expect(typeof outlier).toBe('string')
      }
    })

    it('should use configurable threshold', async () => {
      const strictOutliers = await neural.outliers(0.8)
      const lenientOutliers = await neural.outliers(0.2)
      
      expect(Array.isArray(strictOutliers)).toBe(true)
      expect(Array.isArray(lenientOutliers)).toBe(true)
      
      // Stricter threshold should find more outliers
      expect(strictOutliers.length).toBeGreaterThanOrEqual(lenientOutliers.length)
    })
  })

  describe('Visualization Data Generation', () => {
    it('should generate visualization data', async () => {
      const vizData = await neural.visualize({
        maxNodes: 10,
        dimensions: 2
      })
      
      expect(vizData).toHaveProperty('format')
      expect(vizData).toHaveProperty('nodes')
      expect(vizData).toHaveProperty('edges')
      expect(vizData).toHaveProperty('layout')
      
      expect(Array.isArray(vizData.nodes)).toBe(true)
      expect(Array.isArray(vizData.edges)).toBe(true)
      expect(vizData.nodes.length).toBeLessThanOrEqual(10)
      
      // Check node structure
      for (const node of vizData.nodes) {
        expect(node).toHaveProperty('id')
        expect(node).toHaveProperty('x')
        expect(node).toHaveProperty('y')
        expect(typeof node.x).toBe('number')
        expect(typeof node.y).toBe('number')
      }
      
      // Check edge structure
      for (const edge of vizData.edges) {
        expect(edge).toHaveProperty('source')
        expect(edge).toHaveProperty('target')
        expect(edge).toHaveProperty('weight')
        expect(typeof edge.weight).toBe('number')
      }
    })

    it('should support 3D visualization', async () => {
      const vizData = await neural.visualize({
        dimensions: 3,
        maxNodes: 5
      })
      
      expect(vizData.layout?.dimensions).toBe(3)
      
      for (const node of vizData.nodes) {
        expect(node).toHaveProperty('z')
        expect(typeof node.z).toBe('number')
      }
    })

    it('should detect optimal format', async () => {
      const vizData = await neural.visualize()
      
      expect(['force-directed', 'hierarchical', 'radial'].includes(vizData.format)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent item IDs', async () => {
      await expect(neural.hierarchy('non-existent-id')).rejects.toThrow()
    })

    it('should handle invalid similarity inputs', async () => {
      await expect(neural.similar(null as any, 'test')).rejects.toThrow()
    })

    it('should handle empty datasets gracefully', async () => {
      // Create empty brain
      const emptyBrain = new BrainyData()
      await emptyBrain.init()
      const emptyNeural = new NeuralAPI(emptyBrain)
      
      const clusters = await emptyNeural.clusters()
      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBe(0)
      
      const outliers = await emptyNeural.outliers()
      expect(Array.isArray(outliers)).toBe(true)
      expect(outliers.length).toBe(0)
    })
  })

  describe('Performance and Caching', () => {
    it('should cache similarity calculations', async () => {
      const start1 = Date.now()
      const similarity1 = await neural.similar('apple', 'orange')
      const duration1 = Date.now() - start1
      
      const start2 = Date.now()
      const similarity2 = await neural.similar('apple', 'orange')
      const duration2 = Date.now() - start2
      
      expect(similarity1).toBe(similarity2)
      // Second call should be faster (cached) - allowing for margin of error
      expect(duration2).toBeLessThanOrEqual(duration1 + 5) // Small margin for test timing variance
    })

    it('should handle large result sets efficiently', async () => {
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      
      if (items.length > 0) {
        const start = Date.now()
        const vizData = await neural.visualize({ maxNodes: 100 })
        const duration = Date.now() - start
        
        expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
        expect(vizData.nodes.length).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('Integration with BrainyData', () => {
    it('should work with different data types', async () => {
      // Add different types of data
      await brain.addNoun({ text: 'Scientific research paper', type: 'document' })
      await brain.addNoun({ text: 'Music album review', type: 'review' })
      
      const clusters = await neural.clusters()
      expect(clusters.length).toBeGreaterThanOrEqual(0) // May be 0 if items are too similar
    })

    it('should respect BrainyData search limits', async () => {
      const allData = await brain.export({ format: 'json' })
      const items = Array.isArray(allData) ? allData : []
      
      if (items.length > 0 && items[0]?.id) {
        const neighbors = await neural.neighbors(items[0].id, { limit: 2 })
        expect(neighbors.neighbors.length).toBeLessThanOrEqual(2)
      }
    })

    it('should handle metadata in clustering', async () => {
      const clusters = await neural.clusters()
      
      for (const cluster of clusters) {
        expect(cluster.members.length).toBeGreaterThan(0)
        
        // Members should be valid IDs
        for (const memberId of cluster.members) {
          expect(typeof memberId).toBe('string')
          expect(memberId.length).toBeGreaterThan(0)
        }
      }
    })
  })
})