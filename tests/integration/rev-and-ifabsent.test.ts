/**
 * @module tests/integration/rev-and-ifabsent
 * @description End-to-end tests for the 7.31.0 optimistic-concurrency surface:
 *   - `_rev` is initialized to 1 on add() and surfaced on get()/find()/search()
 *   - update() auto-bumps `_rev`
 *   - update({ ifRev }) accepts a matching rev and rejects a stale one with
 *     RevisionConflictError carrying { id, expected, actual }
 *   - add({ ifAbsent: true }) is a no-op when the id is already present
 *   - addMany({ ifAbsent: true }) applies the flag to every item
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { RevisionConflictError } from '../../src/transaction/RevisionConflictError.js'
import { NounType } from '../../src/types/graphTypes.js'

describe('7.31.0 — _rev CAS + ifAbsent', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' as const } })
    await brain.init()
  })

  describe('_rev initialization + surface', () => {
    it('initializes _rev to 1 on add()', async () => {
      const id = await brain.add({ data: 'hello', type: NounType.Document })
      const entity = await brain.get(id)
      expect(entity?._rev).toBe(1)
    })

    it('surfaces _rev on metadata-only get() fast path', async () => {
      const id = await brain.add({ data: 'fast-path', type: NounType.Document })
      const entity = await brain.get(id)  // metadata-only by default
      expect(entity?._rev).toBe(1)
    })

    it('surfaces _rev on includeVectors get() full path', async () => {
      const id = await brain.add({ data: 'full-path', type: NounType.Document })
      const entity = await brain.get(id, { includeVectors: true })
      expect(entity?._rev).toBe(1)
    })

    it('surfaces _rev on find() results', async () => {
      const id = await brain.add({ data: 'findable', type: NounType.Document })
      const results = await brain.find({ type: NounType.Document })
      const hit = results.find((r) => r.id === id)
      expect(hit?._rev).toBe(1)
    })
  })

  describe('_rev auto-bump on update()', () => {
    it('bumps _rev to 2 after first update()', async () => {
      const id = await brain.add({ data: 'v1', type: NounType.Document })
      await brain.update({ id, data: 'v2' })
      const entity = await brain.get(id)
      expect(entity?._rev).toBe(2)
    })

    it('bumps _rev monotonically across multiple updates', async () => {
      const id = await brain.add({ data: 'v1', type: NounType.Document })
      for (let i = 2; i <= 5; i++) {
        await brain.update({ id, data: `v${i}` })
        const entity = await brain.get(id)
        expect(entity?._rev).toBe(i)
      }
    })

    it('bumps _rev on metadata-only update', async () => {
      const id = await brain.add({
        data: 'doc',
        type: NounType.Document,
        metadata: { status: 'draft' }
      })
      await brain.update({ id, metadata: { status: 'published' } })
      const entity = await brain.get(id)
      expect(entity?._rev).toBe(2)
      expect(entity?.metadata?.status).toBe('published')
    })
  })

  describe('update({ ifRev }) optimistic concurrency', () => {
    it('passes when ifRev matches the persisted _rev', async () => {
      const id = await brain.add({ data: 'v1', type: NounType.Document })
      await expect(brain.update({ id, data: 'v2', ifRev: 1 })).resolves.not.toThrow()
      const after = await brain.get(id)
      expect(after?._rev).toBe(2)
    })

    it('throws RevisionConflictError when ifRev is stale', async () => {
      const id = await brain.add({ data: 'v1', type: NounType.Document })
      await brain.update({ id, data: 'v2' })  // bumps to 2

      let caught: unknown = null
      try {
        await brain.update({ id, data: 'v3-from-stale-reader', ifRev: 1 })
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(RevisionConflictError)
      const e = caught as RevisionConflictError
      expect(e.id).toBe(id)
      expect(e.expected).toBe(1)
      expect(e.actual).toBe(2)
    })

    it('emits a message that points at the recovery recipe', async () => {
      const id = await brain.add({ data: 'v1', type: NounType.Document })
      await brain.update({ id, data: 'v2' })
      try {
        await brain.update({ id, ifRev: 1, data: 'v3' })
        throw new Error('should have thrown')
      } catch (err) {
        const msg = (err as Error).message
        expect(msg).toMatch(/persisted _rev is 2/)
        expect(msg).toMatch(/brain\.get/)
      }
    })

    it('omits the check entirely when ifRev is not provided', async () => {
      const id = await brain.add({ data: 'v1', type: NounType.Document })
      await brain.update({ id, data: 'v2' })
      await brain.update({ id, data: 'v3' })  // no ifRev — must succeed
      const after = await brain.get(id)
      expect(after?._rev).toBe(3)
    })

    it('treats pre-7.31.0 metadata with no _rev as rev 1', async () => {
      // Simulate a legacy entity by writing directly through the storage adapter
      // with no _rev field, then verifying ifRev: 1 succeeds.
      const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      const storage = (brain as any).storage
      await storage.saveNounMetadata(id, {
        data: 'pre-7.31',
        noun: NounType.Document,
        createdAt: Date.now(),
        updatedAt: Date.now()
        // intentionally no _rev
      })
      // Also save the vector so get() doesn't return null on the full path.
      const vector = await (brain as any).embed('pre-7.31')
      await storage.saveNoun({
        id,
        vector,
        connections: new Map(),
        level: 0
      })
      const legacy = await brain.get(id)
      expect(legacy?._rev).toBe(1)
      await expect(brain.update({ id, data: 'updated', ifRev: 1 })).resolves.not.toThrow()
      const after = await brain.get(id)
      expect(after?._rev).toBe(2)
    })
  })

  describe('add({ ifAbsent: true })', () => {
    it('writes when no entity with the id exists', async () => {
      const id = await brain.add({
        id: '11111111-1111-4111-8111-111111111111',
        data: 'first-write',
        type: NounType.Document,
        ifAbsent: true
      })
      expect(id).toBe('11111111-1111-4111-8111-111111111111')
      const entity = await brain.get(id)
      expect(entity?.data).toBe('first-write')
      expect(entity?._rev).toBe(1)
    })

    it('returns the existing id without writing when the id is taken', async () => {
      await brain.add({
        id: '22222222-2222-4222-8222-222222222222',
        data: 'original',
        type: NounType.Document
      })
      const id = await brain.add({
        id: '22222222-2222-4222-8222-222222222222',
        data: 'attempted-overwrite',
        type: NounType.Document,
        ifAbsent: true
      })
      expect(id).toBe('22222222-2222-4222-8222-222222222222')
      const entity = await brain.get(id)
      expect(entity?.data).toBe('original')  // not overwritten
      expect(entity?._rev).toBe(1)  // not bumped (no write happened)
    })

    it('is a no-op (writes anyway) when no id is supplied', async () => {
      // ifAbsent without id can't mean anything — a fresh UUID can't collide.
      // The contract says "ignored when id is omitted." Verify it writes.
      const id = await brain.add({
        data: 'no-id-uuid-generated',
        type: NounType.Document,
        ifAbsent: true
      })
      expect(id).toMatch(/^[0-9a-f]{8}-/)  // UUID v4
      const entity = await brain.get(id)
      expect(entity?.data).toBe('no-id-uuid-generated')
    })
  })

  describe('addMany({ ifAbsent: true })', () => {
    it('applies ifAbsent to every item', async () => {
      // Seed one entity that should NOT be overwritten by the batch.
      await brain.add({
        id: '33333333-3333-4333-8333-333333333333',
        data: 'original',
        type: NounType.Document
      })

      const result = await brain.addMany({
        ifAbsent: true,
        items: [
          { id: '33333333-3333-4333-8333-333333333333', data: 'should-not-overwrite', type: NounType.Document },
          { id: '44444444-4444-4444-8444-444444444444', data: 'new', type: NounType.Document },
          { id: '55555555-5555-4555-8555-555555555555', data: 'new', type: NounType.Document }
        ]
      })

      expect(result.successful).toContain('33333333-3333-4333-8333-333333333333')
      expect(result.successful).toContain('44444444-4444-4444-8444-444444444444')
      expect(result.successful).toContain('55555555-5555-4555-8555-555555555555')

      const seeded = await brain.get('33333333-3333-4333-8333-333333333333')
      expect(seeded?.data).toBe('original')
      const fresh1 = await brain.get('44444444-4444-4444-8444-444444444444')
      expect(fresh1?.data).toBe('new')
    })

    it('per-item ifAbsent overrides the batch flag', async () => {
      await brain.add({
        id: '77777777-7777-4777-8777-777777777777',
        data: 'keep',
        type: NounType.Document
      })

      // Batch flag is false (default), but one item opts in.
      const result = await brain.addMany({
        items: [
          { id: '77777777-7777-4777-8777-777777777777', data: 'overwrite-attempt', type: NounType.Document, ifAbsent: true },
          { id: '66666666-6666-4666-8666-666666666666', data: 'new', type: NounType.Document }
        ]
      })

      expect(result.successful).toContain('77777777-7777-4777-8777-777777777777')
      const protectedEntity = await brain.get('77777777-7777-4777-8777-777777777777')
      expect(protectedEntity?.data).toBe('keep')
    })
  })

  describe('SDK scheduler use case — read-then-CAS lock pattern', () => {
    it('two concurrent CAS updates: one wins, one throws RevisionConflictError', async () => {
      const lockId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      await brain.add({
        id: lockId,
        data: { owner: null, expiresAt: 0 },
        type: NounType.Document,
        metadata: { kind: 'job-state' },
        ifAbsent: true
      })

      // Two readers see the same _rev
      const a = await brain.get(lockId)
      const b = await brain.get(lockId)
      expect(a?._rev).toBe(b?._rev)

      // A wins the race
      await brain.update({
        id: lockId,
        data: { owner: 'worker-A', expiresAt: Date.now() + 300_000 },
        ifRev: a!._rev
      })

      // B's CAS now fails because the rev has moved
      let caught: unknown = null
      try {
        await brain.update({
          id: lockId,
          data: { owner: 'worker-B', expiresAt: Date.now() + 300_000 },
          ifRev: b!._rev
        })
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(RevisionConflictError)
      // Final state: A owns the lock
      const final = await brain.get(lockId)
      expect((final?.data as any)?.owner).toBe('worker-A')
    })
  })
})
