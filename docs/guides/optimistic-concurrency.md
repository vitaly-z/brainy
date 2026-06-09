---
title: Optimistic concurrency with _rev
slug: guides/optimistic-concurrency
public: true
category: guides
template: guide
order: 8
description: Use the per-entity `_rev` counter and `update({ ifRev })` to coordinate concurrent writes safely. Covers the lock pattern, idempotent inserts with `ifAbsent`, and recovery on conflict.
next:
  - guides/find-limits
  - api/README
---

# Optimistic concurrency with `_rev`

Brainy 7.31.0 adds a per-entity revision counter so multiple writers can coordinate without a global lock or external coordinator. The pattern is the same one CouchDB, PouchDB, and ETag-based HTTP caches use: read the current revision, do your work, write back with `ifRev: <whatRevYouSaw>`. If the revision moved, your write is rejected and you retry against the latest state.

## What gets added

| Surface | Behavior |
|---|---|
| `entity._rev: number` | Returned on every `get()`, `find()`, `search()`. Initialized to `1` on `add()`. Bumped by `1` on every successful `update()`. Pre-7.31.0 entities without `_rev` are surfaced as `1`. |
| `update({ id, ..., ifRev: number })` | If the persisted `_rev` does not equal `ifRev`, throws `RevisionConflictError`. Omitting `ifRev` keeps the prior (unconditional) update behavior. |
| `RevisionConflictError` | Carries `{ id, expected, actual }` for principled recovery. |
| `add({ id, ifAbsent: true })` | By-ID idempotent insert. Returns the existing `id` if one is already present; no throw, no overwrite. |
| `addMany({ items, ifAbsent: true })` | Applies `ifAbsent` to every item. Per-item `ifAbsent` overrides the batch flag. |

`_rev` is independent of `brain.versions.*` (named snapshots), of `brain.fork()` / branches (COW), and of VFS file versioning. They all coexist; `_rev` is the per-write counter used for CAS.

## The lock pattern

Every distributed-job scheduler eventually wants this exact loop:

```ts
import { Brainy, RevisionConflictError } from '@soulcraft/brainy'

const LOCK_ID = '...uuid for this job slot...'

// Bootstrap the lock document once (idempotent).
await brain.add({
  id: LOCK_ID,
  type: NounType.Document,
  data: { owner: null, expiresAt: 0 },
  ifAbsent: true
})

async function tryAcquireLock(workerId: string, ttlMs: number) {
  const lock = await brain.get(LOCK_ID)
  if (!lock) throw new Error('lock document missing')

  const state = lock.data as { owner: string | null; expiresAt: number }
  const now = Date.now()

  // Only take the lock if it's free or expired.
  if (state.owner && state.expiresAt > now) return false

  try {
    await brain.update({
      id: LOCK_ID,
      data: { owner: workerId, expiresAt: now + ttlMs },
      ifRev: lock._rev
    })
    return true
  } catch (err) {
    if (err instanceof RevisionConflictError) {
      // Another worker grabbed it between our read and write.
      return false
    }
    throw err
  }
}
```

No external lock service, no Redis SETNX, no Cloud Tasks. The CAS check is the lock.

## Read-modify-write with retry

The other common shape is "update a counter / config object" with bounded retries on conflict:

```ts
async function incrementCounter(id: string, by: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const entity = await brain.get(id)
    if (!entity) throw new Error('counter does not exist')
    const current = (entity.data as { value: number }).value
    try {
      await brain.update({
        id,
        data: { value: current + by },
        ifRev: entity._rev
      })
      return
    } catch (err) {
      if (err instanceof RevisionConflictError) continue   // refetch + retry
      throw err
    }
  }
  throw new Error('counter update conflict after 5 attempts')
}
```

The retry bound matters — without one, two unlucky writers can ping-pong forever.

## Idempotent bootstrap with `ifAbsent`

For singletons (config rows, well-known seed entities, job-state documents) where the natural ID is deterministic:

```ts
await brain.add({
  id: 'config:singleton',
  type: NounType.Document,
  data: { tenantQuota: 1000 },
  ifAbsent: true
})
```

- First caller writes; gets back `'config:singleton'`.
- Every subsequent caller short-circuits at the pre-read; gets back the same `'config:singleton'` without touching the existing entity.
- `_rev` is **not** bumped on the no-op path (no write happened).

`ifAbsent` is only meaningful when you supply an `id`. With no `id`, Brainy generates a fresh UUID that can never collide, so the flag is silently ignored.

`addMany({ items, ifAbsent: true })` applies the flag to every item. Mixing per-item overrides with the batch flag works as you'd expect: per-item `ifAbsent: false` opts an individual row out, per-item `ifAbsent: true` opts it in.

### Why no `addIfMissing({ match, add })` for attribute-based dedup?

You may want "create if no entity with this email exists" (lookup by attribute, not by ID). That's a different operation:

```ts
// What we DID NOT ship in 7.31.0 — the attribute-based variant.
await brain.addIfMissing({                       // ← not a real API
  match: { type: 'Person', where: { email: 'x@y.com' } },
  add:   { data: '...', metadata: { email: 'x@y.com' } }
})
```

It's race-prone outside a transaction: two concurrent imports both see "not found," both insert, you get duplicates. Without a unique-index primitive (which Brainy doesn't have today), this pattern needs to live inside a transaction:

```ts
// The race-safe shape, available once brain.transact() ships in 8.0.
await brain.transact(async tx => {
  const existing = await tx.find({
    type: 'Person',
    where: { email: 'x@y.com' },
    limit: 1
  })
  if (existing.length === 0) {
    await tx.add({ type: 'Person', data: '...', metadata: { email: 'x@y.com' } })
  }
})
```

For 7.31.0, lean on `ifAbsent` when you control the ID, and accept the inherent dedup race when you don't. The 8.0 `brain.transact()` is the natural home for the attribute-based variant.

## How `_rev` interacts with the other versioning systems

Brainy has several persistence primitives that all touch the word "version" in different ways. `_rev` is independent of every one of them:

| System | What it tracks | When it advances |
|---|---|---|
| **`_rev`** (new in 7.31.0) | Per-entity write counter | Auto, on every successful `update()` |
| **`brain.versions.save()`** | Named snapshots per entity | Explicit — you call `save()` with a tag |
| **`brain.fork()` / branches** | Whole-brain copy-on-write | Explicit — you call `fork(name)` |
| **VFS file versioning** | Per-VFS-file snapshots (Document entity) | Same as `brain.versions.save()` |

If you're on a branch, each branch has its own copy of every entity (that's what COW means), so each branch has its own `_rev` per entity — same as every other field. Snapshots taken via `brain.versions.save()` capture the entity at that moment including its `_rev` at that time; the snapshot's own `version: number` is the snapshot index, distinct from `_rev`.

## What's coming in 8.0

Brainy 8.0 ships a Datomic-style immutable `Db` API where `brain.transact(tx)` is the public multi-write atomicity primitive. Two things change for code written against 7.31.0's surface:

- `_rev` survives unchanged. It's part of the 8.0 entity shape; the auto-bump moves to the new `transact()` write path. Code that uses `update({ ifRev })` keeps working.
- A new `brain.transact(tx, { ifAtGeneration: prev.generation })` adds generation-based CAS for whole-transaction atomicity, layered on top of `_rev`. Per-entity for single-record patterns (the lock above), generation-based for "did the world move under me."

If you adopt `_rev` + `ifRev` in 7.31.0, no migration work is needed for 8.0.
