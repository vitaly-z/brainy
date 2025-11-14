/**
 * Duplicate Relationship Check Optimization Tests
 *
 * Tests for v5.8.0 optimization that uses GraphAdjacencyIndex
 * for O(log n) duplicate detection instead of O(n) storage scan.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { NounType, VerbType } from '../../../src/types/graphTypes.js'

describe('Duplicate Check Optimization', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy()
    await brain.init()
  })

  afterEach(async () => {
    // Cleanup is automatic with memory storage
  })

  it('should detect duplicate relationships using GraphAdjacencyIndex', async () => {
    // Create two entities
    const personId = await brain.add({
      data: { name: 'Alice' },
      type: NounType.Person
    })

    const orgId = await brain.add({
      data: { name: 'Acme Corp' },
      type: NounType.Organization
    })

    // Create first relationship
    const relationId1 = await brain.relate({
      from: personId,
      to: orgId,
      type: VerbType.ParticipatesIn
    })

    // Attempt to create duplicate relationship
    const relationId2 = await brain.relate({
      from: personId,
      to: orgId,
      type: VerbType.ParticipatesIn
    })

    // Should return the same ID (duplicate detected)
    expect(relationId2).toBe(relationId1)

    // Verify only one relationship exists
    const relations = await brain.getRelations({ from: personId })
    expect(relations).toHaveLength(1)
    expect(relations[0].id).toBe(relationId1)
  })

  it('should allow different relationship types between same entities', async () => {
    const personId = await brain.add({
      data: { name: 'Bob' },
      type: NounType.Person
    })

    const projectId = await brain.add({
      data: { name: 'Project X' },
      type: NounType.Thing
    })

    // Create first relationship
    const relationId1 = await brain.relate({
      from: personId,
      to: projectId,
      type: VerbType.Creates
    })

    // Create second relationship with different type (not a duplicate)
    const relationId2 = await brain.relate({
      from: personId,
      to: projectId,
      type: VerbType.Modifies
    })

    // Should be different IDs (different verb types)
    expect(relationId2).not.toBe(relationId1)

    // Verify both relationships exist
    const relations = await brain.getRelations({ from: personId })
    expect(relations).toHaveLength(2)
    // Both relations should exist with different IDs
    const relationIds = relations.map(r => r.id)
    expect(relationIds).toContain(relationId1)
    expect(relationIds).toContain(relationId2)
  })

  it('should handle duplicate check with many relationships (performance)', async () => {
    // Create source entity
    const sourceId = await brain.add({
      data: { name: 'Hub Entity' },
      type: NounType.Thing
    })

    // Create 50 target entities and relationships
    const targetIds: string[] = []
    for (let i = 0; i < 50; i++) {
      const targetId = await brain.add({
        data: { name: `Target ${i}` },
        type: NounType.Thing
      })
      targetIds.push(targetId)

      await brain.relate({
        from: sourceId,
        to: targetId,
        type: VerbType.RelatesTo
      })
    }

    // Now attempt to create duplicate with first target (should be fast with GraphIndex)
    const startTime = performance.now()
    const duplicateId = await brain.relate({
      from: sourceId,
      to: targetIds[0],
      type: VerbType.RelatesTo
    })
    const elapsed = performance.now() - startTime

    // Should be fast with O(log n) GraphIndex lookup (< 10ms even with 50 relationships)
    expect(elapsed).toBeLessThan(10)

    // Verify duplicate was detected
    const relations = await brain.getRelations({ from: sourceId })
    expect(relations).toHaveLength(50) // No duplicate created
  })

  it('should use cached verb data for duplicate check', async () => {
    const entityA = await brain.add({
      data: { name: 'Entity A' },
      type: NounType.Thing
    })

    const entityB = await brain.add({
      data: { name: 'Entity B' },
      type: NounType.Thing
    })

    // Create relationship
    const relationId1 = await brain.relate({
      from: entityA,
      to: entityB,
      type: VerbType.RelatesTo
    })

    // Access GraphIndex to ensure verb is cached
    const verbIds = await (brain as any).graphIndex.getVerbIdsBySource(entityA)
    expect(verbIds).toContain(relationId1)

    // Attempt duplicate (should use cached verb)
    const startTime = performance.now()
    const relationId2 = await brain.relate({
      from: entityA,
      to: entityB,
      type: VerbType.RelatesTo
    })
    const elapsed = performance.now() - startTime

    // Should be very fast with cached verb (< 5ms)
    expect(elapsed).toBeLessThan(5)
    expect(relationId2).toBe(relationId1)
  })

  it('should handle duplicate check across multiple verb types efficiently', async () => {
    const person = await brain.add({
      data: { name: 'Charlie' },
      type: NounType.Person
    })

    const org = await brain.add({
      data: { name: 'BigCorp' },
      type: NounType.Organization
    })

    // Create different relationship types
    const rel1 = await brain.relate({
      from: person,
      to: org,
      type: VerbType.Affects
    })

    const rel2 = await brain.relate({
      from: person,
      to: org,
      type: VerbType.Owns
    })

    // Verify both relationships exist
    let relations = await brain.getRelations({ from: person })
    expect(relations).toHaveLength(2)
    const relationIds = relations.map(r => r.id)
    expect(relationIds).toContain(rel1)
    expect(relationIds).toContain(rel2)

    // Attempt duplicate of first relationship type
    const startTime = performance.now()
    const duplicate = await brain.relate({
      from: person,
      to: org,
      type: VerbType.Affects
    })
    const elapsed = performance.now() - startTime

    // Should detect duplicate efficiently (< 20ms)
    expect(elapsed).toBeLessThan(20)
    expect(duplicate).toBe(rel1)

    // Verify still same number of relationships (no duplicate added)
    const finalRelations = await brain.getRelations({ from: person })
    expect(finalRelations.length).toBe(relations.length)
  })
})
