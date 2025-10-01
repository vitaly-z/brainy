# Brainy

<p align="center">
  <img src="https://raw.githubusercontent.com/soulcraftlabs/brainy/main/brainy.png" alt="Brainy Logo" width="200">
</p>

[![npm version](https://badge.fury.io/js/%40soulcraft%2Fbrainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![npm downloads](https://img.shields.io/npm/dm/@soulcraft/brainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

**🧠 Brainy - The Knowledge Operating System**

**The world's first Knowledge Operating System** where every piece of knowledge - files, concepts, entities, ideas - exists as living information that understands itself, evolves over time, and connects to everything related. Built on revolutionary Triple Intelligence™ that unifies vector similarity, graph relationships, and document filtering in one magical API.

**Why Brainy Changes Everything**: Traditional systems trap knowledge in files or database rows. Brainy liberates it. Your characters exist across stories. Your concepts span projects. Your APIs remember their evolution. Every piece of knowledge - whether it's code, prose, or pure ideas - lives, breathes, and connects in a unified intelligence layer where everything understands its meaning, remembers its history, and relates to everything else.

**Framework-first design.** Built for modern web development with zero configuration and automatic framework compatibility. O(log n) performance, <10ms search latency, production-ready.

## 🎉 Key Features

### 💬 **Infinite Agent Memory**

- **Never Lose Context**: Conversations preserved with semantic search
- **Smart Context Retrieval**: Triple Intelligence finds relevant past work
- **Claude Code Integration**: One command (`brainy conversation setup`) enables infinite memory
- **Automatic Artifact Linking**: Code and files connected to conversations
- **Scales to Millions**: Messages indexed and searchable in <100ms

### 🚀 **NEW in 3.21.0: Enhanced Import & Neural Processing**

- **📊 Progress Tracking**: Unified progress reporting with automatic time estimation
- **⚡ Entity Caching**: 10-100x speedup on repeated entity extraction
- **🔗 Relationship Confidence**: Multi-factor confidence scoring (0-1 scale)
- **📝 Evidence Tracking**: Understand why relationships were detected
- **🎯 Production Ready**: Fully backward compatible, opt-in features

### 🧠 **Triple Intelligence™ Engine**

- **Vector Search**: HNSW-powered semantic similarity
- **Graph Relationships**: Navigate connected knowledge
- **Document Filtering**: MongoDB-style metadata queries
- **Unified API**: All three in a single query interface

### 🎯 **Clean API Design**

- **Modern Syntax**: `brain.add()`, `brain.find()`, `brain.relate()`
- **Type Safety**: Full TypeScript integration
- **Zero Config**: Works out of the box with memory storage
- **Consistent Parameters**: Clean, predictable API surface

### ⚡ **Performance & Reliability**

- **<10ms Search**: Fast semantic queries
- **384D Vectors**: Optimized embeddings (all-MiniLM-L6-v2)
- **Built-in Caching**: Intelligent result caching + new entity extraction cache
- **Production Ready**: Thoroughly tested core functionality

## ⚡ Quick Start - Zero Configuration

```bash
npm install @soulcraft/brainy

# For Claude Code infinite memory (optional):
brainy conversation setup
```

### 💬 **Infinite Memory for Claude Code**

```javascript
// One-time setup:
// $ brainy conversation setup

// Claude Code now automatically:
// - Saves every conversation with embeddings
// - Retrieves relevant past context
// - Links code artifacts to conversations
// - Never loses context or momentum

// Use programmatically:
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

// Save conversations
await brain.conversation.saveMessage(
  "How do I implement JWT authentication?",
  "user",
  { conversationId: "conv_123" }
)

// Get relevant context (semantic + temporal + graph)
const context = await brain.conversation.getRelevantContext(
  "JWT token validation",
  { limit: 10, includeArtifacts: true }
)
// Returns: Ranked messages, linked code, similar conversations
```

### 🎯 **True Zero Configuration**

```javascript
import { Brainy, NounType } from '@soulcraft/brainy'

// Just this - auto-detects everything!
const brain = new Brainy()
await brain.init()

// Add entities with automatic embedding
const jsId = await brain.add({
    data: "JavaScript is a programming language",
    nounType: NounType.Concept,
    metadata: {
        type: "language",
        year: 1995,
        paradigm: "multi-paradigm"
    }
})

const nodeId = await brain.add({
    data: "Node.js runtime environment",
    nounType: NounType.Concept,
    metadata: {
        type: "runtime",
        year: 2009,
        platform: "server-side"
    }
})

// Create relationships between entities
await brain.relate({
    from: nodeId,
    to: jsId,
    type: "executes",
    metadata: {
        since: 2009,
        performance: "high"
    }
})

// Natural language search with graph relationships
const results = await brain.find({query: "programming languages used by server runtimes"})

// Triple Intelligence: vector + metadata + relationships
const filtered = await brain.find({
    query: "JavaScript",                  // Vector similarity
    where: {type: "language"},           // Metadata filtering
    connected: {from: nodeId, depth: 1}  // Graph relationships
})
```

## 🌐 Framework Integration

**Brainy is framework-first!** Works seamlessly with any modern JavaScript framework:

### ⚛️ **React & Next.js**
```javascript
import { Brainy } from '@soulcraft/brainy'

function SearchComponent() {
  const [brain] = useState(() => new Brainy())

  useEffect(() => {
    brain.init()
  }, [])

  const handleSearch = async (query) => {
    const results = await brain.find(query)
    setResults(results)
  }
}
```

### 🟢 **Vue.js & Nuxt.js**
```javascript
import { Brainy } from '@soulcraft/brainy'

export default {
  async mounted() {
    this.brain = new Brainy()
    await this.brain.init()
  },
  methods: {
    async search(query) {
      return await this.brain.find(query)
    }
  }
}
```

### 🅰️ **Angular**
```typescript
import { Injectable } from '@angular/core'
import { Brainy } from '@soulcraft/brainy'

@Injectable({ providedIn: 'root' })
export class BrainyService {
  private brain = new Brainy()

  async init() {
    await this.brain.init()
  }

  async search(query: string) {
    return await this.brain.find(query)
  }
}
```

### 🔥 **Other Frameworks**
Brainy works with **any** framework that supports ES6 imports: Svelte, Solid.js, Qwik, Fresh, and more!

**Framework Compatibility:**
- ✅ All modern bundlers (Webpack, Vite, Rollup, Parcel)
- ✅ SSR/SSG (Next.js, Nuxt, SvelteKit, Astro)
- ✅ Edge runtimes (Vercel Edge, Cloudflare Workers)
- ✅ Browser and Node.js environments

## 📋 System Requirements

**Node.js Version:** 22 LTS or later (recommended)

- ✅ **Node.js 22 LTS** - Fully supported and recommended for production
- ✅ **Node.js 20 LTS** - Compatible (maintenance mode)
- ❌ **Node.js 24** - Not supported (known ONNX runtime compatibility issues)

> **Important:** Brainy uses ONNX runtime for AI embeddings. Node.js 24 has known compatibility issues that cause
> crashes during inference operations. We recommend Node.js 22 LTS for maximum stability.

If using nvm: `nvm use` (we provide a `.nvmrc` file)

## 🚀 Key Features

### World's First Triple Intelligence™ Engine

**The breakthrough that enables The Knowledge Operating System:**

- **Vector Search**: Semantic similarity with HNSW indexing
- **Graph Relationships**: Navigate connected knowledge like Neo4j
- **Document Filtering**: MongoDB-style queries with O(log n) performance
- **Unified in ONE API**: No separate queries, no complex joins
- **First to solve this**: Others do vector OR graph OR document—we do ALL

### The Knowledge Operating System with Infinite Expressiveness

**Enabled by Triple Intelligence, standardized for everyone:**

- **31 Noun Types × 40 Verb Types**: 1,240 base combinations
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

### 🧠🌐 **Virtual Filesystem - Intelligent File Management**

**Build file explorers, IDEs, and knowledge systems that never crash from infinite recursion.**

- **Tree-Aware Operations**: Safe directory listing prevents recursive loops
- **Semantic Search**: Find files by content, not just filename
- **Production Storage**: Filesystem and cloud storage for real applications
- **Zero-Config**: Works out of the box with intelligent defaults

```javascript
import { Brainy } from '@soulcraft/brainy'

// ✅ CORRECT: Use persistent storage for file systems
const brain = new Brainy({
  storage: {
    type: 'filesystem',    // Persisted to disk
    path: './brainy-data'  // Your file storage
  }
})
await brain.init()

const vfs = brain.vfs()
await vfs.init()

// ✅ Safe file operations
await vfs.writeFile('/projects/app/index.js', 'console.log("Hello")')
await vfs.mkdir('/docs')
await vfs.writeFile('/docs/README.md', '# My Project')

// ✅ NEVER crashes: Tree-aware directory listing
const children = await vfs.getDirectChildren('/projects')
// Returns only direct children, never the directory itself

// ✅ Build file explorers safely
const tree = await vfs.getTreeStructure('/projects', {
  maxDepth: 3,          // Prevent deep recursion
  sort: 'name'         // Organized results
})

// ✅ Semantic file search
const reactFiles = await vfs.search('React components with hooks')
const docs = await vfs.search('API documentation', {
  path: '/docs'  // Search within specific directory
})

// ✅ Connect related files
await vfs.addRelationship('/src/auth.js', '/tests/auth.test.js', 'tested-by')

// Perfect for: File explorers, IDEs, documentation systems, code analysis
```

**🚨 Prevents Common Mistakes:**
- ❌ No infinite recursion in file trees (like brain-cloud team experienced)
- ❌ No data loss from memory storage
- ❌ No performance issues with large directories
- ❌ No need for complex fallback patterns

**[📖 VFS Quick Start →](docs/vfs/QUICK_START.md)** | **[🎯 Common Patterns →](docs/vfs/COMMON_PATTERNS.md)**

**Your knowledge isn't trapped anymore.** Characters live beyond stories. APIs exist beyond code files. Concepts connect across domains. This is knowledge that happens to support files, not a filesystem that happens to store knowledge.

### 🚀 **NEW: Enhanced Directory Import with Caching**

**Import large projects 10-100x faster with intelligent caching:**

```javascript
import { Brainy } from '@soulcraft/brainy'
import { ProgressTracker, formatProgress } from '@soulcraft/brainy/types'
import { detectRelationshipsWithConfidence } from '@soulcraft/brainy/neural'

const brain = new Brainy()
await brain.init()

// Progress tracking for long operations
const tracker = ProgressTracker.create(1000)
tracker.start()

for await (const progress of importer.importStream('./project', {
  batchSize: 100,
  generateEmbeddings: true
})) {
  const p = tracker.update(progress.processed, progress.current)
  console.log(formatProgress(p))
  // [RUNNING] 45% (450/1000) - 23.5 items/s - 23s remaining
}

// Entity extraction with intelligent caching
const entities = await brain.neural.extractor.extract(text, {
  types: ['person', 'organization', 'technology'],
  confidence: 0.7,
  cache: {
    enabled: true,
    ttl: 7 * 24 * 60 * 60 * 1000,  // 7 days
    invalidateOn: 'mtime'  // Re-extract when file changes
  }
})

// Relationship detection with confidence scores
const relationships = detectRelationshipsWithConfidence(entities, text, {
  minConfidence: 0.7
})

// Create relationships with evidence tracking
await brain.relate({
  from: sourceId,
  to: targetId,
  type: 'creates',
  confidence: 0.85,
  evidence: {
    sourceText: 'John created the database',
    method: 'pattern',
    reasoning: 'Matches creation pattern; entities in same sentence'
  }
})

// Monitor cache performance
const stats = brain.neural.extractor.getCacheStats()
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
// Cache hit rate: 89.5%
```

**📚 [See Full Example →](examples/directory-import-with-caching.ts)**

### 🎯 Zero Configuration Philosophy

Brainy automatically configures **everything**:

```javascript
import { Brainy } from '@soulcraft/brainy'

// 1. Pure zero-config - detects everything
const brain = new Brainy()

// 2. Custom configuration
const brain = new Brainy({
  storage: { type: 'memory' },
  embeddings: { model: 'all-MiniLM-L6-v2' },
  cache: { enabled: true, maxSize: 1000 }
})

// 3. Production configuration
const customBrain = new Brainy({
    mode: 'production',
    model: 'q8',           // Optimized model (99% accuracy, 75% smaller)
    storage: 'cloud',     // or 'memory', 'disk', 'auto'
    features: ['core', 'search', 'cache']
})
```

**What's Auto-Detected:**

- **Storage**: S3/GCS/R2 → Filesystem → Memory (priority order)
- **Models**: Always Q8 for optimal balance
- **Features**: Minimal → Default → Full based on environment
- **Memory**: Optimal cache sizes and batching
- **Performance**: Threading, chunking, indexing strategies

### Production Performance

- **3ms average search** - Lightning fast queries
- **24MB memory footprint** - Efficient resource usage
- **Worker-based embeddings** - Non-blocking operations
- **Automatic caching** - Intelligent result caching

### 🎛️ Advanced Configuration (When Needed)

Most users **never need this** - zero-config handles everything. For advanced use cases:

```javascript
// Model is always Q8 for optimal performance
const brain = new Brainy()  // Uses Q8 automatically

// Storage control (auto-detected by default)
const memoryBrain = new Brainy({storage: 'memory'})     // RAM only
const diskBrain = new Brainy({storage: 'disk'})         // Local filesystem  
const cloudBrain = new Brainy({storage: 'cloud'})       // S3/GCS/R2

// Legacy full config (still supported)
const legacyBrain = new Brainy({
    storage: {forceMemoryStorage: true}
})
```

**Model Details:**

- **Q8**: 33MB, 99% accuracy, 75% smaller than full precision
- Fast loading and optimal memory usage
- Perfect for all environments

**Air-gap deployment:**

```bash
npm run download-models        # Download Q8 model
npm run download-models:q8     # Download Q8 model
```

## 🚀 Import Anything - Files, Data, URLs

Brainy's universal import intelligently handles **any data format**:

```javascript
// Import CSV with auto-detection
await brain.import('customers.csv')
// ✨ Auto-detects: encoding, delimiter, types, creates entities!

// Import Excel workbooks with multi-sheet support
await brain.import('sales-data.xlsx', {
  excelSheets: ['Q1', 'Q2']  // or 'all' for all sheets
})
// ✨ Processes all sheets, preserves structure, infers types!

// Import PDF documents with table extraction
await brain.import('research-paper.pdf', {
  pdfExtractTables: true
})
// ✨ Extracts text, detects tables, preserves metadata!

// Import JSON/YAML data
await brain.import([
  { name: 'Alice', role: 'Engineer' },
  { name: 'Bob', role: 'Designer' }
])
// ✨ Automatically creates Person entities with relationships!

// Import from URLs (auto-fetched)
await brain.import('https://api.example.com/data.json')
// ✨ Auto-detects URL, fetches, parses, processes!
```

**📖 [Complete Import Guide →](docs/guides/import-anything.md)** | **[Live Example →](examples/import-excel-pdf-csv.ts)**

## 📚 Core API

### `search()` - Vector Similarity

```javascript
const results = await brain.search("machine learning", {
    limit: 10,                    // Number of results
    metadata: {type: "article"}, // Filter by metadata
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
        year: {greaterThan: 2020},
        important: true
    },
    related: {to: "React"}      // Graph relationships
})
```

### CRUD Operations

```javascript
// Create entities (nouns)
const id = await brain.add(data, { nounType: nounType, ...metadata })

// Create relationships (verbs)
const verbId = await brain.relate(sourceId, targetId, "relationType", {
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
const exported = await brain.export({format: 'json'})

// Import from CSV, Excel, PDF files (auto-detected)
await brain.import('customers.csv')      // CSV with encoding detection
await brain.import('sales-report.xlsx')  // Excel with multi-sheet support
await brain.import('research.pdf')       // PDF with table extraction
```

## 🌐 Distributed System (NEW!)

### Zero-Config Distributed Setup

```javascript
// Single node (default)
const brain = new Brainy({
    storage: {type: 's3', options: {bucket: 'my-data'}}
})

// Distributed cluster - just add one flag!
const brain = new Brainy({
    storage: {type: 's3', options: {bucket: 'my-data'}},
    distributed: true  // That's it! Everything else is automatic
})
```

### How It Works

- **Storage-Based Discovery**: Nodes find each other via S3/GCS (no Consul/etcd!)
- **Automatic Sharding**: Data distributed by content hash
- **Smart Query Planning**: Queries routed to optimal shards
- **Live Rebalancing**: Handles node joins/leaves automatically
- **Zero Downtime**: Streaming shard migration

### Real-World Example: Social Media Firehose

```javascript
import { Brainy, NounType } from '@soulcraft/brainy'

// Ingestion nodes (optimized for writes)
const ingestionNode = new Brainy({
    storage: {type: 's3', options: {bucket: 'social-data'}},
    distributed: true,
    writeOnly: true  // Optimized for high-throughput writes
})

// Process Bluesky firehose
blueskyStream.on('post', async (post) => {
    await ingestionNode.add(post, {
        nounType: NounType.Message,
        platform: 'bluesky',
        author: post.author,
        timestamp: post.createdAt
    })
})

// Search nodes (optimized for queries)
const searchNode = new Brainy({
    storage: {type: 's3', options: {bucket: 'social-data'}},
    distributed: true,
    readOnly: true  // Optimized for fast queries
})

// Search across ALL data from ALL nodes
const trending = await searchNode.find('trending AI topics', {
    where: {timestamp: {greaterThan: Date.now() - 3600000}},
    limit: 100
})
```

### Benefits Over Traditional Systems

| Feature        | Traditional (Pinecone, Weaviate) | Brainy Distributed            |
|----------------|----------------------------------|-------------------------------|
| Setup          | Complex (k8s, operators)         | One flag: `distributed: true` |
| Coordination   | External (etcd, Consul)          | Built-in (via storage)        |
| Minimum Nodes  | 3-5 for HA                       | 1 (scale as needed)           |
| Sharding       | Random                           | Domain-aware                  |
| Query Planning | Basic                            | Triple Intelligence           |
| Cost           | High (always-on clusters)        | Low (scale to zero)           |

## 🎯 Use Cases

### Knowledge Management with Relationships

```javascript
// Store documentation with rich relationships
const apiGuide = await brain.add("REST API Guide", {
    nounType: NounType.Document,
    title: "API Guide",
    category: "documentation",
    version: "2.0"
})

const author = await brain.add("Jane Developer", {
    nounType: NounType.Person,
    role: "tech-lead"
})

const project = await brain.add("E-commerce Platform", {
    nounType: NounType.Project,
    status: "active"
})

// Create knowledge graph
await brain.relate(author, apiGuide, "authored", {
    date: "2024-03-15"
})
await brain.relate(apiGuide, project, "documents", {
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
const userId = await brain.add("User 123", {
    nounType: NounType.User,
    tier: "premium"
})

const messageId = await brain.add(userMessage, {
    nounType: NounType.Message,
    timestamp: Date.now(),
    session: "abc"
})

const topicId = await brain.add("Product Support", {
    nounType: NounType.Topic,
    category: "support"
})

// Link conversation elements
await brain.relate(userId, messageId, "sent")
await brain.relate(messageId, topicId, "about")

// Retrieve context with relationships
const context = await brain.find({
    where: {type: "message"},
    connected: {from: userId, type: "sent"},
    like: "previous product issues"
})
```

## 💾 Storage Options

Brainy supports multiple storage backends:

```javascript
// Memory (default for testing)
const brain = new Brainy({
    storage: {type: 'memory'}
})

// FileSystem (Node.js)
const brain = new Brainy({
    storage: {
        type: 'filesystem',
        path: './data'
    }
})

// Browser Storage (OPFS) - Works with frameworks
const brain = new Brainy({
    storage: {type: 'opfs'}  // Framework handles browser polyfills
})

// S3 Compatible (Production)
const brain = new Brainy({
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
const docId = await brain.add("Machine learning guide", { nounType: NounType.Document })
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
- **Distributed architecture** with sharding and replication
- **Read/write separation** for horizontal scaling
- **Connection pooling** and request deduplication
- **Built-in monitoring** with metrics and health checks
- **Production ready** with circuit breakers and backpressure

📖 **More enterprise features coming soon** - Stay tuned!

## 📊 Benchmarks

| Operation                        | Performance | Memory   |
|----------------------------------|-------------|----------|
| Initialize                       | 450ms       | 24MB     |
| Add Item                         | 12ms        | +0.1MB   |
| Vector Search (1k items)         | 3ms         | -        |
| Metadata Filter (10k items)      | 0.8ms       | -        |
| Natural Language Query           | 15ms        | -        |
| Bulk Import (1000 items)         | 2.3s        | +8MB     |
| **Production Scale (10M items)** | **5.8ms**   | **12GB** |

## 🔄 Migration from Previous Versions

Key changes in the latest version:

- Search methods consolidated into `search()` and `find()`
- Result format now includes full objects with metadata
- Enhanced natural language capabilities
- Distributed architecture support

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🧠 The Knowledge Operating System Explained

### How We Achieved The Impossible

**Triple Intelligence™** makes us the **world's first** to unify three database paradigms:

1. **Vector databases** (Pinecone, Weaviate) - semantic similarity
2. **Graph databases** (Neo4j, ArangoDB) - relationships
3. **Document databases** (MongoDB, Elasticsearch) - metadata filtering

**One API to rule them all.** Others make you choose. We unified them.

### The Math of Infinite Expressiveness

```
31 Nouns × 40 Verbs × ∞ Metadata × Triple Intelligence = Universal Protocol
```

- **1,240 base combinations** from standardized types
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

### Infinite Agent Memory 💬
- [Conversation API Overview](docs/conversation/README.md) - **NEW!** Complete conversation management guide
- [MCP Integration for Claude Code](docs/conversation/MCP_INTEGRATION.md) - **NEW!** One-command setup
- [API Reference](docs/conversation/API_REFERENCE.md) - **NEW!** Full API documentation

### Framework Integration
- [Framework Integration Guide](docs/guides/framework-integration.md) - Complete framework setup guide
- [Next.js Integration](docs/guides/nextjs-integration.md) - React and Next.js examples
- [Vue.js Integration](docs/guides/vue-integration.md) - Vue and Nuxt examples

### Virtual Filesystem (Semantic VFS) 🧠📁
- [VFS Core Documentation](docs/vfs/VFS_CORE.md) - Complete filesystem architecture and API
- [Semantic VFS Guide](docs/vfs/SEMANTIC_VFS.md) - Multi-dimensional file access (6 semantic dimensions)
- [Neural Extraction API](docs/vfs/NEURAL_EXTRACTION.md) - AI-powered concept and entity extraction
- [Examples & Scenarios](docs/vfs/VFS_EXAMPLES_SCENARIOS.md) - Real-world use cases and code
- [VFS API Guide](docs/vfs/VFS_API_GUIDE.md) - Complete API reference

### Core Documentation
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