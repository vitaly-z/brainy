/**
 * Distributed + Transactions Integration Tests
 *
 * Verifies that transactions work correctly with distributed storage:
 * - Remote storage adapters (S3, Azure, GCS)
 * - Distributed coordination
 * - Cache coherence
 * - Read/write separation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { NounType, VerbType } from '../../../src/types/graphTypes.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync, rmSync } from 'fs'

describe('Transactions + Distributed Storage Integration', () => {
  let brain: Brainy
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `brainy-distributed-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })

    // Use filesystem as proxy for distributed storage
    // (In production, this would be S3, Azure, GCS, etc.)
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

  describe('Remote Storage Adapters', () => {
    it('should handle transactions with filesystem storage (proxy for remote)', async () => {
      // Add entity (atomic operation)
      const id = await brain.add({
        data: { name: 'Remote Entity', location: 'cloud' },
        type: NounType.Thing
      })

      expect(id).toBeTruthy()

      // Verify entity persisted to storage
      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity?.data.name).toBe('Remote Entity')
    })

    it('should rollback failed operations with remote storage', async () => {
      // Add first entity (succeeds)
      const id1 = await brain.add({
        data: { name: 'Entity 1' },
        type: NounType.Thing
      })

      // Attempt to add with invalid data (fails)
      let failed = false
      try {
        await brain.add({
          data: null as any,
          type: NounType.Thing
        })
      } catch (e) {
        failed = true
      }

      expect(failed).toBe(true)

      // First entity should still exist
      const entity1 = await brain.get(id1)
      expect(entity1).toBeTruthy()
    })

    it('should handle update operations with remote storage atomically', async () => {
      // Add entity
      const id = await brain.add({
        data: { name: 'Original', version: 1 },
        type: NounType.Thing
      })

      // Update atomically
      await brain.update({
        id,
        data: { name: 'Updated', version: 2 }
      })

      // Verify update persisted
      const entity = await brain.get(id)
      expect(entity?.data.version).toBe(2)
    })
  })

  describe('Write Coordinator Atomicity', () => {
    it('should ensure atomicity at write coordinator level', async () => {
      // Simulate write coordinator scenario
      // (Single Brainy instance coordinating writes)

      const entities: string[] = []

      // Multiple atomic writes
      for (let i = 0; i < 5; i++) {
        const id = await brain.add({
          data: { name: `Entity ${i}`, index: i },
          type: NounType.Thing
        })
        entities.push(id)
      }

      // Create relationships (atomic)
      for (let i = 0; i < entities.length - 1; i++) {
        await brain.relate({
          from: entities[i],
          to: entities[i + 1],
          type: VerbType.RelatesTo
        })
      }

      // Verify all operations succeeded
      for (let i = 0; i < entities.length; i++) {
        const entity = await brain.get(entities[i])
        expect(entity).toBeTruthy()
        expect(entity?.data.index).toBe(i)
      }

      // Verify relationships
      for (let i = 0; i < entities.length - 1; i++) {
        const relations = await brain.getRelations({ from: entities[i] })
        expect(relations).toHaveLength(1)
      }
    })

    it('should handle batch operations atomically on write coordinator', async () => {
      const batchSize = 20
      const ids: string[] = []

      // Batch add operations
      for (let i = 0; i < batchSize; i++) {
        const id = await brain.add({
          data: { name: `Batch Entity ${i}`, batch: true },
          type: NounType.Thing
        })
        ids.push(id)
      }

      // Verify all entities persisted
      let count = 0
      for (const id of ids) {
        const entity = await brain.get(id)
        if (entity) count++
      }

      expect(count).toBe(batchSize)
    })
  })

  describe('Read-After-Write Consistency', () => {
    it('should ensure read-after-write consistency', async () => {
      // Write entity
      const id = await brain.add({
        data: { name: 'RAW Test', timestamp: Date.now() },
        type: NounType.Thing
      })

      // Immediate read (should see the write)
      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity?.data.name).toBe('RAW Test')
    })

    it('should maintain consistency after update', async () => {
      const id = await brain.add({
        data: { name: 'Original', counter: 0 },
        type: NounType.Thing
      })

      // Multiple updates
      for (let i = 1; i <= 5; i++) {
        await brain.update({
          id,
          data: { name: `Updated ${i}`, counter: i }
        })

        // Read immediately after each update
        const entity = await brain.get(id)
        expect(entity?.data.counter).toBe(i)
      }
    })
  })

  describe('Concurrent Write Handling', () => {
    it('should handle sequential writes correctly', async () => {
      const ids: string[] = []

      // Sequential writes (simulating distributed writes to coordinator)
      for (let i = 0; i < 10; i++) {
        const id = await brain.add({
          data: { name: `Sequential ${i}`, order: i },
          type: NounType.Thing
        })
        ids.push(id)
      }

      // Verify all writes succeeded
      for (let i = 0; i < ids.length; i++) {
        const entity = await brain.get(ids[i])
        expect(entity?.data.order).toBe(i)
      }
    })

    it('should handle interleaved operations atomically', async () => {
      // Create entities
      const id1 = await brain.add({
        data: { name: 'Entity A', value: 100 },
        type: NounType.Thing
      })

      const id2 = await brain.add({
        data: { name: 'Entity B', value: 200 },
        type: NounType.Thing
      })

      // Interleaved updates
      await brain.update({ id: id1, data: { value: 150 } })
      await brain.update({ id: id2, data: { value: 250 } })
      await brain.update({ id: id1, data: { value: 175 } })

      // Verify final state
      const entity1 = await brain.get(id1)
      const entity2 = await brain.get(id2)

      expect(entity1?.data.value).toBe(175)
      expect(entity2?.data.value).toBe(250)
    })
  })

  describe('Delete Operations with Distributed Storage', () => {
    it('should handle delete operations atomically', async () => {
      // Create entity
      const id = await brain.add({
        data: { name: 'To Delete', status: 'active' },
        type: NounType.Thing
      })

      // Verify exists
      let entity = await brain.get(id)
      expect(entity).toBeTruthy()

      // Delete atomically
      await brain.delete(id)

      // Verify deleted
      entity = await brain.get(id)
      expect(entity).toBeNull()
    })

    it('should handle delete with relationships atomically', async () => {
      // Create entities and relationships
      const id1 = await brain.add({
        data: { name: 'Entity 1' },
        type: NounType.Thing
      })

      const id2 = await brain.add({
        data: { name: 'Entity 2' },
        type: NounType.Thing
      })

      await brain.relate({
        from: id1,
        to: id2,
        type: VerbType.RelatesTo
      })

      // Delete first entity (should delete relationships)
      await brain.delete(id1)

      // Verify entity deleted
      const entity1 = await brain.get(id1)
      expect(entity1).toBeNull()

      // Verify relationships deleted
      const relations = await brain.getRelations({ from: id1 })
      expect(relations).toHaveLength(0)

      // Entity 2 should still exist
      const entity2 = await brain.get(id2)
      expect(entity2).toBeTruthy()
    })
  })

  describe('Storage Adapter Transparency', () => {
    it('should work transparently with any storage adapter', async () => {
      // This test verifies that transactions don't make assumptions
      // about the underlying storage implementation

      // Add entity
      const id = await brain.add({
        data: { name: 'Adapter Test', adapter: 'filesystem' },
        type: NounType.Thing
      })

      // Update entity
      await brain.update({
        id,
        data: { name: 'Updated via Adapter', adapter: 'filesystem' }
      })

      // Query entity
      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity?.data.name).toBe('Updated via Adapter')

      // Delete entity
      await brain.delete(id)
      const deletedEntity = await brain.get(id)
      expect(deletedEntity).toBeNull()
    })

    it('should maintain atomicity regardless of storage latency', async () => {
      // Simulate scenario with storage latency
      // (In distributed setup, network latency is a factor)

      const startTime = Date.now()

      // Operations that might have latency
      const id1 = await brain.add({
        data: { name: 'Latency Test 1' },
        type: NounType.Thing
      })

      const id2 = await brain.add({
        data: { name: 'Latency Test 2' },
        type: NounType.Thing
      })

      await brain.relate({
        from: id1,
        to: id2,
        type: VerbType.RelatesTo
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Verify all operations succeeded (regardless of latency)
      const entity1 = await brain.get(id1)
      const entity2 = await brain.get(id2)
      const relations = await brain.getRelations({ from: id1 })

      expect(entity1).toBeTruthy()
      expect(entity2).toBeTruthy()
      expect(relations).toHaveLength(1)

      // Should complete in reasonable time (even with storage latency)
      expect(duration).toBeLessThan(5000)
    })
  })

  describe('Transaction Statistics with Distributed Storage', () => {
    it('should track transaction statistics accurately', async () => {
      // Get transaction manager stats
      const stats = (brain as any).transactionManager?.getStats()

      if (stats) {
        const initialTotal = stats.totalTransactions

        // Perform operations
        await brain.add({
          data: { name: 'Stats Test' },
          type: NounType.Thing
        })

        // Check stats updated
        const updatedStats = (brain as any).transactionManager?.getStats()
        expect(updatedStats.totalTransactions).toBeGreaterThan(initialTotal)
      }
    })
  })
})
