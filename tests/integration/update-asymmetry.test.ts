/**
 * Update Field Asymmetry Regression Tests (v7.5.0)
 *
 * Tests for the critical bug where update() didn't remove all indexed fields,
 * causing 7 fields to accumulate on EVERY update. This eventually made queries
 * return 0 results (77x overcounting at scale).
 *
 * Root cause: removalMetadata only contained custom metadata + type, while
 * entityForIndexing contained ALL indexed fields (confidence, weight, createdAt,
 * updatedAt, service, data, createdBy).
 *
 * NO MOCKS - Real integration tests with actual storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import * as fs from 'fs/promises'

describe('Update Field Asymmetry Fix (v7.5.0)', () => {
  let brain: Brainy
  const testPath = './test-brainy-update-asymmetry'

  beforeEach(async () => {
    // Clean up test directory thoroughly
    try {
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {
      // Ignore if doesn't exist
    }

    // Create fresh Brainy instance
    brain = new Brainy({
      storage: { type: 'filesystem', path: testPath },
      silent: true
    })
    await brain.init()
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Query Accuracy After Updates', () => {
    it('should return correct results from find() by type after many updates', async () => {
      // Create entity with specific type
      const id = await brain.add({
        data: 'Findable Entity',
        type: NounType.Person,
        metadata: { name: 'Alice' }
      })

      // Update 20 times with changing metadata
      for (let i = 0; i < 20; i++) {
        await brain.update({
          id,
          metadata: { name: 'Alice', updateCount: i }
        })
      }

      await brain.flush()

      // find() by type should still return the entity
      // (this would fail if index corruption caused overcounting)
      // Note: 'type' is a top-level param, not inside 'where'
      const byType = await brain.find({
        type: NounType.Person
      })

      expect(byType.length).toBeGreaterThanOrEqual(1)
      const found = byType.find(r => r.id === id)
      expect(found).toBeDefined()
      expect(found?.id).toBe(id)
    })

    it('should return correct results from find() by metadata after many updates', async () => {
      // Create entity with specific metadata
      const id = await brain.add({
        data: 'Searchable Entity',
        type: NounType.Document,
        metadata: { category: 'important', status: 'active' }
      })

      // Update 20 times - changing some fields but keeping 'category'
      for (let i = 0; i < 20; i++) {
        await brain.update({
          id,
          metadata: { category: 'important', status: 'active', version: i }
        })
      }

      await brain.flush()

      // find() by metadata should still work
      const results = await brain.find({
        where: { category: 'important' }
      })

      expect(results.length).toBeGreaterThanOrEqual(1)
      const found = results.find(r => r.id === id)
      expect(found).toBeDefined()
    })

    it('should not return duplicate results after multiple updates', async () => {
      // Create 3 entities
      const ids: string[] = []
      for (let i = 0; i < 3; i++) {
        const id = await brain.add({
          data: `Entity ${i}`,
          type: NounType.Document,
          metadata: { group: 'test-group', index: i }
        })
        ids.push(id)
      }

      // Update each entity 10 times
      for (const id of ids) {
        for (let i = 0; i < 10; i++) {
          await brain.update({
            id,
            metadata: { group: 'test-group', version: i }
          })
        }
      }

      await brain.flush()

      // find() should return entities without duplicates
      const results = await brain.find({
        where: { group: 'test-group' }
      })

      // Get unique IDs from results
      const uniqueIds = new Set(results.map(r => r.id))

      // Should have exactly 3 unique entities
      expect(uniqueIds.size).toBe(3)
      // No duplicates - results length should equal unique count
      expect(results.length).toBe(uniqueIds.size)
    })
  })

  describe('Entity Integrity After Updates', () => {
    it('should preserve entity data after many updates', async () => {
      // Create entity
      const id = await brain.add({
        data: 'Original Data',
        type: NounType.Event,
        metadata: { title: 'Original Title' }
      })

      const originalEntity = await brain.get(id)
      const originalCreatedAt = originalEntity?.createdAt

      // Update 15 times
      for (let i = 0; i < 15; i++) {
        await brain.update({
          id,
          metadata: { title: `Updated Title ${i}`, iteration: i }
        })
      }

      await brain.flush()

      // Get final entity
      const finalEntity = await brain.get(id)

      // Entity should still exist and be retrievable
      expect(finalEntity).toBeDefined()
      expect(finalEntity?.id).toBe(id)

      // Original data should be preserved
      expect(finalEntity?.data).toBe('Original Data')
      expect(finalEntity?.type).toBe(NounType.Event)
      expect(finalEntity?.createdAt).toBe(originalCreatedAt)

      // Updated metadata should be reflected
      expect(finalEntity?.metadata?.title).toBe('Updated Title 14')
      expect(finalEntity?.metadata?.iteration).toBe(14)

      // updatedAt should have changed
      expect(finalEntity?.updatedAt).not.toBe(originalCreatedAt)
    })

    it('should handle rapid consecutive updates', async () => {
      // Create entity
      const id = await brain.add({
        data: 'Rapid Update Test',
        type: NounType.Task,
        metadata: { status: 'pending' }
      })

      // Rapid-fire 50 updates without waiting
      const updatePromises = []
      for (let i = 0; i < 50; i++) {
        updatePromises.push(
          brain.update({
            id,
            metadata: { status: 'processing', step: i }
          })
        )
      }

      // Wait for all updates to complete
      await Promise.all(updatePromises)
      await brain.flush()

      // Entity should still be findable and correct
      const entity = await brain.get(id)
      expect(entity).toBeDefined()
      expect(entity?.type).toBe(NounType.Task)

      // Should be findable by type
      // Note: 'type' is a top-level param, not inside 'where'
      const results = await brain.find({
        type: NounType.Task
      })
      expect(results.some(r => r.id === id)).toBe(true)
    })
  })
})
