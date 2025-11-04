/**
 * Entity Versioning Integration Tests (v5.3.0)
 *
 * Tests the complete versioning workflow:
 * - Save versions
 * - List versions
 * - Restore versions
 * - Compare versions
 * - Prune versions
 * - Auto-versioning augmentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import type { EntityVersion } from '../../src/versioning/VersionManager.js'
import { VersioningAugmentation } from '../../src/augmentations/versioningAugmentation.js'

describe('Entity Versioning (v5.3.0)', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' },
      silent: true
    })
    await brain.init()
  })

  describe('Core Versioning API', () => {
    it('should save and retrieve versions', async () => {
      // Add initial entity
      await brain.add({
        data: 'Alice',
        id: 'user-123',
        type: 'user',
        metadata: {
          name: 'Alice',
          email: 'alice@example.com'
        }
      })

      // Save version 1
      const v1 = await brain.versions.save('user-123', {
        tag: 'v1.0',
        description: 'Initial version'
      })

      expect(v1.version).toBe(1)
      expect(v1.entityId).toBe('user-123')
      expect(v1.tag).toBe('v1.0')
      expect(v1.contentHash).toBeDefined()

      // Update entity
      await brain.update('user-123', { name: 'Alice Smith' })

      // Save version 2
      const v2 = await brain.versions.save('user-123', {
        tag: 'v2.0',
        description: 'Updated name'
      })

      expect(v2.version).toBe(2)
      expect(v2.entityId).toBe('user-123')

      // List versions
      const versions = await brain.versions.list('user-123')
      expect(versions).toHaveLength(2)
      expect(versions[0].version).toBe(2) // Newest first
      expect(versions[1].version).toBe(1)
    })

    it('should deduplicate identical content', async () => {
      await brain.add({
        data: 'Doc',
        id: 'doc-1',
        type: 'document',
        metadata: {
          name: 'Doc',
          content: 'Hello'
        }
      })

      // Save version 1
      const v1 = await brain.versions.save('doc-1', { tag: 'v1' })

      // Save again without changes
      const v2 = await brain.versions.save('doc-1', { tag: 'v2' })

      // Should return existing version (same content hash)
      expect(v2.version).toBe(v1.version)
      expect(v2.contentHash).toBe(v1.contentHash)

      // Only one version should exist
      const versions = await brain.versions.list('doc-1')
      expect(versions).toHaveLength(1)
    })

    it('should restore to previous version', async () => {
      await brain.add({
        data: 'Config',
        id: 'config-1',
        type: 'thing',
        metadata: {
          name: 'Config',
          settings: { theme: 'light' }
        }
      })

      // Save v1
      await brain.versions.save('config-1', { tag: 'v1' })

      // Update
      await brain.update('config-1', { settings: { theme: 'dark' } })

      // Save v2
      await brain.versions.save('config-1', { tag: 'v2' })

      // Verify current state
      let current = await brain.getNounMetadata('config-1')
      expect(current?.metadata?.settings?.theme).toBe('dark')

      // Restore to v1
      await brain.versions.restore('config-1', 1)

      // Verify restored state
      current = await brain.getNounMetadata('config-1')
      expect(current?.metadata?.settings?.theme).toBe('light')
    })

    it('should compare versions', async () => {
      await brain.add({
        data: 'Bob',
        id: 'user-456',
        type: 'user',
        metadata: {
          name: 'Bob',
          email: 'bob@example.com',
          age: 30
        }
      })

      await brain.versions.save('user-456', { tag: 'v1' })

      // Update
      await brain.update('user-456', {
        name: 'Robert',
        email: 'robert@example.com',
        city: 'NYC'
      })

      await brain.versions.save('user-456', { tag: 'v2' })

      // Compare versions
      const diff = await brain.versions.compare('user-456', 1, 2)

      expect(diff.totalChanges).toBeGreaterThan(0)
      expect(diff.modified.length).toBeGreaterThan(0)
      expect(diff.added.length).toBeGreaterThan(0)

      // Check specific changes
      const nameChange = diff.modified.find(c => c.path.includes('name'))
      expect(nameChange).toBeDefined()
      expect(nameChange?.oldValue).toBe('Bob')
      expect(nameChange?.newValue).toBe('Robert')

      const cityAdd = diff.added.find(c => c.path.includes('city'))
      expect(cityAdd).toBeDefined()
      expect(cityAdd?.newValue).toBe('NYC')
    })

    it('should get version content without restoring', async () => {
      await brain.add({
        data: 'Note',
        id: 'note-1',
        type: 'document',
        metadata: {
          name: 'Note',
          content: 'Version 1'
        }
      })

      await brain.versions.save('note-1', { tag: 'v1' })

      await brain.update('note-1', { content: 'Version 2' })
      await brain.versions.save('note-1', { tag: 'v2' })

      // Get v1 content without restoring
      const v1Content = await brain.versions.getContent('note-1', 1)
      expect(v1Content.metadata.content).toBe('Version 1')

      // Current should still be v2
      const current = await brain.getNounMetadata('note-1')
      expect(current?.metadata?.content).toBe('Version 2')
    })

    it('should prune old versions', async () => {
      await brain.add({
        data: 'Log',
        id: 'log-1',
        type: 'document',
        metadata: {
          name: 'Log'
        }
      })

      // Create 10 versions
      for (let i = 1; i <= 10; i++) {
        await brain.update('log-1', { content: `Entry ${i}` })
        await brain.versions.save('log-1', { tag: `v${i}` })
      }

      // Verify all 10 exist
      let versions = await brain.versions.list('log-1')
      expect(versions.length).toBeGreaterThanOrEqual(10)

      // Prune to keep only 5 most recent
      const result = await brain.versions.prune('log-1', {
        keepRecent: 5,
        keepTagged: false
      })

      expect(result.deleted).toBeGreaterThan(0)
      expect(result.kept).toBe(5)

      // Verify only 5 remain
      versions = await brain.versions.list('log-1')
      expect(versions).toHaveLength(5)
    })

    it('should support version tags', async () => {
      await brain.add({
        data: 'App',
        id: 'app-1',
        type: 'thing',
        metadata: {
          name: 'App'
        }
      })

      await brain.versions.save('app-1', { tag: 'alpha' })
      await brain.update('app-1', { version: '0.2' })
      await brain.versions.save('app-1', { tag: 'beta' })
      await brain.update('app-1', { version: '1.0' })
      await brain.versions.save('app-1', { tag: 'release' })

      // Get by tag
      const beta = await brain.versions.getVersionByTag('app-1', 'beta')
      expect(beta).toBeDefined()
      expect(beta?.tag).toBe('beta')

      // Restore by tag
      await brain.versions.restore('app-1', 'beta')
      const current = await brain.getNounMetadata('app-1')
      expect(current?.metadata?.version).toBe('0.2')
    })

    it('should support undo/revert', async () => {
      await brain.add({
        data: 'Data',
        id: 'data-1',
        type: 'thing',
        metadata: {
          name: 'Data',
          value: 100
        }
      })

      await brain.versions.save('data-1')
      await brain.update('data-1', { value: 200 })
      await brain.versions.save('data-1')

      // Make a bad change
      await brain.update('data-1', { value: 999 })

      // Undo (reverts to previous version)
      await brain.versions.undo('data-1')

      const current = await brain.getNounMetadata('data-1')
      expect(current?.metadata?.value).toBe(200)

      // Revert (alias for undo)
      await brain.update('data-1', { value: 999 })
      await brain.versions.revert('data-1')

      const reverted = await brain.getNounMetadata('data-1')
      expect(reverted?.metadata?.value).toBe(200)
    })
  })

  describe('Auto-Versioning Augmentation', () => {
    it('should auto-version on update when enabled', async () => {
      // Add augmentation
      const augmentation = new VersioningAugmentation({
        enabled: true,
        onUpdate: true,
        entities: ['*'],
        keepRecent: 10
      })

      brain.augment(augmentation as any)

      await brain.add({
        data: 'Auto User',
        id: 'auto-1',
        type: 'user',
        metadata: {
          name: 'Auto User'
        }
      })

      // No versions yet
      expect(await brain.versions.count('auto-1')).toBe(0)

      // Update should auto-create version
      await brain.update('auto-1', { name: 'Auto User Updated' })

      // Give augmentation time to process
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have auto-created version
      const count = await brain.versions.count('auto-1')
      expect(count).toBeGreaterThan(0)
    })

    it('should filter entities by ID pattern', async () => {
      const augmentation = new VersioningAugmentation({
        enabled: true,
        onUpdate: true,
        entities: ['versioned-*'],
        excludeEntities: ['temp-*']
      })

      brain.augment(augmentation as any)

      // This should be versioned
      await brain.add({ data: 'V1', id: 'versioned-1', type: 'thing', metadata: { name: 'V1' } })
      await brain.update('versioned-1', { name: 'V1 Updated' })
      await new Promise(resolve => setTimeout(resolve, 100))

      // This should NOT be versioned
      await brain.add({ data: 'O1', id: 'other-1', type: 'thing', metadata: { name: 'O1' } })
      await brain.update('other-1', { name: 'O1 Updated' })
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(await brain.versions.count('versioned-1')).toBeGreaterThan(0)
      expect(await brain.versions.count('other-1')).toBe(0)
    })
  })

  describe('Branch Isolation', () => {
    it('should isolate versions by branch', async () => {
      await brain.add({
        data: 'Test',
        id: 'branch-test',
        type: 'thing',
        metadata: {
          name: 'Test'
        }
      })

      // Save on main
      await brain.versions.save('branch-test', { tag: 'main-v1' })

      // Switch to feature branch
      await brain.fork('feature')

      // Update on feature
      await brain.update('branch-test', { name: 'Feature Update' })
      await brain.versions.save('branch-test', { tag: 'feature-v1' })

      // Versions on feature branch
      const featureVersions = await brain.versions.list('branch-test')
      expect(featureVersions.length).toBeGreaterThan(0)

      // Switch back to main
      await brain.checkout('main')

      // Versions on main branch
      const mainVersions = await brain.versions.list('branch-test')

      // Should be isolated
      expect(mainVersions.length).not.toBe(featureVersions.length)
    })
  })

  describe('Edge Cases', () => {
    it('should handle non-existent entities gracefully', async () => {
      await expect(
        brain.versions.save('nonexistent', { tag: 'v1' })
      ).rejects.toThrow('Entity nonexistent not found')
    })

    it('should handle empty version history', async () => {
      await brain.add({ data: 'New', id: 'new-1', type: 'thing', metadata: { name: 'New' } })

      expect(await brain.versions.count('new-1')).toBe(0)
      expect(await brain.versions.hasVersions('new-1')).toBe(false)
      expect(await brain.versions.getLatest('new-1')).toBeNull()
    })

    it('should handle version not found', async () => {
      await brain.add({ data: 'Test', id: 'test-1', type: 'thing', metadata: { name: 'Test' } })

      await expect(
        brain.versions.restore('test-1', 999)
      ).rejects.toThrow('Version 999 not found')
    })
  })
})
