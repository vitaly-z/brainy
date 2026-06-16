/**
 * Unit tests for the portable graph backup/restore API (brain.data()).
 *
 * Exercises BackupData v1 export()/import(): real round-trips against in-memory
 * storage (no mocks of the API under test) — selectors, edge policy, vectors,
 * conflict handling, id remapping, subtype fidelity, and cross-version guards.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Brainy } from '../../../src/brainy'
import { createTestConfig } from '../../helpers/test-factory'
import { NounType, VerbType } from '../../../src/types/graphTypes'
import type { BackupData } from '../../../src/api/DataAPI'

const VFS_ROOT_ID = '00000000-0000-0000-0000-000000000000'

describe('DataAPI — portable graph backup/restore (BackupData v1)', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy(createTestConfig())
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('format + whole-brain round-trip', () => {
    it('exports a self-describing, versioned BackupData document', async () => {
      const a = await brain.add({ data: 'Alice', type: NounType.Person, subtype: 'employee' })
      const b = await brain.add({ data: 'Acme', type: NounType.Organization })
      await brain.relate({ from: a, to: b, type: VerbType.WorksWith, subtype: 'full-time' })

      const backup = await brain.data().then((d) => d.export())

      expect(backup.format).toBe('brainy-backup')
      expect(backup.formatVersion).toBe(1)
      expect(typeof backup.brainyVersion).toBe('string')
      expect(backup.brainyVersion.length).toBeGreaterThan(0)
      expect(typeof backup.createdAt).toBe('string')
      expect(backup.embedding.dimensions).toBeGreaterThan(0)
      expect(backup.stats.entityCount).toBe(backup.entities.length)
      expect(backup.stats.relationCount).toBe(backup.relations.length)
      // Two user entities, one relation (VFS root excluded by default).
      expect(backup.entities.map((e) => e.id).sort()).toEqual([a, b].sort())
      expect(backup.relations).toHaveLength(1)
    })

    it('round-trips entities and relations through clear() + import()', async () => {
      const a = await brain.add({ data: 'Alice', type: NounType.Person })
      const b = await brain.add({ data: 'Bob', type: NounType.Person })
      const c = await brain.add({ data: 'Carol', type: NounType.Person })
      await brain.relate({ from: a, to: b, type: VerbType.FriendOf })
      await brain.relate({ from: b, to: c, type: VerbType.FriendOf })

      const backup = await brain.data().then((d) => d.export({}, { includeVectors: true }))

      await brain.data().then((d) => d.clear())
      const afterClear = await brain.find({ limit: 1000 })
      expect(afterClear.filter((r) => [a, b, c].includes(r.id))).toHaveLength(0)

      const result = await brain.data().then((d) => d.import(backup))
      expect(result.imported).toBe(3)
      expect(result.errors).toHaveLength(0)

      const ra = await brain.get(a)
      expect(ra?.id).toBe(a)
      const rels = await brain.getRelations({ from: a })
      expect(rels.some((r) => r.to === b && r.type === VerbType.FriendOf)).toBe(true)
    })

    it('preserves subtype on both entities and relations', async () => {
      const a = await brain.add({ data: 'Doc', type: NounType.Document, subtype: 'invoice' })
      const b = await brain.add({ data: 'Doc2', type: NounType.Document, subtype: 'receipt' })
      await brain.relate({ from: a, to: b, type: VerbType.RelatedTo, subtype: 'supersedes' })

      const backup = await brain.data().then((d) => d.export())

      const ea = backup.entities.find((e) => e.id === a)
      expect(ea?.subtype).toBe('invoice')
      expect(backup.relations[0].subtype).toBe('supersedes')
    })
  })

  describe('selectors', () => {
    it('ids — exports exactly the requested entities', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Thing })
      const b = await brain.add({ data: 'B', type: NounType.Thing })
      await brain.add({ data: 'C', type: NounType.Thing })

      const backup = await brain.data().then((d) => d.export({ ids: [a, b] }))
      expect(backup.entities.map((e) => e.id).sort()).toEqual([a, b].sort())
    })

    it('collection — exports the collection plus its transitive Contains members', async () => {
      const root = await brain.add({ data: 'Folder', type: NounType.Collection })
      const child1 = await brain.add({ data: 'Child1', type: NounType.Document })
      const child2 = await brain.add({ data: 'Child2', type: NounType.Document })
      const grandchild = await brain.add({ data: 'Grandchild', type: NounType.Document })
      await brain.add({ data: 'Outside', type: NounType.Document })
      await brain.relate({ from: root, to: child1, type: VerbType.Contains })
      await brain.relate({ from: root, to: child2, type: VerbType.Contains })
      await brain.relate({ from: child1, to: grandchild, type: VerbType.Contains })

      const backup = await brain.data().then((d) => d.export({ collection: root }))
      expect(backup.entities.map((e) => e.id).sort()).toEqual(
        [root, child1, child2, grandchild].sort()
      )
    })

    it('connected — exports an N-hop neighbourhood', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Thing })
      const b = await brain.add({ data: 'B', type: NounType.Thing })
      const c = await brain.add({ data: 'C', type: NounType.Thing })
      await brain.relate({ from: a, to: b, type: VerbType.RelatedTo })
      await brain.relate({ from: b, to: c, type: VerbType.RelatedTo })

      const depth1 = await brain.data().then((d) => d.export({ connected: { from: a, depth: 1 } }))
      expect(depth1.entities.map((e) => e.id).sort()).toEqual([a, b].sort())

      const depth2 = await brain.data().then((d) => d.export({ connected: { from: a, depth: 2 } }))
      expect(depth2.entities.map((e) => e.id).sort()).toEqual([a, b, c].sort())
    })

    it('predicate — filters by type', async () => {
      await brain.add({ data: 'P', type: NounType.Person })
      await brain.add({ data: 'D', type: NounType.Document })
      const backup = await brain.data().then((d) => d.export({ type: NounType.Person }))
      expect(backup.entities.every((e) => e.type === NounType.Person)).toBe(true)
      expect(backup.entities).toHaveLength(1)
    })

    it('compose — structural selector + predicate filter', async () => {
      const root = await brain.add({ data: 'Folder', type: NounType.Collection })
      const open = await brain.add({
        data: 'Open',
        type: NounType.Document,
        metadata: { status: 'open' }
      })
      const closed = await brain.add({
        data: 'Closed',
        type: NounType.Document,
        metadata: { status: 'closed' }
      })
      await brain.relate({ from: root, to: open, type: VerbType.Contains })
      await brain.relate({ from: root, to: closed, type: VerbType.Contains })

      const backup = await brain
        .data()
        .then((d) => d.export({ collection: root, where: { status: 'open' } }))
      expect(backup.entities.map((e) => e.id)).toContain(open)
      expect(backup.entities.map((e) => e.id)).not.toContain(closed)
    })
  })

  describe('edge policy', () => {
    let a: string
    let b: string
    let c: string

    beforeEach(async () => {
      a = await brain.add({ data: 'A', type: NounType.Thing })
      b = await brain.add({ data: 'B', type: NounType.Thing })
      c = await brain.add({ data: 'C', type: NounType.Thing })
      await brain.relate({ from: a, to: b, type: VerbType.RelatedTo }) // both in {a,b}
      await brain.relate({ from: b, to: c, type: VerbType.RelatedTo }) // dangles to c
    })

    it('induced (default) — only edges with both endpoints in the set', async () => {
      const backup = await brain.data().then((d) => d.export({ ids: [a, b] }))
      expect(backup.relations).toHaveLength(1)
      expect(backup.relations[0].from).toBe(a)
      expect(backup.danglingIds).toBeUndefined()
    })

    it('incident — includes dangling edges + records danglingIds', async () => {
      const backup = await brain.data().then((d) => d.export({ ids: [a, b] }, { edges: 'incident' }))
      expect(backup.relations).toHaveLength(2)
      expect(backup.danglingIds).toContain(c)
    })

    it('none — nodes only', async () => {
      const backup = await brain.data().then((d) => d.export({ ids: [a, b] }, { edges: 'none' }))
      expect(backup.relations).toHaveLength(0)
    })
  })

  describe('vectors + re-embedding', () => {
    it('omits vectors by default and re-embeds on import', async () => {
      const a = await brain.add({ data: 'Re-embed me', type: NounType.Thing })
      const backup = await brain.data().then((d) => d.export({ ids: [a] }))
      expect(backup.entities[0].vector).toBeUndefined()

      await brain.data().then((d) => d.clear())
      const result = await brain.data().then((d) => d.import(backup))
      expect(result.reembedded).toBe(1)

      const restored = await brain.get(a, { includeVectors: true })
      expect(restored?.vector?.length).toBeGreaterThan(0)
    })

    it('carries vectors verbatim with includeVectors (no re-embed)', async () => {
      const a = await brain.add({ data: 'Keep my vector', type: NounType.Thing })
      const original = await brain.get(a, { includeVectors: true })

      const backup = await brain.data().then((d) => d.export({ ids: [a] }, { includeVectors: true }))
      expect(backup.entities[0].vector?.length).toBe(original?.vector?.length)

      await brain.data().then((d) => d.clear())
      const result = await brain.data().then((d) => d.import(backup))
      expect(result.reembedded).toBe(0)

      const restored = await brain.get(a, { includeVectors: true })
      expect(restored?.vector).toEqual(original?.vector)
    })

    it('reembed:never records an error when no vector is carried', async () => {
      const a = await brain.add({ data: 'No vector', type: NounType.Thing })
      const backup = await brain.data().then((d) => d.export({ ids: [a] })) // no vectors
      await brain.data().then((d) => d.clear())

      const result = await brain.data().then((d) => d.import(backup, { reembed: 'never' }))
      expect(result.imported).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toMatch(/reembed:never/)
    })
  })

  describe('conflict handling', () => {
    it('merge (default) — updates existing entities in place', async () => {
      const a = await brain.add({ data: 'V1', type: NounType.Thing, metadata: { n: 1 } })
      const backup = await brain.data().then((d) => d.export({ ids: [a] }, { includeVectors: true }))

      await brain.update({ id: a, metadata: { n: 99 }, merge: false })
      const result = await brain.data().then((d) => d.import(backup, { onConflict: 'merge' }))
      expect(result.merged).toBe(1)
      expect(result.imported).toBe(0)

      const restored = await brain.get(a)
      expect(restored?.metadata?.n).toBe(1)
    })

    it('skip — leaves existing entities untouched', async () => {
      const a = await brain.add({ data: 'Orig', type: NounType.Thing, metadata: { n: 1 } })
      const backup = await brain.data().then((d) => d.export({ ids: [a] }))
      await brain.update({ id: a, metadata: { n: 2 }, merge: false })

      const result = await brain.data().then((d) => d.import(backup, { onConflict: 'skip' }))
      expect(result.skipped).toBe(1)
      const restored = await brain.get(a)
      expect(restored?.metadata?.n).toBe(2)
    })
  })

  describe('id remapping (clone)', () => {
    it('imports a subgraph under fresh ids', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Thing })
      const b = await brain.add({ data: 'B', type: NounType.Thing })
      await brain.relate({ from: a, to: b, type: VerbType.RelatedTo })
      const backup = await brain.data().then((d) => d.export({ ids: [a, b] }, { includeVectors: true }))

      const remap = new Map<string, string>([
        [a, randomUUID()],
        [b, randomUUID()]
      ])
      const result = await brain
        .data()
        .then((d) => d.import(backup, { remapIds: (id) => remap.get(id) ?? id }))
      expect(result.imported).toBe(2)

      const clonedA = await brain.get(remap.get(a)!)
      expect(clonedA?.id).toBe(remap.get(a))
      // The original entities still exist (a clone, not a move).
      expect((await brain.get(a))?.id).toBe(a)
      const clonedRels = await brain.getRelations({ from: remap.get(a)! })
      expect(clonedRels.some((r) => r.to === remap.get(b))).toBe(true)
    })
  })

  describe('system entities', () => {
    it('excludes the VFS root from a whole-brain export by default', async () => {
      await brain.add({ data: 'User entity', type: NounType.Thing })
      const backup = await brain.data().then((d) => d.export())
      expect(backup.entities.map((e) => e.id)).not.toContain(VFS_ROOT_ID)
    })
  })

  describe('import validation', () => {
    it('rejects a non-BackupData payload', async () => {
      const d = await brain.data()
      await expect(d.import({ entities: [] } as any)).rejects.toThrow(/BackupData/)
    })

    it('rejects a newer formatVersion', async () => {
      const d = await brain.data()
      const future: BackupData = {
        format: 'brainy-backup',
        formatVersion: 999,
        brainyVersion: 'x',
        createdAt: new Date().toISOString(),
        embedding: { model: 'm', dimensions: 384 },
        entities: [],
        relations: [],
        stats: { entityCount: 0, relationCount: 0, blobCount: 0 }
      }
      await expect(d.import(future)).rejects.toThrow(/formatVersion/)
    })
  })
})
