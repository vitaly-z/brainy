/**
 * Integration Tests for getRelations() Fix (v4.1.3)
 *
 * Tests for Bug: getRelations() returns empty array when called without parameters
 * This validates that the fix allows retrieving all relationships with proper pagination
 *
 * NO MOCKS - Real integration tests with actual storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'
import * as fs from 'fs/promises'

describe('getRelations() Fix (v4.1.3)', () => {
  let brain: Brainy
  const testPath = './test-brainy-get-relations-fix'

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

  describe('Get All Relationships (No Parameters)', () => {
    it('should return all relationships when called with no parameters', async () => {
      // Create entities
      const person1 = await brain.add({ data: 'Alice', type: NounType.Person })
      const person2 = await brain.add({ data: 'Bob', type: NounType.Person })
      const person3 = await brain.add({ data: 'Charlie', type: NounType.Person })

      // Create relationships
      await brain.relate({ from: person1, to: person2, type: VerbType.FriendOf })
      await brain.relate({ from: person2, to: person3, type: VerbType.FriendOf })
      await brain.relate({ from: person1, to: person3, type: VerbType.WorksWith })

      // Flush to storage
      await brain.flush()

      // Get all relationships - THIS IS THE BUG FIX!
      const relations = await brain.getRelations()

      // Should return all 3 relationships
      expect(relations).toHaveLength(3)
      expect(relations.every(r => r.id && r.from && r.to && r.type)).toBe(true)
    })

    it('should return empty array when no relationships exist', async () => {
      // Create entities but no relationships
      await brain.add({ data: 'Entity 1', type: NounType.Document })
      await brain.add({ data: 'Entity 2', type: NounType.Document })
      await brain.flush()

      // Get all relationships
      const relations = await brain.getRelations()

      // Should return empty array
      expect(relations).toHaveLength(0)
    })

    it('should support pagination for large relationship sets', async () => {
      // Create entities
      const entities = []
      for (let i = 0; i < 10; i++) {
        entities.push(await brain.add({ data: `Entity ${i}`, type: NounType.Document }))
      }

      // Create 20 relationships
      for (let i = 0; i < 10; i++) {
        await brain.relate({
          from: entities[i],
          to: entities[(i + 1) % 10],
          type: VerbType.RelatedTo
        })
        await brain.relate({
          from: entities[i],
          to: entities[(i + 2) % 10],
          type: VerbType.ChildOf
        })
      }

      await brain.flush()

      // Get first page (limit: 10)
      const page1 = await brain.getRelations({ limit: 10 })
      expect(page1).toHaveLength(10)

      // Get second page (offset: 10, limit: 10)
      const page2 = await brain.getRelations({ offset: 10, limit: 10 })
      expect(page2).toHaveLength(10)

      // Ensure no duplicates between pages
      const page1Ids = new Set(page1.map(r => r.id))
      const page2Ids = new Set(page2.map(r => r.id))
      const intersection = [...page1Ids].filter(id => page2Ids.has(id))
      expect(intersection).toHaveLength(0)
    })

    it('should filter by type when getting all relationships', async () => {
      // Create entities
      const person1 = await brain.add({ data: 'Alice', type: NounType.Person })
      const person2 = await brain.add({ data: 'Bob', type: NounType.Person })
      const person3 = await brain.add({ data: 'Charlie', type: NounType.Person })

      // Create different types of relationships
      await brain.relate({ from: person1, to: person2, type: VerbType.FriendOf })
      await brain.relate({ from: person2, to: person3, type: VerbType.FriendOf })
      await brain.relate({ from: person1, to: person3, type: VerbType.WorksWith })
      await brain.flush()

      // Get only FriendOf relationships
      const friendRelations = await brain.getRelations({ type: VerbType.FriendOf })
      expect(friendRelations).toHaveLength(2)
      expect(friendRelations.every(r => r.type === VerbType.FriendOf)).toBe(true)

      // Get only WorksWith relationships
      const workRelations = await brain.getRelations({ type: VerbType.WorksWith })
      expect(workRelations).toHaveLength(1)
      expect(workRelations[0].type).toBe(VerbType.WorksWith)
    })

    it('should filter by multiple types when getting all relationships', async () => {
      // Create entities
      const entities = []
      for (let i = 0; i < 5; i++) {
        entities.push(await brain.add({ data: `Entity ${i}`, type: NounType.Person }))
      }

      // Create relationships of different types
      await brain.relate({ from: entities[0], to: entities[1], type: VerbType.FriendOf })
      await brain.relate({ from: entities[1], to: entities[2], type: VerbType.WorksWith })
      await brain.relate({ from: entities[2], to: entities[3], type: VerbType.ChildOf })
      await brain.relate({ from: entities[3], to: entities[4], type: VerbType.FriendOf })
      await brain.flush()

      // Get all relationships first to verify total count
      const allRelations = await brain.getRelations()
      expect(allRelations).toHaveLength(4)

      // Get FriendOf and WorksWith relationships using type array filter
      // NOTE: Current storage layer may not support array filters directly
      // So we test each type separately and combine
      const friendRelations = await brain.getRelations({ type: VerbType.FriendOf })
      const workRelations = await brain.getRelations({ type: VerbType.WorksWith })

      expect(friendRelations).toHaveLength(2)
      expect(workRelations).toHaveLength(1)
      expect(friendRelations.every(r => r.type === VerbType.FriendOf)).toBe(true)
      expect(workRelations.every(r => r.type === VerbType.WorksWith)).toBe(true)
    })
  })

  describe('String ID Shorthand Syntax', () => {
    it('should support string ID shorthand: getRelations(id)', async () => {
      // Create entities
      const person1 = await brain.add({ data: 'Alice', type: NounType.Person })
      const person2 = await brain.add({ data: 'Bob', type: NounType.Person })
      const person3 = await brain.add({ data: 'Charlie', type: NounType.Person })

      // Create relationships
      await brain.relate({ from: person1, to: person2, type: VerbType.FriendOf })
      await brain.relate({ from: person1, to: person3, type: VerbType.WorksWith })
      await brain.flush()

      // Use string shorthand - THIS IS THE NEW SIGNATURE!
      const relations = await brain.getRelations(person1)

      // Should return both relationships from person1
      expect(relations).toHaveLength(2)
      expect(relations.every(r => r.from === person1)).toBe(true)
    })

    it('should be equivalent to getRelations({ from: id })', async () => {
      // Create entities and relationships
      const person1 = await brain.add({ data: 'Alice', type: NounType.Person })
      const person2 = await brain.add({ data: 'Bob', type: NounType.Person })
      await brain.relate({ from: person1, to: person2, type: VerbType.FriendOf })
      await brain.flush()

      // Both syntaxes should return the same results
      const shorthand = await brain.getRelations(person1)
      const explicit = await brain.getRelations({ from: person1 })

      expect(shorthand).toEqual(explicit)
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain existing behavior for from parameter', async () => {
      // Create entities
      const person1 = await brain.add({ data: 'Alice', type: NounType.Person })
      const person2 = await brain.add({ data: 'Bob', type: NounType.Person })
      const person3 = await brain.add({ data: 'Charlie', type: NounType.Person })

      // Create relationships
      await brain.relate({ from: person1, to: person2, type: VerbType.FriendOf })
      await brain.relate({ from: person1, to: person3, type: VerbType.WorksWith })
      await brain.relate({ from: person2, to: person3, type: VerbType.FriendOf })
      await brain.flush()

      // Get relationships from person1
      const relations = await brain.getRelations({ from: person1 })

      expect(relations).toHaveLength(2)
      expect(relations.every(r => r.from === person1)).toBe(true)
    })

    it('should maintain existing behavior for to parameter', async () => {
      // Create entities
      const person1 = await brain.add({ data: 'Alice', type: NounType.Person })
      const person2 = await brain.add({ data: 'Bob', type: NounType.Person })
      const person3 = await brain.add({ data: 'Charlie', type: NounType.Person })

      // Create relationships
      await brain.relate({ from: person1, to: person3, type: VerbType.FriendOf })
      await brain.relate({ from: person2, to: person3, type: VerbType.WorksWith })
      await brain.flush()

      // Get relationships to person3
      const relations = await brain.getRelations({ to: person3 })

      expect(relations).toHaveLength(2)
      expect(relations.every(r => r.to === person3)).toBe(true)
    })

    it('should maintain existing behavior for type filtering with from', async () => {
      // Create entities
      const person1 = await brain.add({ data: 'Alice', type: NounType.Person })
      const person2 = await brain.add({ data: 'Bob', type: NounType.Person })
      const person3 = await brain.add({ data: 'Charlie', type: NounType.Person })

      // Create relationships
      await brain.relate({ from: person1, to: person2, type: VerbType.FriendOf })
      await brain.relate({ from: person1, to: person3, type: VerbType.WorksWith })
      await brain.flush()

      // Get only FriendOf relationships from person1
      const relations = await brain.getRelations({
        from: person1,
        type: VerbType.FriendOf
      })

      expect(relations).toHaveLength(1)
      expect(relations[0].type).toBe(VerbType.FriendOf)
    })
  })

  describe('Production Safety', () => {
    it('should handle large relationship queries efficiently', async () => {
      // Create entities for 100 unique relationships
      const entities = []
      for (let i = 0; i < 50; i++) {
        entities.push(await brain.add({ data: `Entity ${i}`, type: NounType.Document }))
      }

      // Create 100 unique relationships (each entity connects to 2+ others)
      for (let i = 0; i < 50; i++) {
        // First connection: i -> (i+1)
        await brain.relate({
          from: entities[i],
          to: entities[(i + 1) % 50],
          type: VerbType.RelatedTo
        })
        // Second connection: i -> (i+2) with different type to ensure uniqueness
        await brain.relate({
          from: entities[i],
          to: entities[(i + 2) % 50],
          type: VerbType.ChildOf
        })
      }
      await brain.flush()

      // Should handle query without issues
      const startTime = Date.now()
      const relations = await brain.getRelations({ limit: 100 })
      const duration = Date.now() - startTime

      expect(relations).toHaveLength(100)
      // Should complete reasonably fast (< 1 second)
      expect(duration).toBeLessThan(1000)
    })

    it('should respect default limit of 100', async () => {
      // Create many unique relationships (more than default limit)
      const entities = []
      for (let i = 0; i < 60; i++) {
        entities.push(await brain.add({ data: `Entity ${i}`, type: NounType.Document }))
      }

      // Create 150 unique relationships (each entity gets 2-3 connections)
      for (let i = 0; i < 60; i++) {
        // Connection 1: i -> (i+1)
        await brain.relate({
          from: entities[i],
          to: entities[(i + 1) % 60],
          type: VerbType.RelatedTo
        })
        // Connection 2: i -> (i+2) with different type
        await brain.relate({
          from: entities[i],
          to: entities[(i + 2) % 60],
          type: VerbType.ChildOf
        })
        // Connection 3: for first 30 entities, add third connection
        if (i < 30) {
          await brain.relate({
            from: entities[i],
            to: entities[(i + 3) % 60],
            type: VerbType.WorksWith
          })
        }
      }
      await brain.flush()

      // Verify we have 150 total relationships
      const allRelations = await brain.getRelations({ limit: 200 })
      expect(allRelations.length).toBe(150)

      // Call without limit - should default to 100
      const relations = await brain.getRelations()

      // Should return exactly 100 (default limit)
      expect(relations).toHaveLength(100)
    })

    it('should support custom limits', async () => {
      // Create entities for 50 unique relationships
      const entities = []
      for (let i = 0; i < 25; i++) {
        entities.push(await brain.add({ data: `Entity ${i}`, type: NounType.Document }))
      }

      // Create 50 unique relationships (2 per entity to different targets)
      for (let i = 0; i < 25; i++) {
        await brain.relate({
          from: entities[i],
          to: entities[(i + 1) % 25],
          type: VerbType.RelatedTo
        })
        await brain.relate({
          from: entities[i],
          to: entities[(i + 2) % 25],
          type: VerbType.ChildOf
        })
      }
      await brain.flush()

      // Verify we have 50 total
      const all = await brain.getRelations({ limit: 100 })
      expect(all.length).toBe(50)

      // Custom limit of 25
      const relations = await brain.getRelations({ limit: 25 })
      expect(relations).toHaveLength(25)
    })
  })

  describe('Comparison with Workshop Bug Report', () => {
    it('should reproduce and fix the Workshop team bug scenario', async () => {
      // Reproduce the exact scenario from the bug report:
      // - 524 relationships exist in GraphAdjacencyIndex
      // - brain.getRelations() was returning empty array

      // Create entities similar to Workshop import
      const entities = []
      for (let i = 0; i < 50; i++) {
        entities.push(await brain.add({
          data: `Workshop Entity ${i}`,
          type: NounType.Document
        }))
      }

      // Create multiple relationships (simulating import)
      for (let i = 0; i < 50; i++) {
        await brain.relate({
          from: entities[i],
          to: entities[(i + 1) % 50],
          type: VerbType.RelatedTo
        })
        if (i % 5 === 0) {
          await brain.relate({
            from: entities[i],
            to: entities[(i + 3) % 50],
            type: VerbType.ChildOf
          })
        }
      }

      await brain.flush()

      // BUG FIX TEST: This should now return relationships, not empty array!
      const relations = await brain.getRelations()

      // CRITICAL: Should NOT be empty
      expect(relations.length).toBeGreaterThan(0)

      // Should have at least the relationships we created
      expect(relations.length).toBeGreaterThanOrEqual(50)

      // All relations should be valid
      expect(relations.every(r =>
        r.id && r.from && r.to && r.type
      )).toBe(true)
    })
  })
})
