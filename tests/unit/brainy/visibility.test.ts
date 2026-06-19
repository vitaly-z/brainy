/**
 * @module tests/unit/brainy/visibility
 * @description Tests for the reserved `visibility` field — the three-tier
 * (`public` | `internal` | `system`) gate that controls whether an entity or
 * relationship surfaces on default user-facing reads.
 *
 * Contract under test:
 * - Absent === `'public'`: counted and returned everywhere.
 * - `'internal'`: hidden from default `find()` / `getRelations()` / counts / `stats()`,
 *   but retrievable with `includeInternal: true`.
 * - `'system'`: Brainy plumbing (the VFS root); hidden everywhere by default,
 *   surfaced only with `includeSystem: true`. Not settable through the public
 *   `add()` / `relate()` params (the param type narrows to `'public' | 'internal'`).
 * - `visibility` is a reserved top-level field: surfaced top-level on reads, never
 *   inside `metadata`, and an untyped caller smuggling it through `metadata` is
 *   normalized (a `'public'`/`'internal'` value is lifted; `'system'` is dropped).
 *
 * THE key regression: a fresh brain reports `getNounCount() === 0` even though the
 * VFS root entity exists — because the root is `visibility: 'system'` and excluded.
 *
 * Runs under the deterministic embedder (the unit setup sets `BRAINY_UNIT_TEST`).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { NounType, VerbType } from '../../../src/types/graphTypes.js'
import { createTestConfig } from '../../helpers/test-factory'

describe('visibility (reserved field)', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy(createTestConfig())
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('counts exclude system + internal', () => {
    it('a fresh brain reports getNounCount() === 0 (the VFS root is system → excluded)', async () => {
      // KEY REGRESSION: the VFS root entity exists after init() but is
      // visibility:'system', so it must not show up in the user-facing count.
      expect(await brain.getNounCount()).toBe(0)
    })

    it('add() with no visibility is counted (public default)', async () => {
      await brain.add({ type: NounType.Concept, data: 'public thing' })
      expect(await brain.getNounCount()).toBe(1)
    })

    it('add({ visibility: "internal" }) is NOT counted', async () => {
      await brain.add({ type: NounType.Concept, data: 'public one' })
      await brain.add({ type: NounType.Concept, data: 'app-internal', visibility: 'internal' })
      // Only the public entity counts.
      expect(await brain.getNounCount()).toBe(1)
    })

    it('flipping visibility via update() moves the entity in/out of the count', async () => {
      const id = await brain.add({ type: NounType.Concept, data: 'flip me' })
      expect(await brain.getNounCount()).toBe(1)

      await brain.update({ id, visibility: 'internal' })
      expect(await brain.getNounCount()).toBe(0)

      await brain.update({ id, visibility: 'public' })
      expect(await brain.getNounCount()).toBe(1)
    })

    it('stats().entityCount reports only public entities', async () => {
      await brain.add({ type: NounType.Concept, data: 'a' })
      await brain.add({ type: NounType.Concept, data: 'b', visibility: 'internal' })
      const stats = await brain.stats()
      expect(stats.entityCount).toBe(1)
    })
  })

  describe('find() default-excludes internal + system', () => {
    it('public entities are returned; internal are hidden by default', async () => {
      const pubId = await brain.add({ type: NounType.Concept, data: 'visible' })
      await brain.add({ type: NounType.Concept, data: 'hidden', visibility: 'internal' })

      const def = await brain.find({ type: NounType.Concept, limit: 100 })
      const ids = def.map((r) => r.id)
      expect(ids).toContain(pubId)
      expect(def.length).toBe(1)
    })

    it('find({ includeInternal: true }) also returns internal entities', async () => {
      const pubId = await brain.add({ type: NounType.Concept, data: 'visible' })
      const intId = await brain.add({ type: NounType.Concept, data: 'hidden', visibility: 'internal' })

      const withInternal = await brain.find({ type: NounType.Concept, includeInternal: true, limit: 100 })
      const ids = withInternal.map((r) => r.id)
      expect(ids).toContain(pubId)
      expect(ids).toContain(intId)
      expect(withInternal.length).toBe(2)
    })

    it('empty-query find() (no filter) also excludes internal by default', async () => {
      const pubId = await brain.add({ type: NounType.Concept, data: 'visible' })
      await brain.add({ type: NounType.Concept, data: 'hidden', visibility: 'internal' })

      const all = await brain.find({ limit: 100 })
      const ids = all.map((r) => r.id)
      expect(ids).toContain(pubId)
      // Only the one public user entity (VFS root is system → excluded too).
      expect(all.length).toBe(1)
    })

    it('limit stays exact when internal entities are interleaved (hard candidate filter)', async () => {
      // Two public + two internal; a default find(limit:2) must return exactly the
      // two public ones, not get short-changed by the hidden ones.
      await brain.add({ type: NounType.Concept, data: 'pub-1' })
      await brain.add({ type: NounType.Concept, data: 'int-1', visibility: 'internal' })
      await brain.add({ type: NounType.Concept, data: 'pub-2' })
      await brain.add({ type: NounType.Concept, data: 'int-2', visibility: 'internal' })

      const page = await brain.find({ type: NounType.Concept, limit: 2 })
      expect(page.length).toBe(2)
      for (const r of page) {
        expect(r.visibility === undefined || r.visibility === 'public').toBe(true)
      }
    })
  })

  describe('the VFS root (system) entity', () => {
    it('never appears in find(), even with includeInternal', async () => {
      const rootId = '00000000-0000-0000-0000-000000000000'
      // Sanity: the root really exists (get() is an explicit by-id read, not a default surface).
      expect(await brain.get(rootId)).not.toBeNull()

      const def = await brain.find({ limit: 1000 })
      expect(def.map((r) => r.id)).not.toContain(rootId)

      const withInternal = await brain.find({ includeInternal: true, limit: 1000 })
      expect(withInternal.map((r) => r.id)).not.toContain(rootId)
    })

    it('appears only with includeSystem: true', async () => {
      const rootId = '00000000-0000-0000-0000-000000000000'
      const withSystem = await brain.find({ includeSystem: true, limit: 1000 })
      expect(withSystem.map((r) => r.id)).toContain(rootId)
    })

    it('the root carries visibility "system" when surfaced via get()', async () => {
      const rootId = '00000000-0000-0000-0000-000000000000'
      const root = await brain.get(rootId)
      expect(root?.visibility).toBe('system')
    })
  })

  describe('verbs (relationships) — symmetric to nouns', () => {
    it('relate({ visibility: "internal" }) is excluded from getVerbCount() + getRelations() by default, included with includeInternal', async () => {
      const a = await brain.add({ type: NounType.Person, data: 'a' })
      const b = await brain.add({ type: NounType.Person, data: 'b' })
      const c = await brain.add({ type: NounType.Person, data: 'c' })

      // One public edge, one internal edge from the same source.
      await brain.relate({ from: a, to: b, type: VerbType.RelatedTo })
      await brain.relate({ from: a, to: c, type: VerbType.RelatedTo, visibility: 'internal' })

      // Counts: only the public edge.
      expect(await brain.getVerbCount()).toBe(1)

      // getRelations() default: only the public edge.
      const def = await brain.getRelations({ from: a })
      expect(def.length).toBe(1)
      expect(def[0].to).toBe(b)

      // getRelations({ includeInternal }): both edges.
      const withInternal = await brain.getRelations({ from: a, includeInternal: true })
      expect(withInternal.length).toBe(2)
      expect(withInternal.map((r) => r.to).sort()).toEqual([b, c].sort())
    })
  })

  describe('visibility is a reserved top-level field', () => {
    it('is surfaced top-level on get(), never inside metadata', async () => {
      const id = await brain.add({
        type: NounType.Concept,
        data: 'x',
        visibility: 'internal',
        metadata: { kind: 'note' }
      })
      const entity = await brain.get(id)
      expect(entity?.visibility).toBe('internal')
      // metadata holds ONLY custom fields, never the reserved visibility key.
      expect(entity?.metadata).toEqual({ kind: 'note' })
      expect((entity?.metadata as Record<string, unknown>)?.visibility).toBeUndefined()
    })

    it('a public-default entity stores no visibility (absent === public)', async () => {
      const id = await brain.add({ type: NounType.Concept, data: 'plain' })
      const entity = await brain.get(id)
      // Absent — not the literal string 'public'. Kept lean on the common path.
      expect(entity?.visibility).toBeUndefined()
    })

    it('an untyped caller passing visibility inside metadata is normalized (lifted to top-level)', async () => {
      // Simulate a JavaScript caller smuggling the reserved key past the compile-time guard.
      const id = await brain.add({
        type: NounType.Concept,
        data: 'y',
        metadata: { visibility: 'internal', tag: 't' } as object
      })
      const entity = await brain.get(id)
      // Lifted to the top-level field…
      expect(entity?.visibility).toBe('internal')
      // …and stripped from the metadata bag.
      expect((entity?.metadata as Record<string, unknown>)?.visibility).toBeUndefined()
      expect((entity?.metadata as Record<string, unknown>)?.tag).toBe('t')
      // It is excluded from the default count, exactly like a top-level internal write.
      expect(await brain.getNounCount()).toBe(0)
    })

    it('a "system" value smuggled through metadata is dropped, not honored', async () => {
      // 'system' is Brainy-only; an untyped caller must not be able to set it.
      const id = await brain.add({
        type: NounType.Concept,
        data: 'z',
        metadata: { visibility: 'system' } as object
      })
      const entity = await brain.get(id)
      // The smuggled 'system' was dropped → entity stays public (counted, visible).
      expect(entity?.visibility).toBeUndefined()
      expect(await brain.getNounCount()).toBe(1)
      const found = await brain.find({ type: NounType.Concept, limit: 10 })
      expect(found.map((r) => r.id)).toContain(id)
    })
  })
})
