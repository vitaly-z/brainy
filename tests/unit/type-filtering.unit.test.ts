/**
 * Type Filtering Tests - Workshop Team Issue
 *
 * Tests to verify that brain.find({ type: NounType.X }) correctly filters entities
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy, NounType } from '../../src/index.js'

describe('Type Filtering (Workshop Team Issue)', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()
  })

  it('should filter entities by NounType.Person', async () => {
    // Add 3 people
    await brain.add({ data: 'John Smith', type: NounType.Person, metadata: { name: 'John' } })
    await brain.add({ data: 'Jane Doe', type: NounType.Person, metadata: { name: 'Jane' } })
    await brain.add({ data: 'Bob Johnson', type: NounType.Person, metadata: { name: 'Bob' } })

    // Add 2 locations
    await brain.add({ data: 'New York', type: NounType.Location, metadata: { name: 'NYC' } })
    await brain.add({ data: 'London', type: NounType.Location, metadata: { name: 'London' } })

    // Test: Filter by person
    const results = await brain.find({ type: NounType.Person, limit: 100 })

    expect(results.length).toBe(3)
    expect(results.every(r => r.type === 'person')).toBe(true)
  })

  it('should filter entities by string type "person"', async () => {
    // Add 2 people
    await brain.add({ data: 'Person 1', type: NounType.Person })
    await brain.add({ data: 'Person 2', type: NounType.Person })

    // Add 1 location
    await brain.add({ data: 'Location 1', type: NounType.Location })

    // Test: Filter by string
    const results = await brain.find({ type: 'person' as any, limit: 100 })

    expect(results.length).toBe(2)
  })

  it('should filter entities by NounType.Location', async () => {
    await brain.add({ data: 'Person 1', type: NounType.Person })
    await brain.add({ data: 'Location 1', type: NounType.Location })
    await brain.add({ data: 'Location 2', type: NounType.Location })

    const results = await brain.find({ type: NounType.Location, limit: 100 })

    expect(results.length).toBe(2)
    expect(results.every(r => r.type === 'location')).toBe(true)
  })

  it('should filter entities by NounType.Concept', async () => {
    await brain.add({ data: 'Concept 1', type: NounType.Concept })
    await brain.add({ data: 'Person 1', type: NounType.Person })

    const results = await brain.find({ type: NounType.Concept, limit: 100 })

    expect(results.length).toBe(1)
    expect(results[0].type).toBe('concept')
  })

  it('should filter by multiple types', async () => {
    await brain.add({ data: 'Person 1', type: NounType.Person })
    await brain.add({ data: 'Location 1', type: NounType.Location })
    await brain.add({ data: 'Concept 1', type: NounType.Concept })

    const results = await brain.find({
      type: [NounType.Person, NounType.Location],
      limit: 100
    })

    expect(results.length).toBe(2)
    expect(results.every(r => r.type === 'person' || r.type === 'location')).toBe(true)
  })

  it('should return empty array when filtering by non-existent type', async () => {
    await brain.add({ data: 'Person 1', type: NounType.Person })

    const results = await brain.find({ type: NounType.Organization, limit: 100 })

    expect(results.length).toBe(0)
  })

  it('should return all entities when no type filter is provided', async () => {
    await brain.add({ data: 'Person 1', type: NounType.Person })
    await brain.add({ data: 'Location 1', type: NounType.Location })
    await brain.add({ data: 'Concept 1', type: NounType.Concept })

    // v5.1.0: VFS auto-initialization creates root directory
    // So we now have 4 entities: 3 added + 1 root directory
    const results = await brain.find({ limit: 100 })

    expect(results.length).toBeGreaterThanOrEqual(3)

    // Verify our entities are included
    const types = results.map(r => r.type)
    expect(types).toContain('person')
    expect(types).toContain('location')
    expect(types).toContain('concept')
  })

  it('should verify entity type is set correctly', async () => {
    const id = await brain.add({
      data: 'Test Person',
      type: NounType.Person,
      metadata: { name: 'Test' }
    })

    const entity = await brain.get(id)

    // Check that the entity has the correct type
    expect(entity?.type).toBe('person')

    // Verify metadata.noun is NOT exposed in public API
    // (it's an internal field, converted to entity.type)
    // @ts-ignore - accessing to verify it's NOT there
    expect(entity?.metadata?.noun).toBeUndefined()
  })
})
