/**
 * GraphAdjacencyIndex Pagination Tests (v5.8.0)
 *
 * Tests for pagination support in GraphIndex methods:
 * - getNeighbors() with limit/offset
 * - getVerbIdsBySource() with limit/offset
 * - getVerbIdsByTarget() with limit/offset
 *
 * Verifies backward compatibility and new pagination features
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { NounType, VerbType } from '../../../src/types/graphTypes.js'

describe('GraphAdjacencyIndex Pagination', () => {
  let brain: Brainy
  let centralId: string
  let neighborIds: string[]

  beforeEach(async () => {
    brain = new Brainy()
    await brain.init()

    // Create central entity
    centralId = await brain.add({
      data: { name: 'Central Hub' },
      type: NounType.Thing
    })

    // Create 50 neighbor entities with relationships
    neighborIds = []
    for (let i = 0; i < 50; i++) {
      const neighborId = await brain.add({
        data: { name: `Neighbor ${i}`, index: i },
        type: NounType.Thing
      })
      neighborIds.push(neighborId)

      // Create outgoing relationship from central to neighbor
      await brain.relate({
        from: centralId,
        to: neighborId,
        type: VerbType.RelatesTo
      })
    }
  })

  describe('getNeighbors() Pagination', () => {
    it('should return all neighbors without pagination (backward compatible)', async () => {
      const graphIndex = (brain as any).graphIndex

      const neighbors = await graphIndex.getNeighbors(centralId)

      // Should return all 50 neighbors
      expect(neighbors).toHaveLength(50)
      expect(neighbors.every((id: string) => neighborIds.includes(id))).toBe(true)
    })

    it('should return all outgoing neighbors with direction parameter (backward compatible)', async () => {
      const graphIndex = (brain as any).graphIndex

      // Old API: direction as string
      const neighbors = await graphIndex.getNeighbors(centralId, 'out')

      expect(neighbors).toHaveLength(50)
    })

    it('should paginate with limit only', async () => {
      const graphIndex = (brain as any).graphIndex

      const page1 = await graphIndex.getNeighbors(centralId, { limit: 10 })

      expect(page1).toHaveLength(10)
      expect(page1.every((id: string) => neighborIds.includes(id))).toBe(true)
    })

    it('should paginate with offset only', async () => {
      const graphIndex = (brain as any).graphIndex

      const all = await graphIndex.getNeighbors(centralId)
      const offsetResults = await graphIndex.getNeighbors(centralId, { offset: 10 })

      // Offset 10 should return all after first 10
      expect(offsetResults).toHaveLength(all.length - 10)
    })

    it('should paginate with both limit and offset', async () => {
      const graphIndex = (brain as any).graphIndex

      const page1 = await graphIndex.getNeighbors(centralId, { limit: 10, offset: 0 })
      const page2 = await graphIndex.getNeighbors(centralId, { limit: 10, offset: 10 })
      const page3 = await graphIndex.getNeighbors(centralId, { limit: 10, offset: 20 })

      // Each page should have 10 results
      expect(page1).toHaveLength(10)
      expect(page2).toHaveLength(10)
      expect(page3).toHaveLength(10)

      // Pages should not overlap
      const page1Set = new Set(page1)
      const page2Set = new Set(page2)
      const page3Set = new Set(page3)

      const overlap12 = page1.filter(id => page2Set.has(id))
      const overlap23 = page2.filter(id => page3Set.has(id))

      expect(overlap12).toHaveLength(0)
      expect(overlap23).toHaveLength(0)
    })

    it('should handle offset beyond total count', async () => {
      const graphIndex = (brain as any).graphIndex

      const results = await graphIndex.getNeighbors(centralId, { offset: 100 })

      // Offset 100 > 50 total → empty array
      expect(results).toHaveLength(0)
    })

    it('should handle limit = 0', async () => {
      const graphIndex = (brain as any).graphIndex

      const results = await graphIndex.getNeighbors(centralId, { limit: 0 })

      expect(results).toHaveLength(0)
    })

    it('should paginate with direction filter', async () => {
      const graphIndex = (brain as any).graphIndex

      // Get first 10 outgoing neighbors
      const page1 = await graphIndex.getNeighbors(centralId, {
        direction: 'out',
        limit: 10,
        offset: 0
      })

      expect(page1).toHaveLength(10)
    })

    it('should handle pagination with incoming direction', async () => {
      const graphIndex = (brain as any).graphIndex

      // Create some incoming relationships
      const sourceId = await brain.add({
        data: { name: 'Source' },
        type: NounType.Thing
      })

      await brain.relate({
        from: sourceId,
        to: centralId,
        type: VerbType.RelatesTo
      })

      // Get incoming neighbors with pagination
      const incoming = await graphIndex.getNeighbors(centralId, {
        direction: 'in',
        limit: 10
      })

      expect(incoming.length).toBeGreaterThan(0)
    })
  })

  describe('getVerbIdsBySource() Pagination', () => {
    it('should return all verb IDs without pagination (backward compatible)', async () => {
      const graphIndex = (brain as any).graphIndex

      const verbIds = await graphIndex.getVerbIdsBySource(centralId)

      // Should return all 50 verb IDs
      expect(verbIds).toHaveLength(50)
    })

    it('should paginate verb IDs with limit', async () => {
      const graphIndex = (brain as any).graphIndex

      const page1 = await graphIndex.getVerbIdsBySource(centralId, { limit: 10 })

      expect(page1).toHaveLength(10)
    })

    it('should paginate verb IDs with offset', async () => {
      const graphIndex = (brain as any).graphIndex

      const all = await graphIndex.getVerbIdsBySource(centralId)
      const offsetResults = await graphIndex.getVerbIdsBySource(centralId, { offset: 10 })

      expect(offsetResults).toHaveLength(all.length - 10)
    })

    it('should paginate verb IDs with limit and offset', async () => {
      const graphIndex = (brain as any).graphIndex

      const page1 = await graphIndex.getVerbIdsBySource(centralId, { limit: 10, offset: 0 })
      const page2 = await graphIndex.getVerbIdsBySource(centralId, { limit: 10, offset: 10 })
      const page3 = await graphIndex.getVerbIdsBySource(centralId, { limit: 10, offset: 20 })

      // Each page should have 10 results
      expect(page1).toHaveLength(10)
      expect(page2).toHaveLength(10)
      expect(page3).toHaveLength(10)

      // Pages should not overlap
      const combined = [...page1, ...page2, ...page3]
      const unique = new Set(combined)
      expect(unique.size).toBe(30) // All unique
    })

    it('should handle pagination edge cases for verb IDs', async () => {
      const graphIndex = (brain as any).graphIndex

      // Offset beyond total
      const beyondTotal = await graphIndex.getVerbIdsBySource(centralId, { offset: 100 })
      expect(beyondTotal).toHaveLength(0)

      // Limit = 0
      const zeroLimit = await graphIndex.getVerbIdsBySource(centralId, { limit: 0 })
      expect(zeroLimit).toHaveLength(0)
    })
  })

  describe('getVerbIdsByTarget() Pagination', () => {
    it('should return all verb IDs targeting an entity (backward compatible)', async () => {
      const graphIndex = (brain as any).graphIndex

      // Pick a neighbor that's a target of relationships
      const targetId = neighborIds[0]
      const verbIds = await graphIndex.getVerbIdsByTarget(targetId)

      // Should have at least 1 (the relationship from central)
      expect(verbIds.length).toBeGreaterThanOrEqual(1)
    })

    it('should paginate verb IDs by target with limit', async () => {
      const graphIndex = (brain as any).graphIndex

      // Create entity with many incoming relationships
      const popularTarget = await brain.add({
        data: { name: 'Popular Target' },
        type: NounType.Thing
      })

      // Create 30 relationships pointing to it
      for (let i = 0; i < 30; i++) {
        const sourceId = await brain.add({
          data: { name: `Source ${i}` },
          type: NounType.Thing
        })
        await brain.relate({
          from: sourceId,
          to: popularTarget,
          type: VerbType.RelatesTo
        })
      }

      // Paginate
      const page1 = await graphIndex.getVerbIdsByTarget(popularTarget, { limit: 10 })
      const page2 = await graphIndex.getVerbIdsByTarget(popularTarget, { limit: 10, offset: 10 })

      expect(page1).toHaveLength(10)
      expect(page2).toHaveLength(10)

      // No overlap
      const overlap = page1.filter((id: string) => page2.includes(id))
      expect(overlap).toHaveLength(0)
    })
  })

  describe('Performance with Pagination', () => {
    it('should maintain sub-5ms performance with pagination', async () => {
      const graphIndex = (brain as any).graphIndex

      // Multiple paginated queries should be fast
      const startTime = performance.now()

      await graphIndex.getNeighbors(centralId, { limit: 10, offset: 0 })
      await graphIndex.getNeighbors(centralId, { limit: 10, offset: 10 })
      await graphIndex.getNeighbors(centralId, { limit: 10, offset: 20 })

      const elapsed = performance.now() - startTime

      // 3 paginated queries should complete in < 15ms (< 5ms each)
      expect(elapsed).toBeLessThan(15)
    })
  })

  describe('Real-World Use Cases', () => {
    it('should efficiently paginate through high-degree node', async () => {
      // Simulate popular entity with 100+ relationships
      const hub = await brain.add({
        data: { name: 'Popular Hub' },
        type: NounType.Thing
      })

      // Create 100 relationships
      const targetIds: string[] = []
      for (let i = 0; i < 100; i++) {
        const targetId = await brain.add({
          data: { name: `Target ${i}` },
          type: NounType.Thing
        })
        targetIds.push(targetId)
        await brain.relate({
          from: hub,
          to: targetId,
          type: VerbType.RelatesTo
        })
      }

      const graphIndex = (brain as any).graphIndex

      // Paginate in chunks of 25
      const chunks: string[][] = []
      for (let offset = 0; offset < 100; offset += 25) {
        const chunk = await graphIndex.getNeighbors(hub, {
          direction: 'out',
          limit: 25,
          offset
        })
        chunks.push(chunk)
      }

      // Should have 4 chunks
      expect(chunks).toHaveLength(4)

      // Each chunk should have 25 items
      chunks.forEach(chunk => {
        expect(chunk).toHaveLength(25)
      })

      // All chunks combined should equal total
      const allNeighbors = chunks.flat()
      expect(allNeighbors).toHaveLength(100)

      // No duplicates
      const uniqueNeighbors = new Set(allNeighbors)
      expect(uniqueNeighbors.size).toBe(100)
    })
  })
})
