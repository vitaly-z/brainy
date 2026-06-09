/**
 * @module transaction/RevisionConflictError
 * @description Error thrown by `brain.update({ ifRev })` when the persisted entity's
 * `_rev` no longer matches the caller-supplied expected revision. Carries enough
 * context (entity id, expected rev, actual rev) for the caller to choose a recovery
 * strategy: refetch + retry, escalate to the user, or surface the conflict.
 */

/**
 * Optimistic-concurrency conflict on `brain.update({ id, ..., ifRev })`.
 *
 * Thrown when the persisted entity's `_rev` differs from the caller-supplied `ifRev`.
 * The standard recovery is read-modify-write: `await brain.get(id)` → reconcile →
 * retry with the new `_rev`.
 *
 * @example
 * try {
 *   await brain.update({ id, data: '...', ifRev: 5 })
 * } catch (err) {
 *   if (err instanceof RevisionConflictError) {
 *     // Refetch and retry with the latest rev
 *     const latest = await brain.get(err.id)
 *     await brain.update({ id, data: merge(latest.data, '...'), ifRev: err.actual })
 *   }
 * }
 */
export class RevisionConflictError extends Error {
  /** Entity ID whose revision check failed */
  readonly id: string
  /** Revision number the caller expected to see (the `ifRev` argument) */
  readonly expected: number
  /** Revision number actually persisted */
  readonly actual: number

  constructor(id: string, expected: number, actual: number) {
    super(
      `update({ id: ${JSON.stringify(id)}, ifRev: ${expected} }) failed: persisted _rev is ${actual}. ` +
        `The entity was modified by another writer since you read it. ` +
        `Refetch with brain.get(${JSON.stringify(id)}) and retry with the latest _rev.`
    )
    this.name = 'RevisionConflictError'
    this.id = id
    this.expected = expected
    this.actual = actual
  }
}
