# Brainy

<p align="center">
  <img src="brainy.png" alt="Brainy Logo" width="200">
</p>

[![npm version](https://badge.fury.io/js/brainy.svg)](https://www.npmjs.com/package/brainy)
[![npm downloads](https://img.shields.io/npm/dm/brainy.svg)](https://www.npmjs.com/package/brainy)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)
[![GitHub last commit](https://img.shields.io/github/last-commit/brainy-org/brainy)](https://github.com/brainy-org/brainy)
[![GitHub issues](https://img.shields.io/github/issues/brainy-org/brainy)](https://github.com/brainy-org/brainy/issues)

**Multi-Dimensional AI Database with Triple Intelligence Engine**

Brainy is a next-generation AI database that combines vector similarity, graph relationships, and field filtering into a unified "Triple Intelligence" query system. Built for modern AI applications that need semantic search, relationship mapping, and precise data filtering all in one query.

## ✨ Features

### 🧠 Triple Intelligence Engine ✅ Available Now
- **Vector Search**: Semantic similarity using HNSW indexing
- **Graph Relationships**: Complex relationship mapping and traversal  
- **Field Filtering**: Precise metadata filtering with O(1) lookups
- **Unified Queries**: All three intelligence types in a single query

### 🎯 Zero Configuration ✅ Available Now
- **Auto-Detects Environment**: Node.js, Browser, Edge, Deno
- **Auto-Selects Storage**: Best storage for your environment
- **Works Instantly**: No setup required
- **Smart Defaults**: Optimized out of the box

### 🔧 Production Ready ✅ Available Now
- **Universal Storage**: FileSystem, S3, OPFS, Memory
- **MIT License**: No limits, no tiers, truly open source
- **TypeScript Native**: Full type safety and IntelliSense support
- **Cross Platform**: Node.js, Browser, Web Workers, Edge Runtime

### ⚡ High Performance
- **HNSW Indexing**: Sub-millisecond vector search
- **Smart Caching**: Intelligent query optimization
- **Field Indexes**: O(1) metadata lookups
- **Streaming Support**: Handle millions of records efficiently

### 🛠 Developer Experience  
- **Simple API**: Intuitive methods that just work
- **Rich CLI**: Interactive command-line interface
- **Comprehensive Tests**: 400+ tests covering all features
- **Excellent Docs**: Clear examples and API reference

### 🚀 Enterprise Features ✅ Available Now
- **WAL**: Write-ahead logging for durability ✅
- **Entity Registry**: High-performance deduplication ✅
- **Neural Import**: AI-powered entity detection ✅
- **Distributed Modes**: Read-only/Write-only optimization ✅
- **Statistics**: Comprehensive metrics and monitoring ✅
- **3-Level Cache**: Hot/Warm/Cold intelligent caching ✅
- **11+ Augmentations**: Including WebSocket, WebRTC, more ✅

## 📊 Current Status

Brainy 2.0.0 is in active development. Core features are production-ready, with advanced features on the roadmap.

### ✅ Production Ready
- Noun-Verb data model with entity detection
- Triple Intelligence queries with optimizations
- All storage adapters with caching
- Natural language queries (220+ patterns)
- WAL, Entity Registry, and 11+ augmentations
- Distributed read/write modes
- Performance monitoring and statistics

### 🚧 Needs Integration
- Import/Export CLI commands (code exists)
- GPU acceleration (detection works)
- Auto-optimization (metrics collected)
- Active learning (framework exists)

### 📅 Roadmap
See [ROADMAP.md](ROADMAP.md) for upcoming features and timeline.

## 🚀 Quick Start

### Installation

```bash
npm install brainy
```

### Basic Usage

```typescript
import { BrainyData } from 'brainy'

// Initialize with zero configuration
const brain = new BrainyData()
await brain.init()

// Add entities (nouns) with automatic embedding generation
await brain.addNoun("The quick brown fox jumps over the lazy dog", {
  category: "animals", 
  mood: "playful",
  timestamp: Date.now()
})

await brain.addNoun("Machine learning transforms how we process information", {
  category: "technology",
  mood: "analytical", 
  timestamp: Date.now()
})

// Triple Intelligence: Vector + Graph + Field in one query
const results = await brain.search("animals running fast", {
  where: {
    category: "animals",
    timestamp: { $gte: Date.now() - 86400000 } // last 24 hours
  },
  limit: 10
})

console.log(results)
// [{ id: "...", content: "The quick brown fox...", score: 0.92, metadata: {...} }]
```

## 🤖 Model Loading (AI Embeddings)

Brainy uses AI embedding models to understand and process your data semantically. **Zero configuration required** - models load automatically.

### ✅ Zero Configuration (Recommended)
```typescript
const brain = new BrainyData()
await brain.init() // Models download automatically on first use
```

**What happens automatically:**
1. Checks for local models in `./models/`
2. Downloads All-MiniLM-L6-v2 (384 dimensions) if needed
3. Uses intelligent cascade: Local → CDN → GitHub → HuggingFace
4. Ready to use immediately

### 🐳 Production/Docker Setup
```dockerfile
# Pre-download models during build (recommended)
RUN npm run download-models

# Optional: Force local-only mode  
ENV BRAINY_ALLOW_REMOTE_MODELS=false
```

### 🔒 Offline/Air-Gapped Environments
```bash
# On connected machine
npm run download-models

# Copy models to offline machine
cp -r ./models /path/to/offline/project/

# Force local-only mode
export BRAINY_ALLOW_REMOTE_MODELS=false
```

### 📋 Environment Variables (Optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `BRAINY_ALLOW_REMOTE_MODELS` | `true` | Allow/block model downloads |
| `BRAINY_MODELS_PATH` | `./models` | Custom model storage path |

### 🚨 Troubleshooting
- **"Failed to load embedding model"** → Run `npm run download-models`
- **Slow model downloads** → Pre-download during build/CI
- **Container memory issues** → Pre-download models, increase memory limit

📚 **Complete Guide**: [docs/guides/model-loading.md](docs/guides/model-loading.md)

## 📊 Triple Intelligence in Action

### Vector Similarity
```typescript
// Semantic search across your data
const results = await brain.search("fast animals")
// Finds: "quick brown fox", "racing horses", "cheetah running"
```

### Graph Relationships  
```typescript
// Find related entities and concepts
const related = await brain.findRelated(entityId, {
  depth: 2,
  relationship: "semantic"
})
```

### Field Filtering
```typescript
// Precise metadata filtering with O(1) performance
const filtered = await brain.search("technology", {
  where: {
    category: "ai",
    rating: { $gte: 4.5 },
    published: { $between: ["2024-01-01", "2024-12-31"] }
  }
})
```

### Combined Intelligence
```typescript
// All three intelligence types working together
const results = await brain.search("machine learning concepts", {
  where: {
    category: { $in: ["ai", "technology"] },
    difficulty: { $lte: 5 }
  },
  includeRelated: true,
  depth: 2
})
```

## 🗄️ Storage Adapters

Brainy supports multiple storage backends with the same API:

### File System (Default)
```typescript
const brain = new BrainyData({
  storage: { type: 'filesystem', path: './data' }
})
```

### Amazon S3 / Compatible
```typescript
const brain = new BrainyData({
  storage: {
    type: 's3',
    bucket: 'my-brainy-data',
    region: 'us-east-1'
  }
})
```

### Origin Private File System (Browser)
```typescript
const brain = new BrainyData({
  storage: { type: 'opfs' }
})
```

### Memory (Development)
```typescript
const brain = new BrainyData({
  storage: { type: 'memory' }
})
```

## 🎯 Advanced Querying with find()

### Triple Intelligence find() Method
```typescript
// Natural language queries with automatic intent recognition
const results = await brain.find("show me recent AI articles with high ratings")
// Automatically converts to: vector similarity + field filtering + date ranges

// MongoDB-style queries with semantic awareness
const results = await brain.find({
  $or: [
    { category: "technology" },
    { $vector: { $similar: "artificial intelligence", threshold: 0.8 } }
  ],
  metadata: {
    published: { $gte: "2024-01-01" },
    rating: { $in: [4, 5] }
  }
})
```

### Natural Language Understanding ✅ Available (Basic)
```typescript
// The find() method understands natural language queries
const results = await brain.find("technology articles about machine learning")
// Basic pattern matching for common queries

// Temporal queries (basic support)
const recent = await brain.find("recent documents")
// Recognizes common time expressions

// The search() method focuses on semantic similarity
const similar = await brain.search("documents similar to machine learning research")
// Pure vector similarity search
```

## 🔧 Configuration

### Environment Variables
```bash
BRAINY_STORAGE_TYPE=filesystem
BRAINY_STORAGE_PATH=./brainy-data
BRAINY_MODELS_PATH=./models
BRAINY_VECTOR_DIMENSIONS=384
```

### Programmatic Configuration
```typescript
const brain = new BrainyData({
  storage: {
    type: 'filesystem',
    path: './data'
  },
  vectors: {
    dimensions: 384,
    model: '@huggingface/transformers/all-MiniLM-L6-v2'
  },
  performance: {
    cacheSize: 1000,
    batchSize: 100
  }
})
```

## 📱 CLI Usage

Brainy includes a powerful command-line interface:

```bash
# Initialize a new database
brainy init

# Add entities (nouns)
brainy add-noun "Your content here" --category="example"

# Natural language queries
brainy find "show me examples from last week"

# Search with Triple Intelligence  
brainy search "find similar content" --where='{"category":"example"}'

# Interactive mode with NLP
brainy chat
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:core
npm run test:storage  
npm run test:coverage
```

## 📚 API Reference

### Core Methods

#### `brain.addNoun(content, metadata?)`
Add entities (nouns) with automatic embedding generation.

#### `brain.addVerb(source, target, type, metadata?)`
Create relationships (verbs) between entities.

#### `brain.search(query, options?)`
Triple Intelligence search with vector similarity, field filtering, and relationship traversal.

#### `brain.find(query)`
Advanced Triple Intelligence queries with natural language or structured syntax.
- Accepts natural language: `brain.find("recent posts about AI")`
- Accepts structured queries: `brain.find({ category: "AI", date: { $gte: "2024-01-01" } })`
- Automatically interprets intent, time ranges, and filters

#### `brain.get(id)`
Retrieve specific items by ID.

#### `brain.updateMetadata(id, metadata)`
Update entity metadata.

#### `brain.delete(id)`
Remove items by ID (soft delete by default).

### Advanced Methods

#### `brain.cluster(options?)`
Semantic clustering of your data.

#### `brain.findRelated(id, options?)`
Find semantically or structurally related items.

#### `brain.statistics()`
Get performance and usage statistics.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/brainy-org/brainy.git
cd brainy
npm install
npm run build
npm test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js) for embedding models
- [HNSW](https://github.com/nmslib/hnswlib) for efficient vector indexing
- The open source AI/ML community for inspiration

## 💬 Support

- [GitHub Issues](https://github.com/brainy-org/brainy/issues) - Bug reports and feature requests
- [Discussions](https://github.com/brainy-org/brainy/discussions) - Community support and ideas

---

**Built with ❤️ for the AI community**