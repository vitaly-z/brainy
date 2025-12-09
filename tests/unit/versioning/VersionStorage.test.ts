/**
 * VersionStorage Unit Tests (v5.3.0)
 *
 * Tests content-addressable storage:
 * - SHA-256 content hashing
 * - Content deduplication
 * - Storage adapter integration
 * - Save/load/delete operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VersionStorage } from '../../../src/versioning/VersionStorage.js'
import type { NounMetadata } from '../../../src/coreTypes.js'
import type { EntityVersion } from '../../../src/versioning/VersionManager.js'

describe('VersionStorage', () => {
  let storage: VersionStorage
  let mockBrain: any
  let mockFiles: Map<string, string>

  beforeEach(() => {
    mockFiles = new Map()

    mockBrain = {
      storageAdapter: {
        // v6.3.0: VersionStorage now uses saveMetadata/getMetadata instead of writeFile/readFile
        saveMetadata: vi.fn(async (key: string, data: any) => {
          mockFiles.set(key, JSON.stringify(data))
        }),
        getMetadata: vi.fn(async (key: string) => {
          const data = mockFiles.get(key)
          if (!data) return null
          return JSON.parse(data)
        }),
        // Legacy methods for tests that still use them
        exists: vi.fn(async (path: string) => mockFiles.has(path)),
        writeFile: vi.fn(async (path: string, data: string) => {
          mockFiles.set(path, data)
        }),
        readFile: vi.fn(async (path: string) => {
          const data = mockFiles.get(path)
          if (!data) throw new Error('File not found')
          return data
        }),
        deleteFile: vi.fn(async (path: string) => {
          mockFiles.delete(path)
        })
      }
    }

    storage = new VersionStorage(mockBrain)
  })

  describe('hashEntity()', () => {
    it('should generate consistent SHA-256 hashes', () => {
      const entity: NounMetadata = {
        id: 'user-123',
        type: 'user',
        name: 'Alice',
        metadata: { email: 'alice@example.com' }
      }

      const hash1 = storage.hashEntity(entity)
      const hash2 = storage.hashEntity(entity)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)  // SHA-256 = 64 hex chars
    })

    it('should generate different hashes for different content', () => {
      const entity1: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: {}
      }

      const entity2: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Bob',
        metadata: {}
      }

      const hash1 = storage.hashEntity(entity1)
      const hash2 = storage.hashEntity(entity2)

      expect(hash1).not.toBe(hash2)
    })

    it('should ignore property order (stable JSON)', () => {
      const entity1: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: { a: 1, b: 2, c: 3 }
      }

      const entity2: NounMetadata = {
        type: 'user',
        metadata: { c: 3, b: 2, a: 1 },
        name: 'Alice',
        id: 'user-1'
      }

      const hash1 = storage.hashEntity(entity1)
      const hash2 = storage.hashEntity(entity2)

      expect(hash1).toBe(hash2)
    })

    it('should handle nested objects', () => {
      const entity: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {
          nested: {
            deep: {
              value: 'hello'
            }
          }
        }
      }

      const hash = storage.hashEntity(entity)
      expect(hash).toHaveLength(64)
    })

    it('should handle arrays', () => {
      const entity: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {
          tags: ['a', 'b', 'c']
        }
      }

      const hash = storage.hashEntity(entity)
      expect(hash).toHaveLength(64)
    })

    it('should handle null and undefined', () => {
      const entity1: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: { value: null }
      }

      const entity2: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: { value: undefined }
      }

      const hash1 = storage.hashEntity(entity1)
      const hash2 = storage.hashEntity(entity2)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('saveVersion()', () => {
    it('should save version content to storage', async () => {
      const entity: NounMetadata = {
        id: 'user-123',
        type: 'user',
        name: 'Alice',
        metadata: { email: 'alice@example.com' }
      }

      const version: EntityVersion = {
        version: 1,
        entityId: 'user-123',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: storage.hashEntity(entity)
      }

      await storage.saveVersion(version, entity)

      // v6.3.0: Uses __system_version_ prefix for saveMetadata keys
      const expectedKey = `__system_version_user-123_${version.contentHash}`
      expect(mockFiles.has(expectedKey)).toBe(true)

      const savedData = mockFiles.get(expectedKey)
      expect(savedData).toBeDefined()
      expect(JSON.parse(savedData!)).toEqual(entity)
    })

    it('should deduplicate identical content', async () => {
      const entity: NounMetadata = {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { content: 'Same content' }
      }

      const contentHash = storage.hashEntity(entity)

      const version1: EntityVersion = {
        version: 1,
        entityId: 'doc-1',
        branch: 'main',
        commitHash: 'commit-1',
        timestamp: Date.now(),
        contentHash
      }

      const version2: EntityVersion = {
        version: 2,
        entityId: 'doc-1',
        branch: 'main',
        commitHash: 'commit-2',
        timestamp: Date.now() + 1000,
        contentHash  // Same hash!
      }

      await storage.saveVersion(version1, entity)
      const writeCallCount1 = mockBrain.storageAdapter.writeFile.mock.calls.length

      await storage.saveVersion(version2, entity)
      const writeCallCount2 = mockBrain.storageAdapter.writeFile.mock.calls.length

      // Should not write again (deduplication)
      expect(writeCallCount2).toBe(writeCallCount1)
    })

    it('should store different content separately', async () => {
      const entity1: NounMetadata = {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { content: 'Version 1' }
      }

      const entity2: NounMetadata = {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { content: 'Version 2' }
      }

      const version1: EntityVersion = {
        version: 1,
        entityId: 'doc-1',
        branch: 'main',
        commitHash: 'commit-1',
        timestamp: Date.now(),
        contentHash: storage.hashEntity(entity1)
      }

      const version2: EntityVersion = {
        version: 2,
        entityId: 'doc-1',
        branch: 'main',
        commitHash: 'commit-2',
        timestamp: Date.now() + 1000,
        contentHash: storage.hashEntity(entity2)
      }

      await storage.saveVersion(version1, entity1)
      await storage.saveVersion(version2, entity2)

      // v6.3.0: Uses __system_version_ prefix for saveMetadata keys
      const key1 = `__system_version_doc-1_${version1.contentHash}`
      const key2 = `__system_version_doc-1_${version2.contentHash}`

      expect(mockFiles.has(key1)).toBe(true)
      expect(mockFiles.has(key2)).toBe(true)
      expect(key1).not.toBe(key2)
    })
  })

  describe('loadVersion()', () => {
    it('should load version content from storage', async () => {
      const entity: NounMetadata = {
        id: 'user-123',
        type: 'user',
        name: 'Alice',
        metadata: { email: 'alice@example.com' }
      }

      const version: EntityVersion = {
        version: 1,
        entityId: 'user-123',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: storage.hashEntity(entity)
      }

      // Save first
      await storage.saveVersion(version, entity)

      // Load
      const loaded = await storage.loadVersion(version)

      expect(loaded).toEqual(entity)
    })

    it('should return null if version not found', async () => {
      const version: EntityVersion = {
        version: 1,
        entityId: 'nonexistent',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: 'fake-hash'
      }

      const loaded = await storage.loadVersion(version)
      expect(loaded).toBeNull()
    })

    it('should handle complex nested data', async () => {
      const entity: NounMetadata = {
        id: 'complex-1',
        type: 'thing',
        name: 'Complex',
        metadata: {
          nested: {
            array: [1, 2, 3],
            object: { key: 'value' }
          },
          tags: ['a', 'b', 'c']
        }
      }

      const version: EntityVersion = {
        version: 1,
        entityId: 'complex-1',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: storage.hashEntity(entity)
      }

      await storage.saveVersion(version, entity)
      const loaded = await storage.loadVersion(version)

      expect(loaded).toEqual(entity)
    })
  })

  describe('deleteVersion()', () => {
    it('should handle version deletion (content-addressed, no-op)', async () => {
      // v6.3.0: Version content is content-addressed and may be shared by multiple versions.
      // The deleteVersion method is a no-op - it doesn't actually delete the content.
      // Version INDEX is deleted via VersionIndex.removeVersion().
      // A GC process could clean up unreferenced content in the future.

      const entity: NounMetadata = {
        id: 'user-123',
        type: 'user',
        name: 'Alice',
        metadata: {}
      }

      const version: EntityVersion = {
        version: 1,
        entityId: 'user-123',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: storage.hashEntity(entity)
      }

      // Save
      await storage.saveVersion(version, entity)
      const key = `__system_version_user-123_${version.contentHash}`
      expect(mockFiles.has(key)).toBe(true)

      // Delete is a no-op for content (content-addressed, may be shared)
      await storage.deleteVersion(version)
      // Content is NOT deleted to avoid breaking other versions with same content hash
      expect(mockFiles.has(key)).toBe(true)  // v6.3.0: Content preserved
    })

    it('should handle deleting non-existent version gracefully', async () => {
      const version: EntityVersion = {
        version: 1,
        entityId: 'nonexistent',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: 'fake-hash'
      }

      // Should not throw
      await storage.deleteVersion(version)
    })
  })

  describe('Storage Adapter Integration', () => {
    it('should work with memory storage adapter', async () => {
      const entity: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: { value: 123 }
      }

      const version: EntityVersion = {
        version: 1,
        entityId: 'test-1',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: storage.hashEntity(entity)
      }

      await storage.saveVersion(version, entity)
      const loaded = await storage.loadVersion(version)

      expect(loaded).toEqual(entity)
    })

    it('should use adapter.saveMetadata API', async () => {
      // v6.3.0: VersionStorage now uses saveMetadata/getMetadata exclusively
      const testStorage = new Map<string, string>()

      mockBrain.storageAdapter = {
        saveMetadata: vi.fn(async (key: string, data: any) => {
          testStorage.set(key, JSON.stringify(data))
        }),
        getMetadata: vi.fn(async (key: string) => {
          const data = testStorage.get(key)
          if (!data) return null
          return JSON.parse(data)
        })
      }

      storage = new VersionStorage(mockBrain)

      const entity: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {}
      }

      const version: EntityVersion = {
        version: 1,
        entityId: 'test-1',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: storage.hashEntity(entity)
      }

      await storage.saveVersion(version, entity)
      expect(mockBrain.storageAdapter.saveMetadata).toHaveBeenCalled()

      const loaded = await storage.loadVersion(version)
      expect(mockBrain.storageAdapter.getMetadata).toHaveBeenCalled()
      expect(loaded).toEqual(entity)
    })

    it('should throw if storage adapter missing', async () => {
      mockBrain.storageAdapter = null
      storage = new VersionStorage(mockBrain)

      const entity: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {}
      }

      const version: EntityVersion = {
        version: 1,
        entityId: 'test-1',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: storage.hashEntity(entity)
      }

      await expect(
        storage.saveVersion(version, entity)
      ).rejects.toThrow('Storage adapter not available')
    })

    it('should throw if adapter does not support required operations', async () => {
      mockBrain.storageAdapter = {}  // No methods (no saveMetadata)
      storage = new VersionStorage(mockBrain)

      const entity: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {}
      }

      const version: EntityVersion = {
        version: 1,
        entityId: 'test-1',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash: storage.hashEntity(entity)
      }

      // v6.3.0: Error from calling undefined saveMetadata
      await expect(
        storage.saveVersion(version, entity)
      ).rejects.toThrow()  // TypeError: adapter.saveMetadata is not a function
    })
  })

  describe('Key Generation', () => {
    it('should generate correct storage keys', async () => {
      const entity: NounMetadata = {
        id: 'user-123',
        type: 'user',
        name: 'Alice',
        metadata: {}
      }

      const contentHash = storage.hashEntity(entity)
      const version: EntityVersion = {
        version: 1,
        entityId: 'user-123',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash
      }

      await storage.saveVersion(version, entity)

      // v6.3.0: Uses __system_version_ prefix for saveMetadata keys
      const expectedKey = `__system_version_user-123_${contentHash}`
      expect(mockFiles.has(expectedKey)).toBe(true)
    })

    it('should handle entity IDs with special characters', async () => {
      const entity: NounMetadata = {
        id: 'user:123:profile',
        type: 'user',
        name: 'Alice',
        metadata: {}
      }

      const contentHash = storage.hashEntity(entity)
      const version: EntityVersion = {
        version: 1,
        entityId: 'user:123:profile',
        branch: 'main',
        commitHash: 'commit-123',
        timestamp: Date.now(),
        contentHash
      }

      await storage.saveVersion(version, entity)

      // v6.3.0: Uses __system_version_ prefix for saveMetadata keys
      const expectedKey = `__system_version_user:123:profile_${contentHash}`
      expect(mockFiles.has(expectedKey)).toBe(true)
    })
  })
})
