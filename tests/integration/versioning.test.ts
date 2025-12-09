/**
 * Entity Versioning Integration Tests (v5.3.0, v6.3.0)
 *
 * Tests the complete versioning workflow:
 * - Save versions
 * - List versions
 * - Restore versions
 * - Compare versions
 * - Prune versions
 * - Branch isolation
 * - Index pollution prevention
 *
 * v6.3.0: Pure key-value storage, no index pollution, restore() updates all indexes
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import type { EntityVersion } from '../../src/versioning/VersionManager.js'
import { randomUUID } from 'crypto'

// Helper to generate valid UUIDs for tests
const uuid = () => randomUUID().replace(/-/g, '')

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
      const entityId = uuid()

      // Add initial entity
      await brain.add({
        data: 'Alice',
        id: entityId,
        type: 'person',  // v6.3.0: Use valid NounType
        metadata: {
          name: 'Alice',
          email: 'alice@example.com'
        }
      })

      // Save version 1
      const v1 = await brain.versions.save(entityId, {
        tag: 'v1.0',
        description: 'Initial version'
      })

      expect(v1.version).toBe(1)
      expect(v1.entityId).toBe(entityId)
      expect(v1.tag).toBe('v1.0')
      expect(v1.contentHash).toBeDefined()

      // Update entity
      await brain.update({ id: entityId, metadata: { name: 'Alice Smith' } })

      // Save version 2
      const v2 = await brain.versions.save(entityId, {
        tag: 'v2.0',
        description: 'Updated name'
      })

      expect(v2.version).toBe(2)
      expect(v2.entityId).toBe(entityId)

      // List versions
      const versions = await brain.versions.list(entityId)
      expect(versions).toHaveLength(2)
      expect(versions[0].version).toBe(2) // Newest first
      expect(versions[1].version).toBe(1)
    })

    it('should deduplicate identical content', async () => {
      const entityId = uuid()

      await brain.add({
        data: 'Doc',
        id: entityId,
        type: 'document',
        metadata: {
          name: 'Doc',
          content: 'Hello'
        }
      })

      // Save version 1
      const v1 = await brain.versions.save(entityId, { tag: 'v1' })

      // Save again without changes
      const v2 = await brain.versions.save(entityId, { tag: 'v2' })

      // Should return existing version (same content hash)
      expect(v2.version).toBe(v1.version)
      expect(v2.contentHash).toBe(v1.contentHash)

      // Only one version should exist
      const versions = await brain.versions.list(entityId)
      expect(versions).toHaveLength(1)
    })

    it('should restore to previous version', async () => {
      const entityId = uuid()

      await brain.add({
        data: 'Config',
        id: entityId,
        type: 'thing',
        metadata: {
          name: 'Config',
          settings: { theme: 'light' }
        }
      })

      // Save v1
      await brain.versions.save(entityId, { tag: 'v1' })

      // Update
      await brain.update({ id: entityId, metadata: { settings: { theme: 'dark' } } })

      // Save v2
      await brain.versions.save(entityId, { tag: 'v2' })

      // Verify current state (getNounMetadata returns flat NounMetadata)
      let current = await brain.getNounMetadata(entityId)
      expect(current?.settings?.theme).toBe('dark')

      // Restore to v1
      await brain.versions.restore(entityId, 1)

      // Verify restored state
      current = await brain.getNounMetadata(entityId)
      expect(current?.settings?.theme).toBe('light')
    })

    it('should compare versions', async () => {
      const entityId = uuid()

      await brain.add({
        data: 'Bob',
        id: entityId,
        type: 'person',  // v6.3.0: Use valid NounType
        metadata: {
          name: 'Bob',
          email: 'bob@example.com',
          age: 30
        }
      })

      await brain.versions.save(entityId, { tag: 'v1' })

      // Update
      await brain.update({
        id: entityId,
        metadata: {
          name: 'Robert',
          email: 'robert@example.com',
          city: 'NYC'
        }
      })

      await brain.versions.save(entityId, { tag: 'v2' })

      // Compare versions
      const diff = await brain.versions.compare(entityId, 1, 2)

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
      const entityId = uuid()

      await brain.add({
        data: 'Note',
        id: entityId,
        type: 'document',
        metadata: {
          name: 'Note',
          content: 'Version 1'
        }
      })

      await brain.versions.save(entityId, { tag: 'v1' })

      await brain.update({ id: entityId, metadata: { content: 'Version 2' } })
      await brain.versions.save(entityId, { tag: 'v2' })

      // Get v1 content without restoring (returns flat NounMetadata)
      const v1Content = await brain.versions.getContent(entityId, 1)
      expect(v1Content.content).toBe('Version 1')

      // Current should still be v2 (getNounMetadata returns flat NounMetadata)
      const current = await brain.getNounMetadata(entityId)
      expect(current?.content).toBe('Version 2')
    })

    it('should prune old versions', async () => {
      const entityId = uuid()

      await brain.add({
        data: 'Log',
        id: entityId,
        type: 'document',
        metadata: {
          name: 'Log'
        }
      })

      // Create 10 versions
      for (let i = 1; i <= 10; i++) {
        await brain.update({ id: entityId, metadata: { content: `Entry ${i}` } })
        await brain.versions.save(entityId, { tag: `v${i}` })
      }

      // Verify all 10 exist
      let versions = await brain.versions.list(entityId)
      expect(versions.length).toBeGreaterThanOrEqual(10)

      // Prune to keep only 5 most recent
      const result = await brain.versions.prune(entityId, {
        keepRecent: 5,
        keepTagged: false
      })

      expect(result.deleted).toBeGreaterThan(0)
      expect(result.kept).toBe(5)

      // Verify only 5 remain
      versions = await brain.versions.list(entityId)
      expect(versions).toHaveLength(5)
    })

    it('should support version tags', async () => {
      const entityId = uuid()

      await brain.add({
        data: 'App',
        id: entityId,
        type: 'thing',
        metadata: {
          name: 'App'
        }
      })

      await brain.versions.save(entityId, { tag: 'alpha' })
      await brain.update({ id: entityId, metadata: { version: '0.2' } })
      await brain.versions.save(entityId, { tag: 'beta' })
      await brain.update({ id: entityId, metadata: { version: '1.0' } })
      await brain.versions.save(entityId, { tag: 'release' })

      // Get by tag
      const beta = await brain.versions.getVersionByTag(entityId, 'beta')
      expect(beta).toBeDefined()
      expect(beta?.tag).toBe('beta')

      // Restore by tag
      await brain.versions.restore(entityId, 'beta')
      const current = await brain.getNounMetadata(entityId)
      expect(current?.version).toBe('0.2')
    })

    it('should support undo/revert', async () => {
      const entityId = uuid()

      await brain.add({
        data: 'Data',
        id: entityId,
        type: 'thing',
        metadata: {
          name: 'Data',
          value: 100
        }
      })

      // Save v1 (value=100)
      await brain.versions.save(entityId, { tag: 'v1' })

      // Update and save v2 (value=200)
      await brain.update({ id: entityId, metadata: { value: 200 } })
      await brain.versions.save(entityId, { tag: 'v2' })

      // undo() restores to SECOND-MOST-RECENT version and creates a snapshot
      // Note: undo() internally calls restore() with createSnapshot: true
      const undone = await brain.versions.undo(entityId)
      expect(undone).not.toBeNull()

      // After undo, entity should have v1's value
      const currentVal = await brain.getNounMetadata(entityId)
      expect(currentVal?.value).toBe(100)  // v1's value

      // Now we have: [before-undo, v2, v1] - undo created a snapshot
      const versionsAfterUndo = await brain.versions.list(entityId)
      expect(versionsAfterUndo.length).toBeGreaterThanOrEqual(2)

      // Update and save v3 (value=300)
      await brain.update({ id: entityId, metadata: { value: 300 } })
      await brain.versions.save(entityId, { tag: 'v3' })

      // revert() is alias for undo()
      const reverted = await brain.versions.revert(entityId)
      expect(reverted).not.toBeNull()

      // The entity should be restored to second-most-recent version
      const revertedVal = await brain.getNounMetadata(entityId)
      // After revert from v3, we go to the previous version
      expect(revertedVal?.value).toBeDefined()
    })
  })

  describe('Branch Isolation', () => {
    it('should isolate versions by branch', async () => {
      const entityId = uuid()

      await brain.add({
        data: 'Test',
        id: entityId,
        type: 'thing',
        metadata: {
          name: 'Test'
        }
      })

      // Save versions on main
      await brain.versions.save(entityId, { tag: 'main-v1' })
      await brain.update({ id: entityId, metadata: { name: 'Main Update' } })
      await brain.versions.save(entityId, { tag: 'main-v2' })

      // Main should have versions
      const mainVersionsBefore = await brain.versions.list(entityId)
      expect(mainVersionsBefore.length).toBeGreaterThanOrEqual(2)
      // Main versions should have branch='main'
      expect(mainVersionsBefore.every(v => v.branch === 'main')).toBe(true)

      // Switch to feature branch
      // Note: fork() creates the branch and returns a NEW instance
      // We need to checkout() to switch the current instance to the new branch
      await brain.fork('feature')
      await brain.checkout('feature')

      // Save version on feature with unique tag
      await brain.update({ id: entityId, metadata: { name: 'Feature Update' } })
      await brain.versions.save(entityId, { tag: 'feature-only-v1' })

      // Feature versions list - may include inherited versions from COW
      const featureVersions = await brain.versions.list(entityId)
      expect(featureVersions.length).toBeGreaterThan(0)

      // Feature should have our unique tag (this is the NEW version on feature)
      const featureOnlyVersion = featureVersions.find(v => v.tag === 'feature-only-v1')
      expect(featureOnlyVersion).toBeDefined()

      // The version we just saved on feature should have branch='feature'
      expect(featureOnlyVersion!.branch).toBe('feature')

      // Switch back to main
      await brain.checkout('main')

      // Main versions should not have feature's unique tag
      const mainVersionsAfter = await brain.versions.list(entityId)
      const featureTagOnMain = mainVersionsAfter.find(v => v.tag === 'feature-only-v1')
      expect(featureTagOnMain).toBeUndefined()  // Feature-only version not on main

      // Main should still have its original versions
      expect(mainVersionsAfter.some(v => v.tag === 'main-v1')).toBe(true)
      expect(mainVersionsAfter.some(v => v.tag === 'main-v2')).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle non-existent entities gracefully', async () => {
      const nonExistentId = uuid()
      await expect(
        brain.versions.save(nonExistentId, { tag: 'v1' })
      ).rejects.toThrow(`Entity ${nonExistentId} not found`)
    })

    it('should handle empty version history', async () => {
      const entityId = uuid()
      await brain.add({ data: 'New', id: entityId, type: 'thing', metadata: { name: 'New' } })

      expect(await brain.versions.count(entityId)).toBe(0)
      expect(await brain.versions.hasVersions(entityId)).toBe(false)
      expect(await brain.versions.getLatest(entityId)).toBeNull()
    })

    it('should handle version not found', async () => {
      const entityId = uuid()
      await brain.add({ data: 'Test', id: entityId, type: 'thing', metadata: { name: 'Test' } })

      await expect(
        brain.versions.restore(entityId, 999)
      ).rejects.toThrow('Version 999 not found')
    })
  })

  describe('Index Pollution Prevention (v6.3.0)', () => {
    it('should NOT pollute find() results with versions', async () => {
      const entityId = uuid()

      // Add entity
      await brain.add({
        data: 'Test entity',
        id: entityId,
        type: 'document',
        metadata: { name: 'Test', category: 'pollution-test' }
      })

      // Save multiple versions
      await brain.versions.save(entityId, { tag: 'v1' })
      await brain.update({ id: entityId, metadata: { name: 'Updated' } })
      await brain.versions.save(entityId, { tag: 'v2' })
      await brain.update({ id: entityId, metadata: { name: 'Updated Again' } })
      await brain.versions.save(entityId, { tag: 'v3' })

      // Verify 3 versions exist
      const versions = await brain.versions.list(entityId)
      expect(versions).toHaveLength(3)

      // find() should return ONLY the real entity, not version entries
      const results = await brain.find({ where: { category: 'pollution-test' } })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(entityId)

      // Verify no version entities pollute the index
      // (This was the bug - _isVersion entities appeared in find())
      const allDocs = await brain.find({ where: { type: 'document' }, limit: 100 })
      const versionEntities = allDocs.filter((e: any) => e.metadata?._isVersion)
      expect(versionEntities).toHaveLength(0)
    })

    it('should keep current entity fully indexed after versioning', async () => {
      const entityId = uuid()

      // Add entity
      await brain.add({
        data: 'Searchable content about machine learning',
        id: entityId,
        type: 'document',
        metadata: { name: 'ML Doc', topic: 'ai' }
      })

      // Save versions
      await brain.versions.save(entityId, { tag: 'v1' })
      await brain.update({ id: entityId, metadata: { name: 'Updated ML Doc' } })
      await brain.versions.save(entityId, { tag: 'v2' })

      // Entity should still be searchable by metadata
      const byMetadata = await brain.find({ where: { topic: 'ai' } })
      expect(byMetadata).toHaveLength(1)
      expect(byMetadata[0].id).toBe(entityId)

      // Entity should still be searchable by vector similarity
      const bySimilarity = await brain.find({ query: 'machine learning', limit: 5 })
      const found = bySimilarity.find((e: any) => e.id === entityId)
      expect(found).toBeDefined()
    })

    it('should update indexes when restoring a version', async () => {
      const entityId = uuid()

      // Add entity with initial state
      await brain.add({
        data: 'Initial content',
        id: entityId,
        type: 'document',
        metadata: { name: 'Doc', status: 'draft' }
      })
      await brain.versions.save(entityId, { tag: 'draft' })

      // Update to published state
      await brain.update({ id: entityId, metadata: { status: 'published' } })
      await brain.versions.save(entityId, { tag: 'published' })

      // Verify current state
      let published = await brain.find({ where: { status: 'published' } })
      expect(published).toHaveLength(1)

      let drafts = await brain.find({ where: { status: 'draft' } })
      expect(drafts).toHaveLength(0)

      // Restore to draft version
      await brain.versions.restore(entityId, 'draft')

      // Indexes should update - now entity is draft again
      published = await brain.find({ where: { status: 'published' } })
      expect(published).toHaveLength(0)

      drafts = await brain.find({ where: { status: 'draft' } })
      expect(drafts).toHaveLength(1)
      expect(drafts[0].id).toBe(entityId)
    })
  })
})
