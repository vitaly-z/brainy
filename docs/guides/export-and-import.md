---
title: Export & Import (portable graph)
slug: guides/export-and-import
public: true
category: guides
template: guide
order: 9
description: Export part or all of a brain to a portable, versioned BackupData document and import it back — by id, collection, connected neighbourhood, VFS subtree, predicate, or the whole brain. Covers vectors, edge policy, conflict handling, and id remapping.
next:
  - guides/subtypes-and-facets
  - api/README
---

# Export & Import (portable graph)

`brain.data()` exposes a **portable graph export/import** API. One method serializes a
graph — an item, a collection, a connected neighbourhood, a VFS subtree, a predicate
match, or the whole brain — into a single versioned JSON document (`BackupData`); the
inverse restores it.

```typescript
const data = await brain.data()

const backup = await data.export()          // whole brain → BackupData
await data.import(backup)                    // restore (merge by id, re-embed if no vectors)
```

It is **portable** (human-readable JSON), **versioned** (`formatVersion`, so a 7.x export
imports cleanly into 8.0), and **current-state** (the entities and edges as they are now —
no generation history). Use it for portable artifacts, partial backups, cross-environment
moves, and version upgrades.

## When to use which

| You want… | Use |
|-----------|-----|
| A portable, partial-or-whole, cross-version graph document | **`brain.data().export()` / `import()`** (this guide) |
| To ingest a CSV / PDF / Excel / JSON **file** as new entities | `brain.import(file)` — see [Import Anything](./import-anything.md) |

The two are different operations that happen to share a verb: `import(file)` parses a
foreign document into new entities; `data().import(backup)` restores a graph this API
exported.

## Exporting

```typescript
export(selector?, options?): Promise<BackupData>
```

### Selectors — *what* to export

Omit the selector to export the whole brain. Otherwise pick a node set:

| Scenario | Selector |
|----------|----------|
| Just an item (or items) | `{ ids: ['a', 'b'] }` |
| A collection + its children | `{ collection: collectionId }` (alias `memberOf`) |
| A connected neighbourhood | `{ connected: { from: id, depth: 2, verbs?, direction? } }` |
| A VFS directory / file (+ subtree) | `{ vfsPath: '/docs', recursive?: true }` |
| Everything matching a predicate | `{ type, subtype, where, service }` |
| The whole brain | *(omit)* |

The selector reuses `find()`'s grammar — *"export what `find()` would match, minus ranking
and limit."* Structural and predicate selectors **compose** — a structural selector picks
the nodes, and predicate keys then filter them:

```typescript
// Members of a collection whose status is "open"
await data.export({ collection: collectionId, where: { status: 'open' } })
```

If you already have results from `find()`, export exactly those with the `ids` selector:

```typescript
const hits = await brain.find({ type: NounType.Document })
await data.export({ ids: hits.map(r => r.id) })
```

### Options — *how* to serialize

| Option | Default | Effect |
|--------|---------|--------|
| `includeVectors` | `false` | Carry embedding vectors verbatim. Off ⇒ `import()` re-embeds from `data`. |
| `includeContent` | `false` | Include VFS file bytes in `blobs` so files round-trip byte-identically. |
| `includeSystem` | `false` | Include `system` entities such as the VFS root. |
| `edges` | `'induced'` | `'induced'` (both endpoints in the set), `'incident'` (also dangling edges, recorded in `danglingIds`), or `'none'` (nodes only). |

```typescript
// A self-contained subgraph with vectors, ready to restore elsewhere
const subset = await data.export({ ids }, { includeVectors: true })

// A VFS subtree including file bytes
const tree = await data.export({ vfsPath: '/docs' }, { includeContent: true })
```

## Importing

```typescript
import(backup, options?): Promise<ImportResult>
```

```typescript
const result = await brain.data().then(d => d.import(backup, { onConflict: 'merge' }))
// → { imported, merged, skipped, reembedded, blobsWritten, errors }
```

| Option | Default | Effect |
|--------|---------|--------|
| `onConflict` | `'merge'` | `'merge'` (update existing id in place — assemble many backups), `'replace'` (delete + recreate), or `'skip'`. |
| `reembed` | `'auto'` | `'auto'` (use the carried vector, else re-embed from `data`) or `'never'` (require a carried vector; record an error if absent). |
| `remapIds` | — | Rewrite every id on the way in, e.g. to clone a template subgraph under fresh ids. |

The default `onConflict: 'merge'` is what lets you assemble one working graph from many
exported documents that share entity ids — re-importing an id merges rather than duplicates.

```typescript
// Clone a subgraph under fresh ids (a copy, not a move)
const remap = new Map(backup.entities.map(e => [e.id, crypto.randomUUID()]))
await data.import(backup, { remapIds: id => remap.get(id) ?? id })
```

## The `BackupData` format

```jsonc
{
  "format": "brainy-backup",
  "formatVersion": 1,                 // import gates on this (cross-version migration)
  "brainyVersion": "7.32.0",
  "createdAt": "2026-06-16T…Z",
  "embedding": { "model": "all-MiniLM-L6-v2", "dimensions": 384 },
  "selector": { … },                  // echoes what was exported (provenance)
  "entities": [
    {
      "id": "…", "type": "Document", "subtype": "invoice",
      "data": "…",                    // the embedding source
      "confidence": 1, "weight": 1, "service": "…",
      "vector": [ … ],                // only with includeVectors
      "metadata": { … }               // custom fields only (reserved fields are top-level)
    }
  ],
  "relations": [
    { "id":"…", "from":"…", "to":"…", "type":"Contains", "subtype":"…",
      "weight":1, "confidence":1, "metadata": { … } }
  ],
  "blobs": { "<sha256>": "<base64>" }, // only with includeContent
  "danglingIds": [ "…" ],             // only with edges:'incident'
  "stats": { "entityCount": 0, "relationCount": 0, "blobCount": 0, "vectorDimensions": 384 }
}
```

Standard fields (`subtype`, `data`, `confidence`, `weight`, `service`) sit at the top level
of each entity; `metadata` holds **only** custom user fields — mirroring the in-memory
`Entity` shape, so `import()` maps each field to its dedicated parameter.

## Cross-version (7.x → 8.0)

Because the document is shared and versioned, a backup written by 7.x imports into 8.0:
`formatVersion` is read forward, `subtype` is carried so 8.0 re-types correctly, and the
same 384-dimension model on both lines means `includeVectors:false` re-embeds identically
(or `true` carries vectors verbatim). The format is **current-state** — if you need a
whole-brain snapshot *with* generation history, that is a separate native facility
(`db.persist()` / `Brainy.load()` on 8.0).

## VFS

VFS directories are `Collection` entities and files are entities linked by `Contains`, so
the whole filesystem (or any subtree) exports through the `vfsPath` selector:

```typescript
await data.export({ vfsPath: '/' },        { includeContent: true }) // all VFS + bytes
await data.export({ vfsPath: '/docs' },    { includeContent: true }) // one directory
await data.export({ vfsPath: '/a/b.txt' }, { includeContent: true }) // one file
```
