/**
 * Read-After-Write Consistency Integration Tests (v5.7.2)
 *
 * These tests verify the fix for the critical v5.7.x bug where:
 * - brain.add() would create an entity
 * - brain.relate() would immediately try to verify the entity exists
 * - brain.get() would return null (entity not yet queryable)
 * - Error thrown: "Source entity 19f3f6dd-2102-4b60-956c-bfc1d8213838 not found"
 *
 * The write-through cache in BaseStorage now guarantees that entities are
 * immediately queryable after add() returns, fixing this race condition.
 *
 * Test Coverage:
 * - brain.add() → brain.get() (basic read-after-write)
 * - brain.add() → brain.relate() (the actual bug scenario)
 * - Rapid entity creation + relationship creation (import workflow)
 * - Update then read
 * - Delete then verify deleted
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { rmSync } from 'fs'

describe('Read-After-Write Consistency (v5.7.2 Bug Fix)', () => {
  let brain: Brainy
  let testDir: string

  beforeEach(async () => {
    // Create unique test directory for each test
    testDir = join(tmpdir(), `brainy-consistency-${Date.now()}-${Math.random().toString(36).substring(7)}`)

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        config: {
          baseDir: testDir,
          enableCompression: false // Faster tests
        }
      },
      dimensions: 384
    })

    await brain.init()
  })

  afterEach(async () => {
    // Cleanup
    try {
      await brain.close()
    } catch (err) {
      // Ignore close errors
    }

    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  it('should allow brain.add() followed by immediate brain.get()', async () => {
    // This tests the core read-after-write guarantee
    const entityId = await brain.add({
      data: 'Test Entity for Immediate Read',
      type: NounType.Thing
    })

    // Immediately query - should NOT return null
    const entity = await brain.get(entityId)

    expect(entity).not.toBeNull()
    expect(entity?.id).toBe(entityId)
    expect(entity?.data).toBe('Test Entity for Immediate Read')
    expect(entity?.type).toBe(NounType.Thing)
  })

  it('should allow brain.add() followed by immediate brain.relate() - THE BUG FIX', async () => {
    // This is the EXACT bug scenario from the v5.7.x report
    // ImportCoordinator would:
    // 1. Create an entity with brain.add()
    // 2. Immediately create a provenance link with brain.relate()
    // 3. brain.relate() calls brain.get() to verify entities exist
    // 4. brain.get() would return null → "Source entity not found" error

    const sourceId = await brain.add({
      data: 'Source Document',
      type: NounType.Document,
      metadata: { filename: 'test.pdf' }
    })

    const targetId = await brain.add({
      data: 'Extracted Entity',
      type: NounType.Thing,
      metadata: { extractedFrom: 'test.pdf' }
    })

    // This should NOT throw "Source entity not found" or "Target entity not found"
    // The write-through cache ensures both entities are immediately queryable
    const relationId = await brain.relate({
      from: sourceId,
      to: targetId,
      type: VerbType.Contains,
      metadata: {
        relationshipType: 'provenance',
        evidence: 'Extracted from test.pdf'
      }
    })

    expect(relationId).toBeTruthy()
    expect(typeof relationId).toBe('string')

    // Verify relationship exists and is correct
    const relations = await brain.getRelations(sourceId)
    expect(relations).toHaveLength(1)
    expect(relations[0].to).toBe(targetId)
    expect(relations[0].type).toBe(VerbType.Contains)
  })

  it('should handle rapid entity creation + relationship creation (import scenario)', async () => {
    // Simulate the import workflow from the bug report:
    // - Extract 372 entities from PDF
    // - Create entities rapidly
    // - Create provenance relationships immediately after
    // - v5.7.x would fail with "Source entity not found"

    const documentId = await brain.add({
      data: 'Test PDF Document',
      type: NounType.Document,
      metadata: { filename: 'large-import.pdf', pages: 50 }
    })

    const entityIds: string[] = []
    const startTime = Date.now()

    // Create 100 entities rapidly (simulates extraction phase)
    for (let i = 0; i < 100; i++) {
      const entityId = await brain.add({
        data: `Entity ${i} extracted from PDF`,
        type: NounType.Thing,
        metadata: {
          entityIndex: i,
          extractedFrom: 'large-import.pdf',
          page: Math.floor(i / 2) + 1
        }
      })
      entityIds.push(entityId)
    }

    console.log(`Created 100 entities in ${Date.now() - startTime}ms`)

    // Create provenance relationships immediately after entity creation
    // This is where v5.7.x would fail
    const relStartTime = Date.now()
    for (let i = 0; i < entityIds.length; i++) {
      await brain.relate({
        from: documentId,
        to: entityIds[i],
        type: VerbType.Contains,
        metadata: {
          relationshipType: 'provenance',
          extractionOrder: i
        }
      })
    }

    console.log(`Created 100 relationships in ${Date.now() - relStartTime}ms`)

    // Verify all relationships created successfully
    const relations = await brain.getRelations(documentId)
    expect(relations.length).toBe(100)

    // Verify each entity is still queryable
    for (const id of entityIds) {
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity?.id).toBe(id)
    }
  })

  it('should support read-after-update', async () => {
    // Create entity
    const entityId = await brain.add({
      data: 'Original Data',
      type: NounType.Thing,
      metadata: { version: 1 }
    })

    // Update immediately
    await brain.update({
      id: entityId,
      metadata: { version: 2, updated: true }
    })

    // Read immediately - should see updated data
    const entity = await brain.get(entityId)
    expect(entity).not.toBeNull()
    expect(entity?.metadata?.version).toBe(2)
    expect(entity?.metadata?.updated).toBe(true)
  })

  it('should verify entity is deleted after brain.delete()', async () => {
    // Create entity
    const entityId = await brain.add({
      data: 'Entity to be deleted',
      type: NounType.Thing
    })

    // Verify it exists
    const beforeDelete = await brain.get(entityId)
    expect(beforeDelete).not.toBeNull()

    // Delete
    await brain.delete(entityId)

    // Verify it's deleted (should return null)
    const afterDelete = await brain.get(entityId)
    expect(afterDelete).toBeNull()
  })

  it('should handle complex relationship graph creation', async () => {
    // Create a complex graph:
    // Document → contains → Concept1
    //                    → Concept2
    //                    → Concept3
    // Concept1 → relatedTo → Concept2
    // Concept2 → relatedTo → Concept3
    // All created in rapid succession

    const documentId = await brain.add({
      data: 'Complex Document',
      type: NounType.Document
    })

    const concept1Id = await brain.add({
      data: 'Concept 1',
      type: NounType.Concept
    })

    const concept2Id = await brain.add({
      data: 'Concept 2',
      type: NounType.Concept
    })

    const concept3Id = await brain.add({
      data: 'Concept 3',
      type: NounType.Concept
    })

    // Create containment relationships
    await brain.relate({ from: documentId, to: concept1Id, type: VerbType.Contains })
    await brain.relate({ from: documentId, to: concept2Id, type: VerbType.Contains })
    await brain.relate({ from: documentId, to: concept3Id, type: VerbType.Contains })

    // Create concept relationships
    await brain.relate({ from: concept1Id, to: concept2Id, type: VerbType.RelatedTo })
    await brain.relate({ from: concept2Id, to: concept3Id, type: VerbType.RelatedTo })

    // Verify all relationships exist
    const docRelations = await brain.getRelations(documentId)
    expect(docRelations.length).toBe(3)

    const concept1Relations = await brain.getRelations(concept1Id)
    expect(concept1Relations.length).toBeGreaterThan(0)

    const concept2Relations = await brain.getRelations(concept2Id)
    expect(concept2Relations.length).toBeGreaterThan(0)
  })

  it('should handle the exact v5.7.x bug scenario with UUID from report', async () => {
    // The bug report mentioned entity ID: 19f3f6dd-2102-4b60-956c-bfc1d8213838
    // Let's use our own UUIDs but replicate the exact sequence

    // Step 1: PDF import creates document entity
    const documentId = await brain.add({
      data: 'TfT~Sapient Species.pdf',
      type: NounType.Document,
      metadata: {
        filename: 'TfT~Sapient Species.pdf',
        size: 2036.8 * 1024,
        format: 'pdf'
      }
    })

    // Step 2: Extract 372 entities (we'll do 10 for speed)
    const extractedIds: string[] = []
    for (let i = 0; i < 10; i++) {
      const id = await brain.add({
        data: `Species ${i}`,
        type: NounType.Thing,
        metadata: {
          extractedFrom: 'TfT~Sapient Species.pdf',
          entityIndex: i
        }
      })
      extractedIds.push(id)
    }

    // Step 3: VFSStructureGenerator creates provenance links
    // This is where "Source entity not found" would occur
    for (const entityId of extractedIds) {
      const relationId = await brain.relate({
        from: documentId,
        to: entityId,
        type: VerbType.Contains,
        metadata: {
          relationshipType: 'provenance',
          evidence: 'Extracted from PDF'
        }
      })
      expect(relationId).toBeTruthy()
    }

    // Step 4: Verify all entities are queryable
    const doc = await brain.get(documentId)
    expect(doc).not.toBeNull()

    for (const id of extractedIds) {
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity?.id).toBe(id)
    }

    // Step 5: Verify relationships exist
    const relations = await brain.getRelations(documentId)
    expect(relations.length).toBe(10)
  })
})
