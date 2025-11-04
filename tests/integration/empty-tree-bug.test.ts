/**
 * Reproduction test for empty tree bug in v5.3.1
 *
 * BUG: brain.getHistory() throws "Blob not found: 0000...0" when commits
 * have empty trees (entityCount: 0).
 *
 * The zero hash represents an empty tree and should be handled gracefully.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'

const TEST_DATA_PATH = './test-empty-tree-bug-data'

describe('Empty Tree Bug (v5.3.1)', () => {
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

  it('should handle getHistory() with empty tree commit', async () => {
    // Create a commit with NO entities (empty tree)
    const commitId = await brain.commit({
      message: 'Empty workspace snapshot',
      author: 'test-user',
      metadata: {
        timestamp: Date.now(),
        isSnapshot: true
      }
    })

    expect(commitId).toBeTruthy()
    console.log('✅ Commit created:', commitId)

    // Read the commit blob to inspect it
    const blobStorage = (brain.storage as any).blobStorage
    const refManager = (brain.storage as any).refManager
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')

    const commit = await CommitObject.read(blobStorage, commitId)
    console.log('📄 Commit structure:', JSON.stringify(commit, null, 2))

    // Check what the ref points to
    const refHash = await refManager.resolveRef('main')

    // If ref is zero hash, that's the bug
    const zeroHash = '0000000000000000000000000000000000000000000000000000000000000000'
    if (refHash === zeroHash) {
      throw new Error(`BUG CONFIRMED: Ref "main" points to zero hash! commitId=${commitId}, refHash=${refHash}, tree=${commit.tree}`)
    }

    // Verify commitId is not zero hash
    expect(commitId).not.toBe(zeroHash)
    expect(refHash).toBe(commitId)

    // This should NOT throw "Blob not found: 0000...0"
    // Empty trees should be handled gracefully
    try {
      const history = await brain.getHistory({ limit: 50 })

      expect(history).toBeDefined()
      expect(Array.isArray(history)).toBe(true)
      console.log('✅ getHistory() works with empty tree')
      console.log('   History length:', history.length)
    } catch (error: any) {
      console.log('❌ Error during getHistory():', error.message)
      console.log('   Commit tree hash:', commit.tree)
      console.log('   Commit parent hash:', commit.parent)
      throw error
    }
  })

  it('should handle multiple commits with empty trees', async () => {
    // Create first empty commit
    await brain.commit({
      message: 'First empty snapshot',
      author: 'user1'
    })

    // Create second empty commit
    await brain.commit({
      message: 'Second empty snapshot',
      author: 'user2'
    })

    // Get history - should NOT throw
    const history = await brain.getHistory({ limit: 10 })

    expect(history).toBeDefined()
    expect(history.length).toBeGreaterThanOrEqual(2)
    console.log('✅ Multiple empty commits work')
  })

  it('should handle mixed commits (empty + with entities)', async () => {
    // Create empty commit
    await brain.commit({
      message: 'Empty snapshot',
      author: 'user1'
    })

    // Add entity
    await brain.add({
      data: 'Test entity',
      type: 'concept'
    })

    // Create commit with entities
    await brain.commit({
      message: 'Snapshot with entities',
      author: 'user2'
    })

    // Get history - should handle both empty and non-empty trees
    const history = await brain.getHistory({ limit: 10 })

    expect(history).toBeDefined()
    expect(history.length).toBeGreaterThanOrEqual(2)
    console.log('✅ Mixed commits (empty + entities) work')
  })
})
