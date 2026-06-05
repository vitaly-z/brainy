/**
 * @module tests/integration/verb-subtype-and-enforcement
 * @description Integration coverage for the 7.30.0 verb subtype mirror +
 * opt-in enforcement primitives:
 *
 * - Layer V1: `subtype` on `relate()` / `Relation` / `RelateParams` round-trips
 *   through `getRelations({ subtype })`, the new `updateRelation()` method, and
 *   the persisted verb-subtype rollup.
 * - Layer V2: `brain.counts.byRelationshipSubtype` / `topRelationshipSubtypes`
 *   / `brain.relationshipSubtypesOf` mirror the noun-side counts API.
 * - Layer V3: `find({ connected: { via, subtype } })` filters traversal edges.
 * - Layer V4: `migrateField({ entityKind: 'verb' \| 'both' })` rewrites verb
 *   fields.
 * - Layer V5: `brain.requireSubtype(type, opts)` per-type rules + brain-wide
 *   strict mode (`new Brainy({ requireSubtype: true })`) reject every write
 *   path missing or off-vocabulary.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType, VerbType } from '../../src/types/graphTypes'

describe('Verb subtype + enforcement (7.30.0)', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('Layer V1: subtype on relationships', () => {
    it('persists subtype on relate() and round-trips through getRelations()', async () => {
      const fromId = await brain.add({ data: 'Avery', type: NounType.Person })
      const toId = await brain.add({ data: 'Jordan', type: NounType.Person })

      const relId = await brain.relate({
        from: fromId,
        to: toId,
        type: VerbType.ReportsTo,
        subtype: 'direct'
      })

      const all = await brain.getRelations({ from: fromId })
      const found = all.find(r => r.id === relId)
      expect(found).toBeDefined()
      expect(found!.subtype).toBe('direct')
      expect(found!.type).toBe(VerbType.ReportsTo)
    })

    it('getRelations({ subtype }) filters by single value', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Person })
      const b = await brain.add({ data: 'B', type: NounType.Person })
      const c = await brain.add({ data: 'C', type: NounType.Person })

      await brain.relate({ from: a, to: b, type: VerbType.ReportsTo, subtype: 'direct' })
      await brain.relate({ from: a, to: c, type: VerbType.ReportsTo, subtype: 'dotted-line' })

      const direct = await brain.getRelations({ from: a, subtype: 'direct' })
      expect(direct).toHaveLength(1)
      expect(direct[0].to).toBe(b)
      expect(direct[0].subtype).toBe('direct')
    })

    it('getRelations({ subtype: [...] }) filters by set membership', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Person })
      const b = await brain.add({ data: 'B', type: NounType.Person })
      const c = await brain.add({ data: 'C', type: NounType.Person })
      const d = await brain.add({ data: 'D', type: NounType.Person })

      await brain.relate({ from: a, to: b, type: VerbType.ReportsTo, subtype: 'direct' })
      await brain.relate({ from: a, to: c, type: VerbType.ReportsTo, subtype: 'dotted-line' })
      await brain.relate({ from: a, to: d, type: VerbType.ReportsTo, subtype: 'matrix' })

      const both = await brain.getRelations({
        from: a,
        type: VerbType.ReportsTo,
        subtype: ['direct', 'dotted-line']
      })
      expect(both).toHaveLength(2)
      expect(both.map(r => r.subtype).sort()).toEqual(['direct', 'dotted-line'])
    })

    it('updateRelation() changes the subtype in place', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Person })
      const b = await brain.add({ data: 'B', type: NounType.Person })
      const relId = await brain.relate({
        from: a,
        to: b,
        type: VerbType.ReportsTo,
        subtype: 'direct'
      })

      await brain.updateRelation({ id: relId, subtype: 'dotted-line' })

      const after = await brain.getRelations({ from: a, type: VerbType.ReportsTo })
      const found = after.find(r => r.id === relId)
      expect(found!.subtype).toBe('dotted-line')
    })

    it('updateRelation() preserves subtype when omitted', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Person })
      const b = await brain.add({ data: 'B', type: NounType.Person })
      const relId = await brain.relate({
        from: a,
        to: b,
        type: VerbType.ReportsTo,
        subtype: 'direct'
      })

      await brain.updateRelation({ id: relId, weight: 0.5 })

      const after = await brain.getRelations({ from: a, type: VerbType.ReportsTo })
      const found = after.find(r => r.id === relId)
      expect(found!.subtype).toBe('direct')
      expect(found!.weight).toBe(0.5)
    })

    it('updateRelation() rejects empty updates', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Person })
      const b = await brain.add({ data: 'B', type: NounType.Person })
      const relId = await brain.relate({ from: a, to: b, type: VerbType.ReportsTo })

      await expect(brain.updateRelation({ id: relId })).rejects.toThrow(/at least one field/)
    })
  })

  describe('Layer V2: verb counts API', () => {
    beforeEach(async () => {
      const a = await brain.add({ data: 'A', type: NounType.Person })
      const b = await brain.add({ data: 'B', type: NounType.Person })
      const c = await brain.add({ data: 'C', type: NounType.Person })
      const d = await brain.add({ data: 'D', type: NounType.Person })
      await brain.relate({ from: a, to: b, type: VerbType.ReportsTo, subtype: 'direct' })
      await brain.relate({ from: a, to: c, type: VerbType.ReportsTo, subtype: 'direct' })
      await brain.relate({ from: a, to: d, type: VerbType.ReportsTo, subtype: 'dotted-line' })
      await brain.relate({ from: b, to: c, type: VerbType.WorksWith, subtype: 'collaborator' })
    })

    it('counts.byRelationshipSubtype(verb) returns the breakdown', async () => {
      const manages = brain.counts.byRelationshipSubtype(VerbType.ReportsTo)
      expect(manages).toEqual({ direct: 2, 'dotted-line': 1 })
    })

    it('counts.byRelationshipSubtype(verb, subtype) returns the O(1) point count', async () => {
      expect(brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'direct')).toBe(2)
      expect(brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'dotted-line')).toBe(1)
      expect(brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'never-existed')).toBe(0)
    })

    it('counts.topRelationshipSubtypes ranks by count', async () => {
      const top = brain.counts.topRelationshipSubtypes(VerbType.ReportsTo, 10)
      expect(top).toEqual([
        ['direct', 2],
        ['dotted-line', 1]
      ])
    })

    it('brain.relationshipSubtypesOf returns sorted distinct subtypes', async () => {
      expect(brain.relationshipSubtypesOf(VerbType.ReportsTo)).toEqual([
        'direct',
        'dotted-line'
      ])
      expect(brain.relationshipSubtypesOf(VerbType.WorksWith)).toEqual(['collaborator'])
    })

    it('rollup decrements on unrelate()', async () => {
      const a = await brain.add({ data: 'X', type: NounType.Person })
      const b = await brain.add({ data: 'Y', type: NounType.Person })
      const relId = await brain.relate({
        from: a,
        to: b,
        type: VerbType.ReportsTo,
        subtype: 'direct'
      })
      expect(brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'direct')).toBe(3)

      await brain.unrelate(relId)
      expect(brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'direct')).toBe(2)
    })

    it('rollup re-routes on updateRelation() subtype change', async () => {
      const a = await brain.add({ data: 'X', type: NounType.Person })
      const b = await brain.add({ data: 'Y', type: NounType.Person })
      const relId = await brain.relate({
        from: a,
        to: b,
        type: VerbType.ReportsTo,
        subtype: 'direct'
      })
      expect(brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'direct')).toBe(3)
      expect(brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'dotted-line')).toBe(1)

      await brain.updateRelation({ id: relId, subtype: 'dotted-line' })
      expect(brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'direct')).toBe(2)
      expect(brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'dotted-line')).toBe(2)
    })
  })

  describe('Layer V3: find({ connected, subtype }) traversal filter', () => {
    it('filters depth-1 traversal by edge subtype', async () => {
      const ceo = await brain.add({ data: 'Avery', type: NounType.Person })
      const vp1 = await brain.add({ data: 'Jordan', type: NounType.Person })
      const vp2 = await brain.add({ data: 'Sam', type: NounType.Person })
      const matrix = await brain.add({ data: 'Lee', type: NounType.Person })

      await brain.relate({ from: ceo, to: vp1, type: VerbType.ReportsTo, subtype: 'direct' })
      await brain.relate({ from: ceo, to: vp2, type: VerbType.ReportsTo, subtype: 'direct' })
      await brain.relate({ from: ceo, to: matrix, type: VerbType.ReportsTo, subtype: 'dotted-line' })

      const directReports = await brain.find({
        connected: {
          from: ceo,
          via: VerbType.ReportsTo,
          subtype: 'direct',
          depth: 1
        }
      })
      const ids = directReports.map(r => r.id).sort()
      expect(ids).toEqual([vp1, vp2].sort())
    })

    it('rejects depth > 1 with subtype filter (Cortex native path will land it)', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Person })
      await expect(
        brain.find({
          connected: { from: a, via: VerbType.ReportsTo, subtype: 'direct', depth: 2 }
        })
      ).rejects.toThrow(/depth > 1/)
    })
  })

  describe('Layer V4: migrateField({ entityKind })', () => {
    it("migrates verb metadata.kind → top-level subtype with entityKind: 'verb'", async () => {
      const a = await brain.add({ data: 'A', type: NounType.Person })
      const b = await brain.add({ data: 'B', type: NounType.Person })

      const relId = await brain.relate({
        from: a,
        to: b,
        type: VerbType.RelatedTo,
        metadata: { kind: 'spouse' }
      })

      const result = await brain.migrateField({
        from: 'metadata.kind',
        to: 'subtype',
        entityKind: 'verb'
      })
      expect(result.errors).toEqual([])
      expect(result.migrated).toBe(1)

      const after = await brain.getRelations({ from: a })
      const found = after.find(r => r.id === relId)
      expect(found!.subtype).toBe('spouse')
      expect((found!.metadata as any).kind).toBeUndefined()
    })

    it("migrates both noun and verb fields with entityKind: 'both'", async () => {
      const a = await brain.add({
        data: 'A',
        type: NounType.Person,
        metadata: { kind: 'employee' }
      })
      const b = await brain.add({
        data: 'B',
        type: NounType.Person,
        metadata: { kind: 'employee' }
      })
      await brain.relate({
        from: a,
        to: b,
        type: VerbType.RelatedTo,
        metadata: { kind: 'colleague' }
      })

      const result = await brain.migrateField({
        from: 'metadata.kind',
        to: 'subtype',
        entityKind: 'both'
      })
      expect(result.errors).toEqual([])
      expect(result.migrated).toBe(3) // 2 nouns + 1 verb

      const ea = await brain.get(a)
      expect(ea!.subtype).toBe('employee')
      const eb = await brain.get(b)
      expect(eb!.subtype).toBe('employee')
      const rels = await brain.getRelations({ from: a })
      expect(rels[0].subtype).toBe('colleague')
    })

    it("readBoth: true on verb migration preserves the source field", async () => {
      const a = await brain.add({ data: 'A', type: NounType.Person })
      const b = await brain.add({ data: 'B', type: NounType.Person })
      const relId = await brain.relate({
        from: a,
        to: b,
        type: VerbType.RelatedTo,
        metadata: { kind: 'sibling' }
      })

      const result = await brain.migrateField({
        from: 'metadata.kind',
        to: 'subtype',
        entityKind: 'verb',
        readBoth: true
      })
      expect(result.migrated).toBe(1)

      const rels = await brain.getRelations({ from: a })
      const found = rels.find(r => r.id === relId)
      expect(found!.subtype).toBe('sibling')
      expect((found!.metadata as any).kind).toBe('sibling')
    })
  })

  describe('Layer V5: enforcement', () => {
    describe('per-type registration (brain.requireSubtype)', () => {
      it("requireSubtype(NounType, { required }) rejects add() without subtype", async () => {
        brain.requireSubtype(NounType.Person, { required: true })

        await expect(
          brain.add({ data: 'no subtype', type: NounType.Person })
        ).rejects.toThrow(/requires subtype/)
      })

      it("requireSubtype with values rejects off-vocabulary on add()", async () => {
        brain.requireSubtype(NounType.Person, {
          values: ['employee', 'customer'],
          required: true
        })

        await expect(
          brain.add({ data: 'bad', type: NounType.Person, subtype: 'vendor' })
        ).rejects.toThrow(/not in registered vocabulary/)
      })

      it("requireSubtype with values accepts on-vocabulary", async () => {
        brain.requireSubtype(NounType.Person, {
          values: ['employee', 'customer'],
          required: true
        })

        const id = await brain.add({
          data: 'ok',
          type: NounType.Person,
          subtype: 'employee'
        })
        expect(id).toBeDefined()
      })

      it("requireSubtype(VerbType, { required }) rejects relate() without subtype", async () => {
        const a = await brain.add({ data: 'A', type: NounType.Person })
        const b = await brain.add({ data: 'B', type: NounType.Person })
        brain.requireSubtype(VerbType.ReportsTo, { required: true })

        await expect(
          brain.relate({ from: a, to: b, type: VerbType.ReportsTo })
        ).rejects.toThrow(/requires subtype/)
      })

      it("requireSubtype(VerbType, values) rejects off-vocabulary on relate()", async () => {
        const a = await brain.add({ data: 'A', type: NounType.Person })
        const b = await brain.add({ data: 'B', type: NounType.Person })
        brain.requireSubtype(VerbType.ReportsTo, {
          values: ['direct', 'dotted-line'],
          required: true
        })

        await expect(
          brain.relate({ from: a, to: b, type: VerbType.ReportsTo, subtype: 'matrix' })
        ).rejects.toThrow(/not in registered vocabulary/)
      })

      it('enforcement applies to addMany() — atomic-fail, no partial writes', async () => {
        brain.requireSubtype(NounType.Person, { required: true })

        await expect(
          brain.addMany({
            items: [
              { data: 'ok', type: NounType.Person, subtype: 'employee' },
              { data: 'missing', type: NounType.Person }
            ]
          })
        ).rejects.toThrow(/item\[1\] failed subtype enforcement/)

        // Verify no partial writes — first item should NOT be persisted
        const persons = await brain.find({ type: NounType.Person, subtype: 'employee' })
        expect(persons).toHaveLength(0)
      })

      it('enforcement applies to relateMany() — atomic-fail', async () => {
        const a = await brain.add({ data: 'A', type: NounType.Person })
        const b = await brain.add({ data: 'B', type: NounType.Person })
        const c = await brain.add({ data: 'C', type: NounType.Person })
        brain.requireSubtype(VerbType.ReportsTo, { required: true })

        await expect(
          brain.relateMany({
            items: [
              { from: a, to: b, type: VerbType.ReportsTo, subtype: 'direct' },
              { from: a, to: c, type: VerbType.ReportsTo }
            ]
          })
        ).rejects.toThrow(/item\[1\] failed subtype enforcement/)
      })

      it('enforcement applies to update() when changing subtype', async () => {
        brain.requireSubtype(NounType.Person, {
          values: ['employee', 'customer'],
          required: true
        })
        const id = await brain.add({
          data: 'ok',
          type: NounType.Person,
          subtype: 'employee'
        })

        await expect(
          brain.update({ id, subtype: 'vendor' })
        ).rejects.toThrow(/not in registered vocabulary/)
      })

      it('enforcement applies to updateRelation() when changing subtype', async () => {
        const a = await brain.add({ data: 'A', type: NounType.Person })
        const b = await brain.add({ data: 'B', type: NounType.Person })
        brain.requireSubtype(VerbType.ReportsTo, {
          values: ['direct', 'dotted-line'],
          required: true
        })

        const relId = await brain.relate({
          from: a,
          to: b,
          type: VerbType.ReportsTo,
          subtype: 'direct'
        })

        await expect(
          brain.updateRelation({ id: relId, subtype: 'matrix' })
        ).rejects.toThrow(/not in registered vocabulary/)
      })
    })

    describe('brain-wide strict mode', () => {
      it('new Brainy({ requireSubtype: true }) rejects every add() without subtype', async () => {
        await brain.close()
        brain = new Brainy({
          storage: { type: 'memory' },
          silent: true,
          requireSubtype: true
        })
        await brain.init()

        await expect(
          brain.add({ data: 'no subtype', type: NounType.Person })
        ).rejects.toThrow(/requires subtype/)
      })

      it('strict mode accepts writes with subtype', async () => {
        await brain.close()
        brain = new Brainy({
          storage: { type: 'memory' },
          silent: true,
          requireSubtype: true
        })
        await brain.init()

        const id = await brain.add({
          data: 'ok',
          type: NounType.Person,
          subtype: 'employee'
        })
        expect(id).toBeDefined()
      })

      it('strict mode rejects relate() without subtype', async () => {
        await brain.close()
        brain = new Brainy({
          storage: { type: 'memory' },
          silent: true,
          requireSubtype: true
        })
        await brain.init()

        const a = await brain.add({ data: 'A', type: NounType.Person, subtype: 'employee' })
        const b = await brain.add({ data: 'B', type: NounType.Person, subtype: 'employee' })

        await expect(
          brain.relate({ from: a, to: b, type: VerbType.ReportsTo })
        ).rejects.toThrow(/requires subtype/)
      })

      it('except clause allows listed types through without subtype', async () => {
        await brain.close()
        brain = new Brainy({
          storage: { type: 'memory' },
          silent: true,
          requireSubtype: { except: [NounType.Thing] }
        })
        await brain.init()

        // Thing is exempt — should succeed without subtype
        const thing = await brain.add({ data: 'a generic thing', type: NounType.Thing })
        expect(thing).toBeDefined()

        // Person is not exempt — should require subtype
        await expect(
          brain.add({ data: 'no subtype', type: NounType.Person })
        ).rejects.toThrow(/requires subtype/)
      })
    })
  })
})
