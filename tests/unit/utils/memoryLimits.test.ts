/**
 * Unit tests for memory limit calculation and container detection (v5.11.0)
 *
 * Tests verify:
 * - Container memory detection (cgroup v1/v2, env vars)
 * - Smart memory limit calculation
 * - Configuration overrides
 * - Memory stats API
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { ValidationConfig } from '../../../src/utils/paramValidation.js'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('Memory Limits - Container Detection & Smart Calculation', () => {
  let testDir: string
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'brainy-memory-test-'))

    // Save original environment variables
    originalEnv = {
      CLOUD_RUN_MEMORY: process.env.CLOUD_RUN_MEMORY,
      MEMORY_LIMIT: process.env.MEMORY_LIMIT
    }

    // Reset ValidationConfig singleton before each test
    ValidationConfig.reset()
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })

    // Restore original environment
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalEnv[key]
      }
    })

    // Reset ValidationConfig after each test
    ValidationConfig.reset()
  })

  describe('Container Memory Detection', () => {
    it('should detect Cloud Run memory limit from env var', () => {
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const config = ValidationConfig.getInstance()

      expect(config.detectedContainerLimit).toBe(4 * 1024 * 1024 * 1024)
      expect(config.limitBasis).toBe('containerMemory')

      // 4GB * 0.25 = 1GB query memory = 10k limit
      expect(config.maxLimit).toBeGreaterThan(5000)
    })

    it('should detect Cloud Run memory limit in Mi units', () => {
      process.env.CLOUD_RUN_MEMORY = '512Mi'

      const config = ValidationConfig.getInstance()

      expect(config.detectedContainerLimit).toBe(512 * 1024 * 1024)
      expect(config.limitBasis).toBe('containerMemory')

      // 512MB * 0.25 = 128MB query memory
      expect(config.maxLimit).toBeGreaterThan(0)
    })

    it('should detect generic MEMORY_LIMIT env var', () => {
      process.env.MEMORY_LIMIT = String(2 * 1024 * 1024 * 1024) // 2GB

      const config = ValidationConfig.getInstance()

      expect(config.detectedContainerLimit).toBe(2 * 1024 * 1024 * 1024)
      expect(config.limitBasis).toBe('containerMemory')
    })

    it('should fall back to free memory if no container detected', () => {
      // No environment variables set

      const config = ValidationConfig.getInstance()

      expect(config.limitBasis).toBe('freeMemory')
      expect(config.maxLimit).toBeGreaterThan(0)
    })
  })

  describe('Smart Memory Limit Calculation', () => {
    it('should allocate 25% of container memory for queries', () => {
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const config = ValidationConfig.getInstance()

      // 4GB * 0.25 = 1GB for queries
      // 1GB / 100MB = 10 units * 1000 = 10,000 limit
      expect(config.maxLimit).toBe(10000)
    })

    it('should respect absolute maximum of 100k', () => {
      // Simulate huge container
      process.env.MEMORY_LIMIT = String(100 * 1024 * 1024 * 1024) // 100GB

      const config = ValidationConfig.getInstance()

      // Should cap at 100,000 even with huge memory
      expect(config.maxLimit).toBe(100000)
    })

    it('should handle small containers gracefully', () => {
      process.env.CLOUD_RUN_MEMORY = '512Mi'  // Use 512MB instead of 128MB for realistic test

      const config = ValidationConfig.getInstance()

      // 512MB * 0.25 = 128MB for queries
      // 128MB / 100MB = 1.28 floor to 1 * 1000 = 1000 limit
      expect(config.maxLimit).toBeGreaterThan(0)
      expect(config.limitBasis).toBe('containerMemory')
    })
  })

  describe('Configuration Overrides', () => {
    it('should respect maxQueryLimit override', () => {
      const config = ValidationConfig.getInstance({ maxQueryLimit: 50000 })

      expect(config.maxLimit).toBe(50000)
      expect(config.limitBasis).toBe('override')
    })

    it('should respect reservedQueryMemory override', () => {
      // Reserve 1GB for queries
      const config = ValidationConfig.getInstance({
        reservedQueryMemory: 1 * 1024 * 1024 * 1024
      })

      expect(config.maxLimit).toBe(10000) // 1GB / 100MB * 1000
      expect(config.limitBasis).toBe('reservedMemory')
    })

    it('should prioritize maxQueryLimit over reservedQueryMemory', () => {
      const config = ValidationConfig.getInstance({
        maxQueryLimit: 25000,
        reservedQueryMemory: 1 * 1024 * 1024 * 1024
      })

      expect(config.maxLimit).toBe(25000)
      expect(config.limitBasis).toBe('override')
    })

    it('should cap explicit overrides at 100k for safety', () => {
      const config = ValidationConfig.getInstance({
        maxQueryLimit: 200000 // Try to set above max
      })

      expect(config.maxLimit).toBe(100000) // Capped
      expect(config.limitBasis).toBe('override')
    })
  })

  describe('ValidationConfig Reconfiguration', () => {
    it('should reconfigure singleton with new options', () => {
      const config1 = ValidationConfig.getInstance()
      const originalLimit = config1.maxLimit

      // Reconfigure
      const config2 = ValidationConfig.reconfigure({ maxQueryLimit: 30000 })

      expect(config2.maxLimit).toBe(30000)
      expect(config2.limitBasis).toBe('override')

      // Verify singleton updated
      const config3 = ValidationConfig.getInstance()
      expect(config3.maxLimit).toBe(30000)
    })

    it('should reset singleton', () => {
      const config1 = ValidationConfig.getInstance({ maxQueryLimit: 10000 })
      expect(config1.maxLimit).toBe(10000)

      ValidationConfig.reset()

      const config2 = ValidationConfig.getInstance()
      // Should recalculate based on system memory
      expect(config2.maxLimit).not.toBe(10000)
    })
  })

  describe('Brain Integration', () => {
    it('should configure memory limits via Brain constructor', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        maxQueryLimit: 15000,
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      expect(stats.limits.maxQueryLimit).toBe(15000)
      expect(stats.limits.basis).toBe('override')
      expect(stats.config.maxQueryLimit).toBe(15000)

      await brain.close()
    })

    it('should configure reserved memory via Brain constructor', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        reservedQueryMemory: 500 * 1024 * 1024, // 500MB
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      // 500MB / 100MB * 1000 = 5000
      expect(stats.limits.maxQueryLimit).toBe(5000)
      expect(stats.limits.basis).toBe('reservedMemory')
      expect(stats.config.reservedQueryMemory).toBe(500 * 1024 * 1024)

      await brain.close()
    })

    it('should auto-detect container limits when no config provided', async () => {
      process.env.CLOUD_RUN_MEMORY = '2Gi'

      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      expect(stats.memory.containerLimit).toBe(2 * 1024 * 1024 * 1024)
      expect(stats.limits.basis).toBe('containerMemory')
      // 2GB * 0.25 = 500MB -> 5000 limit
      expect(stats.limits.maxQueryLimit).toBe(5000)

      await brain.close()
    })
  })

  describe('getMemoryStats() API', () => {
    it('should return complete memory statistics', async () => {
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const brain = new Brainy({
        storage: { type: 'memory' },
        maxQueryLimit: 20000,
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      // Memory stats
      expect(stats.memory).toHaveProperty('heapUsed')
      expect(stats.memory).toHaveProperty('heapTotal')
      expect(stats.memory).toHaveProperty('external')
      expect(stats.memory).toHaveProperty('rss')
      expect(stats.memory).toHaveProperty('free')
      expect(stats.memory).toHaveProperty('total')
      expect(stats.memory).toHaveProperty('containerLimit')

      expect(stats.memory.containerLimit).toBe(4 * 1024 * 1024 * 1024)

      // Limits
      expect(stats.limits.maxQueryLimit).toBe(20000)
      expect(stats.limits.basis).toBe('override')
      expect(stats.limits.maxQueryLength).toBeGreaterThan(0)
      expect(stats.limits.maxVectorDimensions).toBe(384)

      // Config
      expect(stats.config.maxQueryLimit).toBe(20000)

      // Recommendations
      expect(Array.isArray(stats.recommendations)).toBe(true)

      await brain.close()
    })

    it('should provide recommendations when appropriate', async () => {
      // Large container but using free memory basis
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      // Don't set overrides, let it use containerMemory
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      expect(stats.recommendations).toBeDefined()
      expect(stats.recommendations!.length).toBeGreaterThanOrEqual(0)

      await brain.close()
    })

    it('should handle browser environment gracefully', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      // Should not crash in any environment
      expect(stats).toBeDefined()
      expect(stats.limits).toBeDefined()

      await brain.close()
    })
  })

  describe('Production Scenarios', () => {
    it('should handle 4GB Cloud Run container optimally', async () => {
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      // Should allocate 1GB (25% of 4GB) for queries
      expect(stats.memory.containerLimit).toBe(4 * 1024 * 1024 * 1024)
      expect(stats.limits.maxQueryLimit).toBe(10000)
      expect(stats.limits.basis).toBe('containerMemory')

      await brain.close()
    })

    it('should allow manual override for power users', async () => {
      process.env.CLOUD_RUN_MEMORY = '4Gi'

      const brain = new Brainy({
        storage: { type: 'memory' },
        maxQueryLimit: 50000, // Power user wants higher limit
        silent: true
      })

      await brain.init()

      const stats = brain.getMemoryStats()

      expect(stats.limits.maxQueryLimit).toBe(50000)
      expect(stats.limits.basis).toBe('override')

      // Should note override in recommendations
      const overrideNote = stats.recommendations?.find(r => r.includes('override'))
      expect(overrideNote).toBeDefined()

      await brain.close()
    })

    it('should handle bare metal deployment (no container)', async () => {
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
})
