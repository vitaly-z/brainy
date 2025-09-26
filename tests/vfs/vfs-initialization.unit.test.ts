/**
 * VFS Initialization Tests
 *
 * Tests proper VFS initialization patterns to prevent common errors
 */

import { describe, it, expect } from 'vitest'
import { VirtualFileSystem } from '../../src/vfs/index.js'
import { Brainy } from '../../src/brainy.js'

describe('VFS Initialization', () => {

  describe('Common Initialization Errors', () => {
    it('should fail if VFS is not initialized before use', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })
      await brain.init()

      const vfs = brain.vfs()
      // Attempting to use VFS without calling init()

      await expect(vfs.writeFile('/test.txt', 'Hello'))
        .rejects.toThrow('VFS not initialized. Call init() first.')

      await expect(vfs.readdir('/'))
        .rejects.toThrow('VFS not initialized. Call init() first.')
    })
  })

  describe('Correct Initialization Pattern', () => {
    it('should work when VFS is properly initialized', async () => {
      // Step 1: Initialize Brainy
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })
      await brain.init()

      // Step 2: Get VFS instance
      const vfs = brain.vfs()

      // Step 3: Initialize VFS - this creates the root directory
      await vfs.init()

      // Now VFS operations work correctly
      await vfs.writeFile('/test.txt', 'Hello World')
      await vfs.writeFile('/data.json', '{"key": "value"}')

      // Root directory can be listed
      const entries = await vfs.readdir('/')
      expect(entries).toContain('test.txt')
      expect(entries).toContain('data.json')

      // Root directory stats are available
      const stats = await vfs.stat('/')
      expect(stats.isDirectory()).toBe(true)

      // Cleanup
      await vfs.close()
      await brain.close()
    })

    it('should automatically create root directory on init', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })
      await brain.init()

      const vfs = brain.vfs()

      // Before init, operations fail
      await expect(vfs.exists('/'))
        .rejects.toThrow('VFS not initialized')

      // After init, root exists
      await vfs.init()
      expect(await vfs.exists('/')).toBe(true)

      // Root is a directory
      const stats = await vfs.stat('/')
      expect(stats.isDirectory()).toBe(true)

      // Can list empty root
      const entries = await vfs.readdir('/')
      expect(Array.isArray(entries)).toBe(true)
      expect(entries).toEqual([])

      await vfs.close()
      await brain.close()
    })

    it('should handle nested directories after initialization', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })
      await brain.init()

      const vfs = brain.vfs()
      await vfs.init()

      // Create nested structure
      await vfs.mkdir('/documents')
      await vfs.writeFile('/documents/readme.txt', 'Important info')
      await vfs.mkdir('/documents/reports')
      await vfs.writeFile('/documents/reports/q1.txt', 'Q1 Report')

      // Verify structure
      const rootEntries = await vfs.readdir('/')
      expect(rootEntries).toContain('documents')

      const docEntries = await vfs.readdir('/documents')
      expect(docEntries).toContain('readme.txt')
      expect(docEntries).toContain('reports')

      const reportEntries = await vfs.readdir('/documents/reports')
      expect(reportEntries).toContain('q1.txt')

      await vfs.close()
      await brain.close()
    })
  })
})