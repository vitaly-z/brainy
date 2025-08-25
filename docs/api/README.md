# API Reference

Complete API documentation for Brainy's multi-dimensional AI database.

## Core APIs

### [BrainyData](./brainy-data.md)
The main entry point for all operations.

### [Triple Intelligence](./triple-intelligence.md)
Unified query system for vector, graph, and field search.

### [Storage](./storage.md)
Storage adapter interfaces and implementations.

### [Entity Registry](./entity-registry.md)
High-performance entity deduplication system.

### [Neural API](./neural-api.md)
Natural language processing and similarity operations.

## Quick Reference

### Initialization
```typescript
import { BrainyData } from 'brainy'

const brain = new BrainyData({
  storage: { type: 'filesystem', path: './data' },
  vectors: { dimensions: 384 }
})

await brain.init()
```

### Basic Operations

#### Add Entities (Nouns) and Relationships (Verbs)
```typescript
// Add entities (nouns) with automatic embedding
const id = await brain.addNoun("Machine learning is fascinating", {
  category: "technology",
  timestamp: Date.now()
})

// Add relationships (verbs) between entities
const sourceId = await brain.addNoun("Research Paper")
const targetId = await brain.addNoun("Neural Networks")
await brain.addVerb(sourceId, targetId, "discusses", {
  confidence: 0.95,
  section: "methodology"
})

// Batch operations
const entities = ["Entity 1", "Entity 2", "Entity 3"]
for (const entity of entities) {
  await brain.addNoun(entity, { type: "batch" })
}
```

#### Search and Find
```typescript
// Simple semantic search
const results = await brain.search("AI and machine learning")

// Natural language queries with find()
const nlpResults = await brain.find("research papers about neural networks from 2024")
// Automatically interprets: document type, topic, and time range

// Advanced triple intelligence search with structured query
const structured = await brain.find({
  like: "neural networks",
  where: { category: "research" },
  connected: { to: "team-id", depth: 2 },
  limit: 20
})

// Complex natural language with multiple conditions
const complex = await brain.find("highly cited papers on deep learning with over 100 citations published in Nature")
// Automatically extracts: citation count, topic, publication venue
```

#### Get and Update
```typescript
// Get noun by ID
const noun = await brain.getNoun("noun-id")

// Get verb (relationship) by ID
const verb = await brain.getVerb("verb-id")

// Update noun metadata
await brain.updateNounMetadata("noun-id", {
  verified: true,
  lastModified: Date.now()
})

// Delete noun (soft delete by default)
await brain.deleteNoun("noun-id")

// Delete verb (relationship)
await brain.deleteVerb("verb-id")
```

## Advanced Features

### Augmentations
```typescript
import { 
  WALAugmentation,
  EntityRegistryAugmentation,
  BatchProcessingAugmentation 
} from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new WALAugmentation(),
    new EntityRegistryAugmentation({ maxCacheSize: 100000 }),
    new BatchProcessingAugmentation({ batchSize: 100 })
  ]
})
```

### Event System
```typescript
brain.on('addNoun', (noun) => {
  console.log('Noun added:', noun.id)
})

brain.on('addVerb', (verb) => {
  console.log('Relationship created:', verb.type)
})

brain.on('search', (query, results) => {
  console.log(`Search for "${query}" returned ${results.length} results`)
})

brain.on('error', (error) => {
  console.error('Error occurred:', error)
})
```

### Statistics
```typescript
const stats = await brain.statistics()
console.log(`
  Total items: ${stats.totalItems}
  Index size: ${stats.indexSize}
  Average query time: ${stats.avgQueryTime}ms
`)
```

## Type Definitions

### Core Types
```typescript
interface SearchResult {
  id: string
  score: number
  content?: string
  metadata?: Record<string, any>
}

interface TripleQuery {
  like?: string | Vector | any
  where?: Record<string, any>
  connected?: ConnectionQuery
  limit?: number
  threshold?: number
}

interface Vector {
  values: number[]
  dimensions: number
}
```

## Error Handling

All methods follow consistent error handling:

```typescript
try {
  await brain.addNoun("content", metadata)
} catch (error) {
  if (error.code === 'STORAGE_ERROR') {
    // Handle storage issues
  } else if (error.code === 'VALIDATION_ERROR') {
    // Handle validation issues
  }
}
```

## Performance Guidelines

### Batching
Always use batch operations for bulk data:
```typescript
// Good - efficient batch processing
const items = ["item1", "item2", "item3"]
for (const item of items) {
  await brain.addNoun(item, { batch: true })
}

// For relationships
const relationships = [
  { source: id1, target: id2, type: "related" },
  { source: id2, target: id3, type: "similar" }
]
for (const rel of relationships) {
  await brain.addVerb(rel.source, rel.target, rel.type)
}
```

### Caching
Configure caching for your use case:
```typescript
const brain = new BrainyData({
  cache: {
    search: { maxSize: 100, ttl: 60000 },
    metadata: { maxSize: 1000, ttl: 300000 }
  }
})
```

### Indexing
Ensure fields used in queries are indexed:
```typescript
// Configure indexed fields
const brain = new BrainyData({
  indexedFields: ['category', 'author', 'timestamp']
})
```

## Migration from v1.x

See the [Migration Guide](../MIGRATION.md) for upgrading from Brainy 1.x to 2.0.