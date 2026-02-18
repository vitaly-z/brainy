/**
 * Regression tests: metadata index cleanup after delete / deleteMany
 *
 * Bug report (wickworks): brain.deleteMany() was not removing metadata index
 * entries for deleted entities. The same defect also existed in delete().
 *
 * Root causes fixed:
 *
 * 1. idMapper not cleaned up — EntityIdMapper accumulated all entity UUID→int
 *    mappings and never removed them on deletion. idMapper.getAllIntIds() is used
 *    as the "universe" for `ne` and `exists:false` operators, so deleted entities
 *    continued to appear in those query results forever.
 *    Fix: removeFromIndex() now calls idMapper.remove(id) + idMapper.flush()
 *    AFTER all bitmap operations complete.
 *
 * 2. Optional fields indexed as __NULL__ but never unindexed — entityForIndexing
 *    in add() included confidence/weight/createdBy as explicit keys even when
 *    undefined. Object.entries() preserves keys with undefined values, so
 *    extractIndexableFields() indexed them as '__NULL__'. storageMetadata omitted
 *    those keys entirely via conditional spreading, so removeFromIndex() never
 *    cleaned up those bitmap entries.
 *    Fix: entityForIndexing now uses the same conditional spreading pattern as
 *    storageMetadata for confidence, weight, and createdBy.
 *
 * 3. result.successful updated inside transaction builder — deleteMany() pushed
 *    ids to result.successful during the builder phase, before transaction.execute()
 *    ran. A transaction rollback would leave result.successful containing ids that
 *    were never actually deleted.
 *    Fix: queued ids are held in a local array and moved to result.successful only
 *    after executeTransaction() resolves without error.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'

// 384 dimensions matches the default WASM embedding model loaded during brain.init().
// Passing an explicit vector skips AI embedding while remaining dimension-compatible.
const DIM = 384
const makeVec = (seed = 1) =>
  new Float32Array(DIM).map((_, i) => ((i + seed) % DIM) / DIM)

describe('Metadata index cleanup after delete / deleteMany', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function addEntity(opts: {
    type?: string
    service?: string
    metadata?: Record<string, unknown>
    confidence?: number
    weight?: number
  } = {}): Promise<string> {
    return brain.add({
      data: 'test',
      vector: makeVec(),
      type: (opts.type ?? 'thing') as any,
      ...(opts.service !== undefined && { service: opts.service }),
      ...(opts.metadata !== undefined && { metadata: opts.metadata }),
      ...(opts.confidence !== undefined && { confidence: opts.confidence }),
      ...(opts.weight !== undefined && { weight: opts.weight }),
    })
  }

  // ---------------------------------------------------------------------------
  // delete() — single entity
  // ---------------------------------------------------------------------------

  describe('delete()', () => {
    it('removes entity from type index so find({ type }) returns 0', async () => {
      const id = await addEntity({ type: 'product' })
      await brain.delete(id)

      const results = await brain.find({ type: 'product' as any })
      expect(results).toHaveLength(0)
    })

    it('removes entity from ne operator universe', async () => {
      // Add one entity with service 'alpha', delete it.
      // A ne:'beta' query should return 0, not the deleted entity.
      const id = await addEntity({ service: 'alpha', type: 'thing' })
      await brain.delete(id)

      const results = await brain.find({ where: { service: { ne: 'beta' } } })
      const ids = results.map(r => r.id)
      expect(ids).not.toContain(id)
    })

    it('removes entity from exists:false results', async () => {
      // Entity added without a custom 'archivedAt' field.
      // After deletion it must not appear in an exists:false query.
      const id = await addEntity({ type: 'thing' })
      await brain.delete(id)

      const results = await brain.find({ where: { archivedAt: { exists: false } } })
      const ids = results.map(r => r.id)
      expect(ids).not.toContain(id)
    })
  })

  // ---------------------------------------------------------------------------
  // deleteMany() — batch deletion
  // ---------------------------------------------------------------------------

  describe('deleteMany()', () => {
    it('removes all entities from type index so find({ type }) returns 0', async () => {
      const ids = await Promise.all([
        addEntity({ type: 'concept' }),
        addEntity({ type: 'concept' }),
        addEntity({ type: 'concept' }),
      ])

      await brain.deleteMany({ ids })

      const results = await brain.find({ type: 'concept' as any, limit: 50 })
      expect(results).toHaveLength(0)
    })

    it('removes deleted entities from ne operator universe', async () => {
      // Three entities with service:'alpha', two with service:'beta'.
      // Delete the alpha ones. A ne:'beta' query must return 0, not the deleted alphas.
      const alphaIds = await Promise.all([
        addEntity({ service: 'alpha', type: 'thing' }),
        addEntity({ service: 'alpha', type: 'thing' }),
        addEntity({ service: 'alpha', type: 'thing' }),
      ])
      const betaIds = await Promise.all([
        addEntity({ service: 'beta', type: 'thing' }),
        addEntity({ service: 'beta', type: 'thing' }),
      ])

      await brain.deleteMany({ ids: alphaIds })

      const results = await brain.find({ where: { service: { ne: 'beta' } } })
      const resultIds = results.map(r => r.id)

      // Deleted alpha entities must not appear
      for (const id of alphaIds) {
        expect(resultIds).not.toContain(id)
      }

      // Surviving beta entities are outside the ne:'beta' exclusion so also absent — that's fine
      // The key assertion is zero deleted entities in results
      expect(resultIds.filter(id => alphaIds.includes(id))).toHaveLength(0)
      void betaIds // referenced to document intent
    })

    it('removes deleted entities from exists:false results', async () => {
      // Three entities WITHOUT a custom field 'closedAt'.
      // After deletion they must not appear in an exists:false query.
      const deletedIds = await Promise.all([
        addEntity({ type: 'thing', metadata: { region: 'us' } }),
        addEntity({ type: 'thing', metadata: { region: 'eu' } }),
        addEntity({ type: 'thing', metadata: { region: 'ap' } }),
      ])

      // One surviving entity also without closedAt — it SHOULD appear in results
      const survivorId = await addEntity({ type: 'thing', metadata: { region: 'us', active: true } })

      await brain.deleteMany({ ids: deletedIds })

      const results = await brain.find({ where: { closedAt: { exists: false } } })
      const resultIds = results.map(r => r.id)

      // Deleted entities must be absent
      for (const id of deletedIds) {
        expect(resultIds).not.toContain(id)
      }

      // The surviving entity without closedAt should still be findable
      expect(resultIds).toContain(survivorId)
    })

    it('result.successful contains only ids whose deletions were committed', async () => {
      const ids = await Promise.all([
        addEntity({ type: 'thing' }),
        addEntity({ type: 'thing' }),
        addEntity({ type: 'thing' }),
      ])

      const result = await brain.deleteMany({ ids })

      // All should succeed — verify successful list is correct
      expect(result.successful).toHaveLength(ids.length)
      expect(result.failed).toHaveLength(0)
      for (const id of ids) {
        expect(result.successful).toContain(id)
      }

      // Entities must actually be gone from storage
      for (const id of ids) {
        const entity = await brain.get(id)
        expect(entity).toBeNull()
      }
    })

    it('handles empty ids array gracefully', async () => {
      const result = await brain.deleteMany({ ids: [] })
      expect(result.successful).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
    })

    it('handles large batch (> 1 chunk) without leaving stale index entries', async () => {
      // 25 entities → 3 transaction chunks of 10, 10, 5
      const ids = await Promise.all(
        Array.from({ length: 25 }, (_, i) => addEntity({ type: 'document', metadata: { i } }))
      )

      const result = await brain.deleteMany({ ids })

      expect(result.successful).toHaveLength(25)
      expect(result.failed).toHaveLength(0)

      // No document should survive in the index
      const remaining = await brain.find({ type: 'document' as any, limit: 100 })
      expect(remaining).toHaveLength(0)

      // No deleted entity should appear in a ne query
      const neResults = await brain.find({ where: { i: { exists: true } } })
      const leftoverIds = neResults.map(r => r.id).filter(id => ids.includes(id))
      expect(leftoverIds).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Optional-field indexing (Fix 2)
  // ---------------------------------------------------------------------------

  describe('optional field indexing', () => {
    it('entity added without confidence does not appear in confidence:exists:true query', async () => {
      // Without Fix 2, undefined confidence was indexed as __NULL__, making it appear
      // as though the entity has a confidence value in the sparse index.
      const noConfidenceId = await addEntity({ type: 'thing' })
      const withConfidenceId = await addEntity({ type: 'thing', confidence: 0.9 })

      const results = await brain.find({ where: { confidence: { exists: true } } })
      const ids = results.map(r => r.id)

      expect(ids).toContain(withConfidenceId)
      expect(ids).not.toContain(noConfidenceId)
    })

    it('entity added without weight does not appear in weight:exists:true query', async () => {
      const noWeightId = await addEntity({ type: 'thing' })
      const withWeightId = await addEntity({ type: 'thing', weight: 0.5 })

      const results = await brain.find({ where: { weight: { exists: true } } })
      const ids = results.map(r => r.id)

      expect(ids).toContain(withWeightId)
      expect(ids).not.toContain(noWeightId)
    })

    it('deleting entity without optional fields leaves no orphaned __NULL__ entries', async () => {
      // Add and delete an entity that has no confidence or weight.
      // After deletion the confidence/__NULL__ and weight/__NULL__ bitmap entries
      // (if any were created) must not be surfaced through any query.
      const id = await addEntity({ type: 'thing' })
      await brain.delete(id)

      // Entity must not appear in any confidence query
      const existsTrue = await brain.find({ where: { confidence: { exists: true } } })
      expect(existsTrue.map(r => r.id)).not.toContain(id)

      const existsFalse = await brain.find({ where: { confidence: { exists: false } } })
      expect(existsFalse.map(r => r.id)).not.toContain(id)
    })
  })

  // ---------------------------------------------------------------------------
  // Survivors are unaffected
  // ---------------------------------------------------------------------------

  describe('partial deleteMany does not affect surviving entities', () => {
    it('surviving entities remain queryable after deleting others of the same type', async () => {
      const toDelete = await Promise.all([
        addEntity({ type: 'collection', metadata: { group: 'a' } }),
        addEntity({ type: 'collection', metadata: { group: 'a' } }),
      ])
      const survivors = await Promise.all([
        addEntity({ type: 'collection', metadata: { group: 'b' } }),
        addEntity({ type: 'collection', metadata: { group: 'b' } }),
        addEntity({ type: 'collection', metadata: { group: 'b' } }),
      ])

      await brain.deleteMany({ ids: toDelete })

      const results = await brain.find({ type: 'collection' as any, limit: 50 })
      const resultIds = results.map(r => r.id)

      // All survivors present
      for (const id of survivors) {
        expect(resultIds).toContain(id)
      }

      // Deleted entities absent
      for (const id of toDelete) {
        expect(resultIds).not.toContain(id)
      }
    })

    it('delete() of one entity does not affect siblings in same type', async () => {
      const a = await addEntity({ type: 'task', service: 'svc' })
      const b = await addEntity({ type: 'task', service: 'svc' })
      const c = await addEntity({ type: 'task', service: 'svc' })

      await brain.delete(a)

      const results = await brain.find({ type: 'task' as any, limit: 50 })
      const ids = results.map(r => r.id)

      expect(ids).not.toContain(a)
      expect(ids).toContain(b)
      expect(ids).toContain(c)
    })
  })
})
