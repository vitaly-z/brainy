/**
 * Integration tests for Memory Enhancements (v5.11.0)
 *
 * End-to-end tests verifying:
 * - streamHistory() works in production scenarios
 * - Container detection works correctly
 * - Memory limits are applied correctly
 * - getMemoryStats() provides accurate information
 * - All features work together seamlessly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('Memory Enhancements Integration (v5.11.0)', () => {
  let testDir: string
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'brainy-memory-integration-'))

    originalEnv = {
      CLOUD_RUN_MEMORY: process.env.CLOUD_RUN_MEMORY,
      MEMORY_LIMIT: process.env.MEMORY_LIMIT
    }
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })

    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalEnv[key]
      }
    })
  })

  describe('Production Workflow: Workshop Snapshot Timeline', () => {
    it('should stream 1000 snapshots efficiently', async () => {
      const brain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: testDir }
        },
        silent: true
      })

      await brain.init()

      // Create a realistic workflow: user creates entities and saves snapshots
      for (let i = 0; i < 100; i++) {
        // Add 10 entities
        for (let j = 0; j < 10; j++) {
          await brain.add({
            type: 'document',
            data: `Chapter ${i}, Section ${j}`
          })
        }

        // Save snapshot
        await brain.commit({ message: `Version ${i}`, captureState: true })
      }

      // Stream history efficiently
      const snapshots: string[] = []
      const startTime = Date.now()

      for await (const commit of brain.streamHistory({ limit: 100 })) {
        snapshots.push(commit.message)
      }

      const duration = Date.now() - startTime

      expect(snapshots.length).toBe(100)
      expect(duration).toBeLessThan(5000) // Should complete in < 5s

      await brain.close()
    })

    it('should handle large snapshot with filtering', async () => {
      const brain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: testDir }
        },
        silent: true
      })

      await brain.init()

      // Create snapshots by different authors
      for (let i = 0; i < 50; i++) {
        await brain.add({ type: 'document', data: `Content ${i}` })

        await brain.commit({
          message: `Snapshot ${i}`,
          author: i % 3 === 0 ? 'alice' : i % 3 === 1 ? 'bob' : 'charlie',
          captureState: true
        })
      }

      // Stream only alice's snapshots
      const aliceSnapshots: any[] = []

      for await (const commit of brain.streamHistory({ author: 'alice', limit: 100 })) {
        aliceSnapshots.push(commit)
      }

      expect(aliceSnapshots.length).toBeGreaterThan(0)
      aliceSnapshots.forEach(commit => {
        expect(commit.author).toBe('alice')
      })

      await brain.close()
    })
  })

  describe('Production Workflow: Cloud Run Deployment', () => {
    it('should detect 4GB Cloud Run container and set optimal limits', async () => {
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      // Verify container detected
      expect(stats.memory.containerLimit).toBe(4 * 1024 * 1024 * 1024)

      // Verify optimal limits
      expect(stats.limits.basis).toBe('containerMemory')
      expect(stats.limits.maxQueryLimit).toBe(10000) // 25% of 4GB

      // Verify can query with these limits
      for (let i = 0; i < 100; i++) {
        await brain.add({ type: 'document', data: `Entity ${i}` })
      }

      const results = await brain.find({ limit: 10000 }) // Should not throw
      expect(results.length).toBe(100)

      await brain.close()
    })

    it('should allow manual override for power users in containers', async () => {
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const brain = new Brainy({
        storage: { type: 'memory' },
        maxQueryLimit: 50000, // Override auto-detection
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      // Container detected but override used
      expect(stats.memory.containerLimit).toBe(4 * 1024 * 1024 * 1024)
      expect(stats.limits.basis).toBe('override')
      expect(stats.limits.maxQueryLimit).toBe(50000)

      await brain.close()
    })

    it('should use reservedQueryMemory for fine-grained control', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        reservedQueryMemory: 2 * 1024 * 1024 * 1024, // Reserve 2GB
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      expect(stats.limits.basis).toBe('reservedMemory')
      expect(stats.limits.maxQueryLimit).toBe(20000) // 2GB / 100MB * 1000

      await brain.close()
    })
  })

  describe('Combined Features: Stream + Memory Management', () => {
    it('should stream large histories within memory limits', async () => {
      process.env.CLOUD_RUN_MEMORY = '2Gi'

      const brain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: testDir }
        },
        silent: true
      })

      await brain.init()

      // Create many snapshots
      for (let i = 0; i < 200; i++) {
        await brain.add({ type: 'document', data: `Data ${i}` })

        if (i % 5 === 0) {
          await brain.commit({ message: `Checkpoint ${i / 5}`, captureState: true })
        }
      }

      // Verify memory limits
      const stats = brain.getMemoryStats()
      expect(stats.limits.maxQueryLimit).toBe(5000) // 2GB * 0.25

      // Stream all snapshots (should be ~40)
      const heapBefore = process.memoryUsage().heapUsed

      let count = 0
      for await (const commit of brain.streamHistory({ limit: 100 })) {
        count++
      }

      const heapAfter = process.memoryUsage().heapUsed
      const heapGrowth = heapAfter - heapBefore

      expect(count).toBeGreaterThan(0)
      expect(heapGrowth).toBeLessThan(20 * 1024 * 1024) // < 20MB growth

      await brain.close()
    })
  })

  describe('Memory Stats API', () => {
    it('should provide actionable recommendations', async () => {
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      // Should have recommendations array
      expect(stats.recommendations).toBeDefined()
      expect(Array.isArray(stats.recommendations)).toBe(true)

      // Should not have error recommendations for well-configured system
      const errorRecommendations = stats.recommendations?.filter(r =>
        r.toLowerCase().includes('error') || r.toLowerCase().includes('warning')
      )

      expect(errorRecommendations?.length || 0).toBe(0)

      await brain.close()
    })

    it('should help debug low limits in production', async () => {
      // Simulate production issue: container detected but low free memory
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      // User can see why limits are what they are
      expect(stats.limits.basis).toBeDefined()
      expect(stats.memory.containerLimit).toBeDefined()
      expect(stats.config).toBeDefined()

      // Can debug: "Why is my limit only 10k?"
      // Answer: basis='containerMemory', container=4GB, 4GB * 0.25 = 1GB -> 10k

      await brain.close()
    })
  })

  describe('Zero-Config Behavior', () => {
    it('should work optimally with no configuration', async () => {
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      // Zero config, optimal behavior
      const stats = brain.getMemoryStats()

      expect(stats.limits.maxQueryLimit).toBe(10000)
      expect(stats.limits.basis).toBe('containerMemory')

      // Should work without issues
      for (let i = 0; i < 100; i++) {
        await brain.add({ type: 'note', data: `Test ${i}` })
      }

      const results = await brain.find({ limit: 100 })
      expect(results.length).toBe(100)

      await brain.close()
    })

    it('should work on bare metal without containers', async () => {
      // No container env vars

      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      expect(stats.memory.containerLimit).toBeNull()
      expect(stats.limits.basis).toBe('freeMemory')
      expect(stats.limits.maxQueryLimit).toBeGreaterThan(0)

      await brain.close()
    })
  })

  describe('Backward Compatibility', () => {
    it('should not break existing code', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      // Existing APIs work
      await brain.add({ type: 'document', data: 'Test' })
      const results = await brain.find({ limit: 10 })

      expect(results.length).toBe(1)

      await brain.close()
    })

    it('should keep getHistory() working as before', async () => {
      const brain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: testDir }
        },
        silent: true
      })

      await brain.init()

      // Create some snapshots
      for (let i = 0; i < 10; i++) {
        await brain.add({ type: 'note', data: `Test ${i}` })
        await brain.commit({ message: `Snapshot ${i}`, captureState: true })
      }

      // Old API still works
      const history = await brain.getHistory({ limit: 10 })

      expect(history.length).toBe(10)
      expect(history[0]).toHaveProperty('hash')
      expect(history[0]).toHaveProperty('message')

      await brain.close()
    })
  })
})
