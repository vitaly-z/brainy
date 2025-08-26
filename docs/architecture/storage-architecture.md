# Storage Architecture

Brainy implements a sophisticated, unified storage system that works across all environments (Node.js, Browser, Edge Workers) with enterprise-grade features like metadata indexing, entity registry, and write-ahead logging.

## Storage Structure

```
brainy-data/
├── _system/                        # System management
│   └── statistics.json            # Performance metrics and statistics
├── nouns/                         # Primary entity storage
│   └── {uuid}.json               # Individual entity documents
├── metadata/                      # Metadata and indexing system
│   ├── {uuid}.json               # Entity metadata
│   ├── __entity_registry__.json  # Entity deduplication registry
│   ├── __metadata_field_index__field_{field}.json    # Field discovery
│   └── __metadata_index__{field}_{value}_chunk{n}.json # Value indexes
├── verbs/                         # Relationship/action storage
│   └── {uuid}.json               # Relationship documents
├── wal/                          # Write-Ahead Logging
│   └── wal_{timestamp}_{id}.wal # Transaction logs
└── locks/                        # Concurrent access control
    └── {resource}.lock          # Resource locks
```

## Storage Adapters

Brainy provides multiple storage adapters with identical APIs:

### FileSystem Storage (Node.js)
```typescript
const brain = new BrainyData({
  storage: {
    type: 'filesystem',
    path: './data'
  }
})
```
- **Use case**: Server applications, CLI tools
- **Performance**: Direct file I/O
- **Persistence**: Permanent on disk

### S3 Compatible Storage
```typescript
const brain = new BrainyData({
  storage: {
    type: 's3',
    bucket: 'my-brainy-data',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
})
```
- **Use case**: Distributed applications, cloud deployments
- **Performance**: Network dependent, with intelligent caching
- **Persistence**: Cloud storage durability

### Origin Private File System (Browser)
```typescript
const brain = new BrainyData({
  storage: {
    type: 'opfs'
  }
})
```
- **Use case**: Browser applications, PWAs
- **Performance**: Near-native file system speed
- **Persistence**: Permanent in browser (with quota limits)

### Memory Storage
```typescript
const brain = new BrainyData({
  storage: {
    type: 'memory'
  }
})
```
- **Use case**: Testing, temporary processing
- **Performance**: Fastest possible
- **Persistence**: Volatile (lost on restart)

## Metadata Indexing System

### Field Discovery Index
Tracks all unique values for each field:

```json
// __metadata_field_index__field_category.json
{
  "values": {
    "technology": 45,
    "science": 32,
    "business": 28
  },
  "lastUpdated": 1699564234567
}
```

### Value-Based Indexes
Maps field+value combinations to entity IDs:

```json
// __metadata_index__category_technology_chunk0.json
{
  "field": "category",
  "value": "technology",
  "ids": ["uuid1", "uuid2", "uuid3", ...],
  "chunk": 0,
  "total": 45
}
```

### Index Chunking
Large indexes automatically chunk for performance:
- **Chunk size**: 10,000 IDs per chunk
- **Auto-splitting**: Transparent to queries
- **Parallel loading**: Chunks load on demand

## Entity Registry

High-performance deduplication system for streaming data:

### Registry Structure
```json
// __entity_registry__.json
{
  "mappings": {
    "did:plc:alice123": "550e8400-e29b-41d4-a716-446655440000",
    "handle:alice.bsky.social": "550e8400-e29b-41d4-a716-446655440000"
  },
  "stats": {
    "totalMappings": 10000,
    "lastSync": 1699564234567
  }
}
```

### Performance Characteristics
- **Lookup**: O(1) in-memory hash map
- **Persistence**: Configurable (memory/storage/hybrid)
- **Cache**: LRU with configurable TTL
- **Sync**: Periodic or on-demand

## Write-Ahead Logging (WAL)

Ensures durability and enables recovery:

### WAL Entry Format
```json
{
  "timestamp": 1699564234567,
  "operation": "add",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "content": "...",
    "metadata": {}
  },
  "checksum": "sha256:..."
}
```

### Recovery Process
1. On startup, check for WAL files
2. Replay operations from last checkpoint
3. Verify checksums for integrity
4. Clean up processed WAL files

## Storage Optimization

### Compression
- **JSON**: Automatic minification
- **Vectors**: Float32 to Uint8 quantization option
- **Indexes**: Binary format for large datasets

### Caching Strategy
```typescript
// Configure caching per storage type
const brain = new BrainyData({
  storage: {
    type: 'filesystem',
    cache: {
      enabled: true,
      maxSize: 1000,      // Maximum cached items
      ttl: 300000,        // 5 minutes
      strategy: 'lru'     // Least recently used
    }
  }
})
```

### Batch Operations
```typescript
// Batch writes for performance
await brain.addBatch([
  { content: "item1", metadata: {} },
  { content: "item2", metadata: {} },
  { content: "item3", metadata: {} }
])
// Single transaction, optimized I/O
```

## Concurrent Access

### Locking Mechanism
```typescript
// Automatic locking for write operations
await brain.storage.withLock('resource-id', async () => {
  // Exclusive access to resource
  await brain.storage.saveNoun(id, data)
})
```

### Read-Write Separation
- **Reads**: Non-blocking, parallel
- **Writes**: Serialized with locks
- **Hybrid**: Read-heavy optimization

## Migration and Backup

### Export Data
```typescript
// Export entire database
const backup = await brain.export({
  format: 'json',
  includeVectors: true,
  includeIndexes: false
})
```

### Import Data
```typescript
// Import from backup
await brain.import(backup, {
  mode: 'merge',  // or 'replace'
  validateSchema: true
})
```

### Storage Migration
```typescript
// Migrate between storage types
const oldBrain = new BrainyData({ storage: { type: 'filesystem' } })
const newBrain = new BrainyData({ storage: { type: 's3' } })

await oldBrain.init()
await newBrain.init()

// Transfer all data
const data = await oldBrain.export()
await newBrain.import(data)
```

## Performance Tuning

### Storage-Specific Optimizations

#### FileSystem
- **Directory sharding**: Split files across subdirectories
- **Async I/O**: Non-blocking file operations
- **Buffer pooling**: Reuse buffers for efficiency

#### S3
- **Multipart uploads**: For large objects
- **Request batching**: Combine small operations
- **CDN integration**: Edge caching for reads

#### OPFS
- **Quota management**: Monitor and request increases
- **Worker offloading**: Heavy operations in workers
- **Transaction batching**: Group operations

### Monitoring

```typescript
// Get storage statistics
const stats = await brain.storage.getStatistics()
console.log(stats)
// {
//   totalSize: 1048576,
//   entityCount: 1000,
//   indexSize: 204800,
//   walSize: 10240,
//   cacheHitRate: 0.85
// }
```

## Best Practices

### Choose the Right Adapter
1. **Development**: Memory or FileSystem
2. **Production Server**: FileSystem or S3
3. **Browser Apps**: OPFS or Memory
4. **Distributed**: S3 with caching

### Optimize for Your Use Case
1. **Read-heavy**: Enable aggressive caching
2. **Write-heavy**: Use WAL and batching
3. **Real-time**: Memory with periodic persistence
4. **Archival**: S3 with compression

### Monitor and Maintain
1. Regular statistics collection
2. WAL cleanup scheduling
3. Index optimization
4. Cache tuning based on hit rates

## API Reference

See the [Storage API](../api/storage.md) for complete method documentation.