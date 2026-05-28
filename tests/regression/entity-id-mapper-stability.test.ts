/**
 * Regression test: EntityIdMapper stability across rebuild.
 *
 * The foundation 2.4.0 (vector mmap store, graph link compression, column-store
 * JS↔native interchange) all key off UUID→int mappings that **must not change**
 * across a metadata-index rebuild. Previously `metadataIndex.rebuild()` called
 * `idMapper.clear()` which reset `nextId` to 1 and renumbered every UUID by
 * re-insertion order, silently invalidating any consumer that had persisted
 * int-keyed data against the old map.
 *
 * This test pins down the stability contract:
 *
 * 1. UUID→int mappings persist across a single rebuild.
 * 2. Mappings persist across many consecutive rebuilds.
 * 3. New entities added after rebuild get fresh ints greater than any prior
 *    assignment — no collisions with existing UUIDs' ints.
 * 4. Removed entities leave a permanent hole — new entities don't recycle the
 *    gap, even across a rebuild.
 * 5. `clearAllIndexData()` is the explicit, intentional nuclear path — it DOES
 *    renumber. This is the only documented way to invalidate the int space, and
 *    a warning is logged so consumers know persisted int-keyed data is now stale.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'

const DIM = 384
const makeVec = (seed = 1) =>
  new Float32Array(DIM).map((_, i) => ((i + seed) % DIM) / DIM)

describe('EntityIdMapper stability (foundation for 2.4.0)', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  async function addEntity(name: string, seed: number): Promise<string> {
    return brain.add({
      data: name,
      vector: makeVec(seed),
      type: 'thing' as any,
      metadata: { name }
    })
  }

  function getInt(uuid: string): number | undefined {
    return (brain as any).metadataIndex.idMapper.getInt(uuid)
  }

  async function rebuild(): Promise<void> {
    await (brain as any).metadataIndex.rebuild()
  }

  it('UUID→int mappings persist across a single metadata-index rebuild', async () => {
    const ids = [
      await addEntity('a', 1),
      await addEntity('b', 2),
      await addEntity('c', 3),
      await addEntity('d', 4),
      await addEntity('e', 5)
    ]
    const before = ids.map(id => getInt(id))
    expect(before.every(i => typeof i === 'number' && (i as number) > 0)).toBe(true)

    await rebuild()

    const after = ids.map(id => getInt(id))
    expect(after).toEqual(before)
  })

  it('mappings stay byte-for-byte stable across many consecutive rebuilds', async () => {
    const ids = [
      await addEntity('a', 1),
      await addEntity('b', 2),
      await addEntity('c', 3)
    ]
    const before = ids.map(id => getInt(id))

    for (let i = 0; i < 5; i++) {
      await rebuild()
      const after = ids.map(id => getInt(id))
      expect(after).toEqual(before)
    }
  })

  it('entities added after rebuild get fresh monotonic ints (no collision with existing)', async () => {
    const priorIds = [
      await addEntity('a', 1),
      await addEntity('b', 2),
      await addEntity('c', 3)
    ]
    const priorInts = priorIds.map(id => getInt(id) as number)
    const maxPrior = Math.max(...priorInts)

    await rebuild()

    const newId = await addEntity('d', 4)
    const newInt = getInt(newId) as number
    expect(newInt).toBeGreaterThan(maxPrior)
    // Prior entities' ints didn't drift.
    expect(priorIds.map(id => getInt(id))).toEqual(priorInts)
  })

  it('removed entities leave a permanent hole — new entities never recycle the gap', async () => {
    const ids = [
      await addEntity('a', 1),
      await addEntity('b', 2),
      await addEntity('c', 3),
      await addEntity('d', 4),
      await addEntity('e', 5)
    ]
    const beforeInts = ids.map(id => getInt(id) as number)
    const deletedId = ids[2]
    const deletedInt = beforeInts[2]
    const maxBefore = Math.max(...beforeInts)

    await brain.delete(deletedId)
    expect(getInt(deletedId)).toBeUndefined()

    const newId = await addEntity('f', 6)
    const newInt = getInt(newId) as number
    expect(newInt).not.toBe(deletedInt)
    expect(newInt).toBeGreaterThan(maxBefore)

    // Surviving ids keep their ints across the deletion + the add.
    const survivors = ids.filter((_, i) => i !== 2)
    const survivorIntsBefore = beforeInts.filter((_, i) => i !== 2)
    expect(survivors.map(id => getInt(id))).toEqual(survivorIntsBefore)

    // Survivors' ints also survive a rebuild after the delete.
    await rebuild()
    expect(survivors.map(id => getInt(id))).toEqual(survivorIntsBefore)
    // The deleted id is still gone after rebuild (no resurrection).
    expect(getInt(deletedId)).toBeUndefined()
  })

  it('clearAllIndexData() is the explicit nuclear path that DOES renumber', async () => {
    const id1 = await addEntity('a', 1)
    const id2 = await addEntity('b', 2)
    const priorInts = [getInt(id1) as number, getInt(id2) as number]
    expect(priorInts.every(i => i >= 1)).toBe(true)

    // Nuclear recovery: explicit destructive op. The warning logged here is
    // the only documented way to invalidate the canonical int space.
    await (brain as any).metadataIndex.clearAllIndexData()

    // Both UUIDs are gone from the mapper.
    expect(getInt(id1)).toBeUndefined()
    expect(getInt(id2)).toBeUndefined()

    // The int counter restarted from 1: the next add() gets int 1.
    const idAfter = await addEntity('c', 3)
    expect(getInt(idAfter)).toBe(1)
  })
})
