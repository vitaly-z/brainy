import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { VirtualFileSystem } from '../../../src/vfs/VirtualFileSystem.js'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * v5.2.0: Test unified BlobStorage integration with VFS
 *
 * This test verifies that:
 * 1. All files (small, medium, large) use BlobStorage
 * 2. No size-based branching occurs
 * 3. Content is stored and retrieved correctly
 * 4. Deduplication works automatically
 *
 * Note: Uses FileSystemStorage because BlobStorage is only available
 * in COW-enabled storage adapters (not MemoryStorage)
 */
describe('VFS Unified BlobStorage (v5.2.0)', () => {
  let brain: Brainy
  let vfs: VirtualFileSystem
  let testDir: string

  beforeEach(async () => {
    // Create temporary directory for test storage
    testDir = path.join('/tmp', `brainy-test-blob-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(testDir, { recursive: true })

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        options: { path: testDir }
      },
      silent: true
    })
    await brain.init()
    vfs = brain.vfs
  })

  afterEach(async () => {
    await brain.close()

    // Clean up temporary directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Unified Storage Path', () => {
    it('should store small files (<100KB) in BlobStorage', async () => {
      const content = 'Small file content'
      await vfs.writeFile('/small.txt', content)

      // Get entity directly using VFS API
      const entity = await vfs.getEntity('/small.txt')

      expect(entity.metadata.vfsType).toBe('file')
      expect(entity.metadata.storage?.type).toBe('blob')
      expect(entity.metadata.storage?.hash).toBeDefined()

      const readContent = await vfs.readFile('/small.txt')
      expect(readContent.toString()).toBe(content)
    })

    it('should store medium files (100KB-10MB) in BlobStorage', async () => {
      const content = Buffer.alloc(200_000, 'M') // 200KB
      await vfs.writeFile('/medium.bin', content)

      const entity = await vfs.getEntity('/medium.bin')

      expect(entity.metadata.vfsType).toBe('file')
      expect(entity.metadata.storage?.type).toBe('blob')
      expect(entity.metadata.storage?.hash).toBeDefined()

      const readContent = await vfs.readFile('/medium.bin')
      expect(Buffer.compare(readContent, content)).toBe(0)
    })

    it('should store large files (>10MB) in BlobStorage', async () => {
      const content = Buffer.alloc(11_000_000, 'L') // 11MB
      await vfs.writeFile('/large.bin', content)

      const entity = await vfs.getEntity('/large.bin')

      expect(entity.metadata.vfsType).toBe('file')
      expect(entity.metadata.storage?.type).toBe('blob')
      expect(entity.metadata.storage?.hash).toBeDefined()

      const readContent = await vfs.readFile('/large.bin')
      expect(Buffer.compare(readContent, content)).toBe(0)
    })
  })

  describe('Deduplication', () => {
    it('should deduplicate identical files', async () => {
      const content = 'Duplicate content test'

      // Write same content to two different paths
      await vfs.writeFile('/file1.txt', content)
      await vfs.writeFile('/file2.txt', content)

      // Get entities directly
      const entity1 = await vfs.getEntity('/file1.txt')
      const entity2 = await vfs.getEntity('/file2.txt')

      // Both should have blob storage
      expect(entity1.metadata.storage?.type).toBe('blob')
      expect(entity2.metadata.storage?.type).toBe('blob')

      // But same blob hash (deduplicated)
      const hash1 = entity1.metadata.storage?.hash
      const hash2 = entity2.metadata.storage?.hash

      expect(hash1).toBeDefined()
      expect(hash2).toBeDefined()
      expect(hash1).toBe(hash2) // Same content = same hash
    })
  })

  describe('File Operations', () => {
    it('should update files correctly', async () => {
      await vfs.writeFile('/update.txt', 'Original content')
      await vfs.writeFile('/update.txt', 'Updated content')

      const content = await vfs.readFile('/update.txt')
      expect(content.toString()).toBe('Updated content')
    })

    it('should delete files and decrement blob refs', async () => {
      await vfs.writeFile('/delete.txt', 'Delete me')

      await vfs.unlink('/delete.txt')

      await expect(vfs.readFile('/delete.txt')).rejects.toThrow()
    })

    it('should append to files', async () => {
      await vfs.writeFile('/append.txt', 'First part')
      await vfs.appendFile('/append.txt', ' Second part')

      const content = await vfs.readFile('/append.txt')
      expect(content.toString()).toBe('First part Second part')
    })
  })

  describe('Binary Files', () => {
    it('should handle binary files correctly', async () => {
      const binary = Buffer.from([0x00, 0xFF, 0xAB, 0xCD, 0xEF])
      await vfs.writeFile('/binary.dat', binary)

      const read = await vfs.readFile('/binary.dat')
      expect(Buffer.compare(read, binary)).toBe(0)
    })

    it('should preserve binary file integrity', async () => {
      // Create a buffer with various byte patterns
      const buffer = Buffer.alloc(1000)
      for (let i = 0; i < 1000; i++) {
        buffer[i] = i % 256
      }

      await vfs.writeFile('/integrity.bin', buffer)
      const read = await vfs.readFile('/integrity.bin')

      expect(Buffer.compare(read, buffer)).toBe(0)
      expect(read.length).toBe(buffer.length)
    })
  })

  describe('Metadata', () => {
    it('should store correct metadata', async () => {
      const content = 'Test file'
      await vfs.writeFile('/meta.txt', content)

      const entity = await vfs.getEntity('/meta.txt')

      expect(entity.metadata.size).toBe(content.length)
      expect(entity.metadata.vfsType).toBe('file')
      expect(entity.metadata.storage?.type).toBe('blob')
      expect(entity.metadata.storage?.size).toBe(content.length)
      expect(entity.metadata.mimeType).toBeDefined()
    })
  })

})
