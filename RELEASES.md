# @soulcraft/brainy — Release Notes for Consumers

This file is the **quick reference for Soulcraft product sessions** tracking Brainy changes.
Full auto-generated changelog: `CHANGELOG.md` · Releases: https://github.com/soulcraftlabs/brainy/releases

**How to use:** Brainy is the underlying data engine for Workshop, Venue, Academy, and
Collective. The SDK wraps it — most products never call Brainy directly. Read this when:
- Upgrading `@soulcraft/brainy` in the SDK or a product
- Debugging data, query, or storage behaviour
- A new Brainy feature is available that SDK should expose

---

## v7.21.0 — 2026-05-15

**Affected products:** All consumers using filesystem storage (Venue, Workshop dev,
local development).

### Multi-process safety + first-class read-only inspector

Filesystem storage now enforces **single-writer, many-reader**. Previously, opening
a second writer process against a live data directory silently produced wrong query
results — no error, no warning, just empty or stale data. This release replaces
that footgun with a hard refusal at init time and a dedicated read-only inspection
mode.

#### New: `Brainy.openReadOnly()`
```ts
const reader = await Brainy.openReadOnly({
  storage: { type: 'filesystem', rootDirectory: '/data/brain' }
})
const bookings = await reader.find({ where: { entityType: 'booking' } })
```
- Does NOT acquire the writer lock — coexists with a live writer.
- Every mutation method throws `Cannot mutate a read-only Brainy instance`.
- `flush()` and `close()` are safe (no-op + clean shutdown).

#### New: writer lock at init
- `new Brainy({ ... })` (default `mode: 'writer'`) acquires
  `<rootDir>/locks/_writer.lock` containing `{ pid, hostname, startedAt, lastHeartbeat, version }`.
- A second writer on the same directory **throws** with the PID, hostname,
  heartbeat, and a pointer to `openReadOnly()`.
- Stale-lock detection: same hostname + dead PID OR heartbeat > 60s ago → overwritten with a warning.
- Heartbeat: writer rewrites `lastHeartbeat` every 10s (unref'd timer).
- Override: pass `{ force: true }` to bypass when you've verified the existing lock is stale.

#### New: `brain.requestFlush({ timeoutMs })`
Cross-process RPC for inspectors to force a fresh snapshot:
- In-process: just calls `flush()`.
- Out-of-process: writes a request file, polls for ack. Times out gracefully.
- Watcher runs in every writer instance (filesystem only).

#### New: `brain.stats()`
Operator-facing summary: `entityCount`, `entitiesByType`, `relationCount`,
`relationsByType`, `fieldRegistry`, `indexHealth`, `storage.backend`, `writerLock`, `version`.
Designed for `/api/health` endpoints and incident triage.

#### New: `brain.explain(findParams)`
Shows which index path serves each `where` clause: `column-store` | `sparse-chunked` | `none`.
**This is the answer to "why is `find()` returning empty?"** — `path: "none"` means
the field has no index entries and the query will silently return `[]`. Includes
notes on likely causes (writer hasn't flushed; typo; field genuinely absent).

#### New: `brain.health()`
Invariant-check battery: HNSW vs metadata count parity, field registry sanity,
`_seeded` entity sweep, writer heartbeat freshness. Returns `{ overall: 'pass' | 'warn' | 'fail', checks: [...] }`.

#### New: `brainy inspect` CLI (13 subcommands)
All read-only by default (internally uses `openReadOnly()`):
```
brainy inspect stats   <path>
brainy inspect find    <path> --type Event --where '{"status":"paid"}' --limit 20
brainy inspect get     <path> <id>
brainy inspect relations <path> <id> --direction both
brainy inspect explain <path> --where '{"entityType":"booking"}'
brainy inspect health  <path>
brainy inspect sample  <path> --type Event --n 20
brainy inspect fields  <path>
brainy inspect dump    <path> --type Event > backup.jsonl
brainy inspect watch   <path> --type Event
brainy inspect backup  <path> /backups/brain.tar
brainy inspect repair  <path>           # writer mode — stop live writer first
brainy inspect diff    <pathA> <pathB>
```
Default behaviour: ask the writer to flush via the RPC first (skip with `--no-fresh`).

### Brainy + Cortex

Cortex segments (`*.cidx`) are immutable mmap files; `MANIFEST.json` uses atomic
rename. The single writer lock at `<rootDir>/locks/_writer.lock` covers both Brainy
and Cortex. Read-only inspectors mmap Cortex segments with zero coordination.

### What's NOT enforced yet

- **Cloud storage backends** (S3, GCS, R2, Azure) — no multi-process locking.
  A best-effort warning logs in writer mode against non-filesystem backends.
- **The `find({ where })`-returns-0 root-cause bug** — tracked separately. The
  new `brain.explain()` and `brain.health()` surface it loudly
  (`path: 'none'`, `index-parity warn`) instead of letting it be silent.

### Upgrade notes

- **Default behaviour change:** opening a Brainy directory in writer mode while
  another writer is live now THROWS where it previously silently produced wrong
  results. If you have scripts that intentionally co-opened a writer directory,
  switch them to `Brainy.openReadOnly()` or pass `{ force: true }`.
- **Cloud backends unchanged** — no lock acquisition for S3/GCS/R2/Azure.
- All existing APIs unchanged. Pure addition.

### Docs

- README "Single-Writer Model" section.
- `docs/concepts/multi-process.md` — full model + Cortex compatibility.
- `docs/guides/inspection.md` — operator recipes.
- JSDoc on every new API.

---

## v7.19.10 — 2026-02-24

**Affected products:** All Bun/ESM consumers (Workshop, Venue, Academy, SDK)

### ESM crypto fix in SSTable

Replaced `require('crypto')` with `import { createHash } from 'node:crypto'` in the
SSTable implementation. Fixes a crash in Bun and strict ESM environments where
CommonJS `require` is unavailable.

No API changes — upgrade and redeploy.

---

## v7.19.2 — 2026-02-18

**Affected products:** All

### Metadata index cleanup on delete

Fixed: metadata indexes were not cleaned up after `delete()` / `deleteMany()`. Stale
index entries could cause phantom results in metadata-filtered queries after deletion.

No API changes. If you were seeing ghost results in filtered queries, this fixes it.

---

## v7.18.0 — 2026-02-16

**Affected products:** Workshop, Venue, Academy (analytics, reporting, session summaries)

### Aggregation engine

New `brain.aggregate()` API — incremental SUM, COUNT, AVG, MIN, MAX with GROUP BY
and time window support. Computes over entity collections without loading all records
into memory.

```typescript
const result = await brain.aggregate({
  collection: 'bookings',
  metrics: [
    { field: 'revenue', fn: 'SUM' },
    { field: 'id', fn: 'COUNT' },
  ],
  groupBy: 'staffId',
  timeWindow: { field: 'createdAt', from: startOfMonth, to: now },
})
```

SDK exposure: `sdk.brainy.aggregate()` — available once SDK is updated to pass through.

---

## v7.17.0 — 2026-02-09

**Affected products:** All (schema evolution, data migrations)

### Migration system

New `brain.migrate()` API with error handling, validation, and enterprise hardening.
Run schema migrations reliably across Brainy data directories.

```typescript
await brain.migrate({
  version: 3,
  up: async (brain) => {
    // transform entities, rename fields, etc.
  },
})
```

---

## v7.16.0 — 2026-02-09

**Affected products:** All

### Data/metadata separation enforced + numeric range queries

- Entity `data` and `metadata` fields are now strictly separated at the storage layer
- Numeric range queries now supported in metadata filters: `{ age: { $gte: 18, $lt: 65 } }`
- Fixes edge cases where mixed data/metadata storage caused inconsistent query results

**Breaking for anyone storing numeric values in metadata and relying on range queries:**
verify your filter syntax matches the new `$gte/$lte/$gt/$lt` operators.

---

## v7.15.5 — 2026-02-02

**Affected products:** Anyone using `@soulcraft/cortex` plugin

### Plugin opt-in clarified

Cortex and other plugins are opt-in. Pass explicitly:
```typescript
new Brainy({ plugins: ['@soulcraft/cortex'] })
```
Without `plugins`, no external plugins are loaded regardless of what's installed.

---

## v7.15.2 — 2026-02-01

**Affected products:** All (data safety)

### Graph LSM flush on close

Fixed: graph LSM-trees were not flushed on `brain.close()`, risking data loss across
restarts. Graph edges written in the final seconds before shutdown are now guaranteed
to be persisted.

No API changes — upgrade immediately if running Brainy in a long-lived server process.
