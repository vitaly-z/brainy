import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData } from '../src/index.js'
import { EntityRegistryAugmentation, AutoRegisterEntitiesAugmentation } from '../src/augmentations/entityRegistryAugmentation.js'

describe('Entity Registry Augmentation', () => {
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
  
  describe('Entity Registry - Fast Deduplication', () => {
    beforeEach(async () => {
      db = new BrainyData({
        entityRegistry: {
          enabled: true,
          maxCacheSize: 1000,
          cacheTTL: 5000, // 5 seconds
          persistence: 'memory',
          indexedFields: ['did', 'handle', 'uri', 'external_id', 'id']
        }
      })
      await db.init()
    })
    
    it('should register entities automatically', async () => {
      // Add entity with external ID
      await db.add(createTestVector(1), { 
        id: 'internal1',
        external_id: 'ext123',
        data: 'Test entity'
      })
      
      // Should be able to lookup by external ID quickly
      const result = await db.get('internal1')
      expect(result).toBeDefined()
      expect(result?.metadata?.external_id).toBe('ext123')
    })
    
    it('should prevent duplicate entities', async () => {
      // Add first entity
      const id1 = await db.add(createTestVector(1), { 
        external_id: 'unique123',
        data: 'Original'
      })
      
      // Try to add duplicate with same external_id
      const id2 = await db.add(createTestVector(2), { 
        external_id: 'unique123',
        data: 'Duplicate attempt'
      })
      
      // Should return same ID (deduplicated)
      expect(id1).toBe(id2)
      
      // Data should be from original
      const result = await db.get(id1)
      expect(result?.metadata?.data).toBe('Original')
    })
    
    it('should handle high-throughput streaming data', async () => {
      const startTime = performance.now()
      const promises = []
      
      // Simulate streaming data with some duplicates
      for (let i = 0; i < 1000; i++) {
        const externalId = `stream${i % 500}` // 50% duplicates
        promises.push(
          db!.add(createTestVector(i), {
            external_id: externalId,
            data: `Stream item ${i}`
          })
        )
      }
      
      const ids = await Promise.all(promises)
      const uniqueIds = new Set(ids)
      
      // Should have deduplicated to ~500 unique items
      expect(uniqueIds.size).toBeLessThanOrEqual(500)
      
      const elapsed = performance.now() - startTime
      // Should be fast (< 2 seconds for 1000 items)
      expect(elapsed).toBeLessThan(2000)
    })
    
    it('should support multiple indexed fields', async () => {
      // Add entity with multiple identifiers
      await db.add(createTestVector(1), {
        id: 'internal1',
        did: 'did:example:123',
        handle: '@user.example',
        uri: 'https://example.com/user',
        external_id: 'ext456',
        data: 'Multi-ID entity'
      })
      
      // Should be findable by any indexed field
      // (Note: actual lookup by these fields would need specific API methods)
      const result = await db.get('internal1')
      expect(result?.metadata?.did).toBe('did:example:123')
      expect(result?.metadata?.handle).toBe('@user.example')
      expect(result?.metadata?.uri).toBe('https://example.com/user')
    })
    
    it('should handle cache expiration', async () => {
      const registry = new EntityRegistryAugmentation({
        maxCacheSize: 10,
        cacheTTL: 100, // 100ms TTL for testing
        persistence: 'memory'
      })
      
      // Initialize with mock context
      await registry.initialize({
        brain: db,
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      // Register an entity
      const registered = registry.register('ext789', 'internal789')
      expect(registered).toBe(true)
      
      // Should be in cache
      const immediate = registry.lookup('ext789')
      expect(immediate).toBe('internal789')
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Should be expired from cache
      const expired = registry.lookup('ext789')
      expect(expired).toBeNull()
    })
  })
  
  describe('Auto-Register Entities', () => {
    beforeEach(async () => {
      db = new BrainyData({
        entityRegistry: {
          enabled: true
        },
        autoRegisterEntities: {
          enabled: true
        }
      })
      await db.init()
    })
    
    it('should auto-register entities after adding', async () => {
      // Add entity
      const id = await db.add(createTestVector(1), {
        external_id: 'auto123',
        handle: '@auto.user',
        data: 'Auto-registered'
      })
      
      // Should be registered automatically
      const result = await db.get(id)
      expect(result).toBeDefined()
      expect(result?.metadata?.external_id).toBe('auto123')
    })
    
    it('should work with batch operations', async () => {
      const items = []
      for (let i = 0; i < 100; i++) {
        items.push({
          vector: createTestVector(i),
          metadata: {
            external_id: `batch${i}`,
            data: `Batch item ${i}`
          }
        })
      }
      
      // Add batch
      const ids = await Promise.all(
        items.map(item => db!.add(item.vector, item.metadata))
      )
      
      // All should be registered
      expect(ids.length).toBe(100)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(100) // All unique
    })
  })
  
  describe('Performance Benchmarks', () => {
    it('should provide O(1) lookup performance', async () => {
      db = new BrainyData({
        entityRegistry: {
          enabled: true,
          maxCacheSize: 100000
        }
      })
      await db.init()
      
      // Add many entities
      for (let i = 0; i < 10000; i++) {
        await db.add(createTestVector(i), {
          id: `perf${i}`,
          external_id: `ext${i}`
        })
      }
      
      // Measure lookup time
      const lookupTimes = []
      for (let i = 0; i < 100; i++) {
        const randomId = Math.floor(Math.random() * 10000)
        const start = performance.now()
        await db.get(`perf${randomId}`)
        lookupTimes.push(performance.now() - start)
      }
      
      // Average lookup should be very fast (< 1ms)
      const avgLookup = lookupTimes.reduce((a, b) => a + b, 0) / lookupTimes.length
      expect(avgLookup).toBeLessThan(1)
    })
    
    it('should handle cache size limits efficiently', async () => {
      const registry = new EntityRegistryAugmentation({
        maxCacheSize: 100, // Small cache
        cacheTTL: 60000,
        persistence: 'memory'
      })
      
      await registry.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      // Add more than cache size
      for (let i = 0; i < 200; i++) {
        registry.register(`ext${i}`, `internal${i}`)
      }
      
      // Cache should not exceed max size
      const stats = registry.getStats()
      expect(stats.cacheSize).toBeLessThanOrEqual(100)
      expect(stats.totalRegistered).toBe(200)
    })
  })
  
  describe('Persistence Options', () => {
    it('should support memory persistence', async () => {
      const registry = new EntityRegistryAugmentation({
        persistence: 'memory'
      })
      
      await registry.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      registry.register('mem1', 'internal1')
      expect(registry.lookup('mem1')).toBe('internal1')
      
      // Memory persistence doesn't survive restart
      const newRegistry = new EntityRegistryAugmentation({
        persistence: 'memory'
      })
      
      await newRegistry.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      expect(newRegistry.lookup('mem1')).toBeNull()
    })
    
    it('should support hybrid persistence', async () => {
      const registry = new EntityRegistryAugmentation({
        persistence: 'hybrid',
        maxCacheSize: 50
      })
      
      await registry.initialize({
        brain: {},
        storage: {
          saveMetadata: async () => {},
          getMetadata: async () => null
        },
        config: {},
        log: () => {}
      } as any)
      
      // Add many items
      for (let i = 0; i < 100; i++) {
        registry.register(`hybrid${i}`, `internal${i}`)
      }
      
      const stats = registry.getStats()
      // Hot cache should be limited
      expect(stats.cacheSize).toBeLessThanOrEqual(50)
      // But all should be registered
      expect(stats.totalRegistered).toBe(100)
    })
  })
  
  describe('Standalone Usage', () => {
    it('should work as standalone augmentation', () => {
      const registry = new EntityRegistryAugmentation({
        maxCacheSize: 1000
      })
      
      expect(registry.name).toBe('EntityRegistry')
      expect(registry.timing).toBe('before')
      expect(registry.priority).toBe(95) // High priority
      expect(registry.operations).toContain('add')
      expect(registry.operations).toContain('addNoun')
    })
    
    it('should provide comprehensive statistics', async () => {
      const registry = new EntityRegistryAugmentation()
      
      await registry.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      // Register some entities
      registry.register('ext1', 'int1')
      registry.register('ext2', 'int2')
      registry.register('ext1', 'int1') // Duplicate
      
      const stats = registry.getStats()
      expect(stats.totalRegistered).toBe(2)
      expect(stats.cacheSize).toBe(2)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      
      // Lookup to generate hits/misses
      registry.lookup('ext1') // Hit
      registry.lookup('ext3') // Miss
      
      const newStats = registry.getStats()
      expect(newStats.hits).toBe(1)
      expect(newStats.misses).toBe(1)
    })
  })
  
  describe('Error Handling', () => {
    it('should handle invalid external IDs', async () => {
      db = new BrainyData({
        entityRegistry: { enabled: true }
      })
      await db.init()
      
      // Should handle null/undefined external IDs
      const id1 = await db.add(createTestVector(1), {
        external_id: null,
        data: 'No external ID'
      })
      
      expect(id1).toBeDefined()
      
      // Should handle empty string
      const id2 = await db.add(createTestVector(2), {
        external_id: '',
        data: 'Empty external ID'
      })
      
      expect(id2).toBeDefined()
      expect(id2).not.toBe(id1) // Should be different
    })
    
    it('should handle registration failures gracefully', () => {
      const registry = new EntityRegistryAugmentation()
      
      // Try to use before initialization
      const result = registry.register('test', 'test')
      expect(result).toBe(false) // Should fail gracefully
      
      const lookup = registry.lookup('test')
      expect(lookup).toBeNull()
    })
  })
})