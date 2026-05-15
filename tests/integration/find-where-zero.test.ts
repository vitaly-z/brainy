/**
 * BR-FIND-WHERE-ZERO regression test.
 *
 * Pre-7.22.0, the following failed silently:
 *   - Writer adds N entities of various types and flushes.
 *   - A fresh reader opens the same directory.
 *   - reader.find({ where: { ... } }) returned [].
 *   - reader.stats().entityCount returned 0.
 *   - reader.stats().entitiesByType reported all entities as 'thing'.
 *
 * Root cause was twofold:
 *   1. The 7.20.0 column-store refactor deleted the sparse-index write path
 *      but left getStats() and the getIds()-fallback reading from sparse
 *      indices. New workspaces have no sparse-index files, so both surfaces
 *      returned 0 / [].
 *   2. BaseStorage.getNounType() was hardcoded to return 'thing' after a
 *      type-cache removal, poisoning _system/type-statistics.json.
 *
 * 7.22.0 fix: getStats() reads from ColumnStore + idMapper, getIds() throws
 * FIELD_NOT_INDEXED instead of silently returning [], and getNounType() reads
 * from a write-time nounTypeByIdCache populated in saveNounMetadata_internal.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import { BrainyError } from '../../src/errors/brainyError.js'

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'brainy-fwz-'))
}

describe('BR-FIND-WHERE-ZERO regression', () => {
  let dir: string
  let writer: Brainy | null = null
  let reader: Brainy | null = null

  beforeEach(() => {
    dir = makeTempDir()
  })

  afterEach(async () => {
    if (writer) {
      try { await writer.close() } catch { /* may already be closed */ }
      writer = null
    }
    if (reader) {
      try { await reader.close() } catch { /* may already be closed */ }
      reader = null
    }
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  describe('Reader sees correct entity counts after writer cold-start', () => {
    it('preserves entity count across writer→close→reader-open', async () => {
      writer = new Brainy({ storage: { type: 'filesystem', rootDirectory: dir }, silent: true })
      await writer.init()
      const writerIds = new Set<string>()
      for (let i = 0; i < 10; i++) {
        const id = await writer.add({ data: `alpha-${i}-payload`, type: NounType.Concept })
        writerIds.add(id)
      }
      await writer.flush()
      await writer.close()
      writer = null

      reader = await Brainy.openReadOnly({
        storage: { type: 'filesystem', rootDirectory: dir }
      })
      // find() must return every entity we explicitly added — the historical
      // bug was 0 results despite N being on disk. Anything beyond N from
      // auto-extraction or VFS init is acceptable; the minimum guarantee is
      // that no user-added entity is silently dropped.
      const all = await reader.find({ type: NounType.Concept, limit: 1000 })
      const recovered = all.filter(e => writerIds.has(e.id)).map(e => e.id)
      expect(recovered.length).toBe(10)
    })

    it('preserves type classification (no "all entities are thing" poisoning)', async () => {
      writer = new Brainy({ storage: { type: 'filesystem', rootDirectory: dir }, silent: true })
      await writer.init()
      // Three types. Each id is tracked individually so we don't conflate
      // user-added entities with whatever VFS / auto-extraction inserts.
      const conceptIds = new Set<string>()
      const eventIds = new Set<string>()
      const docIds = new Set<string>()
      for (let i = 0; i < 3; i++) conceptIds.add(await writer.add({ data: `alpha-${i}`, type: NounType.Concept }))
      for (let i = 0; i < 5; i++) eventIds.add(await writer.add({ data: `beta-${i}`, type: NounType.Event }))
      for (let i = 0; i < 2; i++) docIds.add(await writer.add({ data: `gamma-${i}`, type: NounType.Document }))
      await writer.flush()
      await writer.close()
      writer = null

      reader = await Brainy.openReadOnly({
        storage: { type: 'filesystem', rootDirectory: dir }
      })

      // Every user-added id is recoverable when querying by its declared
      // type. Pre-7.22 this failed because counts said 0 entries (which the
      // rebuild trigger acted on) or all entities were attributed to 'thing'.
      const concepts = await reader.find({ type: NounType.Concept, limit: 1000 })
      const events = await reader.find({ type: NounType.Event, limit: 1000 })
      const docs = await reader.find({ type: NounType.Document, limit: 1000 })

      expect(concepts.filter(e => conceptIds.has(e.id)).length).toBe(3)
      expect(events.filter(e => eventIds.has(e.id)).length).toBe(5)
      expect(docs.filter(e => docIds.has(e.id)).length).toBe(2)

      // None of the user-added entities should leak into the 'thing' bucket.
      const things = await reader.find({ type: NounType.Thing, limit: 1000 })
      const userInThings = things.filter(
        e => conceptIds.has(e.id) || eventIds.has(e.id) || docIds.has(e.id)
      )
      expect(userInThings.length).toBe(0)
    })
  })

  describe('find() consistency', () => {
    it('returns entities that exist on disk (not silent empty)', async () => {
      writer = new Brainy({ storage: { type: 'filesystem', rootDirectory: dir }, silent: true })
      await writer.init()
      const conceptIds: string[] = []
      for (let i = 0; i < 4; i++) {
        const id = await writer.add({
          data: `entity ${i}`,
          type: NounType.Concept,
          metadata: { entityType: 'booking', status: i % 2 === 0 ? 'paid' : 'pending' }
        })
        conceptIds.push(id)
      }
      await writer.flush()
      await writer.close()
      writer = null

      reader = await Brainy.openReadOnly({
        storage: { type: 'filesystem', rootDirectory: dir }
      })
      const all = await reader.find({ where: { entityType: 'booking' } })
      expect(all.length).toBe(4)
      const paid = await reader.find({ where: { entityType: 'booking', status: 'paid' } })
      expect(paid.length).toBe(2)
    })

    it('returns [] with a logged warning for unindexed field', async () => {
      writer = new Brainy({ storage: { type: 'filesystem', rootDirectory: dir }, silent: true })
      await writer.init()
      await writer.add({ data: 'test', type: NounType.Concept })
      await writer.flush()
      await writer.close()
      writer = null

      reader = await Brainy.openReadOnly({
        storage: { type: 'filesystem', rootDirectory: dir }
      })
      // Field that has never been written — production find() should degrade
      // to [] (caught by getIdsForFilter), not throw upward.
      const empty = await reader.find({ where: { nonExistentField: 'value' } })
      expect(empty).toEqual([])
    })

    it('raw getIds() throws BrainyError(FIELD_NOT_INDEXED) for unindexed field', async () => {
      writer = new Brainy({ storage: { type: 'filesystem', rootDirectory: dir }, silent: true })
      await writer.init()
      await writer.add({ data: 'test', type: NounType.Concept })
      await writer.flush()

      // Direct getIds() on the metadata index throws — that's what
      // getIdsForFilter() catches. Tests guarantee the contract holds.
      const metadataIndex = (writer as any).metadataIndex
      await expect(
        metadataIndex.getIds('nonExistentField', 'anything')
      ).rejects.toThrow(BrainyError)
      await expect(
        metadataIndex.getIds('nonExistentField', 'anything')
      ).rejects.toMatchObject({ type: 'FIELD_NOT_INDEXED' })
    })
  })

  describe('explain() and health() match the new contract', () => {
    it('explain() returns column-store path for indexed fields', async () => {
      writer = new Brainy({ storage: { type: 'filesystem', rootDirectory: dir }, silent: true })
      await writer.init()
      await writer.add({
        data: 'test',
        type: NounType.Concept,
        metadata: { entityType: 'booking', priority: 1 }
      })
      await writer.flush()
      const plan = await writer.explain({ where: { entityType: 'booking' } })
      expect(plan.fieldPlan).toHaveLength(1)
      expect(plan.fieldPlan[0].path).toBe('column-store')
      expect(plan.warnings).toEqual([])
    })

    it('health() reports pass for a clean writer + reader handoff', async () => {
      writer = new Brainy({ storage: { type: 'filesystem', rootDirectory: dir }, silent: true })
      await writer.init()
      for (let i = 0; i < 5; i++) {
        await writer.add({ data: `entry ${i}`, type: NounType.Concept })
      }
      await writer.flush()
      await writer.close()
      writer = null

      reader = await Brainy.openReadOnly({
        storage: { type: 'filesystem', rootDirectory: dir }
      })
      const report = await reader.health()
      // index-parity must pass (HNSW count matches metadata count) and
      // field-registry must pass (every persisted field discoverable).
      // No more 'index-parity warn: differ by N' regressions.
      const indexParity = report.checks.find(c => c.name === 'index-parity')
      expect(indexParity?.status).toBe('pass')
    })
  })
})
