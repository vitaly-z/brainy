/**
 * VFS File Versioning Integration Tests (v6.3.2)
 *
 * Tests the fix for the VFS versioning bug where file content was stale.
 *
 * Bug: VFS files store content in BlobStorage, but versioning captured stale
 * embedding text from entity.data instead of actual file content.
 *
 * Fix: VersionManager.save() now reads fresh content from BlobStorage for VFS files,
 * and restore() writes content back to BlobStorage.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'

describe('VFS File Versioning (v6.3.2 Fix)', () => {
  const testDir = path.join(process.cwd(), 'test-vfs-versioning-fix')
  let brain: Brainy

  beforeAll(async () => {
    // Clean up from any previous run
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        options: { path: testDir }
      },
      silent: true
    })
    await brain.init()
  })

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Core VFS Versioning', () => {
    it('should version actual file content, not stale embedding text', async () => {
      // Create a text file
      await brain.vfs.writeFile('/test/file.md', 'Initial content - version 1')

      // Get the file entity
      const stat = await brain.vfs.stat('/test/file.md')
      const entityId = stat.entityId

      // Save version 1
      await brain.versions.save(entityId, { description: 'Version 1' })

      // Modify the file with different content
      await brain.vfs.writeFile('/test/file.md', 'Modified content - version 2 with more text')

      // Save version 2
      await brain.versions.save(entityId, { description: 'Version 2' })

      // Retrieve both versions
      const v1Content = await brain.versions.getContent(entityId, 1)
      const v2Content = await brain.versions.getContent(entityId, 2)

      // CRITICAL TEST: The data should be DIFFERENT between versions
      // This was the bug - both had the same stale content
      expect(v1Content.data).not.toBe(v2Content.data)

      // Verify actual content
      expect(v1Content.data).toBe('Initial content - version 1')
      expect(v2Content.data).toBe('Modified content - version 2 with more text')
    })

    it('should restore VFS file content correctly', async () => {
      // Create initial file
      await brain.vfs.writeFile('/docs/readme.md', 'README version 1')

      const stat = await brain.vfs.stat('/docs/readme.md')
      const entityId = stat.entityId

      // Save version 1
      await brain.versions.save(entityId, { tag: 'v1' })

      // Modify file
      await brain.vfs.writeFile('/docs/readme.md', 'README version 2 - updated')

      // Save version 2
      await brain.versions.save(entityId, { tag: 'v2' })

      // Verify current content is v2
      let currentContent = await brain.vfs.readFile('/docs/readme.md')
      expect(currentContent.toString()).toBe('README version 2 - updated')

      // Restore to v1
      await brain.versions.restore(entityId, 1)

      // Verify content is now v1
      currentContent = await brain.vfs.readFile('/docs/readme.md')
      expect(currentContent.toString()).toBe('README version 1')
    })

    it('should handle multiple file edits and versions', async () => {
      await brain.vfs.writeFile('/project/config.json', '{"version": 1}')
      const stat = await brain.vfs.stat('/project/config.json')
      const entityId = stat.entityId

      // Create 5 versions
      for (let i = 1; i <= 5; i++) {
        await brain.vfs.writeFile('/project/config.json', `{"version": ${i}}`)
        await brain.versions.save(entityId, { tag: `v${i}` })
      }

      // Verify all 5 versions exist
      const versions = await brain.versions.list(entityId)
      expect(versions).toHaveLength(5)

      // Verify each version has correct content
      for (let i = 1; i <= 5; i++) {
        const content = await brain.versions.getContent(entityId, i)
        expect(content.data).toBe(`{"version": ${i}}`)
      }
    })

    it('should restore to any version in history', async () => {
      await brain.vfs.writeFile('/notes/todo.txt', 'Task 1')
      const stat = await brain.vfs.stat('/notes/todo.txt')
      const entityId = stat.entityId

      await brain.versions.save(entityId, { tag: 'initial' })

      await brain.vfs.writeFile('/notes/todo.txt', 'Task 1\nTask 2')
      await brain.versions.save(entityId, { tag: 'two-tasks' })

      await brain.vfs.writeFile('/notes/todo.txt', 'Task 1\nTask 2\nTask 3')
      await brain.versions.save(entityId, { tag: 'three-tasks' })

      // Restore to middle version
      await brain.versions.restore(entityId, 'two-tasks')
      let content = await brain.vfs.readFile('/notes/todo.txt')
      expect(content.toString()).toBe('Task 1\nTask 2')

      // Restore to initial version
      await brain.versions.restore(entityId, 'initial')
      content = await brain.vfs.readFile('/notes/todo.txt')
      expect(content.toString()).toBe('Task 1')

      // Restore to latest version
      await brain.versions.restore(entityId, 3)
      content = await brain.vfs.readFile('/notes/todo.txt')
      expect(content.toString()).toBe('Task 1\nTask 2\nTask 3')
    })
  })

  describe('Binary File Versioning', () => {
    it('should version binary files with base64 encoding', async () => {
      // Create a simple binary file (simulated image header)
      const binaryContent1 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01])
      const binaryContent2 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x02])

      await brain.vfs.writeFile('/images/test.png', binaryContent1)
      const stat = await brain.vfs.stat('/images/test.png')
      const entityId = stat.entityId

      // Save version 1
      await brain.versions.save(entityId, { tag: 'v1' })

      // Modify binary content
      await brain.vfs.writeFile('/images/test.png', binaryContent2)

      // Save version 2
      await brain.versions.save(entityId, { tag: 'v2' })

      // Retrieve and verify both versions are different
      const v1Content = await brain.versions.getContent(entityId, 1)
      const v2Content = await brain.versions.getContent(entityId, 2)

      expect(v1Content.data).not.toBe(v2Content.data)

      // Verify binary content can be restored
      await brain.versions.restore(entityId, 1)
      const restored = await brain.vfs.readFile('/images/test.png')
      expect(Buffer.compare(restored, binaryContent1)).toBe(0)
    })
  })

  describe('Version Deduplication', () => {
    it('should deduplicate identical VFS file content', async () => {
      await brain.vfs.writeFile('/cache/data.txt', 'Cached data')
      const stat = await brain.vfs.stat('/cache/data.txt')
      const entityId = stat.entityId

      // Save version 1
      const v1 = await brain.versions.save(entityId, { tag: 'v1' })

      // Save again without changes - should dedupe
      const v2 = await brain.versions.save(entityId, { tag: 'v2' })

      // Should return same version (content hash match)
      expect(v2.version).toBe(v1.version)
      expect(v2.contentHash).toBe(v1.contentHash)

      // Only 1 version should exist
      const versions = await brain.versions.list(entityId)
      expect(versions).toHaveLength(1)
    })
  })

  describe('Mixed Entity Versioning', () => {
    it('should handle VFS and non-VFS entities in same brain', async () => {
      // Create a VFS file
      await brain.vfs.writeFile('/files/doc.txt', 'File content v1')
      const fileStat = await brain.vfs.stat('/files/doc.txt')
      const fileId = fileStat.entityId

      // Create a regular entity
      const regularId = await brain.add({
        data: 'Regular entity',
        type: 'document',
        metadata: { title: 'Regular Doc' }
      })

      // Version both
      await brain.versions.save(fileId, { tag: 'file-v1' })
      await brain.versions.save(regularId, { tag: 'regular-v1' })

      // Update both
      await brain.vfs.writeFile('/files/doc.txt', 'File content v2')
      await brain.update({ id: regularId, metadata: { title: 'Updated Regular Doc' } })

      // Version both again
      await brain.versions.save(fileId, { tag: 'file-v2' })
      await brain.versions.save(regularId, { tag: 'regular-v2' })

      // Verify VFS file versions have different content
      const fileV1 = await brain.versions.getContent(fileId, 1)
      const fileV2 = await brain.versions.getContent(fileId, 2)
      expect(fileV1.data).toBe('File content v1')
      expect(fileV2.data).toBe('File content v2')

      // Verify regular entity versions work too
      const regV1 = await brain.versions.getContent(regularId, 1)
      const regV2 = await brain.versions.getContent(regularId, 2)
      expect(regV1.title).toBe('Regular Doc')
      expect(regV2.title).toBe('Updated Regular Doc')
    })
  })

  describe('Edge Cases', () => {
    it('should handle minimal content files', async () => {
      // VFS requires non-empty data for embedding, so we use minimal content
      await brain.vfs.writeFile('/minimal/file.txt', ' ')  // Single space
      const stat = await brain.vfs.stat('/minimal/file.txt')
      const entityId = stat.entityId

      await brain.versions.save(entityId, { tag: 'minimal' })

      await brain.vfs.writeFile('/minimal/file.txt', 'Now has content')
      await brain.versions.save(entityId, { tag: 'filled' })

      // Restore to minimal
      await brain.versions.restore(entityId, 'minimal')
      const content = await brain.vfs.readFile('/minimal/file.txt')
      expect(content.toString()).toBe(' ')
    })

    it('should handle large text files', async () => {
      const largeContent1 = 'A'.repeat(100000) + ' version 1'
      const largeContent2 = 'B'.repeat(100000) + ' version 2'

      await brain.vfs.writeFile('/large/file.txt', largeContent1)
      const stat = await brain.vfs.stat('/large/file.txt')
      const entityId = stat.entityId

      await brain.versions.save(entityId, { tag: 'v1' })

      await brain.vfs.writeFile('/large/file.txt', largeContent2)
      await brain.versions.save(entityId, { tag: 'v2' })

      // Verify versions are different
      const v1 = await brain.versions.getContent(entityId, 1)
      const v2 = await brain.versions.getContent(entityId, 2)
      expect(v1.data).toBe(largeContent1)
      expect(v2.data).toBe(largeContent2)
    })

    it('should handle special characters in content', async () => {
      const specialContent = 'Unicode: \u{1F600} \u{1F914} \u{1F4A1}\nNewlines\nAnd\ttabs'

      await brain.vfs.writeFile('/special.txt', specialContent)
      const stat = await brain.vfs.stat('/special.txt')
      const entityId = stat.entityId

      await brain.versions.save(entityId, { tag: 'special' })

      await brain.vfs.writeFile('/special.txt', 'Plain text now')
      await brain.versions.save(entityId, { tag: 'plain' })

      // Restore special content
      await brain.versions.restore(entityId, 'special')
      const content = await brain.vfs.readFile('/special.txt')
      expect(content.toString()).toBe(specialContent)
    })
  })
})
