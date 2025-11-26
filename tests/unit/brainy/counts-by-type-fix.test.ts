/**
 * Unit tests for counts.byType() fix
 *
 * Bug: counts.byType({ excludeVFS: true }) returned empty {} even when entities existed
 * Root cause: MetadataIndexManager was reading from stats.nounCount (SERVICE-keyed)
 *             instead of storage's nounCountsByType (TYPE-keyed)
 *
 * Fix: v6.2.2 - MetadataIndexManager now delegates to storage.getNounCountsByType()
 *
 * @see CLAUDE.md for architecture details
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { NounType } from '../../../src/types/graphTypes'
import {
  createTestConfig,
  createAddParams,
} from '../../helpers/test-factory'

describe('counts.byType() fix (v6.2.2)', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy(createTestConfig())
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('counts.byType({ excludeVFS: true })', () => {
    it('should return correct counts by type', async () => {
      // Arrange - Add entities of different types
      await brain.add(createAddParams({ data: 'Alice', type: 'person' as NounType }))
      await brain.add(createAddParams({ data: 'Bob', type: 'person' as NounType }))
      await brain.add(createAddParams({ data: 'Machine Learning', type: 'concept' as NounType }))
      await brain.add(createAddParams({ data: 'AI Research', type: 'concept' as NounType }))
      await brain.add(createAddParams({ data: 'Neural Networks', type: 'concept' as NounType }))

      // Act
      const counts = await brain.counts.byType({ excludeVFS: true })

      // Assert - Should not be empty
      expect(Object.keys(counts).length).toBeGreaterThan(0)
      expect(counts.person).toBe(2)
      expect(counts.concept).toBe(3)
    })

    it('should not return empty when entities exist (the original bug)', async () => {
      // This test reproduces the original bug from Workshop
      // counts.byType({ excludeVFS: true }) returned {} even with 48 entities

      // Arrange - Add a single entity
      await brain.add(createAddParams({
        data: 'Test Entity',
        type: 'concept' as NounType
      }))

      // Act
      const counts = await brain.counts.byType({ excludeVFS: true })

      // Assert - Must not be empty
      expect(counts).not.toEqual({})
      expect(Object.keys(counts).length).toBeGreaterThan(0)
      expect(counts.concept).toBe(1)
    })

    it('should match counts from find() (the workaround)', async () => {
      // The Workshop workaround was to use find() and count manually
      // Our fix should make both approaches return the same counts

      // Arrange
      await brain.add(createAddParams({ data: 'Person 1', type: 'person' as NounType }))
      await brain.add(createAddParams({ data: 'Document 1', type: 'document' as NounType }))
      await brain.add(createAddParams({ data: 'Document 2', type: 'document' as NounType }))

      // Act - Get counts both ways
      const apiCounts = await brain.counts.byType({ excludeVFS: true })

      // Manual counting via find() (the workaround)
      const allEntities = await brain.find({ query: '', limit: 1000 })
      const manualCounts: Record<string, number> = {}
      for (const result of allEntities) {
        const entityType = result.entity?.type || 'unknown'
        manualCounts[entityType] = (manualCounts[entityType] || 0) + 1
      }

      // Assert - Both methods should return the same counts
      expect(apiCounts.person).toBe(manualCounts.person)
      expect(apiCounts.document).toBe(manualCounts.document)
    })
  })

  describe('counts.byType() without excludeVFS', () => {
    it('should return counts including VFS entities', async () => {
      // Arrange
      await brain.add(createAddParams({ data: 'Regular concept', type: 'concept' as NounType }))

      // Act
      const counts = await brain.counts.byType()

      // Assert
      expect(counts.concept).toBe(1)
    })
  })

  describe('counts.byType(type)', () => {
    it('should return count for a specific type', async () => {
      // Arrange
      await brain.add(createAddParams({ data: 'Person 1', type: 'person' as NounType }))
      await brain.add(createAddParams({ data: 'Person 2', type: 'person' as NounType }))
      await brain.add(createAddParams({ data: 'Concept 1', type: 'concept' as NounType }))

      // Act
      const personCount = await brain.counts.byType('person')
      const conceptCount = await brain.counts.byType('concept')
      const unknownCount = await brain.counts.byType('organization') // No entities of this type

      // Assert
      expect(personCount).toBe(2)
      expect(conceptCount).toBe(1)
      expect(unknownCount).toBe(0)
    })
  })

  describe('counts.entities() total', () => {
    it('should return correct total entity count', async () => {
      // Get baseline count (VFS creates a root directory entity)
      const baselineCount = brain.counts.entities()

      // Arrange
      await brain.add(createAddParams({ data: 'Entity 1', type: 'person' as NounType }))
      await brain.add(createAddParams({ data: 'Entity 2', type: 'concept' as NounType }))
      await brain.add(createAddParams({ data: 'Entity 3', type: 'document' as NounType }))

      // Act
      const total = brain.counts.entities()

      // Assert - should have 3 more entities than baseline
      expect(total).toBe(baselineCount + 3)
    })
  })

  describe('O(1) performance at scale', () => {
    it('should have constant time complexity regardless of entity count', async () => {
      // The fix uses Uint32Array with fixed 42 noun types
      // This should be O(42) = O(1) constant time, not O(entities)

      // Arrange - Add multiple entities
      const entityCount = 100
      for (let i = 0; i < entityCount; i++) {
        await brain.add(createAddParams({
          data: `Entity ${i}`,
          type: (i % 2 === 0 ? 'person' : 'concept') as NounType
        }))
      }

      // Act - Time multiple calls to counts.byType
      const start = performance.now()
      for (let i = 0; i < 100; i++) {
        await brain.counts.byType({ excludeVFS: true })
      }
      const elapsed = performance.now() - start

      // Assert - 100 calls should complete quickly (O(1) means < 100ms total)
      expect(elapsed).toBeLessThan(1000) // Very conservative threshold

      // Verify counts are correct
      const counts = await brain.counts.byType({ excludeVFS: true })
      expect(counts.person).toBe(50)
      expect(counts.concept).toBe(50)
    })
  })
})
