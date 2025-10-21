/**
 * Count Synchronization Integration Tests (v4.1.2)
 *
 * Tests for Bug #1 and Bug #2: Count synchronization failures during add() and relate()
 * This validates that counts.json is properly updated when entities and relationships are created
 *
 * NO MOCKS - Real integration tests with actual storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'
import { rebuildCounts } from '../../src/utils/rebuildCounts.js'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('Count Synchronization (Bug Fix v4.1.2)', () => {
  let brain: Brainy
  const testPath = './test-brainy-counts-sync'

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {
      // Ignore if doesn't exist
    }

    // Create fresh Brainy instance
    brain = new Brainy({
      storage: { type: 'filesystem', path: testPath }
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

  describe('Noun Count Synchronization', () => {
    it('should update counts.json when adding a single entity', async () => {
      // Add entity
      const id = await brain.add({
        data: 'Test Entity',
        type: NounType.Document
      })

      // Flush to disk
      await brain.flush()

      // Read counts.json
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // Verify counts
      expect(counts.totalNounCount).toBe(1)
      expect(counts.entityCounts[NounType.Document]).toBe(1)
    })

    it('should update counts.json when adding multiple entities of same type', async () => {
      // Add 3 entities of same type
      await brain.add({ data: 'Entity 1', type: NounType.Document })
      await brain.add({ data: 'Entity 2', type: NounType.Document })
      await brain.add({ data: 'Entity 3', type: NounType.Document })

      // Flush to disk
      await brain.flush()

      // Read counts.json
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // Verify counts
      expect(counts.totalNounCount).toBe(3)
      expect(counts.entityCounts[NounType.Document]).toBe(3)
    })

    it('should update counts.json when adding multiple entities of different types', async () => {
      // Add entities of different types
      await brain.add({ data: 'Document 1', type: NounType.Document })
      await brain.add({ data: 'Person 1', type: NounType.Person })
      await brain.add({ data: 'Document 2', type: NounType.Document })
      await brain.add({ data: 'Organization 1', type: NounType.Organization })

      // Flush to disk
      await brain.flush()

      // Read counts.json
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // Verify counts
      expect(counts.totalNounCount).toBe(4)
      expect(counts.entityCounts[NounType.Document]).toBe(2)
      expect(counts.entityCounts[NounType.Person]).toBe(1)
      expect(counts.entityCounts[NounType.Organization]).toBe(1)
    })

    it('should match find() results with counts.json', async () => {
      // Add entities
      await brain.add({ data: 'Entity 1', type: NounType.Document })
      await brain.add({ data: 'Entity 2', type: NounType.Person })
      await brain.add({ data: 'Entity 3', type: NounType.Document })

      // Flush
      await brain.flush()

      // Get all entities using find with high limit
      const entities = await brain.find({ limit: 1000 })

      // Read counts
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // CRITICAL: Counts must match actual data
      expect(counts.totalNounCount).toBe(entities.length)
      expect(counts.totalNounCount).toBe(3)
    })
  })

  describe('Verb Count Synchronization', () => {
    it('should update counts.json when creating a single relationship', async () => {
      // Create entities
      const id1 = await brain.add({ data: 'Person 1', type: NounType.Person })
      const id2 = await brain.add({ data: 'Person 2', type: NounType.Person })

      // Create relationship
      await brain.relate({
        from: id1,
        to: id2,
        type: VerbType.FriendOf
      })

      // Flush to disk
      await brain.flush()

      // Read counts.json
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // Verify verb counts
      expect(counts.totalVerbCount).toBe(1)
      expect(counts.verbCounts[VerbType.FriendOf]).toBe(1)
    })

    it('should update counts.json when creating multiple relationships of same type', async () => {
      // Create entities
      const id1 = await brain.add({ data: 'Person 1', type: NounType.Person })
      const id2 = await brain.add({ data: 'Person 2', type: NounType.Person })
      const id3 = await brain.add({ data: 'Person 3', type: NounType.Person })

      // Create relationships
      await brain.relate({ from: id1, to: id2, type: VerbType.FriendOf })
      await brain.relate({ from: id2, to: id3, type: VerbType.FriendOf })

      // Flush to disk
      await brain.flush()

      // Read counts.json
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // Verify verb counts
      expect(counts.totalVerbCount).toBe(2)
      expect(counts.verbCounts[VerbType.FriendOf]).toBe(2)
    })

    it('should update counts.json when creating multiple relationships of different types', async () => {
      // Create entities
      const personId = await brain.add({ data: 'John', type: NounType.Person })
      const docId = await brain.add({ data: 'Resume', type: NounType.Document })
      const orgId = await brain.add({ data: 'Company', type: NounType.Organization })

      // Create relationships of different types
      await brain.relate({ from: personId, to: orgId, type: VerbType.WorksWith })
      await brain.relate({ from: personId, to: docId, type: VerbType.CreatedBy })

      // Flush to disk
      await brain.flush()

      // Read counts.json
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // Verify verb counts
      expect(counts.totalVerbCount).toBe(2)
      expect(counts.verbCounts[VerbType.WorksWith]).toBe(1)
      expect(counts.verbCounts[VerbType.CreatedBy]).toBe(1)
    })
  })

  describe('Batch Operations', () => {
    it('should update counts.json during addMany()', async () => {
      // Add multiple entities via batch
      await brain.addMany({
        items: [
          { data: 'Entity 1', type: NounType.Document },
          { data: 'Entity 2', type: NounType.Person },
          { data: 'Entity 3', type: NounType.Document }
        ]
      })

      // Flush to disk
      await brain.flush()

      // Read counts.json
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // Verify counts
      expect(counts.totalNounCount).toBe(3)
      expect(counts.entityCounts[NounType.Document]).toBe(2)
      expect(counts.entityCounts[NounType.Person]).toBe(1)
    })

    it('should update counts.json during relateMany()', async () => {
      // Create entities
      const id1 = await brain.add({ data: 'Person 1', type: NounType.Person })
      const id2 = await brain.add({ data: 'Person 2', type: NounType.Person })
      const id3 = await brain.add({ data: 'Person 3', type: NounType.Person })

      // Create multiple relationships via batch
      await brain.relateMany({
        items: [
          { from: id1, to: id2, type: VerbType.FriendOf },
          { from: id2, to: id3, type: VerbType.FriendOf }
        ]
      })

      // Flush to disk
      await brain.flush()

      // Read counts.json
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // Verify verb counts
      expect(counts.totalVerbCount).toBe(2)
      expect(counts.verbCounts[VerbType.FriendOf]).toBe(2)
    })
  })

  describe('rebuildCounts Utility', () => {
    it('should rebuild counts from corrupted state', async () => {
      // Add entities
      await brain.add({ data: 'Entity 1', type: NounType.Document })
      await brain.add({ data: 'Entity 2', type: NounType.Person })
      await brain.add({ data: 'Entity 3', type: NounType.Document })

      // Flush to disk
      await brain.flush()

      // Manually corrupt counts.json (simulate the bug)
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const corruptedCounts = {
        entityCounts: {},
        verbCounts: {},
        totalNounCount: 0,
        totalVerbCount: 0,
        lastUpdated: new Date().toISOString()
      }
      await fs.writeFile(countsPath, JSON.stringify(corruptedCounts, null, 2))

      // Force storage to reload corrupted counts by updating in-memory counts
      // This simulates the scenario where counts are out of sync
      ;(brain.storage as any).totalNounCount = 0
      ;(brain.storage as any).totalVerbCount = 0
      ;(brain.storage as any).entityCounts = new Map()
      ;(brain.storage as any).verbCounts = new Map()

      // Rebuild counts
      const result = await rebuildCounts(brain.storage)

      // Verify rebuild results
      expect(result.nounCount).toBe(3)
      expect(result.entityCounts.get(NounType.Document)).toBe(2)
      expect(result.entityCounts.get(NounType.Person)).toBe(1)

      // Verify counts.json was updated
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)
      expect(counts.totalNounCount).toBe(3)
      expect(counts.entityCounts[NounType.Document]).toBe(2)
      expect(counts.entityCounts[NounType.Person]).toBe(1)
    })
  })

  describe('Import Operations', () => {
    it('should update counts.json during import', async () => {
      // Create simple test data as JSON
      const testData = {
        entities: [
          { id: '1', name: 'Entity 1', type: 'document' },
          { id: '2', name: 'Entity 2', type: 'person' },
          { id: '3', name: 'Entity 3', type: 'document' }
        ]
      }

      // Import data
      const result = await brain.import(testData, {
        format: 'json',
        createEntities: true,
        createRelationships: false
      })

      // Flush to disk
      await brain.flush()

      // Read counts.json
      const countsPath = path.join(testPath, '_system', 'counts.json')
      const countsRaw = await fs.readFile(countsPath, 'utf8')
      const counts = JSON.parse(countsRaw)

      // Verify counts are updated (import may create additional VFS entities)
      // So we check that totalNounCount >= graphNodesCreated
      expect(counts.totalNounCount).toBeGreaterThanOrEqual(result.stats.graphNodesCreated)
      expect(counts.totalNounCount).toBeGreaterThan(0)
    })
  })
})
