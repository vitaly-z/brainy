/**
 * VFS bulkWrite Race Condition Fix Tests (v6.5.0)
 *
 * Tests for the race condition where parallel mkdir and write operations
 * could create duplicate directory entities, causing files to become invisible.
 *
 * Bug: When mkdir and write for related paths are in the same parallel batch,
 * the mkdir mutex race window can create duplicate entities. Files created
 * with the "wrong" parent entity become invisible in tree traversal.
 *
 * Fix: Sort operations so mkdirs run first (sequentially, by depth), then
 * other operations in parallel batches.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { VirtualFileSystem } from '../../src/vfs/VirtualFileSystem.js'

describe('VFS bulkWrite Race Condition Fix', () => {
  let brain: Brainy
  let vfs: VirtualFileSystem

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' },
      embeddingModel: 'Q8'
    })
    await brain.init()
    vfs = brain.vfs
    await vfs.init()
  })

  describe('operation ordering', () => {
    it('should create directories before files when mixed in same batch', async () => {
      // This is the exact scenario that triggered the race condition:
      // mkdir and write for related paths in the same batch
      const result = await vfs.bulkWrite([
        { type: 'write', path: '/data/config.json', data: '{}' },
        { type: 'mkdir', path: '/data' },
        { type: 'write', path: '/data/users.json', data: '[]' },
        { type: 'mkdir', path: '/logs' },
        { type: 'write', path: '/logs/app.log', data: 'log entry' }
      ])

      expect(result.successful).toBe(5)
      expect(result.failed.length).toBe(0)

      // Verify all files are visible
      const dataFiles = await vfs.readdir('/data')
      expect(dataFiles).toContain('config.json')
      expect(dataFiles).toContain('users.json')

      const logFiles = await vfs.readdir('/logs')
      expect(logFiles).toContain('app.log')
    })

    it('should handle nested directory creation in correct order', async () => {
      const result = await vfs.bulkWrite([
        { type: 'write', path: '/a/b/c/file.txt', data: 'content' },
        { type: 'mkdir', path: '/a/b/c' },  // deepest
        { type: 'mkdir', path: '/a' },       // shallowest
        { type: 'mkdir', path: '/a/b' },     // middle
      ])

      expect(result.successful).toBe(4)

      // Verify tree structure is correct
      const rootDirs = await vfs.readdir('/')
      expect(rootDirs).toContain('a')

      const aContent = await vfs.readdir('/a')
      expect(aContent).toContain('b')

      const bContent = await vfs.readdir('/a/b')
      expect(bContent).toContain('c')

      const cContent = await vfs.readdir('/a/b/c')
      expect(cContent).toContain('file.txt')
    })

    it('should not create duplicate directory entities under concurrent load', async () => {
      // Simulate the exact race condition scenario with many operations
      const operations: Array<{
        type: 'write' | 'mkdir'
        path: string
        data?: string
        options?: { recursive?: boolean }
      }> = []

      // Mix mkdir and write operations that would trigger race condition
      // Using recursive: true makes mkdir idempotent (no error if exists)
      for (let i = 0; i < 20; i++) {
        operations.push({ type: 'mkdir', path: `/concurrent-test-${i % 5}`, options: { recursive: true } })
        operations.push({
          type: 'write',
          path: `/concurrent-test-${i % 5}/file${i}.txt`,
          data: `content ${i}`
        })
      }

      const result = await vfs.bulkWrite(operations)

      // All operations should succeed (mkdirs are idempotent with recursive: true)
      expect(result.failed.length).toBe(0)

      // Verify no duplicate directories
      const rootChildren = await vfs.getDirectChildren('/')
      const dirNames = rootChildren
        .filter(c => c.metadata.vfsType === 'directory')
        .map(c => c.metadata.name)

      // Each directory name should appear exactly once
      for (let i = 0; i < 5; i++) {
        const count = dirNames.filter(n => n === `concurrent-test-${i}`).length
        expect(count).toBe(1)
      }

      // Verify all files are visible in their directories
      for (let i = 0; i < 5; i++) {
        const files = await vfs.readdir(`/concurrent-test-${i}`)
        expect(files.length).toBe(4) // 4 files per directory (indices 0,5,10,15 for dir 0, etc.)
      }
    })

    it('should handle the Workshop template creation scenario', async () => {
      // Exact scenario from bug report: template creation with mixed ops
      const operations = [
        { type: 'mkdir' as const, path: '/project/src' },
        { type: 'mkdir' as const, path: '/project/src/components' },
        { type: 'write' as const, path: '/project/src/index.ts', data: '// index' },
        { type: 'write' as const, path: '/project/src/components/App.tsx', data: '// app' },
        { type: 'mkdir' as const, path: '/project/public' },
        { type: 'write' as const, path: '/project/public/index.html', data: '<html>' },
        { type: 'write' as const, path: '/project/package.json', data: '{}' },
        { type: 'write' as const, path: '/project/README.md', data: '# Project' },
        { type: 'mkdir' as const, path: '/project' },  // Parent after children - should work
        { type: 'write' as const, path: '/project/tsconfig.json', data: '{}' },
      ]

      const result = await vfs.bulkWrite(operations)

      expect(result.successful).toBe(10)
      expect(result.failed.length).toBe(0)

      // Verify tree structure via getTreeStructure (this was failing before fix)
      const tree = await vfs.getTreeStructure('/', { maxDepth: 4 })

      // Find project directory
      const projectDir = tree.children?.find(c => c.name === 'project')
      expect(projectDir).toBeDefined()
      expect(projectDir?.type).toBe('directory')

      // Verify all files are visible
      const projectFiles = await vfs.readdir('/project')
      expect(projectFiles).toContain('src')
      expect(projectFiles).toContain('public')
      expect(projectFiles).toContain('package.json')
      expect(projectFiles).toContain('README.md')
      expect(projectFiles).toContain('tsconfig.json')

      const srcFiles = await vfs.readdir('/project/src')
      expect(srcFiles).toContain('index.ts')
      expect(srcFiles).toContain('components')

      const componentFiles = await vfs.readdir('/project/src/components')
      expect(componentFiles).toContain('App.tsx')
    })
  })

  describe('edge cases', () => {
    it('should handle empty operations array', async () => {
      const result = await vfs.bulkWrite([])
      expect(result.successful).toBe(0)
      expect(result.failed.length).toBe(0)
    })

    it('should handle only mkdir operations', async () => {
      const result = await vfs.bulkWrite([
        { type: 'mkdir', path: '/only-dirs/a' },
        { type: 'mkdir', path: '/only-dirs/b' },
        { type: 'mkdir', path: '/only-dirs' }
      ])

      expect(result.successful).toBe(3)
      expect(await vfs.exists('/only-dirs/a')).toBe(true)
      expect(await vfs.exists('/only-dirs/b')).toBe(true)
    })

    it('should handle only write operations', async () => {
      // Pre-create directory
      await vfs.mkdir('/files-only', { recursive: true })

      const result = await vfs.bulkWrite([
        { type: 'write', path: '/files-only/a.txt', data: 'a' },
        { type: 'write', path: '/files-only/b.txt', data: 'b' },
        { type: 'write', path: '/files-only/c.txt', data: 'c' }
      ])

      expect(result.successful).toBe(3)
    })

    it('should handle mkdir for already existing directories gracefully', async () => {
      // Pre-create directory
      await vfs.mkdir('/existing', { recursive: true })

      const result = await vfs.bulkWrite([
        { type: 'mkdir', path: '/existing', options: { recursive: true } },
        { type: 'write', path: '/existing/new-file.txt', data: 'content' }
      ])

      // mkdir should succeed (no-op for existing dir with recursive: true)
      expect(result.successful).toBe(2)
      expect(await vfs.exists('/existing/new-file.txt')).toBe(true)
    })

    it('should handle delete operations after writes', async () => {
      // First create some files
      await vfs.mkdir('/temp', { recursive: true })
      await vfs.writeFile('/temp/to-delete.txt', 'delete me')
      await vfs.writeFile('/temp/to-keep.txt', 'keep me')

      const result = await vfs.bulkWrite([
        { type: 'write', path: '/temp/new-file.txt', data: 'new' },
        { type: 'delete', path: '/temp/to-delete.txt' }
      ])

      expect(result.successful).toBe(2)
      expect(await vfs.exists('/temp/new-file.txt')).toBe(true)
      expect(await vfs.exists('/temp/to-delete.txt')).toBe(false)
      expect(await vfs.exists('/temp/to-keep.txt')).toBe(true)
    })

    it('should handle update operations', async () => {
      await vfs.writeFile('/doc.txt', 'original content')

      const result = await vfs.bulkWrite([
        { type: 'update', path: '/doc.txt', options: { metadata: { custom: 'value' } } }
      ])

      expect(result.successful).toBe(1)

      const entity = await vfs.getEntity('/doc.txt')
      expect(entity.metadata.custom).toBe('value')
    })
  })

  describe('error handling', () => {
    it('should continue processing after mkdir failure', async () => {
      // Create a file where we'll try to mkdir
      await vfs.writeFile('/not-a-dir', 'content')

      const result = await vfs.bulkWrite([
        { type: 'mkdir', path: '/not-a-dir' },  // Will fail - file exists
        { type: 'mkdir', path: '/good-dir' },
        { type: 'write', path: '/good-dir/file.txt', data: 'content' }
      ])

      expect(result.successful).toBe(2)  // good-dir and file.txt
      expect(result.failed.length).toBe(1)  // not-a-dir
      expect(await vfs.exists('/good-dir/file.txt')).toBe(true)
    })

    it('should continue processing after write failure', async () => {
      const result = await vfs.bulkWrite([
        { type: 'mkdir', path: '/test-dir' },
        { type: 'write', path: '/test-dir/good.txt', data: 'content' },
        { type: 'delete', path: '/nonexistent/file.txt' }  // Will fail
      ])

      expect(result.successful).toBe(2)  // mkdir and write
      expect(result.failed.length).toBe(1)  // delete
      expect(await vfs.exists('/test-dir/good.txt')).toBe(true)
    })
  })
})
