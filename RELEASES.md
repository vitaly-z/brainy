# @soulcraft/brainy — Release Notes for Consumers

This file is the **quick reference for downstream sessions** tracking Brainy changes.
Full auto-generated changelog: `CHANGELOG.md` · Releases: https://github.com/soulcraftlabs/brainy/releases

**How to use:** Brainy is the underlying data engine for downstream applications. Read this when:
- Upgrading `@soulcraft/brainy` in your application
- Debugging data, query, or storage behaviour
- A new Brainy feature is available that you want to adopt

---

## v7.30.2 — 2026-06-08

**Affected products:** any consumer with `find({ limit })` call sites that pass values
≥ ~9000 — a common safety-cap pattern in production code (`limit: 10_000` against
type-filtered queries that typically return 10–500 entities). Additive; drop-in
from 7.30.1.

### Why

Brainy 7.30 introduced a memory-derived cap on `find({ limit })` to prevent OOM
from runaway queries. The cap was sound in intent but **~4× too conservative in
calibration**: the formula assumed 100 KB per result while typical entity footprint
is 7-10 KB (384-dim float32 vector ≈ 1.5 KB + standard fields + metadata). On a 900 MB
free-memory box this capped `limit` at 9000, breaking production dashboards where
cascading 500s from queries with `limit: 10_000` silently degraded the `Promise.all`
loading the canvas.

7.30.2 recalibrates the formula and changes the enforcement from synchronous-throw
to two-tier (warn-then-throw) so existing pre-7.30 code doesn't break on upgrade.

### Recalibrated formula — `25 KB` per result (was `100 KB`)

The auto-configured cap now uses a realistic per-result size:

| Memory source | 7.30.0–7.30.1 cap | 7.30.2 cap |
|---|---|---|
| 4 GB Cloud Run container | 10 000 | 40 000 |
| 2 GB container | 5 000 | 20 000 |
| 900 MB free system memory | 9 000 | ~36 000 |
| `reservedQueryMemory: 1 GB` | 10 000 | 40 000 |

Hard ceiling stays at 100 000. Existing `BrainyConfig.maxQueryLimit` /
`reservedQueryMemory` overrides continue to work unchanged.

### Two-tier enforcement — warn, then throw

**Below cap (`limit ≤ maxLimit`):** silent pass. No signal, no friction. Unchanged.

**Soft tier (`maxLimit < limit ≤ 2 × maxLimit`)** *NEW*: one-time warning per call
site (dedup keyed on stack location + limit value), query proceeds. Pre-7.30.2 code
that relied on the cap silently allowing safety-cap limits keeps working — the
warning teaches the recipe so consumers can fix it intentionally.

**Hard tier (`limit > 2 × maxLimit`)** *NEW*: throw with the same message format the
warning uses. Real OOM territory; the cap stops being a recommendation and becomes
a guardrail.

The 2× soft margin is chosen to absorb existing safety-cap patterns (`limit: 10_000`
against a 9 K-cap box) without disabling OOM protection. Real OOM territory on a JS
in-memory brain is hundreds of thousands of results, not 10× the safety cap.

### Improved error / warning message (mirrors the 7.30.1 enforcement-error format)

Before (7.30 → 7.30.1):
```
limit exceeds auto-configured maximum of 9000 (based on available memory)
```

After (7.30.2):
```
find({ limit: 10000 }) exceeds the auto-configured query limit of 9000 (basis:
available free memory). Choose one:
  • Increase the cap: new Brainy({ maxQueryLimit: 10000 })
  • Reserve more memory: new Brainy({ reservedQueryMemory: 256000000 })
  • Paginate: split the query with { limit, offset } pages
  at OrderService.loadDashboard (/app/src/orders/dashboard.ts:142:18)
Docs: https://soulcraft.com/docs/guides/find-limits
```

Caller location comes from the same `findCallerLocation()` helper introduced in
7.30.1 (now extracted to `src/utils/callerLocation.ts` so both subtype enforcement
and limit enforcement share it).

### New docs

New `docs/guides/subtypes-and-facets.md`-style guide at
`docs/guides/find-limits.md` (public, indexed) — explains the cap, the four memory
sources the auto-config considers, the three escape valves (`maxQueryLimit`,
`reservedQueryMemory`, pagination), and when to use which. Explicit "pagination is
the future-proof pattern" callout — the cap can get tighter in 8.0 (Datomic-style
`Db.find()` may make per-call limits stricter to keep snapshot semantics cheap),
but pagination keeps working unchanged.

`docs/api/README.md` `find()` entry gets a one-paragraph `limit` tip + pointer
to the new guide.

### Tests

- **New `tests/integration/find-limits.test.ts`** (9 tests): below-cap silent
  pass; soft-tier warns once per call site (dedup verified by exercising same vs.
  different source lines); soft-tier message format (names all three escape
  valves + docs link); soft-tier message includes caller location; hard-tier
  throws; hard-tier message format same as soft-tier; consumer `maxQueryLimit`
  override raises the cap and shifts both tiers accordingly; **the pre-7.30.2
  regression scenario** explicitly covered — `limit: 10_000` against a
  `maxQueryLimit: 9000` cap now warns and passes instead of throwing.
- Existing unit tests in `tests/unit/utils/memoryLimits.test.ts` updated to
  reflect the recalibrated formula (5 tests: hardcoded values for
  container / reserved / free-memory paths bumped 4×).
- Existing `paramValidation.test.ts` "should auto-limit based on system memory"
  test extended to cover the new three-tier semantics (below-cap pass /
  soft-tier silent / hard-tier throw).
- All prior suites still green: subtype-and-facets 26/26, verb-subtype-and-
  enforcement 30/30, strict-mode-self-test 13/13. Unit 1468/1468.

### Cortex compatibility

**No Cortex changes required for 7.30.2.** Every change is JS-side: formula
recalibration runs in `ValidationConfig.constructor()`, two-tier enforcement runs
in `validateFindParams()`, both fire before any storage/index/Cortex call. Cortex
2.x and the pending Cortex 3.0 work both stay compatible without code changes.

The new `docs/guides/find-limits.md` calls out that 8.0's Datomic-style `Db.find()`
may tighten per-call limits; that's a Brainy 8.0 / Cortex 3.0 coordination point
documented in `.strategy/BRAINY-8.0-SUBTYPE-CONTRACT.md` (open question #4 covers
the rollout staging, which now also applies to query limits).

### What consumers should do

- **If you've been carrying a `limit: 9000` workaround for the 7.30.0–7.30.1
  cap:** drop it on bump to 7.30.2 — existing `limit: 10_000` patterns now
  warn (teaching the recipe) but no longer throw. The warning is
  one-time-per-call-site, so production logs don't spam.
- **All other consumers:** no action required if no enforcement-error was being
  hit. If you see new `[Brainy]` warnings in logs after upgrade, follow the
  recipe in the warning or read `docs/guides/find-limits.md`.
- **SDK wrappers:** wrapper-level pools that auto-construct `Brainy` instances
  should consider surfacing `maxQueryLimit` / `reservedQueryMemory` as
  consumer-facing config; Brainy now documents the knob explicitly.

---

## v7.30.1 — 2026-06-08

**Affected products:** anyone running a brain where a platform layer (SDK, framework wrapper)
has registered `brain.requireSubtype()` rules on common NounTypes, AND anyone preparing for
the upcoming Brainy 8.0 default-on strict mode. Additive; drop-in from 7.30.0. No behavior
change for consumers not using strict-mode enforcement.

### Why

Production incident 2026-06-08: a consumer using SDK 3.20.0 (which registers
`requireSubtype()` rules on `NounType.{Event, Collection, Message, Contract, Media, Document}`)
saw their booking flow start returning 500s because `brain.add({ type: NounType.Event, ... })`
calls in their codebase lacked `subtype`. An audit of Brainy's OWN source revealed 14 HIGH-risk
internal write paths that also omit subtype — VFS move/copy/symlink edges, aggregation
materializer, neural extraction, importers, integrations (Sheets/OData), MCP client, CLI.
Any consumer running `requireSubtype()` rules on those NounTypes was one step away from breaking
Brainy's own infrastructure paths, not just their own code. 7.30.1 closes both gaps before
8.0 ships and makes strict mode the default.

### New — `brain.audit()` diagnostic

Find entities and relationships missing a `subtype` value, grouped by type. The companion to
`migrateField()` (and to 8.0's `fillSubtypes()`): answers "what would break if I enabled
strict subtype enforcement?".

```typescript
const report = await brain.audit()
// {
//   entitiesWithoutSubtype: { event: 24, document: 3 },
//   relationshipsWithoutSubtype: { relatedTo: 1402 },
//   total: 1429,
//   scanned: 8400,
//   recommendation: 'Found 1429 entries without subtype. Migrate via `brain.migrateField()`
//                    (7.x) — or wait for `brain.fillSubtypes()` (8.0) which closes the same
//                    gap with caller-supplied rules.'
// }
```

VFS infrastructure entities are excluded by default (they bypass enforcement via
`metadata.isVFSEntity` markers). Pass `{ includeVFS: true }` to surface them.

### New — Improved enforcement error messages

The error fired when subtype enforcement rejects a write now includes:

1. **The caller's source location** — extracted from the JavaScript stack so you see your own
   call site, not a Brainy internal frame. Eliminates the "grep your repo for `brain.add`" step.
2. **Specific guidance** — points at the registered vocabulary when one exists; mentions
   brain-wide strict mode and the `except` escape valve when not; otherwise the
   `brain.requireSubtype()` registration recipe.
3. **A documentation link** — `https://soulcraft.com/docs/guides/subtypes-and-facets#strict-mode`
   for the canonical migration recipe.

Before:
```
add(): NounType.Event requires subtype but got undefined. Register vocabulary via brain.requireSubtype().
```

After:
```
add(): NounType.event requires subtype but got undefined.
  at OrderService.getOrCreateByToken (/app/src/orders/draft.ts:42:23)
  Pass one of: standard, recurring, milestone.
  Migration recipe: https://soulcraft.com/docs/guides/subtypes-and-facets#strict-mode
```

### Internal subtype labels — Brainy's own infrastructure paths

Every internal Brainy write path now sets a stable, queryable `subtype`. Consumers don't need
to do anything for these — they're documented here so you can query Brainy-managed data:

| Code path | NounType / VerbType | Subtype label |
|---|---|---|
| VFS root directory `/` | `Collection` | `'vfs-root'` |
| VFS subdirectories | `Collection` | `'vfs-directory'` |
| VFS files | mime-driven (e.g. `Document`/`Code`/`Image`) | `'vfs-file'` |
| VFS symlinks | `File` | `'vfs-symlink'` (NEW — distinct from `'vfs-file'`) |
| VFS Contains edges (create + move/copy/symlink/batch) | `Contains` | `'vfs-contains'` |
| Aggregation materialized output | `Measurement` | `'materialized-aggregate'` |
| Import-source provenance entity | `Document` | `'import-source'` |
| Importer-extracted entities | extractor-driven type | `'imported'` |
| Importer placeholder targets | `Thing` | `'import-placeholder'` |
| Neural extraction | extractor-driven type | `'extracted'` |
| GoogleSheets API entity writes | request-driven | `'imported-from-sheets'` |
| OData API entity writes | request-driven | `'imported-from-odata'` |
| MCP message storage | `Message` | `'mcp-message'` |
| `brainy add` CLI default | user-supplied type | `'cli-add'` |
| `brainy relate` CLI default | user-supplied verb | `'cli-relate'` |

Query examples:

```typescript
// Every VFS-managed file in your brain
await brain.find({ subtype: 'vfs-file' })

// Document breakdown — distinguishes import-source from extracted/imported/user content
brain.counts.bySubtype(NounType.Document)
// → { 'import-source': 12, 'imported': 847, 'extracted': 34, 'vfs-file': 102, ... }
```

### Caller-supplied `defaultSubtype` on importers and extraction

Importer + extraction paths now accept a caller-supplied `defaultSubtype` config so consumers
can tag a whole batch with their own provenance label instead of the Brainy default:

```typescript
// SmartImportOrchestrator / ImportCoordinator / NeuralImport all accept this
await brain.importer.import(file, {
  defaultSubtype: 'customer-upload-2026q2',  // your batch label
  // ...
})
```

Precedence: extractor-set subtype (highest) → caller's `defaultSubtype` → Brainy default
(`'imported'` for importers, `'extracted'` for extractors).

### CLI `--subtype` flag

`brainy add` and `brainy relate` gain a `--subtype <value>` (`-s`) flag for use with
strict-mode brains:

```bash
brainy add "Avery Brooks — runs the AI lab" --type person --subtype employee
brainy relate alice manages bob --subtype direct
```

When the flag isn't supplied, the CLI uses `'cli-add'` / `'cli-relate'` as defaults so
ad-hoc CLI usage still works against strict-mode brains.

### Cortex compatibility

**No Cortex changes required for 7.30.1.** Every change is JS-side: internal subtype labels are
arbitrary strings stored transparently by Cortex; `brain.audit()` runs purely on JS via existing
`storage.getNouns()` / `getVerbs()` pagination; the CLI is JS-only; error messages fire in
Brainy before any native call.

**For Cortex 3.0 (forward-looking, not blocking):**

- **Native `audit()` proxy.** For billion-scale brains, `audit()` walks every entity (O(N)).
  A native implementation reading from a "null-subtype" bitmap in the column store would be
  O(buckets). Listed as the 6th open question in the
  [Brainy 8.0 spec doc](`/media/dpsifr/storage/home/Projects/brainy/.strategy/BRAINY-8.0-SUBTYPE-CONTRACT.md`).
- **Strict-mode parity test.** Cortex should mirror Brainy's new
  `tests/integration/strict-mode-self-test.test.ts` against their native paths to catch any
  latent bug where native writes bypass JS validation.
- **Reserved-label awareness (optional).** Brainy's internal labels (`'vfs-*'`,
  `'materialized-aggregate'`, `'imported'`, `'extracted'`, `'mcp-message'`, `'cli-*'`) become
  a documented part of the 8.0 contract; useful for telemetry that surfaces "X% of entities are
  Brainy-managed infrastructure".

### Docs

Updated `docs/guides/subtypes-and-facets.md` with a new "Strict mode in practice" section
covering the SDK_CORE_VOCABULARY pattern, a 4-step migration recipe, the Brainy-internal label
reference table, and an 8.0 forward-look. `docs/api/README.md` documents `brain.audit()` and
adds a strict-mode tip to the `add()` / `relate()` reference entries.

### Tests

- **New `tests/integration/strict-mode-self-test.test.ts`** (13 tests): creates a brain under
  a realistic consumer vocabulary shape + brain-wide strict mode, then exercises every
  internal Brainy path (VFS root/mkdir/writeFile/cp/mv/ln, aggregation engine, audit
  diagnostic, error-message UX). Zero rejections expected.
- Existing 7.30.0 + 7.29.0 integration suites unchanged: 26/26 + 30/30.
- Unit suite unchanged: 1468/1468.

---

## v7.30.0 — 2026-06-05

**Affected products:** consumers modeling typed relationships with sub-classification
(direct vs dotted-line management; spouse / sibling / colleague; collaborator vs competitor;
etc.), and anyone wanting to enforce the pairing of `type` + `subtype` on every write.
Additive; drop-in from 7.29.x. No deprecations.

### Symmetric — `subtype` on relationships (parity with 7.29.0 nouns)

`subtype?: string` is now a first-class standard field on every relationship, mirroring the
noun-side work shipped in 7.29.0. Verbs and nouns are now first-class peers — every API
available on the noun side has a verb-side mirror.

```typescript
const ceoId = await brain.add({ type: NounType.Person, subtype: 'employee', data: 'Avery' })
const vpId = await brain.add({ type: NounType.Person, subtype: 'employee', data: 'Jordan' })

await brain.relate({
  from: ceoId,
  to: vpId,
  type: VerbType.ReportsTo,
  subtype: 'direct'                    // sub-classification on the edge
})
```

**Read & filter:**

```typescript
// Fast-path filter — column-store hit, not metadata fallback
const direct = await brain.getRelations({
  from: ceoId,
  type: VerbType.ReportsTo,
  subtype: 'direct'
})

// Set membership
const all = await brain.getRelations({
  from: ceoId,
  type: VerbType.ReportsTo,
  subtype: ['direct', 'dotted-line']
})

// Traversal filter (depth-1 in JS; multi-hop lands on Cortex native)
const reports = await brain.find({
  connected: { from: ceoId, via: VerbType.ReportsTo, subtype: 'direct', depth: 1 }
})
```

### New — `updateRelation()` closes a long-standing gap

Verbs previously had no update method — the only way to change a relationship was
delete-then-recreate, which lost the relation id. 7.30 ships `brain.updateRelation()`:

```typescript
await brain.updateRelation({ id: relId, subtype: 'dotted-line' })
await brain.updateRelation({ id: relId, weight: 0.5, confidence: 0.9 })

// Change verb type — re-indexes in graph adjacency, id preserved
await brain.updateRelation({ id: relId, type: VerbType.WorksWith })
```

### New — O(1) verb subtype counts via the persisted rollup

`_system/verb-subtype-statistics.json` mirrors the noun-side rollup shipped in 7.29.0.
Per-VerbType-per-subtype counts are maintained incrementally and persisted; reads are O(1):

```typescript
brain.counts.byRelationshipSubtype(VerbType.ReportsTo)
// → { direct: 12, 'dotted-line': 3 }

brain.counts.byRelationshipSubtype(VerbType.ReportsTo, 'direct')   // O(1) point
// → 12

brain.counts.topRelationshipSubtypes(VerbType.ReportsTo, 3)
// → [['direct', 12], ['dotted-line', 3]]

brain.relationshipSubtypesOf(VerbType.ReportsTo)
// → ['direct', 'dotted-line']
```

### New — `brain.requireSubtype(type, options)` per-type enforcement

Unified API for noun OR verb types — register specific types as requiring a subtype,
optionally with a fixed vocabulary:

```typescript
brain.requireSubtype(NounType.Person, {
  values: ['employee', 'customer', 'vendor'],
  required: true
})

brain.requireSubtype(VerbType.ReportsTo, {
  values: ['direct', 'dotted-line'],
  required: true
})

// Now this throws — Person requires subtype:
await brain.add({ type: NounType.Person, data: 'no subtype' })

// And this throws — 'matrix' isn't in the registered vocabulary:
await brain.relate({ from: a, to: b, type: VerbType.ReportsTo, subtype: 'matrix' })
```

### New — Brain-wide strict mode

`new Brainy({ requireSubtype: true })` enforces subtype on every public write across the
whole brain. Composes with per-type rules; per-type rules win when both apply.

```typescript
// Every write must include subtype
const brain = new Brainy({ requireSubtype: true })

// Exempt specific types (e.g. catch-all Thing)
const brain2 = new Brainy({
  requireSubtype: { except: [NounType.Thing, NounType.Custom] }
})
```

When strict mode is on:
- Every `add()` / `addMany()` / `update()` / `relate()` / `relateMany()` / `updateRelation()`
  rejects writes missing a subtype on a non-exempt type.
- `addMany()` and `relateMany()` validate every item BEFORE any storage write —
  atomic-fail semantics, no partial writes.
- Brainy's own infrastructure writes (VFS root, directories, files) bypass via the
  `metadata.isVFSEntity: true` marker so existing consumers' VFS usage continues to work.

The brain-wide flag becomes the default in 8.0.0; the type-level `subtype` field becomes
required at the type system level. The full 8.0 contract upgrade is coordinated through the
internal platform handoff (`CTX-SUBTYPE-8.0-CONTRACT`).

### `migrateField()` extended to verbs

The migration helper shipped in 7.29.0 now walks verbs too via the new `entityKind` option:

```typescript
// Migrate verb-side metadata.kind → top-level subtype
await brain.migrateField({
  from: 'metadata.kind',
  to: 'subtype',
  entityKind: 'verb'
})

// Or walk nouns and verbs in one pass
await brain.migrateField({
  from: 'metadata.kind',
  to: 'subtype',
  entityKind: 'both'
})
```

Default is `entityKind: 'noun'` (backward-compatible).

### Symmetry — noun + verb capability matrix

7.30 closes every gap between nouns and verbs. Every capability available on the noun side
has a verb-side mirror:

| Capability | Nouns | Verbs |
|---|---|---|
| `subtype` top-level field | ✓ (7.29) | ✓ (7.30 new) |
| Standard-field set | `STANDARD_ENTITY_FIELDS` | `STANDARD_VERB_FIELDS` (new) |
| Field resolver helper | `resolveEntityField` | `resolveVerbField` (new) |
| Statistics rollup | `_system/subtype-statistics.json` | `_system/verb-subtype-statistics.json` (new) |
| Counts breakdown | `counts.bySubtype` / `topSubtypes` / `subtypesOf` | `counts.byRelationshipSubtype` / `topRelationshipSubtypes` / `relationshipSubtypesOf` (new) |
| Fast-path filter | `find({type, subtype})` | `getRelations({type, subtype})` + `find({connected, subtype})` (new) |
| Update method | `update()` | `updateRelation()` (new — closed pre-7.30 gap) |
| Migration helper | `migrateField()` | `migrateField({entityKind: 'verb'\|'both'})` (new) |
| Enforcement | `requireSubtype(NounType, ...)` | `requireSubtype(VerbType, ...)` — one unified API |
| Brain-wide strict mode | `new Brainy({ requireSubtype })` covers both | same |

### Cortex compatibility

Verb subtype works under Cortex out of the box via auto-field-indexing. Cortex parity items
for the verb side (native query planner recognition, `verbSubtypeCountsByType` native rollup,
per-edge subtype on native graph adjacency for multi-hop traversal filtering) ship in the
next Cortex release. Not a Brainy blocker.

### Docs

Full guide: `docs/guides/subtypes-and-facets.md` (extended with Layer V + Enforcement
sections). The verb subtype + enforcement APIs are documented in `docs/api/README.md`.

---

## v7.29.0 — 2026-06-04

**Affected products:** anyone modeling entities with per-product sub-classification — every
consumer that's been reaching for `metadata.kind`, a custom `metadata.subtype` field, a
`data.kind` shape inside the payload, or similar ad-hoc conventions. Additive; drop-in from
7.28.x. No deprecations.

### New — `subtype` promoted to a top-level standard field

`subtype?: string` is now a first-class standard field on every entity, alongside `type` /
`confidence` / `weight`. Use it as the platform-standard primitive for sub-classifying entities
within a NounType (`Person` → `'employee'` / `'customer'`; `Document` → `'invoice'` / `'contract'`;
`Event` → `'milestone'` / `'meeting'`):

```typescript
await brain.add({
  data: 'Avery Brooks — runs the AI lab',
  type: NounType.Person,
  subtype: 'employee',                  // top-level write param
  metadata: { department: 'ai-lab' }
})

// Fast-path filter — column-store hit, not metadata fallback:
const employees = await brain.find({ type: NounType.Person, subtype: 'employee' })

// Set membership:
const internal = await brain.find({
  type: NounType.Person,
  subtype: ['employee', 'contractor']
})
```

Flat string, no hierarchy — your vocabulary, your choice. Brainy stores and counts, never validates.

### New — O(1) subtype counts via the persisted rollup

A new `_system/subtype-statistics.json` rollup is maintained incrementally as entities are added,
updated, and deleted — mirroring the existing `nounCountsByType` machinery with the same self-heal
behavior on poison detection. Counts are O(1) at billion scale:

```typescript
brain.counts.bySubtype(NounType.Person)
// → { employee: 12, customer: 847, vendor: 34 }

brain.counts.bySubtype(NounType.Person, 'employee')   // O(1) point count
// → 12

brain.counts.topSubtypes(NounType.Person, 3)
// → [['customer', 847], ['employee', 12], ['vendor', 34]]

brain.subtypesOf(NounType.Person)
// → ['customer', 'employee', 'vendor']
```

### New — `brain.trackField()` for other metadata facets

For facets that aren't the *primary* sub-classification (`status`, `source`, `role`, `paradigm`),
`trackField` registers a field for cardinality + per-NounType breakdown stats without promoting
each one to a top-level slot. Piggybacks on the existing aggregation engine, so backfill-on-define
applies — registering on a populated brain scans existing entities on the first query:

```typescript
brain.trackField('status', { perType: true })

await brain.counts.byField('status')
// → { todo: 12, doing: 3, done: 47 }

await brain.counts.byField('status', { type: NounType.Task })
// → { todo: 8, doing: 2, done: 30 }

// Opt-in vocabulary validation:
brain.trackField('priority', { values: ['low', 'medium', 'high'] })
// brain.add({ ..., metadata: { priority: 'urgent' } }) → throws
```

### New — generic `brain.migrateField()` for one-shot rewrites

Streams every entity and copies a value from one field path to another. Supports top-level
standard fields, `metadata.*`, and `data.*` paths; idempotent; with optional `readBoth: true`
deprecation window that preserves the source field alongside the new one:

```typescript
// Phase 1: dual-populate (legacy readers still work)
await brain.migrateField({
  from: 'metadata.kind',
  to: 'subtype',
  readBoth: true
})

// ...readers migrate to subtype at their own pace...

// Phase 2: clear the source field
await brain.migrateField({ from: 'metadata.kind', to: 'subtype' })
// → { scanned: 1500, migrated: 1500, skipped: 0, errors: [] }
```

Supports `batchSize` and `onProgress` for large brains.

### Aggregation composition

`subtype` is a standard-field group-by dimension out of the box — no `where:` wrapper, no
metadata-fallback overhead:

```typescript
await brain.find({
  aggregate: {
    groupBy: ['type', 'subtype'],
    metrics: { count: { op: 'COUNT' } }
  }
})
// [
//   { groupKey: { type: 'person',   subtype: 'customer' }, count: 847 },
//   { groupKey: { type: 'person',   subtype: 'employee' }, count: 12 },
//   { groupKey: { type: 'document', subtype: 'invoice'  }, count: 2103 },
//   ...
// ]
```

### Cortex compatibility

Subtype works under Cortex out of the box via auto-field-indexing. Cortex will land its own
native-side query-planner recognition + `subtypeCountsByType` native rollup in the next Cortex
release for full parity with `type`'s fast path. Not a Brainy blocker — subtype reads/writes
function correctly with current Cortex.

### Docs

Full guide: `docs/guides/subtypes-and-facets.md`. Subtype is documented as a core primitive
throughout `README.md`, `docs/DATA_MODEL.md`, `docs/architecture/finite-type-system.md`,
`docs/api/README.md`, and `docs/QUERY_OPERATORS.md`.

---

## v7.24.0 — 2026-05-26

**Affected products:** aggregation/reporting users + anyone calling `extractEntities` on
multi-entity text. Additive; drop-in from 7.23.x.

### New — array-unnest `groupBy` (tag frequency / faceted counts)

A `groupBy` dimension can now be `{ field, unnest: true }`: the field holds an array and the
entity contributes once per **distinct** element. Enables tag-frequency / label-count style
aggregates:

```typescript
brain.defineAggregate({
  name: 'tag_frequency',
  source: { type: NounType.Document },
  groupBy: [{ field: 'tags', unnest: true }],
  metrics: { count: { op: 'count' } }
})
// queryAggregate('tag_frequency', { orderBy: 'count', order: 'desc' })
```

Duplicate elements on one entity count once; an entity with an empty/missing array joins no group.

### Perf — entity extraction batch-embeds candidates

`extractEntities` / `extractConcepts` now embed all unique candidate spans in a single
`embedBatch` call instead of one `embed()` per candidate (N sequential model calls before). No
behavior change — and with vectors reliably available, the embedding signal more consistently
reinforces correct types (e.g. clearer Organization confidence). Falls back to per-candidate
embedding if a batch call fails.

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
them, so a consumer's 7.21.0 upgrade attempt threw
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

**Affected products:** All consumers using filesystem storage (production deploys,
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

**Affected products:** All Bun/ESM consumers

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

**Affected products:** Analytics, reporting, and session-summary consumers

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
