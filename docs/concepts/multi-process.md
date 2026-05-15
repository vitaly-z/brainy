---
title: Multi-Process Model
slug: concepts/multi-process
public: true
category: concepts
template: concept
order: 5
description: How Brainy coordinates a single writer with any number of readers on a filesystem data directory — and how to safely inspect a live store.
next:
  - guides/inspection
---

# Multi-Process Model

Brainy is a **single-writer, many-reader** database when backed by filesystem
storage. This page explains the model, the guarantees, and the safe ways to
inspect a live store from a second process.

## The rule

For one data directory:

- **One writer** at a time. The writer acquires an exclusive lock on the
  directory at `init()` and releases it on `close()`.
- **Any number of readers**, concurrent with each other and with the writer.
  Readers open via `Brainy.openReadOnly()` — they never touch the writer
  lock.

Any attempt to open a second writer on the same directory throws:

```
BrainyError: Another writer holds this Brainy directory.
  PID:        1774431 on host app-host-1
  Started:    2026-05-15T14:22:11Z
  Heartbeat:  2026-05-15T14:22:34Z
  Version:    7.21.0
  Directory:  /data/brain
```

This is intentional. Two writers sharing a directory would silently corrupt
in-memory indexes and produce wrong query results — the worst possible default
for an operations tool.

## Why a lock?

Brainy keeps its primary indexes (HNSW, metadata, graph adjacency) in memory.
On disk, those indexes are persisted incrementally as writes flush. A second
process opening the same directory:

- Loads the *persisted* state into a fresh in-memory copy.
- Has no awareness of writes the first process buffered but hasn't flushed.
- Will overwrite the persisted state on its own next flush, racing the first
  process and corrupting whichever wins.

The fix is the lock: refuse to open a second writer. SQLite has done the same
since the late 1990s (`SQLITE_BUSY`).

## What about Cortex?

Brainy + Cortex compose cleanly under this model:

- Cortex stores its column-index segments inside the same `rootDir` (under
  `indexes/_column_index/{field}/`).
- Segments (`*.cidx` files) are **immutable** once written. Cortex mmaps them
  read-only.
- The `MANIFEST.json` per field is updated via atomic rename — readers see
  either the old or new manifest, never a torn file.

A reader process can safely mmap Cortex segments alongside a live writer
without coordination. The single Brainy writer lock at
`<rootDir>/locks/_writer.lock` covers Cortex too, because Cortex segment
writes happen on the writer's side.

## Stale-lock detection

If a writer crashes or is forcibly killed, its lock file is left behind. To
avoid a permanently-jammed directory, Brainy treats a lock as stale when:

1. The recorded `hostname` equals the current host (cross-host PID checks
   are unsafe), AND
2. The recorded `pid` is no longer alive (`process.kill(pid, 0)` returns
   `ESRCH`), OR the `lastHeartbeat` field is older than 60 seconds.

A live writer rewrites `lastHeartbeat` every 10 seconds, so a hung writer
that's missed several heartbeats is treated as dead. Stale locks are
overwritten with a warning.

If stale detection cannot prove the existing lock is dead — for example, a
crashed writer on a different host writing to a shared filesystem — pass
`{ force: true }` to override. A warning is logged either way.

## Heartbeat and shutdown

The heartbeat interval rewrites the lock file every 10 seconds. The timer
is unref'd, so it does not keep the event loop alive on its own.

On normal shutdown the writer releases the lock in `close()`. The shutdown
hooks Brainy registers for `SIGTERM`, `SIGINT`, and `beforeExit` also
release the lock so a container restart doesn't strand the directory.

## How to inspect a live writer

Use `Brainy.openReadOnly()`. It does not acquire the writer lock, so it
coexists with whatever the writer is doing:

```typescript
const reader = await Brainy.openReadOnly({
  storage: { type: 'filesystem', rootDirectory: '/data/brain' }
})

const stats = await reader.stats()
const bookings = await reader.find({ where: { entityType: 'booking' } })

await reader.close()
```

What the reader sees reflects the writer's most recent **flush** to disk. If
you need fresher state, ask the writer to flush before opening:

```typescript
const reader = await Brainy.openReadOnly({
  storage: { type: 'filesystem', rootDirectory: '/data/brain' }
})

const acked = await reader.requestFlush({ timeoutMs: 5000 })
if (!acked) {
  console.warn('Writer did not respond; results reflect last natural flush.')
}

const fresh = await reader.find({ where: { entityType: 'booking' } })
```

The CLI `brainy inspect` subcommands all do this for you by default
(`--no-fresh` to opt out).

## What's not enforced (yet)

- **Cloud storage backends** (S3, GCS, R2, Azure) do not currently enforce
  multi-process locking. Two processes pointing at the same bucket can both
  succeed at `init()` in writer mode and clobber each other's writes. A
  best-effort warning is logged in writer mode against a non-filesystem
  backend. Lock semantics for cloud backends will land in a future release.
- **Long-running readers** do not automatically pick up new Cortex segments
  the writer publishes. One-shot inspector calls re-open the store and see
  fresh segments; a reader that stays open for hours sees its column store
  as-of the time it opened.

## Reading material

- `Brainy.openReadOnly()` — [API reference](../api/brainy.md)
- `brainy inspect` — [inspection guide](../guides/inspection.md)
- Cortex columnar storage — see `node_modules/@soulcraft/cortex/README.md`
