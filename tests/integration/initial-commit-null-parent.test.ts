/**
 * Regression test for v5.3.3 NULL parent bug
 *
 * BUG: CommitObject.walk() didn't guard against NULL parent hash, causing
 * "Blob metadata not found: 0000...0000" error when calling getHistory()
 * on a fresh database with only the initial commit.
 *
 * ROOT CAUSE: Initial commit has parent = null or NULL_HASH ('0000...0000'),
 * but while(currentHash) treated the string as truthy and tried to read it.
 *
 * FIXED IN: v5.3.4
 * - Added isNullHash() guard in CommitObject.walk()
 * - Added defensive check in BlobStorage.read()
 * - Created NULL_HASH constant to prevent hardcoding
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NULL_HASH } from '../../src/storage/cow/constants.js'
import * as fs from 'fs'

const TEST_DATA_PATH = './test-null-parent-data'

describe('Initial Commit NULL Parent Bug (v5.3.3 regression)', () => {
  let brain: Brainy

  beforeEach(async () => {
    // Clean up test data
    if (fs.existsSync(TEST_DATA_PATH)) {
      fs.rmSync(TEST_DATA_PATH, { recursive: true, force: true })
    }

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: TEST_DATA_PATH,
        branch: 'main',
        enableCompression: true
      },
      disableAutoRebuild: true,
      silent: true
    })

    await brain.init()
  })

  afterEach(() => {
    if (fs.existsSync(TEST_DATA_PATH)) {
      fs.rmSync(TEST_DATA_PATH, { recursive: true, force: true })
    }
  })

  it('should handle getHistory() on fresh database with only initial commit', async () => {
    // Fresh brain has only the initial commit (created during init)
    // This was throwing "Blob metadata not found: 0000...0000" in v5.3.3

    // Get history - should NOT throw
    const history = await brain.getHistory({ limit: 10 })

    // Should return the initial commit
    expect(history).toBeDefined()
    expect(Array.isArray(history)).toBe(true)
    expect(history.length).toBe(1)

    // Initial commit should have specific properties
    const initialCommit = history[0]
    expect(initialCommit.message).toBe('Initial commit')
    expect(initialCommit.author).toBe('system')
    // Parent can be null or undefined for initial commit
    expect(initialCommit.parent == null).toBe(true)
  })

  it('should stop walk at initial commit (parent = null)', async () => {
    // Note: brain.commit() creates "Snapshot commit" messages by default
    // Create 2 commits
    await brain.add({ data: 'First entity', type: 'concept' })
    await brain.commit('First user commit')

    await brain.add({ data: 'Second entity', type: 'concept' })
    await brain.commit('Second user commit')

    // Get full history
    const history = await brain.getHistory({ limit: 100 })

    // Should have at least 3 commits (2 user + 1 initial)
    expect(history.length).toBeGreaterThanOrEqual(3)

    // Last commit should be initial commit with no parent
    const initialCommit = history[history.length - 1]
    expect(initialCommit.message).toBe('Initial commit')
    // Parent can be null or undefined for initial commit
    expect(initialCommit.parent == null).toBe(true)
  })

  it('should not attempt to read NULL hash from BlobStorage', async () => {
    // Direct test: attempting to read NULL_HASH should throw clear error
    const blobStorage = (brain as any).storage.blobStorage

    // Should throw clear error message
    await expect(
      blobStorage.read(NULL_HASH)
    ).rejects.toThrow(/sentinel value/)

    // Error message should mention what NULL_HASH is for
    await expect(
      blobStorage.read(NULL_HASH)
    ).rejects.toThrow(/no parent/)
  })

  it('should handle multiple calls to getHistory() consistently', async () => {
    // Ensure caching doesn't break NULL hash handling

    // First call
    const history1 = await brain.getHistory({ limit: 10 })
    expect(history1.length).toBe(1)

    // Add a commit
    await brain.add({ data: 'Test entity', type: 'concept' })
    await brain.commit('Test commit')

    // Second call (should now have 2 commits)
    const history2 = await brain.getHistory({ limit: 10 })
    expect(history2.length).toBe(2)

    // Third call (should still have 2 commits)
    const history3 = await brain.getHistory({ limit: 10 })
    expect(history3.length).toBe(2)

    // All should end with initial commit
    expect(history1[history1.length - 1].message).toBe('Initial commit')
    expect(history2[history2.length - 1].message).toBe('Initial commit')
    expect(history3[history3.length - 1].message).toBe('Initial commit')
  })

  it('should handle walking with maxDepth on initial commit', async () => {
    // Edge case: maxDepth = 1 on fresh database

    const history = await brain.getHistory({ limit: 1 })

    expect(history.length).toBe(1)
    expect(history[0].message).toBe('Initial commit')
  })
})
