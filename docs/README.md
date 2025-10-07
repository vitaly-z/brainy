# Brainy Documentation

Welcome to the comprehensive documentation for Brainy, the multi-dimensional AI database with Triple Intelligence Engine.

## 📊 Implementation Status

- ✅ **Production Ready**: Core features working today
- 🚧 **In Development**: Features coming soon
- 📅 **Roadmap**: See [ROADMAP.md](../ROADMAP.md)

## Quick Links

### Getting Started
- [Quick Start Guide](./guides/getting-started.md) - Get up and running in minutes
- [Enterprise for Everyone](./guides/enterprise-for-everyone.md) - **No limits, no tiers, everything free**
- [Natural Language Queries](./guides/natural-language.md) - Query with plain English

### Core Concepts
- [Zero Configuration](./architecture/zero-config.md) - **Auto-adapts to any environment**
- [Noun-Verb Taxonomy](./architecture/noun-verb-taxonomy.md) - **Revolutionary data model**
- [Triple Intelligence](./architecture/triple-intelligence.md) - Unified query system
- [Architecture Overview](./architecture/overview.md) - System design

### API Documentation
- [API Reference](./api/README.md) - Complete API documentation
- [TypeScript Types](./api/types.md) - Type definitions

### Advanced Topics
- [Augmentations System](./architecture/augmentations.md) - **Enterprise plugins & neural import**
- [Storage Architecture](./architecture/storage.md) - Storage adapter system
- [Performance Tuning](./guides/performance.md) - Optimization guide
- [Migration Guide](../MIGRATION.md) - Upgrading from 1.x

## What is Brainy?

Brainy is a next-generation AI database that combines:
- **Vector Search**: Semantic similarity using HNSW indexing
- **Graph Relationships**: Complex relationship mapping and traversal
- **Field Filtering**: Precise metadata filtering with O(1) lookups
- **Natural Language**: Query in plain English

## Key Features

### 🧠 Triple Intelligence Engine
All three intelligence types (vector, graph, field) work together in every query for optimal results.

### 📝 Noun-Verb Taxonomy
Model your data naturally as entities (nouns) and relationships (verbs) - no complex schemas needed.

### 🌍 Natural Language Queries
Ask questions in plain English and Brainy understands your intent:
```typescript
await brain.find("recent articles about AI with high ratings")
```

### ⚡ Production Ready
- Universal storage (FileSystem, S3, OPFS, Memory)
- Zero configuration with intelligent defaults
- Full TypeScript support
- Cross-platform compatibility

## Quick Example

```typescript
import { Brainy } from 'brainy'

// Initialize
const brain = new Brainy()
await brain.init()

// Add entities (nouns)
const articleId = await brain.add("Revolutionary AI Breakthrough", {
  type: "article",
  category: "technology",
  rating: 4.8
})

const authorId = await brain.add("Dr. Sarah Chen", {
  type: "person",
  role: "researcher"
})

// Create relationships (verbs)
await brain.relate(authorId, articleId, "authored", {
  date: "2024-01-15",
  contribution: "primary"
})

// Query naturally
const results = await brain.find("highly rated technology articles by researchers")
```

## Documentation Structure

```
docs/
├── README.md                    # This file
├── guides/                      # User guides
│   ├── getting-started.md      # Quick start guide
│   ├── natural-language.md     # NLP query guide
│   └── performance.md          # Performance tuning
├── architecture/               # Technical architecture
│   ├── overview.md            # System overview
│   ├── noun-verb-taxonomy.md  # Data model
│   ├── triple-intelligence.md # Query system
│   └── storage.md             # Storage layer
├── vfs/                       # Virtual Filesystem
│   ├── README.md              # VFS overview
│   ├── SEMANTIC_VFS.md        # Semantic projections
│   ├── VFS_API_GUIDE.md       # Complete API reference
│   └── QUICK_START.md         # 5-minute setup
└── api/                       # API documentation
    ├── README.md              # API overview
    ├── brainy-data.md        # Main class
    └── types.md              # TypeScript types
```

## Community

- **GitHub**: [github.com/brainy-org/brainy](https://github.com/brainy-org/brainy)
- **Issues**: [Report bugs or request features](https://github.com/brainy-org/brainy/issues)
- **Discussions**: [Join the conversation](https://github.com/brainy-org/brainy/discussions)

## License

Brainy is MIT licensed. See [LICENSE](../LICENSE) for details.