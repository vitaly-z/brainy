# Data Model

> How Brainy stores entities and relationships, and the critical distinction between `data` and `metadata`.

---

## Entity (Noun)

An entity is the fundamental data unit in Brainy. Every entity has:

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `id` | `string` | Primary key | UUID v4 (auto-generated or custom) |
| `data` | `any` | **HNSW vector index** | Content used for semantic/hybrid search. Strings auto-embed. |
| `metadata` | `object` | **MetadataIndex** | Structured queryable fields (tags, dates, flags, etc.) |
| `type` | `NounType` | MetadataIndex (as `noun`) | Entity type classification |
| `vector` | `number[]` | HNSW | 384-dim embedding (auto-computed from `data` or user-provided) |
| `confidence` | `number` | MetadataIndex | Type classification confidence (0-1) |
| `weight` | `number` | MetadataIndex | Entity importance/salience (0-1) |
| `service` | `string` | MetadataIndex | Multi-tenancy identifier |
| `createdAt` | `number` | MetadataIndex | Creation timestamp (ms since epoch) |
| `updatedAt` | `number` | MetadataIndex | Last update timestamp (ms since epoch) |
| `createdBy` | `object` | MetadataIndex | Source augmentation info |

### Example

```typescript
const id = await brain.add({
  data: 'John Smith is a software engineer at Acme Corp',  // → embedded into vector
  type: NounType.Person,
  metadata: {                   // → indexed, queryable via where filters
    role: 'engineer',
    department: 'backend',
    yearsExperience: 8
  },
  confidence: 0.95,
  weight: 0.7
})
```

---

## Relationship (Verb)

A relationship is a typed, directed edge connecting two entities.

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `id` | `string` | Primary key | UUID v4 (auto-generated) |
| `from` | `string` | **GraphAdjacencyIndex** | Source entity ID |
| `to` | `string` | **GraphAdjacencyIndex** | Target entity ID |
| `type` | `VerbType` | GraphAdjacencyIndex (as `verb`) | Relationship type classification |
| `data` | `any` | — | Opaque content (overrides auto-computed vector if provided) |
| `metadata` | `object` | — | Structured fields on the edge |
| `weight` | `number` | — | Connection strength (0-1, default: 1.0) |
| `confidence` | `number` | — | Relationship certainty (0-1) |
| `evidence` | `RelationEvidence` | — | Why this relationship was detected |
| `createdAt` | `number` | — | Creation timestamp (ms since epoch) |
| `updatedAt` | `number` | — | Last update timestamp (ms since epoch) |
| `service` | `string` | — | Multi-tenancy identifier |

### Example

```typescript
const relId = await brain.relate({
  from: personId,
  to: projectId,
  type: VerbType.WorksOn,
  data: 'Lead engineer on the AI module',   // Optional: content for this edge
  metadata: {                                // Optional: queryable edge fields
    role: 'lead',
    startDate: '2024-01-15'
  },
  weight: 0.9
})
```

---

## Data vs Metadata

This is the most important concept in Brainy's storage model:

### `data` — Content for Semantic Search

- Embedded into a 384-dimensional vector via the WASM embedding engine
- Searchable via **semantic similarity** (HNSW vector index) and **hybrid text+semantic** search
- Queried by passing `query` to `find()`:
  ```typescript
  brain.find({ query: 'machine learning algorithms' })
  ```
- **NOT** indexed by MetadataIndex — you cannot use `where` filters on `data`
- Stored opaquely: strings, objects, numbers — anything goes

### `metadata` — Structured Queryable Fields

- Indexed by MetadataIndex with O(1) lookups per field
- Queryable via `where` filters using [BFO operators](./QUERY_OPERATORS.md):
  ```typescript
  brain.find({
    where: {
      department: 'engineering',
      yearsExperience: { greaterThan: 5 },
      tags: { contains: 'senior' }
    }
  })
  ```
- **NOT** used for vector/semantic search
- Must be a flat or lightly nested object

### Quick Reference

| | `data` | `metadata` |
|---|---|---|
| **Purpose** | Content for embedding / semantic search | Structured fields for filtering |
| **Searched by** | `find({ query })` — vector similarity, hybrid text+semantic | `find({ where })` — exact, range, set operators |
| **Indexed by** | HNSW vector index | MetadataIndex |
| **Queryable with operators?** | No | Yes (`equals`, `greaterThan`, `oneOf`, etc.) |
| **Auto-embedded?** | Yes (strings → 384-dim vectors) | No |
| **Typical content** | Text descriptions, document content | Tags, dates, status flags, categories, numeric fields |

### Common Pattern

```typescript
// Add an article
await brain.add({
  data: 'A deep dive into transformer architectures and attention mechanisms',
  type: NounType.Document,
  metadata: {
    title: 'Transformer Deep Dive',
    author: 'Dr. Chen',
    publishedYear: 2024,
    tags: ['AI', 'transformers', 'NLP'],
    status: 'published'
  }
})

// Search by content (semantic — searches data)
const results = await brain.find({ query: 'neural network attention' })

// Filter by fields (exact — queries metadata)
const recent = await brain.find({
  where: {
    publishedYear: { greaterThan: 2023 },
    status: 'published'
  }
})

// Combine both (Triple Intelligence)
const precise = await brain.find({
  query: 'attention mechanisms',             // Semantic search on data
  where: { author: 'Dr. Chen' },            // Metadata filter
  connected: { from: authorId, depth: 1 }   // Graph traversal
})
```

---

## Storage Field Naming

Internally, Brainy uses different field names in storage vs the public API:

| Public API (Entity/Relation) | Storage (metadata object) | Notes |
|------------------------------|--------------------------|-------|
| `type` | `noun` | Entity type stored as `noun` |
| `from` | `sourceId` | Relationship source |
| `to` | `targetId` | Relationship target |
| `type` (on Relation) | `verb` | Relationship type stored as `verb` |

When querying with `find()`, you can use:
- `type` parameter (convenience alias, equivalent to `where.noun`)
- `where.noun` directly

```typescript
// These are equivalent:
brain.find({ type: NounType.Person })
brain.find({ where: { noun: NounType.Person } })
```

---

## Standard Metadata Fields

When you add an entity, Brainy stores these standard fields in the metadata object alongside your custom fields:

| Field | Set By | Description |
|-------|--------|-------------|
| `noun` | System | Entity type (NounType enum value) |
| `data` | System | The raw `data` value (stored opaquely) |
| `createdAt` | System | Creation timestamp |
| `updatedAt` | System | Last update timestamp |
| `confidence` | User | Type classification confidence |
| `weight` | User | Entity importance |
| `service` | User | Multi-tenancy identifier |
| `createdBy` | User/System | Source augmentation |

On read, these standard fields are extracted to top-level Entity properties. The `metadata` field on the returned Entity contains **only your custom fields**.

---

## See Also

- [API Reference](./api/README.md) — Complete API documentation
- [Query Operators](./QUERY_OPERATORS.md) — All BFO operators with examples
- [Find System](./FIND_SYSTEM.md) — Natural language find() details
