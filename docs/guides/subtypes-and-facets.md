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

## Reference

- `brain.add({ ..., subtype: 'value' })` — write the field
- `brain.update({ id, subtype: 'value' })` — change the field
- `brain.find({ type, subtype })` — filter (fast path)
- `brain.find({ subtype: ['a', 'b'] })` — set membership
- `brain.counts.bySubtype(type, subtype?)` — O(1) counts
- `brain.counts.topSubtypes(type, n?)` — top N by count
- `brain.subtypesOf(type)` — distinct subtype list
- `brain.trackField(name, { perType?, values? })` — register a facet
- `brain.counts.byField(name, { type? })` — facet counts
- `brain.migrateField({ from, to, readBoth?, batchSize?, onProgress? })` — rewrite a field
