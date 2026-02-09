# Brainy

<p align="center">
  <img src="https://raw.githubusercontent.com/soulcraftlabs/brainy/main/brainy.png" alt="Brainy Logo" width="200">
</p>

[![npm version](https://badge.fury.io/js/%40soulcraft%2Fbrainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![npm downloads](https://img.shields.io/npm/dm/@soulcraft/brainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![Documentation](https://img.shields.io/badge/docs-soulcraft.com-blue.svg)](https://soulcraft.com/docs)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

**Three database paradigms. One API. Zero configuration.**

Built because we were tired of stitching together Pinecone + Neo4j + MongoDB and spending weeks on configuration before writing a single line of business logic. Brainy unifies vector search, graph traversal, and metadata filtering so you don't have to choose.

---

## Install

```bash
npm install @soulcraft/brainy
```

## Quick Start

```javascript
import { Brainy, NounType, VerbType } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

// Add knowledge — text auto-embeds, metadata auto-indexes
const reactId = await brain.add({
  data: 'React is a JavaScript library for building user interfaces',
  type: NounType.Concept,
  metadata: { category: 'frontend', year: 2013 }
})

const nextId = await brain.add({
  data: 'Next.js framework for React with server-side rendering',
  type: NounType.Concept,
  metadata: { category: 'framework', year: 2016 }
})

// Create a relationship
await brain.relate({ from: nextId, to: reactId, type: VerbType.BuiltOn })

// Query all three paradigms at once
const results = await brain.find({
  query: 'modern frontend frameworks',            // Vector similarity
  where: { year: { greaterThan: 2015 } },         // Metadata filtering
  connected: { to: reactId, depth: 2 }            // Graph traversal
})
```

**[Full API Reference](docs/api/README.md)** | **[soulcraft.com/docs](https://soulcraft.com/docs)**

---

## Three Indexes, One Query

Every piece of knowledge lives in three indexes simultaneously:

- **`data`** → **Vector index** — Content for semantic search. Strings auto-embed into 384-dim vectors. Queried with `find({ query: '...' })`.
- **`metadata`** → **Metadata index** — Structured fields for filtering. O(1) lookups. Queried with `find({ where: { ... } })`.
- **`relate()`** → **Graph index** — Typed, directed relationships between entities. Traversed with `find({ connected: { ... } })`.

```javascript
// Data → vector index (semantic search)
const articleId = await brain.add({
  data: 'A deep dive into transformer architectures',
  type: NounType.Document,
  metadata: { author: 'Dr. Chen', year: 2024, tags: ['AI'] }  // → metadata index
})

// Relationships → graph index
await brain.relate({ from: authorId, to: articleId, type: VerbType.Authored })

// Query all three at once
brain.find({
  query: 'attention mechanisms',                  // Vector similarity
  where: { year: { greaterThan: 2023 } },         // Metadata filter
  connected: { from: authorId, depth: 1 }         // Graph traversal
})
```

**[Data Model Reference](docs/DATA_MODEL.md)** | **[Query Operators](docs/QUERY_OPERATORS.md)**

---

## Features

### Triple Intelligence

Vector search + graph traversal + metadata filtering in every query. No stitching services together — one `find()` call combines all three.

```javascript
const results = await brain.find({
  query: 'machine learning',
  where: { department: 'engineering', level: 'senior' },
  connected: { from: teamLeadId, via: VerbType.WorksWith, depth: 2 }
})
```

### Hybrid Search

Automatically combines keyword (text) and semantic (vector) search. No configuration needed.

```javascript
await brain.find({ query: 'David Smith' })             // Auto: text + semantic
await brain.find({ query: 'AI concepts', searchMode: 'semantic' })  // Semantic only
await brain.find({ query: 'exact id', searchMode: 'text' })         // Text only
```

### Query Operators

Filter metadata with equality, comparison, array, existence, pattern, and logical operators:

```javascript
await brain.find({
  where: {
    status: 'active',                          // Exact match
    score: { greaterThan: 90 },                // Comparison
    tags: { contains: 'ai' },                  // Array
    anyOf: [{ role: 'admin' }, { role: 'owner' }]  // Logical OR
  }
})
```

**[Query Operators Reference](docs/QUERY_OPERATORS.md)** — all operators with indexed/in-memory matrix

### Graph Relationships

Typed, directed edges between entities. Traverse connections at any depth.

```javascript
await brain.relate({ from: personId, to: projectId, type: VerbType.WorksOn })

const results = await brain.find({
  connected: { from: personId, via: VerbType.WorksOn, depth: 3 }
})
```

### Git-Style Branching

Fork your entire database in <100ms. Snowflake-style copy-on-write.

```javascript
const experiment = await brain.fork('test-migration')
await experiment.add({ data: 'test data', type: NounType.Concept })
await experiment.commit({ message: 'Add test data', author: 'dev@co.com' })
await brain.checkout('test-migration')

// Time-travel: query at any past commit
const snapshot = await brain.asOf(commitId)
const pastResults = await snapshot.find({ query: 'historical data' })
await snapshot.close()
```

**[Branching Documentation](docs/features/instant-fork.md)**

### Entity Versioning

Save, restore, and compare entity snapshots.

```javascript
const userId = await brain.add({ data: 'Alice', type: NounType.Person })
await brain.versions.save(userId, { tag: 'v1.0' })

await brain.update(userId, { data: 'Alice Smith' })
await brain.versions.save(userId, { tag: 'v2.0' })

const diff = await brain.versions.compare(userId, 1, 2)
await brain.versions.restore(userId, 1)
```

### Virtual Filesystem

File operations with semantic search built in.

```javascript
const vfs = brain.vfs

await vfs.writeFile('/docs/readme.md', 'Project documentation')
const content = await vfs.readFile('/docs/readme.md')
const tree = await vfs.getTreeStructure('/docs', { maxDepth: 3 })

// Semantic file search
const matches = await vfs.search('React components with hooks')
```

**[VFS Quick Start](docs/vfs/QUICK_START.md)** | **[Common Patterns](docs/vfs/COMMON_PATTERNS.md)**

### Import Anything

CSV, Excel, PDF, URLs — auto-detected format, auto-classified entities.

```javascript
await brain.import('customers.csv')
await brain.import('sales-data.xlsx', { excelSheets: ['Q1', 'Q2'] })
await brain.import('research-paper.pdf', { pdfExtractTables: true })
await brain.import('https://api.example.com/data.json')
```

**[Import Guide](docs/guides/import-anything.md)**

### Entity Extraction

AI-powered named entity recognition with 4-signal ensemble scoring.

```javascript
const entities = await brain.extractEntities('John Smith founded Acme Corp in New York')
// [
//   { text: 'John Smith', type: NounType.Person, confidence: 0.95 },
//   { text: 'Acme Corp', type: NounType.Organization, confidence: 0.92 },
//   { text: 'New York', type: NounType.Location, confidence: 0.88 }
// ]
```

**[Neural Extraction Guide](docs/neural-extraction.md)**

### Plugin System

Optional native acceleration via `@soulcraft/cortex` — SIMD distance calculations, CRoaring bitmaps, Candle ML embeddings.

```javascript
const brain = new Brainy({ plugins: ['@soulcraft/cortex'] })
await brain.init()
```

Plugins are opt-in. Brainy never auto-imports packages unless listed in `plugins`.

**[Plugin Documentation](docs/PLUGINS.md)**

---

## Type System

42 noun types and 127 verb types form a universal knowledge protocol:

```
42 Nouns × 127 Verbs = 5,334 base relationship combinations
```

Model any domain — healthcare (`Patient → diagnoses → Condition`), finance (`Account → transfers → Transaction`), education (`Student → completes → Course`), or your own.

**[Noun-Verb Taxonomy](docs/architecture/noun-verb-taxonomy.md)** | **[Stage 3 Canonical Reference](docs/STAGE3-CANONICAL-TAXONOMY.md)**

---

## Storage: Memory to Cloud

The same API at every scale. Change one config line to go from prototype to production.

### Development — Zero Config

```javascript
const brain = new Brainy()
```

### Production — Filesystem with Compression

```javascript
const brain = new Brainy({
  storage: { type: 'filesystem', path: './data', compression: true }
})
```

### Cloud — S3, GCS, Azure, Cloudflare R2

```javascript
const brain = new Brainy({
  storage: {
    type: 's3',
    s3Storage: { bucketName: 'my-knowledge-base', region: 'us-east-1' }
  }
})
```

Performance benchmarks and capacity planning in **[docs/PERFORMANCE.md](docs/PERFORMANCE.md)**.

**[Cloud Deployment Guide](docs/deployment/CLOUD_DEPLOYMENT_GUIDE.md)** | **[Capacity Planning](docs/operations/capacity-planning.md)**

---

## Use Cases

- **AI agents** — Persistent memory with semantic recall and relationship tracking
- **Knowledge bases** — Auto-linking, semantic search, relationship-aware navigation
- **Semantic search** — Find by meaning across codebases, documents, or media
- **Enterprise knowledge** — CRM, product catalogs, institutional memory
- **Interactive experiences** — Game worlds, NPCs, and characters that remember
- **Content platforms** — Similarity-based discovery, intelligent tagging

---

## Documentation

### Core

- **[API Reference](docs/api/README.md)** — Every method with parameters, returns, and examples
- **[Data Model](docs/DATA_MODEL.md)** — Entity structure, data vs metadata
- **[Query Operators](docs/QUERY_OPERATORS.md)** — All BFO operators with examples
- **[Find System](docs/FIND_SYSTEM.md)** — Natural language find() and hybrid search

### Architecture

- **[Architecture Overview](docs/architecture/overview.md)** — System design and components
- **[Triple Intelligence](docs/architecture/triple-intelligence.md)** — Vector + graph + metadata unified query
- **[Noun-Verb Taxonomy](docs/architecture/noun-verb-taxonomy.md)** — Universal type system
- **[Data Storage Architecture](docs/architecture/data-storage-architecture.md)** — Type-aware indexing and HNSW

### Virtual Filesystem

- **[VFS Quick Start](docs/vfs/QUICK_START.md)** — Build file explorers that never crash
- **[VFS Core](docs/vfs/VFS_CORE.md)** — Full VFS API reference
- **[Semantic VFS](docs/vfs/SEMANTIC_VFS.md)** — AI-powered file navigation

### Guides

- **[Import Anything](docs/guides/import-anything.md)** — CSV, Excel, PDF, URLs
- **[Framework Integration](docs/guides/framework-integration.md)** — React, Vue, Angular, Svelte
- **[Natural Language Queries](docs/guides/natural-language.md)** — Master the find() method

### Operations

- **[Cloud Deployment](docs/deployment/CLOUD_DEPLOYMENT_GUIDE.md)** — AWS, GCS, Azure
- **[Capacity Planning](docs/operations/capacity-planning.md)** — Memory, storage, and scaling
- **[Performance](docs/PERFORMANCE.md)** — Benchmarks and architecture details
- Cost Optimization: **[AWS S3](docs/operations/cost-optimization-aws-s3.md)** | **[GCS](docs/operations/cost-optimization-gcs.md)** | **[Azure](docs/operations/cost-optimization-azure.md)** | **[R2](docs/operations/cost-optimization-cloudflare-r2.md)**

---

## Requirements

**Bun 1.0+** (recommended) or **Node.js 22 LTS**

```bash
bun install @soulcraft/brainy    # Bun — best performance
npm install @soulcraft/brainy    # Node.js — fully supported
```

> **Deprecation Notice:** Browser support (OPFS, Web Workers, WASM embeddings) is deprecated in v7.10.0 and will be removed in v8.0.0. Brainy v8+ will be server-only.

## Contributing

We welcome contributions! See **[CONTRIBUTING.md](CONTRIBUTING.md)** for guidelines.

## License

MIT © Brainy Contributors
