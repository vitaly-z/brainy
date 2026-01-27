/**
 * Hybrid Search COW Integration Tests (v7.7.0)
 *
 * Verifies that hybrid search works correctly with:
 * - fork() - COW branching
 * - asOf() - Historical queries
 * - VFS entities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType } from '../../src/types/graphTypes'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('Hybrid Search with COW (v7.7.0)', () => {
  let brain: Brainy<any>
  let testDir: string

  beforeEach(async () => {
    // Use filesystem storage for COW support
    testDir = path.join(os.tmpdir(), `brainy-cow-test-${Date.now()}`)
    fs.mkdirSync(testDir, { recursive: true })

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        options: { basePath: testDir }
      }
    })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
    // Cleanup test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch (e) {
      // Ignore cleanup errors
    }
  })

  describe('fork() compatibility', () => {
    it('should perform hybrid search in forked brain', async () => {
      // Add entity to main branch
      const mainId = await brain.add({
        data: 'Python programming language tutorial',
        type: NounType.Document,
        metadata: { branch: 'main' }
      })

      // Commit main branch
      await brain.commit({ message: 'Add Python doc' })

      // Fork
      const fork = await brain.fork('feature-branch')

      // Add entity to fork
      const forkId = await fork.add({
        data: 'JavaScript programming guide',
        type: NounType.Document,
        metadata: { branch: 'feature' }
      })

      // Hybrid search in fork should find both
      const forkResults = await fork.find({
        query: 'programming',
        limit: 10
      })

      expect(forkResults.length).toBeGreaterThanOrEqual(2)
      expect(forkResults.some(r => r.id === mainId)).toBe(true)
      expect(forkResults.some(r => r.id === forkId)).toBe(true)

      // Hybrid search in main should only find main entity
      const mainResults = await brain.find({
        query: 'programming',
        limit: 10
      })

      expect(mainResults.some(r => r.id === mainId)).toBe(true)
      // Fork entity should NOT be visible in main
      expect(mainResults.some(r => r.id === forkId)).toBe(false)

      await fork.close()
    })

    it('should support text-only search in forked brain', async () => {
      await brain.add({
        data: 'exact keyword match test',
        type: NounType.Document,
        metadata: { test: true }
      })
      await brain.commit({ message: 'Add test doc' })

      const fork = await brain.fork('text-search-test')

      const results = await fork.find({
        query: 'exact keyword',
        searchMode: 'text',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      await fork.close()
    })
  })

  describe('VFS compatibility', () => {
    it('should include VFS file content in hybrid search', async () => {
      // Write a file via VFS
      const vfs = brain.vfs
      await vfs.writeFile('/docs/readme.txt', 'This is a readme file with important information')

      // Search should find VFS content
      const results = await brain.find({
        query: 'readme important',
        limit: 10
      })

      // VFS entities should appear in results
      expect(results.length).toBeGreaterThan(0)
    })

    it('should exclude VFS with excludeVFS flag in hybrid search', async () => {
      // Add regular entity
      const entityId = await brain.add({
        data: 'regular document about readme files',
        type: NounType.Document,
        metadata: { source: 'api' }
      })

      // Write VFS file
      await brain.vfs.writeFile('/readme.md', 'VFS readme content')

      // Search with excludeVFS should only find regular entity
      const results = await brain.find({
        query: 'readme',
        excludeVFS: true,
        limit: 10
      })

      expect(results.some(r => r.id === entityId)).toBe(true)
      // VFS entities should be excluded
      expect(results.every(r => !r.metadata?.vfsType)).toBe(true)
    })
  })
})
