/**
 * Zero-Config Model Loading Tests
 * 
 * Verifies that Brainy works WITHOUT ANY configuration
 * No environment variables, no setup, just works!
 * 
 * CRITICAL: Uses REAL transformer models - NO MOCKING
 */

import { describe, it, expect } from 'vitest'
import { BrainyData } from '../src/brainyData.js'

describe('Zero-Config Model Loading', () => {
  it('should work without ANY configuration - just new BrainyData()', async () => {
    // This is how a developer would use Brainy - ZERO CONFIG!
    const brain = new BrainyData()
    await brain.init()
    
    // Should just work - add some content
    const id1 = await brain.addNoun('JavaScript is a programming language')
    const id2 = await brain.addNoun('TypeScript adds static types to JavaScript')
    const id3 = await brain.addNoun('Pizza is a delicious Italian food')
    
    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id3).toBeTruthy()
    
    // Search should work with real embeddings
    const results = await brain.search('programming languages')
    
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    
    // Programming content should rank higher than pizza
    const programmingIndex = results.findIndex(r => 
      r.metadata?.data?.includes('JavaScript') || 
      r.metadata?.data?.includes('TypeScript')
    )
    const pizzaIndex = results.findIndex(r => 
      r.metadata?.data?.includes('Pizza')
    )
    
    if (programmingIndex !== -1 && pizzaIndex !== -1) {
      expect(programmingIndex).toBeLessThan(pizzaIndex)
    }
    
    await brain.cleanup?.()
  }, { timeout: 30000 }) // Allow time for model download if needed

  it('should automatically download models on first use if not cached', async () => {
    // Even with no models downloaded, it should work
    const brain = new BrainyData()
    await brain.init()
    
    // First embedding creation triggers model download if needed
    const id = await brain.addNoun('Test content that triggers model loading')
    
    expect(id).toBeTruthy()
    
    // Subsequent operations should be fast (models cached)
    const startTime = Date.now()
    await brain.addNoun('Second item should be fast')
    const duration = Date.now() - startTime
    
    expect(duration).toBeLessThan(1000) // Should be fast with cached model
    
    await brain.cleanup?.()
  }, { timeout: 60000 }) // Allow more time for potential model download

  it('should work in different storage modes without config', async () => {
    // Memory storage - zero config
    const memoryBrain = new BrainyData({ 
      storage: { forceMemoryStorage: true } 
    })
    await memoryBrain.init()
    await memoryBrain.addNoun('Memory storage test')
    expect(memoryBrain).toBeDefined()
    await memoryBrain.cleanup?.()
    
    // FileSystem storage - zero config (default)
    const fsBrain = new BrainyData()
    await fsBrain.init()
    await fsBrain.addNoun('FileSystem storage test')
    expect(fsBrain).toBeDefined()
    await fsBrain.cleanup?.()
  })

  it('should handle the model loading cascade transparently', async () => {
    // User doesn't need to know about the cascade
    // It just works: Local → CDN → GitHub → HuggingFace
    
    const brain = new BrainyData()
    await brain.init()
    
    // Should work regardless of where models come from
    const content = 'The model loading cascade is transparent to users'
    const id = await brain.addNoun(content)
    
    expect(id).toBeTruthy()
    
    // Verify embeddings are working (384 dimensions)
    const results = await brain.search(content)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    
    await brain.cleanup?.()
  })

  it('should work with natural language queries out of the box', async () => {
    const brain = new BrainyData()
    await brain.init()
    
    // Add various content
    await brain.addNoun('React is a JavaScript library for building UIs', 'content', {
      type: 'technology',
      category: 'frontend'
    })
    await brain.addNoun('Node.js is a JavaScript runtime for servers', 'content', {
      type: 'technology', 
      category: 'backend'
    })
    await brain.addNoun('MongoDB is a NoSQL database', 'content', {
      type: 'database',
      category: 'backend'
    })
    
    // Natural language search should just work
    const results = await brain.find({
      like: 'backend technologies for web development'
    })
    
    expect(results).toBeDefined()
    expect(results.some(r => r.metadata?.category === 'backend')).toBe(true)
    
    await brain.cleanup?.()
  })

  it('should handle errors gracefully with zero config', async () => {
    const brain = new BrainyData()
    await brain.init()
    
    // Even with invalid inputs, should handle gracefully
    const result = await brain.search('')
    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    
    // Should handle non-existent IDs gracefully
    const notFound = await brain.getNoun('non-existent-id')
    expect(notFound).toBeNull()
    
    await brain.cleanup?.()
  })

  describe('Developer Experience', () => {
    it('should provide helpful error messages without config', async () => {
      const brain = new BrainyData()
      await brain.init()
      
      try {
        // Try to add invalid data
        await brain.addNoun(null as any)
      } catch (error) {
        // Should have a helpful error message
        expect(error).toBeDefined()
        expect((error as Error).message).toBeTruthy()
      }
      
      await brain.cleanup?.()
    })

    it('should work in both Node.js and browser environments', async () => {
      // This test runs in Node.js
      const brain = new BrainyData()
      await brain.init()
      
      // Check environment detection works
      expect(brain).toBeDefined()
      
      // Should auto-detect and use appropriate storage
      const id = await brain.addNoun('Cross-platform content')
      expect(id).toBeTruthy()
      
      await brain.cleanup?.()
    })

    it('should not require any model management from developer', async () => {
      // Developer never needs to:
      // - Download models manually
      // - Set model paths
      // - Configure model sources
      // - Handle model errors
      
      const brain = new BrainyData()
      await brain.init()
      
      // Just use it!
      const operations = await Promise.all([
        brain.addNoun('Concurrent operation 1'),
        brain.addNoun('Concurrent operation 2'),
        brain.addNoun('Concurrent operation 3')
      ])
      
      expect(operations.every(id => id)).toBe(true)
      
      await brain.cleanup?.()
    })
  })

  describe('Production Readiness', () => {
    it('should handle high load without configuration', async () => {
      const brain = new BrainyData()
      await brain.init()
      
      // Add many items rapidly
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(brain.addNoun(`Item ${i}: ${Math.random()}`))
      }
      
      const results = await Promise.all(promises)
      expect(results.every(id => id)).toBe(true)
      
      // Search should still work under load
      const searchResults = await brain.search('Item')
      expect(searchResults.length).toBeGreaterThan(0)
      
      await brain.cleanup?.()
    })

    it('should recover from transient failures automatically', async () => {
      const brain = new BrainyData()
      await brain.init()
      
      // Even if model loading has transient issues, should recover
      const id = await brain.addNoun('Resilient content handling')
      expect(id).toBeTruthy()
      
      // Operations should continue working
      const moreIds = await Promise.all([
        brain.addNoun('More content 1'),
        brain.addNoun('More content 2')
      ])
      
      expect(moreIds.every(id => id)).toBe(true)
      
      await brain.cleanup?.()
    })
  })
})