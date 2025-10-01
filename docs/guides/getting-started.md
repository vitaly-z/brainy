# Getting Started with Brainy

This guide will help you get up and running with Brainy, the multi-dimensional AI database that combines vector similarity, graph relationships, and metadata filtering.

## Installation

```bash
npm install @soulcraft/brainy
```

## Basic Setup

### Simple Initialization

```typescript
import { Brainy } from '@soulcraft/brainy'

// Create a new Brainy instance with defaults
const brain = new Brainy()

// Initialize (downloads models if needed)
await brain.init()

// You're ready to go!
```

### Custom Configuration

```typescript
const brain = new Brainy({
  // Storage configuration
  storage: {
    type: 'filesystem',  // or 's3', 'opfs', 'memory'
    path: './my-data'
  },
  
  // Vector configuration
  vectors: {
    dimensions: 384,
    model: 'all-MiniLM-L6-v2'
  },
  
  // Performance tuning
  cache: {
    enabled: true,
    maxSize: 1000
  }
})

await brain.init()
```

## Your First Operations

### Adding Data

```typescript
// Add entities (nouns) with automatic embedding generation
const id = await brain.add("The quick brown fox jumps over the lazy dog", {
  category: "demo",
  timestamp: Date.now()
})

console.log(`Added noun with ID: ${id}`)

// Add relationships (verbs) between entities
const sourceId = await brain.add("John Smith", { nounType: 'person' })
const targetId = await brain.add("TechCorp", { nounType: 'organization' })
await brain.relate(sourceId, targetId, "works_at", {
  position: "Engineer",
  since: "2024"
})
```

### Searching

```typescript
// Simple semantic search
const results = await brain.search("fast animals")

results.forEach(result => {
  console.log(`Found: ${result.content} (score: ${result.score})`)
})
```

### Advanced Queries with find()

```typescript
// Natural language queries - Brainy understands intent!
const results = await brain.find("show me technology articles about AI from 2023")
// Automatically interprets: topic, category, and time range

// Structured queries with vector similarity and metadata filtering
const structured = await brain.find({
  like: "artificial intelligence",
  where: {
    category: "technology",
    year: { $gte: 2023 }
  },
  limit: 10
})

// Complex natural language with multiple filters
const complex = await brain.find("financial reports from Q3 2024 with revenue over 1M")
// Automatically extracts: document type, date range, numeric filters
```

## Common Use Cases

### 1. Semantic Search Engine

```typescript
// Index documents
const documents = [
  { title: "Introduction to AI", content: "AI is transforming..." },
  { title: "Machine Learning Basics", content: "ML algorithms..." },
  { title: "Deep Learning", content: "Neural networks..." }
]

for (const doc of documents) {
  await brain.add(doc.content, {
    title: doc.title,
    type: "document"
  })
}

// Search semantically
const results = await brain.search("how do neural networks work")
```

### 2. Recommendation System

```typescript
// Add user interactions as nouns
const interactionId = await brain.add("user viewed product", {
  userId: "user123",
  productId: "product456",
  action: "view",
  timestamp: Date.now()
})

// Create relationships between users and products
const userId = await brain.add("user123", { nounType: 'user' })
const productId = await brain.add("product456", { nounType: 'product' })
await brain.relate(userId, productId, "viewed", {
  timestamp: Date.now()
})

// Natural language query for recommendations
const recommendations = await brain.find("products similar to what user123 viewed recently")

// Or structured query for similar users
const similar = await brain.find({
  like: "user123 interests",
  where: { action: "view" },
  limit: 5
})
```

### 3. Knowledge Graph

```typescript
// Add entities (nouns) to the knowledge graph
const personId = await brain.add("John Smith, Software Engineer", {
  type: "person",
  role: "engineer"
})

const companyId = await brain.add("TechCorp, Innovation Leader", {
  type: "company",
  industry: "technology"
})

// Create relationship
await brain.relate(personId, companyId, "works_at", {
  since: "2020",
  position: "Senior Engineer"
})

// Natural language query for relationships
const colleagues = await brain.find("people who work at TechCorp")

// Or structured query for specific relationships
const results = await brain.find({
  connected: {
    from: personId,
    type: "works_at"
  }
})
```

### 4. Real-time Data Processing

```typescript
// Configure for streaming
const brain = new Brainy({
  augmentations: [
    new EntityRegistryAugmentation(),  // Deduplication
    new BatchProcessingAugmentation({ batchSize: 100 })  // Batching
  ]
})

// Process streaming data
async function processStream(item) {
  // Entity registry prevents duplicate nouns
  const id = await brain.add(item.content, {
    externalId: item.id,
    timestamp: item.timestamp
  })
  
  // Real-time natural language queries
  if (item.urgent) {
    const related = await brain.find(`urgent items similar to ${item.content}`)
    // Process related items...
  }
}
```

## Storage Options

### Development (Memory)
```typescript
const brain = new Brainy({
  storage: { type: 'memory' }
})
// Fast, temporary, perfect for testing
```

### Production (FileSystem)
```typescript
const brain = new Brainy({
  storage: {
    type: 'filesystem',
    path: '/var/lib/brainy'
  }
})
// Persistent, efficient, server-ready
```

### Cloud (S3)
```typescript
const brain = new Brainy({
  storage: {
    type: 's3',
    bucket: 'my-brainy-data',
    region: 'us-east-1'
  }
})
// Scalable, distributed, cloud-native
```

### Browser (OPFS)
```typescript
const brain = new Brainy({
  storage: { type: 'opfs' }
})
// Browser-native, persistent, offline-capable
```

## Performance Tips

### 1. Use Batch Operations
```typescript
// Good - batch operations for nouns
const items = ["item1", "item2", "item3"]
for (const item of items) {
  await brain.add(item, { batch: true })
}

// Create relationships efficiently
const relationships = [
  { source: id1, target: id2, type: "related" },
  { source: id2, target: id3, type: "similar" }
]
for (const rel of relationships) {
  await brain.relate(rel.source, rel.target, rel.type)
}
```

### 2. Enable Caching
```typescript
const brain = new Brainy({
  cache: {
    enabled: true,
    maxSize: 1000,
    ttl: 300000  // 5 minutes
  }
})
```

### 3. Use Appropriate Limits
```typescript
// Always specify reasonable limits
const results = await brain.search("query", {
  limit: 20  // Don't fetch more than needed
})
```

### 4. Index Frequently Queried Fields
```typescript
const brain = new Brainy({
  indexedFields: ['category', 'userId', 'timestamp']
})
```

## Error Handling

```typescript
try {
  await brain.add("content", metadata)
} catch (error) {
  if (error.code === 'STORAGE_FULL') {
    console.error('Storage is full')
  } else if (error.code === 'INVALID_INPUT') {
    console.error('Invalid input:', error.message)
  } else {
    console.error('Unexpected error:', error)
  }
}
```

## Next Steps

- [Architecture Overview](../architecture/overview.md) - Understand the system design
- [Triple Intelligence](../architecture/triple-intelligence.md) - Advanced query capabilities
- [API Reference](../api/README.md) - Complete API documentation
- [Examples](https://github.com/brainy-org/brainy/tree/main/examples) - More code examples

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/brainy-org/brainy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/brainy-org/brainy/discussions)
- **Examples**: Check the `/examples` directory