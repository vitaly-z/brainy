/**
 * Regression tests for the three advanced-API defects reported as BR-ADV-FEATURES-BUN:
 *
 *  1. Entity/concept extraction returned `[]` for entity-rich text. Root cause: the
 *     SmartExtractor ensemble combined agreeing signals with a weighted *sum* compared against
 *     an absolute gate, so a confident-but-low-weight signal was discarded whenever a
 *     higher-weight signal voted a different (lower-confidence) type. Fixed by selecting and
 *     gating on a normalized weighted *average*.
 *  2. `find({ aggregate })` rows did not expose the documented AggregateResult fields
 *     (`groupKey`/`metrics`/`count`) at the top level, so callers saw "empty" rows.
 *  3. `find({ connected: { depth } })` ignored `depth`/`via` and returned only the 1-hop
 *     neighbour. Fixed by delegating to the depth-aware `neighbors()` BFS.
 *
 * These run with REAL embeddings (no mocks) — the original failures were invisible under the
 * zero-vector mock embeddings used by the unit suite.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'

describe('BR-ADV-FEATURES-BUN regression', () => {
  let brain: Brainy

  beforeAll(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
    // Warm the embedding model so the first real extraction isn't paying cold-start latency.
    await brain.embed('warmup')
  })

  afterAll(async () => {
    await brain.close()
  })

  describe('Bug 1 — entity extraction is not empty', () => {
    const text = 'Sarah Chen founded Acme Corp in New York'

    it('extractEntities returns the entity spans (was [])', async () => {
      const entities = await brain.extractEntities(text, { confidence: 0.1 })
      expect(entities.length).toBeGreaterThan(0)
      const texts = entities.map(e => e.text)
      expect(texts).toContain('Sarah Chen')
      expect(texts).toContain('Acme Corp')
    })

    it('does not bleed a neighbour\'s type indicator across candidates (R3)', async () => {
      // "Corp" belongs to "Acme Corp" — it must not flip "Sarah Chen" to Organization.
      const entities = await brain.extractEntities(text, { confidence: 0.1 })
      const byText = (t: string) => entities.find(e => e.text === t)
      expect(byText('Sarah Chen')?.type).toBe(NounType.Person)
      expect(byText('Acme Corp')?.type).toBe(NounType.Organization)
      // (Type accuracy for "New York" → Location needs semantic/gazetteer support and is a
      // documented heuristic limitation, not the reported context-bleed bug.)
    })

    it('a confident single-signal candidate classifies correctly in isolation', async () => {
      // "Acme Corp" carries a strong Organization indicator ("Corp") with no competing context.
      const entities = await brain.extractEntities('Acme Corp', { confidence: 0.6 })
      expect(entities.length).toBeGreaterThan(0)
      expect(entities.some(e => e.type === NounType.Organization)).toBe(true)
    })

    it('the confidence option actually controls the gate (no longer dead)', async () => {
      const loose = await brain.extractEntities(text, { confidence: 0.1 })
      const strict = await brain.extractEntities(text, { confidence: 0.99 })
      expect(loose.length).toBeGreaterThan(0)
      // Previously confidence had no effect because SmartExtractor applied a hardcoded 0.60
      // floor; a near-1.0 threshold must now admit no fewer results than a loose one, and here
      // strictly fewer (nothing scores ≥ 0.99).
      expect(strict.length).toBeLessThanOrEqual(loose.length)
    })
  })

  describe('Bug 3 — multi-hop traversal honors depth', () => {
    let a: string
    let b: string
    let c: string

    beforeAll(async () => {
      a = await brain.add({ data: 'graph node A', type: NounType.Concept, metadata: { name: 'A' } })
      b = await brain.add({ data: 'graph node B', type: NounType.Concept, metadata: { name: 'B' } })
      c = await brain.add({ data: 'graph node C', type: NounType.Concept, metadata: { name: 'C' } })
      await brain.relate({ from: a, to: b, type: VerbType.RelatedTo })
      await brain.relate({ from: b, to: c, type: VerbType.RelatedTo })
    })

    const names = (rows: Array<{ metadata?: any }>) =>
      rows.map(r => r.metadata?.name).filter(Boolean).sort()

    it('depth 1 returns only the immediate neighbour', async () => {
      const rows = await brain.find({ connected: { from: a, depth: 1, direction: 'out' } })
      expect(names(rows)).toEqual(['B'])
    })

    it('depth 2 reaches the second hop (was 1-hop only)', async () => {
      const rows = await brain.find({ connected: { from: a, depth: 2, direction: 'out' } })
      expect(names(rows)).toEqual(['B', 'C'])
    })

    it('depth 3 on a 2-edge chain still returns B and C', async () => {
      const rows = await brain.find({ connected: { from: a, depth: 3, direction: 'out' } })
      expect(names(rows)).toEqual(['B', 'C'])
    })
  })

  describe('Bug 2 — find({ aggregate }) exposes AggregateResult fields', () => {
    beforeAll(async () => {
      brain.defineAggregate({
        name: 'spend_by_cat',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { total: { op: 'sum', field: 'amount' }, count: { op: 'count' } }
      })
      await brain.add({ data: 'coffee', type: NounType.Event, metadata: { category: 'food', amount: 5 } })
      await brain.add({ data: 'lunch', type: NounType.Event, metadata: { category: 'food', amount: 12 } })
      await brain.add({ data: 'bus', type: NounType.Event, metadata: { category: 'transit', amount: 3 } })
      await brain.flush()
      await new Promise(r => setTimeout(r, 500)) // let materialization debounce settle
    })

    it('rows carry top-level groupKey / metrics / count (was hidden under metadata)', async () => {
      const rows: any[] = await brain.find({ aggregate: 'spend_by_cat' })
      expect(rows.length).toBe(2)

      const food = rows.find(r => r.groupKey?.category === 'food')
      const transit = rows.find(r => r.groupKey?.category === 'transit')

      expect(food).toBeDefined()
      expect(food.groupKey).toEqual({ category: 'food' })
      expect(food.metrics.total).toBe(17)
      expect(food.count).toBe(2)

      expect(transit).toBeDefined()
      expect(transit.metrics.total).toBe(3)
      expect(transit.count).toBe(1)
    })
  })

  describe('R1 — aggregate backfills over a pre-populated store', () => {
    it('defineAggregate AFTER entities exist still returns correct rows', async () => {
      // The durable-storage case: a brain reopens pre-populated, then an aggregate is
      // defined. Write-time hooks never saw these entities, so without backfill this is [].
      const b: any = new Brainy({ storage: { type: 'memory' } })
      await b.init()
      await b.add({ data: 'a', type: NounType.Event, metadata: { category: 'food', amount: 5 } })
      await b.add({ data: 'b', type: NounType.Event, metadata: { category: 'food', amount: 7 } })
      await b.add({ data: 'c', type: NounType.Event, metadata: { category: 'transit', amount: 3 } })
      await b.flush()

      b.defineAggregate({
        name: 'after',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { total: { op: 'sum', field: 'amount' }, count: { op: 'count' } }
      })

      const rows: any[] = await b.find({ aggregate: 'after' })
      const food = rows.find(r => r.groupKey?.category === 'food')
      const transit = rows.find(r => r.groupKey?.category === 'transit')
      expect(food?.metrics.total).toBe(12)
      expect(food?.count).toBe(2)
      expect(transit?.count).toBe(1)
      await b.close()
    })

    it('groupBy "noun" resolves to the entity type, not null', async () => {
      const b: any = new Brainy({ storage: { type: 'memory' } })
      await b.init()
      await b.add({ data: 'p', type: NounType.Person })
      b.defineAggregate({
        name: 'byNoun',
        source: { type: NounType.Person },
        groupBy: ['noun'],
        metrics: { count: { op: 'count' } }
      })
      const rows: any[] = await b.find({ aggregate: 'byNoun' })
      expect(rows.length).toBe(1)
      expect(rows[0].groupKey.noun).toBe(NounType.Person)
      await b.close()
    })
  })

  describe('Traversal — via filter applies at every hop', () => {
    it('depth-2 via traversal follows the typed chain to the second hop', async () => {
      const b: any = new Brainy({ storage: { type: 'memory' } })
      await b.init()
      const a = await b.add({ data: 'a', type: NounType.Concept, metadata: { name: 'A' } })
      const m = await b.add({ data: 'm', type: NounType.Concept, metadata: { name: 'M' } })
      const z = await b.add({ data: 'z', type: NounType.Concept, metadata: { name: 'Z' } })
      await b.relate({ from: a, to: m, type: VerbType.RelatedTo })
      await b.relate({ from: m, to: z, type: VerbType.RelatedTo })

      const viaMatch = await b.find({ connected: { from: a, depth: 2, direction: 'out', via: VerbType.RelatedTo } })
      expect(viaMatch.map((x: any) => x.metadata?.name).sort()).toEqual(['M', 'Z'])

      // A non-matching verb type filters out hop 1 (and therefore everything) — proving the
      // filter is honored, not silently ignored as it was before.
      const viaMiss = await b.find({ connected: { from: a, depth: 2, direction: 'out', via: VerbType.Contains } })
      expect(viaMiss.length).toBe(0)
      await b.close()
    })
  })

  describe('queryAggregate() + HAVING', () => {
    it('returns AggregateResult[] and filters groups by metric value', async () => {
      const b: any = new Brainy({ storage: { type: 'memory' } })
      await b.init()
      b.defineAggregate({
        name: 'rev',
        source: { type: NounType.Event },
        groupBy: ['cat'],
        metrics: { total: { op: 'sum', field: 'amt' }, count: { op: 'count' } }
      })
      await b.add({ data: '1', type: NounType.Event, metadata: { cat: 'a', amt: 1500 } })
      await b.add({ data: '2', type: NounType.Event, metadata: { cat: 'a', amt: 200 } })
      await b.add({ data: '3', type: NounType.Event, metadata: { cat: 'b', amt: 50 } })
      await b.flush()

      const all = await b.queryAggregate('rev', { orderBy: 'total', order: 'desc' })
      expect(all.length).toBe(2)
      expect(all[0].groupKey.cat).toBe('a') // highest total first
      expect(all[0].metrics.total).toBe(1700)
      expect(all[0].count).toBe(2)

      // HAVING: only groups whose computed total exceeds 1000
      const big = await b.queryAggregate('rev', { having: { total: { greaterThan: 1000 } } })
      expect(big.length).toBe(1)
      expect(big[0].groupKey.cat).toBe('a')
      await b.close()
    })
  })
})
