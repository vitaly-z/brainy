---
title: Subtypes & Facets
slug: guides/subtypes-and-facets
public: true
category: guides
template: guide
order: 7
description: Use the top-level `subtype` field to sub-classify entities within a NounType, track other metadata facets like status or role, and migrate field names without downtime.
next:
  - guides/aggregation
  - api/reference
---

# Subtypes & Facets

> Sub-classify entities within a NounType, track arbitrary metadata facets, and migrate field names without downtime.

## Why this exists

Brainy's `NounType` (Person, Document, Event, Concept, Task, …) is a stable, flat 42-type taxonomy. It's deliberately coarse — every product needs a way to further classify entities *within* a type. Is this `Person` an employee or a customer? Is this `Document` an invoice or a contract? Is this `Event` a meeting or a milestone?

Three layers solve this:

| Layer | Use it for | Shape |
|---|---|---|
| **`subtype`** | The primary sub-classification of an entity, one value per entity | Top-level standard field |
| **`trackField()`** | Other facets you want to count or filter on (`status`, `source`, `role`, `paradigm`) | Registered metadata field |
| **`migrateField()`** | Renaming or restructuring fields across an existing dataset | One-shot stream-and-rewrite |

## Layer 1 — `subtype`

`subtype` is a top-level standard field on every entity, alongside `type` / `confidence` / `weight`. Flat string, no hierarchy. The vocabulary is your choice — Brainy stores and counts, never validates.

### Write

```typescript
import { Brainy, NounType } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

await brain.add({
  data: 'Avery Brooks — runs the AI lab',
  type: NounType.Person,
  subtype: 'employee',                  // top-level write param
  metadata: { department: 'ai-lab' }
})
```

### Read

```typescript
// Top-level filter — standard-field fast path, no `where` wrapper:
const employees = await brain.find({ type: NounType.Person, subtype: 'employee' })

// Set membership:
const internal = await brain.find({
  type: NounType.Person,
  subtype: ['employee', 'contractor']
})

// Operator-form predicates use `where`:
const typed = await brain.find({
  type: NounType.Person,
  where: { subtype: { exists: true } }
})
```

### What it looks like

```json
{
  "id": "01HZK3M7TW...",
  "type": "person",
  "subtype": "employee",
  "data": "Avery Brooks — runs the AI lab",
  "metadata": { "department": "ai-lab" }
}
```

`subtype` lives at the **top level** — NOT inside `metadata`, NOT inside `data`. That's what makes the fast path possible: queries on `subtype` hit the column-store index directly, never the metadata fallback.

### Counts (O(1))

```typescript
// All subtypes for a NounType
brain.counts.bySubtype(NounType.Person)
// → { employee: 12, customer: 847, vendor: 34 }

// Point count
brain.counts.bySubtype(NounType.Person, 'employee')
// → 12

// Top N
brain.counts.topSubtypes(NounType.Person, 3)
// → [['customer', 847], ['employee', 12], ['vendor', 34]]

// Distinct subtypes for a NounType
brain.subtypesOf(NounType.Person)
// → ['customer', 'employee', 'vendor']
```

These are O(1) lookups backed by `_system/subtype-statistics.json` — no scan, no storage round-trip. The rollup is incrementally maintained as entities are added, updated, and deleted.

### Aggregation

`subtype` is a first-class group-by dimension:

```typescript
const rows = await brain.find({
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

## Layer 2 — `trackField()`

Some metadata fields aren't *the* sub-classification of an entity but are still worth counting: `status`, `source`, `role`, `paradigm`. Promoting each one to top-level would clutter the contract. `trackField()` registers a metadata field for cardinality + per-NounType breakdown stats without the contract growth.

### Register and query

```typescript
// Track a single facet
brain.trackField('status')

await brain.add({ data: 'Ship subtype', type: NounType.Task, metadata: { status: 'todo' } })
await brain.add({ data: 'Write docs',   type: NounType.Task, metadata: { status: 'done' } })

await brain.counts.byField('status')
// → { todo: 1, done: 1 }
```

### Per-NounType breakdown

```typescript
brain.trackField('status', { perType: true })

await brain.counts.byField('status', { type: NounType.Task })
// → { todo: 1, done: 1 }
```

### Vocabulary whitelist (opt-in validation)

```typescript
brain.trackField('priority', { values: ['low', 'medium', 'high'] })

// Throws — 'urgent' isn't in the vocabulary:
await brain.add({
  data: 'Fix bug',
  type: NounType.Task,
  metadata: { priority: 'urgent' }
})
```

`trackField` piggybacks on the existing aggregation engine (see the [Aggregation guide](./aggregation.md) for the underlying mechanism). Backfill-on-define means the first call to `counts.byField()` scans existing entities; subsequent calls are O(groups).

### subtype vs trackField — when to use which

- **`subtype`** when there's one primary sub-classification per entity. Limit yourself to one per NounType. Examples: Person→employee/customer/vendor; Document→invoice/contract/policy.
- **`trackField`** for anything else you want to count or filter on. No limit on how many you register. Examples: status, source, role, paradigm.

## Layer 3 — `migrateField()`

Use this when you need to rename or restructure a field across an entire dataset — for example, moving a `metadata.kind` convention up to the top-level `subtype` standard field.

### One-shot rewrite

```typescript
// Starting state: every entity has metadata.kind
const result = await brain.migrateField({
  from: 'metadata.kind',
  to: 'subtype'
})

console.log(result)
// {
//   scanned: 1500,
//   migrated: 1500,
//   skipped: 0,
//   errors: []
// }
```

After this returns, every entity has `subtype` populated from the old `metadata.kind` value, and `metadata.kind` is cleared.

### Deprecation window — keep both fields readable

When you can't coordinate all readers and the migration in a single deploy, use `readBoth: true` to preserve the source field alongside the new one:

```typescript
// Phase 1: dual-populate (existing readers still work against metadata.kind):
await brain.migrateField({
  from: 'metadata.kind',
  to: 'subtype',
  readBoth: true
})

// ... readers migrate to query subtype at their own pace ...

// Phase 2: clear the source field when ready:
await brain.migrateField({ from: 'metadata.kind', to: 'subtype' })
```

### Supported paths

| Path form | Refers to |
|---|---|
| `'subtype'`, `'type'`, `'confidence'` | Top-level standard fields |
| `'metadata.X'` | A key under `entity.metadata` |
| `'data.X'` | A key under `entity.data` (when `data` is an object) |
| `'X'` (bare, non-standard) | Shorthand for `metadata.X` |

### Idempotent

`migrateField` is safe to re-run. Entities where the source is absent, or where the destination already holds the same value, are skipped. This makes it safe to use in a deploy-once-then-cleanup workflow.

### Progress reporting

```typescript
await brain.migrateField({
  from: 'metadata.kind',
  to: 'subtype',
  batchSize: 500,
  onProgress: ({ scanned, migrated }) => {
    console.log(`${scanned} scanned, ${migrated} migrated`)
  }
})
```

## Putting it together

A realistic adoption sequence for a brain that started without these primitives:

```typescript
import { Brainy, NounType } from '@soulcraft/brainy'

const brain = new Brainy({ storage: { type: 'filesystem', options: { path: './brain-data' } } })
await brain.init()

// 1. Migrate any existing metadata.kind convention to the new top-level subtype
await brain.migrateField({ from: 'metadata.kind', to: 'subtype', readBoth: true })

// 2. Register the other facets you want counted
brain.trackField('status', { perType: true })
brain.trackField('source')

// 3. Use subtype on every new write
await brain.add({
  data: 'Quarterly review',
  type: NounType.Event,
  subtype: 'milestone',
  metadata: { status: 'todo', source: 'planning-session' }
})

// 4. Query the breakdowns
brain.counts.bySubtype(NounType.Event)
// → { milestone: 14, meeting: 203, deadline: 7 }

await brain.counts.byField('status', { type: NounType.Event })
// → { todo: 12, done: 212 }

// 5. Once all readers are on the new field, drop the source:
await brain.migrateField({ from: 'metadata.kind', to: 'subtype' })
```

## Layer V — `subtype` on relationships (verbs)

Relationships are first-class citizens too. Every verb (`VerbType`) gets the same `subtype` primitive: a `ReportsTo` relationship might carry `subtype: 'direct'` vs `'dotted-line'`; a `RelatedTo` edge might carry `'spouse'` / `'sibling'` / `'colleague'`. Same shape as the noun side: flat string, no hierarchy, top-level standard field, indexed on the fast path.

### Write

```typescript
const ceoId = await brain.add({ type: NounType.Person, subtype: 'employee', data: 'Avery' })
const vpId = await brain.add({ type: NounType.Person, subtype: 'employee', data: 'Jordan' })
const matrixId = await brain.add({ type: NounType.Person, subtype: 'contractor', data: 'Sam' })

await brain.relate({
  from: ceoId,
  to: vpId,
  type: VerbType.ReportsTo,
  subtype: 'direct'
})

await brain.relate({
  from: ceoId,
  to: matrixId,
  type: VerbType.ReportsTo,
  subtype: 'dotted-line'
})
```

### Read & filter

```typescript
// Direct reports — fast path filter (column-store hit, not metadata fallback)
const direct = await brain.getRelations({
  from: ceoId,
  type: VerbType.ReportsTo,
  subtype: 'direct'
})

// Set membership
const allReports = await brain.getRelations({
  from: ceoId,
  type: VerbType.ReportsTo,
  subtype: ['direct', 'dotted-line']
})
```

### Update (new — `updateRelation()`)

Verbs previously had no update method — the only way to change a relationship was delete-then-recreate. 7.30 closes that gap:

```typescript
// Promote a dotted-line report to direct without losing the edge id
await brain.updateRelation({ id: relationId, subtype: 'direct' })

// Or change weight/confidence
await brain.updateRelation({ id: relationId, weight: 0.5, confidence: 0.9 })
```

### Traversal filter

`find({ connected, subtype })` filters traversal edges by their subtype. Composes with `via` (verb-type filter):

```typescript
// All direct reports two hops deep (will be supported in Cortex; for now depth-1)
const directChain = await brain.find({
  connected: {
    from: ceoId,
    via: VerbType.ReportsTo,
    subtype: 'direct',
    depth: 1
  }
})
```

Multi-hop subtype filtering (`depth > 1`) lights up on the Cortex native path; the JS path throws today rather than return incorrect partial results.

### Counts

Same shape as the noun-side counts API:

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

These are O(1) lookups backed by the persisted `_system/verb-subtype-statistics.json` rollup — same self-heal machinery as the noun-side rollup.

### Migrate verb fields

`migrateField()` now walks verbs too:

```typescript
// Migrate verb-side metadata.kind → top-level subtype
await brain.migrateField({
  from: 'metadata.kind',
  to: 'subtype',
  entityKind: 'verb'
})

// Or migrate both nouns and verbs in one pass
await brain.migrateField({
  from: 'metadata.kind',
  to: 'subtype',
  entityKind: 'both'
})
```

Default is `entityKind: 'noun'` (backward-compatible with 7.29).

## Enforcement — `requireSubtype()` + brain-wide strict mode

By default (7.30) subtype is optional. Two complementary opt-in mechanisms let you enforce the pairing of type + subtype on every write:

### Per-type registration

Mark a specific `NounType` or `VerbType` as requiring a subtype, optionally with a fixed vocabulary:

```typescript
brain.requireSubtype(NounType.Person, {
  values: ['employee', 'customer', 'vendor'],
  required: true
})

brain.requireSubtype(VerbType.ReportsTo, {
  values: ['direct', 'dotted-line'],
  required: true
})

// Now this throws — Person requires a subtype:
await brain.add({ type: NounType.Person, data: 'no subtype' })

// And this throws — 'matrix' isn't in the registered vocabulary:
await brain.relate({
  from: a,
  to: b,
  type: VerbType.ReportsTo,
  subtype: 'matrix'
})
```

### Brain-wide strict mode

Enforce on every write across the whole brain:

```typescript
const brain = new Brainy({ requireSubtype: true })

// Allow specific types to omit subtype (e.g. catch-all `Thing`)
const brain2 = new Brainy({
  requireSubtype: { except: [NounType.Thing, NounType.Custom] }
})
```

When strict mode is on:

- Every `add()` / `addMany()` / `update()` / `relate()` / `relateMany()` / `updateRelation()` rejects writes missing a subtype on a non-exempt type.
- `addMany()` and `relateMany()` validate every item BEFORE any storage write — atomic-fail semantics, no partial writes.
- Per-type rules registered via `requireSubtype()` compose with the brain-wide flag; specific rules win when both apply.
- Brainy's own internal writes (VFS root, VFS directories, VFS file entities) bypass enforcement via the `metadata.isVFSEntity: true` infrastructure marker.

### Migrating to strict mode on an existing brain

`brain.migrateField()` is your friend — populate `subtype` from an existing convention before flipping strict mode on:

```typescript
// Step 1: backfill subtype from your existing metadata.kind convention
await brain.migrateField({
  from: 'metadata.kind',
  to: 'subtype',
  entityKind: 'both'
})

// Step 2: register the vocabulary
brain.requireSubtype(NounType.Person, {
  values: ['employee', 'customer', 'vendor'],
  required: true
})

// Step 3: future writes must have a subtype matching the vocabulary
await brain.add({ type: NounType.Person, subtype: 'employee', data: '...' })
```

## Strict mode in practice (for SDK-style vocabulary consumers)

When a platform layer like the Soulcraft SDK registers `requireSubtype()` rules on behalf of every consumer's brain, every downstream product that calls `brain.add()` / `brain.relate()` against those types must pass a matching `subtype`. Skipping the field — or passing one outside the registered vocabulary — throws at the boundary.

This pattern is powerful but surfaces a class of latent bug: any `brain.add()` call site that was written before strict-mode adoption starts rejecting writes. A representative production incident: a booking flow started returning 500 on every request because a service method called `brain.add({ type: NounType.Event, ... })` without subtype, and an SDK layer had just registered `requireSubtype()` for `NounType.Event` on every brain instance.

The fix is a four-step migration recipe — and Brainy 7.30.1+ ships diagnostic tools to make it deterministic.

### Migration recipe

1. **Inventory the gap with `brain.audit()`** — returns the deterministic list of which NounTypes and VerbTypes have entities/relationships missing subtype, grouped by type:

   ```typescript
   const report = await brain.audit()
   //   {
   //     entitiesWithoutSubtype: { event: 24, document: 3, ... },
   //     relationshipsWithoutSubtype: { relatedTo: 1402 },
   //     total: 1429,
   //     scanned: 8400,
   //     recommendation: 'Found 1429 entries without subtype. ...'
   //   }
   ```

   By default, VFS infrastructure entities are excluded (they bypass enforcement anyway via the `metadata.isVFSEntity` marker). Pass `{ includeVFS: true }` to surface them too.

2. **Bulk-migrate any existing convention** with `brain.migrateField()` if a legacy field can be lifted:

   ```typescript
   // Common pattern: subtype mirrors a discriminator field already in metadata
   await brain.migrateField({
     from: 'metadata.entityType',
     to: 'subtype',
     readBoth: true  // safety: keep the source field readable during cutover
   })
   ```

3. **Hand-fix the remaining call sites.** The exact list is in `report.entitiesWithoutSubtype`. For each call site, add `subtype: '<value>'` to the `brain.add()` / `brain.relate()` params. Choose a stable convention (e.g. mirror `metadata.entityType` if you have one; any rule that's deterministic from the data works).

4. **Verify with `brain.audit()` again.** Re-run; total should be `0`. If you turn on brain-wide strict mode at this point, all future writes are protected.

### Brainy's own infrastructure subtype labels (reference)

Brainy's internal write paths set subtype on every entity and edge they create. Consumers don't need to do anything for these — they're documented here so you understand the data shape:

| Code path | NounType / VerbType | Subtype label |
|---|---|---|
| VFS root directory `/` | `NounType.Collection` | `'vfs-root'` |
| VFS subdirectories | `NounType.Collection` | `'vfs-directory'` |
| VFS files | (mime-driven, e.g. `Document`/`Code`/`Image`) | `'vfs-file'` |
| VFS symlinks | `NounType.File` | `'vfs-symlink'` |
| VFS Contains edges | `VerbType.Contains` | `'vfs-contains'` |
| Aggregation materialized output | `NounType.Measurement` | `'materialized-aggregate'` |
| Import-document provenance entity | `NounType.Document` | `'import-source'` |
| Importer-extracted entities (no caller default) | extractor-driven | `'imported'` |
| Importer placeholder targets | `NounType.Thing` | `'import-placeholder'` |
| Neural extraction (no caller default) | extractor-driven | `'extracted'` |
| GoogleSheets API entity writes | request-driven | `'imported-from-sheets'` |
| OData API entity writes | request-driven | `'imported-from-odata'` |
| MCP client message storage | `NounType.Message` | `'mcp-message'` |
| `brainy add` CLI (no `--subtype` flag) | user-supplied type | `'cli-add'` |
| `brainy relate` CLI (no `--subtype` flag) | user-supplied verb | `'cli-relate'` |

You can query these directly: `await brain.find({ subtype: 'vfs-file' })` returns every VFS-managed file regardless of NounType. `await brain.counts.bySubtype(NounType.Document)` shows you the import-source / imported / extracted / vfs-file breakdown.

Importer and extraction paths accept a caller-supplied `defaultSubtype` option so you can tag a whole batch with your own provenance label (e.g. `'customer-upload-2026q2'`) instead of the Brainy default `'imported'` / `'extracted'`.

### Looking ahead — Brainy 8.0

Brainy 8.0 ships:

- **`brain.fillSubtypes(rules)`** — the bulk migration helper that pairs with `audit()`. Given caller-supplied rules per NounType / VerbType, it walks the brain and fills in missing subtypes via `update()`. Pre-8.0 brains run this once before upgrading to clear migration debt.
- **`subtype: string` (non-optional)** on `AddParams<T>` and `RelateParams<T>`. TypeScript catches missing subtype at compile time, not just runtime.
- **`new Brainy({ requireSubtype: true })` becomes the default.** Consumers explicitly opt out with `{ requireSubtype: false }` during migration.

7.30.1's `audit()` is the diagnostic; 8.0's `fillSubtypes()` is the bulk fixer. Together they close the migration gap deterministically.

## Reference

### Layer 1 — `subtype` (nouns)

- `brain.add({ ..., subtype: 'value' })` — write the field
- `brain.update({ id, subtype: 'value' })` — change the field
- `brain.find({ type, subtype })` — filter (fast path)
- `brain.find({ subtype: ['a', 'b'] })` — set membership
- `brain.counts.bySubtype(type, subtype?)` — O(1) counts
- `brain.counts.topSubtypes(type, n?)` — top N by count
- `brain.subtypesOf(type)` — distinct subtype list

### Layer V — `subtype` (verbs / relationships)

- `brain.relate({ ..., subtype: 'value' })` — write the field
- `brain.updateRelation({ id, subtype, type?, weight?, ... })` — change a relationship
- `brain.getRelations({ subtype })` — filter (fast path)
- `brain.getRelations({ subtype: ['a', 'b'] })` — set membership
- `brain.find({ connected: { via, subtype, depth } })` — traversal filter
- `brain.counts.byRelationshipSubtype(verb, subtype?)` — O(1) counts
- `brain.counts.topRelationshipSubtypes(verb, n?)` — top N by count
- `brain.relationshipSubtypesOf(verb)` — distinct subtype list

### Layer 2 — generic facets

- `brain.trackField(name, { perType?, values? })` — register a facet
- `brain.counts.byField(name, { type? })` — facet counts

### Layer 3 — migration

- `brain.migrateField({ from, to, readBoth?, batchSize?, onProgress?, entityKind? })` — rewrite a field (nouns, verbs, or both)

### Enforcement

- `brain.requireSubtype(type, { values?, required })` — per-`NounType` / `VerbType` rule
- `new Brainy({ requireSubtype: true })` — brain-wide strict mode
- `new Brainy({ requireSubtype: { except: [type, ...] } })` — strict with exemptions
