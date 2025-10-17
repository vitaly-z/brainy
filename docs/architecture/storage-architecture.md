# Storage Architecture (v4.0.0)

> **Updated for v4.0.0**: Metadata/vector separation, UUID-based sharding, lifecycle management

## Storage Structure

### v4.0.0 Architecture: Metadata/Vector Separation

In v4.0.0, entities and relationships are split into **2 separate files** for optimal performance at billion-entity scale:

```
brainy-data/
├── _system/                                    # System metadata (not sharded)
│   ├── statistics.json                        # Performance metrics
│   ├── __metadata_field_index__*.json        # Field indexes
│   └── __metadata_sorted_index__*.json       # Sorted indexes
│
├── entities/
│   ├── nouns/
│   │   ├── vectors/                          # HNSW graph data (sharded by UUID)
│   │   │   ├── 00/                          # Shard 00 (first 2 hex digits)
│   │   │   │   ├── 00123456-....json       # Vector + HNSW connections
│   │   │   │   └── 00abcdef-....json
│   │   │   ├── 01/ ... ff/                  # 256 shards total
│   │   │
│   │   └── metadata/                         # Business data (sharded by UUID)
│   │       ├── 00/
│   │       │   ├── 00123456-....json       # Entity metadata only
│   │       │   └── 00abcdef-....json
│   │       ├── 01/ ... ff/
│   │
│   └── verbs/
│       ├── vectors/                          # Relationship vectors (sharded)
│       │   ├── 00/ ... ff/
│       │
│       └── metadata/                         # Relationship data (sharded)
│           ├── 00/ ... ff/
```

### Why Split Metadata and Vectors?

**Performance at scale:**
- **HNSW operations**: Only load vectors (4KB) during search, not metadata (2-10KB)
- **Filtering**: Only load metadata during filtering, not vectors
- **Pagination**: Load metadata IDs first, fetch vectors/metadata on-demand
- **Result**: 60-70% reduction in I/O for typical queries at million-entity scale

### UUID-Based Sharding (256 Shards)

**How it works:**
```typescript
const uuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
const shard = uuid.substring(0, 2)  // "3f"

// Vector path:   entities/nouns/vectors/3f/3fa85f64-....json
// Metadata path: entities/nouns/metadata/3f/3fa85f64-....json
```

**Benefits:**
- **Uniform distribution**: ~3,900 entities per shard (at 1M scale)
- **Cloud storage optimization**: 200x faster than unsharded (30s → 150ms)
- **Parallel operations**: Load 256 shards in parallel
- **Predictable**: Deterministic shard assignment

## Storage Adapters

Brainy provides multiple storage adapters with identical APIs and v4.0.0 production features:

### FileSystem Storage (Node.js)
```typescript
const brain = new Brainy({
  storage: {
    type: 'filesystem',
    path: './data',
    compression: true  // v4.0.0: Gzip compression (60-80% space savings)
  }
})
```
- **Use case**: Server applications, CLI tools
- **Performance**: Direct file I/O with optional compression
- **Persistence**: Permanent on disk
- **v4.0.0 Features**:
  - **Gzip Compression**: 60-80% storage savings with minimal CPU overhead
  - **Batch Delete**: Efficient bulk deletion with retries
  - **UUID Sharding**: Automatic 256-shard distribution

### S3 Compatible Storage (AWS, MinIO, R2)
```typescript
const brain = new Brainy({
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
- **Persistence**: Cloud storage durability (99.999999999%)
- **v4.0.0 Features**:
  - **Lifecycle Policies**: Automatic tier transitions (Standard → IA → Glacier → Deep Archive)
  - **Intelligent-Tiering**: Automatic optimization based on access patterns (up to 95% savings)
  - **Batch Delete**: Efficient bulk deletion (1000 objects per request)
  - **Cost Impact**: $138k/year → $5.9k/year at 500TB (96% savings!)

### Google Cloud Storage (GCS)
```typescript
const brain = new Brainy({
  storage: {
    type: 'gcs',
    bucketName: 'my-brainy-data',
    keyFilename: './service-account.json'  // Or use ADC
  }
})
```
- **Use case**: Google Cloud deployments
- **Performance**: Global CDN with edge caching
- **Persistence**: 99.999999999% durability
- **v4.0.0 Features**:
  - **Lifecycle Policies**: Automatic tier transitions (Standard → Nearline → Coldline → Archive)
  - **Autoclass**: Intelligent automatic tier optimization
  - **Batch Delete**: Efficient bulk operations
  - **Cost Impact**: $138k/year → $8.3k/year at 500TB (94% savings!)

### Azure Blob Storage
```typescript
const brain = new Brainy({
  storage: {
    type: 'azure',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    containerName: 'brainy-data'
  }
})
```
- **Use case**: Azure cloud deployments
- **Performance**: Global replication with CDN
- **Persistence**: LRS, ZRS, GRS, RA-GRS options
- **v4.0.0 Features**:
  - **Blob Tier Management**: Hot/Cool/Archive tiers (99% cost savings)
  - **Lifecycle Policies**: Automatic tier transitions and deletions
  - **Batch Delete**: BlobBatchClient for efficient bulk operations
  - **Batch Tier Changes**: Move thousands of blobs efficiently
  - **Archive Rehydration**: Smart rehydration with priority options

### Origin Private File System (Browser)
```typescript
const brain = new Brainy({
  storage: {
    type: 'opfs'
  }
})
```
- **Use case**: Browser applications, PWAs
- **Performance**: Near-native file system speed
- **Persistence**: Permanent in browser (with quota limits)
- **v4.0.0 Features**:
  - **Quota Monitoring**: Real-time quota tracking and warnings
  - **Batch Delete**: Efficient bulk deletion
  - **Storage Status**: Detailed usage/available reporting

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


Ensures durability and enables recovery:

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
2. Replay operations from last checkpoint
3. Verify checksums for integrity

## Storage Optimization (v4.0.0)

### 1. Lifecycle Policies (Cloud Storage)

**Automatic cost optimization through tier transitions:**

```typescript
// S3: Set lifecycle policy for automatic archival
await storage.setLifecyclePolicy({
  rules: [{
    id: 'archive-old-data',
    prefix: 'entities/',
    status: 'Enabled',
    transitions: [
      { days: 30, storageClass: 'STANDARD_IA' },      // Move to IA after 30 days
      { days: 90, storageClass: 'GLACIER' },          // Archive after 90 days
      { days: 365, storageClass: 'DEEP_ARCHIVE' }     // Deep archive after 1 year
    ]
  }]
})

// GCS: Set lifecycle policy
await storage.setLifecyclePolicy({
  rules: [{
    condition: { age: 30 },
    action: { type: 'SetStorageClass', storageClass: 'NEARLINE' }
  }, {
    condition: { age: 90 },
    action: { type: 'SetStorageClass', storageClass: 'COLDLINE' }
  }, {
    condition: { age: 365 },
    action: { type: 'SetStorageClass', storageClass: 'ARCHIVE' }
  }]
})

// Azure: Set lifecycle policy
await storage.setLifecyclePolicy({
  rules: [{
    name: 'archiveOldData',
    enabled: true,
    type: 'Lifecycle',
    definition: {
      filters: { blobTypes: ['blockBlob'] },
      actions: {
        baseBlob: {
          tierToCool: { daysAfterModificationGreaterThan: 30 },
          tierToArchive: { daysAfterModificationGreaterThan: 90 }
        }
      }
    }
  }]
})
```

**Cost Impact (500TB dataset):**
| Storage | Before | After | Savings |
|---------|--------|-------|---------|
| **AWS S3** | $138,000/yr | $5,940/yr | **96%** |
| **GCS** | $138,000/yr | $8,300/yr | **94%** |
| **Azure** | $107,520/yr | $5,016/yr | **95%** |

### 2. Intelligent-Tiering (S3)

**Automatic optimization without retrieval fees:**

```typescript
// Enable S3 Intelligent-Tiering
await storage.enableIntelligentTiering('entities/', 'auto-optimize')

// Benefits:
// - Automatic tier transitions based on access patterns
// - No retrieval fees (unlike Glacier)
// - Up to 95% cost savings
// - No performance impact on frequently accessed data
```

### 3. Autoclass (GCS)

**Google Cloud's intelligent automatic optimization:**

```typescript
// Enable GCS Autoclass
await storage.enableAutoclass({
  terminalStorageClass: 'ARCHIVE'  // Optional: Set lowest tier
})

// Benefits:
// - Automatic optimization based on access patterns
// - No data retrieval delays
// - Transparent tier transitions
// - Up to 94% cost savings
```

### 4. Compression (FileSystem)

```typescript
// Enable gzip compression for local storage
const brain = new Brainy({
  storage: {
    type: 'filesystem',
    path: './data',
    compression: true  // 60-80% space savings
  }
})

// Performance impact:
// - Write: +10-20ms per file (gzip compression)
// - Read: +5-10ms per file (gzip decompression)
// - Space savings: 60-80% for typical JSON data
// - CPU overhead: Minimal (~5% CPU)
```

### 5. Batch Operations

```typescript
// v4.0.0: Efficient batch delete
await storage.batchDelete([
  'entities/nouns/vectors/00/00123456-....json',
  'entities/nouns/metadata/00/00123456-....json',
  // ... up to 1000 objects
])

// Benefits:
// - S3: 1000 objects per request (vs 1 per request)
// - GCS: 100 objects per request
// - Azure: 256 objects per batch
// - Automatic retry logic with exponential backoff
// - Throttling protection

// Batch writes for performance
await brain.addBatch([
  { content: "item1", metadata: {} },
  { content: "item2", metadata: {} },
  { content: "item3", metadata: {} }
])
// Single transaction, optimized I/O
```

### 6. Quota Monitoring (OPFS)

```typescript
// Get quota status for browser storage
const status = await storage.getStorageStatus()

console.log(status)
// {
//   type: 'opfs',
//   available: true,
//   details: {
//     usage: 45829120,      // 43.7 MB used
//     quota: 536870912,     // 512 MB available
//     usagePercent: 8.5,
//     quotaExceeded: false
//   }
// }

// Proactive quota management:
// - Monitor usage before writes
// - Warn users when approaching quota
// - Automatically clean up old data
```

### 7. Tier Management (Azure)

```typescript
// Change blob tier for cost optimization
await storage.changeBlobTier(blobPath, 'Cool')  // Hot → Cool (50% savings)
await storage.changeBlobTier(blobPath, 'Archive')  // Cool → Archive (99% savings)

// Batch tier changes (efficient)
await storage.batchChangeTier([blob1, blob2, blob3], 'Cool')

// Rehydrate from Archive when needed
await storage.rehydrateBlob(blobPath, 'Standard')  // Standard or High priority
```

### 8. Caching Strategy

```typescript
// Configure caching per storage type
const brain = new Brainy({
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
const oldBrain = new Brainy({ storage: { type: 'filesystem' } })
const newBrain = new Brainy({ storage: { type: 's3' } })

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

## Best Practices (v4.0.0)

### Choose the Right Adapter
1. **Development**: FileSystem with compression (local persistence, small storage footprint)
2. **Production Server**: FileSystem with compression or cloud storage with lifecycle policies
3. **Browser Apps**: OPFS with quota monitoring
4. **Distributed**: S3/GCS/Azure with Intelligent-Tiering/Autoclass

### Optimize for Your Use Case
1. **Read-heavy**: Enable aggressive caching + cloud CDN
2. **Write-heavy**: Batch operations + async writes
3. **Real-time**: FileSystem with periodic snapshots
4. **Archival**: Cloud storage with lifecycle policies (96% cost savings!)
5. **Large-scale**: Metadata/vector separation + UUID sharding + lifecycle policies

### v4.0.0 Cost Optimization
1. **Enable lifecycle policies** for cloud storage (automated cost reduction)
2. **Use Intelligent-Tiering (S3)** or Autoclass (GCS) for automatic optimization
3. **Enable compression** for FileSystem storage (60-80% space savings)
4. **Monitor quota** for OPFS (prevent quota exceeded errors)
5. **Use batch operations** for bulk deletions (efficient API usage)
6. **Consider tier management** for Azure (Hot/Cool/Archive tiers)

**Example Cost Savings (500TB dataset):**
- Without lifecycle policies: **$138,000/year**
- With v4.0.0 lifecycle policies: **$5,940/year**
- **Savings: $132,060/year (96%)**

### Monitor and Maintain
1. Regular statistics collection
2. Monitor lifecycle policy effectiveness
3. Index optimization
4. Cache tuning based on hit rates
5. Track storage costs and tier distribution
6. Review quota usage (OPFS) and storage growth patterns

### Production Deployment Checklist
- ✅ Enable lifecycle policies on cloud storage
- ✅ Configure batch delete for cleanup operations
- ✅ Enable compression for FileSystem storage
- ✅ Set up quota monitoring for OPFS
- ✅ Configure appropriate tier transitions
- ✅ Enable Intelligent-Tiering (S3) or Autoclass (GCS)
- ✅ Monitor storage costs and optimize regularly

## API Reference

See the [Storage API](../api/storage.md) for complete method documentation.

---

**Version**: 4.0.0
**Last Updated**: 2025-10-17
**Key Features**: Metadata/vector separation, UUID sharding, lifecycle management, tier optimization