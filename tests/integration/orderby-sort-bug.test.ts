/**
 * @module orderby-sort-bug
 * @description Regression tests for the `find({ orderBy: ... })` sort bug.
 *
 * Bug: `getFieldValueForEntity` read `noun.metadata[field]` for timestamp
 * fields, but `getNoun()` destructures standard fields to the top level.
 * Every entity returned `undefined` for the sort key, stable sort preserved
 * insertion order, and `order: 'desc'` behaved like `order: 'asc'`.
 *
 * Fix: centralized `resolveEntityField` helper + `BUCKETED_INDEX_FIELDS`
 * set in coreTypes.ts, used by getFieldValueForEntity.
 *
 * Reported by Muse team 2026-04-09 (handoff action BR-ORDERBY-TS).
 *
 * NOTE: These tests cover FILTERED sort, which is the only supported path.
 * Unfiltered `find({ orderBy })` is explicitly rejected until the dedicated
 * time-ordered segment index ships (Track 2).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import {
  resolveEntityField,
  STANDARD_ENTITY_FIELDS,
  type HNSWNounWithMetadata
} from '../../src/coreTypes'
import { NounType } from '../../src/types/graphTypes'

describe('find({ orderBy }) sort bug regression', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  /**
   * Muse's real use case: filtered sort of chat sessions.
   * Before the fix, this returned the OLDEST entity instead of the newest
   * because getFieldValueForEntity was reading createdAt from the wrong
   * location on the entity.
   */
  it('orderBy createdAt desc with filter returns newest matching entity', async () => {
    // Add 4 entities 20ms apart so createdAt values are distinct.
    const id1 = await brain.add({ data: 'first', type: NounType.Concept })
    await new Promise((r) => setTimeout(r, 20))
    await brain.add({ data: 'second', type: NounType.Concept })
    await new Promise((r) => setTimeout(r, 20))
    await brain.add({ data: 'third', type: NounType.Concept })
    await new Promise((r) => setTimeout(r, 20))
    const id4 = await brain.add({ data: 'fourth', type: NounType.Concept })

    const results = await brain.find({
      type: NounType.Concept,
      orderBy: 'createdAt',
      order: 'desc',
      limit: 1
    })

    expect(results).toHaveLength(1)
    // Must be the last-inserted entity, not the first.
    expect(results[0].id).toBe(id4)
    expect(results[0].id).not.toBe(id1)
  })

  it('orderBy createdAt asc with filter returns oldest matching entity', async () => {
    const id1 = await brain.add({ data: 'first', type: NounType.Concept })
    await new Promise((r) => setTimeout(r, 20))
    await brain.add({ data: 'second', type: NounType.Concept })
    await new Promise((r) => setTimeout(r, 20))
    await brain.add({ data: 'third', type: NounType.Concept })

    const results = await brain.find({
      type: NounType.Concept,
      orderBy: 'createdAt',
      order: 'asc',
      limit: 1
    })

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(id1)
  })

  it('orderBy createdAt desc with filter returns all matching entities in newest-first order', async () => {
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      ids.push(await brain.add({ data: `item-${i}`, type: NounType.Concept }))
      await new Promise((r) => setTimeout(r, 20))
    }

    const results = await brain.find({
      type: NounType.Concept,
      orderBy: 'createdAt',
      order: 'desc'
    })

    expect(results).toHaveLength(5)
    expect(results.map((r) => r.id)).toEqual([...ids].reverse())
  })

  it('orderBy updatedAt desc with filter returns most-recently-updated matching entity', async () => {
    const id1 = await brain.add({ data: 'first', type: NounType.Concept })
    await new Promise((r) => setTimeout(r, 20))
    await brain.add({ data: 'second', type: NounType.Concept })
    await new Promise((r) => setTimeout(r, 20))
    await brain.add({ data: 'third', type: NounType.Concept })

    // Touch id1 so it becomes the most-recently-updated.
    await new Promise((r) => setTimeout(r, 20))
    await brain.update({ id: id1, data: 'first-updated' })

    const results = await brain.find({
      type: NounType.Concept,
      orderBy: 'updatedAt',
      order: 'desc',
      limit: 1
    })

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(id1)
  })

  /**
   * Unfiltered sort now works via the unified column store.
   * This was the Track 2 motivating use case — previously threw an error.
   */
  it('orderBy without filter works via column store', async () => {
    const id1 = await brain.add({ data: 'first', type: NounType.Concept })
    await new Promise((r) => setTimeout(r, 20))
    await brain.add({ data: 'second', type: NounType.Concept })
    await new Promise((r) => setTimeout(r, 20))
    const id3 = await brain.add({ data: 'third', type: NounType.Concept })

    const results = await brain.find({
      orderBy: 'createdAt',
      order: 'desc',
      limit: 2
    })

    expect(results.length).toBeGreaterThanOrEqual(2)
    // Newest should be first (desc order)
    expect(results[0].id).toBe(id3)
  })
})

describe('resolveEntityField helper', () => {
  const entity: HNSWNounWithMetadata = {
    id: 'abc',
    vector: [0.1, 0.2],
    connections: new Map(),
    level: 0,
    type: NounType.Concept,
    createdAt: 1700000000000,
    updatedAt: 1700000060000,
    confidence: 0.9,
    weight: 1,
    service: 'test',
    data: { title: 'Hello' },
    metadata: {
      customTag: 'green',
      priority: 5,
      modified: 1700000120000 // VFS custom field, lives in metadata
    }
  }

  it('reads standard fields from top level', () => {
    expect(resolveEntityField(entity, 'createdAt')).toBe(1700000000000)
    expect(resolveEntityField(entity, 'updatedAt')).toBe(1700000060000)
    expect(resolveEntityField(entity, 'type')).toBe(NounType.Concept)
    expect(resolveEntityField(entity, 'confidence')).toBe(0.9)
    expect(resolveEntityField(entity, 'weight')).toBe(1)
    expect(resolveEntityField(entity, 'service')).toBe('test')
    expect(resolveEntityField(entity, 'id')).toBe('abc')
  })

  it('reads custom fields from metadata', () => {
    expect(resolveEntityField(entity, 'customTag')).toBe('green')
    expect(resolveEntityField(entity, 'priority')).toBe(5)
  })

  it('reads VFS custom fields (modified, accessed) from metadata', () => {
    // VFS stores `modified` as a custom field, not top-level.
    expect(resolveEntityField(entity, 'modified')).toBe(1700000120000)
  })

  it('returns undefined for unknown fields', () => {
    expect(resolveEntityField(entity, 'nonexistent')).toBeUndefined()
  })

  it('returns undefined for custom fields when metadata is absent', () => {
    const noMetadata: HNSWNounWithMetadata = { ...entity, metadata: undefined }
    expect(resolveEntityField(noMetadata, 'customTag')).toBeUndefined()
  })

  it('does not look in metadata for standard fields', () => {
    // If a standard field is absent top-level, resolver returns undefined
    // rather than silently falling through to metadata. This prevents
    // misuse from masking bugs.
    const withShadowedField: HNSWNounWithMetadata = {
      ...entity,
      // @ts-expect-error intentionally clobbering for the test
      createdAt: undefined,
      metadata: { createdAt: 9999 }
    }
    expect(resolveEntityField(withShadowedField, 'createdAt')).toBeUndefined()
  })

  it('STANDARD_ENTITY_FIELDS covers every declared top-level field', () => {
    // Guards against the resolver and the interface drifting out of sync.
    const expected = [
      'id',
      'vector',
      'connections',
      'level',
      'type',
      'confidence',
      'weight',
      'createdAt',
      'updatedAt',
      'service',
      'createdBy',
      'data'
    ]
    for (const field of expected) {
      expect(STANDARD_ENTITY_FIELDS.has(field)).toBe(true)
    }
  })
})
