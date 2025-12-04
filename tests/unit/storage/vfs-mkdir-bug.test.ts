/**
 * VFS mkdir() Bug Fix Test (v6.2.9)
 *
 * Tests for the bug where vfs.mkdir() caused previously created directories
 * to disappear from vfs.readdir('/').
 *
 * Root cause: The verbCountsByType optimization skipped verb types with count 0,
 * which could happen when statistics were stale after restart.
 *
 * Fix:
 * 1. Option A: Never skip a verb type that's explicitly requested in the filter
 * 2. Option B: Added fast path for sourceId + verbType combo (common VFS pattern)
 *
 * Bug Report: /home/dpsifr/Projects/workshop/docs/BRAINY_VFS_BUG_REPORT.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy, VerbType } from '../../../src/index.js'

describe('VFS mkdir() Bug Fix (v6.2.9)', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('mkdir() should not corrupt VFS index', () => {
    it('should show all directories after mkdir() is called', async () => {
      const vfs = brain.vfs
      await vfs.init()

      // Step 1: Create directory via writeFile (auto-creates parent directories)
      await vfs.writeFile('/Personas/user.md', 'content')
      console.log('Created /Personas/user.md')

      // Verify /Personas is visible
      const entries1 = await vfs.readdir('/', { withFileTypes: true })
      const names1 = entries1.map((e: any) => e.name)
      console.log('After writeFile - root entries:', names1)
      expect(names1).toContain('Personas')

      // Step 2: Create another directory via mkdir
      await vfs.mkdir('/apps/my-app', { recursive: true })
      console.log('Created /apps/my-app')

      // Step 3: Verify BOTH directories are visible (THIS IS THE BUG)
      const entries2 = await vfs.readdir('/', { withFileTypes: true })
      const names2 = entries2.map((e: any) => e.name)
      console.log('After mkdir - root entries:', names2)

      // This assertion failed before the fix
      expect(names2).toContain('Personas')
      expect(names2).toContain('apps')
      expect(names2.length).toBe(2)
    })

    it('should handle multiple nested directories', async () => {
      const vfs = brain.vfs
      await vfs.init()

      // Create multiple directories via different methods
      await vfs.writeFile('/docs/readme.md', 'readme')
      await vfs.mkdir('/config', { recursive: true })
      await vfs.writeFile('/data/users/user1.json', '{}')
      await vfs.mkdir('/logs/archive', { recursive: true })

      // Verify all root directories are visible
      const entries = await vfs.readdir('/', { withFileTypes: true })
      const names = entries.map((e: any) => e.name)
      console.log('All root entries:', names)

      expect(names).toContain('docs')
      expect(names).toContain('config')
      expect(names).toContain('data')
      expect(names).toContain('logs')
      expect(names.length).toBe(4)
    })
  })

  describe('getRelations should query Contains relationships correctly', () => {
    it('should find Contains relationships via sourceId + verbType filter', async () => {
      // Create some entities and relationships
      const parent = await brain.add({
        data: 'Parent entity',
        type: 'collection',
        metadata: { name: 'parent' }
      })

      const child1 = await brain.add({
        data: 'Child 1',
        type: 'document',
        metadata: { name: 'child1' }
      })

      const child2 = await brain.add({
        data: 'Child 2',
        type: 'document',
        metadata: { name: 'child2' }
      })

      // Create Contains relationships
      await brain.relate({ from: parent, to: child1, type: VerbType.Contains })
      await brain.relate({ from: parent, to: child2, type: VerbType.Contains })

      // Query relationships (this is what getChildren() does)
      const relations = await brain.getRelations({
        from: parent,
        type: VerbType.Contains
      })

      console.log('Relations found:', relations.length)
      expect(relations.length).toBe(2)
      expect(relations.map(r => r.to)).toContain(child1)
      expect(relations.map(r => r.to)).toContain(child2)
    })

    it('should return relationships even with mixed verb types', async () => {
      // Create entities
      const entityA = await brain.add({ data: 'Entity A', type: 'concept' })
      const entityB = await brain.add({ data: 'Entity B', type: 'concept' })
      const entityC = await brain.add({ data: 'Entity C', type: 'concept' })

      // Create different types of relationships
      await brain.relate({ from: entityA, to: entityB, type: VerbType.Contains })
      await brain.relate({ from: entityA, to: entityC, type: VerbType.RelatedTo })

      // Query only Contains relationships
      const containsRelations = await brain.getRelations({
        from: entityA,
        type: VerbType.Contains
      })

      expect(containsRelations.length).toBe(1)
      expect(containsRelations[0].to).toBe(entityB)

      // Query only RelatedTo relationships
      const relatedRelations = await brain.getRelations({
        from: entityA,
        type: VerbType.RelatedTo
      })

      expect(relatedRelations.length).toBe(1)
      expect(relatedRelations[0].to).toBe(entityC)
    })
  })

  describe('Fast path for sourceId + verbType filter', () => {
    it('should use fast path for VFS-style queries', async () => {
      // Create parent and children
      const parent = await brain.add({
        data: 'Parent',
        type: 'collection',
        metadata: { name: 'parent' }
      })

      // Create many children to verify performance
      const children: string[] = []
      for (let i = 0; i < 10; i++) {
        const child = await brain.add({
          data: `Child ${i}`,
          type: 'document',
          metadata: { name: `child${i}` }
        })
        children.push(child)
        await brain.relate({ from: parent, to: child, type: VerbType.Contains })
      }

      // Query should use the new fast path
      const startTime = performance.now()
      const relations = await brain.getRelations({
        from: parent,
        type: VerbType.Contains
      })
      const elapsed = performance.now() - startTime

      console.log(`Query returned ${relations.length} relations in ${elapsed.toFixed(2)}ms`)
      expect(relations.length).toBe(10)

      // Verify all children are found
      for (const child of children) {
        expect(relations.map(r => r.to)).toContain(child)
      }
    })
  })

  describe('Delete and recreate folder (v6.2.9 cache invalidation fix)', () => {
    it('should handle delete folder → recreate folder without corruption', async () => {
      const vfs = brain.vfs
      await vfs.init()

      // Step 1: Create a folder with content
      await vfs.mkdir('/test-folder', { recursive: true })
      await vfs.writeFile('/test-folder/file1.txt', 'content1')
      console.log('Created /test-folder with file1.txt')

      // Verify folder exists
      const entries1 = await vfs.readdir('/', { withFileTypes: true })
      expect(entries1.map((e: any) => e.name)).toContain('test-folder')

      // Step 2: Delete the folder
      await vfs.rmdir('/test-folder', { recursive: true })
      console.log('Deleted /test-folder')

      // Verify folder is gone
      const entries2 = await vfs.readdir('/', { withFileTypes: true })
      expect(entries2.map((e: any) => e.name)).not.toContain('test-folder')

      // Step 3: Recreate the folder (THIS IS WHERE THE BUG WAS)
      await vfs.mkdir('/test-folder', { recursive: true })
      console.log('Recreated /test-folder')

      // Step 4: Create new content
      await vfs.writeFile('/test-folder/file2.txt', 'content2')
      console.log('Created /test-folder/file2.txt')

      // Step 5: Verify everything works
      const entries3 = await vfs.readdir('/', { withFileTypes: true })
      expect(entries3.map((e: any) => e.name)).toContain('test-folder')

      const folderContents = await vfs.readdir('/test-folder', { withFileTypes: true })
      expect(folderContents.map((e: any) => e.name)).toContain('file2.txt')
      console.log('Folder recreate test passed!')
    })

    it('should handle multiple delete/recreate cycles', async () => {
      const vfs = brain.vfs
      await vfs.init()

      for (let i = 0; i < 3; i++) {
        // Create
        await vfs.mkdir('/cycle-test', { recursive: true })
        await vfs.writeFile(`/cycle-test/file${i}.txt`, `content${i}`)

        // Verify
        const contents = await vfs.readdir('/cycle-test', { withFileTypes: true })
        expect(contents.length).toBe(1)
        expect(contents[0].name).toBe(`file${i}.txt`)

        // Delete
        await vfs.rmdir('/cycle-test', { recursive: true })

        console.log(`Cycle ${i + 1} completed`)
      }
    })
  })
})
