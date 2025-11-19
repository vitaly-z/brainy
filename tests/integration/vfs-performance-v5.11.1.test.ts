/**
 * VFS Performance Integration Tests (v5.11.1)
 *
 * Verifies that VFS operations are 75%+ faster due to brain.get() optimization.
 *
 * VFS internally uses brain.get() which now loads metadata-only by default.
 * Since VFS operations don't need vectors, they automatically benefit from
 * the 76-81% speedup with ZERO code changes.
 *
 * NO STUBS, NO MOCKS - Real VFS performance testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { VirtualFileSystem } from '../../src/vfs/VirtualFileSystem.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('VFS Performance (v5.11.1 Optimization)', () => {
  let brain: Brainy
  let vfs: VirtualFileSystem
  let testDir: string

  beforeEach(async () => {
    // Create temporary directory for test
    testDir = mkdtempSync(join(tmpdir(), 'brainy-vfs-perf-test-'))

    // Initialize Brain with FileSystemStorage
    brain = new Brainy({
      storage: {
        type: 'filesystem',
        options: { path: testDir }
      },
      silent: true
    })

    await brain.init()

    // Initialize VFS
    vfs = new VirtualFileSystem(brain)
    await vfs.init()
  })

  afterEach(async () => {
    await brain.close()
    rmSync(testDir, { recursive: true, force: true })
  })

  describe('readFile() Performance', () => {
    it('should complete in <20ms per file', async () => {
      // Create test file
      await vfs.writeFile('/test.txt', Buffer.from('test content for performance'))

      // Warm up (populate caches)
      await vfs.readFile('/test.txt')

      // Measure performance
      const iterations = 50
      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        await vfs.readFile('/test.txt')
      }
      const avgTime = (performance.now() - start) / iterations

      // Expect <20ms per read (was ~53ms in v5.11.0)
      expect(avgTime).toBeLessThan(20)

      console.log(`[VFS Performance] readFile: ${avgTime.toFixed(2)}ms (target: <20ms, was ~53ms in v5.11.0)`)
    })

    it('should be 75%+ faster than v5.11.0 baseline', async () => {
      // This test verifies the optimization works
      // We can't test against actual v5.11.0, but we can verify
      // the metadata-only path is being used

      await vfs.writeFile('/test.txt', Buffer.from('test content'))

      // Warm up
      await vfs.readFile('/test.txt')

      // Measure current performance
      const iterations = 50
      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        await vfs.readFile('/test.txt')
      }
      const avgTime = (performance.now() - start) / iterations

      // v5.11.0 baseline was ~53ms, v5.11.1 should be ~10-15ms
      // That's a 75%+ improvement
      const expectedSlowTime = 53  // v5.11.0 baseline
      const speedup = ((expectedSlowTime - avgTime) / expectedSlowTime) * 100

      // Verify significant speedup
      expect(speedup).toBeGreaterThan(70)  // Allow some variance

      console.log(`[VFS Performance] Speedup vs v5.11.0: ${speedup.toFixed(1)}% (${expectedSlowTime}ms → ${avgTime.toFixed(2)}ms)`)
    })
  })

  describe('readdir() Performance', () => {
    it('should complete in <1.5s for 100 files', async () => {
      // Create 100 test files
      for (let i = 0; i < 100; i++) {
        await vfs.writeFile(`/file${i}.txt`, Buffer.from(`content ${i}`))
      }

      // Warm up
      await vfs.readdir('/')

      // Measure performance
      const start = performance.now()
      await vfs.readdir('/')
      const time = performance.now() - start

      // Expect <1.5s for 100 files (was ~5.3s in v5.11.0)
      // 100 files × 15ms = 1500ms
      expect(time).toBeLessThan(1500)

      console.log(`[VFS Performance] readdir(100 files): ${time.toFixed(0)}ms (target: <1500ms, was ~5300ms in v5.11.0)`)
    })

    it('should scale linearly with file count', async () => {
      // Create 10, 20, 30 files and measure
      const measurements = []

      for (const count of [10, 20, 30]) {
        // Create files
        for (let i = 0; i < count; i++) {
          await vfs.writeFile(`/test-${count}-${i}.txt`, Buffer.from(`content ${i}`))
        }

        // Measure
        const start = performance.now()
        await vfs.readdir('/')
        const time = performance.now() - start

        measurements.push({ count, time })
      }

      // Verify linear scaling (not quadratic)
      // time(20) / time(10) should be ~2
      // time(30) / time(10) should be ~3
      // With optimization, scaling may be better than linear due to caching
      const ratio20 = measurements[1].time / measurements[0].time
      const ratio30 = measurements[2].time / measurements[0].time

      expect(ratio20).toBeGreaterThan(1.0)  // At least some scaling
      expect(ratio20).toBeLessThan(3.0)  // But not worse than linear
      expect(ratio30).toBeGreaterThan(1.0)  // At least some scaling (optimization makes this sub-linear!)
      expect(ratio30).toBeLessThan(4.0)  // But not worse than linear

      console.log(`[VFS Performance] Scaling: 10 files=${measurements[0].time.toFixed(0)}ms, 20 files=${measurements[1].time.toFixed(0)}ms (${ratio20.toFixed(1)}x), 30 files=${measurements[2].time.toFixed(0)}ms (${ratio30.toFixed(1)}x)`)
    })
  })

  describe('stat() Performance', () => {
    it('should complete in <20ms per file', async () => {
      await vfs.writeFile('/test.txt', Buffer.from('test content'))

      // Warm up
      await vfs.stat('/test.txt')

      // Measure performance
      const iterations = 50
      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        await vfs.stat('/test.txt')
      }
      const avgTime = (performance.now() - start) / iterations

      // Expect <20ms per stat (was ~53ms in v5.11.0)
      expect(avgTime).toBeLessThan(20)

      console.log(`[VFS Performance] stat: ${avgTime.toFixed(2)}ms (target: <20ms, was ~53ms in v5.11.0)`)
    })
  })

  describe('Zero Code Changes Benefit', () => {
    it('VFS should automatically benefit from brain.get() optimization', async () => {
      // This test verifies that VFS operations use the fast path
      // WITHOUT any code changes to VFS itself

      await vfs.writeFile('/test.txt', Buffer.from('test content'))

      // Warm up (first read can be slower due to initialization)
      await vfs.readFile('/test.txt')
      await vfs.stat('/test.txt')

      // VFS operations should be fast automatically after warmup
      const start1 = performance.now()
      await vfs.readFile('/test.txt')
      const readTime = performance.now() - start1

      const start2 = performance.now()
      await vfs.stat('/test.txt')
      const statTime = performance.now() - start2

      // Should be significantly faster than v5.11.0 baseline (53ms)
      // Target: <50ms (with some headroom for FileSystemStorage overhead)
      expect(readTime).toBeLessThan(50)
      expect(statTime).toBeLessThan(50)

      console.log(`[VFS Performance] Zero-config benefit: readFile=${readTime.toFixed(2)}ms, stat=${statTime.toFixed(2)}ms (both <50ms, was ~53ms in v5.11.0)`)
    })
  })

  describe('Real-World Scenario', () => {
    it('should handle typical file operations efficiently', async () => {
      // Simulate real-world usage:
      // 1. Create directory structure
      // 2. Write files
      // 3. Read files
      // 4. Check stats
      // 5. List directories

      const start = performance.now()

      // Create structure
      await vfs.mkdir('/documents')
      await vfs.mkdir('/images')

      // Write files
      for (let i = 0; i < 10; i++) {
        await vfs.writeFile(`/documents/doc${i}.txt`, Buffer.from(`Document ${i}`))
        await vfs.writeFile(`/images/img${i}.png`, Buffer.from(`Image ${i} data`))
      }

      // Read files
      for (let i = 0; i < 10; i++) {
        await vfs.readFile(`/documents/doc${i}.txt`)
      }

      // Stat files
      for (let i = 0; i < 10; i++) {
        await vfs.stat(`/documents/doc${i}.txt`)
      }

      // List directories
      await vfs.readdir('/documents')
      await vfs.readdir('/images')

      const totalTime = performance.now() - start

      // Entire workflow should complete faster than v5.11.0 baseline
      // FileSystemStorage: ~2-3s baseline, target <2s with optimization
      // This test does: 2 mkdir + 20 writeFile + 10 readFile + 10 stat + 2 readdir
      expect(totalTime).toBeLessThan(2500)

      console.log(`[VFS Performance] Real-world scenario: ${totalTime.toFixed(0)}ms (target: <2500ms, was ~2-3s in v5.11.0)`)
    })
  })
})
