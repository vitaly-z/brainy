# Brainy Data Storage Architecture

**Complete file structure reference for all storage backends**

This document explains how Brainy stores, indexes, and scales data across all storage backends (GCS, S3, R2, Azure, filesystem, OPFS, memory).

---

## Table of Contents

1. [Complete File Structure](#1-complete-file-structure)
2. [What Gets Stored](#2-what-gets-stored)
3. [The 4 Indexes](#3-the-4-indexes)
4. [Sharding Strategy](#4-sharding-strategy)
5. [COW (Copy-on-Write) Architecture](#5-cow-copy-on-write-architecture)
6. [ID-First Storage Architecture](#6-id-first-storage-architecture-v600)
7. [VFS (Virtual File System)](#7-vfs-virtual-file-system)
8. [Storage Backend Mapping](#8-storage-backend-mapping)
9. [Performance Characteristics](#9-performance-characteristics)

---

## 1. Complete File Structure

### v5.11.0 Full Directory Tree

```
brainy-data/                                  # Root directory (or bucket name for cloud)
│
├── branches/                                 # Branch-scoped storage (v5.4.0+, COW always-on)
│   ├── main/                                # Main branch (default)
│   │   └── entities/
│   │       ├── nouns/
│   │       │   ├── Character/              # Type-first: entities organized by type
│   │       │   │   ├── vectors/
│   │       │   │   │   ├── 00/            # UUID-based sharding (256 shards)
│   │       │   │   │   │   ├── 001234...uuid.json    # HNSW vector + connections
│   │       │   │   │   │   └── 00abcd...uuid.json
│   │       │   │   │   ├── 01/ ... fe/
│   │       │   │   │   └── ff/
│   │       │   │   └── metadata/
│   │       │   │       ├── 00/
│   │       │   │       │   ├── 001234...uuid.json    # Business metadata only
│   │       │   │       │   └── 00abcd...uuid.json
│   │       │   │       ├── 01/ ... fe/
│   │       │   │       └── ff/
│   │       │   │
│   │       │   ├── Place/                  # Another type
│   │       │   │   ├── vectors/
│   │       │   │   │   ├── 00/ ... ff/
│   │       │   │   └── metadata/
│   │       │   │       ├── 00/ ... ff/
│   │       │   │
│   │       │   ├── Concept/
│   │       │   ├── Organization/
│   │       │   ├── Event/
│   │       │   └── [42 total noun types]
│   │       │
│   │       └── verbs/
│   │           ├── Knows/                  # Type-first for relationships too
│   │           │   ├── vectors/
│   │           │   │   ├── 00/ ... ff/
│   │           │   └── metadata/
│   │           │       ├── 00/ ... ff/
│   │           │
│   │           ├── LocatedIn/
│   │           ├── WorksFor/
│   │           └── [127 total verb types]
│   │
│   ├── feature-branch-1/                    # Git-like feature branches
│   │   └── entities/
│   │       └── [same structure as main]
│   │
│   └── user-workspace-alice/                # User-specific branches
│       └── entities/
│           └── [same structure as main]
│
├── _cow/                                     # Copy-on-Write version control
│   ├── commits/                             # Git-like commit objects
│   │   ├── 00/
│   │   │   ├── 00a1b2c3...sha256.json      # Commit metadata
│   │   │   └── 00d4e5f6...sha256.json
│   │   ├── 01/ ... fe/
│   │   └── ff/
│   │
│   ├── trees/                               # Directory snapshots
│   │   ├── 00/
│   │   │   ├── 00123456...sha256.json      # Tree object (directory listing)
│   │   │   └── 00789abc...sha256.json
│   │   ├── 01/ ... fe/
│   │   └── ff/
│   │
│   ├── blobs/                               # Content-addressable data storage
│   │   ├── 00/
│   │   │   ├── 00abcdef...sha256.bin       # Deduplicated data blobs
│   │   │   └── 00fedcba...sha256.bin
│   │   ├── 01/ ... fe/
│   │   └── ff/
│   │
│   └── refs/                                # Branch pointers (not sharded)
│       ├── heads/
│       │   ├── main.json                   # Points to latest commit on main
│       │   ├── feature-branch-1.json
│       │   └── user-workspace-alice.json
│       │
│       └── tags/                            # Version tags
│           ├── v1.0.0.json
│           └── stable.json
│
└── _system/                                  # System metadata (not sharded)
    ├── statistics.json                      # Global statistics
    ├── counts.json                          # Entity/verb counts by type
    │
    ├── hnsw/                                # HNSW index metadata
    │   ├── system.json                      # Entry point, max level
    │   └── nodes/
    │       ├── 00/
    │       │   └── 001234...uuid.json      # Per-node HNSW data
    │       ├── 01/ ... fe/
    │       └── ff/
    │
    ├── metadata_indexes/                    # Field indexes for filtering
    │   ├── __metadata_field_index__status.json
    │   ├── __metadata_field_index__category.json
    │   ├── __metadata_sorted_index__createdAt.json
    │   └── [dynamic based on metadata fields]
    │
    └── vfs/                                 # Virtual File System (v5.0+)
        ├── root/                            # VFS root directory
        │   ├── 00000000-0000-0000-0000-000000000000.json  # Root dir entity
        │   └── files/
        │       ├── 12345678-...uuid.json   # File entities
        │       └── 87654321-...uuid.json   # Folder entities
        │
        └── metadata/                        # VFS-specific metadata
            └── registry.json                # VFS entity registry
```

---

## 2. What Gets Stored

### 2.1 Entities (Nouns) - Split into 2 Files

Each entity is stored as **2 separate files** for optimal performance.

#### Vector File
**Location**: `branches/{branch}/entities/nouns/{type}/vectors/{shard}/{uuid}.json`

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vector": [0.1, 0.2, 0.3, ...],  // 384-dimensional embedding
  "connections": {                  // HNSW graph connections
    "0": ["uuid1", "uuid2"],       // Layer 0 neighbors
    "1": ["uuid3", "uuid4"]        // Layer 1 neighbors
  },
  "level": 2                        // HNSW max level for this node
}
```

**Purpose**: HNSW graph navigation for semantic search
**Size**: ~4KB per entity (384 dims × 4 bytes × 2.6 overhead)
**Scale**: Millions of entities

#### Metadata File
**Location**: `branches/{branch}/entities/nouns/{type}/metadata/{shard}/{uuid}.json`

```json
{
  "type": "Character",
  "name": "Alice",
  "age": 30,
  "occupation": "Software Engineer",
  "location": "San Francisco",
  "createdAt": 1699564234567,
  "customField": "custom value",
  "_vfs": {                          // VFS metadata (if applicable)
    "path": "/documents/alice.txt",
    "parentId": "parent-uuid",
    "isDirectory": false,
    "size": 1024
  }
}
```

**Purpose**: Business data and filtering
**Size**: ~1-10KB per entity (varies by metadata complexity)
**Scale**: Millions of entities

---

### 2.2 Relationships (Verbs) - Split into 2 Files

Each relationship is also stored as **2 separate files**.

#### Vector File
**Location**: `branches/{branch}/entities/verbs/{type}/vectors/{shard}/{uuid}.json`

```json
{
  "id": "7b2f5e3c-8d4a-4f1e-9c2b-5a6d7e8f9a0b",
  "vector": [0.5, 0.3, 0.7, ...],  // Relationship embedding
  "connections": {
    "0": ["verb-uuid1", "verb-uuid2"]  // Verb-to-verb HNSW connections
  },
  "level": 1
}
```

**Purpose**: Relationship similarity for semantic graph queries
**Size**: ~2KB per relationship
**Scale**: Millions of relationships

#### Metadata File
**Location**: `branches/{branch}/entities/verbs/{type}/metadata/{shard}/{uuid}.json`

```json
{
  "sourceId": "user-uuid",          // Source entity
  "targetId": "product-uuid",       // Target entity
  "type": "Purchased",              // Verb type
  "weight": 1.0,
  "timestamp": 1699564234567,
  "metadata": {
    "amount": 99.99,
    "quantity": 2,
    "paymentMethod": "credit_card"
  }
}
```

**Purpose**: Graph structure (edges) and relationship data
**Size**: ~500 bytes per relationship
**Scale**: Millions of relationships

---

### 2.3 COW (Copy-on-Write) Data

#### Commit Objects
**Location**: `_cow/commits/{shard}/{sha256}.json`

```json
{
  "tree": "tree-sha256-hash",       // Root tree snapshot
  "parent": "parent-commit-sha256", // Previous commit (null for first)
  "author": "user@example.com",
  "timestamp": 1699564234567,
  "message": "Add new characters",
  "branch": "main"
}
```

**Purpose**: Git-like version history
**Size**: ~300 bytes per commit
**Scale**: Thousands of commits

#### Tree Objects
**Location**: `_cow/trees/{shard}/{sha256}.json`

```json
{
  "entries": [
    {
      "type": "tree",
      "name": "entities/nouns/Character",
      "hash": "subtree-sha256-hash"
    },
    {
      "type": "blob",
      "name": "entities/nouns/Character/vectors/00/001234...uuid.json",
      "hash": "blob-sha256-hash"
    }
  ]
}
```

**Purpose**: Directory snapshots (like git trees)
**Size**: ~1-50KB per tree (varies by directory size)
**Scale**: Thousands of trees

#### Blob Objects
**Location**: `_cow/blobs/{shard}/{sha256}.bin`

```
[Binary data - deduplicated content]
```

**Purpose**: Content-addressable storage (deduplication)
**Size**: Varies (1KB - 1MB typical)
**Scale**: Millions of blobs
**Compression**: Optional zstd compression for >4KB blobs

#### Refs (Branch Pointers)
**Location**: `_cow/refs/heads/{branch}.json`

```json
{
  "commit": "latest-commit-sha256-hash",
  "updated": 1699564234567
}
```

**Purpose**: Branch head tracking (like git refs)
**Size**: ~100 bytes per ref
**Scale**: Dozens to hundreds of branches

---

### 2.4 System Metadata

Unlike entities and relationships, system metadata consists of **index files** that enable fast lookups without scanning millions of entities.

**Purpose**: Fast filtering and range queries
**Scale**: 50-200 files total (NOT per-entity!)
**Location**: `_system/` (not sharded, not branched)

#### Statistics
**Location**: `_system/statistics.json`

```json
{
  "nounCount": {
    "Character": 50000,
    "Place": 30000,
    "Concept": 20000
  },
  "verbCount": {
    "Knows": 100000,
    "LocatedIn": 75000
  },
  "metadataCount": {
    "Character": 50000,
    "Place": 30000
  },
  "hnswIndexSize": 204800,
  "totalNodes": 100000,
  "totalEdges": 175000,
  "lastUpdated": "2025-11-18T..."
}
```

**Purpose**: Global statistics for monitoring and optimization

#### Counts (Entity Type Counts)
**Location**: `_system/counts.json`

```json
{
  "nouns": {
    "Character": 50000,
    "Place": 30000,
    "Concept": 20000,
    "Organization": 15000
  },
  "verbs": {
    "Knows": 100000,
    "LocatedIn": 75000,
    "WorksFor": 50000
  },
  "total": {
    "nouns": 115000,
    "verbs": 225000
  },
  "lastUpdated": 1699564234567
}
```

**Purpose**: Fast entity/verb counts by type without scanning storage

#### HNSW System Metadata
**Location**: `_system/hnsw/system.json`

```json
{
  "entryPointId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "maxLevel": 4,
  "totalNodes": 100000,
  "lastUpdated": 1699564234567
}
```

**Purpose**: HNSW index entry point and global parameters

#### HNSW Node Data
**Location**: `_system/hnsw/nodes/{shard}/{uuid}.json`

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "level": 2,
  "connections": {
    "0": ["uuid1", "uuid2", "uuid3"],  // Layer 0 neighbors
    "1": ["uuid4", "uuid5"],            // Layer 1 neighbors
    "2": ["uuid6"]                      // Layer 2 neighbors
  }
}
```

**Purpose**: Per-node HNSW graph connections (persisted for fast rebuild)

#### Field Indexes (Hash Indexes)
**Location**: `_system/metadata_indexes/__metadata_field_index__{field}.json`

```json
{
  "values": {
    "active": 80000,      // Count of entities with status=active
    "pending": 15000,
    "deleted": 5000
  },
  "lastUpdated": 1699564234567
}
```

**Purpose**: Fast exact-match filtering without scanning all entities

#### Sorted Indexes (Range Queries)
**Location**: `_system/metadata_indexes/__metadata_sorted_index__{field}.json`

```json
{
  "values": [
    [1704067200000, ["uuid1", "uuid2", "uuid3"]],  // Jan 1, 2024
    [1704153600000, ["uuid4", "uuid5"]],            // Jan 2, 2024
    [1704240000000, ["uuid6"]]                      // Jan 3, 2024
  ],
  "fieldType": "number"
}
```

**Purpose**: Fast range queries (e.g., "created after Jan 1, 2024")

---

## 2.5 Path Construction Algorithm

Understanding how Brainy constructs storage paths is critical for debugging and optimization.

### Path Construction Steps

**For an entity (noun)**:
```typescript
// Given:
const entityId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
const branch = "main"

// Step 1: Extract shard from UUID (first 2 hex characters)
const shard = entityId.substring(0, 2)  // "3f"

// Step 2: Construct metadata path (NO TYPE NEEDED!)
const metadataPath = `branches/${branch}/entities/nouns/${shard}/${entityId}/metadata.json`
// Result: "branches/main/entities/nouns/3f/3fa85f64-5717-4562-b3fc-2c963f66afa6/metadata.json"

// Step 3: Construct vector path
const vectorPath = `branches/${branch}/entities/nouns/${shard}/${entityId}/vector.json`
// Result: "branches/main/entities/nouns/3f/3fa85f64-5717-4562-b3fc-2c963f66afa6/vector.json"

// Type is IN the metadata, not in the path!
```

**For a relationship (verb)**:
```typescript
// Given:
const verbId = "7b2f5e3c-8d4a-4f1e-9c2b-5a6d7e8f9a0b"
const branch = "main"

// Step 1: Extract shard
const shard = verbId.substring(0, 2)  // "7b"

// Step 2: Construct paths (NO TYPE NEEDED!)
const metadataPath = `branches/${branch}/entities/verbs/${shard}/${verbId}/metadata.json`
const vectorPath = `branches/${branch}/entities/verbs/${shard}/${verbId}/vector.json`
```

**For COW objects**:
```typescript
// Commits, trees, blobs use content hash as filename
const commitHash = "00a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef012345678"
const shard = commitHash.substring(0, 2)  // "00"
const commitPath = `_cow/commits/${shard}/${commitHash}.json`

// Refs don't use sharding
const branchRefPath = `_cow/refs/heads/${branch}.json`
const tagRefPath = `_cow/refs/tags/${tagName}.json`
```

**For system files**:
```typescript
// System files never use sharding or branching
const statsPath = `_system/statistics.json`
const countsPath = `_system/counts.json`
const hnswSystemPath = `_system/hnsw/system.json`
const fieldIndexPath = `_system/metadata_indexes/__metadata_field_index__${fieldName}.json`

// HNSW node data IS sharded (entity UUID-based)
const hnswNodePath = `_system/hnsw/nodes/${shard}/${entityId}.json`
```

### Path Patterns Summary

| Data Type | Path Pattern | Sharded? | Branched? |
|-----------|--------------|----------|-----------|
| **Noun metadata** | `branches/{branch}/entities/nouns/{shard}/{uuid}/metadata.json` | ✅ Yes (UUID) | ✅ Yes |
| **Noun vector** | `branches/{branch}/entities/nouns/{shard}/{uuid}/vector.json` | ✅ Yes (UUID) | ✅ Yes |
| **Verb metadata** | `branches/{branch}/entities/verbs/{shard}/{uuid}/metadata.json` | ✅ Yes (UUID) | ✅ Yes |
| **Verb vector** | `branches/{branch}/entities/verbs/{shard}/{uuid}/vector.json` | ✅ Yes (UUID) | ✅ Yes |
| **COW commit** | `_cow/commits/{shard}/{sha256}.json` | ✅ Yes (SHA) | ❌ No |
| **COW tree** | `_cow/trees/{shard}/{sha256}.json` | ✅ Yes (SHA) | ❌ No |
| **COW blob** | `_cow/blobs/{shard}/{sha256}.bin` | ✅ Yes (SHA) | ❌ No |
| **COW ref** | `_cow/refs/heads/{branch}.json` | ❌ No | ❌ No |
| **Statistics** | `_system/statistics.json` | ❌ No | ❌ No |
| **Counts** | `_system/counts.json` | ❌ No | ❌ No |
| **HNSW system** | `_system/hnsw/system.json` | ❌ No | ❌ No |
| **HNSW node** | `_system/hnsw/nodes/{shard}/{uuid}.json` | ✅ Yes (UUID) | ❌ No |
| **Field index** | `_system/metadata_indexes/__metadata_field_index__{field}.json` | ❌ No | ❌ No |

### Key Principles

1. **Shard Extraction**: Always use first 2 hex characters of UUID/SHA-256
2. **ID-First**: Shard + ID come BEFORE type (type is in metadata)
3. **Branch Isolation**: Only entity data uses branches/
4. **System Isolation**: System files never use sharding or branching (except HNSW nodes)
5. **Content-Addressable**: COW uses SHA-256 hash as filename

---

## 3. The 4 Indexes

Brainy uses four complementary index systems for different query patterns.

### 3.1 HNSW Vector Index (In-Memory with Lazy Loading)

**Purpose**: Semantic similarity search
**Location**: RAM (rebuilt from storage on startup)
**Data Structure**: Hierarchical graph of vector connections

**How It Works**:
1. Loads `branches/{branch}/entities/nouns/{type}/vectors/**/*.json` files
2. Builds HNSW graph structure in memory
3. Enables O(log n) approximate nearest neighbor search
4. Vectors loaded on-demand in lazy mode (zero configuration)

**Performance**:
- Build time: 1-5 seconds per 100K entities
- Query time: 1-10ms for k=10 results (standard mode)
- Query time: 2-15ms for k=10 results (lazy mode, with cache)
- Memory (standard): ~200MB per 100K entities
- Memory (lazy): ~15-33MB per 100K entities (5-10x less!)

**Automatic Lazy Mode**: Enables automatically when vectors don't fit in UnifiedCache

---

### 3.2 Type Index (Metadata-Based, v6.0.0+)

**Purpose**: Fast type filtering via metadata index
**Location**: MetadataIndexManager index on `noun` field
**Data Structure**: RoaringBitmap32 per type value

**How It Works**:
```typescript
// Find all Person entities
const people = await brain.getNouns({ type: 'person' })

// Under the hood:
// 1. MetadataIndexManager.getFieldIndex('noun')
// 2. Returns RoaringBitmap32 of IDs where metadata.noun === 'person'
// 3. Batch fetch those IDs using ID-first paths
```

**Performance**:
- Type filtering: O(person_count) via metadata index (not O(total_entities))
- Index lookup: O(1) bitmap intersection
- No filesystem scanning needed
- Works at billion-scale with compressed bitmaps

---

### 3.3 Graph Adjacency Index (In-Memory, LSM-Tree)

**Purpose**: Navigate relationships (graph queries)
**Location**: RAM (rebuilt from storage on startup)
**Data Structure**: Bidirectional LSM-tree mappings

```typescript
{
  sourceToTargets: Map<string, Set<string>>,  // "user-uuid" → ["product1", "product2"]
  targetToSources: Map<string, Set<string>>   // "product1" → ["user1", "user2"]
}
```

**Example Query**:
```typescript
// Find all products purchased by a user
const verbs = await brain.getVerbsBySource("user-uuid")

// Find all users who purchased a product
const verbs = await brain.getVerbsByTarget("product-uuid")
```

**Performance**:
- Build time: 0.5-2 seconds per 100K relationships
- Query time: <1ms (O(1) lookup)
- Memory: ~100MB per 100K relationships

---

### 3.4 Metadata Field Indexes (On-Disk)

**Purpose**: Filter by business fields without loading all entities
**Location**: `_system/metadata_indexes/`
**Data Structure**: Field → Value → IDs mapping

**Example Query**:
```typescript
// Find all active users
const users = await brain.getNouns({
  filter: { metadata: { status: 'active' } }
})
// Uses: _system/metadata_indexes/__metadata_field_index__status.json
// Returns: ~1000 IDs in 5ms (vs scanning 1M entities)
```

**Performance**:
- Exact match: O(1) hash lookup
- Range query: O(log n) binary search (sorted indexes)
- Filter time: 5-50ms for 1M entities

---

## 4. Sharding Strategy

### 4.1 Why Shard?

**Cloud Storage Limitations**:
- GCS/S3: Listing 100K files in one directory = 10-30 seconds
- GCS/S3: Max recommended files per directory = 1,000-10,000
- Network: Parallel operations faster than sequential

**Solution**: Split into 256 shards = ~3,900 files per shard at 1M scale

---

### 4.2 How Sharding Works

**Algorithm**: Extract first 2 hex characters from UUID

```
UUID: 3fa85f64-5717-4562-b3fc-2c963f66afa6
       ^^
Shard: 3f
```

**Properties**:
- **Deterministic**: Same UUID always maps to same shard
- **Uniform**: UUIDs distribute evenly across shards
- **Predictable**: Easy to compute, no randomness
- **Efficient**: Simple string operation (O(1))

**Shard Distribution (1M entities)**:
```
Shard 00: ~3,900 entities
Shard 01: ~3,900 entities
...
Shard fe: ~3,900 entities
Shard ff: ~3,900 entities
Total: 256 shards × 3,900 = ~1,000,000 entities
```

---

### 4.3 What Gets Sharded vs. Not Sharded

| Data Type | Sharded? | Path Pattern |
|-----------|----------|--------------|
| **Noun vectors** | ✅ Yes | `branches/{branch}/entities/nouns/{type}/vectors/{shard}/{uuid}.json` |
| **Noun metadata** | ✅ Yes | `branches/{branch}/entities/nouns/{type}/metadata/{shard}/{uuid}.json` |
| **Verb vectors** | ✅ Yes | `branches/{branch}/entities/verbs/{type}/vectors/{shard}/{uuid}.json` |
| **Verb metadata** | ✅ Yes | `branches/{branch}/entities/verbs/{type}/metadata/{shard}/{uuid}.json` |
| **COW commits** | ✅ Yes | `_cow/commits/{shard}/{sha256}.json` |
| **COW trees** | ✅ Yes | `_cow/trees/{shard}/{sha256}.json` |
| **COW blobs** | ✅ Yes | `_cow/blobs/{shard}/{sha256}.bin` |
| **COW refs** | ❌ No | `_cow/refs/heads/{branch}.json` |
| **System metadata** | ❌ No | `_system/statistics.json` |
| **Indexes** | ❌ No | `_system/metadata_indexes/*.json` |

**Key Principle**: Shard by **UUID** (entity IDs, commit hashes), not by type or field.

---

### 4.4 Performance Impact

**Without Sharding (1M entities)**:
```
List directory: 30 seconds
Find entity: 30 seconds (must list first)
Delete entity: 30 seconds (must list first)
```

**With Sharding (1M entities across 256 shards)**:
```
List directory: 120ms (only ~3,900 files)
Find entity: 150ms (list shard + download)
Delete entity: 150ms (list shard + delete)
```

**Speedup**: 200x faster for large datasets

---

## 5. COW (Copy-on-Write) Architecture

### 5.1 What is COW?

COW is Brainy's **git-like versioning system** that enables:
- ✅ **Time-travel queries** (query data as it existed at any point in time)
- ✅ **Instant branches** (create lightweight branches in milliseconds)
- ✅ **Efficient forks** (zero-copy duplication via lazy COW)
- ✅ **Deduplication** (identical data stored only once)
- ✅ **Version history** (full audit trail of all changes)

**Status**: ALWAYS ENABLED - cannot be disabled

---

### 5.2 COW Directory Structure

```
_cow/
├── commits/        # Commit objects (version history)
├── trees/          # Directory snapshots
├── blobs/          # Content-addressable data storage
└── refs/           # Branch pointers
    ├── heads/      # Branch heads (main, feature branches)
    └── tags/       # Version tags (v1.0.0, stable, etc.)
```

---

### 5.3 How COW Works

**When you add data**:
1. Data written to `branches/main/entities/nouns/Character/...`
2. Commit object created in `_cow/commits/{sha}/`
3. Tree objects created for directory structure
4. Blobs created for content (deduplicated by SHA-256)
5. `_cow/refs/heads/main.json` updated to point to new commit

**When you query `brain.asOf(timestamp)`**:
1. Find commit at specified timestamp
2. Load tree from commit
3. Lazy-load entities from historical tree structure
4. Return read-only view (no writes allowed)

**When you create a branch**:
1. Copy `_cow/refs/heads/main.json` → `_cow/refs/heads/feature.json`
2. Create `branches/feature/` directory (initially empty)
3. Lazy COW: Only modified files copied, rest shared with main
4. Result: Instant branch creation (milliseconds)

---

### 5.4 Deduplication

**Content-addressable storage** means identical data is stored only once:

```
// Two entities with identical vector data
Entity A: vector = [0.1, 0.2, 0.3, ...]  → SHA-256 = abc123...
Entity B: vector = [0.1, 0.2, 0.3, ...]  → SHA-256 = abc123... (same!)

// Only ONE blob stored:
_cow/blobs/ab/abc123...sha256.bin  (used by both entities)
```

**Deduplication savings**:
- Typical: 10-30% storage reduction
- Forks/branches: 70-90% reduction (shared data not duplicated)
- Identical imports: 95%+ reduction

---

## 6. ID-First Storage Architecture

### 6.1 What is ID-First?

**ID-first storage** organizes entities by **ID shard only** - no type directories! This eliminates 42-type sequential searches that caused 20-21 second delays on cloud storage.

**Old type-first structure** (v5.12.0):
```
branches/main/entities/nouns/{TYPE}/metadata/00/001234...uuid.json
# Problem: Requires knowing type OR searching 42 type directories!
```

**NEW ID-first structure**:
```
branches/main/entities/nouns/00/001234...uuid/metadata.json
# Direct O(1) lookup - no type needed!
```

---

### 6.2 Benefits of ID-First

**1. 40x Faster Lookups**
```typescript
// v5.x: Had to search 42 types if type unknown
// Result: 21 seconds on GCS (42 types × 500ms)

// Direct path from ID
const id = '001234...'
const shard = id.substring(0, 2)  // '00'
const path = `branches/main/entities/nouns/${shard}/${id}/metadata.json`
// Result: <500ms on GCS - 40x faster!
```

**2. Simpler Code**
- **Removed 500+ lines** of type cache management
- **No more** nounTypeCache Map tracking
- **No more** persistent type index complexity
- **No more** 42-type fallback search logic

**3. Billion-Scale Ready**
- Type information stored in **metadata** field (indexed by MetadataIndexManager)
- Type queries still fast via metadata index
- No type cache sync issues in distributed systems

**4. Clean Architecture**
- One path per ID - no ambiguity
- Predictable storage layout
- Easier to debug and reason about

---

### 6.3 ID-First Path Structure

**v6.0.0 Path Structure:**
```
branches/{branch}/entities/nouns/{shard}/{id}/metadata.json
branches/{branch}/entities/nouns/{shard}/{id}/vector.json
branches/{branch}/entities/verbs/{shard}/{id}/metadata.json
branches/{branch}/entities/verbs/{shard}/{id}/vector.json
```

**Breakdown**:
- `branches/{branch}`: Branch isolation (main, feature branches, user workspaces)
- `entities/nouns` or `entities/verbs`: Entity vs. relationship
- `{shard}`: UUID-based shard (00-ff, 256 total) - **comes FIRST now!**
- `{id}`: Full entity UUID
- `metadata.json` or `vector.json`: Separate files for metadata vs vectors

**Key Change:** Shard + ID come **before** type, not after!

---

### 6.4 Type Queries Still Work!

**How do we filter by type without type directories?**

The `metadata.noun` field is **indexed by MetadataIndexManager**:

```typescript
// Find all Person entities - still fast!
const people = await brain.getNouns({ type: 'person' })

// Under the hood:
// 1. MetadataIndexManager has index on 'noun' field
// 2. Returns all IDs where metadata.noun === 'person'
// 3. Batch fetch those IDs using ID-first paths
// Result: Still O(person_count), not O(total_entities)
```

**Supported Types (unchanged):**
- **42 Noun Types**: Person, Organization, Location, Thing, Concept, Event, Agent, etc.
- **127 Verb Types**: Knows, LocatedIn, WorksFor, HasProperty, etc.
- See [noun-verb-taxonomy.md](./noun-verb-taxonomy.md) for complete list

**Type is metadata, not storage structure!**

---

## 7. VFS (Virtual File System)

### 7.1 What is VFS?

**VFS** lets you store traditional file/folder hierarchies in Brainy's graph database.

**Example**:
```
/documents/
  ├── reports/
  │   ├── Q1.pdf (stored as entity)
  │   └── Q2.pdf (stored as entity)
  └── notes/
      └── meeting.txt (stored as entity)
```

Each file/folder is a **regular Brainy entity** with special VFS metadata.

---

### 7.2 VFS Storage Structure

**File Entity**:
```json
// branches/main/entities/nouns/File/metadata/12/123456...uuid.json
{
  "type": "File",
  "name": "Q1.pdf",
  "_vfs": {
    "path": "/documents/reports/Q1.pdf",
    "parentId": "parent-directory-uuid",
    "isDirectory": false,
    "size": 102400,
    "mimeType": "application/pdf",
    "createdAt": 1699564234567,
    "modifiedAt": 1699564234567
  },
  // Regular metadata fields can coexist
  "author": "Alice",
  "department": "Finance"
}
```

**Directory Entity**:
```json
// branches/main/entities/nouns/Collection/metadata/ab/abcdef...uuid.json
{
  "type": "Collection",
  "name": "reports",
  "_vfs": {
    "path": "/documents/reports",
    "parentId": "documents-directory-uuid",
    "isDirectory": true,
    "childrenIds": ["Q1-uuid", "Q2-uuid"]
  }
}
```

**Root Directory** (special fixed UUID):
```json
// branches/main/entities/nouns/Collection/metadata/00/00000000-0000-0000-0000-000000000000.json
{
  "type": "Collection",
  "name": "root",
  "_vfs": {
    "path": "/",
    "parentId": null,
    "isDirectory": true,
    "childrenIds": ["documents-uuid", "projects-uuid"]
  }
}
```

---

### 7.3 VFS + Triple Intelligence

VFS files can use **Triple Intelligence** for semantic extraction:

```typescript
// Upload PDF
const fileId = await brain.vfs.uploadFile('/documents/report.pdf', pdfBuffer)

// Triple Intelligence extracts:
// - Entities: People, organizations, locations mentioned
// - Relationships: Who works where, who knows who
// - Concepts: Key themes and topics

// Query semantically
const related = await brain.find('financial projections for Q2')
// Returns: report.pdf + extracted entities + relationships
```

**Storage**: Extracted entities stored as regular entities in type-first structure, linked to file via relationships.

---

## 8. Storage Backend Mapping

### 8.1 All Backends Use Same Structure

**Filesystem** (local):
```
/path/to/brainy-data/
  ├── branches/main/entities/nouns/Character/vectors/00/001234...uuid.json
  ├── _cow/commits/00/00a1b2c3...sha256.json
  └── _system/statistics.json
```

**Google Cloud Storage** (GCS):
```
gs://my-bucket/
  ├── branches/main/entities/nouns/Character/vectors/00/001234...uuid.json
  ├── _cow/commits/00/00a1b2c3...sha256.json
  └── _system/statistics.json
```

**AWS S3** / **MinIO** / **DigitalOcean Spaces**:
```
s3://my-bucket/
  ├── branches/main/entities/nouns/Character/vectors/00/001234...uuid.json
  ├── _cow/commits/00/00a1b2c3...sha256.json
  └── _system/statistics.json
```

**Cloudflare R2**:
```
r2://my-bucket/
  ├── branches/main/entities/nouns/Character/vectors/00/001234...uuid.json
  ├── _cow/commits/00/00a1b2c3...sha256.json
  └── _system/statistics.json
```

**Azure Blob Storage**:
```
azure://my-container/
  ├── branches/main/entities/nouns/Character/vectors/00/001234...uuid.json
  ├── _cow/commits/00/00a1b2c3...sha256.json
  └── _system/statistics.json
```

**OPFS** (browser):
```
opfs://root/brainy/
  ├── branches/main/entities/nouns/Character/vectors/00/001234...uuid.json
  ├── _cow/commits/00/00a1b2c3...sha256.json
  └── _system/statistics.json
```

**Memory Storage** (in-memory):
- Uses same path structure
- Stored in `Map<string, any>`
- Key = full path (e.g., "branches/main/entities/nouns/Character/vectors/00/001234...uuid.json")

---

### 8.2 Backend-Specific Optimizations

**Cloud Storage (GCS, S3, R2, Azure)**:
- Lifecycle policies for automatic archival (96% cost savings)
- Intelligent-Tiering (S3) or Autoclass (GCS) for access-pattern optimization
- Batch operations (1000 objects per request for S3)
- Parallel uploads/downloads

**Filesystem**:
- Optional gzip compression (60-80% space savings)
- Direct file I/O (fastest for local)
- Atomic writes with rename

**OPFS**:
- Quota monitoring (browser storage limits)
- Persistent storage (survives page refresh)
- Worker-based I/O (non-blocking)

**Memory**:
- No I/O overhead (instant access)
- No persistence (data lost on restart)
- Ideal for testing and development

---

## 9. Performance Characteristics

### 9.1 File Count (1M Entities Example)

| Directory | File Count | Size per File | Total Size |
|-----------|-----------|---------------|------------|
| `branches/main/entities/nouns/*/vectors/**` | 1,000,000 | ~4KB | ~4GB |
| `branches/main/entities/nouns/*/metadata/**` | 1,000,000 | ~2KB | ~2GB |
| `branches/main/entities/verbs/*/vectors/**` | 1,000,000 | ~2KB | ~2GB |
| `branches/main/entities/verbs/*/metadata/**` | 1,000,000 | ~500B | ~500MB |
| `_cow/commits/**` | ~10,000 | ~300B | ~3MB |
| `_cow/trees/**` | ~50,000 | ~5KB | ~250MB |
| `_cow/blobs/**` | ~2,000,000 | ~2KB | ~4GB |
| `_cow/refs/**` | ~50 | ~100B | ~5KB |
| `_system/**` | ~100 | ~1-500KB | ~10MB |
| **Total** | **~5,060,150** | | **~12.8GB** |

**With deduplication**: ~8.5-10GB (30-40% savings from blob deduplication)

---

### 9.2 Read Performance

| Operation | No Sharding | With Sharding | Improvement |
|-----------|-------------|---------------|-------------|
| Get entity by ID | 15-30s | 100-150ms | **200x faster** |
| List all entities | 30-60s | 30-60s | Same |
| Filter by metadata | 10-30s | 5-50ms | **100-600x faster** (via indexes) |
| Semantic search | N/A | 1-10ms | N/A (requires HNSW) |
| Type filtering | 30-60s | 120-200ms | **150-500x faster** (type-first) |
| Graph query (getVerbsBySource) | O(total_verbs) | <1ms | **O(1) via index** |

---

### 9.3 Write Performance

| Operation | No Sharding | With Sharding | Improvement |
|-----------|-------------|---------------|-------------|
| Add entity | 15-30s | 100-150ms | **200x faster** |
| Update entity | 15-30s | 100-150ms | **200x faster** |
| Delete entity | 15-30s | 100-150ms | **200x faster** |
| Batch insert (1000) | 4-8 hours | 2-3 minutes | **120x faster** |
| Create branch | N/A | 100-200ms | Instant (COW) |
| Commit changes | N/A | 500-1000ms | Automatic (COW) |

---

### 9.4 Scale Limits

| Storage Backend | Max Entities (No Optimization) | Max Entities (Full Optimization) |
|----------------|-------------------------------|----------------------------------|
| GCS | ~10,000 | **10M+** |
| S3 | ~10,000 | **10M+** |
| R2 | ~10,000 | **10M+** |
| Azure | ~10,000 | **10M+** |
| Filesystem | ~100,000 | **10M+** |
| OPFS | ~50,000 | **1M+** (browser limits) |
| Memory | Limited by RAM | Limited by RAM |

**Full optimization** = Sharding + Type-first + COW + Lifecycle policies + Lazy mode

---

### 9.5 Memory Usage

| Component | Standard Mode | Lazy Mode | Savings |
|-----------|---------------|-----------|---------|
| **HNSW Index (100K entities)** | 149MB | 15-33MB | 5-10x |
| **Graph Index (100K verbs)** | 100MB | 100MB | N/A |
| **Metadata Indexes** | 10-50MB | 10-50MB | N/A |
| **UnifiedCache** | 2GB | 2GB | N/A |
| **Total (100K entities)** | ~2.3GB | ~2.2GB | Minimal |
| **Total (1M entities)** | ~3.5GB | ~2.3GB | **34% less** |
| **Total (10M entities)** | ~15GB | ~3.0GB | **80% less** |

**Lazy mode activates automatically** when vectors exceed available cache.

---

## 10. Best Practices

### 10.1 Data Organization

✅ **Do**:
- Use UUIDs for all entities and relationships
- Let Brainy handle sharding automatically (type-first + UUID sharding)
- Use metadata indexes for filtering
- Enable lifecycle policies for cloud storage (96% cost savings)
- Use batch operations for bulk deletions
- Enable compression for FileSystem storage (60-80% space savings)
- Create branches for experimentation (instant, zero-cost)

❌ **Don't**:
- Try to organize files manually
- Assume file paths are predictable (use IDs, not paths)
- Store large binary data in metadata (use blob storage or VFS)
- Disable COW (can't be disabled in v5.11.0+, always enabled)
- Forget to monitor OPFS quota in browser applications

---

### 10.2 clear() Operation

**What clear() deletes**:

✅ Deletes:
- `branches/` → ALL entity data (all types, all shards, all branches, all forks)
- `_cow/` → ALL version control (commits, trees, blobs, refs)
- `_system/` → ALL indexes (statistics, HNSW, metadata)

✅ Resets:
- COW managers (refManager, blobStorage, commitLog) → `undefined`
- Entity counts → 0
- Statistics cache → `null`

✅ Behavior:
- COW **auto-reinitializes** on next operation (can't be disabled)
- Branches recreated automatically when new data added
- clean slate for fresh start

**Example**:
```typescript
await brain.storage.clear()  // ✅ Deletes ALL data correctly
await brain.add({ data: 'Alice', type: 'person' })  // ✅ COW reinitializes automatically
```

---

### 10.3 Querying

✅ **Do**:
- Use type filtering for known types: `brain.getNouns({ type: 'Character' })`
- Use metadata filters when possible: `brain.getNouns({ filter: { metadata: { status: 'active' } } })`
- Limit result sets with pagination: `brain.getNouns({ limit: 100, offset: 0 })`
- Use semantic search for similarity queries: `brain.find('concept similar to...')`
- Use graph queries for relationships: `brain.getVerbsBySource(userId)`

❌ **Don't**:
- Load all entities into memory: `const all = await brain.getNouns()` (use pagination!)
- Filter in application code (use metadata indexes instead)
- Scan all entities for simple queries (use indexes)

---

## 10.4 Common Storage Scenarios

Understanding how Brainy's storage architecture handles common scenarios.

### Scenario 1: Adding an Entity

**User code**:
```typescript
await brain.add({ data: 'Alice', type: 'person' })
```

**What happens in storage**:
```
1. Generate UUID: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
2. Compute vector embedding: [0.1, 0.2, 0.3, ...]
3. Extract shard: "3f"
4. Write vector file:
   → branches/main/entities/nouns/person/vectors/3f/3fa85f64-5717-4562-b3fc-2c963f66afa6.json
5. Write metadata file:
   → branches/main/entities/nouns/person/metadata/3f/3fa85f64-5717-4562-b3fc-2c963f66afa6.json
6. Create COW commit:
   → _cow/commits/00/00a1b2c3...sha256.json
7. Create COW tree (directory snapshot):
   → _cow/trees/ab/abcdef12...sha256.json
8. Create COW blobs (content-addressable):
   → _cow/blobs/3f/3fa85f64...sha256.bin (vector data)
   → _cow/blobs/7b/7b2f5e3c...sha256.bin (metadata)
9. Update branch ref:
   → _cow/refs/heads/main.json (points to new commit)
10. Update statistics:
   → _system/statistics.json (increment person count)
11. Update HNSW index (in-memory):
    → Connect to nearest neighbors
12. Update graph index (in-memory):
    → Add to adjacency maps
```

**Files created**: 5-7 files (2 entity files + 1 commit + 1 tree + 2-3 blobs + 1 ref update)

---

### Scenario 2: Querying by Type

**User code**:
```typescript
const characters = await brain.getNouns({ type: 'Character', limit: 100 })
```

**What happens in storage**:
```
1. Type-first optimization:
   → Scan only: branches/main/entities/nouns/Character/**
   → Skip all other types (41 other type directories)
2. List all shards in parallel:
   → branches/main/entities/nouns/Character/metadata/00/
   → branches/main/entities/nouns/Character/metadata/01/
   → ... (256 parallel operations)
3. Read first 100 metadata files
4. Return results (no vector load needed for listing)
```

**Performance**: 120-200ms for 100K entities (vs 30-60s without type-first)

---

### Scenario 3: Semantic Search

**User code**:
```typescript
const results = await brain.find('medieval castle', { k: 10 })
```

**What happens in storage**:
```
1. Compute query vector: [0.1, 0.2, 0.3, ...]
2. Use HNSW index (in-memory):
   → Navigate graph from entry point
   → Find 10 nearest neighbors (1-10ms)
3. Load vectors from cache or storage:
   → Standard mode: All vectors already in memory
   → Lazy mode: Load missing vectors from storage
     branches/main/entities/nouns/Place/vectors/3f/3fa85f64...uuid.json
4. Return results with metadata
```

**Performance**: 1-10ms (standard mode), 2-15ms (lazy mode with cache)

---

### Scenario 4: Creating a Branch

**User code**:
```typescript
await brain.branch.create('feature-experiment')
```

**What happens in storage**:
```
1. Copy ref (instant):
   _cow/refs/heads/main.json → _cow/refs/heads/feature-experiment.json
2. Create branch directory (empty initially):
   branches/feature-experiment/
3. NO data copying (lazy COW):
   → All data shared with main branch
   → Only modified entities copied on write
4. Result: Branch created in 100-200ms
```

**Storage overhead**: ~100 bytes (just the ref file)
**Data duplication**: 0% (shared with main until modified)

---

### Scenario 5: Time-Travel Query

**User code**:
```typescript
const yesterday = await brain.asOf(Date.now() - 86400000)
const historicalData = await yesterday.getNouns({ type: 'Character' })
```

**What happens in storage**:
```
1. Find commit at timestamp:
   → Search _cow/commits/** for timestamp match
2. Load commit object:
   → _cow/commits/00/00a1b2c3...sha256.json
3. Load tree from commit:
   → _cow/trees/ab/abcdef12...sha256.json
4. Lazy-load entities from historical tree:
   → Read blob hashes from tree
   → Load blobs: _cow/blobs/3f/3fa85f64...sha256.bin
   → Reconstruct entities from historical state
5. Return read-only view (writes blocked)
```

**Performance**: 500-1000ms for first query (loads commit tree), 100-200ms for subsequent queries (cached)

---

### Scenario 6: Clearing Storage

**User code**:
```typescript
await brain.storage.clear()
```

**What happens in storage**:
```
1. Delete all entity data:
   → Remove: branches/ (entire directory)
   → Result: ALL types, ALL shards, ALL branches deleted
2. Delete all version control:
   → Remove: _cow/ (entire directory)
   → Result: ALL commits, trees, blobs, refs deleted
3. Delete all indexes:
   → Remove: _system/ (entire directory)
   → Result: Statistics, HNSW, metadata indexes deleted
4. Reset COW managers in memory:
   → refManager = undefined
   → blobStorage = undefined
   → commitLog = undefined
5. Reset counters:
   → totalNounCount = 0
   → totalVerbCount = 0
6. Next operation auto-reinitializes COW:
   → COW managers recreate automatically
   → Fresh branches/main/ created
   → New _cow/ initialized
```

**Storage after clear()**: Empty (all data deleted)
**COW status**: Always enabled (auto-reinitializes)

---

### Scenario 7: Cold Start (Index Rebuild)

**User code**:
```typescript
const brain = new Brainy({ storage: existingStorage })
await brain.init()
```

**What happens in storage**:
```
1. Check for persisted indexes:
   → Load: _system/hnsw/system.json (entry point, max level)
   → Load: _system/hnsw/nodes/** (graph connections)
   → Load: _system/statistics.json (entity counts)
2. Decide standard vs lazy mode:
   → Check: entityCount × vectorSize vs. available cache
   → Auto-enable lazy mode if needed
3. Rebuild HNSW index:
   → Standard mode: Load all vectors into memory
   → Lazy mode: Load only graph structure (~24 bytes/node)
4. Rebuild Graph Adjacency index:
   → Load: branches/main/entities/verbs/*/metadata/** (all verbs)
   → Build: sourceToTargets and targetToSources maps
5. Load Metadata indexes:
   → Read: _system/metadata_indexes/** (on-demand)
6. Ready for queries (1-5 seconds for 100K entities)
```

**Performance**:
- 100K entities: 1-5 seconds
- 1M entities: 10-30 seconds
- 10M entities: 1-3 minutes

---

### Scenario 8: Bulk Import

**User code**:
```typescript
await brain.addBatch([
  { data: 'Alice', type: 'person' },
  { data: 'Bob', type: 'person' },
  // ... 10,000 more
])
```

**What happens in storage**:
```
1. Batch vector computation (parallel)
2. Batch shard distribution:
   → 10,000 entities → ~39 entities per shard (256 shards)
3. Parallel writes to storage:
   → 256 shards written in parallel
   → Each shard: ~39 files written
4. Single COW commit for entire batch:
   → 1 commit object
   → 1 tree object (or tree fan-out for large trees)
   → 10,000+ blobs (deduplicated)
5. Update indexes in batch:
   → HNSW: Batch insert (optimized)
   → Graph: Batch update
   → Metadata: Batch index update
```

**Performance**: 2-3 minutes for 10,000 entities (vs 4-8 hours without batching)

---

## 11. Summary

**Complete Storage Structure**:
- **3 storage layers**: branches/ (data), _cow/ (versions), _system/ (indexes)
- **2 files per entity**: metadata.json + vector.json (optimized I/O)
- **4 indexes**: HNSW (semantic), Type Index (metadata-based), Graph (relationships), Metadata (fields)
- **256 shards**: UUID-based (uniform distribution)
- **42 noun types + 127 verb types**: Type is metadata, not storage structure
- **Git-like COW**: Branches, commits, trees, blobs, refs
- **VFS support**: Traditional file/folder hierarchies

**Scalability (v6.0.0 Improvements)**:
- **ID-First Storage**: 40x faster on cloud storage (eliminates 42-type search)
- Sharding: 200x faster for cloud storage
- Type filtering: Still O(type_count) via metadata index
- Lazy mode: 5-10x less memory for large datasets
- COW: Instant branches, efficient forks
- Deduplication: 30-90% storage savings

**Production Features**:
- Lifecycle policies (96% cost savings on cloud storage)
- Batch operations (efficient API usage)
- Compression (60-80% space savings on filesystem)
- Quota monitoring (OPFS browser limits)
- Auto-reinitialization (COW always-on, can't be broken)
- **Clean architecture**: Removed 500+ lines of type cache complexity

---

## Next Steps

- [Storage Adapters](./storage-architecture.md) - Configure cloud storage backends
- [VFS Guide](../vfs/README.md) - Use Virtual File System features
- [Triple Intelligence](../vfs/TRIPLE_INTELLIGENCE.md) - Semantic file extraction
- [Scaling Guide](../SCALING.md) - Handle 10M+ entities
- [Performance Tuning](../PERFORMANCE.md) - Optimize for your use case

---

**Version**: v6.0.0
**Last Updated**: 2025-11-19
**Key Features**: ID-first storage, COW always-on, metadata-based type index, 4-index architecture, VFS support, billion-scale optimization, 40x cloud performance improvement
