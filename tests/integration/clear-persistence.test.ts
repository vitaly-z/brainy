/**
 * Integration tests for clear() bug fix (v5.10.4)
 *
 * Bug report: Workshop team reported that brain.clear() doesn't fully delete persistent storage.
 * After calling clear() and creating a new Brainy instance, all data was restored from _cow/ directory.
 *
 * Root cause: Setting cowEnabled = false on old instance doesn't affect new instances.
 * Fix: Create persistent marker file that survives instance restarts.
 *
 * These tests verify:
 * 1. clear() actually deletes all data
 * 2. New instances don't restore data from _cow/
 * 3. Marker file persists across restarts
 * 4. Works for all storage adapters
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'

describe('Clear Persistence Bug Fix (v5.10.4)', () => {
  const testStoragePath = './test-clear-persistence-' + Date.now()

  afterEach(async () => {
    // Cleanup test storage
    try {
      if (fs.existsSync(testStoragePath)) {
        await fs.promises.rm(testStoragePath, { recursive: true, force: true })
      }
    } catch (error) {
      console.warn('Failed to cleanup test storage:', error)
    }
  })

  it('should fully clear persistent storage (Workshop scenario)', async () => {
    // Step 1: Create and populate instance
    const brain1 = new Brainy({
      storage: {
        type: 'filesystem',
        path: testStoragePath,
        enableCompression: true
      }
    })
    await brain1.init()

    // Add data (using only entities, not VFS)
    const entityId = await brain1.add({ data: 'Test Entity', type: 'concept' })

    // Verify data exists (filter by type to exclude VFS directories)
    const entityCount1 = (await brain1.find({ type: 'concept' })).length
    expect(entityCount1).toBe(1)

    // Step 2: Clear all data
    await brain1.clear()

    // Verify cleared in same instance (filter by type to exclude VFS directories)
    const entityCount2 = (await brain1.find({ type: 'concept' })).length
    expect(entityCount2).toBe(0)

    // Step 3: Create NEW instance (simulate server restart)
    const brain2 = new Brainy({
      storage: {
        type: 'filesystem',
        path: testStoragePath,
        enableCompression: true
      }
    })
    await brain2.init()

    // CRITICAL: Verify data is NOT restored (THE BUG)
    const entityCount3 = (await brain2.find({ type: 'concept' })).length

    expect(entityCount3).toBe(0) // Should be 0, not 1
  })

  it('should create cow-disabled marker file', async () => {
    const brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: testStoragePath
      }
    })
    await brain.init()

    // Add some data to ensure COW is initialized
    await brain.add({ data: 'Test', type: 'concept' })

    // Clear
    await brain.clear()

    // Check for marker file
    const markerPath = path.join(testStoragePath, '_system', 'cow-disabled')
    const markerExists = fs.existsSync(markerPath)
    expect(markerExists).toBe(true)
  })

  it('should delete _cow/ directory', async () => {
    const brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: testStoragePath
      }
    })
    await brain.init()

    // Add data to create COW commits
    await brain.add({ data:'Test', type: 'concept' })

    // Verify _cow/ exists
    const cowPath = path.join(testStoragePath, '_cow')
    const cowExistsBefore = fs.existsSync(cowPath)
    expect(cowExistsBefore).toBe(true)

    // Clear
    await brain.clear()

    // Verify _cow/ is deleted
    const cowExistsAfter = fs.existsSync(cowPath)
    expect(cowExistsAfter).toBe(false)
  })

  it('should prevent COW reinitialization after clear()', async () => {
    // Create and clear
    const brain1 = new Brainy({
      storage: { type: 'filesystem', path: testStoragePath }
    })
    await brain1.init()
    await brain1.add({ data:'Test', type: 'concept' })
    await brain1.clear()

    // Create new instance
    const brain2 = new Brainy({
      storage: { type: 'filesystem', path: testStoragePath }
    })
    await brain2.init()

    // Add new data - should NOT recreate _cow/
    // (COW stays disabled because marker exists)
    await brain2.add({ data:'New Data', type: 'concept' })

    // Verify _cow/ still doesn't exist
    const cowPath = path.join(testStoragePath, '_cow')
    const cowExists = fs.existsSync(cowPath)
    expect(cowExists).toBe(false)
  })

  it('should work across multiple clear() calls', async () => {
    const storagePath = testStoragePath + '-multi'

    try {
      // Iteration 1
      const brain1 = new Brainy({ storage: { type: 'filesystem', path: storagePath }})
      await brain1.init()
      await brain1.add({ data:'Entity 1', type: 'concept' })
      expect((await brain1.find({ type: 'concept' })).length).toBe(1)
      await brain1.clear()

      // Iteration 2
      const brain2 = new Brainy({ storage: { type: 'filesystem', path: storagePath }})
      await brain2.init()
      expect((await brain2.find({ type: 'concept' })).length).toBe(0)
      await brain2.add({ data:'Entity 2', type: 'concept' })
      expect((await brain2.find({ type: 'concept' })).length).toBe(1)
      await brain2.clear()

      // Iteration 3
      const brain3 = new Brainy({ storage: { type: 'filesystem', path: storagePath }})
      await brain3.init()
      expect((await brain3.find({ type: 'concept' })).length).toBe(0)
    } finally {
      // Cleanup
      if (fs.existsSync(storagePath)) {
        await fs.promises.rm(storagePath, { recursive: true, force: true })
      }
    }
  })

  it('should clear both entities and relations', async () => {
    const brain1 = new Brainy({ storage: { type: 'filesystem', path: testStoragePath }})
    await brain1.init()

    // Add graph data
    const entity1Id = await brain1.add({ data:'Entity 1', type: 'person' })
    const entity2Id = await brain1.add({ data:'Entity 2', type: 'concept' })
    await brain1.relate({ from: entity1Id, to: entity2Id, type: 'relatedTo' })

    // Verify data exists
    expect((await brain1.find({ type: 'person' })).length).toBe(1)
    expect((await brain1.find({ type: 'concept' })).length).toBe(1)
    expect((await brain1.getRelations({})).length).toBe(1)

    // Clear
    await brain1.clear()

    // Create new instance
    const brain2 = new Brainy({ storage: { type: 'filesystem', path: testStoragePath }})
    await brain2.init()

    // Verify everything is cleared
    expect((await brain2.find({ type: 'person' })).length).toBe(0)
    expect((await brain2.find({ type: 'concept' })).length).toBe(0)
    expect((await brain2.getRelations({})).length).toBe(0)
  })

  it('should handle clear() on empty storage', async () => {
    const brain = new Brainy({ storage: { type: 'filesystem', path: testStoragePath }})
    await brain.init()

    // Clear without adding any data
    await expect(brain.clear()).resolves.not.toThrow()

    // Should create marker even if no data was present
    const markerPath = path.join(testStoragePath, '_system', 'cow-disabled')
    const markerExists = fs.existsSync(markerPath)
    expect(markerExists).toBe(true)
  })
})

describe('Clear() works for MemoryStorage', () => {
  it('should clear memory storage completely', async () => {
    const brain1 = new Brainy({ storage: { type: 'memory' }})
    await brain1.init()

    await brain1.add({ data:'Test', type: 'concept' })
    expect((await brain1.find({ type: 'concept' })).length).toBe(1)

    await brain1.clear()
    expect((await brain1.find({ type: 'concept' })).length).toBe(0)

    // Note: MemoryStorage doesn't persist, so we can't test instance restart
    // The marker methods are no-ops for MemoryStorage
  })
})
