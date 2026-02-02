/**
 * VFS Initialization Tests
 *
 * Tests v5.1.0+ auto-initialization behavior
 */

import { describe, it, expect } from 'vitest'
import { VirtualFileSystem } from '../../src/vfs/index.js'
import { Brainy } from '../../src/brainy.js'

describe('VFS Initialization', () => {

  describe('Auto-Initialization (v5.1.0+)', () => {
    it('should auto-initialize VFS during brain.init()', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })
      await brain.init()

      const vfs = brain.vfs

      // VFS is ready to use immediately after brain.init()
      await vfs.writeFile('/test.txt', 'Hello World')
      const content = await vfs.readFile('/test.txt')
      expect(content.toString()).toBe('Hello World')

      await brain.close()
    })

    it('should automatically create root directory on brain.init()', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })
      await brain.init()

      const vfs = brain.vfs

      // Root directory exists after brain.init()
      expect(await vfs.exists('/')).toBe(true)

      // Root is a directory
      const stats = await vfs.stat('/')
      expect(stats.isDirectory()).toBe(true)

      // Can list root directory
      const entries = await vfs.readdir('/')
      expect(Array.isArray(entries)).toBe(true)

      await brain.close()
    })

    it('should handle nested directories after brain.init()', async () => {
      const brain = new Brainy({
        storage: { type: 'memory' },
        silent: true
      })
      await brain.init()

      const vfs = brain.vfs

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

      await brain.close()
    })

  })
})
