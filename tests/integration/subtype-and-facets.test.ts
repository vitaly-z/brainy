/**
 * @module tests/integration/subtype-and-facets
 * @description Integration coverage for the 7.29.0 subtype-and-facets primitive
 * (Layer 1 top-level `subtype` field + rollup + counts API, Layer 2
 * `brain.trackField()`, Layer 3 `brain.migrateField()`).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType } from '../../src/types/graphTypes'

describe('Subtype + Facets (7.29.0)', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('Layer 1: subtype as top-level standard field', () => {
    it('persists subtype on add() and round-trips through get()', async () => {
      const id = await brain.add({
        data: 'Avery operates the AI lab',
        type: NounType.Person,
        subtype: 'operator',
        metadata: { department: 'ai-lab' }
      })

      const entity = await brain.get(id)
      expect(entity).not.toBeNull()
      expect(entity!.subtype).toBe('operator')
      expect(entity!.type).toBe(NounType.Person)
      // subtype lives at top-level, NOT in metadata
      expect((entity!.metadata as any).subtype).toBeUndefined()
      expect((entity!.metadata as any).department).toBe('ai-lab')
    })

    it('allows omitting subtype (optional field)', async () => {
      const id = await brain.add({ data: 'plain entity', type: NounType.Thing })
      const entity = await brain.get(id)
      expect(entity!.subtype).toBeUndefined()
    })

    it('updates subtype via update() without disturbing other fields', async () => {
      const id = await brain.add({
        data: 'switched roles',
        type: NounType.Person,
        subtype: 'contractor',
        metadata: { department: 'eng' }
      })

      await brain.update({ id, subtype: 'employee' })
      const entity = await brain.get(id)
      expect(entity!.subtype).toBe('employee')
      expect((entity!.metadata as any).department).toBe('eng')
    })

    it('preserves existing subtype when update() omits it', async () => {
      const id = await brain.add({
        data: 'unchanged subtype',
        type: NounType.Person,
        subtype: 'employee'
      })
      await brain.update({ id, metadata: { tag: 'updated' } })
      const entity = await brain.get(id)
      expect(entity!.subtype).toBe('employee')
    })

    it('find({ type, subtype }) hits the fast path and matches', async () => {
      await brain.add({ data: 'a', type: NounType.Person, subtype: 'employee' })
      await brain.add({ data: 'b', type: NounType.Person, subtype: 'employee' })
      await brain.add({ data: 'c', type: NounType.Person, subtype: 'customer' })
      await brain.add({ data: 'd', type: NounType.Document, subtype: 'employee' })

      const employees = await brain.find({ type: NounType.Person, subtype: 'employee' })
      expect(employees).toHaveLength(2)
      for (const r of employees) {
        expect(r.subtype).toBe('employee')
        expect(r.type).toBe(NounType.Person)
      }
    })

    it('find({ subtype: [...] }) matches set membership', async () => {
      await brain.add({ data: 'a', type: NounType.Person, subtype: 'employee' })
      await brain.add({ data: 'b', type: NounType.Person, subtype: 'contractor' })
      await brain.add({ data: 'c', type: NounType.Person, subtype: 'customer' })

      const both = await brain.find({
        type: NounType.Person,
        subtype: ['employee', 'contractor']
      })
      expect(both).toHaveLength(2)
      const subtypes = both.map(r => r.subtype).sort()
      expect(subtypes).toEqual(['contractor', 'employee'])
    })

    it('Result objects expose subtype at the top level', async () => {
      await brain.add({ data: 'a', type: NounType.Person, subtype: 'customer' })
      const results = await brain.find({ subtype: 'customer' })
      expect(results[0].subtype).toBe('customer')
      expect(results[0].entity?.subtype).toBe('customer')
    })
  })

  describe('Layer 1: counts API', () => {
    beforeEach(async () => {
      await brain.add({ data: 'a', type: NounType.Person, subtype: 'employee' })
      await brain.add({ data: 'b', type: NounType.Person, subtype: 'employee' })
      await brain.add({ data: 'c', type: NounType.Person, subtype: 'customer' })
      await brain.add({ data: 'd', type: NounType.Person, subtype: 'customer' })
      await brain.add({ data: 'e', type: NounType.Person, subtype: 'customer' })
      await brain.add({ data: 'f', type: NounType.Document, subtype: 'invoice' })
    })

    it('counts.bySubtype(type) returns the full breakdown', async () => {
      const counts = brain.counts.bySubtype(NounType.Person)
      expect(counts).toEqual({ employee: 2, customer: 3 })
    })

    it('counts.bySubtype(type, subtype) returns the O(1) point count', async () => {
      expect(brain.counts.bySubtype(NounType.Person, 'employee')).toBe(2)
      expect(brain.counts.bySubtype(NounType.Person, 'customer')).toBe(3)
      expect(brain.counts.bySubtype(NounType.Person, 'never-existed')).toBe(0)
    })

    it('counts.topSubtypes ranks by count, respects N', async () => {
      const top1 = brain.counts.topSubtypes(NounType.Person, 1)
      expect(top1).toEqual([['customer', 3]])

      const all = brain.counts.topSubtypes(NounType.Person, 10)
      expect(all).toEqual([
        ['customer', 3],
        ['employee', 2]
      ])
    })

    it('brain.subtypesOf(type) returns sorted distinct subtypes', async () => {
      expect(brain.subtypesOf(NounType.Person)).toEqual(['customer', 'employee'])
      expect(brain.subtypesOf(NounType.Document)).toEqual(['invoice'])
    })

    it('rollup decrements on delete', async () => {
      const id = await brain.add({ data: 'g', type: NounType.Person, subtype: 'employee' })
      expect(brain.counts.bySubtype(NounType.Person, 'employee')).toBe(3)

      await brain.delete(id)
      expect(brain.counts.bySubtype(NounType.Person, 'employee')).toBe(2)
    })

    it('rollup re-routes on subtype change via update', async () => {
      const id = await brain.add({ data: 'h', type: NounType.Person, subtype: 'employee' })
      expect(brain.counts.bySubtype(NounType.Person, 'employee')).toBe(3)
      expect(brain.counts.bySubtype(NounType.Person, 'customer')).toBe(3)

      await brain.update({ id, subtype: 'customer' })
      expect(brain.counts.bySubtype(NounType.Person, 'employee')).toBe(2)
      expect(brain.counts.bySubtype(NounType.Person, 'customer')).toBe(4)
    })
  })

  describe('Layer 2: trackField() + counts.byField()', () => {
    it('tracks a metadata field and returns value frequencies', async () => {
      brain.trackField('status')
      await brain.add({ data: 'a', type: NounType.Task, metadata: { status: 'todo' } })
      await brain.add({ data: 'b', type: NounType.Task, metadata: { status: 'todo' } })
      await brain.add({ data: 'c', type: NounType.Task, metadata: { status: 'done' } })
      await brain.add({ data: 'd', type: NounType.Task, metadata: { status: 'done' } })
      await brain.add({ data: 'e', type: NounType.Task, metadata: { status: 'done' } })

      const byStatus = await brain.counts.byField('status')
      expect(byStatus).toEqual({ todo: 2, done: 3 })
    })

    it('perType breakdown returns per-NounType counts when filtered', async () => {
      brain.trackField('status', { perType: true })
      await brain.add({ data: 'a', type: NounType.Task, metadata: { status: 'todo' } })
      await brain.add({ data: 'b', type: NounType.Task, metadata: { status: 'done' } })
      await brain.add({ data: 'c', type: NounType.Event, metadata: { status: 'todo' } })

      const taskStatuses = await brain.counts.byField('status', { type: NounType.Task })
      expect(taskStatuses).toEqual({ todo: 1, done: 1 })
    })

    it('throws when per-type breakdown requested but field tracked without perType', async () => {
      brain.trackField('status')
      await expect(
        brain.counts.byField('status', { type: NounType.Task })
      ).rejects.toThrow(/perType/)
    })

    it('returns {} for fields never registered', async () => {
      const result = await brain.counts.byField('unregistered')
      expect(result).toEqual({})
    })

    it('values whitelist rejects off-vocabulary writes', async () => {
      brain.trackField('priority', { values: ['low', 'medium', 'high'] })
      await expect(
        brain.add({ data: 'bad', type: NounType.Task, metadata: { priority: 'urgent' } })
      ).rejects.toThrow(/priority.*urgent.*vocabulary/i)
    })

    it('values whitelist accepts on-vocabulary writes', async () => {
      brain.trackField('priority', { values: ['low', 'medium', 'high'] })
      const id = await brain.add({
        data: 'ok',
        type: NounType.Task,
        metadata: { priority: 'high' }
      })
      const entity = await brain.get(id)
      expect((entity!.metadata as any).priority).toBe('high')
    })
  })

  describe('Layer 3: migrateField()', () => {
    it('migrates metadata.X → top-level subtype and clears the source', async () => {
      // Set up the legacy shape: store kind inside metadata.
      const id1 = await brain.add({
        data: 'a',
        type: NounType.Person,
        metadata: { kind: 'employee', department: 'eng' }
      })
      const id2 = await brain.add({
        data: 'b',
        type: NounType.Person,
        metadata: { kind: 'customer' }
      })

      const result = await brain.migrateField({
        from: 'metadata.kind',
        to: 'subtype'
      })
      expect(result.errors).toEqual([])
      expect(result.migrated).toBe(2)
      expect(result.scanned).toBeGreaterThanOrEqual(2)

      const e1 = await brain.get(id1)
      expect(e1!.subtype).toBe('employee')
      expect((e1!.metadata as any).kind).toBeUndefined()
      expect((e1!.metadata as any).department).toBe('eng')

      const e2 = await brain.get(id2)
      expect(e2!.subtype).toBe('customer')
      expect((e2!.metadata as any).kind).toBeUndefined()
    })

    it('readBoth: true preserves the source field for the deprecation window', async () => {
      const id = await brain.add({
        data: 'a',
        type: NounType.Person,
        metadata: { kind: 'employee' }
      })

      const result = await brain.migrateField({
        from: 'metadata.kind',
        to: 'subtype',
        readBoth: true
      })
      expect(result.migrated).toBe(1)

      const entity = await brain.get(id)
      expect(entity!.subtype).toBe('employee')
      expect((entity!.metadata as any).kind).toBe('employee')
    })

    it('is idempotent — re-running on already-migrated data is a no-op', async () => {
      await brain.add({
        data: 'a',
        type: NounType.Person,
        metadata: { kind: 'employee' }
      })

      await brain.migrateField({ from: 'metadata.kind', to: 'subtype' })
      const second = await brain.migrateField({ from: 'metadata.kind', to: 'subtype' })
      // All entities have already migrated → every entity is skipped on the second pass
      expect(second.migrated).toBe(0)
      expect(second.skipped).toBeGreaterThan(0)
    })

    it('migrates data.X → subtype (when data is an object)', async () => {
      const id = await brain.add({
        data: { description: 'thing', kind: 'character' } as any,
        type: NounType.Person
      })

      const result = await brain.migrateField({ from: 'data.kind', to: 'subtype' })
      expect(result.migrated).toBe(1)
      expect(result.errors).toEqual([])

      const entity = await brain.get(id)
      expect(entity!.subtype).toBe('character')
      expect((entity!.data as any).description).toBe('thing')
      expect((entity!.data as any).kind).toBeUndefined()
    })

    it('throws on identical from/to', async () => {
      await expect(
        brain.migrateField({ from: 'subtype', to: 'subtype' })
      ).rejects.toThrow(/identical/)
    })

    it('rejects unsupported path prefixes', async () => {
      await expect(
        brain.migrateField({ from: 'metadata.kind', to: 'connections.foo' })
      ).rejects.toThrow(/unsupported path prefix/)
    })

    it('migrates with the rollup tracking the new subtype counts', async () => {
      await brain.add({
        data: 'a',
        type: NounType.Person,
        metadata: { kind: 'employee' }
      })
      await brain.add({
        data: 'b',
        type: NounType.Person,
        metadata: { kind: 'customer' }
      })

      await brain.migrateField({ from: 'metadata.kind', to: 'subtype' })

      // Rollup should now reflect the new subtype values
      expect(brain.counts.bySubtype(NounType.Person)).toEqual({
        employee: 1,
        customer: 1
      })
    })
  })
})
