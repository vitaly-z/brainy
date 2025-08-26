/**
 * Statistics Functionality Tests
 * Tests the getStatistics function as a consumer would use it
 */

import { describe, it, expect, beforeAll } from 'vitest'

/**
 * Helper function to create a 512-dimensional vector for testing
 * @param primaryIndex The index to set to 1.0, all other indices will be 0.0
 * @returns A 512-dimensional vector with a single 1.0 value at the specified index
 */
function createTestVector(primaryIndex: number = 0): number[] {
  const vector = new Array(384).fill(0)
  vector[primaryIndex % 512] = 1.0
  return vector
}

describe('Brainy Statistics Functionality', () => {
  let brainy: any

  beforeAll(async () => {
    // Load brainy library as a consumer would
    brainy = await import('../dist/unified.js')
  })

  describe('Library Exports', () => {
    it('should export getStatistics function at the root level', () => {
      expect(brainy.getStatistics).toBeDefined()
      expect(typeof brainy.getStatistics).toBe('function')
    })
  })

  describe('getStatistics Functionality', () => {
    it('should retrieve statistics from a BrainyData instance', async () => {
      // Create a BrainyData instance
      const data = new brainy.BrainyData({
        metric: 'euclidean'
      })

      await data.init()
      await data.clearAll({ force: true }) // Clear any existing data

      // Add some test data using 2.0.0 API
      const v1Id = await data.addNoun('x-axis vector', 'content', { id: 'v1', label: 'x-axis' })
      const v2Id = await data.addNoun('y-axis vector', 'content', { id: 'v2', label: 'y-axis' })
      const v3Id = await data.addNoun('z-axis vector', 'content', { id: 'v3', label: 'z-axis' })

      // Add a verb using 2.0.0 API
      await data.addVerb(v1Id, v2Id, 'relatedTo', { type: 'connected_to' })

      // Get statistics using the standalone function
      const stats = await brainy.getStatistics(data)

      // Verify statistics
      expect(stats).toBeDefined()
      expect(stats.nounCount).toBe(3)
      expect(stats.verbCount).toBe(1)
      expect(stats.metadataCount).toBe(3) // Each noun has metadata
      expect(stats.hnswIndexSize).toBe(4) // 3 nouns + 1 verb (verbs are also added to HNSW index)
    })

    it('should throw an error when no instance is provided', async () => {
      await expect(brainy.getStatistics()).rejects.toThrow('BrainyData instance must be provided')
    })

    it('should match the instance method results', async () => {
      // Create a BrainyData instance
      const data = new brainy.BrainyData({})

      await data.init()
      
      // Add some test data using 2.0.0 API
      await data.addNoun('test vector', 'content', { id: 'test1' })
      
      // Get statistics using both methods
      const instanceStats = await data.getStatistics()
      const functionStats = await brainy.getStatistics(data)
      
      // Verify core statistics match (ignoring volatile fields like memoryUsage and timestamps)
      expect(functionStats.nounCount).toBe(instanceStats.nounCount)
      expect(functionStats.verbCount).toBe(instanceStats.verbCount)
      expect(functionStats.metadataCount).toBe(instanceStats.metadataCount)
      expect(functionStats.hnswIndexSize).toBe(instanceStats.hnswIndexSize)
      
      // If serviceBreakdown exists, verify it matches
      if (instanceStats.serviceBreakdown) {
        expect(functionStats.serviceBreakdown).toEqual(instanceStats.serviceBreakdown)
      }
    })

    it('should track statistics by service', async () => {
      // Create a BrainyData instance
      const data = new brainy.BrainyData({
        metric: 'euclidean'
      })

      await data.init()
      await data.clearAll({ force: true }) // Clear any existing data

      // Add data from different services using 2.0.0 API
      const v1Id = await data.addNoun('service1 item A', 'content', { id: 'v1', label: 'service1-item' }, { service: 'service1' })
      const v2Id = await data.addNoun('service1 item B', 'content', { id: 'v2', label: 'service1-item' }, { service: 'service1' })
      const v3Id = await data.addNoun('service2 item C', 'content', { id: 'v3', label: 'service2-item' }, { service: 'service2' })
      
      // Add verbs from different services using 2.0.0 API
      await data.addVerb(v1Id, v2Id, 'relatedTo', { type: 'related_to', service: 'service1' })
      await data.addVerb(v2Id, v3Id, 'relatedTo', { type: 'related_to', service: 'service2' })

      // Get statistics for all services
      const allStats = await data.getStatistics()
      
      // Verify total counts
      expect(allStats.nounCount).toBe(3)
      expect(allStats.verbCount).toBe(2)
      expect(allStats.metadataCount).toBe(3)
      
      // Verify service breakdown exists
      expect(allStats.serviceBreakdown).toBeDefined()
      
      // Verify service1 statistics
      const service1Stats = await data.getStatistics({ service: 'service1' })
      expect(service1Stats.nounCount).toBe(2)
      expect(service1Stats.verbCount).toBe(1)
      expect(service1Stats.metadataCount).toBe(2)
      
      // Verify service2 statistics
      const service2Stats = await data.getStatistics({ service: 'service2' })
      expect(service2Stats.nounCount).toBe(1)
      expect(service2Stats.verbCount).toBe(1)
      expect(service2Stats.metadataCount).toBe(1)
      
      // Verify multiple services filter
      const combinedStats = await data.getStatistics({ service: ['service1', 'service2'] })
      expect(combinedStats.nounCount).toBe(3)
      expect(combinedStats.verbCount).toBe(2)
      expect(combinedStats.metadataCount).toBe(3)
    })
  })
})
