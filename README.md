# Brainy

<p align="center">
  <img src="https://raw.githubusercontent.com/soulcraftlabs/brainy/main/brainy.png" alt="Brainy Logo" width="200">
</p>

[![npm version](https://badge.fury.io/js/%40soulcraft%2Fbrainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![npm downloads](https://img.shields.io/npm/dm/@soulcraft/brainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

**🧠 Brainy 2.0 - The Universal Knowledge Protocol™**

**World's first Triple Intelligence™ database**—unifying vector similarity, graph relationships, and document filtering in one magical API. Model ANY data from ANY domain using 31 standardized noun types × 40 verb types.

**Why Brainy Leads**: We're the first to solve the impossible—combining three different database paradigms (vector, graph, document) into one unified query interface. This breakthrough enables us to be the Universal Knowledge Protocol where all tools, augmentations, and AI models speak the same language.

**Build once, integrate everywhere.** O(log n) performance, 3ms search latency, 24MB memory footprint.

## 🎉 What's New in 2.0

- **World's First Triple Intelligence™**: Unified vector + graph + document in ONE query
- **Universal Knowledge Protocol**: 31 nouns × 40 verbs standardize all knowledge
- **Infinite Expressiveness**: Model ANY data with unlimited metadata
- **API Consolidation**: 15+ methods → 2 clean APIs (`search()` and `find()`)
- **Natural Language**: Ask questions in plain English
- **Zero Configuration**: Works instantly, no setup required
- **O(log n) Performance**: Binary search on sorted indices
- **Perfect Interoperability**: All tools and AI models speak the same language
- **Universal Compatibility**: Node.js, Browser, Edge, Workers

## ⚡ Quick Start

```bash
npm install @soulcraft/brainy
```

```javascript
import { BrainyData } from 'brainy'

const brain = new BrainyData()
await brain.init()

// Add entities (nouns) with automatic embedding
const jsId = await brain.addNoun("JavaScript is a programming language", { 
  type: "language", 
  year: 1995,
  paradigm: "multi-paradigm"
})

const nodeId = await brain.addNoun("Node.js runtime environment", {
  type: "runtime",
  year: 2009,
  platform: "server-side"
})

// Create relationships (verbs) between entities
await brain.addVerb(nodeId, jsId, "executes", {
  since: 2009,
  performance: "high"
})

// Natural language search with graph relationships
const results = await brain.find("programming languages used by server runtimes")

// Triple Intelligence: vector + metadata + relationships
const filtered = await brain.find({
  like: "JavaScript",                    // Vector similarity
  where: { type: "language" },           // Metadata filtering  
  connected: { from: nodeId, depth: 1 }  // Graph relationships
})
```

## 📋 System Requirements

**Node.js Version:** 22 LTS or later (recommended)

- ✅ **Node.js 22 LTS** - Fully supported and recommended for production
- ✅ **Node.js 20 LTS** - Compatible (maintenance mode)
- ❌ **Node.js 24** - Not supported (known ONNX runtime compatibility issues)

> **Important:** Brainy uses ONNX runtime for AI embeddings. Node.js 24 has known compatibility issues that cause crashes during inference operations. We recommend Node.js 22 LTS for maximum stability.

If using nvm: `nvm use` (we provide a `.nvmrc` file)

## 🚀 Key Features

### World's First Triple Intelligence™ Engine
**The breakthrough that enables the Universal Knowledge Protocol:**
- **Vector Search**: Semantic similarity with HNSW indexing
- **Graph Relationships**: Navigate connected knowledge like Neo4j
- **Document Filtering**: MongoDB-style queries with O(log n) performance
- **Unified in ONE API**: No separate queries, no complex joins
- **First to solve this**: Others do vector OR graph OR document—we do ALL

### Universal Knowledge Protocol with Infinite Expressiveness
**Enabled by Triple Intelligence, standardized for everyone:**
- **24 Noun Types × 40 Verb Types**: 960 base combinations
- **∞ Expressiveness**: Unlimited metadata = model ANY data
- **One Language**: All tools, augmentations, AI models speak the same types
- **Perfect Interoperability**: Move data between any Brainy instance
- **No Schema Lock-in**: Evolve without migrations

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

### Performance Optimization

**Q8 Quantized Models** - 75% smaller, faster loading (v2.8.0+)

```javascript
// Default: Full precision (fp32) - maximum compatibility
const brain = new BrainyData()

// Optimized: Quantized models (q8) - 75% smaller, 99% accuracy  
const brainOptimized = new BrainyData({
  embeddingOptions: { dtype: 'q8' }
})
```

**Model Comparison:**
- **FP32 (default)**: 90MB, 100% accuracy, maximum compatibility
- **Q8 (optional)**: 23MB, ~99% accuracy, faster loading

**When to use Q8:**
- ✅ New projects where size/speed matters
- ✅ Memory-constrained environments  
- ✅ Mobile or edge deployments
- ❌ Existing projects with FP32 data (incompatible embeddings)

**Air-gap deployment:**
```bash
npm run download-models        # Both models (recommended)
npm run download-models:q8     # Q8 only (space-constrained)
npm run download-models:fp32   # FP32 only (compatibility)
```

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
// Create entities (nouns)
const id = await brain.addNoun(data, metadata)

// Create relationships (verbs)
const verbId = await brain.addVerb(sourceId, targetId, "relationType", {
  strength: 0.9,
  bidirectional: false
})

// Read
const item = await brain.getNoun(id)
const verb = await brain.getVerb(verbId)

// Update
await brain.updateNoun(id, newData, newMetadata)
await brain.updateVerb(verbId, newMetadata)

// Delete
await brain.deleteNoun(id)
await brain.deleteVerb(verbId)

// Bulk operations
await brain.import(arrayOfData)
const exported = await brain.export({ format: 'json' })
```

## 🎯 Use Cases

### Knowledge Management with Relationships
```javascript
// Store documentation with rich relationships
const apiGuide = await brain.addNoun("REST API Guide", {
  title: "API Guide",
  category: "documentation",
  version: "2.0"
})

const author = await brain.addNoun("Jane Developer", {
  type: "person",
  role: "tech-lead"
})

const project = await brain.addNoun("E-commerce Platform", {
  type: "project",
  status: "active"
})

// Create knowledge graph
await brain.addVerb(author, apiGuide, "authored", { 
  date: "2024-03-15" 
})
await brain.addVerb(apiGuide, project, "documents", { 
  coverage: "complete" 
})

// Query the knowledge graph naturally
const docs = await brain.find("documentation authored by tech leads for active projects")
```

### Semantic Search
```javascript
// Find similar content
const similar = await brain.search(existingContent, {
  limit: 5,
  threshold: 0.8
})
```

### AI Memory Layer with Context
```javascript
// Store conversation with relationships
const userId = await brain.addNoun("User 123", {
  type: "user",
  tier: "premium"
})

const messageId = await brain.addNoun(userMessage, {
  type: "message",
  timestamp: Date.now(),
  session: "abc"
})

const topicId = await brain.addNoun("Product Support", {
  type: "topic",
  category: "support"
})

// Link conversation elements
await brain.addVerb(userId, messageId, "sent")
await brain.addVerb(messageId, topicId, "about")

// Retrieve context with relationships
const context = await brain.find({
  where: { type: "message" },
  connected: { from: userId, type: "sent" },
  like: "previous product issues"
})
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

## 🧠 Neural API - Advanced AI Features

Brainy includes a powerful Neural API for advanced semantic analysis:

### Clustering & Analysis
```javascript
// Access via brain.neural
const neural = brain.neural

// Automatic semantic clustering
const clusters = await neural.clusters()
// Returns groups of semantically similar items

// Cluster with options
const clusters = await neural.clusters({
  algorithm: 'kmeans',     // or 'hierarchical', 'sample'
  maxClusters: 5,          // Maximum number of clusters
  threshold: 0.8           // Similarity threshold
})

// Calculate similarity between any items
const similarity = await neural.similar('item1', 'item2')
// Returns 0-1 score

// Find nearest neighbors
const neighbors = await neural.neighbors('item-id', 10)

// Build semantic hierarchy
const hierarchy = await neural.hierarchy('item-id')

// Detect outliers
const outliers = await neural.outliers(0.3)

// Generate visualization data for D3/Cytoscape
const vizData = await neural.visualize({
  maxNodes: 100,
  dimensions: 3,
  algorithm: 'force'
})
```

### Real-World Examples
```javascript
// Group customer feedback into themes
const feedbackClusters = await neural.clusters()
for (const cluster of feedbackClusters) {
  console.log(`Theme: ${cluster.label}`)
  console.log(`Items: ${cluster.members.length}`)
}

// Find related documents
const docId = await brain.addNoun("Machine learning guide")
const similar = await neural.neighbors(docId, 5)
// Returns 5 most similar documents

// Detect anomalies in data
const anomalies = await neural.outliers(0.2)
console.log(`Found ${anomalies.length} outliers`)
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

## 🧠 The Universal Knowledge Protocol Explained

### How We Achieved The Impossible

**Triple Intelligence™** makes us the **world's first** to unify three database paradigms:
1. **Vector databases** (Pinecone, Weaviate) - semantic similarity
2. **Graph databases** (Neo4j, ArangoDB) - relationships  
3. **Document databases** (MongoDB, Elasticsearch) - metadata filtering

**One API to rule them all.** Others make you choose. We unified them.

### The Math of Infinite Expressiveness

```
24 Nouns × 40 Verbs × ∞ Metadata × Triple Intelligence = Universal Protocol
```

- **960 base combinations** from standardized types
- **∞ domain specificity** via unlimited metadata
- **∞ relationship depth** via graph traversal
- **= Model ANYTHING**: From quantum physics to social networks

### Why This Changes Everything

**Like HTTP for the web, Brainy for knowledge:**
- All augmentations compose perfectly - same noun-verb language
- All AI models share knowledge - GPT, Claude, Llama all understand
- All tools integrate seamlessly - no translation layers
- All data flows freely - perfect portability

**The Vision**: One protocol. All knowledge. Every tool. Any AI.

**Proven across industries**: Healthcare, Finance, Manufacturing, Education, Legal, Retail, Government, and beyond.

[→ See the Mathematical Proof & Full Taxonomy](docs/architecture/noun-verb-taxonomy.md)

## 📖 Documentation

- [Getting Started Guide](docs/guides/getting-started.md)
- [API Reference](docs/api/README.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Natural Language Guide](docs/guides/natural-language.md)
- [Triple Intelligence](docs/architecture/triple-intelligence.md)
- [Noun-Verb Taxonomy](docs/architecture/noun-verb-taxonomy.md)

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