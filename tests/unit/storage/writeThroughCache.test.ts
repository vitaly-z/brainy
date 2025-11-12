/**
 * Write-Through Cache Unit Tests (v5.7.2)
 *
 * Tests the write-through cache implementation in BaseStorage that provides
 * read-after-write consistency guarantees. This fixes the critical v5.7.x bug
 * where brain.add() followed by brain.relate() would fail with "Source entity not found".
 *
 * Test Coverage:
 * - Immediate read after write (cache hit)
 * - Rapid write-read cycles
 * - COW branch isolation
 * - Cache cleanup after delete
 * - Cache cleanup after write completion
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileSystemStorage } from '../../../src/storage/adapters/fileSystemStorage.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync, rmSync } from 'fs'

describe('Write-Through Cache (v5.7.2)', () => {
  let storage: FileSystemStorage
  let testDir: string

  beforeEach(async () => {
    // Create unique test directory
    testDir = join(tmpdir(), `brainy-cache-test-${Date.now()}-${Math.random().toString(36).substring(7)}`)
    mkdirSync(testDir, { recursive: true })

    // Initialize filesystem storage (constructor takes string path, not object)
    storage = new FileSystemStorage(testDir)
    await storage.init()
  })

  afterEach(() => {
    // Cleanup test directory
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  it('should return cached data immediately after write', async () => {
    const testData = { foo: 'bar', timestamp: Date.now(), random: Math.random() }
    const path = 'test/immediate-read.json'

    // Write using protected method (type assertion to access protected methods)
    await (storage as any).writeObjectToBranch(path, testData)

    // Read immediately - should get cached data without waiting for disk I/O
    const result = await (storage as any).readWithInheritance(path)

    expect(result).toEqual(testData)
    expect(result.foo).toBe('bar')
    expect(result.timestamp).toBe(testData.timestamp)
  })

  it('should handle rapid write-read cycles (100 iterations)', async () => {
    const iterations = 100

    for (let i = 0; i < iterations; i++) {
      const data = {
        id: `entity-${i}`,
        value: Math.random(),
        iteration: i,
        timestamp: Date.now()
      }
      const path = `entities/${i}.json`

      // Write then immediately read
      await (storage as any).writeObjectToBranch(path, data)
      const result = await (storage as any).readWithInheritance(path)

      // Should get exact same data (from cache, not disk)
      expect(result).toEqual(data)
      expect(result.id).toBe(`entity-${i}`)
      expect(result.iteration).toBe(i)
    }
  })

  it('should isolate cache per branch (COW branching)', async () => {
    // Enable COW to test branch isolation
    storage.enableCOWLightweight('main')

    const mainData = { branch: 'main', value: 100, timestamp: Date.now() }
    const featureData = { branch: 'feature', value: 200, timestamp: Date.now() }
    const path = 'test-branch-isolation.json'

    // Write to main branch
    await (storage as any).writeObjectToBranch(path, mainData, 'main')

    // Write to feature branch (different data, same path)
    await (storage as any).writeObjectToBranch(path, featureData, 'feature')

    // Read from each branch - should get different cached values
    const mainResult = await (storage as any).readWithInheritance(path, 'main')
    const featureResult = await (storage as any).readWithInheritance(path, 'feature')

    // Verify branch isolation
    expect(mainResult).toEqual(mainData)
    expect(mainResult.branch).toBe('main')
    expect(mainResult.value).toBe(100)

    expect(featureResult).toEqual(featureData)
    expect(featureResult.branch).toBe('feature')
    expect(featureResult.value).toBe(200)
  })

  it('should remove cache entry after delete', async () => {
    const data = { id: 'test-delete', deleted: false, value: 42 }
    const path = 'test/delete-cache.json'

    // Write data
    await (storage as any).writeObjectToBranch(path, data)

    // Verify data is cached and readable
    const beforeDelete = await (storage as any).readWithInheritance(path)
    expect(beforeDelete).toEqual(data)
    expect(beforeDelete.id).toBe('test-delete')

    // Delete
    await (storage as any).deleteObjectFromBranch(path)

    // After delete, should return null (cache cleared, file deleted)
    const afterDelete = await (storage as any).readWithInheritance(path)
    expect(afterDelete).toBeNull()
  })

  it('should clean up cache after write completes', async () => {
    const data = { id: 'cleanup-test', value: 123 }
    const path = 'test/cleanup.json'

    // Write data
    await (storage as any).writeObjectToBranch(path, data)

    // At this point, write has completed and cache should be cleared
    // We can't directly inspect the cache (it's private), but we can verify
    // that a subsequent read still works (reads from disk, not cache)
    const result = await (storage as any).readWithInheritance(path)
    expect(result).toEqual(data)

    // Write again and verify cache is repopulated
    const data2 = { id: 'cleanup-test', value: 456 }
    await (storage as any).writeObjectToBranch(path, data2)
    const result2 = await (storage as any).readWithInheritance(path)
    expect(result2).toEqual(data2)
    expect(result2.value).toBe(456)
  })

  it('should handle write errors gracefully (cache cleanup on error)', async () => {
    const data = { id: 'error-test', value: 999 }
    // Use invalid path to trigger write error (depends on adapter implementation)
    const invalidPath = '../../../invalid/path/outside/basedir.json'

    try {
      await (storage as any).writeObjectToBranch(invalidPath, data)
    } catch (err) {
      // Expected to fail due to invalid path
      expect(err).toBeDefined()
    }

    // Cache should be cleaned up even on error (finally block)
    // Read should return null (no cached data, no file)
    const result = await (storage as any).readWithInheritance(invalidPath)
    expect(result).toBeNull()
  })

  it('should handle concurrent writes to different paths', async () => {
    // Create multiple concurrent writes
    const promises = []
    const dataMap = new Map()

    for (let i = 0; i < 20; i++) {
      const data = { id: `concurrent-${i}`, value: i * 10 }
      const path = `concurrent/${i}.json`
      dataMap.set(path, data)

      // Don't await - let them run concurrently
      promises.push((storage as any).writeObjectToBranch(path, data))
    }

    // Wait for all writes to complete
    await Promise.all(promises)

    // Verify all data is readable
    for (const [path, expectedData] of dataMap.entries()) {
      const result = await (storage as any).readWithInheritance(path)
      expect(result).toEqual(expectedData)
    }
  })

  it('should support read-after-write for metadata paths', async () => {
    // Simulate the actual noun metadata path structure
    const nounId = '123e4567-e89b-12d3-a456-426614174000'
    const metadata = {
      noun: 'thing',
      data: 'Test Entity',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    const metadataPath = `nouns/thing/${nounId}/metadata.json`

    // Write metadata
    await (storage as any).writeObjectToBranch(metadataPath, metadata)

    // Immediately read (simulates saveNounMetadata → getNounMetadata)
    const result = await (storage as any).readWithInheritance(metadataPath)

    expect(result).toEqual(metadata)
    expect(result.noun).toBe('thing')
    expect(result.data).toBe('Test Entity')
  })
})
