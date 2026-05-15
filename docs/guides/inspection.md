---
title: Inspecting a Live Brainy
slug: guides/inspection
public: true
category: guides
template: guide
order: 30
description: Operator recipes for diagnosing a running Brainy data directory — counts, queries, query plans, health checks, and snapshots — without stopping the live writer.
next:
  - concepts/multi-process
---

# Inspecting a Live Brainy

When something is wrong in production, you need to see what's actually in the
store. This guide covers the safe ways to query a running Brainy directory.

## The cardinal rule

**Never open a second writer on the same directory.** It will throw on
filesystem storage; on cloud storage it'll silently overwrite the live
writer's state. Use `Brainy.openReadOnly()` or the `brainy inspect` CLI
instead.

## The CLI is the fastest path

```bash
# What's in this brain?
brainy inspect stats /data/brain

# Find specific entities
brainy inspect find /data/brain --type Event --where '{"status":"paid"}' --limit 20

# Single entity by ID
brainy inspect get /data/brain 0b7a9...

# Why is this query returning empty?
brainy inspect explain /data/brain --where '{"entityType":"booking"}'

# Quick invariants
brainy inspect health /data/brain

# Random sample (no query needed)
brainy inspect sample /data/brain --type Event --n 20

# Tail new writes as they happen
brainy inspect watch /data/brain --type Event

# Save a snapshot
brainy inspect backup /data/brain /backups/brain-$(date +%Y%m%d).tar
```

Every subcommand internally:

1. Asks the live writer to flush via the cross-process RPC (skip with `--no-fresh`).
2. Opens the data directory via `Brainy.openReadOnly()`.
3. Runs the query.
4. Closes cleanly.

Results are JSON by default. Add `--pretty` for indented output.

## When a query returns surprising results

If `find()` returns `0` for a query you expect to match: run `inspect
explain` first. It shows which index path will serve each `where` clause:

```bash
$ brainy inspect explain /data/brain --where '{"entityType":"booking","status":"paid"}'
{
  "query": { "where": { "entityType": "booking", "status": "paid" } },
  "fieldPlan": [
    { "field": "entityType", "path": "none", "notes": "No index entries for field..." },
    { "field": "status", "path": "column-store", "notes": "O(log n) binary search..." }
  ],
  "warnings": [
    "Field \"entityType\" has no index entries. find() will return [] silently."
  ]
}
```

The `"path": "none"` is the smoking gun. It means the field has no column
store manifest and no sparse chunked index — so `find()` will return `[]`
regardless of what's actually on disk. Likely causes:

- The writer registered the field in memory but hasn't flushed. Run
  `brain.requestFlush()` from the writer side, or use `brainy inspect
  --fresh` (default).
- The field name has a typo or wrong casing.
- The field is genuinely absent from every entity.

## Health checks

`inspect health` runs a fixed battery of cheap invariant checks:

```bash
$ brainy inspect health /data/brain
{
  "overall": "warn",
  "checks": [
    { "name": "index-parity", "status": "pass", "message": "HNSW (1851) and metadata (1851) agree." },
    { "name": "field-registry", "status": "pass", "message": "23 fields registered for 1851 entities." },
    { "name": "seeded-records", "status": "warn", "message": "15 entities tagged _seeded:true." },
    { "name": "writer-heartbeat", "status": "pass", "message": "Writer healthy (PID 1774431...)." }
  ]
}
```

Each check returns `pass`, `warn`, or `fail`. The exit code is `2` when any
check fails — useful for piping into monitoring or CI.

## Programmatic inspection

```typescript
import { Brainy } from '@soulcraft/brainy'

const reader = await Brainy.openReadOnly({
  storage: { type: 'filesystem', rootDirectory: '/data/brain' }
})

// Force the writer to flush before reading
await reader.requestFlush({ timeoutMs: 5000 })

// What's in there?
const stats = await reader.stats()
console.log(`${stats.entityCount} entities`, stats.entitiesByType)

// Why is this query empty?
const plan = await reader.explain({ where: { entityType: 'booking' } })
for (const f of plan.fieldPlan) {
  console.log(`${f.field} -> ${f.path}`)
}

// Run invariants
const health = await reader.health()
console.log(health.overall)

await reader.close()
```

Every mutation method (`add`, `update`, `delete`, `relate`, `commit`,
`fork`, `branch`, ...) throws on a read-only instance with a clear message.

## Backups

`brainy inspect backup` asks the writer to flush first, then tars the
directory. The snapshot reflects the writer's state at the moment of the
flush:

```bash
brainy inspect backup /data/brain /backups/brain-2026-05-15.tar
```

For periodic backups (hourly, daily), schedule this via cron or your
container scheduler. For point-in-time recovery, use Brainy's COW
`commit()` API — the snapshots there are content-addressed and never
overwritten.

## Comparing two stores

`brainy inspect diff` returns a JSON summary of counts and a sample of
entity IDs present in one but not the other. Useful when debugging
replication or migrations:

```bash
brainy inspect diff /data/brain-prod /data/brain-staging
```

Sample-based — for a full diff, dump both with `inspect dump` and compare
the JSONL.

## Repairing a corrupted store

If invariants fail and you suspect index corruption, `inspect repair`
opens the store in writer mode and rebuilds all indexes from raw storage.
**Stop the live writer first** — `repair` will throw if another writer
holds the lock. Add `--force` only if you have personally verified the
existing lock is stale.

```bash
brainy inspect repair /data/brain
```

## Multi-process safety summary

See [concepts/multi-process](../concepts/multi-process.md) for the lock
semantics, heartbeat behavior, and what's not yet enforced on cloud
backends.
