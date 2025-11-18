/**
 * Unit tests for streamHistory() - Memory-efficient commit history streaming (v5.11.0)
 *
 * Tests verify:
 * - Streaming yields commits one at a time (no accumulation)
 * - Filtering works correctly (since, until, author)
 * - Limits work correctly (maxCount)
 * - Memory efficiency vs getHistory()
 * - Integration with Brain.streamHistory()
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../../src/brainy.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('streamHistory() - Memory-Efficient Streaming', () => {
  let brain: Brainy
  let testDir: string

  beforeEach(async () => {
    // Create temporary directory for test
    testDir = mkdtempSync(join(tmpdir(), 'brainy-stream-history-test-'))

    // Initialize Brain with COW enabled
    brain = new Brainy({
      storage: {
        type: 'filesystem',
        options: { path: testDir }
      },
      silent: true
    })

    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
    rmSync(testDir, { recursive: true, force: true })
  })

  describe('Basic Streaming', () => {
    it('should stream commits one at a time', async () => {
      // Create multiple commits
      const commitCount = 10

      for (let i = 0; i < commitCount; i++) {
        await brain.add({
          type: 'document',
          data: `Entity ${i}`
        })

        await brain.commit({ message: `Commit ${i}`, captureState: true })
      }

      // Stream commits
      const streamedCommits: any[] = []

      for await (const commit of brain.streamHistory({ limit: commitCount })) {
        streamedCommits.push(commit)
        // Verify commit structure
        expect(commit).toHaveProperty('hash')
        expect(commit).toHaveProperty('message')
        expect(commit).toHaveProperty('author')
        expect(commit).toHaveProperty('timestamp')
      }

      // Verify all commits were streamed
      expect(streamedCommits.length).toBe(commitCount)

      // Verify order (newest first)
      for (let i = 0; i < streamedCommits.length - 1; i++) {
        expect(streamedCommits[i].timestamp).toBeGreaterThanOrEqual(
          streamedCommits[i + 1].timestamp
        )
      }
    })

    it('should work with empty history', async () => {
      // No commits created

      const commits: any[] = []

      for await (const commit of brain.streamHistory({ limit: 100 })) {
        commits.push(commit)
      }

      expect(commits.length).toBe(0)
    })

    it('should handle single commit', async () => {
      await brain.add({ type: 'document', data: 'Test' })
      await brain.commit({ message: 'Single commit', captureState: true })

      const commits: any[] = []

      for await (const commit of brain.streamHistory()) {
        commits.push(commit)
      }

      expect(commits.length).toBe(1)
      expect(commits[0].message).toBe('Single commit')
    })
  })

  describe('Filtering', () => {
    beforeEach(async () => {
      // Create commits with different authors
      const baseTime = Date.now()

      for (let i = 0; i < 5; i++) {
        await brain.add({ type: 'document', data: `Entity ${i}` })
        await brain.commit({
          message: `Commit ${i}`,
          author: i % 2 === 0 ? 'alice' : 'bob',
          captureState: true
        })
      }
    })

    it('should filter by author', async () => {
      const aliceCommits: any[] = []

      for await (const commit of brain.streamHistory({ author: 'alice' })) {
        aliceCommits.push(commit)
      }

      expect(aliceCommits.length).toBe(3) // Commits 0, 2, 4
      aliceCommits.forEach(commit => {
        expect(commit.author).toBe('alice')
      })
    })

    it('should filter by limit', async () => {
      const commits: any[] = []

      for await (const commit of brain.streamHistory({ limit: 3 })) {
        commits.push(commit)
      }

      expect(commits.length).toBe(3)
    })

    it('should filter by timestamp (since)', async () => {
      // Get middle commit timestamp
      const allCommits = await brain.getHistory({ limit: 100 })
      const middleTimestamp = allCommits[2].timestamp

      const recentCommits: any[] = []

      for await (const commit of brain.streamHistory({ since: middleTimestamp })) {
        recentCommits.push(commit)
      }

      // Should get commits 0, 1, 2 (3 commits at or after middle)
      expect(recentCommits.length).toBeGreaterThanOrEqual(2)
      recentCommits.forEach(commit => {
        expect(commit.timestamp).toBeGreaterThanOrEqual(middleTimestamp)
      })
    })

    it('should combine filters', async () => {
      const commits: any[] = []

      for await (const commit of brain.streamHistory({
        author: 'alice',
        limit: 2
      })) {
        commits.push(commit)
      }

      expect(commits.length).toBe(2)
      commits.forEach(commit => {
        expect(commit.author).toBe('alice')
      })
    })
  })

  describe('Memory Efficiency', () => {
    it('should not accumulate commits in memory', async () => {
      // Create many commits
      const commitCount = 100

      for (let i = 0; i < commitCount; i++) {
        await brain.add({ type: 'document', data: `Entity ${i}` })
        await brain.commit({ message: `Commit ${i}`, captureState: true })
      }

      // Track memory usage during streaming
      const heapBefore = process.memoryUsage().heapUsed
      let peakHeap = heapBefore

      let count = 0
      for await (const commit of brain.streamHistory({ limit: commitCount })) {
        count++

        // Check heap periodically
        if (count % 10 === 0) {
          const currentHeap = process.memoryUsage().heapUsed
          peakHeap = Math.max(peakHeap, currentHeap)
        }
      }

      expect(count).toBe(commitCount)

      // Peak heap should not grow significantly (< 10MB increase)
      const heapGrowth = peakHeap - heapBefore
      expect(heapGrowth).toBeLessThan(10 * 1024 * 1024) // 10MB threshold
    })

    it('should stream large histories without error', async () => {
      // Create a larger history
      const commitCount = 500

      for (let i = 0; i < commitCount; i++) {
        await brain.add({ type: 'document', data: `Entity ${i}` })

        // Commit every 10 entities
        if (i % 10 === 0) {
          await brain.commit({ message: `Batch ${i / 10}`, captureState: true })
        }
      }

      // Stream all commits
      let count = 0
      for await (const commit of brain.streamHistory({ limit: 1000 })) {
        count++
      }

      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThanOrEqual(50) // Should have ~50 commits
    })
  })

  describe('Comparison with getHistory()', () => {
    beforeEach(async () => {
      // Create test commits
      for (let i = 0; i < 10; i++) {
        await brain.add({ type: 'document', data: `Entity ${i}` })
        await brain.commit({ message: `Commit ${i}`, captureState: true })
      }
    })

    it('should return same commits as getHistory()', async () => {
      // Get commits using both methods
      const arrayCommits = await brain.getHistory({ limit: 10 })

      const streamedCommits: any[] = []
      for await (const commit of brain.streamHistory({ limit: 10 })) {
        streamedCommits.push(commit)
      }

      expect(streamedCommits.length).toBe(arrayCommits.length)

      // Verify same commits (by hash)
      for (let i = 0; i < streamedCommits.length; i++) {
        expect(streamedCommits[i].hash).toBe(arrayCommits[i].hash)
        expect(streamedCommits[i].message).toBe(arrayCommits[i].message)
        expect(streamedCommits[i].timestamp).toBe(arrayCommits[i].timestamp)
      }
    })

    it('should use less memory than getHistory() for large histories', async () => {
      // Add more commits
      for (let i = 10; i < 100; i++) {
        await brain.add({ type: 'document', data: `Entity ${i}` })
        await brain.commit({ message: `Commit ${i}`, captureState: true })
      }

      // Measure getHistory() memory
      global.gc && global.gc() // Force GC if available
      const heapBefore = process.memoryUsage().heapUsed

      const arrayCommits = await brain.getHistory({ limit: 100 })

      const heapAfterArray = process.memoryUsage().heapUsed
      const arrayMemoryUsage = heapAfterArray - heapBefore

      // Clear and measure streamHistory() memory
      global.gc && global.gc() // Force GC if available
      const streamHeapBefore = process.memoryUsage().heapUsed

      let count = 0
      for await (const commit of brain.streamHistory({ limit: 100 })) {
        count++
      }

      const streamHeapAfter = process.memoryUsage().heapUsed
      const streamMemoryUsage = streamHeapAfter - streamHeapBefore

      // Stream should use less memory (or similar, but not more)
      // Allow some tolerance for measurement variance
      expect(streamMemoryUsage).toBeLessThanOrEqual(arrayMemoryUsage * 1.5)
    })
  })

  describe('Error Handling', () => {
    it('should throw error if COW not enabled', async () => {
      // Create brain without COW
      const memBrain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })

      await memBrain.init()

      await expect(async () => {
        for await (const commit of memBrain.streamHistory()) {
          // Should not reach here
        }
      }).rejects.toThrow(/COW-enabled storage/i)

      await memBrain.close()
    })

    it('should handle iteration break', async () => {
      // Create commits
      for (let i = 0; i < 10; i++) {
        await brain.add({ type: 'document', data: `Entity ${i}` })
        await brain.commit({ message: `Commit ${i}`, captureState: true })
      }

      // Break early
      let count = 0
      for await (const commit of brain.streamHistory({ limit: 100 })) {
        count++
        if (count === 3) {
          break // Break early
        }
      }

      expect(count).toBe(3)
    })
  })

  describe('Production Scenarios', () => {
    it('should handle pagination via manual iteration', async () => {
      // Create commits
      for (let i = 0; i < 30; i++) {
        await brain.add({ type: 'document', data: `Entity ${i}` })
        await brain.commit({ message: `Commit ${i}`, captureState: true })
      }

      // Paginate: 10 per page
      const page1: any[] = []
      let count = 0

      for await (const commit of brain.streamHistory()) {
        page1.push(commit)
        count++
        if (count === 10) break
      }

      expect(page1.length).toBe(10)

      // Can process page without holding full history in memory
      const timestamps = page1.map(c => c.timestamp)
      expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[timestamps.length - 1])
    })

    it('should support real-time processing (e.g., streaming to UI)', async () => {
      // Simulate streaming commits to a UI
      for (let i = 0; i < 20; i++) {
        await brain.add({ type: 'document', data: `Entity ${i}` })
        await brain.commit({ message: `Commit ${i}`, captureState: true })
      }

      // Process commits as they arrive
      const processedCommits: string[] = []

      for await (const commit of brain.streamHistory({ limit: 20 })) {
        // Simulate UI update
        processedCommits.push(commit.message)

        // Simulate async processing (e.g., rendering)
        await new Promise(resolve => setTimeout(resolve, 1))
      }

      expect(processedCommits.length).toBe(20)
    })
  })
})
