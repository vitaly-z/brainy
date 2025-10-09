# Brainy Data Storage Architecture

This document explains how Brainy stores, indexes, and scales data across all storage backends (GCS, S3, OPFS, filesystem, memory).

---

## Table of Contents

1. [What Gets Stored](#1-what-gets-stored)
2. [The Indexes](#2-the-indexes)
3. [Sharding Strategy](#3-sharding-strategy)
4. [Storage Layout](#4-storage-layout)

---

## 1. What Gets Stored

Brainy stores three types of data, with each type split across multiple files for optimal performance.

### 1.1 Entities (Nouns)

Each entity is stored in **2 files**:

#### Vector File
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vector": [0.1, 0.2, 0.3, ...],
  "connections": {
    "0": ["uuid1", "uuid2"],
    "1": ["uuid3"]
  },
  "level": 2
}
```

**Purpose:** HNSW graph navigation for semantic search
**Size:** ~4KB per entity
**Scale:** Millions of entities
**Location:** `entities/nouns/vectors/{shard}/{uuid}.json`

#### Metadata File
```json
{
  "type": "user",
  "status": "active",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": {...},
  "customField": "custom value"
}
```

**Purpose:** Business data and filtering
**Size:** ~1-10KB per entity
**Scale:** Millions of entities
**Location:** `entities/nouns/metadata/{shard}/{uuid}.json`

---

### 1.2 Relationships (Verbs)

Each relationship is also stored in **2 files**:

#### Vector File
```json
{
  "id": "7b2f5e3c-8d4a-4f1e-9c2b-5a6d7e8f9a0b",
  "vector": [0.5, 0.3, 0.7, ...],
  "connections": {
    "0": ["verb-uuid1", "verb-uuid2"]
  }
}
```

**Purpose:** Relationship similarity for semantic graph queries
**Size:** ~2KB per relationship
**Scale:** Millions of relationships
**Location:** `entities/verbs/vectors/{shard}/{uuid}.json`

#### Metadata File
```json
{
  "sourceId": "user-uuid",
  "targetId": "product-uuid",
  "type": "purchased",
  "weight": 1.0,
  "timestamp": {...},
  "metadata": {
    "amount": 99.99,
    "quantity": 2
  }
}
```

**Purpose:** Graph structure (edges) and relationship data
**Size:** ~500 bytes per relationship
**Scale:** Millions of relationships
**Location:** `entities/verbs/metadata/{shard}/{uuid}.json`

---

### 1.3 System Metadata

Unlike entities and relationships, system metadata consists of **index files** that enable fast lookups without scanning millions of entities.

**Purpose:** Fast filtering and range queries
**Scale:** 10-200 files total (NOT per-entity!)
**Location:** `_system/` (no sharding)

Examples:
- `__metadata_field_index__status.json` - Maps status values to entity IDs
- `__metadata_sorted_index__createdAt.json` - Sorted list for range queries
- `statistics.json` - Global statistics

---

## 2. The Indexes

Brainy uses three complementary index systems for different query patterns.

### 2.1 HNSW Vector Index (In-Memory)

**Purpose:** Semantic similarity search
**Location:** RAM (rebuilt from storage on startup)
**Data Structure:** Hierarchical graph of vector connections

**Example Query:**
```typescript
// Find entities similar to a vector
const results = await brain.searchByVector([0.1, 0.2, 0.3, ...], { k: 10 })
// Returns: [{id: "uuid1", score: 0.95}, {id: "uuid2", score: 0.89}, ...]
```

**How It Works:**
1. Loads `entities/nouns/vectors/**/*.json` files
2. Builds HNSW graph in memory
3. Enables O(log n) approximate nearest neighbor search

**Performance:**
- Build time: 1-5 seconds per 100K entities
- Query time: 1-10ms for k=10 results
- Memory: ~200MB per 100K entities (when fully loaded)

**Memory Management:**
The HNSW index uses adaptive 3-tier caching (see Section 2.4) to optimize memory usage based on available resources.

---

### 2.2 Graph Adjacency Index (In-Memory)

**Purpose:** Navigate relationships (graph queries)
**Location:** RAM (rebuilt from storage on startup)
**Data Structure:** Bidirectional mappings

```typescript
{
  sourceToTargets: Map<string, Set<string>>,  // "user-uuid" → ["product1", "product2"]
  targetToSources: Map<string, Set<string>>   // "product1" → ["user1", "user2"]
}
```

**Example Query:**
```typescript
// Find all products purchased by a user
const verbs = await brain.getVerbsBySource("user-uuid")

// Find all users who purchased a product
const verbs = await brain.getVerbsByTarget("product-uuid")
```

**How It Works:**
1. Loads `entities/verbs/metadata/**/*.json` files
2. Builds bidirectional index in memory
3. Enables O(1) relationship lookups

**Performance:**
- Build time: 0.5-2 seconds per 100K relationships
- Query time: <1ms
- Memory: ~100MB per 100K relationships

---

### 2.3 Metadata Field Indexes (On-Disk)

**Purpose:** Filter by business fields without loading all entities
**Location:** Persistent storage
**Data Structure:** Field → Value → IDs mapping

#### Hash Indexes (Exact Match)
```json
// _system/__metadata_field_index__status.json
{
  "values": {
    "active": 800000,    // Count
    "pending": 150000,
    "deleted": 50000
  },
  "lastUpdated": "2025-10-09T..."
}
```

**Example Query:**
```typescript
// Find all active users
const users = await brain.getNouns({
  filter: {
    metadata: { status: 'active' }
  }
})
```

**How It Works:**
1. Query checks `__metadata_field_index__status.json`
2. Retrieves IDs for "active" status
3. Loads only matching entity files
4. Returns: ~1000 IDs in 5ms (vs scanning 1M entities)

---

#### Sorted Indexes (Range Queries)

```json
// _system/__metadata_sorted_index__createdAt.json
{
  "values": [
    [1704067200000, ["uuid1", "uuid2", "uuid3"]],  // Jan 1, 2024
    [1704153600000, ["uuid4", "uuid5"]],            // Jan 2, 2024
    [1704240000000, ["uuid6"]]                      // Jan 3, 2024
  ],
  "fieldType": "number"
}
```

**Example Query:**
```typescript
// Find entities created after Jan 1, 2024
const recent = await brain.getNouns({
  filter: {
    metadata: {
      createdAt: { greaterThan: 1704067200000 }
    }
  }
})
```

**How It Works:**
1. Binary search sorted index (O(log n) where n = unique values)
2. Returns matching IDs
3. Loads only matching entities
4. Performance: Find 1000 entities in 10ms (from 1M total)

---

### 2.4 Adaptive Memory Management (3-Tier Cache)

Brainy uses a smart 3-tier caching system to balance performance and memory usage, automatically adapting to available resources.

**Architecture:** Hot Cache → Warm Cache → Cold Storage

```typescript
{
  hot: {
    type: 'LRU Cache',
    location: 'Memory',
    access: 'Instant (<1ms)',
    size: 'Small (most recent items)'
  },
  warm: {
    type: 'TTL Cache',
    location: 'Memory',
    access: 'Fast (1-5ms)',
    size: 'Medium (frequently accessed)'
  },
  cold: {
    type: 'Persistent Storage',
    location: 'Disk/Cloud',
    access: 'Slower (10-150ms)',
    size: 'Unlimited (all data)'
  }
}
```

#### How It Works

**1. Hot Cache (LRU - Least Recently Used)**
- Stores most recently accessed items
- Ultra-fast lookups (<1ms)
- Automatically evicts least-used items when full
- Default size: 1,000 - 10,000 items

**2. Warm Cache (TTL - Time To Live)**
- Stores frequently accessed items
- Fast lookups (1-5ms)
- Items expire after inactivity period
- Default TTL: 5-30 minutes

**3. Cold Storage (Persistent)**
- All data stored on disk/cloud
- Retrieved on cache miss
- Automatically promoted to warm/hot on access
- No size limit

#### Adaptive Behavior

The cache automatically adjusts based on memory pressure:

```typescript
// Low memory: Aggressive eviction
hot.maxSize = 1,000
warm.ttl = 5 minutes

// High memory: Generous caching
hot.maxSize = 10,000
warm.ttl = 30 minutes
```

#### Cache Flow Example

```typescript
// First access: Miss all caches
await brain.getNoun(id)
// → Cold storage (150ms)
// → Promoted to warm + hot

// Second access: Hot cache hit
await brain.getNoun(id)
// → Hot cache (<1ms)

// After 10 minutes: Hot evicted, warm hit
await brain.getNoun(id)
// → Warm cache (2ms)
// → Promoted to hot

// After 1 hour: All caches expired
await brain.getNoun(id)
// → Cold storage (150ms)
// → Cycle repeats
```

#### Performance Impact

| Cache Level | Hit Rate | Latency | Memory per 100K Items |
|-------------|----------|---------|----------------------|
| **Hot (LRU)** | 60-80% | <1ms | ~200MB |
| **Warm (TTL)** | 15-30% | 1-5ms | ~100MB |
| **Cold (Disk)** | 5-10% | 10-150ms | 0MB (disk only) |

**Combined Performance:**
- 90%+ requests served from memory
- Average latency: 1-2ms
- Memory usage scales with working set, not total data size

#### What Gets Cached

**HNSW Vector Index:**
- Vector data cached in hot/warm tiers
- Graph connections cached separately
- Adaptive loading based on query patterns

**Graph Adjacency Index:**
- Relationship maps cached in warm tier
- Most-used relationships in hot tier
- Full graph in cold storage

**Metadata Indexes:**
- Field indexes loaded on demand
- Frequently queried indexes stay in warm tier
- Large indexes partially cached

---

## 3. Sharding Strategy

Sharding splits data into 256 buckets for optimal storage performance.

### 3.1 Why Shard?

**Cloud Storage Limitations:**
- GCS/S3: Listing 100K files in one directory = 10-30 seconds
- GCS/S3: Max recommended files per directory = 1,000-10,000
- Network: Parallel operations faster than sequential

**Solution:** Split into 256 shards = ~3,900 files per shard

---

### 3.2 How Sharding Works

**Algorithm:** Extract first 2 hex characters from UUID

```
UUID: 3fa85f64-5717-4562-b3fc-2c963f66afa6
       ^^
Shard: 3f
```

**Properties:**
- **Deterministic:** Same UUID always maps to same shard
- **Uniform:** UUIDs distribute evenly across shards
- **Predictable:** Easy to compute, no randomness
- **Efficient:** Simple string operation (O(1))

**Shard Distribution (1M entities):**
```
Shard 00: ~3,900 entities
Shard 01: ~3,900 entities
...
Shard fe: ~3,900 entities
Shard ff: ~3,900 entities
Total: 256 shards × 3,900 = ~1,000,000 entities
```

---

### 3.3 When to Shard vs. Not Shard

| Data Type | Shard? | Why? |
|-----------|--------|------|
| **Entity vectors** | ✅ Yes | Millions of files |
| **Entity metadata** | ✅ Yes | Millions of files |
| **Verb vectors** | ✅ Yes | Millions of files |
| **Verb metadata** | ✅ Yes | Millions of files |
| **System metadata** | ❌ No | Only 10-200 files |
| **Statistics** | ❌ No | Single file |
| **Indexes** | ❌ No | 10-100 files |

**Key Principle:** Shard by **entity UUID**, not by key type.

---

### 3.4 Performance Impact

**Without Sharding (1M entities):**
```
List directory: 30 seconds
Find entity: 30 seconds (must list first)
Delete entity: 30 seconds (must list first)
```

**With Sharding (1M entities across 256 shards):**
```
List directory: 120ms (only ~3,900 files)
Find entity: 150ms (list shard + download)
Delete entity: 150ms (list shard + delete)
```

**Speedup:** 200x faster for large datasets

---

## 4. Storage Layout

Complete directory structure for all storage backends.

### 4.1 Full Directory Tree

```
storage-root/
│
├── entities/
│   ├── nouns/
│   │   ├── vectors/           [SHARDED]
│   │   │   ├── 00/
│   │   │   │   ├── 00123456-1234-5678-9abc-def012345678.json
│   │   │   │   ├── 00abcdef-1234-5678-9abc-def012345678.json
│   │   │   │   └── ... (~3,900 files)
│   │   │   ├── 01/
│   │   │   │   └── ... (~3,900 files)
│   │   │   ├── 02/ - fe/ ...
│   │   │   └── ff/
│   │   │       └── ... (~3,900 files)
│   │   │
│   │   └── metadata/          [SHARDED]
│   │       ├── 00/
│   │       │   ├── 00123456-1234-5678-9abc-def012345678.json
│   │       │   └── ... (~3,900 files)
│   │       ├── 01/ - fe/ ...
│   │       └── ff/
│   │
│   └── verbs/
│       ├── vectors/           [SHARDED]
│       │   ├── 00/
│       │   │   └── ... (~3,900 files)
│       │   ├── 01/ - fe/ ...
│       │   └── ff/
│       │
│       └── metadata/          [SHARDED]
│           ├── 00/
│           │   └── ... (~3,900 files)
│           ├── 01/ - fe/ ...
│           └── ff/
│
└── _system/                   [NOT SHARDED]
    ├── __metadata_field_index__status.json
    ├── __metadata_field_index__type.json
    ├── __metadata_sorted_index__createdAt.json
    ├── __metadata_sorted_index__updatedAt.json
    ├── statistics.json
    └── counts.json
```

---

### 4.2 File Count Breakdown (1M Entities Example)

| Directory | File Count | Size per File | Total Size |
|-----------|-----------|---------------|------------|
| `entities/nouns/vectors/**` | 1,000,000 | ~4KB | ~4GB |
| `entities/nouns/metadata/**` | 1,000,000 | ~2KB | ~2GB |
| `entities/verbs/vectors/**` | 1,000,000 | ~2KB | ~2GB |
| `entities/verbs/metadata/**` | 1,000,000 | ~500B | ~500MB |
| `_system/**` | ~50-200 | ~1-500KB | ~5-10MB |
| **Total** | **~4,000,100** | | **~8.5GB** |

---

### 4.3 Storage Backend Mapping

All storage backends follow the same structure:

#### Google Cloud Storage (GCS)
```
gs://my-bucket/
  ├── entities/nouns/vectors/00/00123456-uuid.json
  ├── entities/nouns/metadata/00/00123456-uuid.json
  └── _system/__metadata_field_index__status.json
```

#### AWS S3 / MinIO
```
s3://my-bucket/
  ├── entities/nouns/vectors/00/00123456-uuid.json
  ├── entities/nouns/metadata/00/00123456-uuid.json
  └── _system/__metadata_field_index__status.json
```

#### Local Filesystem
```
/path/to/brainy-data/
  ├── entities/nouns/vectors/00/00123456-uuid.json
  ├── entities/nouns/metadata/00/00123456-uuid.json
  └── _system/__metadata_field_index__status.json
```

#### OPFS (Browser)
```
opfs://root/brainy/
  ├── entities/nouns/vectors/00/00123456-uuid.json
  ├── entities/nouns/metadata/00/00123456-uuid.json
  └── _system/__metadata_field_index__status.json
```

**Key Point:** Storage structure is **identical** across all backends.

---

### 4.4 Path Resolution Examples

#### Entity Paths (Sharded by UUID)
```typescript
// Entity UUID
const entityId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"

// Computed shard
const shard = entityId.substring(0, 2) // "3f"

// Paths
vector:   entities/nouns/vectors/3f/3fa85f64-5717-4562-b3fc-2c963f66afa6.json
metadata: entities/nouns/metadata/3f/3fa85f64-5717-4562-b3fc-2c963f66afa6.json
```

#### System Paths (Not Sharded)
```typescript
// System keys
const indexKey = "__metadata_field_index__status"

// Path (no shard directory)
_system/__metadata_field_index__status.json
```

---

## Performance Characteristics

### Read Performance

| Operation | No Sharding | With Sharding | Improvement |
|-----------|-------------|---------------|-------------|
| Get entity by ID | 15-30s | 100-150ms | **200x faster** |
| List all entities | 30-60s | 30-60s | Same |
| Filter by metadata | 10-30s | 5-50ms | **100-600x faster** (via indexes) |
| Semantic search | N/A | 1-10ms | N/A (requires HNSW) |

### Write Performance

| Operation | No Sharding | With Sharding | Improvement |
|-----------|-------------|---------------|-------------|
| Add entity | 15-30s | 100-150ms | **200x faster** |
| Update entity | 15-30s | 100-150ms | **200x faster** |
| Delete entity | 15-30s | 100-150ms | **200x faster** |
| Batch insert (1000) | 4-8 hours | 2-3 minutes | **120x faster** |

### Scale Limits

| Storage Backend | Max Entities (No Shard) | Max Entities (Sharded) |
|----------------|-------------------------|------------------------|
| GCS | ~10,000 | **10M+** |
| S3 | ~10,000 | **10M+** |
| Filesystem | ~100,000 | **10M+** |
| OPFS | ~50,000 | **1M+** (browser limits) |
| Memory | Limited by RAM | Limited by RAM |

---

## Best Practices

### 1. Data Organization

✅ **Do:**
- Use UUIDs for all entities and relationships
- Let Brainy handle sharding automatically
- Use metadata indexes for filtering

❌ **Don't:**
- Try to organize files manually
- Assume file paths are predictable
- Store large binary data in metadata

### 2. Metadata Design

✅ **Do:**
- Keep metadata small (<10KB per entity) for optimal performance
- Index frequently filtered fields
- Use appropriate data types (numbers for dates)
- Store large metadata when needed (with performance considerations)
- Consider pagination when retrieving entities with large metadata

❌ **Don't:**
- Use strings for numeric data (prevents range queries)
- Create unnecessary custom fields (increases index size)
- Index high-cardinality fields with millions of unique values

#### Large Metadata Handling

Brainy supports storing large metadata (10KB - 1MB+) per entity. Performance considerations:

**Performance Impact:**
- Small metadata (<10KB): ~100-150ms read latency
- Medium metadata (10-100KB): ~150-300ms read latency
- Large metadata (100KB-1MB): ~300-1000ms read latency

**Best Practices for Large Metadata:**
```typescript
// ✅ Good: Structure data hierarchically
{
  summary: { /* small, frequently accessed */ },
  details: { /* larger, occasionally accessed */ },
  rawData: { /* large, rarely accessed */ }
}

// ✅ Good: Use pagination when retrieving
const results = await brain.getNouns({
  filter: { type: 'document' },
  limit: 10  // Fetch 10 at a time, not all
})

// ❌ Avoid: Loading all large metadata at once
const allDocs = await brain.getNouns({
  filter: { type: 'document' }  // Could load 1000s of large objects
})
```

**When to Use Large Metadata:**
- Document storage (text content, embeddings)
- Rich user profiles (preferences, history)
- Detailed analytics data
- Configuration objects

**Alternative Approaches:**
- For binary data (images, PDFs): Store URLs, not raw content
- For very large datasets (>1MB): Consider separate blob storage
- For frequently accessed data: Keep summaries in metadata, full content elsewhere

### 3. Querying

✅ **Do:**
- Use metadata filters when possible
- Limit result sets with pagination
- Use semantic search for similarity queries

❌ **Don't:**
- Load all entities into memory
- Filter in application code
- Scan all entities for simple queries

---

## Summary

**Data Storage:**
- 3 data types: Entities (nouns), Relationships (verbs), System metadata
- Each entity/relationship = 2 files (vector + metadata)
- Millions of entities scale efficiently with sharding

**Indexing:**
- HNSW index: Semantic similarity search (in-memory)
- Graph index: Relationship navigation (in-memory)
- Metadata indexes: Business logic filtering (on-disk)

**Sharding:**
- 256 shards based on UUID prefix
- ~3,900 entities per shard (at 1M scale)
- 200x performance improvement for cloud storage
- Automatic, transparent to users

**Storage Layout:**
- Consistent across all backends (GCS, S3, OPFS, FS)
- Entity data: Sharded by UUID
- System data: Not sharded
- Predictable, scalable, performant

---

## Next Steps

- [Storage Adapter Guide](./storage-adapters.md) - Implement custom storage backends
- [Performance Tuning](./performance-tuning.md) - Optimize for your use case
- [Scaling Guide](./scaling-guide.md) - Handle 10M+ entities

---

**Version:** 3.30.0
**Last Updated:** 2025-10-09
