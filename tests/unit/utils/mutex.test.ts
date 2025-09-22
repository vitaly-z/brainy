/**
 * Mutex Implementation Tests
 * Verify thread-safe operations without deadlocks or resource exhaustion
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InMemoryMutex, FileMutex, createMutex } from '../../../src/utils/mutex'

describe('Mutex Safety Tests', () => {
  let mutex: InMemoryMutex

  beforeEach(() => {
    mutex = new InMemoryMutex()
  })

  describe('InMemoryMutex', () => {
    it('should prevent race conditions', async () => {
      let counter = 0
      const increments = 100

      // Run multiple concurrent operations
      const operations = Array.from({ length: increments }, async () => {
        await mutex.runExclusive('counter', async () => {
          const current = counter
          // Simulate async work that could cause race
          await new Promise(resolve => setTimeout(resolve, 1))
          counter = current + 1
        })
      })

      await Promise.all(operations)
      expect(counter).toBe(increments)
    })

    it('should handle timeouts gracefully', async () => {
      // Acquire lock that won't be released
      const release = await mutex.acquire('timeout-test')

      // Try to acquire same lock with short timeout
      const promise = mutex.acquire('timeout-test', 100)

      await expect(promise).rejects.toThrow('Mutex timeout')

      // Clean up
      release()
    })

    it('should queue multiple waiters correctly', async () => {
      const order: number[] = []

      // First acquirer
      const release1 = await mutex.acquire('queue-test')

      // Queue up more acquirers
      const promise2 = mutex.runExclusive('queue-test', async () => {
        order.push(2)
      })

      const promise3 = mutex.runExclusive('queue-test', async () => {
        order.push(3)
      })

      // Release first lock
      order.push(1)
      release1()

      // Wait for queued operations
      await Promise.all([promise2, promise3])

      expect(order).toEqual([1, 2, 3])
    })

    it('should not deadlock with nested different keys', async () => {
      await mutex.runExclusive('key1', async () => {
        await mutex.runExclusive('key2', async () => {
          // Should not deadlock
          expect(true).toBe(true)
        })
      })
    })

    it('should handle errors in exclusive function', async () => {
      const error = new Error('Test error')

      await expect(
        mutex.runExclusive('error-test', async () => {
          throw error
        })
      ).rejects.toThrow('Test error')

      // Lock should be released, so we can acquire it again
      await mutex.runExclusive('error-test', async () => {
        expect(true).toBe(true)
      })
    })

    it('should handle high concurrency without resource exhaustion', async () => {
      const concurrency = 1000
      const operations = Array.from({ length: concurrency }, (_, i) =>
        mutex.runExclusive(`key-${i % 10}`, async () => {
          // Minimal work to test resource handling
          await Promise.resolve()
        })
      )

      await expect(Promise.all(operations)).resolves.toBeDefined()
    })
  })

  describe('createMutex factory', () => {
    it('should create appropriate mutex for environment', () => {
      const memoryMutex = createMutex({ type: 'memory' })
      expect(memoryMutex).toBeInstanceOf(InMemoryMutex)
    })
  })
})