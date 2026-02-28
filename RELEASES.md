# @soulcraft/brainy — Release Notes for Consumers

This file is the **quick reference for Soulcraft product sessions** tracking Brainy changes.
Full auto-generated changelog: `CHANGELOG.md` · Releases: https://github.com/soulcraftlabs/brainy/releases

**How to use:** Brainy is the underlying data engine for Workshop, Venue, Academy, and
Collective. The SDK wraps it — most products never call Brainy directly. Read this when:
- Upgrading `@soulcraft/brainy` in the SDK or a product
- Debugging data, query, or storage behaviour
- A new Brainy feature is available that SDK should expose

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
