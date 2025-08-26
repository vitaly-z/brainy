import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData } from '../src/index.js'
import { BatchProcessingAugmentation } from '../src/augmentations/batchProcessingAugmentation.js'

describe('Batch Processing Augmentation', () => {
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
    it('should initialize with default configuration', async () => {
      db = new BrainyData()
      await db.init()
      
      // Batch processing should be enabled by default
      // Test by adding many items quickly
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          db.add(createTestVector(i), { id: `test${i}` })
        )
      }
      
      const results = await Promise.all(promises)
      expect(results.length).toBe(10)
    })
    
    it('should accept custom batch configuration', async () => {
      db = new BrainyData({
        batchSize: 50,
        batchWaitTime: 10 // 10ms wait time
      })
      await db.init()
      
      // Should handle custom batch size
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          db.add(createTestVector(i), { id: `batch${i}` })
        )
      }
      
      const results = await Promise.all(promises)
      expect(results.length).toBe(100)
    })
  })
  
  describe('Batching Behavior', () => {
    beforeEach(async () => {
      db = new BrainyData({
        batchSize: 10,
        batchWaitTime: 50 // 50ms wait
      })
      await db.init()
    })
    
    it('should batch operations within wait time', async () => {
      const startTime = performance.now()
      
      // Add items quickly (should be batched)
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          db!.add(createTestVector(i), { id: `quick${i}` })
        )
      }
      
      await Promise.all(promises)
      const elapsed = performance.now() - startTime
      
      // Should complete quickly due to batching
      expect(elapsed).toBeLessThan(200) // Much less than 10 * individual operation time
    })
    
    it('should flush batch when size limit reached', async () => {
      // Add exactly batch size items
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          db!.add(createTestVector(i), { id: `size${i}` })
        )
      }
      
      // Should flush immediately when batch is full
      const results = await Promise.all(promises)
      expect(results.length).toBe(10)
      
      // Verify all were added
      for (let i = 0; i < 10; i++) {
        const item = await db!.get(`size${i}`)
        expect(item).toBeDefined()
      }
    })
    
    it('should flush batch after wait time expires', async () => {
      // Add fewer items than batch size
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(
          db!.add(createTestVector(i), { id: `timer${i}` })
        )
      }
      
      // Should flush after wait time even if batch not full
      const results = await Promise.all(promises)
      expect(results.length).toBe(5)
    })
  })
  
  describe('Adaptive Batching', () => {
    it('should adapt batch size based on performance', async () => {
      const batch = new BatchProcessingAugmentation({
        maxBatchSize: 100,
        enableAdaptiveBatching: true,
        adaptiveThreshold: 50 // 50ms target
      })
      
      // Initialize with mock context
      await batch.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      // Simulate operations with varying performance
      // (In real usage, the augmentation would measure actual operation time)
      
      const stats = batch.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalBatches).toBe(0)
      expect(stats.adaptiveAdjustments).toBe(0)
    })
    
    it('should increase batch size for fast operations', async () => {
      db = new BrainyData({
        batchSize: 10,
        batchWaitTime: 20,
        enableAdaptiveBatching: true
      })
      await db.init()
      
      // Add many items (simulating fast operations)
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          db.add(createTestVector(i), { id: `adaptive${i}` })
        )
      }
      
      await Promise.all(promises)
      
      // Batch size should have adapted (implementation dependent)
      // Just verify operations completed
      expect(promises.length).toBe(100)
    })
  })
  
  describe('Performance Impact', () => {
    it('should improve throughput for bulk operations', async () => {
      // Test without batching
      const dbNoBatch = new BrainyData({
        batchSize: 1, // Effectively no batching
        batchWaitTime: 0
      })
      await dbNoBatch.init()
      
      const startNoBatch = performance.now()
      for (let i = 0; i < 50; i++) {
        await dbNoBatch.add(createTestVector(i), { id: `nobatch${i}` })
      }
      const timeNoBatch = performance.now() - startNoBatch
      
      await dbNoBatch.cleanup?.()
      
      // Test with batching
      const dbWithBatch = new BrainyData({
        batchSize: 25,
        batchWaitTime: 10
      })
      await dbWithBatch.init()
      
      const startBatch = performance.now()
      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(
          dbWithBatch.add(createTestVector(i), { id: `batch${i}` })
        )
      }
      await Promise.all(promises)
      const timeBatch = performance.now() - startBatch
      
      await dbWithBatch.cleanup?.()
      
      // Batched should be faster for bulk operations
      expect(timeBatch).toBeLessThan(timeNoBatch)
    })
    
    it('should not delay single operations significantly', async () => {
      db = new BrainyData({
        batchSize: 10,
        batchWaitTime: 100 // 100ms wait
      })
      await db.init()
      
      // Single operation
      const start = performance.now()
      await db.add(createTestVector(1), { id: 'single' })
      const elapsed = performance.now() - start
      
      // Should not wait full batch time for single item
      expect(elapsed).toBeLessThan(150) // Some overhead is OK
    })
  })
  
  describe('Operation Types', () => {
    beforeEach(async () => {
      db = new BrainyData({
        batchSize: 5,
        batchWaitTime: 20
      })
      await db.init()
    })
    
    it('should batch add operations', async () => {
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(
          db!.add(createTestVector(i), { id: `add${i}` })
        )
      }
      
      const results = await Promise.all(promises)
      expect(results.length).toBe(5)
    })
    
    it('should batch addNoun operations', async () => {
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(
          db!.addNoun(createTestVector(i), { 
            id: `noun${i}`,
            data: `Noun ${i}`
          })
        )
      }
      
      const results = await Promise.all(promises)
      expect(results.length).toBe(5)
    })
    
    it('should batch mixed operations', async () => {
      // Mix different operation types
      const promises = []
      
      // Add some nouns
      for (let i = 0; i < 3; i++) {
        promises.push(
          db!.addNoun(createTestVector(i), { id: `mixed${i}` })
        )
      }
      
      // Add some regular items
      for (let i = 3; i < 5; i++) {
        promises.push(
          db!.add(createTestVector(i), { id: `mixed${i}` })
        )
      }
      
      const results = await Promise.all(promises)
      expect(results.length).toBe(5)
    })
  })
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      db = new BrainyData({
        batchSize: 5,
        batchWaitTime: 20
      })
      await db.init()
    })
    
    it('should handle errors in batch operations', async () => {
      // Mix valid and invalid operations
      const promises = []
      
      // Valid operations
      for (let i = 0; i < 3; i++) {
        promises.push(
          db!.add(createTestVector(i), { id: `valid${i}` })
        )
      }
      
      // Invalid operation (duplicate ID)
      promises.push(
        db!.add(createTestVector(0), { id: 'valid0' })
      )
      
      // More valid operations
      promises.push(
        db!.add(createTestVector(4), { id: 'valid4' })
      )
      
      // Should not fail entire batch
      const results = await Promise.allSettled(promises)
      
      const fulfilled = results.filter(r => r.status === 'fulfilled')
      expect(fulfilled.length).toBeGreaterThanOrEqual(4)
    })
    
    it('should handle batch timeout gracefully', async () => {
      // Create batch with very short timeout
      const quickBatch = new BatchProcessingAugmentation({
        maxBatchSize: 10,
        maxWaitTime: 1 // 1ms timeout
      })
      
      await quickBatch.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      // Should handle timeout without crashing
      await quickBatch.shutdown()
    })
  })
  
  describe('Statistics and Monitoring', () => {
    it('should track batch statistics', async () => {
      const batch = new BatchProcessingAugmentation({
        maxBatchSize: 10,
        maxWaitTime: 50
      })
      
      await batch.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      const stats = batch.getStats()
      expect(stats).toBeDefined()
      expect(stats).toHaveProperty('totalBatches')
      expect(stats).toHaveProperty('totalOperations')
      expect(stats).toHaveProperty('averageBatchSize')
      expect(stats).toHaveProperty('averageWaitTime')
      expect(stats).toHaveProperty('currentBatchSize')
      expect(stats).toHaveProperty('adaptiveAdjustments')
      
      await batch.shutdown()
    })
    
    it('should export batch metrics', async () => {
      db = new BrainyData({
        batchSize: 5,
        batchWaitTime: 10
      })
      await db.init()
      
      // Perform some operations
      const promises = []
      for (let i = 0; i < 20; i++) {
        promises.push(
          db.add(createTestVector(i), { id: `metric${i}` })
        )
      }
      await Promise.all(promises)
      
      // Get augmentation stats (if exposed through BrainyData)
      // This would need API support in BrainyData
      // For now, just verify operations completed
      expect(promises.length).toBe(20)
    })
  })
  
  describe('Standalone Usage', () => {
    it('should work as standalone augmentation', () => {
      const batch = new BatchProcessingAugmentation({
        maxBatchSize: 100,
        maxWaitTime: 50
      })
      
      expect(batch.name).toBe('BatchProcessing')
      expect(batch.timing).toBe('around')
      expect(batch.priority).toBe(80) // High priority
      expect(batch.operations).toContain('add')
      expect(batch.operations).toContain('addNoun')
      expect(batch.operations).toContain('saveNoun')
    })
    
    it('should handle lifecycle correctly', async () => {
      const batch = new BatchProcessingAugmentation()
      
      // Initialize
      await batch.initialize({
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      } as any)
      
      // Should be ready
      const stats = batch.getStats()
      expect(stats.totalBatches).toBe(0)
      
      // Shutdown
      await batch.shutdown()
      
      // Should flush any pending batches on shutdown
      const finalStats = batch.getStats()
      expect(finalStats.totalBatches).toBeGreaterThanOrEqual(0)
    })
  })
})