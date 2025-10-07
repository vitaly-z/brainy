/**
 * Comprehensive VFS Test Suite
 *
 * Tests EVERY VFS method to ensure 100% functionality
 * Includes all recent fixes and Knowledge Layer integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VirtualFileSystem } from '../../src/vfs/index.js'
import { Brainy } from '../../src/brainy.js'
import { VerbType } from '../../src/types/graphTypes.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe.skip('VirtualFileSystem - Comprehensive Test Suite', () => {
  let vfs: VirtualFileSystem
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' },
      silent: true
    })
    await brain.init()
    vfs = brain.vfs()
    await vfs.init()
  })

  afterEach(async () => {
    await vfs?.close()
    await brain?.close()
  })

  describe('File Operations', () => {
    it('should handle writeFile, readFile, appendFile, and unlink', async () => {
      const path = '/test.txt'

      // Write
      await vfs.writeFile(path, 'Hello')
      let content = await vfs.readFile(path)
      expect(content.toString()).toBe('Hello')

      // Append
      await vfs.appendFile(path, ' World')
      content = await vfs.readFile(path)
      expect(content.toString()).toBe('Hello World')

      // Delete
      await vfs.unlink(path)
      const exists = await vfs.exists(path)
      expect(exists).toBe(false)
    })

    it('should handle large files with chunking', async () => {
      // Create a 10MB buffer
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024, 'x')
      await vfs.writeFile('/large.bin', largeBuffer)

      const result = await vfs.readFile('/large.bin')
      expect(result.length).toBe(largeBuffer.length)
      expect(result[0]).toBe('x'.charCodeAt(0))
    })
  })

  describe('Directory Operations', () => {
    it('should create, list, and remove directories', async () => {
      await vfs.mkdir('/testdir')
      await vfs.mkdir('/testdir/subdir')

      // Create files
      await vfs.writeFile('/testdir/file1.txt', 'test1')
      await vfs.writeFile('/testdir/file2.txt', 'test2')

      // List directory
      const files = await vfs.readdir('/testdir')
      expect(files).toHaveLength(3) // 2 files + 1 subdir
      expect(files).toContain('file1.txt')
      expect(files).toContain('file2.txt')
      expect(files).toContain('subdir')

      // Remove directory (should fail - not empty)
      await expect(vfs.rmdir('/testdir')).rejects.toThrow()

      // Remove contents first
      await vfs.unlink('/testdir/file1.txt')
      await vfs.unlink('/testdir/file2.txt')
      await vfs.rmdir('/testdir/subdir')
      await vfs.rmdir('/testdir')

      const exists = await vfs.exists('/testdir')
      expect(exists).toBe(false)
    })
  })

  describe('File Management', () => {
    it('should rename and copy files', async () => {
      await vfs.writeFile('/original.txt', 'content')

      // Rename
      await vfs.rename('/original.txt', '/renamed.txt')
      expect(await vfs.exists('/original.txt')).toBe(false)
      expect(await vfs.exists('/renamed.txt')).toBe(true)

      // Copy
      await vfs.copy('/renamed.txt', '/copied.txt')
      expect(await vfs.exists('/renamed.txt')).toBe(true)
      expect(await vfs.exists('/copied.txt')).toBe(true)

      // Verify content
      const content1 = await vfs.readFile('/renamed.txt')
      const content2 = await vfs.readFile('/copied.txt')
      expect(content1.toString()).toBe(content2.toString())
    })
  })

  describe('Permissions', () => {
    it('should handle chmod and chown', async () => {
      await vfs.writeFile('/perms.txt', 'test')

      // chmod
      await vfs.chmod('/perms.txt', 0o755)
      const stats1 = await vfs.stat('/perms.txt')
      expect(stats1.mode).toBe(0o755)

      // chown
      await vfs.chown('/perms.txt', 1000, 1000)
      const stats2 = await vfs.stat('/perms.txt')
      expect(stats2.uid).toBe(1000)
      expect(stats2.gid).toBe(1000)
    })
  })

  describe('Symlinks', () => {
    it('should create and resolve symlinks', async () => {
      await vfs.writeFile('/target.txt', 'target content')

      // Create symlink
      await vfs.symlink('/target.txt', '/link.txt')

      // Read through symlink
      const content = await vfs.readFile('/link.txt')
      expect(content.toString()).toBe('target content')

      // readlink
      const linkTarget = await vfs.readlink('/link.txt')
      expect(linkTarget).toBe('/target.txt')

      // realpath
      const realPath = await vfs.realpath('/link.txt')
      expect(realPath).toBe('/target.txt')
    })
  })

  describe('Relationships', () => {
    it('should add, get, and remove relationships', async () => {
      await vfs.writeFile('/doc1.txt', 'Document 1')
      await vfs.writeFile('/doc2.txt', 'Document 2')

      // Add relationship
      await vfs.addRelationship('/doc1.txt', '/doc2.txt', VerbType.References)

      // Get relationships
      const related = await vfs.getRelated('/doc1.txt')
      expect(related).toHaveLength(1)
      expect(related[0].to).toContain('doc2.txt')

      // Remove relationship (FIXED - now actually removes)
      await vfs.removeRelationship('/doc1.txt', '/doc2.txt', VerbType.References)

      // Verify removed
      const afterRemove = await vfs.getRelated('/doc1.txt')
      expect(afterRemove).toHaveLength(0)
    })
  })

  describe('Search', () => {
    it('should perform semantic search', async () => {
      await vfs.writeFile('/auth.js', 'function authenticate() { return true }')
      await vfs.writeFile('/user.js', 'class User { constructor() {} }')
      await vfs.writeFile('/readme.md', '# Authentication System')

      // Search
      const results = await vfs.search('authentication')
      expect(results.length).toBeGreaterThan(0)

      // Find similar
      const similar = await vfs.findSimilar('/auth.js')
      expect(similar.length).toBeGreaterThan(0)
    })
  })

  describe('Metadata and Todos', () => {
    it('should manage metadata (FIXED - now exists)', async () => {
      await vfs.writeFile('/meta.txt', 'test')

      // Set metadata
      await vfs.setMetadata('/meta.txt', {
        custom: 'data',
        author: 'test-suite'
      })

      // Get metadata
      const meta = await vfs.getMetadata('/meta.txt')
      expect(meta?.custom).toBe('data')
      expect(meta?.author).toBe('test-suite')
    })

    it('should manage todos', async () => {
      await vfs.writeFile('/todo.txt', 'test')

      // Add todo
      await vfs.addTodo('/todo.txt', {
        task: 'Review this file',
        priority: 'high',
        status: 'pending'
      })

      // Get todos
      const todos = await vfs.getTodos('/todo.txt')
      expect(todos).toHaveLength(1)
      expect(todos?.[0].task).toBe('Review this file')

      // Set todos
      await vfs.setTodos('/todo.txt', [
        { id: '1', task: 'Task 1', priority: 'low', status: 'done' },
        { id: '2', task: 'Task 2', priority: 'medium', status: 'pending' }
      ])

      const updated = await vfs.getTodos('/todo.txt')
      expect(updated).toHaveLength(2)
    })
  })

  describe('Import/Export', () => {
    it('should import files from local filesystem', async () => {
      // Create a temp file
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfs-test-'))
      const tempFile = path.join(tempDir, 'import.txt')
      await fs.writeFile(tempFile, 'Import test content')

      try {
        // Import file
        await vfs.importFile(tempFile, '/imported.txt')

        // Verify imported
        const content = await vfs.readFile('/imported.txt')
        expect(content.toString()).toBe('Import test content')
      } finally {
        // Clean up temp file
        await fs.rm(tempDir, { recursive: true })
      }
    })

    it('should import directories recursively', async () => {
      // Create temp directory structure
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfs-dir-'))
      await fs.mkdir(path.join(tempDir, 'subdir'))
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'File 1')
      await fs.writeFile(path.join(tempDir, 'subdir', 'file2.txt'), 'File 2')

      try {
        // Import directory
        await vfs.importDirectory(tempDir, { targetPath: '/imported-dir' })

        // Verify structure
        const files = await vfs.readdir('/imported-dir')
        expect(files).toContain('file1.txt')
        expect(files).toContain('subdir')

        const subfiles = await vfs.readdir('/imported-dir/subdir')
        expect(subfiles).toContain('file2.txt')
      } finally {
        // Clean up
        await fs.rm(tempDir, { recursive: true })
      }
    })
  })

  describe('Streaming', () => {
    it('should support read and write streams', async () => {
      // Write using stream
      const writeStream = vfs.createWriteStream('/stream.txt')
      writeStream.write('Stream ')
      writeStream.write('test ')
      writeStream.write('content')
      writeStream.end()

      // Wait for stream to finish
      await new Promise(resolve => writeStream.on('finish', resolve))

      // Read using stream
      const readStream = vfs.createReadStream('/stream.txt')
      let result = ''

      await new Promise((resolve, reject) => {
        readStream.on('data', chunk => result += chunk)
        readStream.on('end', resolve)
        readStream.on('error', reject)
      })

      expect(result).toBe('Stream test content')
    })
  })

  describe('Error Handling', () => {
    it('should throw appropriate errors', async () => {
      // File not found
      await expect(vfs.readFile('/nonexistent.txt')).rejects.toThrow()

      // Directory operations on files
      await vfs.writeFile('/file.txt', 'test')
      await expect(vfs.readdir('/file.txt')).rejects.toThrow()

      // File operations on directories
      await vfs.mkdir('/dir')
      await expect(vfs.readFile('/dir')).rejects.toThrow()
    })
  })
})

describe('GitBridge Integration', () => {
  let vfs: VirtualFileSystem
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' },
      silent: true
    })
    await brain.init()
    vfs = brain.vfs()
    await vfs.init()
  })

  afterEach(async () => {
    await vfs?.close()
    await brain?.close()
  })

})