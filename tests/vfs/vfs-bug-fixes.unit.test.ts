/**
 * VFS Bug Fix Tests
 *
 * Tests for issues reported by Brain Studio team:
 * - Issue #1: Duplicate directory nodes
 * - Issue #2: File read decompression error
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { VirtualFileSystem } from '../../src/vfs/VirtualFileSystem.js'

describe('VFS Bug Fixes', () => {
  let brain: Brainy
  let vfs: VirtualFileSystem

  beforeEach(async () => {
    // Create fresh instance for each test
    brain = new Brainy({
      storage: { type: 'memory' },
      embeddingModel: 'Q8'
    })
    await brain.init()
    vfs = brain.vfs
    await vfs.init()
  })

  describe('Issue #1: Duplicate Directory Nodes', () => {
    it('should not create duplicate directory entries when writing multiple files to same directory', async () => {
      // Write multiple files to the same directory (reproduce the bug scenario)
      await vfs.writeFile('/src/index.ts', 'export const foo = 1')
      await vfs.writeFile('/src/types.ts', 'export type Foo = string')
      await vfs.writeFile('/src/utils.ts', 'export function bar() {}')
      await vfs.writeFile('/README.md', '# Project')

      // Verify files exist
      expect(await vfs.exists('/src/index.ts')).toBe(true)
      expect(await vfs.exists('/README.md')).toBe(true)

      // Get direct children of root
      const children = await vfs.getDirectChildren('/')

      // Debug: print what we got
      console.log('Root children:', children.map(c => ({name: c.metadata.name, type: c.metadata.vfsType})))

      // Count how many times 'src' appears
      const srcDirs = children.filter(child =>
        child.metadata.name === 'src' && child.metadata.vfsType === 'directory'
      )

      // Should only have ONE src directory
      expect(srcDirs.length).toBe(1)

      // Total children should be at least 2: src directory + README.md
      expect(children.length).toBeGreaterThanOrEqual(2)

      // Verify children have correct types
      const srcDir = children.find(c => c.metadata.name === 'src')
      const readme = children.find(c => c.metadata.name === 'README.md')

      expect(srcDir?.metadata.vfsType).toBe('directory')
      expect(readme?.metadata.vfsType).toBe('file')
    })

    it('should handle concurrent file writes without creating duplicates', async () => {
      // Write multiple files concurrently (more likely to trigger race conditions)
      await Promise.all([
        vfs.writeFile('/data/file1.json', '{"a": 1}'),
        vfs.writeFile('/data/file2.json', '{"b": 2}'),
        vfs.writeFile('/data/file3.json', '{"c": 3}'),
        vfs.writeFile('/data/file4.json', '{"d": 4}')
      ])

      const children = await vfs.getDirectChildren('/')
      const dataDirs = children.filter(c => c.metadata.name === 'data')

      // Should only have ONE data directory
      expect(dataDirs.length).toBe(1)

      // Check the data directory has exactly 4 files
      const dataChildren = await vfs.getDirectChildren('/data')
      expect(dataChildren.length).toBe(4)
    })
  })

  describe('Issue #2: File Read Decompression Error', () => {
    it('should read file content without decompression errors', async () => {
      const content = 'Hello World! This is test content.'

      // Write file
      await vfs.writeFile('/test.txt', content)

      // Read file - should NOT throw decompression error
      const readContent = await vfs.readFile('/test.txt')

      // Content should match
      expect(readContent.toString('utf8')).toBe(content)
    })

    it('should handle reading files with various sizes', async () => {
      const testFiles = [
        { path: '/small.txt', content: 'Small' },
        { path: '/medium.txt', content: 'x'.repeat(1000) },
        { path: '/large.txt', content: 'y'.repeat(50000) }
      ]

      // Write all files
      for (const file of testFiles) {
        await vfs.writeFile(file.path, file.content)
      }

      // Read all files - none should error
      for (const file of testFiles) {
        const readContent = await vfs.readFile(file.path)
        expect(readContent.toString('utf8')).toBe(file.content)
      }
    })

    it('should correctly handle file storage via BlobStorage (v5.2.0)', async () => {
      const content = 'Test content for BlobStorage'

      // Write file
      await vfs.writeFile('/test.md', content)

      // Get the entity to inspect storage
      const entity = await vfs.getEntity('/test.md')

      // v5.2.0: Content is in BlobStorage, not rawData
      expect(entity.metadata.storage).toBeDefined()
      expect(entity.metadata.storage.type).toBe('blob')
      expect(entity.metadata.size).toBe(content.length)

      // Read should work correctly (retrieves from BlobStorage)
      const readContent = await vfs.readFile('/test.md')
      expect(readContent.toString('utf8')).toBe(content)
    })

    it('should handle binary files correctly', async () => {
      // Create a binary buffer
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

      // Write binary file
      await vfs.writeFile('/image.png', binaryContent)

      // Read binary file
      const readContent = await vfs.readFile('/image.png')

      // Should match exactly
      expect(Buffer.compare(readContent, binaryContent)).toBe(0)
    })

    it('should handle reading after multiple writes', async () => {
      // Write file
      await vfs.writeFile('/counter.txt', '1')

      // Update file multiple times
      await vfs.writeFile('/counter.txt', '2')
      await vfs.writeFile('/counter.txt', '3')

      // Read should work
      const content = await vfs.readFile('/counter.txt')
      expect(content.toString('utf8')).toBe('3')
    })
  })

})
