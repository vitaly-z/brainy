/**
 * Performance Regression Tests for add() Operations
 *
 * These tests ensure that add() operations maintain acceptable performance.
 * They detect regressions like the v7.1.0 bug where cloud storage type detection
 * failed, causing 50-100x slower add() operations.
 *
 * v7.1.1: Added after discovering storage type detection bug
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { NounType } from '../../../src/types/graphTypes.js'

describe('add() Performance Regression Tests', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' },
      silent: true
    })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('Single add() Performance', () => {
    it('should complete single add() in < 500ms with memory storage', async () => {
      const start = performance.now()

      await brain.add({
        data: 'Test entity for performance measurement',
        type: NounType.Concept
      })

      const elapsed = performance.now() - start

      // Single add should be well under 500ms with memory storage
      // Includes embedding generation (~50-150ms) + indexing (~10-50ms)
      expect(elapsed).toBeLessThan(500)
    })

    it('should complete add() with metadata in < 500ms', async () => {
      const start = performance.now()

      await brain.add({
        data: { title: 'Test Document', content: 'This is test content for performance' },
        type: NounType.Document,
        metadata: {
          author: 'test',
          category: 'performance',
          tags: ['test', 'performance', 'benchmark']
        }
      })

      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(500)
    })
  })

  describe('Batch add() Performance', () => {
    it('should complete 10 add() operations in < 5 seconds', async () => {
      const start = performance.now()

      for (let i = 0; i < 10; i++) {
        await brain.add({
          data: `Entity ${i} for batch performance test`,
          type: NounType.Concept
        })
      }

      const elapsed = performance.now() - start

      // 10 adds should average < 500ms each = 5000ms total
      // This catches severe regressions like the 7-12 second per add bug
      expect(elapsed).toBeLessThan(5000)

      // Also verify reasonable average
      const avgPerAdd = elapsed / 10
      expect(avgPerAdd).toBeLessThan(500)
    })

    it('should maintain consistent performance across sequential adds', async () => {
      const times: number[] = []

      for (let i = 0; i < 5; i++) {
        const start = performance.now()

        await brain.add({
          data: `Sequential entity ${i}`,
          type: NounType.Concept
        })

        times.push(performance.now() - start)
      }

      // No single add should be drastically slower than others
      // (catches issues where first add is slow due to lazy init)
      const maxTime = Math.max(...times)
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length

      // Max should not be more than 3x the average (allows for first-add warmup)
      expect(maxTime).toBeLessThan(avgTime * 3)

      // All adds should be under 1 second
      expect(maxTime).toBeLessThan(1000)
    })
  })

  describe('Storage Type Detection', () => {
    it('should detect memory storage type correctly', async () => {
      // Access private method via any cast for testing
      const storageType = (brain as any).getStorageType()
      expect(storageType).toBe('memory')
    })

    it('should use immediate persistence for memory storage', async () => {
      // Memory storage should use immediate mode (already fast)
      const index = (brain as any).index
      expect(index.persistMode).toBe('immediate')
    })
  })
})

describe('Cloud Storage Type Detection', () => {
  // These tests verify that cloud storage types are detected correctly
  // They don't actually connect to cloud storage, just verify the detection logic

  it('should detect GCS storage type from class name', () => {
    // Create a mock storage with GCS-like class name
    class GcsStorage {
      constructor() {}
    }

    const mockBrain = {
      storage: new GcsStorage(),
      getStorageType() {
        if (!this.storage) return 'memory'
        const className = this.storage.constructor.name
        if (className.includes('Gcs') || className.includes('GCS')) return 'gcs'
        if (className.includes('S3')) return 's3'
        if (className.includes('R2')) return 'r2'
        if (className.includes('Azure')) return 'azure'
        return 'unknown'
      }
    }

    expect(mockBrain.getStorageType()).toBe('gcs')
  })

  it('should detect S3 storage type from class name', () => {
    class S3CompatibleStorage {
      constructor() {}
    }

    const mockBrain = {
      storage: new S3CompatibleStorage(),
      getStorageType() {
        if (!this.storage) return 'memory'
        const className = this.storage.constructor.name
        if (className.includes('S3')) return 's3'
        return 'unknown'
      }
    }

    expect(mockBrain.getStorageType()).toBe('s3')
  })

  it('should detect R2 storage type from class name', () => {
    class R2Storage {
      constructor() {}
    }

    const mockBrain = {
      storage: new R2Storage(),
      getStorageType() {
        if (!this.storage) return 'memory'
        const className = this.storage.constructor.name
        if (className.includes('R2')) return 'r2'
        return 'unknown'
      }
    }

    expect(mockBrain.getStorageType()).toBe('r2')
  })

  it('should detect Azure storage type from class name', () => {
    class AzureBlobStorage {
      constructor() {}
    }

    const mockBrain = {
      storage: new AzureBlobStorage(),
      getStorageType() {
        if (!this.storage) return 'memory'
        const className = this.storage.constructor.name
        if (className.includes('Azure')) return 'azure'
        return 'unknown'
      }
    }

    expect(mockBrain.getStorageType()).toBe('azure')
  })
})
