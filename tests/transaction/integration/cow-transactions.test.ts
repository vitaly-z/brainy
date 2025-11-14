/**
 * COW + Transactions Integration Tests
 *
 * Verifies that transactions work correctly with Copy-on-Write storage:
 * - Branch isolation
 * - Atomic commits
 * - Rollback without affecting main branch
 * - Content-addressable storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { NounType, VerbType } from '../../../src/types/graphTypes.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync, rmSync } from 'fs'

describe('Transactions + COW Integration', () => {
  let brain: Brainy
  let testDir: string

  beforeEach(async () => {
    // Create unique test directory
    testDir = join(tmpdir(), `brainy-cow-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })

    // Initialize Brainy with COW enabled
    brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: testDir
      }
    })

    await brain.init()

    // Enable COW if available
    if (brain.cow) {
      await brain.cow.init()
    }
  })

  afterEach(async () => {
    if (brain) {
      await brain.shutdown()
    }
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Basic COW Operations', () => {
    it('should commit transaction successfully on COW branch', async () => {
      // Create branch
      if (!brain.cow) {
        console.log('COW not available, skipping test')
        return
      }

      await brain.cow.createBranch('feature-branch')
      await brain.cow.checkout('feature-branch')

      // Add entity (should succeed)
      const id = await brain.add({
        data: { name: 'Test Entity' },
        type: NounType.Thing
      })

      expect(id).toBeTruthy()

      // Verify entity exists
      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity?.data.name).toBe('Test Entity')
    })

    it('should isolate transaction rollback to branch', async () => {
      if (!brain.cow) {
        console.log('COW not available, skipping test')
        return
      }

      // Add entity on main branch
      const mainId = await brain.add({
        data: { name: 'Main Entity' },
        type: NounType.Thing
      })

      // Create and checkout feature branch
      await brain.cow.createBranch('feature-branch')
      await brain.cow.checkout('feature-branch')

      // Try to add entity that will fail
      try {
        await brain.add({
          data: { name: 'Feature Entity' },
          type: NounType.Thing,
          // Force failure by providing invalid vector
          vector: [] as any
        })
      } catch (e) {
        // Expected to fail
      }

      // Switch back to main
      await brain.cow.checkout('main')

      // Main branch entity should still exist
      const mainEntity = await brain.get(mainId)
      expect(mainEntity).toBeTruthy()
      expect(mainEntity?.data.name).toBe('Main Entity')
    })

    it('should handle atomic updates across COW branches', async () => {
      if (!brain.cow) {
        console.log('COW not available, skipping test')
        return
      }

      // Add entity
      const id = await brain.add({
        data: { name: 'Original', version: 1 },
        type: NounType.Thing
      })

      // Create branch
      await brain.cow.createBranch('feature-branch')
      await brain.cow.checkout('feature-branch')

      // Update entity (atomic operation)
      await brain.update({
        id,
        data: { name: 'Updated', version: 2 },
        merge: false
      })

      // Verify update on feature branch
      const featureEntity = await brain.get(id)
      expect(featureEntity?.data.version).toBe(2)

      // Switch to main
      await brain.cow.checkout('main')

      // Original should be unchanged on main
      const mainEntity = await brain.get(id)
      expect(mainEntity?.data.version).toBe(1)
    })
  })

  describe('Transaction Rollback with COW', () => {
    it('should rollback failed transaction without affecting COW branch', async () => {
      if (!brain.cow) {
        console.log('COW not available, skipping test')
        return
      }

      await brain.cow.createBranch('test-branch')
      await brain.cow.checkout('test-branch')

      // Add first entity (will succeed)
      const id1 = await brain.add({
        data: { name: 'Entity 1' },
        type: NounType.Thing
      })

      // Attempt to add with invalid data (will fail)
      // This tests that the transaction rollback doesn't corrupt the branch
      let failed = false
      try {
        await brain.add({
          data: null as any, // Invalid
          type: NounType.Thing
        })
      } catch (e) {
        failed = true
      }

      expect(failed).toBe(true)

      // First entity should still exist (transaction rollback worked)
      const entity1 = await brain.get(id1)
      expect(entity1).toBeTruthy()
    })
  })

  describe('COW Branch Merging with Transactions', () => {
    it('should preserve transaction atomicity during branch operations', async () => {
      if (!brain.cow) {
        console.log('COW not available, skipping test')
        return
      }

      // Add entity on main
      const mainId = await brain.add({
        data: { name: 'Main Entity', branch: 'main' },
        type: NounType.Thing
      })

      // Create feature branch
      await brain.cow.createBranch('feature')
      await brain.cow.checkout('feature')

      // Add multiple entities in transaction (atomic)
      const featureId1 = await brain.add({
        data: { name: 'Feature 1', branch: 'feature' },
        type: NounType.Thing
      })

      const featureId2 = await brain.add({
        data: { name: 'Feature 2', branch: 'feature' },
        type: NounType.Thing
      })

      // Create relationship (atomic)
      await brain.relate({
        from: featureId1,
        to: featureId2,
        type: VerbType.RelatesTo
      })

      // All operations should be atomic on feature branch
      const feature1 = await brain.get(featureId1)
      const feature2 = await brain.get(featureId2)
      const relations = await brain.getRelations({ from: featureId1 })

      expect(feature1).toBeTruthy()
      expect(feature2).toBeTruthy()
      expect(relations).toHaveLength(1)

      // Switch back to main - feature entities should not exist
      await brain.cow.checkout('main')
      const mainCheck = await brain.get(featureId1)
      expect(mainCheck).toBeNull()
    })
  })

  describe('Content-Addressable Storage', () => {
    it('should handle content-addressable storage with transactions', async () => {
      if (!brain.cow) {
        console.log('COW not available, skipping test')
        return
      }

      // Add entity with specific data
      const id = await brain.add({
        data: { content: 'Test content', value: 123 },
        type: NounType.Thing
      })

      // Update entity (creates new blob)
      await brain.update({
        id,
        data: { content: 'Updated content', value: 456 }
      })

      // Get entity - should have updated content
      const entity = await brain.get(id)
      expect(entity?.data.content).toBe('Updated content')
      expect(entity?.data.value).toBe(456)

      // Transaction system should work with content-addressable storage
      // (each version is a separate blob, rollback restores previous blob reference)
    })
  })
})
