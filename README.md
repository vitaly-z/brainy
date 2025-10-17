# Brainy

<p align="center">
  <img src="https://raw.githubusercontent.com/soulcraftlabs/brainy/main/brainy.png" alt="Brainy Logo" width="200">
</p>

[![npm version](https://badge.fury.io/js/%40soulcraft%2Fbrainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![npm downloads](https://img.shields.io/npm/dm/@soulcraft/brainy.svg)](https://www.npmjs.com/package/@soulcraft/brainy)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

**🧠 Brainy - The Knowledge Operating System**

**The world's first Knowledge Operating System** where every piece of knowledge - files, concepts, entities, ideas - exists as living information that understands itself, evolves over time, and connects to everything related.

**Why Brainy Changes Everything**: Traditional systems trap knowledge in files or database rows. Brainy liberates it. Your characters exist across stories. Your concepts span projects. Your APIs remember their evolution. Every piece of knowledge - whether it's code, prose, or pure ideas - lives, breathes, and connects in a unified intelligence layer where everything understands its meaning, remembers its history, and relates to everything else.

Built on revolutionary **Triple Intelligence™** that unifies vector similarity, graph relationships, and document filtering in one magical API. **Framework-first design.** Zero configuration. O(log n) performance, <10ms search latency. **Production-ready for billion-scale deployments.**

---

## 🎉 NEW in v4.0.0 - Enterprise-Scale Cost Optimization

**Major Release: Production cost optimization and enterprise-scale features**

### 💰 **Up to 96% Storage Cost Savings**

Automatic cloud storage lifecycle management for **AWS S3**, **Google Cloud Storage**, and **Azure Blob Storage**:

- **GCS Autoclass**: Fully automatic tier optimization (94% savings!)
- **AWS Intelligent-Tiering**: Smart archival with instant retrieval
- **Azure Lifecycle Policies**: Automatic tier transitions
- **Cost Impact**: $138,000/year → $5,940/year @ 500TB scale

### ⚡ **Performance at Billion-Scale**

- **1000x faster batch deletions** (533 entities/sec vs 0.5/sec)
- **60-80% FileSystem compression** with gzip
- **OPFS quota monitoring** for browser storage
- **Enhanced CLI** with 47 commands including 9 storage management tools

### 🛡️ **Zero Breaking Changes**

**100% backward compatible.** No migration required. All new features are opt-in.

**[📖 Read the full v4.0.0 Changelog →](CHANGELOG.md)** | **[Migration Guide →](docs/MIGRATION-V3-TO-V4.md)**

---

## 🎯 What Makes Brainy Revolutionary?

### 🧠 **Triple Intelligence™ - The Impossible Made Possible**

**The world's first to unify three database paradigms in ONE API:**

- **Vector Search** 🔍 Semantic similarity like Pinecone/Weaviate
- **Graph Relationships** 🕸️ Navigate connections like Neo4j/ArangoDB
- **Document Filtering** 📊 MongoDB-style queries with O(log n) performance

**Others make you choose.** Vector OR graph OR document. **Brainy does ALL THREE together.** This is what enables The Knowledge Operating System.

### 🚀 **Zero Configuration - Just Works™**

```javascript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

// That's it! Auto-detects storage, optimizes memory, configures everything.
```

No configuration files. No environment variables. No complex setup. **It just works.**

### ⚡ **Production Performance at Any Scale**

- **<10ms search** across millions of entities
- **87% memory reduction** @ billion scale (384GB → 50GB)
- **10x faster queries** with type-aware indexing
- **99% storage cost savings** with intelligent archival
- **Container-aware** memory allocation (Docker/K8s)

### 🎯 **31 Noun Types × 40 Verb Types = Infinite Expressiveness**

Model **ANY domain** with 1,240 base type combinations + unlimited metadata:

- Healthcare: Patient → diagnoses → Condition
- Finance: Account → transfers → Transaction
- Manufacturing: Product → assembles → Component
- Education: Student → completes → Course
- **Your domain**: Your types + Your relationships = Your knowledge graph

[→ See the Mathematical Proof](docs/architecture/noun-verb-taxonomy.md)

---

## ⚡ Quick Start - Zero Configuration

```bash
npm install @soulcraft/brainy
```

### 🎯 **Your First Knowledge Graph in 30 Seconds**

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
const results = await brain.find({
    query: "programming languages used by server runtimes"
})

// Triple Intelligence: vector + metadata + relationships
const filtered = await brain.find({
    query: "JavaScript",                  // Vector similarity
    where: {type: "language"},           // Metadata filtering
    connected: {from: nodeId, depth: 1}  // Graph relationships
})
```

**That's it!** You just created a knowledge graph with semantic search, relationship traversal, and metadata filtering. **No configuration. No complexity. Just works.**

---

## 🌟 Core Features

### 🧠 **Natural Language Understanding**

```javascript
// Ask questions naturally - Brainy understands
await brain.find("Show me recent React components with tests")
await brain.find("Popular JavaScript libraries similar to Vue")
await brain.find("Documentation about authentication from last month")

// Structured queries with Triple Intelligence
await brain.find({
    like: "React",                       // Vector similarity
    where: {                             // Document filtering
        type: "library",
        year: {greaterThan: 2020}
    },
    connected: {to: "JavaScript", depth: 2}  // Graph relationships
})
```

### 🌐 **Virtual Filesystem - Intelligent File Management**

Build file explorers, IDEs, and knowledge systems that **never crash**:

```javascript
const vfs = brain.vfs()
await vfs.init()

// ✅ Safe file operations
await vfs.writeFile('/projects/app/index.js', 'console.log("Hello")')
await vfs.mkdir('/docs')

// ✅ NEVER crashes: Tree-aware directory listing
const children = await vfs.getDirectChildren('/projects')

// ✅ Build file explorers safely
const tree = await vfs.getTreeStructure('/projects', {
  maxDepth: 3,          // Prevent deep recursion
  sort: 'name'
})

// ✅ Semantic file search
const reactFiles = await vfs.search('React components with hooks')
```

**Prevents infinite recursion** that crashes traditional file systems. Tree-aware operations ensure your file explorer never hangs.

**[📖 VFS Quick Start →](docs/vfs/QUICK_START.md)** | **[🎯 Common Patterns →](docs/vfs/COMMON_PATTERNS.md)**

### 🚀 **Import Anything - CSV, Excel, PDF, URLs**

```javascript
// Import CSV with auto-detection
await brain.import('customers.csv')
// ✨ Auto-detects: encoding, delimiter, types, creates entities!

// Import Excel workbooks with multi-sheet support
await brain.import('sales-data.xlsx', {
  excelSheets: ['Q1', 'Q2']
})

// Import PDF documents with table extraction
await brain.import('research-paper.pdf', {
  pdfExtractTables: true
})

// Import from URLs (auto-fetched)
await brain.import('https://api.example.com/data.json')
```

**[📖 Complete Import Guide →](docs/guides/import-anything.md)**

### 🧠 **Neural API - Advanced Semantic Analysis**

```javascript
const neural = brain.neural

// Automatic semantic clustering
const clusters = await neural.clusters({
    algorithm: 'kmeans',
    maxClusters: 5,
    threshold: 0.8
})

// Calculate similarity between any items
const similarity = await neural.similar('item1', 'item2')

// Find nearest neighbors
const neighbors = await neural.neighbors('item-id', 10)

// Detect outliers
const outliers = await neural.outliers(0.3)

// Generate visualization data for D3/Cytoscape
const vizData = await neural.visualize({
    maxNodes: 100,
    dimensions: 3,
    algorithm: 'force'
})
```

---

## 🌐 Framework Integration

**Brainy is framework-first!** Works with **any** modern framework:

### ⚛️ React & Next.js
```javascript
function SearchComponent() {
  const [brain] = useState(() => new Brainy())
  useEffect(() => { brain.init() }, [])

  const handleSearch = async (query) => {
    const results = await brain.find(query)
    setResults(results)
  }
}
```

### 🟢 Vue.js & Nuxt.js
```javascript
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

### 🅰️ Angular
```typescript
@Injectable({ providedIn: 'root' })
export class BrainyService {
  private brain = new Brainy()
  async search(query: string) {
    return await this.brain.find(query)
  }
}
```

**Works with:** Svelte, Solid.js, Qwik, Fresh, and more! All bundlers (Webpack, Vite, Rollup). SSR/SSG. Edge runtimes.

---

## 💾 Storage - From Development to Production

### 🚀 **Development: Just Works**
```javascript
const brain = new Brainy()  // Memory storage, auto-configured
```

### ⚡ **Production: FileSystem with Compression**
```javascript
const brain = new Brainy({
  storage: {
    type: 'filesystem',
    path: './brainy-data',
    compression: true  // 60-80% space savings!
  }
})
```

### ☁️ **Production: Cloud Storage** (NEW in v4.0.0)

Choose your cloud provider - all support **automatic cost optimization:**

#### **AWS S3 / Cloudflare R2 / DigitalOcean Spaces**
```javascript
const brain = new Brainy({
  storage: {
    type: 's3',
    s3Storage: {
      bucketName: 'my-knowledge-base',
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
})

// Enable Intelligent-Tiering for automatic 96% cost savings
await brain.storage.enableIntelligentTiering('entities/', 'brainy-auto-tier')
```

#### **Google Cloud Storage**
```javascript
const brain = new Brainy({
  storage: {
    type: 'gcs',
    gcsStorage: {
      bucketName: 'my-knowledge-base',
      keyFilename: '/path/to/service-account.json'
    }
  }
})

// Enable Autoclass for automatic 94% cost savings
await brain.storage.enableAutoclass({ terminalStorageClass: 'ARCHIVE' })
```

#### **Azure Blob Storage**
```javascript
const brain = new Brainy({
  storage: {
    type: 'azure',
    azureStorage: {
      containerName: 'knowledge-base',
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING
    }
  }
})

// Batch tier changes for 99% cost savings
await brain.storage.setBlobTierBatch(
  oldBlobs.map(name => ({ blobName: name, tier: 'Archive' }))
)
```

### 💰 **Cost Optimization Impact**

| Scale | Before | After (Archive) | Savings/Year |
|-------|--------|-----------------|--------------|
| 5TB | $1,380/year | $59/year | **$1,321 (96%)** |
| 50TB | $13,800/year | $594/year | **$13,206 (96%)** |
| 500TB | $138,000/year | $5,940/year | **$132,060 (96%)** |

**[📖 AWS S3 Cost Guide →](docs/operations/cost-optimization-aws-s3.md)** | **[GCS →](docs/operations/cost-optimization-gcs.md)** | **[Azure →](docs/operations/cost-optimization-azure.md)** | **[R2 →](docs/operations/cost-optimization-cloudflare-r2.md)**

---

## 🚀 Production Scale Features (NEW in v4.0.0)

### 🎯 **Type-Aware HNSW - 87% Memory Reduction**

**Billion-scale deployments made affordable:**

- **Memory @ 1B entities**: 384GB → 50GB (-87%)
- **Single-type queries**: 10x faster (search 100M instead of 1B)
- **Multi-type queries**: 5-8x faster
- **Optimized rebuilds**: 31x faster with type filtering

```javascript
const brain = new Brainy({
  hnsw: {
    typeAware: true  // Enable type-aware indexing
  }
})
```

### ⚡ **Production-Ready Storage**

**NEW v4.0.0 enterprise features:**

- **🗑️ Batch Operations**: Delete thousands of entities with retry logic
- **📦 Gzip Compression**: 60-80% space savings (FileSystem)
- **💽 OPFS Quota Monitoring**: Real-time quota tracking (Browser)
- **🔄 Metadata/Vector Separation**: Billion-entity scalability
- **🛡️ Enterprise Reliability**: Backpressure, circuit breakers, retries

```javascript
// Batch delete with retry logic
await brain.storage.batchDelete(keys, {
  maxRetries: 3,
  continueOnError: true
})

// Get storage status
const status = await brain.storage.getStorageStatus()
console.log(`Used: ${status.used}, Quota: ${status.quota}`)
```

### 📊 **Adaptive Memory Management**

**Auto-scales from 2GB to 128GB+ based on resources:**

- Container-aware (Docker/K8s cgroups v1/v2)
- Environment-smart (25% dev, 40% container, 50% production)
- Model memory accounting (150MB Q8, 250MB FP32)
- Built-in cache monitoring with recommendations

```javascript
// Get cache statistics and recommendations
const stats = brain.getCacheStats()
console.log(`Hit rate: ${stats.hitRate * 100}%`)
// Actionable tuning recommendations included
```

**[📖 Capacity Planning Guide →](docs/operations/capacity-planning.md)**

---

## 🏢 Enterprise Features - No Paywalls

Brainy includes **enterprise-grade capabilities at no extra cost**:

- ✅ **Scales to billions of entities** with 18ms search latency @ 1B scale
- ✅ **Distributed architecture** with sharding and replication
- ✅ **Read/write separation** for horizontal scaling
- ✅ **Connection pooling** and request deduplication
- ✅ **Built-in monitoring** with metrics and health checks
- ✅ **Production ready** with circuit breakers and backpressure

**No premium tiers. No feature gates. Everyone gets the same powerful system.**

---

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
| **Billion Scale (1B items)**     | **18ms**    | **50GB** |

---

## 🎯 Use Cases

### Knowledge Management
```javascript
// Create knowledge graph with relationships
const apiGuide = await brain.add("REST API Guide", {
    nounType: NounType.Document,
    category: "documentation"
})

const author = await brain.add("Jane Developer", {
    nounType: NounType.Person,
    role: "tech-lead"
})

await brain.relate(author, apiGuide, "authored")

// Query naturally
const docs = await brain.find(
  "documentation authored by tech leads for active projects"
)
```

### AI Memory Layer
```javascript
// Store conversation context with relationships
const userId = await brain.add("User 123", {
    nounType: NounType.User,
    tier: "premium"
})

const messageId = await brain.add(userMessage, {
    nounType: NounType.Message,
    timestamp: Date.now()
})

await brain.relate(userId, messageId, "sent")

// Retrieve context
const context = await brain.find({
    where: {type: "message"},
    connected: {from: userId, type: "sent"},
    like: "previous product issues"
})
```

### Semantic Search
```javascript
// Find similar content
const similar = await brain.search(existingContent, {
    limit: 5,
    threshold: 0.8
})
```

---

## 🛠️ CLI

```bash
npm install -g brainy

# Add data
brainy add "JavaScript is awesome" --metadata '{"type":"opinion"}'

# Search
brainy search "programming"

# Natural language find
brainy find "awesome programming languages"

# Interactive mode
brainy chat
```

---

## 📖 Documentation

### Getting Started
- [Getting Started Guide](docs/guides/getting-started.md)
- [v4.0.0 Migration Guide](docs/MIGRATION-V3-TO-V4.md) **← NEW**
- [AWS S3 Cost Guide](docs/operations/cost-optimization-aws-s3.md) | [GCS](docs/operations/cost-optimization-gcs.md) | [Azure](docs/operations/cost-optimization-azure.md) | [R2](docs/operations/cost-optimization-cloudflare-r2.md) **← NEW**

### Framework Integration
- [Framework Integration Guide](docs/guides/framework-integration.md)
- [Next.js Integration](docs/guides/nextjs-integration.md)
- [Vue.js Integration](docs/guides/vue-integration.md)

### Virtual Filesystem
- [VFS Core Documentation](docs/vfs/VFS_CORE.md)
- [Semantic VFS Guide](docs/vfs/SEMANTIC_VFS.md)
- [Neural Extraction API](docs/vfs/NEURAL_EXTRACTION.md)

### Core Documentation
- [API Reference](docs/api/README.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Data Storage Architecture](docs/architecture/data-storage-architecture.md)
- [Natural Language Guide](docs/guides/natural-language.md)
- [Triple Intelligence](docs/architecture/triple-intelligence.md)
- [Noun-Verb Taxonomy](docs/architecture/noun-verb-taxonomy.md)

### Operations & Production
- [Capacity Planning](docs/operations/capacity-planning.md)
- [Cloud Deployment Guide](docs/deployment/CLOUD_DEPLOYMENT_GUIDE.md) **← NEW**
- [AWS S3 Cost Guide](docs/operations/cost-optimization-aws-s3.md) | [GCS](docs/operations/cost-optimization-gcs.md) | [Azure](docs/operations/cost-optimization-azure.md) | [R2](docs/operations/cost-optimization-cloudflare-r2.md) **← NEW**

---

## 💖 Support Brainy

Brainy is **free and open source** - no paywalls, no premium tiers, no feature gates. If Brainy helps your project, consider supporting development:

- ⭐ **Star us on [GitHub](https://github.com/soulcraftlabs/brainy)**
- 💝 **Sponsor via [GitHub Sponsors](https://github.com/sponsors/soulcraftlabs)**
- 🐛 **Report issues** and contribute code
- 📣 **Share** with your team and community

Your support keeps Brainy free for everyone and enables continued development of enterprise features at no cost.

---

## 📋 System Requirements

**Node.js Version:** 22 LTS (recommended)

- ✅ **Node.js 22 LTS** - Fully supported (recommended for production)
- ✅ **Node.js 20 LTS** - Compatible (maintenance mode)
- ❌ **Node.js 24** - Not supported (ONNX compatibility issues)

If using nvm: `nvm use` (we provide a `.nvmrc` file)

---

## 🧠 The Knowledge Operating System Explained

### How We Achieved The Impossible

**Triple Intelligence™** unifies three database paradigms that were previously incompatible:

1. **Vector databases** (Pinecone, Weaviate) - semantic similarity
2. **Graph databases** (Neo4j, ArangoDB) - relationships
3. **Document databases** (MongoDB, Elasticsearch) - metadata filtering

**Others make you choose. Brainy does all three together.**

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

---

## 🏢 Enterprise & Cloud

**Brain Cloud** - Managed Brainy with team sync, persistent memory, and enterprise connectors.

```bash
brainy cloud setup
```

Visit [soulcraft.com](https://soulcraft.com) for more information.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT © Brainy Contributors

---

<p align="center">
  <strong>Built with ❤️ by the Brainy community</strong><br>
  <em>Zero-Configuration AI Database with Triple Intelligence™</em><br>
  <em>v4.0.0 - Production-Scale Storage with 99% Cost Savings</em>
</p>
