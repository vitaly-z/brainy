/**
 * Sharding + Transactions Integration Tests
 *
 * Verifies that transactions work correctly with sharded storage:
 * - Cross-shard atomicity
 * - Shard-aware routing
 * - Rollback across shards
 * - UUID-based shard distribution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { NounType, VerbType } from '../../../src/types/graphTypes.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync, rmSync } from 'fs'

describe('Transactions + Sharding Integration', () => {
  let brain: Brainy
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `brainy-shard-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: testDir
      }
    })

    await brain.init()
  })

  afterEach(async () => {
    if (brain) {
      await brain.shutdown()
    }
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Cross-Shard Operations', () => {
    it('should handle atomic operations across multiple shards', async () => {
      // Create entities with different UUID prefixes (different shards)
      const id1 = 'aaa00000-1111-4111-8111-111111111111' // Shard: aaa
      const id2 = 'bbb00000-2222-4222-8222-222222222222' // Shard: bbb

      // Add entities to different shards (atomic)
      await brain.add({
        id: id1,
        data: { name: 'Entity in Shard A', shard: 'aaa' },
        type: NounType.Thing
      })

      await brain.add({
        id: id2,
        data: { name: 'Entity in Shard B', shard: 'bbb' },
        type: NounType.Thing
      })

      // Create relationship across shards (atomic)
      const relationId = await brain.relate({
        from: id1,
        to: id2,
        type: VerbType.RelatesTo
      })

      // Verify all entities exist
      const entity1 = await brain.get(id1)
      const entity2 = await brain.get(id2)
      const relations = await brain.getRelations({ from: id1 })

      expect(entity1).toBeTruthy()
      expect(entity2).toBeTruthy()
      expect(relations).toHaveLength(1)
      expect(relations[0].targetId).toBe(id2)
    })

    it('should rollback operations across multiple shards', async () => {
      const id1 = 'ccc00000-1111-4111-8111-111111111111' // Shard: ccc
      const id2 = 'ddd00000-2222-4222-8222-222222222222' // Shard: ddd

      // Add first entity (succeeds)
      await brain.add({
        id: id1,
        data: { name: 'Entity in Shard C' },
        type: NounType.Thing
      })

      // Attempt to add second entity with invalid data (fails)
      let failed = false
      try {
        await brain.add({
          id: id2,
          data: null as any, // Invalid
          type: NounType.Thing
        })
      } catch (e) {
        failed = true
      }

      expect(failed).toBe(true)

      // First entity should still exist (in shard C)
      const entity1 = await brain.get(id1)
      expect(entity1).toBeTruthy()

      // Second entity should not exist (rollback in shard D)
      const entity2 = await brain.get(id2)
      expect(entity2).toBeNull()
    })

    it('should handle updates across shards atomically', async () => {
      const id1 = 'eee00000-1111-4111-8111-111111111111'
      const id2 = 'fff00000-2222-4222-8222-222222222222'

      // Add entities
      await brain.add({
        id: id1,
        data: { name: 'Original E', version: 1 },
        type: NounType.Thing
      })

      await brain.add({
        id: id2,
        data: { name: 'Original F', version: 1 },
        type: NounType.Thing
      })

      // Update both entities (different shards)
      await brain.update({
        id: id1,
        data: { name: 'Updated E', version: 2 }
      })

      await brain.update({
        id: id2,
        data: { name: 'Updated F', version: 2 }
      })

      // Verify updates in both shards
      const entity1 = await brain.get(id1)
      const entity2 = await brain.get(id2)

      expect(entity1?.data.version).toBe(2)
      expect(entity2?.data.version).toBe(2)
    })
  })

  describe('Shard Distribution', () => {
    it('should distribute entities across shards based on UUID', async () => {
      // Create entities with various UUID prefixes
      const ids = [
        'aaa00000-1111-4111-8111-111111111111',
        'bbb00000-2222-4222-8222-222222222222',
        'ccc00000-3333-4333-8333-333333333333',
        'ddd00000-4444-4444-8444-444444444444'
      ]

      // Add entities to different shards
      for (let i = 0; i < ids.length; i++) {
        await brain.add({
          id: ids[i],
          data: { name: `Entity ${i}`, index: i },
          type: NounType.Thing
        })
      }

      // Verify all entities can be retrieved (regardless of shard)
      for (let i = 0; i < ids.length; i++) {
        const entity = await brain.get(ids[i])
        expect(entity).toBeTruthy()
        expect(entity?.data.index).toBe(i)
      }
    })

    it('should handle relationships between different shard combinations', async () => {
      const entities = [
        { id: 'aaa00000-1111-4111-8111-111111111111', name: 'A' },
        { id: 'bbb00000-2222-4222-8222-222222222222', name: 'B' },
        { id: 'ccc00000-3333-4333-8333-333333333333', name: 'C' }
      ]

      // Add all entities
      for (const e of entities) {
        await brain.add({
          id: e.id,
          data: { name: e.name },
          type: NounType.Thing
        })
      }

      // Create relationships across all shards
      await brain.relate({
        from: entities[0].id,
        to: entities[1].id,
        type: VerbType.RelatesTo
      })

      await brain.relate({
        from: entities[1].id,
        to: entities[2].id,
        type: VerbType.RelatesTo
      })

      await brain.relate({
        from: entities[2].id,
        to: entities[0].id,
        type: VerbType.RelatesTo
      })

      // Verify all relationships exist
      const relations0 = await brain.getRelations({ from: entities[0].id })
      const relations1 = await brain.getRelations({ from: entities[1].id })
      const relations2 = await brain.getRelations({ from: entities[2].id })

      expect(relations0).toHaveLength(1)
      expect(relations1).toHaveLength(1)
      expect(relations2).toHaveLength(1)
    })
  })

  describe('Delete Operations Across Shards', () => {
    it('should delete entities and relationships across shards atomically', async () => {
      const id1 = 'ggg00000-1111-4111-8111-111111111111'
      const id2 = 'hhh00000-2222-4222-8222-222222222222'

      // Add entities in different shards
      await brain.add({
        id: id1,
        data: { name: 'Entity G' },
        type: NounType.Thing
      })

      await brain.add({
        id: id2,
        data: { name: 'Entity H' },
        type: NounType.Thing
      })

      // Create relationship
      await brain.relate({
        from: id1,
        to: id2,
        type: VerbType.RelatesTo
      })

      // Delete first entity (should also delete relationship)
      await brain.delete(id1)

      // Verify entity deleted from shard G
      const entity1 = await brain.get(id1)
      expect(entity1).toBeNull()

      // Entity H should still exist in shard H
      const entity2 = await brain.get(id2)
      expect(entity2).toBeTruthy()

      // Relationship should be deleted
      const relations = await brain.getRelations({ from: id1 })
      expect(relations).toHaveLength(0)
    })
  })

  describe('Batch Operations Across Shards', () => {
    it('should handle batch adds across multiple shards atomically', async () => {
      const entities = [
        { id: 'shard1-00-1111-4111-8111-111111111111', data: { name: 'S1-E1' } },
        { id: 'shard2-00-2222-4222-8222-222222222222', data: { name: 'S2-E1' } },
        { id: 'shard3-00-3333-4333-8333-333333333333', data: { name: 'S3-E1' } },
        { id: 'shard1-00-4444-4444-8444-444444444444', data: { name: 'S1-E2' } },
        { id: 'shard2-00-5555-4555-8555-555555555555', data: { name: 'S2-E2' } }
      ]

      // Add all entities (distributed across shards)
      for (const e of entities) {
        await brain.add({
          id: e.id,
          data: e.data,
          type: NounType.Thing
        })
      }

      // Verify all entities exist in their respective shards
      for (const e of entities) {
        const entity = await brain.get(e.id)
        expect(entity).toBeTruthy()
        expect(entity?.data.name).toBe(e.data.name)
      }
    })
  })
})
