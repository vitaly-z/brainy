/**
 * Universal Display Augmentation Tests
 * 
 * Comprehensive test suite for the display augmentation system
 * including AI-powered field computation, caching, and CLI integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData } from '../src/brainyData.js'
import { UniversalDisplayAugmentation } from '../src/augmentations/universalDisplayAugmentation.js'
import { DisplayCache } from '../src/augmentations/display/cache.js'
import { IntelligentComputationEngine } from '../src/augmentations/display/intelligentComputation.js'

describe('Universal Display Augmentation', () => {
  let brainy: BrainyData
  let displayAugmentation: UniversalDisplayAugmentation

  beforeEach(async () => {
    // Use in-memory storage for tests
    brainy = new BrainyData({
      storage: { forceMemoryStorage: true },
      verbose: false
    })
    
    await brainy.init()
    
    // Get display augmentation (should be enabled by default)
    const augmentations = (brainy as any).augmentations
    displayAugmentation = augmentations?.get('display')
  })

  afterEach(async () => {
    if (brainy) {
      await brainy.clearAll({ force: true })
    }
  })

  describe('Augmentation Setup', () => {
    it('should be enabled by default', () => {
      expect(displayAugmentation).toBeDefined()
      expect(displayAugmentation.name).toBe('display')
      expect(displayAugmentation.version).toBe('1.0.0')
    })

    it('should have correct metadata access configuration', () => {
      expect(displayAugmentation.metadata).toEqual({
        reads: '*',
        writes: ['_display']
      })
    })

    it('should declare computed fields', () => {
      expect(displayAugmentation.computedFields).toBeDefined()
      expect(displayAugmentation.computedFields.display).toBeDefined()
      expect(displayAugmentation.computedFields.display.title).toEqual({
        type: 'string',
        description: 'Primary display name (AI-computed)'
      })
    })

    it('should have correct operation targeting', () => {
      expect(displayAugmentation.operations).toContain('get')
      expect(displayAugmentation.operations).toContain('search')
      expect(displayAugmentation.operations).toContain('findSimilar')
    })
  })

  describe('Display Field Computation', () => {
    it('should enhance noun results with display fields', async () => {
      // Add test data
      const id = await brainy.addNoun('John Doe', {
        type: 'Person',
        role: 'CEO',
        company: 'Acme Corp'
      })

      // Get the enhanced result
      const result = await brainy.getNoun(id)
      
      // Should have display capabilities
      expect(result.getDisplay).toBeDefined()
      expect(typeof result.getDisplay).toBe('function')
      
      // Test display fields
      const displayFields = await result.getDisplay()
      expect(displayFields).toBeDefined()
      expect(displayFields.title).toBeDefined()
      expect(displayFields.type).toBeDefined()
      expect(displayFields.icon).toBeDefined()
      expect(displayFields.description).toBeDefined()
      expect(displayFields.confidence).toBeGreaterThan(0)
    })

    it('should provide type-appropriate icons', async () => {
      const testCases = [
        { data: 'Apple Inc', metadata: { type: 'Organization' }, expectedIcon: '🏢' },
        { data: 'Jane Smith', metadata: { type: 'Person' }, expectedIcon: '👤' },
        { data: 'San Francisco', metadata: { type: 'Location' }, expectedIcon: '📍' },
        { data: 'Machine Learning', metadata: { type: 'Concept' }, expectedIcon: '💭' }
      ]

      for (const testCase of testCases) {
        const id = await brainy.addNoun(testCase.data, testCase.metadata)
        const result = await brainy.getNoun(id)
        const displayFields = await result.getDisplay()
        
        expect(displayFields.icon).toBe(testCase.expectedIcon)
        expect(displayFields.type).toBeDefined()
      }
    })

    it('should handle missing or minimal metadata gracefully', async () => {
      // Add data with minimal metadata
      const id = await brainy.addNoun('Some random text')
      const result = await brainy.getNoun(id)
      
      const displayFields = await result.getDisplay()
      expect(displayFields.title).toBeDefined()
      expect(displayFields.type).toBeDefined()
      expect(displayFields.icon).toBeDefined()
      expect(displayFields.confidence).toBeGreaterThan(0)
    })

    it('should compute enhanced descriptions', async () => {
      const id = await brainy.addNoun('Tesla Model 3', {
        type: 'Product',
        category: 'Electric Vehicle',
        manufacturer: 'Tesla'
      })
      
      const result = await brainy.getNoun(id)
      const displayFields = await result.getDisplay()
      
      expect(displayFields.description).toBeDefined()
      expect(displayFields.description.length).toBeGreaterThan(displayFields.title.length)
    })
  })

  describe('Search Result Enhancement', () => {
    beforeEach(async () => {
      // Add test data for search
      await brainy.addNoun('John Doe', { type: 'Person', role: 'CEO' })
      await brainy.addNoun('Apple Inc', { type: 'Organization', industry: 'Technology' })
      await brainy.addNoun('MacBook Pro', { type: 'Product', brand: 'Apple' })
    })

    it('should enhance search results', async () => {
      const results = await brainy.search('CEO', { limit: 5 })
      expect(results.length).toBeGreaterThan(0)
      
      // Check that results are enhanced
      const firstResult = results[0]
      expect(firstResult.getDisplay).toBeDefined()
      
      const displayFields = await firstResult.getDisplay()
      expect(displayFields.title).toBeDefined()
      expect(displayFields.icon).toBeDefined()
    })

    it('should maintain search scores while adding display fields', async () => {
      const results = await brainy.search('Apple', { limit: 5 })
      expect(results.length).toBeGreaterThan(0)
      
      const firstResult = results[0]
      expect(firstResult.score).toBeDefined()
      expect(firstResult.getDisplay).toBeDefined()
    })
  })

  describe('Verb Display Enhancement', () => {
    it('should enhance verb relationships with display fields', async () => {
      // Add entities and relationship
      const johnId = await brainy.addNoun('John Doe', { type: 'Person' })
      const appleId = await brainy.addNoun('Apple Inc', { type: 'Organization' })
      const verbId = await brainy.addVerb(johnId, appleId, 'WorksFor')
      
      // Get the enhanced verb
      const verb = await brainy.getVerb(verbId)
      expect(verb.getDisplay).toBeDefined()
      
      const displayFields = await verb.getDisplay()
      expect(displayFields.relationship).toBeDefined()
      expect(displayFields.icon).toBeDefined()
      expect(displayFields.type).toBeDefined()
    })
  })

  describe('Caching System', () => {
    it('should cache computed display fields', async () => {
      const id = await brainy.addNoun('Test Entity', { type: 'Concept' })
      const result = await brainy.getNoun(id)
      
      // First computation
      const displayFields1 = await result.getDisplay()
      
      // Second computation should be cached
      const displayFields2 = await result.getDisplay()
      
      // Should be identical (cached)
      expect(displayFields1).toEqual(displayFields2)
      
      // Check cache statistics
      const stats = displayAugmentation.getStats()
      expect(stats.totalComputations).toBeGreaterThan(0)
    })

    it('should provide cache statistics', () => {
      const stats = displayAugmentation.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalComputations).toBeDefined()
      expect(stats.cacheHitRatio).toBeDefined()
      expect(stats.averageComputationTime).toBeDefined()
    })
  })

  describe('Helper Methods', () => {
    it('should provide getAvailableFields method', async () => {
      const id = await brainy.addNoun('Test Entity')
      const result = await brainy.getNoun(id)
      
      expect(result.getAvailableFields).toBeDefined()
      const fields = result.getAvailableFields('display')
      expect(Array.isArray(fields)).toBe(true)
      expect(fields).toContain('title')
      expect(fields).toContain('description')
      expect(fields).toContain('type')
      expect(fields).toContain('icon')
    })

    it('should provide getAvailableAugmentations method', async () => {
      const id = await brainy.addNoun('Test Entity')
      const result = await brainy.getNoun(id)
      
      expect(result.getAvailableAugmentations).toBeDefined()
      const augs = result.getAvailableAugmentations()
      expect(Array.isArray(augs)).toBe(true)
      expect(augs).toContain('display')
    })

    it('should provide explore method for debugging', async () => {
      const id = await brainy.addNoun('Test Entity', { type: 'Concept', description: 'Test' })
      const result = await brainy.getNoun(id)
      
      expect(result.explore).toBeDefined()
      
      // Should not throw when called
      await expect(result.explore()).resolves.toBeUndefined()
    })
  })

  describe('Configuration', () => {
    it('should support runtime configuration', () => {
      const newConfig = {
        enabled: false,
        cacheSize: 500
      }
      
      displayAugmentation.configure(newConfig)
      
      // Configuration should be applied
      expect((displayAugmentation as any).config.enabled).toBe(false)
      expect((displayAugmentation as any).config.cacheSize).toBe(500)
    })

    it('should clear cache when disabled', () => {
      displayAugmentation.configure({ enabled: false })
      
      // Cache should be cleared
      const stats = displayAugmentation.getStats()
      expect(stats.totalComputations).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle computation errors gracefully', async () => {
      // Add data that might cause computation issues
      const id = await brainy.addNoun('')  // Empty string
      const result = await brainy.getNoun(id)
      
      // Should still provide display fields, even if basic
      const displayFields = await result.getDisplay()
      expect(displayFields).toBeDefined()
      expect(displayFields.title).toBeDefined()
      expect(displayFields.icon).toBeDefined()
    })

    it('should work without AI components', async () => {
      // Test fallback to heuristic-based computation
      const id = await brainy.addNoun('Test Without AI', { type: 'Thing' })
      const result = await brainy.getNoun(id)
      
      // Should still work with heuristic fallback
      const displayFields = await result.getDisplay()
      expect(displayFields).toBeDefined()
      expect(displayFields.title).toBeDefined()
      expect(displayFields.type).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should have reasonable computation times', async () => {
      const startTime = Date.now()
      
      const id = await brainy.addNoun('Performance Test Entity', {
        type: 'Concept',
        description: 'Testing performance characteristics'
      })
      
      const result = await brainy.getNoun(id)
      await result.getDisplay()
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should complete within reasonable time (adjust based on system capabilities)
      expect(duration).toBeLessThan(5000) // 5 seconds max
    })

    it('should handle batch operations efficiently', async () => {
      const startTime = Date.now()
      const ids: string[] = []
      
      // Add multiple entities
      for (let i = 0; i < 10; i++) {
        const id = await brainy.addNoun(`Test Entity ${i}`, { type: 'Concept' })
        ids.push(id)
      }
      
      // Get display fields for all
      const displayPromises = ids.map(async id => {
        const result = await brainy.getNoun(id)
        return result.getDisplay()
      })
      
      await Promise.all(displayPromises)
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Batch should be reasonably fast
      expect(duration).toBeLessThan(10000) // 10 seconds max for 10 items
    })
  })

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', async () => {
      // Should not throw
      await expect(displayAugmentation.shutdown()).resolves.toBeUndefined()
    })

    it('should clear cache on shutdown', async () => {
      displayAugmentation.clearCache()
      
      const stats = displayAugmentation.getStats()
      expect(stats.totalComputations).toBe(0)
      expect(stats.cacheHitRatio).toBe(0)
    })
  })
})

describe('Display Cache', () => {
  let cache: DisplayCache

  beforeEach(() => {
    cache = new DisplayCache(100)
  })

  it('should store and retrieve display fields', () => {
    const testFields = {
      title: 'Test Title',
      description: 'Test Description', 
      type: 'Test Type',
      icon: '📝',
      tags: ['test'],
      confidence: 0.9,
      computedAt: Date.now(),
      version: '1.0.0'
    }

    const key = cache.generateKey('test-id', { name: 'test' }, 'noun')
    cache.set(key, testFields)
    
    const retrieved = cache.get(key)
    expect(retrieved).toEqual(testFields)
  })

  it('should implement LRU eviction', () => {
    const smallCache = new DisplayCache(2)
    
    const fields = {
      title: 'Test',
      description: 'Test',
      type: 'Test',
      icon: '📝',
      tags: [],
      confidence: 0.9,
      computedAt: Date.now(),
      version: '1.0.0'
    }

    // Fill cache to capacity
    smallCache.set('key1', fields)
    smallCache.set('key2', fields)
    
    // Add one more (should evict oldest)
    smallCache.set('key3', fields)
    
    // key1 should be evicted
    expect(smallCache.get('key1')).toBeNull()
    expect(smallCache.get('key2')).toBeDefined()
    expect(smallCache.get('key3')).toBeDefined()
  })

  it('should generate consistent cache keys', () => {
    const data = { name: 'test', type: 'Person' }
    
    const key1 = cache.generateKey('id-123', data, 'noun')
    const key2 = cache.generateKey('id-123', data, 'noun')
    
    expect(key1).toBe(key2)
    
    // Different entity type should produce different key
    const key3 = cache.generateKey('id-123', data, 'verb')
    expect(key1).not.toBe(key3)
  })

  it('should provide cache statistics', () => {
    const fields = {
      title: 'Test',
      description: 'Test',
      type: 'Test',
      icon: '📝',
      tags: [],
      confidence: 0.9,
      computedAt: Date.now(),
      version: '1.0.0'
    }

    cache.set('test-key', fields, 100) // 100ms computation time
    cache.get('test-key') // Hit
    cache.get('nonexistent') // Miss
    
    const stats = cache.getStats()
    expect(stats.totalComputations).toBe(1)
    expect(stats.cacheHitRatio).toBe(0.5) // 1 hit, 1 miss
    expect(stats.averageComputationTime).toBe(100)
  })
})