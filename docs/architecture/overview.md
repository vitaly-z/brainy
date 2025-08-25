# Architecture Overview

Brainy is a multi-dimensional AI database that combines vector similarity, graph relationships, and metadata filtering into a unified query system. This document provides a comprehensive overview of the system architecture.

## Core Components

### BrainyData (Main Entry Point)
The central orchestrator that manages all subsystems:
- **HNSW Index**: O(log n) vector similarity search
- **Storage System**: Universal storage adapters (FileSystem, S3, OPFS, Memory)
- **Metadata Index**: O(1) field lookups with inverted indexing
- **Augmentation System**: Extensible plugin architecture
- **Triple Intelligence**: Unified query engine

### Triple Intelligence Engine
Brainy's revolutionary feature that unifies three types of search:
- **Vector Search**: Semantic similarity using HNSW indexing
- **Graph Traversal**: Relationship-based queries
- **Field Filtering**: Precise metadata filtering with O(1) performance

```typescript
// Single query combining all three intelligence types
const results = await brain.find({
  like: "machine learning papers",              // Vector similarity
  connected: { to: "research-team", depth: 2 }, // Graph traversal  
  where: { published: { $gte: "2024-01-01" } }  // Metadata filtering
})
```

### Storage Architecture

```
brainy-data/
├── _system/           # System management
│   └── statistics.json
├── nouns/            # Entity data storage
│   └── {uuid}.json
├── metadata/         # Metadata and indexing
│   ├── {uuid}.json
│   ├── __entity_registry__.json
│   └── __metadata_index__*.json
├── verbs/            # Relationship storage
├── wal/              # Write-Ahead Logging
└── locks/            # Concurrent access control
```

### HNSW Index
Hierarchical Navigable Small World index for efficient vector search:
- **Performance**: O(log n) search complexity
- **Memory Efficient**: Product quantization support
- **Scalable**: Handles millions of vectors
- **Persistent**: Serializable to storage

### Metadata Index Manager
High-performance field indexing system:
- **O(1) Lookups**: Inverted index for field→value→IDs mapping
- **Query Support**: equals, anyOf, allOf, range queries
- **Chunked Storage**: Supports massive datasets
- **Auto-indexing**: Automatically maintains indexes on updates

## Performance Characteristics

### Operation Complexity
- **Vector Search**: O(log n) via HNSW
- **Field Filtering**: O(1) via inverted indexes
- **Graph Traversal**: O(V + E) for breadth-first search
- **Add Operation**: O(log n) for index insertion
- **Update Operation**: O(1) for metadata updates

### Memory Usage
- **Base Memory**: ~50MB for core system
- **Per Vector**: ~1KB (384 dimensions × 4 bytes)
- **Index Overhead**: ~20% of vector data
- **Cache Size**: Configurable (default 1000 entries)

### Throughput
- **Writes**: 1000+ ops/second (with batching)
- **Reads**: 10,000+ ops/second
- **Search**: 100+ queries/second (varies by complexity)

## Augmentation System

Brainy's extensible plugin architecture allows for powerful enhancements:

### Core Augmentations
- **WAL (Write-Ahead Logging)**: Durability and crash recovery
- **Entity Registry**: High-speed deduplication for streaming data
- **Batch Processing**: Optimized bulk operations
- **Connection Pool**: Efficient resource management
- **Request Deduplicator**: Prevents duplicate processing

### Creating Custom Augmentations
```typescript
class CustomAugmentation extends BrainyAugmentation {
  async onInit(brain: BrainyData): Promise<void> {
    // Initialize augmentation
  }
  
  async onAdd(item: any, brain: BrainyData): Promise<any> {
    // Process item before adding
    return item
  }
}
```

## Caching Strategy

Multi-layered caching for optimal performance:
- **Search Cache**: LRU cache for query results
- **Metadata Cache**: Field index caching
- **Pattern Cache**: NLP pattern matching cache
- **Entity Cache**: In-memory entity registry

## Integration Points

### Key Objects for Extensions
- `brain.index`: Access HNSW vector index
- `brain.metadataIndex`: Access field indexing
- `brain.storage`: Access storage layer
- `brain.augmentations`: Access augmentation manager

### Event System
```typescript
brain.on('add', (item) => console.log('Item added:', item))
brain.on('search', (query) => console.log('Search performed:', query))
brain.on('error', (error) => console.error('Error:', error))
```

## Best Practices

### When Adding Features
1. Check if similar functionality exists
2. Consider if it should be an augmentation
3. Use existing indexes and caches
4. Avoid duplicating functionality
5. Follow the established patterns

### Performance Optimization
1. Use batch operations for bulk data
2. Enable appropriate caching
3. Choose the right storage adapter
4. Configure index parameters for your use case
5. Monitor statistics for bottlenecks

## Next Steps

- [Storage Architecture](./storage-architecture.md) - Deep dive into storage system
- [Triple Intelligence](./triple-intelligence.md) - Advanced query system
- [API Reference](../api/README.md) - Complete API documentation