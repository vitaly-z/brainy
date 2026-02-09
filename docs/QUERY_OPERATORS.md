# Query Operators (BFO)

> Brainy Field Operators — the complete reference for `where` filters in `find()`.

All operators work with `find({ where: { ... } })` and filter on **metadata fields** (not `data`).

---

## Equality

| Operator | Alias | Description | Example |
|----------|-------|-------------|---------|
| `equals` | `eq`, `is` | Exact match | `{ status: { equals: 'active' } }` |
| `notEquals` | `ne`, `isNot` | Not equal | `{ status: { notEquals: 'deleted' } }` |

**Shorthand:** A bare value is treated as `equals`:

```typescript
// These are equivalent:
brain.find({ where: { status: 'active' } })
brain.find({ where: { status: { equals: 'active' } } })
```

---

## Comparison

| Operator | Alias | Description | Example |
|----------|-------|-------------|---------|
| `greaterThan` | `gt` | Greater than | `{ age: { greaterThan: 18 } }` |
| `greaterEqual` | `gte` | Greater or equal | `{ score: { greaterEqual: 90 } }` |
| `lessThan` | `lt` | Less than | `{ price: { lessThan: 100 } }` |
| `lessEqual` | `lte` | Less or equal | `{ rating: { lessEqual: 3 } }` |
| `between` | — | Inclusive range `[min, max]` | `{ year: { between: [2020, 2025] } }` |

```typescript
// Range query
const recent = await brain.find({
  where: {
    createdAt: { between: [Date.now() - 86400000, Date.now()] }
  }
})
```

---

## Array / Set

| Operator | Alias | Description | Example |
|----------|-------|-------------|---------|
| `oneOf` | `in` | Value is one of the given options | `{ color: { oneOf: ['red', 'blue'] } }` |
| `noneOf` | — | Value is NOT one of the given options | `{ status: { noneOf: ['deleted', 'archived'] } }` |
| `contains` | — | Array field contains value | `{ tags: { contains: 'ai' } }` |
| `excludes` | — | Array field does NOT contain value | `{ tags: { excludes: 'spam' } }` |
| `hasAll` | — | Array field contains ALL listed values | `{ skills: { hasAll: ['js', 'ts'] } }` |

```typescript
// Find entities tagged with 'ai'
const aiEntities = await brain.find({
  where: { tags: { contains: 'ai' } }
})

// Find entities of specific types
const people = await brain.find({
  where: { noun: { oneOf: ['Person', 'Agent'] } }
})
```

---

## Existence

| Operator | Description | Example |
|----------|-------------|---------|
| `exists: true` | Field exists (has any value) | `{ email: { exists: true } }` |
| `exists: false` | Field does NOT exist | `{ email: { exists: false } }` |
| `missing: true` | Field does NOT exist (alias for `exists: false`) | `{ email: { missing: true } }` |
| `missing: false` | Field exists (alias for `exists: true`) | `{ email: { missing: false } }` |

```typescript
// Find entities that have an email field
const withEmail = await brain.find({
  where: { email: { exists: true } }
})
```

---

## Pattern (In-Memory Only)

These operators work via the in-memory filter path. They are applied **after** the indexed query, so use them with other indexed operators for best performance.

| Operator | Description | Example |
|----------|-------------|---------|
| `matches` | Regex or string pattern match | `{ name: { matches: /^Dr\./ } }` |
| `startsWith` | String prefix | `{ name: { startsWith: 'John' } }` |
| `endsWith` | String suffix | `{ email: { endsWith: '@gmail.com' } }` |

```typescript
const doctors = await brain.find({
  where: {
    type: NounType.Person,           // Indexed — fast
    name: { startsWith: 'Dr.' }     // In-memory — applied after
  }
})
```

---

## Logical

Combine multiple conditions:

| Operator | Description | Example |
|----------|-------------|---------|
| `allOf` | ALL sub-filters must match (AND) | `{ allOf: [{ status: 'active' }, { role: 'admin' }] }` |
| `anyOf` | ANY sub-filter must match (OR) | `{ anyOf: [{ role: 'admin' }, { role: 'owner' }] }` |
| `not` | Invert a filter | `{ not: { status: 'deleted' } }` |

```typescript
// Complex OR query
const adminsOrOwners = await brain.find({
  where: {
    anyOf: [
      { role: 'admin' },
      { role: 'owner' }
    ]
  }
})

// NOT query
const notDeleted = await brain.find({
  where: {
    not: { status: 'deleted' }
  }
})

// Combined AND + OR
const results = await brain.find({
  where: {
    allOf: [
      { department: 'engineering' },
      { anyOf: [
        { level: 'senior' },
        { yearsExperience: { greaterThan: 5 } }
      ]}
    ]
  }
})
```

---

## Indexed vs In-Memory Operators

Brainy's MetadataIndex supports a subset of operators natively for O(1) field lookups. Other operators fall back to in-memory filtering.

| Operator | MetadataIndex (Indexed) | In-Memory Fallback |
|----------|:-----------------------:|:------------------:|
| `equals` / `eq` | Yes | Yes |
| `notEquals` / `ne` | — | Yes |
| `greaterThan` / `gt` | Yes | Yes |
| `greaterEqual` / `gte` | Yes | Yes |
| `lessThan` / `lt` | Yes | Yes |
| `lessEqual` / `lte` | Yes | Yes |
| `between` | Yes | Yes |
| `oneOf` / `in` | Yes | Yes |
| `noneOf` | — | Yes |
| `contains` | Yes | Yes |
| `exists` / `missing` | Yes | Yes |
| `matches` | — | Yes |
| `startsWith` | — | Yes |
| `endsWith` | — | Yes |
| `allOf` | Partial | Yes |
| `anyOf` | Partial | Yes |
| `not` | — | Yes |

**Performance tip:** Combine indexed operators (equals, greaterThan, oneOf, between, contains, exists) with pattern operators for optimal speed — the index narrows results first, then patterns filter in memory.

---

## Practical Examples

### Filter by entity type

```typescript
// Using the type shorthand (recommended)
brain.find({ type: NounType.Person })

// Using where.noun directly
brain.find({ where: { noun: NounType.Person } })

// Multiple types
brain.find({ type: [NounType.Person, NounType.Agent] })
```

### Combine semantic search with filters

```typescript
const results = await brain.find({
  query: 'machine learning engineer',     // Semantic search (on data)
  type: NounType.Person,                  // Type filter (indexed)
  where: {
    department: 'engineering',            // Exact match (indexed)
    yearsExperience: { greaterThan: 3 }   // Range filter (indexed)
  },
  limit: 10
})
```

### Temporal queries

```typescript
const lastWeek = Date.now() - 7 * 24 * 60 * 60 * 1000
const recentEntities = await brain.find({
  where: {
    createdAt: { greaterThan: lastWeek }
  },
  orderBy: 'createdAt',
  order: 'desc',
  limit: 50
})
```

### Graph + metadata combination

```typescript
const results = await brain.find({
  connected: {
    from: teamLeadId,
    via: VerbType.WorksWith,
    depth: 2
  },
  where: {
    role: { oneOf: ['engineer', 'designer'] },
    active: true
  }
})
```

---

## See Also

- [Data Model](./DATA_MODEL.md) — Entity structure, data vs metadata
- [API Reference](./api/README.md) — Complete API documentation
- [Find System](./FIND_SYSTEM.md) — Natural language find() details
