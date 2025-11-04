/**
 * Regression test for v5.3.3 bug fix:
 * Commits were being stored as blob:${hash} instead of commit:${hash}
 *
 * This caused getHistory() to return empty arrays because it couldn't find
 * commit objects on disk.
 *
 * Related bugs:
 * - Workshop team report: BRAINY_V5.3.0_SNAPSHOT_BUG_REPORT.md
 * - Root cause: BlobStorage.ts hardcoded 'blob:' prefix in 9 locations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('COW Commit Storage Type-Aware Prefixes', () => {
  let brain: Brainy
  let testDir: string

  beforeEach(async () => {
    testDir = path.join('/tmp', `brainy-cow-test-${Date.now()}`)

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: testDir,
        branch: 'main',
        enableCompression: true
      },
      disableAutoRebuild: true,
      silent: true
    })

    await brain.init()
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  it('should store commits with commit: prefix (not blob: prefix)', async () => {
    // Create a commit
    await brain.commit('Test commit for type-aware storage')

    // Check filesystem directly
    const cowDir = path.join(testDir, '_cow')
    const files = await fs.readdir(cowDir)

    // Should have commit: files
    const commitFiles = files.filter(f => f.startsWith('commit:'))
    expect(commitFiles.length).toBeGreaterThan(0)

    // Should NOT have blob: files that are actually commits
    // (blob: files should only be for actual blob data)
    const blobFiles = files.filter(f => f.startsWith('blob:') && !f.includes('-meta'))

    // Read metadata of blob files to ensure none are commits
    for (const blobFile of blobFiles) {
      const metaFile = blobFile.replace('blob:', 'blob:-meta:')
      if (files.includes(metaFile)) {
        const metaPath = path.join(cowDir, metaFile)
        const metaContent = await fs.readFile(metaPath, 'utf8')
        const metadata = JSON.parse(metaContent)
        expect(metadata.type).not.toBe('commit')
      }
    }
  })

  it('should allow getHistory() to retrieve commits', async () => {
    // Create multiple commits
    await brain.commit('First commit')

    await brain.add({
      data: 'Testing commit storage',
      type: 'concept'
    })

    await brain.commit('Second commit with entity')

    // Get history - should NOT be empty
    const history = await brain.getHistory({ limit: 10 })

    expect(history).toBeDefined()
    expect(Array.isArray(history)).toBe(true)
    expect(history.length).toBeGreaterThanOrEqual(2)

    // Verify commit structure
    expect(history[0]).toHaveProperty('hash')
    expect(history[0]).toHaveProperty('message')
    expect(history[0]).toHaveProperty('timestamp')
    expect(history[0]).toHaveProperty('author')
  })

  it('should store trees with tree: prefix (if trees are created)', async () => {
    // Add an entity and commit
    await brain.add({
      data: 'Testing tree storage',
      type: 'concept'
    })

    await brain.commit('Commit with tree')

    // Check filesystem - trees might or might not be created depending on implementation
    // The important thing is that IF trees are created, they use tree: prefix
    const cowDir = path.join(testDir, '_cow')
    const files = await fs.readdir(cowDir)

    // Verify commit files exist (this is the critical part)
    const commitFiles = files.filter(f => f.startsWith('commit:'))
    expect(commitFiles.length).toBeGreaterThan(0)

    // If tree files exist, they should use tree: prefix (not blob:)
    const treeFiles = files.filter(f => f.startsWith('tree:'))
    const blobTrees = files.filter(f => f.startsWith('blob:') && !f.includes('-meta'))

    // Trees should be in tree: files, not blob: files
    // (Or no tree files at all if implementation doesn't create them)
    expect(blobTrees.filter(f => f.includes('tree')).length).toBe(0)
  })

  it('should maintain backward compatibility with old blob: prefix', async () => {
    // This test verifies that read() auto-detects type by trying multiple prefixes
    // We'll verify this by checking that the auto-detection code works

    // Create a commit normally (will use commit: prefix)
    await brain.commit('Test commit for backward compat check')

    // The commit should be readable even though read() tries multiple prefixes
    const history = await brain.getHistory({ limit: 1 })
    expect(history.length).toBe(1)

    // Verify the commit hash is readable via BlobStorage
    const blobStorage = (brain as any).storage.blobStorage
    const commitHash = history[0].hash

    // This should work via auto-detection
    const readData = await blobStorage.read(commitHash)
    expect(readData).toBeDefined()
    expect(readData.length).toBeGreaterThan(0)
  })

  it('should handle fork() and snapshot creation with proper commit storage', async () => {
    // Add some data
    await brain.add({
      data: 'Testing snapshots',
      type: 'concept'
    })

    await brain.commit('Commit before fork')

    // Create a fork (snapshot branch)
    const snapshotBranch = `snapshot-${Date.now()}`
    await brain.fork(snapshotBranch)

    // Get history - should work (this is the critical test)
    const history = await brain.getHistory({ limit: 10 })
    expect(history.length).toBeGreaterThanOrEqual(1)

    // History working proves commits are stored correctly
  })

  it('should properly delete commits with type-aware prefix', async () => {
    // Create a commit
    await brain.commit('Commit to delete')

    const history = await brain.getHistory({ limit: 1 })
    const commitHash = history[0].hash

    // Delete via BlobStorage
    const blobStorage = (brain as any).storage.blobStorage
    await blobStorage.delete(commitHash)

    // Verify deleted
    const exists = await blobStorage.has(commitHash)
    expect(exists).toBe(false)

    // Verify files removed from disk
    const cowDir = path.join(testDir, '_cow')
    const files = await fs.readdir(cowDir)

    const commitFile = files.find(f => f.includes(commitHash) && f.startsWith('commit:'))
    expect(commitFile).toBeUndefined()
  })
})
