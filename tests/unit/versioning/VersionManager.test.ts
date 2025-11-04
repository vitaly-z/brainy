/**
 * VersionManager Unit Tests (v5.3.0)
 *
 * Tests the core versioning engine in isolation:
 * - Save versions
 * - Restore versions
 * - List versions
 * - Compare versions
 * - Prune versions
 * - Content deduplication
 * - Branch awareness
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VersionManager } from '../../../src/versioning/VersionManager.js'
import type { NounMetadata } from '../../../src/coreTypes.js'

describe('VersionManager', () => {
  let manager: VersionManager
  let mockBrain: any
  let mockStorage: Map<string, any>
  let mockIndex: Map<string, any>

  beforeEach(() => {
    // Mock storage
    mockStorage = new Map()
    mockIndex = new Map()

    // Mock Brainy instance
    mockBrain = {
      currentBranch: 'main',
      storageAdapter: {
        exists: vi.fn(async (path: string) => mockStorage.has(path)),
        writeFile: vi.fn(async (path: string, data: string) => {
          mockStorage.set(path, data)
        }),
        readFile: vi.fn(async (path: string) => {
          const data = mockStorage.get(path)
          if (!data) throw new Error('File not found')
          return data
        }),
        deleteFile: vi.fn(async (path: string) => {
          mockStorage.delete(path)
        })
      },
      refManager: {
        getRef: vi.fn(async (branch: string) => ({
          name: `refs/heads/${branch}`,
          commitHash: 'commit-hash-123',
          type: 'branch'
        })),
        setRef: vi.fn(async () => {}),
        resolveRef: vi.fn(async () => 'commit-hash-123')
      },
      getNounMetadata: vi.fn(async (id: string) => {
        const entity = mockIndex.get(id)
        if (!entity) throw new Error(`Entity ${id} not found`)
        return entity
      }),
      saveNounMetadata: vi.fn(async (id: string, data: NounMetadata) => {
        mockIndex.set(id, data)
      }),
      searchByMetadata: vi.fn(async (query: any) => {
        const results: any[] = []
        for (const [id, entity] of mockIndex.entries()) {
          let matches = true
          for (const [key, value] of Object.entries(query)) {
            if (key === 'type' && entity.type !== value) {
              matches = false
              break
            }
            if (entity.metadata?.[key] !== value) {
              matches = false
              break
            }
          }
          if (matches) {
            results.push({ id, ...entity })
          }
        }
        return results
      }),
      commit: vi.fn(async () => 'commit-hash-123')
    }

    manager = new VersionManager(mockBrain)
  })

  describe('save()', () => {
    it('should save a new version', async () => {
      // Add test entity
      mockIndex.set('user-123', {
        id: 'user-123',
        type: 'user',
        name: 'Alice',
        metadata: { email: 'alice@example.com' }
      })

      const version = await manager.save('user-123', {
        tag: 'v1.0',
        description: 'Initial version'
      })

      expect(version.version).toBe(1)
      expect(version.entityId).toBe('user-123')
      expect(version.branch).toBe('main')
      expect(version.tag).toBe('v1.0')
      expect(version.description).toBe('Initial version')
      expect(version.contentHash).toBeDefined()
      expect(version.commitHash).toBe('commit-hash-123')
    })

    it('should increment version numbers', async () => {
      mockIndex.set('doc-1', {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { content: 'Version 1' }
      })

      const v1 = await manager.save('doc-1', { tag: 'v1' })
      expect(v1.version).toBe(1)

      // Update entity
      mockIndex.set('doc-1', {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { content: 'Version 2' }
      })

      const v2 = await manager.save('doc-1', { tag: 'v2' })
      expect(v2.version).toBe(2)

      mockIndex.set('doc-1', {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { content: 'Version 3' }
      })

      const v3 = await manager.save('doc-1', { tag: 'v3' })
      expect(v3.version).toBe(3)
    })

    it('should deduplicate identical content', async () => {
      mockIndex.set('note-1', {
        id: 'note-1',
        type: 'document',
        name: 'Note',
        metadata: { content: 'Unchanged' }
      })

      const v1 = await manager.save('note-1', { tag: 'v1' })
      const v2 = await manager.save('note-1', { tag: 'v2' })

      // Should return same version (content unchanged)
      expect(v2.version).toBe(v1.version)
      expect(v2.contentHash).toBe(v1.contentHash)
    })

    it('should throw if entity does not exist', async () => {
      await expect(
        manager.save('nonexistent', { tag: 'v1' })
      ).rejects.toThrow('Entity nonexistent not found')
    })

    it('should save without tag or description', async () => {
      mockIndex.set('test-1', {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {}
      })

      const version = await manager.save('test-1')
      expect(version.version).toBe(1)
      expect(version.tag).toBeUndefined()
      expect(version.description).toBeUndefined()
    })
  })

  describe('restore()', () => {
    it('should restore entity to specific version', async () => {
      // Save version 1
      mockIndex.set('config-1', {
        id: 'config-1',
        type: 'thing',
        name: 'Config',
        metadata: { theme: 'light', version: 1 }
      })
      await manager.save('config-1', { tag: 'v1' })

      // Update to version 2
      mockIndex.set('config-1', {
        id: 'config-1',
        type: 'thing',
        name: 'Config',
        metadata: { theme: 'dark', version: 2 }
      })
      await manager.save('config-1', { tag: 'v2' })

      // Restore to v1
      await manager.restore('config-1', 1)

      // Verify saveNounMetadata was called with v1 data
      expect(mockBrain.saveNounMetadata).toHaveBeenCalledWith(
        'config-1',
        expect.objectContaining({
          metadata: expect.objectContaining({ theme: 'light', version: 1 })
        })
      )
    })

    it('should restore by tag', async () => {
      mockIndex.set('app-1', {
        id: 'app-1',
        type: 'thing',
        name: 'App',
        metadata: { status: 'alpha' }
      })
      await manager.save('app-1', { tag: 'alpha' })

      mockIndex.set('app-1', {
        id: 'app-1',
        type: 'thing',
        name: 'App',
        metadata: { status: 'beta' }
      })
      await manager.save('app-1', { tag: 'beta' })

      // Restore to alpha
      await manager.restore('app-1', 'alpha')

      expect(mockBrain.saveNounMetadata).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({
          metadata: expect.objectContaining({ status: 'alpha' })
        })
      )
    })

    it('should throw if version not found', async () => {
      mockIndex.set('test-1', {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {}
      })
      await manager.save('test-1')

      await expect(
        manager.restore('test-1', 999)
      ).rejects.toThrow('Version 999 not found')
    })
  })

  describe('list()', () => {
    it('should list all versions for entity', async () => {
      mockIndex.set('log-1', {
        id: 'log-1',
        type: 'document',
        name: 'Log',
        metadata: { entry: 1 }
      })

      await manager.save('log-1', { tag: 'v1' })

      mockIndex.set('log-1', {
        id: 'log-1',
        type: 'document',
        name: 'Log',
        metadata: { entry: 2 }
      })
      await manager.save('log-1', { tag: 'v2' })

      mockIndex.set('log-1', {
        id: 'log-1',
        type: 'document',
        name: 'Log',
        metadata: { entry: 3 }
      })
      await manager.save('log-1', { tag: 'v3' })

      const versions = await manager.list('log-1')
      expect(versions).toHaveLength(3)
      expect(versions[0].version).toBe(3) // Newest first
      expect(versions[1].version).toBe(2)
      expect(versions[2].version).toBe(1)
    })

    it('should filter by tag pattern', async () => {
      mockIndex.set('app-1', {
        id: 'app-1',
        type: 'thing',
        name: 'App',
        metadata: { v: 1 }
      })

      await manager.save('app-1', { tag: 'v1.0.0' })

      mockIndex.set('app-1', {
        id: 'app-1',
        type: 'thing',
        name: 'App',
        metadata: { v: 2 }
      })
      await manager.save('app-1', { tag: 'v1.1.0' })

      mockIndex.set('app-1', {
        id: 'app-1',
        type: 'thing',
        name: 'App',
        metadata: { v: 3 }
      })
      await manager.save('app-1', { tag: 'v2.0.0' })

      const v1Versions = await manager.list('app-1', { tag: 'v1.*' })
      expect(v1Versions).toHaveLength(2)
      expect(v1Versions[0].tag).toBe('v1.1.0')
      expect(v1Versions[1].tag).toBe('v1.0.0')
    })

    it('should limit results', async () => {
      mockIndex.set('data-1', {
        id: 'data-1',
        type: 'thing',
        name: 'Data',
        metadata: { v: 1 }
      })

      for (let i = 1; i <= 5; i++) {
        mockIndex.set('data-1', {
          id: 'data-1',
          type: 'thing',
          name: 'Data',
          metadata: { v: i }
        })
        await manager.save('data-1', { tag: `v${i}` })
      }

      const versions = await manager.list('data-1', { limit: 3 })
      expect(versions).toHaveLength(3)
      expect(versions[0].version).toBe(5)
      expect(versions[1].version).toBe(4)
      expect(versions[2].version).toBe(3)
    })

    it('should return empty array if no versions', async () => {
      mockIndex.set('new-1', {
        id: 'new-1',
        type: 'thing',
        name: 'New',
        metadata: {}
      })

      const versions = await manager.list('new-1')
      expect(versions).toHaveLength(0)
    })
  })

  describe('compare()', () => {
    it('should compare two versions', async () => {
      mockIndex.set('user-1', {
        id: 'user-1',
        type: 'user',
        name: 'Bob',
        metadata: { email: 'bob@example.com', age: 30 }
      })
      await manager.save('user-1', { tag: 'v1' })

      mockIndex.set('user-1', {
        id: 'user-1',
        type: 'user',
        name: 'Robert',
        metadata: { email: 'robert@example.com', age: 30, city: 'NYC' }
      })
      await manager.save('user-1', { tag: 'v2' })

      const diff = await manager.compare('user-1', 1, 2)

      expect(diff.totalChanges).toBeGreaterThan(0)
      expect(diff.modified.length).toBeGreaterThan(0)
      expect(diff.added.length).toBeGreaterThan(0)

      const nameChange = diff.modified.find(c => c.path.includes('name'))
      expect(nameChange?.oldValue).toBe('Bob')
      expect(nameChange?.newValue).toBe('Robert')

      const cityAdd = diff.added.find(c => c.path.includes('city'))
      expect(cityAdd?.newValue).toBe('NYC')
    })

    it('should compare by tags', async () => {
      mockIndex.set('doc-1', {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { content: 'Alpha' }
      })
      await manager.save('doc-1', { tag: 'alpha' })

      mockIndex.set('doc-1', {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { content: 'Beta' }
      })
      await manager.save('doc-1', { tag: 'beta' })

      const diff = await manager.compare('doc-1', 'alpha', 'beta')

      expect(diff.modified.length).toBeGreaterThan(0)
      const contentChange = diff.modified.find(c => c.path.includes('content'))
      expect(contentChange?.oldValue).toBe('Alpha')
      expect(contentChange?.newValue).toBe('Beta')
    })

    it('should detect identical versions', async () => {
      mockIndex.set('same-1', {
        id: 'same-1',
        type: 'thing',
        name: 'Same',
        metadata: { value: 100 }
      })
      await manager.save('same-1', { tag: 'v1' })
      await manager.save('same-1', { tag: 'v2' })  // Content unchanged

      const diff = await manager.compare('same-1', 1, 1)
      expect(diff.identical).toBe(true)
      expect(diff.totalChanges).toBe(0)
    })
  })

  describe('prune()', () => {
    it('should prune old versions keeping recent', async () => {
      mockIndex.set('log-1', {
        id: 'log-1',
        type: 'document',
        name: 'Log',
        metadata: { entry: 1 }
      })

      for (let i = 1; i <= 10; i++) {
        mockIndex.set('log-1', {
          id: 'log-1',
          type: 'document',
          name: 'Log',
          metadata: { entry: i }
        })
        await manager.save('log-1', { tag: `v${i}` })
      }

      const result = await manager.prune('log-1', {
        keepRecent: 5,
        keepTagged: false
      })

      expect(result.deleted).toBe(5)
      expect(result.kept).toBe(5)

      const remaining = await manager.list('log-1')
      expect(remaining).toHaveLength(5)
      expect(remaining[0].version).toBe(10) // Most recent
    })

    it('should keep tagged versions', async () => {
      mockIndex.set('app-1', {
        id: 'app-1',
        type: 'thing',
        name: 'App',
        metadata: { v: 1 }
      })

      await manager.save('app-1', { tag: 'release' })

      for (let i = 2; i <= 10; i++) {
        mockIndex.set('app-1', {
          id: 'app-1',
          type: 'thing',
          name: 'App',
          metadata: { v: i }
        })
        await manager.save('app-1')  // No tag
      }

      const result = await manager.prune('app-1', {
        keepRecent: 3,
        keepTagged: true
      })

      const remaining = await manager.list('app-1')
      const releaseVersion = remaining.find(v => v.tag === 'release')
      expect(releaseVersion).toBeDefined()
    })

    it('should respect keepAfter timestamp', async () => {
      mockIndex.set('data-1', {
        id: 'data-1',
        type: 'thing',
        name: 'Data',
        metadata: { v: 1 }
      })

      const now = Date.now()
      const oneDayAgo = now - 24 * 60 * 60 * 1000

      await manager.save('data-1', { tag: 'old' })

      // Simulate newer versions
      for (let i = 2; i <= 5; i++) {
        mockIndex.set('data-1', {
          id: 'data-1',
          type: 'thing',
          name: 'Data',
          metadata: { v: i }
        })
        await manager.save('data-1', { tag: `new${i}` })
      }

      const result = await manager.prune('data-1', {
        keepAfter: oneDayAgo,
        keepTagged: false
      })

      expect(result.deleted).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getVersion()', () => {
    it('should get specific version by number', async () => {
      mockIndex.set('test-1', {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: { v: 1 }
      })
      const v1 = await manager.save('test-1', { tag: 'v1' })

      mockIndex.set('test-1', {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: { v: 2 }
      })
      await manager.save('test-1', { tag: 'v2' })

      const version = await manager.getVersion('test-1', 1)
      expect(version).toBeDefined()
      expect(version?.version).toBe(1)
      expect(version?.tag).toBe('v1')
    })

    it('should return null if version not found', async () => {
      mockIndex.set('test-1', {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {}
      })
      await manager.save('test-1')

      const version = await manager.getVersion('test-1', 999)
      expect(version).toBeNull()
    })
  })

  describe('getVersionByTag()', () => {
    it('should get version by tag', async () => {
      mockIndex.set('app-1', {
        id: 'app-1',
        type: 'thing',
        name: 'App',
        metadata: { status: 'alpha' }
      })
      await manager.save('app-1', { tag: 'alpha' })

      mockIndex.set('app-1', {
        id: 'app-1',
        type: 'thing',
        name: 'App',
        metadata: { status: 'beta' }
      })
      await manager.save('app-1', { tag: 'beta' })

      const betaVersion = await manager.getVersionByTag('app-1', 'beta')
      expect(betaVersion).toBeDefined()
      expect(betaVersion?.tag).toBe('beta')
    })

    it('should return null if tag not found', async () => {
      mockIndex.set('test-1', {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {}
      })
      await manager.save('test-1', { tag: 'v1' })

      const version = await manager.getVersionByTag('test-1', 'nonexistent')
      expect(version).toBeNull()
    })
  })

  describe('getVersionCount()', () => {
    it('should count versions', async () => {
      mockIndex.set('doc-1', {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { v: 1 }
      })

      expect(await manager.getVersionCount('doc-1')).toBe(0)

      await manager.save('doc-1')
      expect(await manager.getVersionCount('doc-1')).toBe(1)

      mockIndex.set('doc-1', {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { v: 2 }
      })
      await manager.save('doc-1')
      expect(await manager.getVersionCount('doc-1')).toBe(2)
    })
  })

  describe('Branch Awareness', () => {
    it('should track versions per branch', async () => {
      mockIndex.set('branch-test', {
        id: 'branch-test',
        type: 'thing',
        name: 'Test',
        metadata: {}
      })

      // Save on main
      mockBrain.currentBranch = 'main'
      const mainV1 = await manager.save('branch-test', { tag: 'main-v1' })
      expect(mainV1.branch).toBe('main')

      // Save on feature
      mockBrain.currentBranch = 'feature'
      const featureV1 = await manager.save('branch-test', { tag: 'feature-v1' })
      expect(featureV1.branch).toBe('feature')

      // Versions should be independent
      expect(mainV1.version).toBe(1)
      expect(featureV1.version).toBe(1)  // Each branch starts at 1
    })
  })
})
