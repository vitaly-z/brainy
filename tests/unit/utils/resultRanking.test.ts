/**
 * @module tests/unit/utils/resultRanking
 * @description Tests for the `sort:topK` result-ranking hook.
 *
 * Two layers:
 * 1. Unit — the swappable dispatcher (`rankIndicesByScore` / `setSortTopKImplementation`):
 *    JS default ordering matches `Array.prototype.sort`, a native provider is routed
 *    through, and a misbehaving provider falls back to JS.
 * 2. Integration — `brain.find()` ranking routes through a registered `sort:topK`
 *    provider, AND the JS fallback (no provider) produces identical results/order.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  rankIndicesByScore,
  reorderByIndices,
  sortTopKIndicesJs,
  setSortTopKImplementation,
  type SortTopKFn
} from '../../../src/utils/resultRanking.js'
import { Brainy, NounType } from '../../../src/index.js'
import type { BrainyPlugin } from '../../../src/plugin.js'

/**
 * Reference ranking: exactly what the old `results.sort((a, b) => b.score - a.score)`
 * followed by `slice(0, k)` produced. Used to assert the hook never changes ordering.
 */
function referenceTopK(scores: number[], k: number, descending: boolean): number[] {
  const idx = scores.map((_, i) => i)
  idx.sort((a, b) => (descending ? scores[b] - scores[a] : scores[a] - scores[b]) || a - b)
  return idx.slice(0, Math.min(k, scores.length))
}

describe('resultRanking — sortTopKIndicesJs (canonical JS ranking)', () => {
  it('orders descending by score and truncates to k', () => {
    const scores = [0.1, 0.9, 0.5, 0.7, 0.3]
    expect(sortTopKIndicesJs(scores, 3, true)).toEqual([1, 3, 2]) // 0.9, 0.7, 0.5
  })

  it('orders ascending when descending=false', () => {
    const scores = [0.1, 0.9, 0.5]
    expect(sortTopKIndicesJs(scores, 3, false)).toEqual([0, 2, 1]) // 0.1, 0.5, 0.9
  })

  it('breaks ties by original index (stable), matching Array.sort', () => {
    // Three equal scores plus a higher one. Stable order keeps 0,2,3 in input order.
    const scores = [0.5, 0.9, 0.5, 0.5]
    expect(sortTopKIndicesJs(scores, 4, true)).toEqual([1, 0, 2, 3])
  })

  it('returns [] for empty input or non-positive k', () => {
    expect(sortTopKIndicesJs([], 5, true)).toEqual([])
    expect(sortTopKIndicesJs([0.1, 0.2], 0, true)).toEqual([])
    expect(sortTopKIndicesJs([0.1, 0.2], -1, true)).toEqual([])
  })

  it('returns all indices when k exceeds length', () => {
    expect(sortTopKIndicesJs([0.2, 0.1], 100, true)).toEqual([0, 1])
  })

  it('matches the reference Array.sort ordering across random inputs', () => {
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(Math.random() * 40)
      // Include duplicates so tie-stability is exercised.
      const scores = Array.from({ length: n }, () => Math.floor(Math.random() * 5) / 5)
      const k = 1 + Math.floor(Math.random() * (n + 2))
      expect(sortTopKIndicesJs(scores, k, true)).toEqual(referenceTopK(scores, k, true))
    }
  })
})

describe('resultRanking — reorderByIndices', () => {
  it('reorders elements according to the index order', () => {
    const items = ['a', 'b', 'c', 'd']
    expect(reorderByIndices(items, [2, 0, 3])).toEqual(['c', 'a', 'd'])
  })

  it('returns an empty array for an empty order', () => {
    expect(reorderByIndices(['a', 'b'], [])).toEqual([])
  })
})

describe('resultRanking — rankIndicesByScore dispatcher + provider hook', () => {
  // Always restore the JS default so a swapped impl never leaks into other tests.
  afterEach(() => setSortTopKImplementation(sortTopKIndicesJs))

  it('uses the JS implementation by default (identical to reference)', () => {
    const scores = [0.4, 0.8, 0.1, 0.8]
    expect(rankIndicesByScore(scores, 3, true)).toEqual(referenceTopK(scores, 3, true))
  })

  it('routes through a registered sort:topK provider with the documented signature', () => {
    const calls: Array<[number[], number, boolean]> = []
    const provider: SortTopKFn = (scores, k, descending) => {
      calls.push([scores, k, descending])
      // Return a valid (correct) ranking so the dispatcher accepts it.
      return sortTopKIndicesJs(scores, k, descending)
    }
    setSortTopKImplementation(provider)

    const scores = [0.2, 0.9, 0.5]
    const order = rankIndicesByScore(scores, 2, true)

    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe(scores) // exact scores array
    expect(calls[0][1]).toBe(2) // k
    expect(calls[0][2]).toBe(true) // descending
    expect(order).toEqual([1, 2]) // 0.9, 0.5
  })

  it('falls back to JS when a provider returns the wrong length', () => {
    setSortTopKImplementation(() => [0]) // wrong length (expected 2)
    const scores = [0.2, 0.9, 0.5]
    expect(rankIndicesByScore(scores, 2, true)).toEqual(referenceTopK(scores, 2, true))
  })

  it('falls back to JS when a provider returns out-of-range or duplicate indices', () => {
    setSortTopKImplementation(() => [0, 99]) // 99 out of range
    expect(rankIndicesByScore([0.2, 0.9, 0.5], 2, true)).toEqual([1, 2])

    setSortTopKImplementation(() => [1, 1]) // duplicate index
    expect(rankIndicesByScore([0.2, 0.9, 0.5], 2, true)).toEqual([1, 2])
  })

  it('falls back to JS when a provider throws', () => {
    setSortTopKImplementation(() => {
      throw new Error('native boom')
    })
    expect(rankIndicesByScore([0.2, 0.9, 0.5], 2, true)).toEqual([1, 2])
  })
})

/**
 * Plugin that registers a recording `sort:topK` provider. The provider delegates to the
 * correct JS ranking so results are valid, while recording that it was invoked — proving
 * find()'s ranking routes through the hook.
 */
function makeSortTopKPlugin(calls: Array<{ k: number; descending: boolean; n: number }>): BrainyPlugin {
  return {
    name: 'test-sort-topk',
    activate: async (ctx) => {
      ctx.registerProvider('sort:topK', (scores: number[], k: number, descending: boolean) => {
        calls.push({ k, descending, n: scores.length })
        return sortTopKIndicesJs(scores, k, descending)
      })
      return true
    }
  }
}

describe('resultRanking — Brainy.find() integration', () => {
  // Restore JS default after every test: brain.init() installs the provider process-wide
  // via setSortTopKImplementation, so we must reset it to avoid leaking into other suites.
  afterEach(() => setSortTopKImplementation(sortTopKIndicesJs))

  /** Seed a brain with deterministic data covering several types. */
  async function seed(brain: Brainy): Promise<void> {
    const docs = [
      { data: 'red apple fruit', type: NounType.Concept, metadata: { name: 'apple' } },
      { data: 'green pear fruit', type: NounType.Concept, metadata: { name: 'pear' } },
      { data: 'yellow banana fruit', type: NounType.Concept, metadata: { name: 'banana' } },
      { data: 'orange citrus fruit', type: NounType.Concept, metadata: { name: 'orange' } },
      { data: 'purple grape fruit', type: NounType.Concept, metadata: { name: 'grape' } },
      { data: 'blue car vehicle', type: NounType.Thing, metadata: { name: 'car' } },
      { data: 'fast train vehicle', type: NounType.Thing, metadata: { name: 'train' } }
    ]
    for (const d of docs) await brain.add(d)
  }

  it('routes find() relevance ranking through a registered sort:topK provider', async () => {
    const calls: Array<{ k: number; descending: boolean; n: number }> = []
    const brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    brain.use(makeSortTopKPlugin(calls))
    await brain.init()
    await seed(brain)

    const results = await brain.find({ query: 'fruit', limit: 3 })

    // The provider must have been invoked for relevance ranking, with descending order
    // and k == offset(0) + limit(3).
    expect(calls.length).toBeGreaterThan(0)
    const ranking = calls.find(c => c.descending && c.k === 3)
    expect(ranking).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(3)

    await brain.close()
  })

  it('produces identical results via the provider and the JS fallback (same brain, same data)', async () => {
    // The active sort:topK implementation is a process-global, so the only sound way to
    // compare provider-vs-JS is on ONE brain over identical persisted data: run with the
    // provider active, then reset to JS and re-run the same query. The candidate set and
    // scores are identical across runs — only the ranking code path differs — so ids,
    // order, and scores must match exactly. (Two separate brains would differ due to
    // independent approximate-NN candidate selection, not the ranking hook.)
    const calls: Array<{ k: number; descending: boolean; n: number }> = []
    const brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    brain.use(makeSortTopKPlugin(calls))
    await brain.init()
    await seed(brain)

    const query = { query: 'fruit', limit: 4 }
    const providerResults = await brain.find({ ...query })
    expect(calls.length).toBeGreaterThan(0)

    // Now disable the provider (restore JS) and re-run the identical query on the same brain.
    setSortTopKImplementation(sortTopKIndicesJs)
    const jsResults = await brain.find({ ...query })

    expect(providerResults.map(r => r.id)).toEqual(jsResults.map(r => r.id))
    expect(providerResults.map(r => r.score)).toEqual(jsResults.map(r => r.score))

    await brain.close()
  })

  it('returns results in non-increasing score order and requests k = offset + limit', async () => {
    // Ordering correctness is the hook's contract; assert it directly on find() output
    // rather than relying on cross-query ANN stability. Also assert the provider is asked
    // for the full page (offset + limit), which is what makes pagination correct.
    const calls: Array<{ k: number; descending: boolean; n: number }> = []
    const brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    brain.use(makeSortTopKPlugin(calls))
    await brain.init()
    await seed(brain)

    const page = await brain.find({ query: 'fruit', limit: 2, offset: 2 })

    // Scores within the returned page must be non-increasing (descending ranking).
    for (let i = 1; i < page.length; i++) {
      expect(page[i].score).toBeLessThanOrEqual(page[i - 1].score)
    }
    // The offset page must request k = offset(2) + limit(2) = 4 from the provider.
    expect(calls.some(c => c.descending && c.k === 4)).toBe(true)

    await brain.close()
  })
})
