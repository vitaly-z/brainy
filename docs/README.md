# Brainy Documentation

> The multi-dimensional AI database with Triple Intelligence — vector search, graph traversal, and metadata filtering in one unified API.

## Quick Start

```typescript
import { Brainy, NounType, VerbType } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

// Add entities — data is embedded for semantic search, metadata is indexed for filtering
const id = await brain.add({
  data: 'Revolutionary AI Breakthrough',
  type: NounType.Document,
  metadata: { category: 'technology', rating: 4.8 }
})

// Search with Triple Intelligence
const results = await brain.find({
  query: 'artificial intelligence',              // Semantic search (on data)
  where: { rating: { greaterThan: 4.0 } },       // Metadata filter
  connected: { from: authorId, depth: 2 }         // Graph traversal
})
```

---

## Core Documentation

| Document | Description |
|----------|-------------|
| **[API Reference](./api/README.md)** | Complete API documentation — **start here** |
| **[Data Model](./DATA_MODEL.md)** | Entity structure, data vs metadata, storage fields |
| **[Query Operators](./QUERY_OPERATORS.md)** | All BFO operators with examples and indexed/in-memory matrix |
| [Find System](./FIND_SYSTEM.md) | Natural language `find()` and hybrid search details |

---

## Architecture

| Document | Description |
|----------|-------------|
| [Architecture Overview](./architecture/overview.md) | High-level system design |
| [Triple Intelligence](./architecture/triple-intelligence.md) | Vector + Graph + Metadata unified query |
| [Noun-Verb Taxonomy](./architecture/noun-verb-taxonomy.md) | 42 nouns + 127 verbs type system |
| [Stage 3 Canonical Taxonomy](./STAGE3-CANONICAL-TAXONOMY.md) | Complete type reference |
| [Storage Architecture](./architecture/storage-architecture.md) | Storage adapters and optimization |
| [Index Architecture](./architecture/index-architecture.md) | HNSW, Graph, and Metadata indexing |
| [Zero Configuration](./architecture/zero-config.md) | Auto-adapts to any environment |

---

## Virtual Filesystem (VFS)

| Document | Description |
|----------|-------------|
| [VFS Quick Start](./vfs/QUICK_START.md) | Get started in 30 seconds |
| [VFS Core](./vfs/VFS_CORE.md) | Core concepts and architecture |
| [VFS API Guide](./vfs/VFS_API_GUIDE.md) | Complete VFS API reference |
| [Common Patterns](./vfs/COMMON_PATTERNS.md) | VFS usage patterns |

See [vfs/](./vfs/) for the complete VFS documentation set.

---

## Guides

| Document | Description |
|----------|-------------|
| [Import Anything](./guides/import-anything.md) | CSV, Excel, PDF, URL imports |
| [Natural Language](./guides/natural-language.md) | Query in plain English |
| [Neural API](./guides/neural-api.md) | AI-powered features |
| [Enterprise for Everyone](./guides/enterprise-for-everyone.md) | No limits, no tiers |
| [Framework Integration](./guides/framework-integration.md) | React, Vue, Angular, Svelte |

---

## Storage & Deployment

| Document | Description |
|----------|-------------|
| [Cloud Deployment](./deployment/CLOUD_DEPLOYMENT_GUIDE.md) | Deploy on AWS, GCP, Azure, Cloudflare |
| [Extending Storage](./EXTENDING_STORAGE.md) | Create custom storage adapters |
| [AWS S3 Cost Optimization](./operations/cost-optimization-aws-s3.md) | 96% cost savings |
| [GCS Cost Optimization](./operations/cost-optimization-gcs.md) | 94% savings with Autoclass |
| [Azure Cost Optimization](./operations/cost-optimization-azure.md) | 95% savings |
| [R2 Cost Optimization](./operations/cost-optimization-cloudflare-r2.md) | Zero egress fees |
| [Capacity Planning](./operations/capacity-planning.md) | Scale to millions of entities |

---

## Plugins & Augmentations

| Document | Description |
|----------|-------------|
| [Plugins](./PLUGINS.md) | Plugin system overview |
| [Creating Augmentations](./CREATING-AUGMENTATIONS.md) | Build custom plugins |
| [Augmentations Reference](./augmentations/COMPLETE-REFERENCE.md) | Full augmentation API |
| [Augmentations Developer Guide](./augmentations/DEVELOPER-GUIDE.md) | Plugin development guide |

---

## Performance & Scaling

| Document | Description |
|----------|-------------|
| [Performance](./PERFORMANCE.md) | Optimization techniques |
| [Scaling](./SCALING.md) | Scale to billions of entities |
| [Batching](./BATCHING.md) | Batch operations guide |

---

## Migration & Reference

| Document | Description |
|----------|-------------|
| [v3 to v4 Migration](./MIGRATION-V3-TO-V4.md) | Upgrade guide |
| [Release Guide](./RELEASE-GUIDE.md) | How to release new versions |
| [Production Architecture](./PRODUCTION_SERVICE_ARCHITECTURE.md) | Ops reference |

---

## Internal

| Document | Description |
|----------|-------------|
| [Audit Report](./internal/AUDIT_REPORT.md) | Feature audit |
| [Honest Status](./internal/HONEST_STATUS.md) | Actual implementation status |

---

## License

Brainy is MIT licensed. See [LICENSE](../LICENSE) for details.
