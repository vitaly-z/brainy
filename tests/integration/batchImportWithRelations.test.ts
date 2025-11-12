import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('Batch Import with Immediate Relations (v5.7.3 Fix)', () => {
  let brain: Brainy
  let testDir: string

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(process.cwd(), 'test-batch-relations-' + Date.now())
    fs.mkdirSync(testDir, { recursive: true })

    // Initialize brain
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
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  it('should create 372 entities and immediately query them for relationships (exact bug scenario)', async () => {
    // Simulate the exact PDF import scenario from bug report
    // 1. Create document entity (source)
    const documentId = await brain.add({
      data: 'TfT~Sapient Species.pdf',
      type: NounType.Document,
      metadata: {
        filename: 'TfT~Sapient Species.pdf',
        format: 'pdf'
      }
    })

    expect(documentId).toBeTruthy()

    // 2. Batch create 372 extracted entities (simulating entity extraction)
    const entityParams = Array(372).fill(null).map((_, i) => ({
      data: `Extracted Entity ${i}`,
      type: NounType.Thing,
      metadata: {
        extractedFrom: 'TfT~Sapient Species.pdf',
        entityNumber: i,
        confidence: 0.9
      }
    }))

    const addResult = await brain.addMany({
      items: entityParams,
      continueOnError: true
    })

    expect(addResult.successful.length).toBe(372)
    expect(addResult.failed.length).toBe(0)

    // 3. IMMEDIATELY create provenance links (this is where v5.7.0/v5.7.1/v5.7.2 failed)
    //    brain.relateMany() → brain.relate() → brain.get() must succeed
    const provenanceParams = addResult.successful.map(entityId => ({
      from: documentId,
      to: entityId,
      type: VerbType.Contains,
      metadata: {
        relationshipType: 'provenance',
        evidence: 'Extracted from PDF'
      }
    }))

    // THIS SHOULD NOT THROW "Source entity not found" error
    const relationIds = await brain.relateMany({
      items: provenanceParams,
      continueOnError: true
    })

    expect(relationIds.length).toBe(372)

    // 4. Verify all relationships exist (use higher limit to get all 372)
    const relationships = await brain.getRelations({ from: documentId, limit: 500 })
    expect(relationships.length).toBe(372)
  })

  it('should handle batch create + immediate single relate (simplified scenario)', async () => {
    // Create 100 entities in batch
    const entities = Array(100).fill(null).map((_, i) => ({
      data: `Entity ${i}`,
      type: NounType.Person,
      metadata: { index: i }
    }))

    const addResult = await brain.addMany({
      items: entities,
      continueOnError: true
    })

    expect(addResult.successful.length).toBe(100)

    // IMMEDIATELY try to relate first two entities (common pattern)
    const relationId = await brain.relate({
      from: addResult.successful[0],
      to: addResult.successful[1],
      type: VerbType.FriendOf
    })

    expect(relationId).toBeTruthy()

    // Verify relationship exists
    const relations = await brain.getRelations(addResult.successful[0])
    expect(relations.length).toBe(1)
    expect(relations[0].to).toBe(addResult.successful[1])
  })

  it('should handle concurrent batch operations with cross-batch relationships', async () => {
    // Create three batches in parallel
    const batch1 = Array(50).fill(null).map((_, i) => ({
      data: `Batch1-Entity${i}`,
      type: NounType.Document
    }))

    const batch2 = Array(50).fill(null).map((_, i) => ({
      data: `Batch2-Entity${i}`,
      type: NounType.Organization
    }))

    const batch3 = Array(50).fill(null).map((_, i) => ({
      data: `Batch3-Entity${i}`,
      type: NounType.Location
    }))

    // Create all batches concurrently
    const [result1, result2, result3] = await Promise.all([
      brain.addMany({ items: batch1, continueOnError: true }),
      brain.addMany({ items: batch2, continueOnError: true }),
      brain.addMany({ items: batch3, continueOnError: true })
    ])

    expect(result1.successful.length).toBe(50)
    expect(result2.successful.length).toBe(50)
    expect(result3.successful.length).toBe(50)

    // Immediately create cross-batch relationships
    const crossBatchRelations = []
    for (let i = 0; i < 10; i++) {
      crossBatchRelations.push({
        from: result1.successful[i],
        to: result2.successful[i],
        type: VerbType.RelatedTo
      })
      crossBatchRelations.push({
        from: result2.successful[i],
        to: result3.successful[i],
        type: VerbType.RelatedTo
      })
    }

    // THIS SHOULD NOT FAIL with "Source entity not found"
    const relationIds = await brain.relateMany({
      items: crossBatchRelations,
      continueOnError: true
    })

    expect(relationIds.length).toBe(20)
  })

  it('should ensure type cache is populated after addMany', async () => {
    // Create entities
    const entities = Array(100).fill(null).map((_, i) => ({
      data: `Test${i}`,
      type: NounType.Concept
    }))

    const addResult = await brain.addMany({
      items: entities,
      continueOnError: true
    })

    // Immediately query all entities (tests type cache population)
    for (const id of addResult.successful) {
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity?.type).toBe(NounType.Concept)
    }
  })

  it('should handle flush after batch operations', async () => {
    // Create entities
    const entities = Array(50).fill(null).map((_, i) => ({
      data: `FlushTest${i}`,
      type: NounType.Thing
    }))

    const addResult = await brain.addMany({
      items: entities,
      continueOnError: true
    })

    // Explicit flush (this is what ImportCoordinator does)
    await brain.flush()

    // After flush, write-through cache should be cleared but entities still queryable
    for (const id of addResult.successful) {
      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
    }
  })

  it('should handle VFS-style structure generation after batch import', async () => {
    // Simulate VFS structure generation workflow:
    // 1. Create root collection
    const rootId = await brain.add({
      data: 'Import Collection',
      type: NounType.Collection,
      metadata: { isRoot: true }
    })

    // 2. Batch create child entities
    const children = Array(100).fill(null).map((_, i) => ({
      data: `Child${i}`,
      type: NounType.Thing,
      metadata: { parentCollection: rootId }
    }))

    const addResult = await brain.addMany({
      items: children,
      continueOnError: true
    })

    // 3. IMMEDIATELY create hierarchical relationships (VFS tree structure)
    const hierarchyRelations = addResult.successful.map(childId => ({
      from: rootId,
      to: childId,
      type: VerbType.Contains,
      metadata: { hierarchyType: 'vfs-structure' }
    }))

    // THIS IS WHERE v5.7.0/v5.7.1/v5.7.2 FAILED
    const relationIds = await brain.relateMany({
      items: hierarchyRelations,
      continueOnError: true
    })

    expect(relationIds.length).toBe(100)

    // 4. Verify structure
    const childrenRelations = await brain.getRelations(rootId)
    expect(childrenRelations.length).toBe(100)
  })

  it('should handle the exact error case from bug report: brain.relate after brain.addMany', async () => {
    // This test replicates the EXACT code path that failed in v5.7.2
    // ImportCoordinator: addMany() → relateMany() → relate() → get() → "Source entity not found"

    // 1. Create source entity
    const sourceId = await brain.add({
      data: 'Source Document',
      type: NounType.Document
    })

    // 2. Batch create targets
    const targets = Array(10).fill(null).map((_, i) => ({
      data: `Target${i}`,
      type: NounType.Thing
    }))

    const addResult = await brain.addMany({
      items: targets,
      continueOnError: true
    })

    expect(addResult.successful.length).toBe(10)

    // 3. IMMEDIATELY call brain.relate (not relateMany, to test the exact path)
    for (const targetId of addResult.successful) {
      // This is the exact call that fails in v5.7.2:
      // brain.relate() → brain.get(from) → "Source entity not found"
      const relationId = await brain.relate({
        from: sourceId,
        to: targetId,
        type: VerbType.Contains
      })

      expect(relationId).toBeTruthy()
    }
  })
})
