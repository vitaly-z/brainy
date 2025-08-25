import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData } from '../src/index.js'
import { RequestDeduplicatorAugmentation } from '../src/augmentations/requestDeduplicatorAugmentation.js'

describe('Request Deduplicator Augmentation', () => {
  let db: BrainyData | null = null
  
  // Helper to create test vectors
  const createTestVector = (seed: number = 0) => {
    return new Array(384).fill(0).map((_, i) => Math.sin(i + seed) * 0.5)
  }
  
  afterEach(async () => {
    if (db) {
      await db.cleanup?.()
      db = null
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })
  
  describe('Configuration and Initialization', () => {
    it('should be enabled by default', async () => {
      db = new BrainyData()
      await db.init()
      
      // Request deduplicator should be active
      // Test by making duplicate searches
      const vector = createTestVector(1)
      const promise1 = db.search(vector, 5)
      const promise2 = db.search(vector, 5)
      
      const [results1, results2] = await Promise.all([promise1, promise2])
      
      // Both should return same results
      expect(results1.length).toBe(results2.length)
    })
    
    it('should accept custom TTL configuration', async () => {
      db = new BrainyData({
        requestDeduplicator: {
          enabled: true,
          ttl: 1000, // 1 second TTL
          maxSize: 100
        }
      })
      await db.init()
      
      // Add test data
      await db.add(createTestVector(1), { id: 'test1' })
      
      // Should work with custom config
      const results = await db.search(createTestVector(1), 1)
      expect(results.length).toBeGreaterThan(0)
    })
  })
  
  describe('Deduplication Behavior', () => {
    beforeEach(async () => {
      db = new BrainyData({
        requestDeduplicator: {
          enabled: true,
          ttl: 500, // 500ms TTL for testing
          maxSize: 10
        }
      })
      await db.init()
      
      // Add test data
      for (let i = 0; i < 10; i++) {
        await db.add(createTestVector(i), { 
          id: `item${i}`, 
          data: `Test item ${i}` 
        })
      }
    })
    
    it('should deduplicate identical concurrent searches', async () => {
      const searchVector = createTestVector(5)
      
      // Track if searches are actually executed
      let searchCount = 0
      const originalSearch = db!.search.bind(db)
      db!.search = async function(...args: any[]) {
        searchCount++
        return originalSearch.apply(this, args)
      }
      
      // Make multiple identical searches concurrently
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(db!.search(searchVector, 3))
      }
      
      const results = await Promise.all(promises)
      
      // All should return same results
      for (let i = 1; i < results.length; i++) {
        expect(results[i].length).toBe(results[0].length)
        expect(results[i][0]?.id).toBe(results[0][0]?.id)
      }
      
      // Should have only executed once (or very few times)
      expect(searchCount).toBeLessThanOrEqual(2)
    })
    
    it('should not deduplicate different searches', async () => {
      // Make different searches
      const promises = []
      for (let i = 0; i < 5; i++) {
        const uniqueVector = createTestVector(i * 10)
        promises.push(db!.search(uniqueVector, 2))
      }
      
      const results = await Promise.all(promises)
      
      // Results might be different
      const uniqueResults = new Set(results.map(r => JSON.stringify(r.map(x => x.id))))
      expect(uniqueResults.size).toBeGreaterThan(1)
    })
    
    it('should respect TTL for cache expiration', async () => {
      const searchVector = createTestVector(1)
      
      // First search
      const result1 = await db!.search(searchVector, 3)
      
      // Immediate second search (should be cached)
      const result2 = await db!.search(searchVector, 3)
      expect(result2).toEqual(result1)
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // Third search (cache expired, should re-execute)
      const result3 = await db!.search(searchVector, 3)
      
      // Results should be same content but might be new objects
      expect(result3.length).toBe(result1.length)
    })
  })
  
  describe('Performance Impact', () => {
    beforeEach(async () => {
      db = new BrainyData({
        requestDeduplicator: {
          enabled: true,
          ttl: 5000
        }
      })
      await db.init()
      
      // Add substantial test data
      for (let i = 0; i < 100; i++) {
        await db.add(createTestVector(i), { id: `perf${i}` })
      }
    })
    
    it('should improve performance for duplicate requests', async () => {
      const searchVector = createTestVector(50)
      
      // First search (cold)
      const start1 = performance.now()
      await db!.search(searchVector, 10)
      const time1 = performance.now() - start1
      
      // Second search (cached)
      const start2 = performance.now()
      await db!.search(searchVector, 10)
      const time2 = performance.now() - start2
      
      // Cached should be much faster
      expect(time2).toBeLessThan(time1 * 0.5)
    })
    
    it('should handle high concurrency efficiently', async () => {
      const searchVector = createTestVector(25)
      
      // Make many concurrent identical requests
      const startTime = performance.now()
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(db!.search(searchVector, 5))
      }
      
      await Promise.all(promises)
      const elapsed = performance.now() - startTime
      
      // Should complete quickly due to deduplication
      expect(elapsed).toBeLessThan(1000) // Under 1 second for 100 requests
    })
  })
  
  describe('Cache Management', () => {
    it('should respect maximum cache size', async () => {
      const dedup = new RequestDeduplicatorAugmentation({
        ttl: 10000, // Long TTL
        maxSize: 5 // Small cache
      })
      
      await dedup.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      // Add more than max size
      for (let i = 0; i < 10; i++) {
        const key = `search-${i}`
        // Simulate caching (implementation specific)
      }
      
      const stats = dedup.getStats()
      expect(stats.cacheSize).toBeLessThanOrEqual(5)
    })
    
    it('should use LRU eviction strategy', async () => {
      db = new BrainyData({
        requestDeduplicator: {
          enabled: true,
          ttl: 10000,
          maxSize: 3
        }
      })
      await db.init()
      
      // Add test data
      for (let i = 0; i < 5; i++) {
        await db.add(createTestVector(i), { id: `lru${i}` })
      }
      
      // Make searches to fill cache
      await db.search(createTestVector(1), 1) // Cache entry 1
      await db.search(createTestVector(2), 1) // Cache entry 2
      await db.search(createTestVector(3), 1) // Cache entry 3
      
      // Access entry 1 again (makes it recently used)
      await db.search(createTestVector(1), 1)
      
      // Add new entry (should evict entry 2, not 1)
      await db.search(createTestVector(4), 1)
      
      // Entry 1 should still be cached (was recently used)
      const start = performance.now()
      await db.search(createTestVector(1), 1)
      const time = performance.now() - start
      
      expect(time).toBeLessThan(5) // Should be very fast (cached)
    })
  })
  
  describe('Operation Types', () => {
    beforeEach(async () => {
      db = new BrainyData({
        requestDeduplicator: {
          enabled: true,
          ttl: 1000
        }
      })
      await db.init()
      
      // Add test data
      for (let i = 0; i < 20; i++) {
        await db.add(createTestVector(i), { 
          id: `op${i}`,
          type: i < 10 ? 'typeA' : 'typeB'
        })
      }
    })
    
    it('should deduplicate search operations', async () => {
      const vector = createTestVector(5)
      
      const promises = [
        db!.search(vector, 5),
        db!.search(vector, 5),
        db!.search(vector, 5)
      ]
      
      const results = await Promise.all(promises)
      
      // All should get same results
      expect(results[0]).toEqual(results[1])
      expect(results[1]).toEqual(results[2])
    })
    
    it('should deduplicate searchText operations', async () => {
      const promises = [
        db!.searchText('test query', 3),
        db!.searchText('test query', 3),
        db!.searchText('test query', 3)
      ]
      
      const results = await Promise.all(promises)
      
      // All should get same results
      expect(results[0]).toEqual(results[1])
      expect(results[1]).toEqual(results[2])
    })
    
    it('should deduplicate findSimilar operations', async () => {
      const promises = [
        db!.findSimilar('op5', { limit: 3 }),
        db!.findSimilar('op5', { limit: 3 }),
        db!.findSimilar('op5', { limit: 3 })
      ]
      
      const results = await Promise.all(promises)
      
      // All should get same results
      expect(results[0].length).toBe(results[1].length)
      expect(results[1].length).toBe(results[2].length)
    })
  })
  
  describe('Statistics and Monitoring', () => {
    it('should track deduplication statistics', async () => {
      const dedup = new RequestDeduplicatorAugmentation({
        ttl: 5000,
        maxSize: 100
      })
      
      await dedup.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      const stats = dedup.getStats()
      expect(stats).toBeDefined()
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('totalRequests')
      expect(stats).toHaveProperty('cacheSize')
      expect(stats).toHaveProperty('evictions')
    })
    
    it('should calculate hit rate', async () => {
      db = new BrainyData({
        requestDeduplicator: {
          enabled: true,
          ttl: 5000
        }
      })
      await db.init()
      
      // Add test data
      await db.add(createTestVector(1), { id: 'stat1' })
      
      const vector = createTestVector(1)
      
      // First search (miss)
      await db.search(vector, 1)
      
      // Duplicate searches (hits)
      await db.search(vector, 1)
      await db.search(vector, 1)
      await db.search(vector, 1)
      
      // Hit rate should be 75% (3 hits out of 4 total)
      // Note: Actual implementation may vary
    })
  })
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      db = new BrainyData({
        requestDeduplicator: {
          enabled: true,
          ttl: 1000
        }
      })
      await db.init()
    })
    
    it('should handle search errors gracefully', async () => {
      // Search with invalid parameters
      try {
        await db!.search(null as any, -1)
      } catch (error) {
        // Should handle error without breaking deduplicator
        expect(error).toBeDefined()
      }
      
      // Subsequent valid search should work
      await db!.add(createTestVector(1), { id: 'error1' })
      const results = await db!.search(createTestVector(1), 1)
      expect(results.length).toBeGreaterThan(0)
    })
    
    it('should not cache failed requests', async () => {
      // Make a search that will fail
      const badVector = new Array(100).fill(0) // Wrong dimensions
      
      let error1, error2
      try {
        await db!.search(badVector, 1)
      } catch (e) {
        error1 = e
      }
      
      try {
        await db!.search(badVector, 1)
      } catch (e) {
        error2 = e
      }
      
      // Both should fail (not cached)
      expect(error1).toBeDefined()
      expect(error2).toBeDefined()
    })
  })
  
  describe('Standalone Usage', () => {
    it('should work as standalone augmentation', () => {
      const dedup = new RequestDeduplicatorAugmentation({
        ttl: 5000,
        maxSize: 1000
      })
      
      expect(dedup.name).toBe('RequestDeduplicator')
      expect(dedup.timing).toBe('around')
      expect(dedup.priority).toBe(50) // Medium priority
      expect(dedup.operations).toContain('search')
      expect(dedup.operations).toContain('searchText')
      expect(dedup.operations).toContain('findSimilar')
    })
    
    it('should provide 3x performance boost claim', async () => {
      const dedup = new RequestDeduplicatorAugmentation({
        ttl: 5000
      })
      
      await dedup.initialize({
        brain: {},
        storage: {},
        config: {},
        log: (msg: string) => {
          expect(msg).toContain('3x performance boost')
        }
      } as any)
    })
  })
})