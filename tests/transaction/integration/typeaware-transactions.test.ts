/**
 * TypeAware + Transactions Integration Tests
 *
 * Verifies that transactions work correctly with type-aware storage:
 * - Type-specific routing
 * - Type cache updates
 * - Type changes during updates
 * - Per-type performance optimization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import { NounType, VerbType } from '../../../src/types/graphTypes.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync, rmSync } from 'fs'

describe('Transactions + TypeAware Storage Integration', () => {
  let brain: Brainy
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `brainy-typeaware-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })

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

  describe('Type-Specific Routing', () => {
    it('should route entities to type-specific storage atomically', async () => {
      // Add entities of different types
      const personId = await brain.add({
        data: { name: 'John Doe', role: 'Developer' },
        type: NounType.Person
      })

      const orgId = await brain.add({
        data: { name: 'Acme Corp', industry: 'Tech' },
        type: NounType.Organization
      })

      const placeId = await brain.add({
        data: { name: 'San Francisco', country: 'USA' },
        type: NounType.Place
      })

      // Verify all entities stored with correct types
      const person = await brain.get(personId)
      const org = await brain.get(orgId)
      const place = await brain.get(placeId)

      expect(person?.type).toBe(NounType.Person)
      expect(org?.type).toBe(NounType.Organization)
      expect(place?.type).toBe(NounType.Place)
    })

    it('should handle type-specific queries atomically', async () => {
      // Add multiple entities of same type
      await brain.add({
        data: { name: 'Alice', role: 'Engineer' },
        type: NounType.Person
      })

      await brain.add({
        data: { name: 'Bob', role: 'Designer' },
        type: NounType.Person
      })

      await brain.add({
        data: { name: 'Acme', industry: 'Tech' },
        type: NounType.Organization
      })

      // Query by type
      const results = await brain.find({
        filter: { type: NounType.Person }
      })

      expect(results).toHaveLength(2)
      expect(results.every(r => r.type === NounType.Person)).toBe(true)
    })
  })

  describe('Type Changes During Updates', () => {
    it('should handle type changes atomically in update operations', async () => {
      // Add entity as Person
      const id = await brain.add({
        data: { name: 'John Smith', category: 'individual' },
        type: NounType.Person
      })

      // Verify initial type
      let entity = await brain.get(id)
      expect(entity?.type).toBe(NounType.Person)

      // Update to Organization (type change)
      await brain.update({
        id,
        type: NounType.Organization,
        data: { name: 'Smith Corp', category: 'business' }
      })

      // Verify type changed
      entity = await brain.get(id)
      expect(entity?.type).toBe(NounType.Organization)
      expect(entity?.data.category).toBe('business')
    })

    it('should rollback type changes on failed update', async () => {
      // Add entity as Person
      const id = await brain.add({
        data: { name: 'Jane Doe' },
        type: NounType.Person
      })

      // Attempt to update with invalid data (will fail)
      let failed = false
      try {
        await brain.update({
          id,
          type: NounType.Organization,
          data: null as any // Invalid
        })
      } catch (e) {
        failed = true
      }

      expect(failed).toBe(true)

      // Type should remain Person (rollback)
      const entity = await brain.get(id)
      expect(entity?.type).toBe(NounType.Person)
      expect(entity?.data.name).toBe('Jane Doe')
    })
  })

  describe('Type Cache Consistency', () => {
    it('should maintain type cache consistency during transactions', async () => {
      // Add multiple entities
      const ids: string[] = []
      const types = [
        NounType.Person,
        NounType.Organization,
        NounType.Place,
        NounType.Event,
        NounType.Concept
      ]

      for (let i = 0; i < types.length; i++) {
        const id = await brain.add({
          data: { name: `Entity ${i}`, index: i },
          type: types[i]
        })
        ids.push(id)
      }

      // Verify all types cached correctly
      for (let i = 0; i < ids.length; i++) {
        const entity = await brain.get(ids[i])
        expect(entity?.type).toBe(types[i])
      }
    })

    it('should update type cache on type changes', async () => {
      const id = await brain.add({
        data: { name: 'Initial' },
        type: NounType.Thing
      })

      // Sequence of type changes
      const typeSequence = [
        NounType.Concept,
        NounType.Event,
        NounType.Organization,
        NounType.Person
      ]

      for (const newType of typeSequence) {
        await brain.update({
          id,
          type: newType,
          data: { name: `As ${newType}` }
        })

        const entity = await brain.get(id)
        expect(entity?.type).toBe(newType)
      }
    })
  })

  describe('Per-Type Performance', () => {
    it('should handle large numbers of same-type entities efficiently', async () => {
      const startTime = Date.now()

      // Add 50 entities of same type (type-aware storage optimization)
      const ids: string[] = []
      for (let i = 0; i < 50; i++) {
        const id = await brain.add({
          data: { name: `Person ${i}`, index: i },
          type: NounType.Person
        })
        ids.push(id)
      }

      const addTime = Date.now() - startTime

      // Verify all entities stored
      const retrieveStart = Date.now()
      for (const id of ids) {
        const entity = await brain.get(id)
        expect(entity).toBeTruthy()
      }
      const retrieveTime = Date.now() - retrieveStart

      // Type-aware storage should be reasonably fast
      expect(addTime).toBeLessThan(5000) // 5 seconds for 50 adds
      expect(retrieveTime).toBeLessThan(2000) // 2 seconds for 50 retrieves
    })
  })

  describe('Mixed Type Operations', () => {
    it('should handle operations across multiple types atomically', async () => {
      // Create entities of different types
      const personId = await brain.add({
        data: { name: 'Alice' },
        type: NounType.Person
      })

      const orgId = await brain.add({
        data: { name: 'TechCorp' },
        type: NounType.Organization
      })

      const eventId = await brain.add({
        data: { name: 'Conference 2024' },
        type: NounType.Event
      })

      // Create relationships across types (atomic)
      await brain.relate({
        from: personId,
        to: orgId,
        type: VerbType.WorksFor
      })

      await brain.relate({
        from: personId,
        to: eventId,
        type: VerbType.Attends
      })

      await brain.relate({
        from: orgId,
        to: eventId,
        type: VerbType.Sponsors
      })

      // Verify relationships exist
      const personRelations = await brain.getRelations({ from: personId })
      const orgRelations = await brain.getRelations({ from: orgId })

      expect(personRelations).toHaveLength(2)
      expect(orgRelations).toHaveLength(1)
    })

    it('should handle delete with cascade across types', async () => {
      // Create multi-type graph
      const personId = await brain.add({
        data: { name: 'Bob' },
        type: NounType.Person
      })

      const projectId = await brain.add({
        data: { name: 'Project X' },
        type: NounType.Thing
      })

      const taskId = await brain.add({
        data: { name: 'Task 1' },
        type: NounType.Thing
      })

      // Create relationships
      await brain.relate({
        from: personId,
        to: projectId,
        type: VerbType.WorksOn
      })

      await brain.relate({
        from: projectId,
        to: taskId,
        type: VerbType.Contains
      })

      // Delete person (should cascade delete relationships)
      await brain.delete(personId)

      // Verify person deleted
      const person = await brain.get(personId)
      expect(person).toBeNull()

      // Verify project and task still exist (different types)
      const project = await brain.get(projectId)
      const task = await brain.get(taskId)
      expect(project).toBeTruthy()
      expect(task).toBeTruthy()

      // Verify relationships from person are deleted
      const relations = await brain.getRelations({ from: personId })
      expect(relations).toHaveLength(0)
    })
  })

  describe('Type Validation', () => {
    it('should validate types during atomic operations', async () => {
      // Valid type - should succeed
      const id = await brain.add({
        data: { name: 'Test' },
        type: NounType.Person
      })

      expect(id).toBeTruthy()

      // Verify type stored correctly
      const entity = await brain.get(id)
      expect(entity?.type).toBe(NounType.Person)
    })

    it('should handle type-specific metadata atomically', async () => {
      // Add with type-specific metadata
      const personId = await brain.add({
        data: { name: 'Charlie', age: 30, occupation: 'Engineer' },
        type: NounType.Person,
        metadata: { verified: true, source: 'HR' }
      })

      const orgId = await brain.add({
        data: { name: 'StartupCo', employees: 50, founded: 2020 },
        type: NounType.Organization,
        metadata: { verified: false, source: 'Registration' }
      })

      // Verify metadata with type context
      const person = await brain.get(personId)
      const org = await brain.get(orgId)

      expect(person?.metadata?.verified).toBe(true)
      expect(org?.metadata?.verified).toBe(false)
    })
  })
})
