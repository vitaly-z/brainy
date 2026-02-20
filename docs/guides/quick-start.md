---
title: Quick Start
slug: getting-started/quick-start
public: true
category: getting-started
template: guide
order: 2
description: Build your first knowledge graph in 60 seconds. Add entities, create relationships, and query with Triple Intelligence — vector + graph + metadata in one call.
next:
  - concepts/triple-intelligence
  - api/reference
---

# Quick Start

Get Brainy running in under a minute.

## 1. Install

```bash
npm install @soulcraft/brainy
```

## 2. Initialize

```typescript
import { Brainy, NounType, VerbType } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()
```

That's it. Brainy auto-configures storage, loads the embedding model, and builds the indexes.

## 3. Add Knowledge

```typescript
// Text is automatically embedded into 384-dim vectors
const reactId: string = await brain.add({
  data: 'React is a JavaScript library for building user interfaces',
  type: NounType.Concept,
  metadata: { category: 'frontend', year: 2013 }
})

const nextId: string = await brain.add({
  data: 'Next.js framework for React with server-side rendering',
  type: NounType.Concept,
  metadata: { category: 'framework', year: 2016 }
})
```

## 4. Create Relationships

```typescript
// Typed graph relationships
await brain.relate({
  from: nextId,
  to: reactId,
  type: VerbType.BuiltOn
})
```

## 5. Query with Triple Intelligence

```typescript
import type { FindResult } from '@soulcraft/brainy'

// All three search paradigms in one call
const results: FindResult[] = await brain.find({
  query: 'modern frontend frameworks',    // Vector similarity search
  where: { year: { greaterThan: 2015 } }, // Metadata filtering
  connected: { to: reactId, depth: 2 }   // Graph traversal
})

console.log(results[0].data)   // 'Next.js framework for React...'
console.log(results[0].score)  // 0.94
```

## What Just Happened

Every entity you `add()` lives in three indexes simultaneously:

| Index | What it stores | Query with |
|-------|---------------|------------|
| Vector | 384-dim embedding of `data` | `find({ query: '...' })` |
| Metadata | All `metadata` fields | `find({ where: { ... } })` |
| Graph | Typed relationships from `relate()` | `find({ connected: { ... } })` |

`find()` queries all three in parallel and fuses the results.

## Natural Language Queries

Brainy understands 220+ natural language patterns:

```typescript
// These all work without any configuration
await brain.find({ query: 'recent documents about machine learning' })
await brain.find({ query: 'articles created this week' })
await brain.find({ query: 'people who work at Anthropic' })
```

## Next Steps

- [Triple Intelligence](/docs/concepts/triple-intelligence) — understand how the query engine works
- [The Find System](/docs/guides/find-system) — advanced queries, operators, and graph traversal
- [API Reference](/docs/api/reference) — complete method documentation
- [Storage Adapters](/docs/guides/storage-adapters) — S3, GCS, Azure, filesystem, OPFS
