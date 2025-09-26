/**
 * VFS Tree Operations Tests
 * Ensures tree methods prevent recursion and work correctly
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { VirtualFileSystem } from '../../src/vfs/VirtualFileSystem.js'
import { VFSTreeUtils } from '../../src/vfs/TreeUtils.js'

describe('VFS Tree Operations', () => {
  let brain: Brainy
  let vfs: VirtualFileSystem

  beforeEach(async () => {
    brain = new Brainy()
    await brain.init({
      storage: {
        type: 'memory'  // Use in-memory storage for tests
      }
    })

    vfs = new VirtualFileSystem(brain)
    await vfs.init()
  })

  describe('Critical: No Self-Inclusion Bug', () => {
    it('should NEVER return a directory as its own child', async () => {
      // Create test structure
      await vfs.mkdir('/test-dir')
      await vfs.writeFile('/test-dir/file1.txt', 'content1')
      await vfs.writeFile('/test-dir/file2.txt', 'content2')
      await vfs.mkdir('/test-dir/subdir')

      // Test getDirectChildren - should NOT include /test-dir itself
      const children = await vfs.getDirectChildren('/test-dir')

      // Critical assertion - directory should NOT be in its own children
      const selfIncluded = children.some(child => child.metadata.path === '/test-dir')
      expect(selfIncluded).toBe(false)

      // Should have exactly 3 children
      expect(children.length).toBe(3)
      expect(children.map(c => c.metadata.name).sort()).toEqual(['file1.txt', 'file2.txt', 'subdir'])
    })

    it('should handle root directory correctly', async () => {
      await vfs.mkdir('/dir1')
      await vfs.mkdir('/dir2')

      const rootChildren = await vfs.getDirectChildren('/')

      // Root should not be in its own children
      const rootInChildren = rootChildren.some(child => child.metadata.path === '/')
      expect(rootInChildren).toBe(false)

      expect(rootChildren.length).toBe(2)
    })

    it('should prevent recursion in tree structure', async () => {
      // Create deeper structure
      await vfs.mkdir('/a')
      await vfs.mkdir('/a/b')
      await vfs.mkdir('/a/b/c')
      await vfs.writeFile('/a/b/c/file.txt', 'deep')

      const tree = await vfs.getTreeStructure('/a')

      // Validate no cycles
      const validation = VFSTreeUtils.validateTree(tree)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      // Check tree structure
      expect(tree.path).toBe('/a')
      expect(tree.children).toBeDefined()
      expect(tree.children!.length).toBe(1) // Only 'b'
      expect(tree.children![0].name).toBe('b')
      expect(tree.children![0].children!.length).toBe(1) // Only 'c'
      expect(tree.children![0].children![0].name).toBe('c')
    })
  })

  describe('getDirectChildren', () => {
    it('should return only immediate children', async () => {
      await vfs.mkdir('/parent')
      await vfs.mkdir('/parent/child1')
      await vfs.mkdir('/parent/child2')
      await vfs.mkdir('/parent/child1/grandchild')
      await vfs.writeFile('/parent/file.txt', 'test')

      const children = await vfs.getDirectChildren('/parent')

      expect(children.length).toBe(3) // child1, child2, file.txt
      expect(children.map(c => c.metadata.name).sort()).toEqual(['child1', 'child2', 'file.txt'])

      // Should NOT include grandchild
      const hasGrandchild = children.some(c => c.metadata.name === 'grandchild')
      expect(hasGrandchild).toBe(false)
    })

    it('should throw error for non-directory', async () => {
      await vfs.writeFile('/file.txt', 'content')

      await expect(vfs.getDirectChildren('/file.txt')).rejects.toThrow('Not a directory')
    })
  })

  describe('getTreeStructure', () => {
    it('should build correct tree with depth limit', async () => {
      // Create multi-level structure
      await vfs.mkdir('/root')
      await vfs.mkdir('/root/level1')
      await vfs.mkdir('/root/level1/level2')
      await vfs.mkdir('/root/level1/level2/level3')
      await vfs.writeFile('/root/level1/level2/level3/deep.txt', 'very deep')

      const tree = await vfs.getTreeStructure('/root', { maxDepth: 2 })

      expect(tree.children).toBeDefined()
      expect(tree.children![0].name).toBe('level1')
      expect(tree.children![0].children![0].name).toBe('level2')
      // Level 3 should be cut off due to maxDepth
      expect(tree.children![0].children![0].children).toBeUndefined()
    })

    it('should sort tree nodes correctly', async () => {
      await vfs.mkdir('/sorted')
      await vfs.writeFile('/sorted/zebra.txt', 'z')
      await vfs.writeFile('/sorted/apple.txt', 'a')
      await vfs.mkdir('/sorted/banana')
      await vfs.mkdir('/sorted/cherry')

      const tree = await vfs.getTreeStructure('/sorted', { sort: 'name' })

      // Directories should come first, then files, both sorted by name
      const names = tree.children!.map(c => c.name)
      expect(names).toEqual(['banana', 'cherry', 'apple.txt', 'zebra.txt'])
    })

    it('should filter hidden files', async () => {
      await vfs.mkdir('/hidden-test')
      await vfs.writeFile('/hidden-test/.hidden', 'secret')
      await vfs.writeFile('/hidden-test/visible.txt', 'public')
      await vfs.mkdir('/hidden-test/.secret-dir')

      const tree = await vfs.getTreeStructure('/hidden-test', { includeHidden: false })

      expect(tree.children!.length).toBe(1)
      expect(tree.children![0].name).toBe('visible.txt')
    })
  })

  describe('getDescendants', () => {
    it('should return all descendants flat', async () => {
      await vfs.mkdir('/desc')
      await vfs.mkdir('/desc/a')
      await vfs.mkdir('/desc/a/b')
      await vfs.writeFile('/desc/a/b/file.txt', 'deep')
      await vfs.writeFile('/desc/file1.txt', 'top')

      const descendants = await vfs.getDescendants('/desc')

      expect(descendants.length).toBe(4) // a, a/b, a/b/file.txt, file1.txt

      // Should NOT include /desc itself by default
      const hasSelf = descendants.some(d => d.metadata.path === '/desc')
      expect(hasSelf).toBe(false)
    })

    it('should include ancestor when requested', async () => {
      await vfs.mkdir('/ancestor')
      await vfs.mkdir('/ancestor/child')

      const withAncestor = await vfs.getDescendants('/ancestor', { includeAncestor: true })
      const withoutAncestor = await vfs.getDescendants('/ancestor', { includeAncestor: false })

      expect(withAncestor.length).toBe(2) // ancestor + child
      expect(withoutAncestor.length).toBe(1) // only child
    })

    it('should filter by type', async () => {
      await vfs.mkdir('/typed')
      await vfs.mkdir('/typed/dir1')
      await vfs.mkdir('/typed/dir2')
      await vfs.writeFile('/typed/file1.txt', 'f1')
      await vfs.writeFile('/typed/file2.txt', 'f2')

      const dirsOnly = await vfs.getDescendants('/typed', { type: 'directory' })
      const filesOnly = await vfs.getDescendants('/typed', { type: 'file' })

      expect(dirsOnly.length).toBe(2)
      expect(filesOnly.length).toBe(2)
      expect(dirsOnly.every(d => d.metadata.vfsType === 'directory')).toBe(true)
      expect(filesOnly.every(f => f.metadata.vfsType === 'file')).toBe(true)
    })
  })

  describe('inspect', () => {
    it('should return comprehensive information', async () => {
      await vfs.mkdir('/inspect-test')
      await vfs.mkdir('/inspect-test/child1')
      await vfs.writeFile('/inspect-test/file.txt', 'content')

      const result = await vfs.inspect('/inspect-test/child1')

      expect(result.node.metadata.name).toBe('child1')
      expect(result.node.metadata.path).toBe('/inspect-test/child1')
      expect(result.children).toEqual([]) // Empty directory
      expect(result.parent).toBeDefined()
      expect(result.parent!.metadata.path).toBe('/inspect-test')
      expect(result.stats).toBeDefined()
      expect(result.stats.isDirectory()).toBe(true)
    })

    it('should handle root directory specially', async () => {
      await vfs.mkdir('/root-child')

      const result = await vfs.inspect('/')

      expect(result.node.metadata.path).toBe('/')
      expect(result.parent).toBeNull() // Root has no parent
      expect(result.children.length).toBeGreaterThan(0)
      expect(result.stats.isDirectory()).toBe(true)
    })
  })

  describe('VFSTreeUtils', () => {
    it('should validate tree structure correctly', async () => {
      // Create a valid tree
      await vfs.mkdir('/valid')
      await vfs.mkdir('/valid/sub1')
      await vfs.mkdir('/valid/sub2')

      const tree = await vfs.getTreeStructure('/valid')
      const validation = VFSTreeUtils.validateTree(tree)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect cycles in tree', () => {
      // Manually create an invalid tree with cycle
      const childNode: any = {
        name: 'child',
        path: '/root/child',
        type: 'directory' as const,
        children: []
      }

      const invalidTree = {
        name: 'root',
        path: '/root',
        type: 'directory' as const,
        children: [childNode]
      }

      // Create a cycle by adding the child back to itself
      childNode.children.push(childNode)  // Child contains itself = cycle

      const validation = VFSTreeUtils.validateTree(invalidTree)
      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      // The error could be either "Cycle detected" or "Directory contains itself"
      const hasExpectedError = validation.errors.some(e =>
        e.includes('Cycle detected') || e.includes('Directory contains itself')
      )
      expect(hasExpectedError).toBe(true)
    })

    it('should detect self-inclusion', () => {
      const badTree = {
        name: 'dir',
        path: '/dir',
        type: 'directory' as const,
        children: [{
          name: 'dir',
          path: '/dir', // Same as parent!
          type: 'directory' as const
        }]
      }

      const validation = VFSTreeUtils.validateTree(badTree)
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContainEqual('Directory contains itself: /dir')
    })

    it('should calculate tree statistics', async () => {
      await vfs.mkdir('/stats')
      await vfs.mkdir('/stats/dir1')
      await vfs.mkdir('/stats/dir2')
      await vfs.writeFile('/stats/file1.txt', 'a'.repeat(100))
      await vfs.writeFile('/stats/dir1/file2.txt', 'b'.repeat(200))

      const tree = await vfs.getTreeStructure('/stats')
      const stats = VFSTreeUtils.getTreeStats(tree)

      expect(stats.totalNodes).toBe(5) // /stats (root), dir1, dir2, file1, file2
      expect(stats.directories).toBe(3) // /stats, dir1, dir2
      expect(stats.files).toBe(2)
      expect(stats.maxDepth).toBe(2)
      expect(stats.totalSize).toBe(300)
    })
  })

  describe('Performance with large trees', () => {
    it('should handle large directory structures efficiently', async () => {
      // Create a reasonably large structure
      const dirs = 10
      const filesPerDir = 5

      await vfs.mkdir('/perf-test')

      for (let i = 0; i < dirs; i++) {
        await vfs.mkdir(`/perf-test/dir${i}`)
        for (let j = 0; j < filesPerDir; j++) {
          await vfs.writeFile(`/perf-test/dir${i}/file${j}.txt`, `content-${i}-${j}`)
        }
      }

      const startTime = Date.now()
      const tree = await vfs.getTreeStructure('/perf-test')
      const elapsed = Date.now() - startTime

      // Should complete reasonably fast (under 1 second for this size)
      expect(elapsed).toBeLessThan(1000)

      // Validate structure
      expect(tree.children!.length).toBe(dirs)
      expect(tree.children![0].children!.length).toBe(filesPerDir)

      // No cycles
      const validation = VFSTreeUtils.validateTree(tree)
      expect(validation.valid).toBe(true)
    })
  })
})