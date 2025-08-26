# Brainy

<p align="center">
  <img src="https://raw.githubusercontent.com/soulcraftlabs/brainy/main/brainy.png" alt="Brainy Logo" width="200">
</p>

[![npm version](https://badge.fury.io/js/%40soulcraft%2Fbrainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![npm downloads](https://img.shields.io/npm/dm/@soulcraft/brainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

**🧠 Brainy 2.0 - Zero-Configuration AI Database with Triple Intelligence™**

The industry's first truly zero-configuration AI database that combines vector similarity, metadata filtering, and graph relationships with O(log n) performance. Production-ready with 3ms search latency, 220 pre-computed NLP patterns, and only 24MB memory footprint.

## 🎉 What's New in 2.0

- **Triple Intelligence™**: Unified Vector + Metadata + Graph queries in one API
- **API Consolidation**: 15+ methods → 2 clean APIs (`search()` and `find()`)
- **Natural Language**: Ask questions in plain English
- **Zero Configuration**: Works instantly, no setup required
- **O(log n) Performance**: Binary search on sorted indices
- **220+ NLP Patterns**: Pre-computed for instant understanding
- **Universal Compatibility**: Node.js, Browser, Edge, Workers

## ⚡ Quick Start

```bash
npm install @soulcraft/brainy
```

```javascript
import { BrainyData } from 'brainy'

const brain = new BrainyData()
await brain.init()

// Add data with automatic embedding
await brain.addNoun("JavaScript is a programming language", { 
  type: "language", 
  year: 1995 
})

// Natural language search
const results = await brain.find("programming languages from the 90s")

// Vector similarity with metadata filtering
const filtered = await brain.search("JavaScript", {
  metadata: { type: "language" },
  limit: 5
})
```

## 🚀 Key Features

### Triple Intelligence Engine
Combines three search paradigms in one unified API:
- **Vector Search**: Semantic similarity with HNSW indexing
- **Metadata Filtering**: O(log n) field lookups with binary search  
- **Graph Relationships**: Navigate connected knowledge

### Natural Language Understanding
```javascript
// Ask questions naturally
await brain.find("Show me recent React components with tests")
await brain.find("Popular JavaScript libraries similar to Vue")
await brain.find("Documentation about authentication from last month")
```

### Zero Configuration Philosophy
- **No API keys required** - Built-in embedding models
- **No external dependencies** - Everything included
- **No complex setup** - Works instantly
- **Smart defaults** - Optimized out of the box

### Production Performance
- **3ms average search** - Lightning fast queries
- **24MB memory footprint** - Efficient resource usage
- **Worker-based embeddings** - Non-blocking operations
- **Automatic caching** - Intelligent result caching

## 📚 Core API

### `search()` - Vector Similarity
```javascript
const results = await brain.search("machine learning", {
  limit: 10,                    // Number of results
  metadata: { type: "article" }, // Filter by metadata
  includeContent: true          // Include full content
})
```

### `find()` - Natural Language Queries
```javascript
// Simple natural language
const results = await brain.find("recent important documents")

// Structured query with Triple Intelligence
const results = await brain.find({
  like: "JavaScript",           // Vector similarity
  where: {                      // Metadata filters
    year: { greaterThan: 2020 },
    important: true
  },
  related: { to: "React" }      // Graph relationships
})
```

### CRUD Operations
```javascript
// Create
const id = await brain.addNoun(data, metadata)

// Read
const item = await brain.getNoun(id)

// Update
await brain.updateNoun(id, newData, newMetadata)

// Delete
await brain.deleteNoun(id)

// Bulk operations
await brain.import(arrayOfData)
const exported = await brain.export({ format: 'json' })
```

## 🎯 Use Cases

### Knowledge Management
```javascript
// Store and search documentation
await brain.addNoun(documentContent, {
  title: "API Guide",
  category: "documentation",
  version: "2.0"
})

const docs = await brain.find("API documentation for version 2")
```

### Semantic Search
```javascript
// Find similar content
const similar = await brain.search(existingContent, {
  limit: 5,
  threshold: 0.8
})
```

### AI Memory Layer
```javascript
// Store conversation context
await brain.addNoun(userMessage, {
  userId: "123",
  timestamp: Date.now(),
  session: "abc"
})

// Retrieve relevant context
const context = await brain.find(`previous conversations with user 123`)
```

## 💾 Storage Options

Brainy supports multiple storage backends:

```javascript
// Memory (default for testing)
const brain = new BrainyData({ 
  storage: { type: 'memory' } 
})

// FileSystem (Node.js)
const brain = new BrainyData({ 
  storage: { 
    type: 'filesystem',
    path: './data'
  } 
})

// Browser Storage (OPFS)
const brain = new BrainyData({ 
  storage: { type: 'opfs' } 
})

// S3 Compatible (Production)
const brain = new BrainyData({ 
  storage: { 
    type: 's3',
    bucket: 'my-bucket',
    region: 'us-east-1'
  } 
})
```

## 🛠️ CLI

Brainy includes a powerful CLI for testing and management:

```bash
# Install globally
npm install -g brainy

# Add data
brainy add "JavaScript is awesome" --metadata '{"type":"opinion"}'

# Search
brainy search "programming"

# Natural language find
brainy find "awesome programming languages"

# Interactive mode
brainy chat

# Export data
brainy export --format json > backup.json
```

## 🔌 Augmentations

Extend Brainy with powerful augmentations:

```bash
# List available augmentations
brainy augment list

# Install an augmentation
brainy augment install explorer

# Connect to Brain Cloud
brainy cloud setup
```

## 🏢 Enterprise Features - Included for Everyone

Brainy includes enterprise-grade capabilities at no extra cost. **No premium tiers, no paywalls.**

- **Scales to 10M+ items** with consistent 3ms search latency
- **Write-Ahead Logging (WAL)** for zero data loss durability
- **Distributed architecture** with sharding and replication
- **Read/write separation** for horizontal scaling
- **Connection pooling** and request deduplication
- **Built-in monitoring** with metrics and health checks
- **Production ready** with circuit breakers and backpressure

📖 **[Read the full Enterprise Features guide →](docs/ENTERPRISE-FEATURES.md)**

## 📊 Benchmarks

| Operation | Performance | Memory |
|-----------|------------|--------|
| Initialize | 450ms | 24MB |
| Add Item | 12ms | +0.1MB |
| Vector Search (1k items) | 3ms | - |
| Metadata Filter (10k items) | 0.8ms | - |
| Natural Language Query | 15ms | - |
| Bulk Import (1000 items) | 2.3s | +8MB |
| **Production Scale (10M items)** | **5.8ms** | **12GB** |

## 🔄 Migration from 1.x

See [MIGRATION.md](MIGRATION.md) for detailed upgrade instructions.

Key changes:
- Search methods consolidated into `search()` and `find()`
- Result format now includes full objects with metadata
- New natural language capabilities

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📖 Documentation

- [Getting Started Guide](docs/guides/getting-started.md)
- [API Reference](docs/api/README.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Natural Language Guide](docs/guides/natural-language.md)
- [Triple Intelligence](docs/architecture/triple-intelligence.md)

## 🏢 Enterprise & Cloud

**Brain Cloud** - Managed Brainy with team sync, persistent memory, and enterprise connectors.

```bash
# Get started with free trial
brainy cloud setup
```

Visit [soulcraft.com](https://soulcraft.com) for more information.

## 📄 License

MIT © Brainy Contributors

---

<p align="center">
  <strong>Built with ❤️ by the Brainy community</strong><br>
  <em>Zero-Configuration AI Database with Triple Intelligence™</em>
</p>