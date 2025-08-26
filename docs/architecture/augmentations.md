# Augmentations System

## Overview

Brainy's Augmentation System provides a powerful plugin architecture that extends core functionality without modifying the base code. Augmentations can intercept, modify, and enhance any operation in the database.

## Built-in Augmentations

> **Note**: This document shows both available and planned augmentations. Each section is marked with its current status.

### 1. Entity Registry Augmentation ✅ Available

High-performance deduplication for streaming data ingestion.

```typescript
import { EntityRegistryAugmentation } from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new EntityRegistryAugmentation({
      maxCacheSize: 100000,      // Track up to 100k unique entities
      ttl: 3600000,              // 1-hour TTL for cache entries
      hashFields: ['id', 'url']  // Fields to use for deduplication
    })
  ]
})

// Automatically prevents duplicate entities
await brain.addNoun("Same content", { id: "123" }) // Added
await brain.addNoun("Same content", { id: "123" }) // Skipped (duplicate)
```

**Benefits:**
- O(1) duplicate detection using bloom filters
- Configurable cache size and TTL
- Custom hash field selection
- Perfect for real-time data streams

### 2. WAL (Write-Ahead Logging) Augmentation ✅ Available

Enterprise-grade durability and crash recovery.

```typescript
import { WALAugmentation } from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new WALAugmentation({
      walPath: './wal',          // WAL directory
      checkpointInterval: 1000,  // Checkpoint every 1000 operations
      compression: true,          // Enable log compression
      maxLogSize: 100 * 1024 * 1024  // 100MB max log size
    })
  ]
})

// All operations are now durably logged
await brain.addNoun("Critical data")  // Written to WAL before storage

// Recover from crash
const recovered = new BrainyData({ 
  augmentations: [new WALAugmentation({ recover: true })]
})
await recovered.init()  // Automatically replays WAL
```

**Features:**
- ACID compliance
- Automatic crash recovery
- Point-in-time recovery
- Log compression and rotation
- Minimal performance impact

### 3. Intelligent Verb Scoring Augmentation ✅ Available

AI-powered relationship strength calculation.

```typescript
import { IntelligentVerbScoringAugmentation } from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new IntelligentVerbScoringAugmentation({
      factors: {
        semantic: 0.4,    // Weight for semantic similarity
        temporal: 0.3,    // Weight for time proximity
        frequency: 0.2,   // Weight for interaction frequency
        explicit: 0.1     // Weight for explicit ratings
      }
    })
  ]
})

// Relationships automatically get intelligent scores
await brain.addVerb(user1, product1, "viewed", { timestamp: Date.now() })
await brain.addVerb(user1, product1, "purchased", { timestamp: Date.now() })
// Automatically calculates relationship strength based on multiple factors

// Query using intelligent scores
const strongRelationships = await brain.find({
  connected: {
    from: user1,
    minScore: 0.8  // Only highly relevant relationships
  }
})
```

**Capabilities:**
- Multi-factor relationship scoring
- Temporal decay functions
- Semantic similarity integration
- Customizable weight factors

### 4. Auto-Register Entities Augmentation ⚠️ Basic Implementation

Automatically extracts and registers entities from text.

```typescript
import { AutoRegisterEntitiesAugmentation } from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new AutoRegisterEntitiesAugmentation({
      types: ['person', 'organization', 'location', 'product'],
      confidence: 0.8,
      createRelationships: true
    })
  ]
})

// Automatically extracts and registers entities
await brain.addNoun(
  "Apple CEO Tim Cook announced the new iPhone 15 in Cupertino",
  { type: "news" }
)
// Automatically creates:
// - Noun: "Tim Cook" (person)
// - Noun: "Apple" (organization)
// - Noun: "iPhone 15" (product)
// - Noun: "Cupertino" (location)
// - Verbs: relationships between entities
```

**Features:**
- NER (Named Entity Recognition)
- Automatic relationship inference
- Configurable entity types
- Confidence thresholds

### 5. Batch Processing Augmentation ✅ Available

Optimizes bulk operations for maximum throughput.

```typescript
import { BatchProcessingAugmentation } from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new BatchProcessingAugmentation({
      batchSize: 100,
      flushInterval: 1000,  // Flush every second
      parallel: true,        // Parallel processing
      maxQueueSize: 10000
    })
  ]
})

// Operations are automatically batched
for (let i = 0; i < 10000; i++) {
  await brain.addNoun(`Item ${i}`)  // Internally batched
}
// Processes in optimized batches of 100
```

**Benefits:**
- 10-100x throughput improvement
- Automatic batching
- Configurable batch sizes
- Memory-efficient queue management

### 6. Caching Augmentation 🚧 Coming Soon

Intelligent multi-level caching system.

```typescript
import { CachingAugmentation } from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new CachingAugmentation({
      levels: {
        l1: { size: 100, ttl: 60000 },      // Hot cache: 100 items, 1 min
        l2: { size: 1000, ttl: 300000 },    // Warm cache: 1000 items, 5 min
        l3: { size: 10000, ttl: 3600000 }   // Cold cache: 10k items, 1 hour
      },
      strategies: ['lru', 'lfu'],  // Least Recently/Frequently Used
      preload: true                 // Preload popular items
    })
  ]
})

// Queries automatically use cache
const results = await brain.find("popular query")  // Cached
const again = await brain.find("popular query")    // From cache (instant)
```

**Features:**
- Multi-level cache hierarchy
- Multiple eviction strategies
- Query result caching
- Embedding cache
- Automatic cache invalidation

### 7. Compression Augmentation 🚧 Coming Soon

Reduces storage size while maintaining query performance.

```typescript
import { CompressionAugmentation } from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new CompressionAugmentation({
      algorithm: 'brotli',
      level: 6,  // Compression level (1-11)
      threshold: 1024,  // Only compress items > 1KB
      excludeFields: ['id', 'type']  // Don't compress these
    })
  ]
})

// Data automatically compressed/decompressed
await brain.addNoun(largeDocument)  // Compressed before storage
const doc = await brain.getNoun(id)  // Decompressed on retrieval
```

**Benefits:**
- 60-80% storage reduction
- Transparent compression
- Selective field compression
- Multiple algorithm support

### 8. Monitoring Augmentation 🚧 Coming Soon

Real-time performance monitoring and metrics.

```typescript
import { MonitoringAugmentation } from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new MonitoringAugmentation({
      metrics: ['operations', 'latency', 'cache', 'memory'],
      interval: 5000,  // Report every 5 seconds
      webhook: 'https://metrics.example.com/brainy',
      console: true  // Also log to console
    })
  ]
})

// Automatic metric collection
brain.on('metrics', (metrics) => {
  console.log(`
    Operations/sec: ${metrics.opsPerSecond}
    Avg latency: ${metrics.avgLatency}ms
    Cache hit rate: ${metrics.cacheHitRate}%
    Memory usage: ${metrics.memoryMB}MB
  `)
})
```

**Metrics:**
- Operation throughput
- Query latency percentiles
- Cache hit rates
- Memory usage
- Storage growth
- Error rates

## Neural Import Capabilities 🚧 Coming Soon

> **Note**: Import/Export features are currently in development. Expected Q1 2025.

### 1. Document Import with Auto-Structuring

```typescript
import { NeuralImportAugmentation } from 'brainy'

const brain = new BrainyData({
  augmentations: [
    new NeuralImportAugmentation({
      autoStructure: true,
      extractEntities: true,
      generateSummaries: true,
      detectLanguage: true
    })
  ]
})

// Import unstructured documents
await brain.importDocument('./research-paper.pdf')
// Automatically:
// - Extracts text and metadata
// - Identifies sections and structure
// - Extracts entities and concepts
// - Generates embeddings per section
// - Creates relationship graph
```

### 2. Database Migration Import

```typescript
// Import from existing databases
await brain.importFromSQL({
  connection: 'postgres://localhost/mydb',
  tables: {
    users: { type: 'person', idField: 'user_id' },
    products: { type: 'product', idField: 'sku' },
    orders: { 
      type: 'relationship',
      from: 'user_id',
      to: 'product_id',
      verb: 'purchased'
    }
  }
})

// Import from MongoDB
await brain.importFromMongo({
  uri: 'mongodb://localhost:27017',
  database: 'myapp',
  collections: {
    users: { type: 'person' },
    posts: { type: 'content' }
  }
})
```

### 3. Stream Import

```typescript
// Import from real-time streams
await brain.importStream({
  source: 'kafka://localhost:9092/events',
  format: 'json',
  transform: (event) => ({
    noun: event.data,
    metadata: {
      type: event.type,
      timestamp: event.timestamp
    }
  }),
  deduplication: true
})
```

### 4. Bulk CSV/JSON Import

```typescript
// Import CSV with automatic type detection
await brain.importCSV('./data.csv', {
  headers: true,
  typeColumn: 'entity_type',
  detectRelationships: true,
  batchSize: 1000
})

// Import JSON with nested structure handling
await brain.importJSON('./data.json', {
  rootPath: '$.entities',
  nounPath: '$.content',
  metadataPath: '$.properties',
  relationshipPath: '$.connections'
})
```

## Creating Custom Augmentations

```typescript
import { Augmentation } from 'brainy'

class CustomAugmentation extends Augmentation {
  name = 'CustomAugmentation'
  
  async onInit(brain: BrainyData): Promise<void> {
    // Initialize augmentation
    console.log('Custom augmentation initialized')
  }
  
  async onBeforeAddNoun(content: any, metadata: any): Promise<[any, any]> {
    // Modify before adding noun
    metadata.processed = true
    metadata.timestamp = Date.now()
    return [content, metadata]
  }
  
  async onAfterAddNoun(id: string, noun: any): Promise<void> {
    // React to noun addition
    console.log(`Noun ${id} added`)
  }
  
  async onBeforeSearch(query: any): Promise<any> {
    // Modify search query
    query.boost = 'recent'
    return query
  }
  
  async onAfterSearch(results: any[]): Promise<any[]> {
    // Process search results
    return results.map(r => ({
      ...r,
      customScore: r.score * 1.5
    }))
  }
}

// Use custom augmentation
const brain = new BrainyData({
  augmentations: [new CustomAugmentation()]
})
```

## Augmentation Lifecycle Hooks

### Available Hooks

```typescript
interface AugmentationHooks {
  // Initialization
  onInit(brain: BrainyData): Promise<void>
  onShutdown(): Promise<void>
  
  // Noun operations
  onBeforeAddNoun(content, metadata): Promise<[content, metadata]>
  onAfterAddNoun(id, noun): Promise<void>
  onBeforeGetNoun(id): Promise<string>
  onAfterGetNoun(noun): Promise<any>
  onBeforeUpdateNoun(id, updates): Promise<[string, any]>
  onAfterUpdateNoun(id, noun): Promise<void>
  onBeforeDeleteNoun(id): Promise<string>
  onAfterDeleteNoun(id): Promise<void>
  
  // Verb operations
  onBeforeAddVerb(source, target, type, metadata): Promise<[any, any, string, any]>
  onAfterAddVerb(id, verb): Promise<void>
  onBeforeGetVerb(id): Promise<string>
  onAfterGetVerb(verb): Promise<any>
  
  // Search operations
  onBeforeSearch(query): Promise<any>
  onAfterSearch(results): Promise<any[]>
  onBeforeFind(query): Promise<any>
  onAfterFind(results): Promise<any[]>
  
  // Storage operations
  onBeforeSave(data): Promise<any>
  onAfterLoad(data): Promise<any>
  
  // Events
  onError(error): Promise<void>
  onMetric(metric): Promise<void>
}
```

## Augmentation Composition

```typescript
// Combine multiple augmentations
const brain = new BrainyData({
  augmentations: [
    // Order matters - executed in sequence
    new EntityRegistryAugmentation(),    // Deduplication first
    new AutoRegisterEntitiesAugmentation(), // Entity extraction
    new IntelligentVerbScoringAugmentation(), // Scoring
    new CompressionAugmentation(),       // Compression
    new CachingAugmentation(),          // Caching
    new WALAugmentation(),              // Durability
    new MonitoringAugmentation()        // Monitoring last
  ]
})
```

## Performance Considerations

1. **Order Matters**: Place filtering augmentations early
2. **Resource Usage**: Monitor memory with many augmentations
3. **Async Operations**: Use parallel processing where possible
4. **Caching**: Enable caching augmentation for read-heavy workloads

## Best Practices

1. **Single Responsibility**: Each augmentation should do one thing well
2. **Non-Blocking**: Avoid blocking operations in hooks
3. **Error Handling**: Always handle errors gracefully
4. **Configuration**: Make augmentations configurable
5. **Documentation**: Document augmentation behavior and options

## See Also

- [Architecture Overview](./overview.md)
- [API Reference](../api/README.md)
- [Performance Guide](../guides/performance.md)