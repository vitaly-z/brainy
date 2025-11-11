import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { VerbType } from '../../src/types/graphTypes.js'

/**
 * Regression test for v5.7.0 deadlock bug
 *
 * BUG DESCRIPTION:
 * v5.7.0 introduced a circular dependency deadlock during GraphAdjacencyIndex initialization:
 * - GraphAdjacencyIndex.rebuild() calls storage.getVerbs()
 * - storage.getVerbsBySource_internal() calls getGraphIndex()
 * - getGraphIndex() is waiting for rebuild() to complete
 * - DEADLOCK: Each waits for the other
 *
 * SYMPTOMS:
 * - ALL imports hang at "Reading Data Structure" stage
 * - brain.add() operations take 12+ seconds per entity (50x slower)
 * - No errors thrown - infinite wait
 * - Process continues (heartbeats) but makes no progress
 *
 * FIX (v5.7.1):
 * Reverted storage internals (getVerbsBySource_internal, getVerbsByTarget_internal)
 * to v5.6.3 implementation - no getGraphIndex() calls from storage layer.
 *
 * TEST STRATEGY:
 * 1. Create entities with relationships (triggers GraphAdjacencyIndex lazy init)
 * 2. Force rebuild by accessing graph operations
 * 3. Verify completes in <1 second (not 760+ seconds)
 */
describe('v5.7.0 Deadlock Regression', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
  })

  it('should not deadlock during GraphAdjacencyIndex rebuild with existing verbs', async () => {
    // Create 10 entities
    const entities = []
    for (let i = 0; i < 10; i++) {
      const id = await brain.add({
        data: `Entity ${i}`,
        type: 'thing',
        metadata: { index: i }
      })
      entities.push(id)
    }

    // Create relationships between them (triggers GraphAdjacencyIndex)
    for (let i = 0; i < 9; i++) {
      await brain.relate({
        from: entities[i],
        to: entities[i + 1],
        type: VerbType.RelatedTo
      })
    }

    // This should complete in <1 second (not hang forever)
    const start = Date.now()

    // Force GraphAdjacencyIndex usage by querying relationships
    const relations = await brain.getRelations({ from: entities[0] })

    const elapsed = Date.now() - start

    // Verify no deadlock
    expect(elapsed).toBeLessThan(1000)
    expect(relations.length).toBeGreaterThan(0)
  })

  it('should handle imports without 12+ second delays per entity', async () => {
    // Simulate import workflow (like Workshop Excel import)
    const start = Date.now()

    // Import 5 entities with relationships
    const importedEntities = []
    for (let i = 0; i < 5; i++) {
      const id = await brain.add({
        data: `Imported Entity ${i}`,
        type: 'person',
        metadata: {
          importId: 'test-import-001',
          sourceRow: i
        }
      })
      importedEntities.push(id)
    }

    // Add relationships
    for (let i = 0; i < 4; i++) {
      await brain.relate({
        from: importedEntities[i],
        to: importedEntities[i + 1],
        type: VerbType.Knows
      })
    }

    const elapsed = Date.now() - start

    // In v5.7.0, this took 12+ seconds per entity (60+ seconds total)
    // In v5.7.1, should complete in <5 seconds for 5 entities
    expect(elapsed).toBeLessThan(5000)

    // Verify all entities were created
    for (const id of importedEntities) {
      const entity = await brain.get(id)
      expect(entity).toBeDefined()
    }
  })

  it('should allow GraphAdjacencyIndex rebuild without circular dependency', async () => {
    // Create initial data
    const entity1 = await brain.add({ data: 'Node A', type: 'thing' })
    const entity2 = await brain.add({ data: 'Node B', type: 'thing' })
    const entity3 = await brain.add({ data: 'Node C', type: 'thing' })

    await brain.relate({ from: entity1, to: entity2, type: VerbType.RelatedTo })
    await brain.relate({ from: entity2, to: entity3, type: VerbType.RelatedTo })

    // Accessing storage internals should not cause deadlock
    // GraphAdjacencyIndex initialization should complete successfully
    const start = Date.now()

    // This would trigger initialization if not already done
    const relations = await brain.getRelations({ from: entity1 })

    const elapsed = Date.now() - start

    // Should be fast (no deadlock, no 12s delays)
    expect(elapsed).toBeLessThan(500)
    expect(relations).toHaveLength(1)
    expect(relations[0].to).toBe(entity2)
  })

  it('should handle multiple concurrent adds without deadlock', async () => {
    // Simulate concurrent entity creation (like batch import)
    const start = Date.now()

    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        brain.add({
          data: `Concurrent Entity ${i}`,
          type: 'thing',
          metadata: { batch: true, index: i }
        })
      )
    }

    const ids = await Promise.all(promises)
    const elapsed = Date.now() - start

    // Should complete quickly (no 12s per entity delays)
    // 10 entities should take <2 seconds, not 120+ seconds
    expect(elapsed).toBeLessThan(2000)
    expect(ids).toHaveLength(10)
  })
})
