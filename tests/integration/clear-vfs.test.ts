/**
 * Integration tests for clear() VFS reinitialization fix (v7.3.1)
 *
 * Bug report: Workshop team reported that brain.clear() breaks VFS operations.
 * After calling clear(), VFS operations fail with:
 * "Error: Source entity 00000000-0000-0000-0000-000000000000 not found"
 *
 * Root cause: clear() deleted the VFS root entity but didn't reset/reinitialize
 * the VFS instance. The VFS remained in memory pointing to the deleted root.
 *
 * Fix: Reset VFS state in clear() following the checkout() pattern.
 *
 * These tests verify:
 * 1. VFS operations work after clear() without instance recreation
 * 2. clear() works when VFS was never used
 * 3. VFS root entity is properly reinitialized
 * 4. Old VFS data is actually deleted
 */

import { describe, it, expect } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'

describe('VFS operations after clear() (v7.3.1 fix)', () => {
  // Use unique paths per test to avoid filesystem conflicts
  const getTestPath = () => `./test-clear-vfs-${Date.now()}-${Math.random().toString(36).slice(2)}`

  // Helper to clean up brain and storage after each test
  async function cleanup(brain: Brainy | null, storagePath?: string) {
    try {
      if (brain) {
        await brain.close()
      }
    } catch (e) {
      // Ignore close errors
    }
    try {
      if (storagePath && fs.existsSync(storagePath)) {
        await fs.promises.rm(storagePath, { recursive: true, force: true })
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  it('should allow VFS operations after brain.clear() without recreation (memory)', async () => {
    const brain = new Brainy({ storage: { type: 'memory' } })
    try {
      await brain.init()

      // Use VFS before clear
      await brain.vfs.writeFile('/test.txt', Buffer.from('hello'))
      const contentBefore = await brain.vfs.readFile('/test.txt')
      expect(contentBefore.toString()).toBe('hello')

      // Clear all data
      await brain.clear()

      // VFS should work immediately without needing instance recreation
      await brain.vfs.writeFile('/after-clear.txt', Buffer.from('world'))
      const contentAfter = await brain.vfs.readFile('/after-clear.txt')
      expect(contentAfter.toString()).toBe('world')

      // Original file should not exist
      await expect(brain.vfs.readFile('/test.txt')).rejects.toThrow()
    } finally {
      await cleanup(brain)
    }
  })

  it('should allow VFS operations after brain.clear() without recreation (filesystem)', async () => {
    const testPath = getTestPath()
    const brain = new Brainy({
      storage: { type: 'filesystem', path: testPath }
    })
    try {
      await brain.init()

      // Use VFS before clear
      await brain.vfs.writeFile('/test.txt', Buffer.from('hello'))
      const contentBefore = await brain.vfs.readFile('/test.txt')
      expect(contentBefore.toString()).toBe('hello')

      // Clear all data
      await brain.clear()

      // VFS should work immediately without needing instance recreation
      await brain.vfs.writeFile('/after-clear.txt', Buffer.from('world'))
      const contentAfter = await brain.vfs.readFile('/after-clear.txt')
      expect(contentAfter.toString()).toBe('world')

      // Original file should not exist
      await expect(brain.vfs.readFile('/test.txt')).rejects.toThrow()
    } finally {
      await cleanup(brain, testPath)
    }
  })

  it('should handle clear() when VFS was never used', async () => {
    const brain = new Brainy({ storage: { type: 'memory' } })
    try {
      await brain.init()

      // Add regular entities, don't use VFS
      await brain.add({ data: 'test', type: 'concept' })
      expect((await brain.find({ type: 'concept' })).length).toBe(1)

      // Clear should not throw even if VFS was never accessed
      await expect(brain.clear()).resolves.not.toThrow()

      // Entities should be cleared
      expect((await brain.find({ type: 'concept' })).length).toBe(0)

      // VFS should work after clear even though it wasn't used before
      await brain.vfs.writeFile('/new.txt', Buffer.from('content'))
      const content = await brain.vfs.readFile('/new.txt')
      expect(content.toString()).toBe('content')
    } finally {
      await cleanup(brain)
    }
  })

  it('should reinitialize VFS root entity after clear', async () => {
    const brain = new Brainy({ storage: { type: 'memory' } })
    try {
      await brain.init()

      // Create directory structure
      await brain.vfs.mkdir('/projects', { recursive: true })
      await brain.vfs.writeFile('/projects/index.js', Buffer.from('console.log("hi")'))

      // Verify VFS root exists
      const rootBefore = await brain.vfs.stat('/')
      expect(rootBefore.isDirectory()).toBe(true)

      // Verify directory structure exists
      const dirBefore = await brain.vfs.stat('/projects')
      expect(dirBefore.isDirectory()).toBe(true)

      // Clear
      await brain.clear()

      // VFS root should be recreated
      const rootAfter = await brain.vfs.stat('/')
      expect(rootAfter.isDirectory()).toBe(true)

      // Old directory should not exist
      await expect(brain.vfs.stat('/projects')).rejects.toThrow()
    } finally {
      await cleanup(brain)
    }
  })

  it('should work across multiple clear() cycles', async () => {
    const brain = new Brainy({ storage: { type: 'memory' } })
    try {
      await brain.init()

      // Cycle 1
      await brain.vfs.writeFile('/cycle1.txt', Buffer.from('cycle1'))
      expect((await brain.vfs.readFile('/cycle1.txt')).toString()).toBe('cycle1')
      await brain.clear()

      // Cycle 2
      await brain.vfs.writeFile('/cycle2.txt', Buffer.from('cycle2'))
      expect((await brain.vfs.readFile('/cycle2.txt')).toString()).toBe('cycle2')
      await expect(brain.vfs.readFile('/cycle1.txt')).rejects.toThrow()
      await brain.clear()

      // Cycle 3
      await brain.vfs.writeFile('/cycle3.txt', Buffer.from('cycle3'))
      expect((await brain.vfs.readFile('/cycle3.txt')).toString()).toBe('cycle3')
      await expect(brain.vfs.readFile('/cycle1.txt')).rejects.toThrow()
      await expect(brain.vfs.readFile('/cycle2.txt')).rejects.toThrow()
    } finally {
      await cleanup(brain)
    }
  })

  it('should preserve VFS functionality with nested directories after clear', async () => {
    const brain = new Brainy({ storage: { type: 'memory' } })
    try {
      await brain.init()

      // Create complex structure before clear
      await brain.vfs.mkdir('/a/b/c', { recursive: true })
      await brain.vfs.writeFile('/a/b/c/deep.txt', Buffer.from('deep content'))

      await brain.clear()

      // Create new complex structure after clear
      await brain.vfs.mkdir('/x/y/z', { recursive: true })
      await brain.vfs.writeFile('/x/y/z/new-deep.txt', Buffer.from('new deep content'))
      const content = await brain.vfs.readFile('/x/y/z/new-deep.txt')
      expect(content.toString()).toBe('new deep content')

      // Old structure should not exist
      await expect(brain.vfs.stat('/a')).rejects.toThrow()
    } finally {
      await cleanup(brain)
    }
  })

  it('should work with concurrent VFS and regular entity operations after clear', async () => {
    const brain = new Brainy({ storage: { type: 'memory' } })
    try {
      await brain.init()

      // Mix VFS and regular entities before clear
      await brain.vfs.writeFile('/config.json', Buffer.from('{"version": 1}'))
      await brain.add({ data: 'user data', type: 'person' })

      await brain.clear()

      // Both should work after clear
      await brain.vfs.writeFile('/config.json', Buffer.from('{"version": 2}'))
      await brain.add({ data: 'new user data', type: 'person' })

      const vfsContent = await brain.vfs.readFile('/config.json')
      expect(vfsContent.toString()).toBe('{"version": 2}')

      const entities = await brain.find({ type: 'person' })
      expect(entities.length).toBe(1)
    } finally {
      await cleanup(brain)
    }
  })
})
