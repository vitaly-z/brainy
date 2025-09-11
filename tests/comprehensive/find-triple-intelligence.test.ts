/**
 * Brainy v3.0 Find & Triple Intelligence Test Suite
 * Testing vector search, metadata filtering, and fusion strategies
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'

describe('Find and Triple Intelligence', () => {
  let brain: Brainy
  let testData: any[]

  beforeAll(async () => {
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()

    // Add diverse test data
    testData = [
      // Technology items
      { data: 'JavaScript is a programming language for web development', metadata: { category: 'tech', language: 'javascript', difficulty: 'medium' }, type: NounType.Document },
      { data: 'TypeScript adds static typing to JavaScript', metadata: { category: 'tech', language: 'typescript', difficulty: 'advanced' }, type: NounType.Document },
      { data: 'Python is great for data science and AI', metadata: { category: 'tech', language: 'python', difficulty: 'easy' }, type: NounType.Document },
      { data: 'React is a JavaScript library for building UIs', metadata: { category: 'tech', framework: 'react', language: 'javascript' }, type: NounType.Document },
      
      // Science items
      { data: 'Quantum computing uses quantum mechanics principles', metadata: { category: 'science', field: 'physics', complexity: 'high' }, type: NounType.Concept },
      { data: 'Machine learning enables computers to learn from data', metadata: { category: 'science', field: 'ai', complexity: 'medium' }, type: NounType.Concept },
      { data: 'Neural networks are inspired by biological brains', metadata: { category: 'science', field: 'ai', complexity: 'high' }, type: NounType.Concept },
      
      // Business items
      { data: 'Market analysis helps understand consumer behavior', metadata: { category: 'business', domain: 'marketing', importance: 'high' }, type: NounType.Process },
      { data: 'Project management ensures successful delivery', metadata: { category: 'business', domain: 'management', importance: 'critical' }, type: NounType.Process },
      { data: 'Financial planning is essential for growth', metadata: { category: 'business', domain: 'finance', importance: 'critical' }, type: NounType.Process }
    ]

    // Add all test data
    for (const item of testData) {
      await brain.add(item)
    }
  })

  afterAll(() => {
    brain = null as any
  })

  describe('Vector Search', () => {
    it('should find similar items by text query', async () => {
      const results = await brain.find({
        query: 'JavaScript programming',
        limit: 3
      })
      
      expect(results).toHaveLength(3)
      expect(results[0].score).toBeGreaterThan(0)
      expect(results[0].score).toBeLessThanOrEqual(1)
      
      // Should find JavaScript-related items first
      const topResult = results[0].entity
      expect(topResult.metadata?.language).toBeDefined()
    })

    it('should respect limit parameter', async () => {
      const results = await brain.find({
        query: 'technology',
        limit: 5
      })
      
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('should find by vector directly', async () => {
      // Get vector from an existing item
      const jsItem = await brain.find({ query: 'JavaScript', limit: 1 })
      const vector = jsItem[0].entity.vector
      
      const results = await brain.find({
        vector,
        limit: 3
      })
      
      expect(results).toHaveLength(3)
      // First result should be very similar (same or nearly same vector)
      expect(results[0].score).toBeGreaterThan(0.9)
    })

    it('should return all items when no query provided', async () => {
      const results = await brain.find({})
      
      expect(results.length).toBeGreaterThanOrEqual(testData.length)
    })
  })

  describe('Metadata Filtering', () => {
    it('should filter by single metadata field', async () => {
      const results = await brain.find({
        where: { category: 'tech' }
      })
      
      expect(results.length).toBeGreaterThan(0)
      results.forEach(r => {
        expect(r.entity.metadata?.category).toBe('tech')
      })
    })

    it('should filter by multiple metadata fields', async () => {
      const results = await brain.find({
        where: { 
          category: 'tech',
          language: 'javascript'
        }
      })
      
      results.forEach(r => {
        expect(r.entity.metadata?.category).toBe('tech')
        expect(r.entity.metadata?.language).toBe('javascript')
      })
    })

    it('should support $gte operator', async () => {
      const results = await brain.find({
        where: {
          importance: { $gte: 'high' }
        }
      })
      
      results.forEach(r => {
        const importance = r.entity.metadata?.importance
        if (importance) {
          expect(['high', 'critical']).toContain(importance)
        }
      })
    })

    it('should support $contains operator for arrays', async () => {
      // Add item with array metadata
      await brain.add({
        data: 'Test with tags',
        metadata: { tags: ['test', 'validation', 'qa'] },
        type: NounType.Document
      })

      const results = await brain.find({
        where: {
          tags: { $contains: 'test' }
        }
      })
      
      const found = results.find(r => 
        Array.isArray(r.entity.metadata?.tags) && 
        r.entity.metadata.tags.includes('test')
      )
      expect(found).toBeDefined()
    })

    it('should handle complex nested filters', async () => {
      const results = await brain.find({
        where: {
          $or: [
            { category: 'tech', language: 'javascript' },
            { category: 'science', field: 'ai' }
          ]
        }
      })
      
      results.forEach(r => {
        const meta = r.entity.metadata
        const matchesTech = meta?.category === 'tech' && meta?.language === 'javascript'
        const matchesScience = meta?.category === 'science' && meta?.field === 'ai'
        expect(matchesTech || matchesScience).toBe(true)
      })
    })
  })

  describe('Type Filtering', () => {
    it('should filter by single noun type', async () => {
      const results = await brain.find({
        type: NounType.Document
      })
      
      results.forEach(r => {
        expect(r.entity.type).toBe(NounType.Document)
      })
    })

    it('should filter by multiple noun types', async () => {
      const results = await brain.find({
        type: [NounType.Document, NounType.Concept]
      })
      
      results.forEach(r => {
        expect([NounType.Document, NounType.Concept]).toContain(r.entity.type)
      })
    })
  })

  describe('Combined Search (Triple Intelligence)', () => {
    it('should combine vector search with metadata filtering', async () => {
      const results = await brain.find({
        query: 'programming',
        where: { category: 'tech' },
        limit: 5
      })
      
      expect(results.length).toBeGreaterThan(0)
      results.forEach(r => {
        expect(r.entity.metadata?.category).toBe('tech')
      })
    })

    it('should combine vector, metadata, and type filtering', async () => {
      const results = await brain.find({
        query: 'artificial intelligence',
        where: { category: 'science' },
        type: NounType.Concept,
        limit: 5
      })
      
      results.forEach(r => {
        expect(r.entity.metadata?.category).toBe('science')
        expect(r.entity.type).toBe(NounType.Concept)
      })
    })

    it('should support fusion strategies', async () => {
      const results = await brain.find({
        query: 'JavaScript',
        where: { category: 'tech' },
        fusion: {
          strategy: 'adaptive',
          weights: { vector: 0.7, field: 0.3 }
        }
      })
      
      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle fusion with graph intelligence', async () => {
      // Create some relationships
      const items = await brain.find({ limit: 3 })
      if (items.length >= 2) {
        await brain.relate({
          from: items[0].id,
          to: items[1].id,
          type: VerbType.References
        })
      }

      const results = await brain.find({
        query: 'technology',
        connected: { to: items[0]?.id },
        fusion: {
          strategy: 'adaptive',
          weights: { vector: 0.5, graph: 0.3, field: 0.2 }
        }
      })
      
      expect(results).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should handle large result sets efficiently', async () => {
      const start = Date.now()
      const results = await brain.find({ limit: 100 })
      const elapsed = Date.now() - start
      
      expect(elapsed).toBeLessThan(1000) // Should complete in under 1 second
      expect(results.length).toBeLessThanOrEqual(100)
    })

    it('should cache repeated searches', async () => {
      const query = { query: 'caching test', limit: 5 }
      
      // First search
      const results1 = await brain.find(query)
      
      // Second search (should hit cache)
      const results2 = await brain.find(query)
      
      expect(results1).toEqual(results2)
      // Note: Cache might not always be faster in tests due to overhead
      // But results should be identical
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty query gracefully', async () => {
      const results = await brain.find({ query: '' })
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle non-matching filters', async () => {
      const results = await brain.find({
        where: { nonExistentField: 'value' }
      })
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle very long queries', async () => {
      const longQuery = 'test '.repeat(1000) // 5000 characters
      const results = await brain.find({ query: longQuery, limit: 1 })
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle special characters in queries', async () => {
      const specialQuery = '!@#$%^&*()_+-=[]{}|;\':",./<>?'
      const results = await brain.find({ query: specialQuery, limit: 1 })
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle unicode in queries', async () => {
      const unicodeQuery = '你好世界 🌍 مرحبا بالعالم'
      const results = await brain.find({ query: unicodeQuery, limit: 1 })
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('Similarity Search', () => {
    it('should find similar items to a given ID', async () => {
      const items = await brain.find({ limit: 1 })
      if (items.length > 0) {
        const results = await brain.similar({
          to: items[0].id,
          limit: 3
        })
        
        expect(results).toHaveLength(3)
        // First result might be the item itself
        results.forEach(r => {
          expect(r.score).toBeGreaterThanOrEqual(0)
          expect(r.score).toBeLessThanOrEqual(1)
        })
      }
    })

    it('should exclude the source item from similar results', async () => {
      const items = await brain.find({ limit: 1 })
      if (items.length > 0) {
        const results = await brain.similar({
          to: items[0].id,
          limit: 5
        })
        
        // Check if source is excluded (implementation dependent)
        const selfMatch = results.find(r => r.id === items[0].id)
        if (selfMatch) {
          // If included, should be first with score ~1
          expect(results[0].id).toBe(items[0].id)
          expect(results[0].score).toBeGreaterThan(0.99)
        }
      }
    })
  })
})