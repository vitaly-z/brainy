import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { InstancePool, createInstancePool } from '../../../src/import/InstancePool.js'

describe('InstancePool', () => {
  let brain: Brainy
  let pool: InstancePool

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
    pool = new InstancePool(brain)
  })

  describe('lazy initialization', () => {
    it('should not create instances until requested', () => {
      const stats = pool.getStats()
      expect(stats.nlpCreated).toBe(false)
      expect(stats.extractorCreated).toBe(false)
    })

    it('should create NLP instance on first access', async () => {
      const nlp = await pool.getNLP()
      expect(nlp).toBeDefined()

      const stats = pool.getStats()
      expect(stats.nlpCreated).toBe(true)
      expect(stats.nlpReuses).toBe(1)
    })

    it('should create extractor instance on first access', () => {
      const extractor = pool.getExtractor()
      expect(extractor).toBeDefined()

      const stats = pool.getStats()
      expect(stats.extractorCreated).toBe(true)
      expect(stats.extractorReuses).toBe(1)
    })
  })

  describe('instance reuse', () => {
    it('should return same NLP instance on multiple calls', async () => {
      const nlp1 = await pool.getNLP()
      const nlp2 = await pool.getNLP()
      const nlp3 = await pool.getNLP()

      expect(nlp1).toBe(nlp2)
      expect(nlp2).toBe(nlp3)

      const stats = pool.getStats()
      expect(stats.nlpReuses).toBe(3)
    })

    it('should return same extractor instance on multiple calls', () => {
      const extractor1 = pool.getExtractor()
      const extractor2 = pool.getExtractor()
      const extractor3 = pool.getExtractor()

      expect(extractor1).toBe(extractor2)
      expect(extractor2).toBe(extractor3)

      const stats = pool.getStats()
      expect(stats.extractorReuses).toBe(3)
    })

    it('should track reuse counts correctly', async () => {
      await pool.getNLP()
      await pool.getNLP()
      pool.getExtractor()
      pool.getExtractor()
      pool.getExtractor()

      const stats = pool.getStats()
      expect(stats.nlpReuses).toBe(2)
      expect(stats.extractorReuses).toBe(3)
    })
  })

  describe('initialization', () => {
    it('should initialize all instances with init()', async () => {
      await pool.init()

      expect(pool.isInitialized()).toBe(true)

      const stats = pool.getStats()
      expect(stats.nlpCreated).toBe(true)
      expect(stats.extractorCreated).toBe(true)
      expect(stats.initialized).toBe(true)
    })

    it('should handle concurrent init calls safely', async () => {
      // Call init multiple times concurrently
      const promises = [
        pool.init(),
        pool.init(),
        pool.init()
      ]

      await Promise.all(promises)

      // Should only initialize once
      expect(pool.isInitialized()).toBe(true)
    })

    it('should auto-initialize NLP when accessed', async () => {
      const nlp = await pool.getNLP()

      // NLP is lazy-initialized but extractor might not be
      const stats = pool.getStats()
      expect(stats.nlpCreated).toBe(true)
      expect(stats.initialized).toBe(true)
    })

    it('should provide sync access to NLP', () => {
      const nlp = pool.getNLPSync()
      expect(nlp).toBeDefined()

      const stats = pool.getStats()
      expect(stats.nlpCreated).toBe(true)
    })
  })

  describe('statistics', () => {
    it('should track creation time', async () => {
      await pool.init()

      const stats = pool.getStats()
      expect(stats.creationTime).toBeGreaterThanOrEqual(0)
    })

    it('should calculate memory saved', async () => {
      // Use instances multiple times
      await pool.getNLP()
      await pool.getNLP()
      await pool.getNLP()
      pool.getExtractor()
      pool.getExtractor()

      const stats = pool.getStats()
      expect(stats.memorySaved).toBeGreaterThan(0)
    })

    it('should reset statistics', async () => {
      await pool.getNLP()
      pool.getExtractor()

      pool.resetStats()

      const stats = pool.getStats()
      expect(stats.nlpReuses).toBe(0)
      expect(stats.extractorReuses).toBe(0)
      expect(stats.creationTime).toBe(0)
    })

    it('should provide string representation', async () => {
      await pool.init()

      const str = pool.toString()
      expect(str).toContain('InstancePool')
      expect(str).toContain('nlp=true')
      expect(str).toContain('extractor=true')
    })
  })

  describe('memory efficiency', () => {
    it('should reuse instances in loop (no memory leak)', async () => {
      const initialStats = pool.getStats()

      // Simulate import loop
      for (let i = 0; i < 1000; i++) {
        const nlp = await pool.getNLP()
        const extractor = pool.getExtractor()

        // All iterations should get same instances
        expect(nlp).toBeDefined()
        expect(extractor).toBeDefined()
      }

      const finalStats = pool.getStats()
      expect(finalStats.nlpReuses).toBe(1000)
      expect(finalStats.extractorReuses).toBe(1000)

      // Should have saved ~60GB of memory (1000 iterations × ~60MB)
      expect(finalStats.memorySaved).toBeGreaterThan(50 * 1024 * 1024 * 1000) // > 50GB
    })

    it('should handle rapid concurrent access', async () => {
      // Simulate concurrent row processing
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(pool.getNLP())
        promises.push(Promise.resolve(pool.getExtractor()))
      }

      await Promise.all(promises)

      const stats = pool.getStats()
      expect(stats.nlpReuses).toBe(100)
      expect(stats.extractorReuses).toBe(100)
    })
  })

  describe('cleanup', () => {
    it('should cleanup instances', async () => {
      await pool.init()
      expect(pool.isInitialized()).toBe(true)

      pool.cleanup()

      expect(pool.isInitialized()).toBe(false)
      const stats = pool.getStats()
      expect(stats.nlpCreated).toBe(false)
      expect(stats.extractorCreated).toBe(false)
    })

    it('should allow reinitialization after cleanup', async () => {
      await pool.init()
      pool.cleanup()

      await pool.init()
      expect(pool.isInitialized()).toBe(true)
    })
  })

  describe('factory function', () => {
    it('should create pool with auto-init', async () => {
      const newPool = await createInstancePool(brain, true)

      expect(newPool.isInitialized()).toBe(true)
    })

    it('should create pool without auto-init', async () => {
      const newPool = await createInstancePool(brain, false)

      expect(newPool.isInitialized()).toBe(false)
    })

    it('should default to auto-init', async () => {
      const newPool = await createInstancePool(brain)

      expect(newPool.isInitialized()).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle missing NLP instance gracefully', async () => {
      const emptyPool = new InstancePool(brain)

      // Should create NLP on first access
      const nlp = await emptyPool.getNLP()
      expect(nlp).toBeDefined()
    })

    it('should handle missing extractor instance gracefully', () => {
      const emptyPool = new InstancePool(brain)

      // Should create extractor on first access
      const extractor = emptyPool.getExtractor()
      expect(extractor).toBeDefined()
    })
  })

  describe('real-world usage', () => {
    it('should work with actual NLP operations', async () => {
      const nlp = await pool.getNLP()

      // Should be initialized and ready to use
      expect(nlp).toBeDefined()

      // NLP should have init method
      expect(typeof nlp.init).toBe('function')
    })

    it('should work with actual entity extraction', async () => {
      const extractor = pool.getExtractor()

      // Should be ready to use
      expect(extractor).toBeDefined()

      // Can call extractor methods
      const entities = await extractor.extract('Paris is a beautiful city', {
        confidence: 0.5
      })

      expect(Array.isArray(entities)).toBe(true)
    })

    it('should handle full import workflow', async () => {
      // Initialize pool
      await pool.init()

      // Simulate processing multiple rows
      const rows = [
        { text: 'Paris is beautiful' },
        { text: 'London is historic' },
        { text: 'Tokyo is modern' }
      ]

      for (const row of rows) {
        const nlp = await pool.getNLP()
        const extractor = pool.getExtractor()

        // Process row - extract entities
        const entities = await extractor.extract(row.text, { confidence: 0.5 })

        expect(nlp).toBeDefined()
        expect(extractor).toBeDefined()
        expect(entities).toBeDefined()
      }

      // Verify instances were reused
      const stats = pool.getStats()
      expect(stats.nlpReuses).toBe(3)
      expect(stats.extractorReuses).toBe(3)
    })
  })
})
