/**
 * Unit Tests for Brainy Core Functionality
 * 
 * Tests business logic with mocked AI - fast and reliable
 * Based on industry practices from HuggingFace, etc.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BrainyData } from '../../dist/index.js'
import { mockEmbedding } from '../setup-unit.js'

describe('Brainy Core (Unit Tests)', () => {
  let brain: BrainyData

  beforeEach(async () => {
    // Create instance with mocked embedding for fast, reliable tests
    brain = new BrainyData({
      storage: { forceMemoryStorage: true },
      verbose: false,
      embeddingFunction: mockEmbedding
    })
    
    await brain.init()
    await brain.clearAll({ force: true })
  })

  describe('CRUD Operations', () => {
    it('should create items with addNoun', async () => {
      const id = await brain.addNoun({ 
        name: 'JavaScript', 
        type: 'language' 
      })
      
      expect(id).toBeTypeOf('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should retrieve items with getNoun', async () => {
      const testData = { name: 'Python', type: 'language', year: 1991 }
      const id = await brain.addNoun(testData)
      
      const retrieved = await brain.getNoun(id)
      
      expect(retrieved).toBeTruthy()
      expect(retrieved?.metadata?.name).toBe('Python')
      expect(retrieved?.metadata?.type).toBe('language')
      expect(retrieved?.metadata?.year).toBe(1991)
    })

    it('should update items with updateNoun', async () => {
      const id = await brain.addNoun({ name: 'TypeScript', version: '4.0' })
      
      await brain.updateNoun(id, { version: '5.0', popularity: 'high' })
      
      const updated = await brain.getNoun(id)
      expect(updated?.metadata?.version).toBe('5.0')
      expect(updated?.metadata?.popularity).toBe('high')
      expect(updated?.metadata?.name).toBe('TypeScript') // Original data preserved
    })

    it('should delete items with deleteNoun', async () => {
      const id = await brain.addNoun({ name: 'ToDelete', temp: true })
      
      // Verify it exists
      expect(await brain.getNoun(id)).toBeTruthy()
      
      // Delete it
      await brain.deleteNoun(id)
      
      // Verify it's gone
      expect(await brain.getNoun(id)).toBeNull()
    })

    it('should handle non-existent IDs according to API contract', async () => {
      const fakeId = 'non-existent-id'
      
      expect(await brain.getNoun(fakeId)).toBeNull()
      
      // updateNoun should throw for non-existent ID (matches existing error handling tests)
      await expect(brain.updateNoun(fakeId, { test: 'data' })).rejects.toThrow()
      
      // deleteNoun should return false for non-existent ID (soft failure)
      expect(await brain.deleteNoun(fakeId)).toBe(false)
    })
  })

  describe('Search Operations (Mocked AI)', () => {
    beforeEach(async () => {
      // Add test data
      await brain.addNoun({ name: 'React', type: 'framework', category: 'frontend' })
      await brain.addNoun({ name: 'Vue', type: 'framework', category: 'frontend' })
      await brain.addNoun({ name: 'Express', type: 'framework', category: 'backend' })
      await brain.addNoun({ name: 'Java', type: 'language', category: 'backend' })
    })

    it('should return search results with mocked embeddings', async () => {
      const results = await brain.search('frontend framework', { limit: 5 })
      
      expect(results).toBeInstanceOf(Array)
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(5)
      
      // Each result should have required structure
      results.forEach(result => {
        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('metadata')
        expect(result).toHaveProperty('score')
      })
    })

    it('should respect search limits', async () => {
      const results1 = await brain.search('framework', { limit: 1 })
      const results2 = await brain.search('framework', { limit: 2 })
      const results3 = await brain.search('framework', { limit: 10 })
      
      expect(results1).toHaveLength(1)
      expect(results2).toHaveLength(2)
      expect(results3.length).toBeLessThanOrEqual(4) // We only have 4 items total
    })
  })

  describe('Brain Patterns (Metadata Filtering)', () => {
    beforeEach(async () => {
      // Add test data with various metadata
      await brain.addNoun({ name: 'Django', type: 'framework', year: 2005, language: 'Python' })
      await brain.addNoun({ name: 'FastAPI', type: 'framework', year: 2018, language: 'Python' })
      await brain.addNoun({ name: 'Rails', type: 'framework', year: 2004, language: 'Ruby' })
      await brain.addNoun({ name: 'Spring', type: 'framework', year: 2002, language: 'Java' })
    })

    it('should filter by exact metadata match', async () => {
      const pythonFrameworks = await brain.search('*', { limit: 10,
        metadata: { 
          type: 'framework',
          language: 'Python'
        }
      })
      
      expect(pythonFrameworks).toHaveLength(2)
      pythonFrameworks.forEach(item => {
        expect(item.metadata?.language).toBe('Python')
        expect(item.metadata?.type).toBe('framework')
      })
    })

    it('should handle range queries with Brain Patterns', async () => {
      const modernFrameworks = await brain.search('*', { limit: 10,
        metadata: {
          type: 'framework',
          year: { greaterThan: 2010 }
        }
      })
      
      expect(modernFrameworks).toHaveLength(1) // Only FastAPI (2018)
      expect(modernFrameworks[0].metadata?.name).toBe('FastAPI')
    })

    it('should handle multiple range conditions', async () => {
      const earlyFrameworks = await brain.search('*', { limit: 10,
        metadata: {
          year: { 
            greaterThan: 2000, 
            lessThan: 2010 
          }
        }
      })
      
      expect(earlyFrameworks).toHaveLength(2) // Django (2005) and Rails (2004)
      earlyFrameworks.forEach(item => {
        expect(item.metadata?.year).toBeGreaterThan(2000)
        expect(item.metadata?.year).toBeLessThan(2010)
      })
    })

    it('should return empty results for non-matching filters', async () => {
      const results = await brain.search('*', { limit: 10,
        metadata: { language: 'NonExistent' }
      })
      
      expect(results).toHaveLength(0)
    })
  })

  describe('Statistics and Monitoring', () => {
    it('should provide basic statistics', async () => {
      await brain.addNoun({ name: 'Item1' })
      await brain.addNoun({ name: 'Item2' })
      
      const stats = await brain.getStatistics()
      
      expect(stats).toHaveProperty('nounCount')
      expect(stats).toHaveProperty('verbCount')
      expect(stats).toHaveProperty('hnswIndexSize')
      
      expect(stats.nounCount).toBeGreaterThanOrEqual(2)
      expect(stats.verbCount).toBe(0)
      expect(typeof stats.hnswIndexSize).toBe('number')
    })

    it('should handle statistics for empty database', async () => {
      const stats = await brain.getStatistics()
      
      expect(stats.nounCount).toBe(0)
      expect(stats.verbCount).toBe(0)
    })
  })

  describe('Bulk Operations', () => {
    it('should search all items with wildcard', async () => {
      await brain.addNoun({ name: 'Item1', category: 'test' })
      await brain.addNoun({ name: 'Item2', category: 'test' })
      await brain.addNoun({ name: 'Item3', category: 'test' })
      
      const allItems = await brain.search('*', { limit: 100 })
      
      expect(allItems).toHaveLength(3)
      allItems.forEach(item => {
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('metadata')
        expect(item.metadata?.category).toBe('test')
      })
    })

    it('should clear database with clearAll', async () => {
      await brain.addNoun({ name: 'Item1' })
      await brain.addNoun({ name: 'Item2' })
      
      // Verify items exist
      expect((await brain.search('*', { limit: 100 }))).toHaveLength(2)
      
      // Clear database
      await brain.clearAll({ force: true })
      
      // Verify empty
      expect((await brain.search('*', { limit: 100 }))).toHaveLength(0)
      expect((await brain.getStatistics()).nounCount).toBe(0)
    })

    it('should require force flag for clearAll', async () => {
      await brain.addNoun({ name: 'Item1' })
      
      await expect(brain.clearAll()).rejects.toThrow(/force.*true/)
      
      // Data should still be there
      expect((await brain.search('*', { limit: 100 }))).toHaveLength(1)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string input', async () => {
      const id = await brain.addNoun('')
      expect(id).toBeTypeOf('string')
      
      const retrieved = await brain.getNoun(id)
      expect(retrieved).toBeTruthy()
    })

    it('should handle null/undefined metadata gracefully', async () => {
      const id1 = await brain.addNoun(null as any)
      const id2 = await brain.addNoun(undefined as any)
      
      expect(id1).toBeTypeOf('string')
      expect(id2).toBeTypeOf('string')
    })

    it('should handle complex nested metadata', async () => {
      const complexData = {
        name: 'Complex Item',
        nested: {
          level1: {
            level2: {
              deep: 'value'
            }
          }
        },
        array: [1, 2, 3, { nested: true }],
        boolean: true,
        number: 42
      }
      
      const id = await brain.addNoun(complexData)
      const retrieved = await brain.getNoun(id)
      
      expect(retrieved?.metadata?.nested?.level1?.level2?.deep).toBe('value')
      expect(retrieved?.metadata?.array).toEqual([1, 2, 3, { nested: true }])
      expect(retrieved?.metadata?.boolean).toBe(true)
      expect(retrieved?.metadata?.number).toBe(42)
    })
  })
})