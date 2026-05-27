/**
 * @module utils/resultRanking
 * @description Top-K result ranking for the search pipeline. Brainy's `find()` ranks
 * candidate results by relevance score and then slices to a page (`offset + limit`).
 * For large candidate sets this is an O(N log N) full sort even though only the top
 * `k = offset + limit` rows are kept.
 *
 * This module exposes a swappable `sort:topK` seam:
 * - {@link rankIndicesByScore} returns the indices of `scores` ordered exactly as a
 *   descending stable sort would order them, then truncated to `k`.
 * - {@link setSortTopKImplementation} lets a native plugin (e.g. cortex's Rust
 *   partial-sort / heap-select) replace the JS implementation. The native provider
 *   only has to return the same *index ordering* the JS path produces.
 *
 * The default JS implementation ({@link sortTopKIndicesJs}) is the canonical, always-correct
 * fallback. It is intentionally identical in ordering to `Array.prototype.sort((a, b) => b - a)`:
 * descending by score, with stable ordering for ties (lower original index first). This
 * guarantees that wiring the hook in or out never changes which results a query returns or
 * in what order — only how fast the ranking is computed.
 *
 * @see setSQ8DistanceImplementation in ./vectorQuantization.js for the sibling provider-swap pattern.
 */

/**
 * Signature of a `sort:topK` implementation. Given a parallel array of `scores`, a
 * target count `k`, and a sort direction, it returns the indices into `scores` in the
 * desired order, truncated to at most `k` entries.
 *
 * Contract (the native implementation MUST match the JS default exactly):
 * - `descending: true` → indices ordered by score high→low.
 * - Ties (equal scores) keep their original relative order (stable).
 * - The returned array has `min(k, scores.length)` entries; `k <= 0` returns `[]`.
 *
 * @param scores - Relevance scores, one per candidate result.
 * @param k - Maximum number of indices to return (the page size, `offset + limit`).
 * @param descending - When true, highest score first (the only mode used by ranking).
 * @returns Indices into `scores`, ordered and truncated to `k`.
 */
export type SortTopKFn = (scores: number[], k: number, descending: boolean) => number[]

/**
 * Pure-JS top-K index selection. Produces the same ordering as
 * `scores.map((_, i) => i).sort((a, b) => descending ? scores[b] - scores[a] : scores[a] - scores[b])`
 * and then truncates to `k`, but without allocating intermediate result objects.
 *
 * Stability: ties are broken by original index (ascending), matching the ES2019+ stable
 * `Array.prototype.sort`. This is what keeps the hook's output byte-identical to the
 * previous `results.sort((a, b) => b.score - a.score)` followed by `slice`.
 *
 * @param scores - Relevance scores, one per candidate result.
 * @param k - Maximum number of indices to return.
 * @param descending - When true, highest score first.
 * @returns Indices into `scores`, ordered and truncated to `k`.
 * @example
 * sortTopKIndicesJs([0.1, 0.9, 0.5], 2, true) // [1, 2] (0.9 then 0.5)
 */
export function sortTopKIndicesJs(scores: number[], k: number, descending: boolean): number[] {
  const n = scores.length
  if (n === 0 || k <= 0) return []

  // Build the index list and sort it the same way the consumer's comparator did.
  // Sorting indices (not value/object pairs) keeps allocation minimal while preserving
  // the exact comparator semantics, including stable tie-breaking by original index.
  const indices = new Array<number>(n)
  for (let i = 0; i < n; i++) indices[i] = i

  indices.sort((a, b) => {
    const sa = scores[a]
    const sb = scores[b]
    if (sa === sb) return a - b // stable: original order for ties
    return descending ? sb - sa : sa - sb
  })

  return k >= n ? indices : indices.slice(0, k)
}

/**
 * Active `sort:topK` implementation. Defaults to {@link sortTopKIndicesJs}; replaced by a
 * native implementation via {@link setSortTopKImplementation} when a `sort:topK` provider
 * is registered. The native implementation must return the identical index ordering.
 */
let activeSortTopK: SortTopKFn = sortTopKIndicesJs

/**
 * Rank candidate indices by relevance score, dispatched to the active `sort:topK`
 * implementation (JS by default, native when a provider is registered).
 *
 * This is the single entry point the search pipeline calls. It is defensive about a
 * misbehaving native provider: the returned indices are validated to be the right length,
 * in range, and free of duplicates; if the provider returns anything inconsistent the JS
 * implementation is used instead so a query never returns wrong or duplicated results.
 *
 * @param scores - Relevance scores, one per candidate result.
 * @param k - Maximum number of indices to return (the page size, `offset + limit`).
 * @param descending - When true, highest score first (always true for relevance ranking).
 * @returns Indices into `scores`, ordered and truncated to at most `k`.
 */
export function rankIndicesByScore(scores: number[], k: number, descending: boolean): number[] {
  const n = scores.length
  if (n === 0 || k <= 0) return []

  if (activeSortTopK === sortTopKIndicesJs) {
    return sortTopKIndicesJs(scores, k, descending)
  }

  // A native provider is installed. Run it, then validate its output. The validation
  // is O(result) — cheap relative to the sort it replaces — and guarantees correctness
  // even if a provider has a bug: any inconsistency falls back to the trusted JS path.
  const expectedLen = Math.min(k, n)
  let candidate: number[]
  try {
    candidate = activeSortTopK(scores, k, descending)
  } catch {
    return sortTopKIndicesJs(scores, k, descending)
  }

  if (!Array.isArray(candidate) || candidate.length !== expectedLen) {
    return sortTopKIndicesJs(scores, k, descending)
  }

  const seen = new Uint8Array(n)
  for (let i = 0; i < candidate.length; i++) {
    const idx = candidate[i]
    if (!Number.isInteger(idx) || idx < 0 || idx >= n || seen[idx] === 1) {
      return sortTopKIndicesJs(scores, k, descending)
    }
    seen[idx] = 1
  }

  return candidate
}

/**
 * Reorder `items` according to a top-K index ranking, returning a new array containing
 * only the ranked (and truncated) elements. Used by the search pipeline to apply a
 * {@link rankIndicesByScore} result to the parallel array of full result objects.
 *
 * @typeParam T - The result element type.
 * @param items - The full candidate array (parallel to the `scores` passed to ranking).
 * @param order - Indices into `items`, as returned by {@link rankIndicesByScore}.
 * @returns A new array `[items[order[0]], items[order[1]], ...]`.
 */
export function reorderByIndices<T>(items: T[], order: number[]): T[] {
  const out = new Array<T>(order.length)
  for (let i = 0; i < order.length; i++) {
    out[i] = items[order[i]]
  }
  return out
}

/**
 * Replace the `sort:topK` implementation at runtime (e.g. cortex's native partial sort).
 * Called by `brainy.ts` when a `sort:topK` provider is registered. Pass
 * {@link sortTopKIndicesJs} to restore the JS default.
 *
 * @param fn - Native implementation; must satisfy the {@link SortTopKFn} contract.
 */
export function setSortTopKImplementation(fn: SortTopKFn): void {
  activeSortTopK = fn
}
