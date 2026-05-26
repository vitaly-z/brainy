# @soulcraft/brainy — Release Notes for Consumers

This file is the **quick reference for Soulcraft product sessions** tracking Brainy changes.
Full auto-generated changelog: `CHANGELOG.md` · Releases: https://github.com/soulcraftlabs/brainy/releases

**How to use:** Brainy is the underlying data engine for Workshop, Venue, Academy, and
Collective. The SDK wraps it — most products never call Brainy directly. Read this when:
- Upgrading `@soulcraft/brainy` in the SDK or a product
- Debugging data, query, or storage behaviour
- A new Brainy feature is available that SDK should expose

---

## v7.23.0 — 2026-05-26

**Affected products:** anyone using aggregation (stats/dashboards), graph traversal, or entity
extraction. Adds two report APIs and fixes three correctness gaps surfaced by BR-ADV-FEATURES-BUN.
Drop-in upgrade from 7.22.x.

### New — `brain.queryAggregate(name, params)`

A first-class report API returning the clean `AggregateResult[]` shape
(`{ groupKey, metrics, count }[]`) directly, instead of the search-`Result` wrapper that
`find({ aggregate })` returns. Accepts `where` / `having` / `orderBy` / `order` / `limit` / `offset`.

### New — HAVING (filter groups by metric value)

`find({ aggregate, having: { revenue: { greaterThan: 1000 } } })` (and the same on
`queryAggregate`) filters groups by their computed metrics — the analytics equivalent of SQL
`HAVING`, complementing `where` (which filters group keys). Evaluated per group: **O(groups),
independent of entity count.**

### Fix — aggregates now backfill when defined over existing data (R1)

Defining an aggregate on a store that already holds matching entities returned `[]` because
write-time hooks only saw *future* writes. It now backfills from existing entities on first query
(one-time scan via `getNouns`, then incremental) — storage-agnostic, so it works under durable
backends (Cortex) where a brain reopens pre-populated. Also: `groupBy:['noun']` now resolves to
the entity type instead of a single null group. `find({ aggregate })` rows now expose
`groupKey`/`metrics`/`count` at the top level (previously only under `.metadata`).

### Fix — multi-hop `find({ connected: { depth, via } })` (traversal)

`depth` and `via` are now honored at **every hop** (previously only the immediate neighbour was
returned, and verb filtering applied to hop 1 only). The BFS is bounded by `limit`.

### Fix — entity extraction type accuracy (R3)

`extractEntities` no longer lets a type indicator in one candidate's surrounding text bleed onto
neighbours (e.g. "Corp" in "Sarah Chen founded Acme Corp" no longer types "Sarah Chen" as
Organization). Each candidate is typed by its own span; context may only reinforce the same type.

---

## v7.22.1 — 2026-05-26

**Affected products:** Anyone using `extractEntities()` / `extractConcepts()`, native
aggregation (`find({ aggregate })`), or multi-hop graph traversal
(`find({ connected: { depth } })`). Three advanced-API correctness fixes — all reproduce on
Node, so they were **not** Bun-specific despite the original report (BR-ADV-FEATURES-BUN).

### Entity/concept extraction no longer returns `[]`

`extractEntities()` / `extractConcepts()` returned empty for entity-rich text. The SmartExtractor
ensemble scored agreeing signals with a weighted **sum** against an absolute 0.60 gate, so a
confident low-weight signal (e.g. a name pattern at 0.82) lost selection to a mediocre
high-weight signal that then failed the gate — dropping the whole result. It now selects and
gates on a normalized weighted **average**. Also: the `confidence` option now actually controls
the threshold (was a dead hardcoded 0.60), and the embedding-signal timeout was raised
100ms → 2000ms so the neural signal isn't silently dropped on slower runtimes.

*Known limitation:* type accuracy on dense multi-entity sentences is still imperfect — a strong
indicator in one entity's surrounding text can bleed onto neighbours. Tracked separately.

### `find({ aggregate })` exposes `groupKey` / `metrics` / `count`

Aggregation always computed correct values, but rows nested them under `.metadata`, so callers
expecting the documented `AggregateResult` shape saw empty-looking rows. Those three fields are
now also present at the top level of each result row.

### Multi-hop `find({ connected: { depth } })` honours depth

Previously returned only the immediate (1-hop) neighbour at any depth because the graph-search
path ignored `depth` / `via`. It now performs the full depth-aware traversal.

---

## v7.22.0 — 2026-05-15

**Affected products:** All. Fixes a silent-data-loss class affecting `find()` and
`brain.stats()`, plus Cortex-compatibility regression from 7.21.0. Recommended
upgrade for everyone on 7.20.x or 7.21.x.

### Two correctness fixes

#### 1. `find({ where })` no longer silently returns `[]` (BR-FIND-WHERE-ZERO)

The 7.20.0 column-store refactor deleted the legacy sparse-index write path
but left `getStats()` and `getIds()` reading from sparse indices. New
workspaces had no sparse-index files, so:
- `brain.stats().entityCount` was `0` regardless of actual entity count
- `find({ where: { ... } })` returned `[]` regardless of actual matches
- `rebuildIndexesIfNeeded()` saw `0` entries → fired the `[Brainy] CRITICAL ...
  Second rebuild result: 0 entries` log → application saw no indexed data

7.22.0 makes the ColumnStore the single source of truth post-7.20.0:
- `MetadataIndex.getStats()` reads from `ColumnStore.getIndexedFields()` and
  `idMapper.size`. Entity count is now accurate across writer → close →
  reader-open cycles.
- `MetadataIndex.getIdsFromChunks()` throws `BrainyError(FIELD_NOT_INDEXED)`
  when neither column store nor legacy sparse index has the field.
- `MetadataIndex.getIdsForFilter()` catches per-clause, logs
  `[brainy] find() where-clause referenced unindexed field(s): ...`, returns
  `[]`. Production `find()` is now consistent with `brain.explain()`'s
  `path: 'none'` diagnostic.

Separately, `BaseStorage.getNounType()` was hardcoded to return `'thing'`
since a type-cache removal in commit `42ae5be`. Every noun save attributed
the entity to `'thing'` regardless of its actual type, poisoning
`_system/type-statistics.json` and `brain.stats().entitiesByType`. 7.22.0
restores type-correct attribution:
- New `nounTypeByIdCache: Map<string, NounType>` on `BaseStorage`, populated
  in `saveNounMetadata_internal` and consumed in `saveNoun_internal`.
- New `flushCounts()` override that persists `nounCountsByType` /
  `verbCountsByType` alongside the per-entity counter. Readers opening the
  same directory after a writer flush now see correct per-type counts.

**Self-heal at init.** If `loadTypeStatistics()` detects the poisoned-state
signature (all nouns attributed to `'thing'` with multiple non-`thing`
entities on disk), it auto-runs `rebuildTypeCounts()` once and rewrites the
file. A `[BaseStorage] Detected poisoned type-statistics.json signature ...`
warning is logged. Operators don't need to take any action — the first 7.22
open of a directory poisoned by 7.20.0/7.21.0 fixes it.

**`brainy inspect repair`** can also be used to manually trigger
`rebuildTypeCounts()`. It's now public on `BaseStorage`.

#### 2. Cortex 2.2.x no longer crashes 7.21.0 boot (BR-DEFENSIVE-INTERFACE)

7.21.0 added new storage-adapter methods (`supportsMultiProcessLocking`,
`acquireWriterLock`, etc.) and called them unconditionally. Cortex 2.2.0's
mmap storage adapter bundles a pre-7.21 `BaseStorage` and doesn't define
them, so Venue's 7.21.0 upgrade attempt threw
`TypeError: this.storage.supportsMultiProcessLocking is not a function`
at boot.

7.22.0 introduces `hasStorageMethod(name)` on Brainy and guards every new-
method call site. Older adapters degrade with a one-line warning at init:
```
[brainy] Storage adapter `CortexMmapStorage` predates the 7.21
multi-process methods. Writer locking and the flush-request RPC are
disabled for this directory. Upgrade the plugin (e.g.
`@soulcraft/cortex` ≥2.3.0) for full enforcement.
```

### Dead-code cleanup

Removed `MetadataIndexManager.dirtyChunks`, `dirtySparseIndices`, and the
`flushDirtyMetadata()` no-op machinery. These accumulators stopped being
populated when the sparse-index write path was deleted in 7.20.0; the
remaining 6 callers wasted async hops on an empty Map iteration.

### Upgrade notes

- **Behaviour change:** `find({ where: { unindexedField: ... } })` previously
  returned `[]` silently. It now logs a one-line warning and still returns
  `[]`. The diagnostic message names the field — use
  `brain.explain({ where: { ... } })` for full diagnosis. No code change
  needed for callers that already handle empty results.
- **Behaviour change (good):** `brain.stats()` and `brain.health()` now
  report accurate per-type counts. If you previously relied on the buggy
  `entitiesByType.thing` over-count, update consumers.
- **No API breaks.** Pure additive on the public surface.

### Cortex consumers

Cortex 2.2.x continues to work against 7.22.0 thanks to the defensive
guards, but for full multi-process protection on Cortex-backed stores and
to make sure Cortex's native MetadataIndex picks up the find-where-zero
fix, Cortex 2.3.0 is recommended. Tracked as `CX-MULTIPROC-METHOD` in the
internal platform handoff.

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
