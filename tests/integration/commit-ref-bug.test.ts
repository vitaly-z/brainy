/**
 * Integration test to reproduce commit() ref update bug
 * Bug: commit() creates blobs but doesn't update branch refs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'

const TEST_DATA_PATH = './test-commit-ref-bug-data'

describe('Commit Ref Update Bug (v5.2.0)', () => {
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
      silent: false  // Enable logging
    })

    await brain.init()
  })

  afterEach(() => {
    if (fs.existsSync(TEST_DATA_PATH)) {
      fs.rmSync(TEST_DATA_PATH, { recursive: true, force: true })
    }
  })

  it('should update branch ref after commit', async () => {
    // Add an entity
    await brain.add({
      data: 'Test entity',
      type: 'concept',
      metadata: { test: true }
    })

    // Create first commit
    const commit1Hash = await brain.commit({
      message: 'First commit',
      author: 'test@example.com'
    })

    console.log(`\n=== Commit 1 created: ${commit1Hash} ===`)

    // Check the ref file directly
    const refPath = path.join(TEST_DATA_PATH, '_cow', 'ref:refs', 'heads', 'main.gz')

    expect(fs.existsSync(refPath), 'Ref file should exist').toBe(true)

    const refContent1 = JSON.parse(
      zlib.gunzipSync(fs.readFileSync(refPath)).toString()
    )

    console.log('Ref after commit 1:', {
      commitHash: refContent1.commitHash,
      updatedAt: new Date(refContent1.updatedAt).toISOString()
    })

    // THIS IS THE BUG: commitHash should equal commit1Hash
    expect(refContent1.commitHash).toBe(commit1Hash)
    expect(refContent1.commitHash).not.toBe('0'.repeat(64))

    // Add another entity
    await brain.add({
      data: 'Second entity',
      type: 'concept'
    })

    // Create second commit
    const commit2Hash = await brain.commit({
      message: 'Second commit',
      author: 'test@example.com'
    })

    console.log(`\n=== Commit 2 created: ${commit2Hash} ===`)

    // Check ref again
    const refContent2 = JSON.parse(
      zlib.gunzipSync(fs.readFileSync(refPath)).toString()
    )

    console.log('Ref after commit 2:', {
      commitHash: refContent2.commitHash,
      updatedAt: new Date(refContent2.updatedAt).toISOString()
    })

    // THIS IS THE BUG: commitHash should equal commit2Hash
    expect(refContent2.commitHash).toBe(commit2Hash)
    expect(refContent2.updatedAt).toBeGreaterThan(refContent1.updatedAt)
  })
})
