/**
 * @module brainy/update-reserved-metadata-remap.test
 * @description Regression tests for the reserved-field metadata-patch trap
 * (7.31.6). `add({metadata: {confidence}})` lifts reserved fields to their
 * canonical top-level location, but pre-7.31.6 `update({metadata:
 * {confidence}})` silently dropped the same shape — the patch value survived
 * the merge and was then clobbered by the preserve-existing spread. A
 * production consumer's confidence-evolution writes no-oped for weeks before
 * being caught by reading values back.
 *
 * Contract under test: update() remaps user-mutable reserved fields
 * (confidence, weight, subtype) from the metadata patch to top-level
 * (top-level param wins when both are present), and drops system-managed
 * fields (createdAt, _rev, noun, data, ...) from patches with a warning.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/index.js'

describe('update() reserved-field metadata-patch remap (7.31.6)', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  it('remaps metadata.confidence to the top-level field (the production repro)', async () => {
    const id = await brain.add({
      type: 'concept',
      subtype: 'general',
      data: 'x',
      metadata: { confidence: 0.8 }
    })

    // Top-level write works (always did)
    await brain.update({ id, confidence: 0.42 })
    let entity = await brain.get(id)
    expect(entity?.confidence).toBe(0.42)

    // Metadata-patch write — silently dropped pre-7.31.6, remapped now
    await brain.update({ id, metadata: { confidence: 0.33 } })
    entity = await brain.get(id)
    expect(entity?.confidence).toBe(0.33)
    // The reserved key must not linger inside the metadata bag
    expect((entity?.metadata as any)?.confidence).toBeUndefined()
  })

  it('remaps metadata.weight and metadata.subtype the same way', async () => {
    const id = await brain.add({
      type: 'concept',
      subtype: 'general',
      data: 'y',
      metadata: {}
    })

    await brain.update({ id, metadata: { weight: 0.7, subtype: 'specialized' } })
    const entity = await brain.get(id)
    expect(entity?.weight).toBe(0.7)
    expect(entity?.subtype).toBe('specialized')
    expect((entity?.metadata as any)?.weight).toBeUndefined()
    expect((entity?.metadata as any)?.subtype).toBeUndefined()
  })

  it('top-level param wins when both top-level and metadata-patch carry the field', async () => {
    const id = await brain.add({
      type: 'concept',
      subtype: 'general',
      data: 'z',
      metadata: { confidence: 0.5 }
    })

    await brain.update({ id, confidence: 0.9, metadata: { confidence: 0.1 } })
    const entity = await brain.get(id)
    expect(entity?.confidence).toBe(0.9)
  })

  it('drops system-managed fields from patches without corrupting the entity', async () => {
    const id = await brain.add({
      type: 'concept',
      subtype: 'general',
      data: 'w',
      metadata: { keep: 'me' }
    })
    const before = await brain.get(id)

    await brain.update({
      id,
      metadata: { createdAt: 1, _rev: 999, noun: 'organization', other: 'applied' }
    })
    const after = await brain.get(id)

    expect(after?.createdAt).toBe(before?.createdAt) // immutable
    expect(after?.type).toBe('concept') // noun patch ignored
    expect((after?.metadata as any)?.other).toBe('applied') // custom fields still merge
    expect((after?.metadata as any)?.keep).toBe('me')
    expect((after?.metadata as any)?._rev_).toBeUndefined()
  })

  it('custom (non-reserved) metadata patches are unaffected by the remap', async () => {
    const id = await brain.add({
      type: 'concept',
      subtype: 'general',
      data: 'v',
      metadata: { status: 'draft' }
    })

    await brain.update({ id, metadata: { status: 'reviewed', rating: 4.5 } })
    const entity = await brain.get(id)
    expect((entity?.metadata as any)?.status).toBe('reviewed')
    expect((entity?.metadata as any)?.rating).toBe(4.5)
  })
})
