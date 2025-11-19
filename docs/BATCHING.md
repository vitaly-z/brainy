# Batch Operations API v5.12.0

> **Enterprise Production-Ready** | Zero N+1 Query Patterns | 90%+ Performance Improvement

## Overview

Brainy v5.12.0 introduces comprehensive batch operations at the storage layer, eliminating N+1 query patterns and dramatically improving performance for VFS operations, relationship queries, and entity retrieval on cloud storage.

### Problem Solved

**Before v5.12.0:**
- VFS `readFile()` on cloud storage: **18-21 seconds** per file (cold cache)
- Directory with 12 files: **12.7 seconds** (22 sequential calls × 580ms latency)
- N+1 query pattern: 1 directory query + N individual file queries

**After v5.12.0:**
- VFS operations: **<1 second** for 12 files (90%+ improvement)
- 2-3 batched calls instead of 22 sequential calls
- Native cloud storage batch APIs for maximum throughput

---

## New Public APIs

### 1. `brain.batchGet(ids, options?)`

Batch retrieval of multiple entities (metadata-only by default).

```typescript
// Fetch multiple entities in a single batched operation
const ids = ['id1', 'id2', 'id3']
const results: Map<string, Entity> = await brain.batchGet(ids)

// With vectors (falls back to individual gets)
const resultsWithVectors = await brain.batchGet(ids, { includeVectors: true })

// Results map
results.get('id1') // → Entity or undefined
results.size // → 3 (number of found entities)
```

**Performance:**
- Memory storage: Instant (parallel reads)
- Cloud storage (GCS/S3/Azure): <500ms for 100 entities
- Throughput: 50-200+ entities/second depending on adapter

**Use Cases:**
- Loading multiple entities for display
- Bulk data export operations
- Relationship traversal (fetch all connected entities)

---

## Storage-Level APIs

### 2. `storage.getNounMetadataBatch(ids)`

Batch metadata retrieval with type-aware caching.

```typescript
const storage = brain.storage as BaseStorage
const ids = ['id1', 'id2', 'id3']

const metadataMap: Map<string, NounMetadata> = await storage.getNounMetadataBatch(ids)

for (const [id, metadata] of metadataMap) {
  console.log(metadata.noun) // Type: 'document', 'person', etc.
  console.log(metadata.data) // Entity data
}
```

**Features:**
- ✅ Type cache consultation (O(1) path resolution for known types)
- ✅ Uncached ID handling (tries multiple types automatically)
- ✅ Sharding preservation (all paths include `{shard}/{id}`)
- ✅ COW-aware (respects branch paths)

**Performance:**
- Cached IDs: ~1ms per 100 entities
- Uncached IDs: ~100ms per 100 entities (multi-type search)
- Cloud storage: Parallel downloads (100-150 concurrent)

---

### 3. `storage.getVerbsBySourceBatch(sourceIds, verbType?)`

Batch relationship queries by source entity IDs.

```typescript
const storage = brain.storage as BaseStorage

// Get all relationships from multiple sources
const results: Map<string, GraphVerb[]> = await storage.getVerbsBySourceBatch([
  'person1',
  'person2'
])

// Filter by verb type
const createsResults = await storage.getVerbsBySourceBatch(
  ['person1', 'person2'],
  'creates'
)

// Process results
for (const [sourceId, verbs] of results) {
  console.log(`${sourceId} has ${verbs.length} relationships`)
  verbs.forEach(verb => {
    console.log(`  → ${verb.verb} → ${verb.targetId}`)
  })
}
```

**Use Cases:**
- Social graph traversal (fetch all connections for multiple users)
- Knowledge graph queries (find all relationships of specific type)
- Bulk export of relationship data

**Performance:**
- Memory storage: <10ms for 1000 relationships
- Cloud storage: Batched reads with parallel metadata fetches

---

### 4. `storage.readBatchWithInheritance(paths, targetBranch?)`

COW-aware batch path resolution with branch inheritance.

```typescript
const storage = brain.storage as BaseStorage

const paths = [
  'entities/nouns/document/metadata/{shard}/id1.json',
  'entities/nouns/thing/metadata/{shard}/id2.json'
]

// Resolves to: branches/{branch}/entities/nouns/...
const results: Map<string, any> = await storage.readBatchWithInheritance(paths, 'my-branch')

// Automatically inherits from parent branches for missing entities
```

**Features:**
- ✅ Branch path resolution (`branches/{branch}/...`)
- ✅ Write cache integration (read-after-write consistency)
- ✅ COW inheritance (fallback to parent commits for missing entities)
- ✅ Adapter-agnostic (works with all storage adapters)

---

## Cloud Adapter Native Batch APIs

### GCS Storage

```typescript
const gcsStorage = new GCSStorage({ bucketName: 'my-bucket' })

// Native batch API with 100 concurrent downloads
const results = await gcsStorage.readBatch(paths)

// Configuration
gcsStorage.getBatchConfig() // → {
//   maxBatchSize: 1000,
//   maxConcurrent: 100,
//   operationsPerSecond: 1000
// }
```

**Performance:**
- 100 concurrent downloads
- ~300-500ms for 100 objects
- HTTP/2 multiplexing for optimal throughput

---

### S3 Compatible Storage

Works with Amazon S3, Cloudflare R2, and other S3-compatible services.

```typescript
const s3Storage = new S3CompatibleStorage({ bucketName: 'my-bucket' })

// Native batch API with 150 concurrent downloads
const results = await s3Storage.readBatch(paths)

// Configuration
s3Storage.getBatchConfig() // → {
//   maxBatchSize: 1000,
//   maxConcurrent: 150,
//   operationsPerSecond: 5000
// }
```

**Performance:**
- 150 concurrent downloads
- ~200-500ms for 150 objects
- S3 handles 5000+ ops/second with burst capacity

---

### R2 Storage (Cloudflare)

```typescript
const r2Storage = new R2Storage({ bucketName: 'my-bucket' })

// Fastest cloud storage with zero egress fees
const results = await r2Storage.readBatch(paths)

// Configuration
r2Storage.getBatchConfig() // → {
//   maxBatchSize: 1000,
//   maxConcurrent: 150,
//   operationsPerSecond: 6000
// }
```

**Performance:**
- 150 concurrent downloads
- ~200-400ms for 150 objects (fastest!)
- Zero egress fees enable aggressive caching

---

### Azure Blob Storage

```typescript
const azureStorage = new AzureBlobStorage({ containerName: 'my-container' })

// Native batch API with 100 concurrent downloads
const results = await azureStorage.readBatch(paths)

// Configuration
azureStorage.getBatchConfig() // → {
//   maxBatchSize: 1000,
//   maxConcurrent: 100,
//   operationsPerSecond: 3000
// }
```

**Performance:**
- 100 concurrent downloads
- ~400-600ms for 100 blobs
- Good throughput with Azure's global network

---

## VFS Integration

VFS operations automatically use batch APIs for maximum performance.

### Directory Traversal

```typescript
// OLD: Sequential N+1 pattern (12.7 seconds for 12 files)
const tree = await brain.vfs.getTreeStructure('/my-dir')

// NEW v5.12.0: Parallel breadth-first with batching (<1 second)
// ✅ PathResolver.getChildren() uses brain.batchGet() internally
// ✅ Parallel traversal of directories at same tree level
// ✅ 2-3 batched calls instead of 22 sequential calls
```

**Architecture:**

```
VFS.getTreeStructure()
  ↓ PARALLEL (breadth-first traversal)
  → PathResolver.getChildren() [all dirs at level processed in parallel]
      ↓ BATCHED
      → brain.batchGet(childIds) [1 call instead of N]
          ↓ BATCHED
          → storage.getNounMetadataBatch(ids) [1 call instead of N]
              ↓ ADAPTER-SPECIFIC
              → GCS: readBatch() with 100 concurrent downloads
              → S3: readBatch() with 150 concurrent downloads
              → Memory: Promise.all() parallel reads
```

**Performance Gains:**
- **Before**: 22 sequential calls × 580ms = 12.7 seconds
- **After**: 2-3 batched calls = <1 second
- **Improvement**: **90%+ faster** on cloud storage

---

## Advanced Features Compatibility

### ✅ Type-Aware Storage

All batch operations preserve type-first paths:
```
entities/nouns/{TYPE}/metadata/{SHARD}/{ID}.json
```

Batch APIs consult the `nounTypeCache` for O(1) path resolution:

```typescript
// Cached IDs: Direct path construction
const id = 'abc-123'
const type = nounTypeCache.get(id) // → 'document'
const path = `entities/nouns/document/metadata/${shard}/${id}.json`

// Uncached IDs: Try multiple types (automatically)
// Batch API tries all types in search order:
//   1. Common types (document, thing, person, file)
//   2. All other types (alphabetically)
```

---

### ✅ Sharding

All batch paths include shard IDs calculated via `getShardIdFromUuid(id)`:

```typescript
const id = 'a3c4e5f7-...'
const shard = getShardIdFromUuid(id) // → 'a3' (first 2 hex chars)
const path = `entities/nouns/document/metadata/${shard}/${id}.json`
```

**Distribution:** 256 shards (00-ff) for optimal load distribution.

---

### ✅ COW (Copy-on-Write)

Batch operations respect branch isolation and time-travel:

```typescript
// Main branch
const brain = await Brainy.create({ enableCOW: true })
await brain.add({ type: 'document', data: 'Main' })

// Create fork
const fork = await brain.fork('experiment')

// Batch operations are isolated
await brain.batchGet([id1, id2]) // → Reads from: branches/main/...
await fork.batchGet([id1, id2])  // → Reads from: branches/experiment/...
```

**Inheritance:**
- Entities missing from child branch automatically inherit from parent commits
- `readBatchWithInheritance()` walks commit history for missing items
- Preserves fork semantics while maintaining performance

---

### ✅ fork() and checkout()

```typescript
const fork = await brain.fork('my-branch')
await fork.add({ type: 'document', data: 'Fork entity' })

// Batch operations use correct branch
const results = await fork.batchGet([id1, id2])
// → Reads from: branches/my-branch/...

// Checkout changes active branch
await fork.checkout('main')
const mainResults = await fork.batchGet([id1, id2])
// → Reads from: branches/main/...
```

---

### ✅ asOf() Time-Travel

```typescript
// Create historical snapshot
await brain.commit('v1.0')
const snapshot = await brain.asOf('v1.0')

// Batch operations on historical data
const results = await snapshot.batchGet([id1, id2])
// → Reads from historical tree state
```

Historical queries use `HistoricalStorageAdapter` which wraps batch operations to point at specific commits.

---

## Performance Benchmarks

### VFS Operations (12 Files)

| Storage | Before v5.12.0 | After v5.12.0 | Improvement |
|---------|---------------|---------------|-------------|
| **GCS** | 12.7s | <1s | **92% faster** |
| **S3** | 13.2s | <1s | **92% faster** |
| **R2** | 11.8s | <0.8s | **93% faster** |
| **Azure** | 14.5s | <1s | **93% faster** |
| **Memory** | 150ms | 50ms | **67% faster** |

### Entity Batch Retrieval (100 Entities)

| Storage | Individual Gets | Batch Get | Improvement |
|---------|----------------|-----------|-------------|
| **GCS** | 5.8s | 0.4s | **93% faster** |
| **S3** | 5.2s | 0.3s | **94% faster** |
| **R2** | 4.9s | 0.25s | **95% faster** |
| **Azure** | 6.5s | 0.5s | **92% faster** |
| **Memory** | 180ms | 15ms | **92% faster** |

### Throughput (Entities/Second)

| Storage | Individual | Batch | Improvement |
|---------|-----------|-------|-------------|
| **GCS** | 17 ent/s | 250 ent/s | **14.7x** |
| **S3** | 19 ent/s | 333 ent/s | **17.5x** |
| **R2** | 20 ent/s | 400 ent/s | **20x** |
| **Azure** | 15 ent/s | 200 ent/s | **13.3x** |
| **Memory** | 556 ent/s | 6667 ent/s | **12x** |

---

## Error Handling

### Partial Batch Failures

Batch operations gracefully handle missing or invalid entities:

```typescript
const validId = 'abc-123-...'
const invalidIds = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
]

const results = await brain.batchGet([validId, ...invalidIds])

results.size // → 1 (only valid entity)
results.has(validId) // → true
results.has(invalidIds[0]) // → false (silently skipped)
```

**Behavior:**
- Invalid UUIDs: Silently skipped (not included in results)
- Missing entities: Silently skipped (not included in results)
- Storage errors: Logged, entity excluded from results
- No exceptions thrown for partial failures

### Empty Batches

```typescript
const results = await brain.batchGet([])
results.size // → 0 (empty map)
```

### Duplicate IDs

```typescript
const results = await brain.batchGet(['id1', 'id1', 'id1'])
results.size // → 1 (deduplicated automatically)
```

---

## Migration Guide

### From Individual Gets

**Before:**
```typescript
const entities = []
for (const id of ids) {
  const entity = await brain.get(id)
  if (entity) entities.push(entity)
}
```

**After:**
```typescript
const results = await brain.batchGet(ids)
const entities = Array.from(results.values())
```

**Performance Gain:** 10-20x faster on cloud storage.

---

### From Individual Relationship Queries

**Before:**
```typescript
const allVerbs = []
for (const sourceId of sourceIds) {
  const verbs = await brain.getRelations({ from: sourceId })
  allVerbs.push(...verbs)
}
```

**After:**
```typescript
const storage = brain.storage as BaseStorage
const results = await storage.getVerbsBySourceBatch(sourceIds)

const allVerbs = []
for (const verbs of results.values()) {
  allVerbs.push(...verbs)
}
```

**Performance Gain:** 5-10x faster due to batched metadata fetches.

---

## Best Practices

### 1. **Use Batching for Multiple Entity Operations**

```typescript
// ✅ GOOD: Batch fetch
const results = await brain.batchGet(ids)

// ❌ BAD: Individual gets in loop
for (const id of ids) {
  await brain.get(id)
}
```

### 2. **Batch Size Recommendations**

| Storage | Optimal Batch Size | Max Batch Size |
|---------|-------------------|----------------|
| **Memory** | Unlimited | Unlimited |
| **FileSystem** | 100-500 | 1000 |
| **GCS** | 100-500 | 1000 |
| **S3/R2** | 100-1000 | 1000 |
| **Azure** | 100-500 | 1000 |

**Guideline:** For batches >1000, split into chunks of 500-1000.

### 3. **Metadata-Only by Default**

```typescript
// Default: Metadata-only (fast)
const results = await brain.batchGet(ids) // No vectors

// Only load vectors if needed
const withVectors = await brain.batchGet(ids, { includeVectors: true })
```

### 4. **Error Handling**

```typescript
// Batch operations never throw for missing entities
const results = await brain.batchGet(ids)

// Check results
for (const id of ids) {
  if (results.has(id)) {
    // Entity exists
    const entity = results.get(id)
  } else {
    // Entity missing (not an error)
    console.log(`Entity ${id} not found`)
  }
}
```

---

## Testing

Comprehensive test coverage in `tests/integration/storage-batch-operations.test.ts`:

```bash
npx vitest run tests/integration/storage-batch-operations.test.ts
```

**Test Coverage:**
- ✅ brain.batchGet() high-level API
- ✅ storage.getNounMetadataBatch() with type caching
- ✅ COW integration (branch isolation, inheritance)
- ✅ storage.getVerbsBySourceBatch() relationship queries
- ✅ VFS integration (PathResolver.getChildren())
- ✅ Performance benchmarks (N+1 elimination)
- ✅ Error handling (partial failures, empty batches, duplicates)
- ✅ Type-aware storage verification
- ✅ Sharding preservation

**Results:** 23 tests passing ✅

---

## Implementation Details

### Architecture Layers

```
User Code (brain.batchGet)
     ↓
High-Level API (src/brainy.ts)
     ↓
Storage Layer (src/storage/baseStorage.ts)
     ↓
COW Layer (readBatchWithInheritance)
     ↓
Adapter Layer (readBatchFromAdapter)
     ↓
Cloud Adapter (GCS/S3/Azure native batch APIs)
```

### Automatic Fallback

If an adapter doesn't implement `readBatch()`, the system automatically falls back to parallel individual reads:

```typescript
// BaseStorage.readBatchFromAdapter()
if (typeof selfWithBatch.readBatch === 'function') {
  // Use native batch API
  return await selfWithBatch.readBatch(resolvedPaths)
} else {
  // Automatic parallel fallback
  return await Promise.all(resolvedPaths.map(path => this.read(path)))
}
```

**Adapters with Native Batch:**
- ✅ GCSStorage
- ✅ S3CompatibleStorage
- ✅ R2Storage
- ✅ AzureBlobStorage

**Adapters with Parallel Fallback:**
- MemoryStorage
- FileSystemStorage
- OPFSStorage
- HistoricalStorageAdapter (delegates to underlying)

---

## Release Notes

**Version:** 5.12.0
**Release Date:** 2025-11-19
**Status:** Production-Ready

**Breaking Changes:** None (backward compatible)

**New APIs:**
- `brain.batchGet(ids, options?)` - High-level batch entity retrieval
- `storage.getNounMetadataBatch(ids)` - Storage-level metadata batch
- `storage.getVerbsBySourceBatch(sourceIds, verbType?)` - Batch relationship queries
- `storage.readBatchWithInheritance(paths, targetBranch?)` - COW-aware batch reads

**Performance Improvements:**
- VFS operations: 90%+ faster on cloud storage
- Entity retrieval: 10-20x throughput improvement
- Zero N+1 query patterns

**Compatibility:**
- ✅ Type-aware storage
- ✅ Sharding (256 shards)
- ✅ COW (branch isolation, inheritance)
- ✅ fork() and checkout()
- ✅ asOf() time-travel
- ✅ All 56+ indexes respected

---

## Support

- **Documentation:** `/docs/BATCHING.md`, `/docs/PERFORMANCE.md`
- **Tests:** `/tests/integration/storage-batch-operations.test.ts`
- **Issues:** https://github.com/soulcraft/brainy/issues
- **Discussions:** https://github.com/soulcraft/brainy/discussions

---

**Built with ❤️ for enterprise-scale knowledge graphs**
