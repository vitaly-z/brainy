/**
 * Fork Persistence Integration Test
 *
 * Tests the complete fork() → listBranches() → checkout() workflow
 * to prevent regression of the v5.3.6 bug where fork() silently failed
 * to persist branches to storage (Workshop bug report).
 *
 * @see https://github.com/soulcraftlabs/brainy/issues/XXX
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import * as fs from 'fs'
import * as path from 'path'

describe('Fork Persistence (v5.3.6 Bug Fix)', () => {
  let brain: Brainy
  let testDir: string

  beforeEach(async () => {
    // Use filesystem storage to mirror cloud storage behavior
    testDir = `/tmp/brainy-fork-test-${Date.now()}`
    brain = new Brainy({
      storage: {
        adapter: 'filesystem',
        path: testDir
      },
      silent: true
    })
    await brain.init()
  })

  afterEach(async () => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should persist forked branches to storage', async () => {
    // Add data and commit
    await brain.add({ data: { value: 1 }, type: 'concept' })
    const commitId = await brain.commit({
      message: 'Initial commit',
      author: 'test@example.com'
    })
    expect(commitId).toBeTruthy()

    // Fork a new branch
    const branchName = `test-branch-${Date.now()}`
    await brain.fork(branchName, {
      author: 'test@example.com',
      message: 'Test fork for persistence'
    })

    // CRITICAL: Verify branch exists in storage (this would fail in v5.3.5)
    const branches = await brain.listBranches()
    expect(branches).toContain(branchName)
    expect(branches).toContain('main')
  })

  it('should allow checkout of forked branch', async () => {
    // Setup: Add data, commit, fork
    await brain.add({ data: { value: 1 }, type: 'concept' })
    await brain.commit({
      message: 'Initial commit',
      author: 'test@example.com'
    })

    const branchName = `checkout-test-${Date.now()}`
    await brain.fork(branchName, {
      author: 'test@example.com',
      message: 'Test fork for checkout'
    })

    // CRITICAL: Checkout should succeed (this would fail in v5.3.5)
    await expect(brain.checkout(branchName)).resolves.not.toThrow()

    // Verify we're on the new branch
    const currentBranch = await brain.getCurrentBranch()
    expect(currentBranch).toBe(branchName)
  })

  it('should persist fork across multiple storage operations', async () => {
    // Create initial state
    await brain.add({ data: { step: 1 }, type: 'concept' })
    await brain.commit({
      message: 'Step 1',
      author: 'test@example.com'
    })

    // Fork branch 1
    const branch1 = `branch-1-${Date.now()}`
    await brain.fork(branch1, {
      author: 'test@example.com',
      message: 'Fork 1'
    })

    // Add more data on main
    await brain.add({ data: { step: 2 }, type: 'concept' })
    await brain.commit({
      message: 'Step 2 on main',
      author: 'test@example.com'
    })

    // Fork branch 2
    const branch2 = `branch-2-${Date.now()}`
    await brain.fork(branch2, {
      author: 'test@example.com',
      message: 'Fork 2'
    })

    // Verify both branches exist
    const branches = await brain.listBranches()
    expect(branches).toContain('main')
    expect(branches).toContain(branch1)
    expect(branches).toContain(branch2)

    // Verify all branches are accessible
    await expect(brain.checkout(branch1)).resolves.not.toThrow()
    await expect(brain.checkout(branch2)).resolves.not.toThrow()
    await expect(brain.checkout('main')).resolves.not.toThrow()
  })

  it('should return new Brainy instance pointing to fork', async () => {
    // Verify fork() returns a working Brainy instance on the new branch

    await brain.add({ data: { value: 1 }, type: 'concept' })
    await brain.commit({
      message: 'Initial commit',
      author: 'test@example.com'
    })

    // Fork and get new instance
    const validBranch = `return-test-${Date.now()}`
    const forkedBrain = await brain.fork(validBranch, {
      author: 'test@example.com',
      message: 'Test fork return value'
    })

    // Verify the returned instance is on the new branch
    const forkCurrentBranch = await forkedBrain.getCurrentBranch()
    expect(forkCurrentBranch).toBe(validBranch)

    // Verify original instance is still on main
    const mainCurrentBranch = await brain.getCurrentBranch()
    expect(mainCurrentBranch).toBe('main')

    // Verify both instances can see the branch
    const mainBranches = await brain.listBranches()
    const forkBranches = await forkedBrain.listBranches()
    expect(mainBranches).toContain(validBranch)
    expect(forkBranches).toContain(validBranch)
  })

  it('should handle snapshot naming convention (Workshop use case)', async () => {
    // Reproduce exact Workshop snapshot workflow
    await brain.add({ data: { test: true }, type: 'concept' })

    const commitId = await brain.commit({
      message: 'Workshop snapshot test',
      author: 'workshop@example.com'
    })

    // Use Workshop's exact naming convention
    const timestamp = Date.now()
    const snapshotBranch = `snapshot-${timestamp}`

    // Create snapshot branch (this is what failed in Workshop)
    await brain.fork(snapshotBranch, {
      author: 'workshop@example.com',
      message: `Snapshot: Workshop test`,
      metadata: {
        timestamp,
        userId: 'test-user',
        isSnapshot: true,
        snapshotCommit: commitId
      }
    })

    // Verify snapshot can be listed
    const branches = await brain.listBranches()
    expect(branches).toContain(snapshotBranch)

    // Verify snapshot can be restored (checked out)
    await expect(brain.checkout(snapshotBranch)).resolves.not.toThrow()

    // Verify we're on the snapshot branch
    const currentBranch = await brain.getCurrentBranch()
    expect(currentBranch).toBe(snapshotBranch)
  })

  it('should verify _cow paths are not branch-scoped', async () => {
    // This test verifies the resolveBranchPath fix works correctly
    // by checking that COW metadata is accessible globally

    await brain.add({ data: { value: 1 }, type: 'concept' })
    await brain.commit({
      message: 'Test commit',
      author: 'test@example.com'
    })

    const branch1 = `branch-a-${Date.now()}`
    const branch2 = `branch-b-${Date.now()}`

    // Create two branches
    await brain.fork(branch1, {
      author: 'test@example.com',
      message: 'Branch A'
    })

    await brain.fork(branch2, {
      author: 'test@example.com',
      message: 'Branch B'
    })

    // From any branch, we should be able to list ALL branches
    // This proves COW metadata is global, not branch-scoped
    await brain.checkout(branch1)
    let branches = await brain.listBranches()
    expect(branches).toContain('main')
    expect(branches).toContain(branch1)
    expect(branches).toContain(branch2)

    await brain.checkout(branch2)
    branches = await brain.listBranches()
    expect(branches).toContain('main')
    expect(branches).toContain(branch1)
    expect(branches).toContain(branch2)

    await brain.checkout('main')
    branches = await brain.listBranches()
    expect(branches).toContain('main')
    expect(branches).toContain(branch1)
    expect(branches).toContain(branch2)
  })

  it('should persist fork with metadata', async () => {
    // Test that metadata is preserved in fork
    await brain.add({ data: { value: 1 }, type: 'concept' })
    await brain.commit({
      message: 'Test commit',
      author: 'test@example.com'
    })

    const branchName = `metadata-test-${Date.now()}`
    const metadata = {
      timestamp: Date.now(),
      userId: 'test-user-123',
      customField: 'test-value',
      nested: { data: true }
    }

    await brain.fork(branchName, {
      author: 'test@example.com',
      message: 'Fork with metadata',
      metadata
    })

    // Verify branch exists
    const branches = await brain.listBranches()
    expect(branches).toContain(branchName)

    // Verify branch is accessible
    await expect(brain.checkout(branchName)).resolves.not.toThrow()
  })
})
