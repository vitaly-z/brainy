# Index Architecture

Brainy uses a sophisticated **3-tier index architecture** that enables "Triple Intelligence" - the unified combination of vector similarity, graph relationships, and metadata filtering. This document provides a comprehensive architectural overview of how these indexes work internally and coordinate with each other.

## Overview: The Three Main Indexes + Sub-Indexes

Brainy has **3 main indexes** at the top level, each with multiple sub-indexes managed automatically:

### Main Indexes (Level 1)

| Index | Purpose | Data Structure | Complexity | File Location | rebuild() Method |
|-------|---------|----------------|------------|---------------|------------------|
| **TypeAwareHNSWIndex** | Type-aware vector similarity search | 42 type-specific HNSW hierarchical graphs | O(log n) search | `src/hnsw/typeAwareHNSWIndex.ts` | ✅ Line 403 |
| **MetadataIndexManager** | Fast metadata filtering | Chunked sparse indices with bloom filters + zone maps + roaring bitmaps | O(1) exact, O(log n) ranges | `src/utils/metadataIndex.ts` | ✅ Line 2318 |
| **GraphAdjacencyIndex** | Relationship traversal | 4 LSM-trees + bidirectional adjacency maps | O(1) per hop | `src/graph/graphAdjacencyIndex.ts` | ✅ Line 389 |

### Sub-Indexes (Level 2)

**TypeAwareHNSWIndex contains:**
- **42 type-specific HNSW indexes** - One per NounType (automatically rebuilt via parent)

**MetadataIndexManager contains:**
- **ChunkManager** - Adaptive chunked sparse indexing
- **EntityIdMapper** - UUID ↔ integer mapping for roaring bitmaps
- **FieldTypeInference** - DuckDB-inspired value-based field type detection
- **Field Sparse Indexes** - Per-field sparse indexes with roaring bitmaps (dynamic count)
- **Sorted Indexes** - Support orderBy queries (automatically maintained)

**GraphAdjacencyIndex contains:**
- **lsmTreeSource** - Source → Targets (outgoing edges)
- **lsmTreeTarget** - Target → Sources (incoming edges)
- **lsmTreeVerbsBySource** - Source → Verb IDs
- **lsmTreeVerbsByTarget** - Target → Verb IDs

All indexes share a **UnifiedCache** for coordinated memory management, ensuring fair resource allocation and preventing any single index from monopolizing memory.

## 1. MetadataIndex - Fast Field Filtering

**Purpose**: Enable O(1) field-value lookups and O(log n) range queries on metadata fields using adaptive chunked sparse indexing.

### Internal Architecture (v3.42.0)

```typescript
class MetadataIndexManager {
  // Chunked sparse indices: field → SparseIndex (replaces flat files)
  private sparseIndices = new Map<string, SparseIndex>()

  // Chunk management
  private chunkManager: ChunkManager
  private chunkingStrategy: AdaptiveChunkingStrategy

  // Lightweight field statistics
  private fieldIndexes = new Map<string, FieldIndexData>()  // value → count
  private fieldStats = new Map<string, FieldStats>()        // cardinality tracking

  // Type-field affinity for NLP understanding
  private typeFieldAffinity = new Map<string, Map<string, number>>()

  // Shared memory management
  private unifiedCache: UnifiedCache
}
```

### Key Data Structures

#### Chunked Sparse Index (NEW in v3.42.0)
```typescript
// SparseIndex: Directory of chunks for a field
// Example: field="status"
class SparseIndex {
  field: string
  chunks: ChunkDescriptor[]  // Metadata about each chunk
  bloomFilters: BloomFilter[] // Fast membership testing
}

// ChunkDescriptor: Metadata about a chunk
interface ChunkDescriptor {
  chunkId: number
  valueCount: number         // How many unique values in this chunk
  idCount: number            // Total entity IDs
  zoneMap: ZoneMap          // Min/max for range queries
  lastUpdated: number
}

// Actual chunk data stored separately
class ChunkData {
  chunkId: number
  field: string
  entries: Map<value, RoaringBitmap32>  // ~50 values per chunk (v3.43.0: roaring bitmaps!)
}
```

**Performance**:
- O(1) exact lookup with bloom filters (1% false positive rate)
- O(log n) range queries with zone maps
- 630x file reduction (560k flat files → 89 chunk files)

#### Roaring Bitmap Optimization (NEW in v3.43.0)

**Problem Solved**: JavaScript `Set<string>` for storing entity IDs was inefficient:
- Memory overhead: ~40 bytes per UUID string (36 chars + overhead)
- Slow intersection: JavaScript array filtering for multi-field queries
- No hardware acceleration

**Solution**: Replace `Set<string>` with `RoaringBitmap32` (WebAssembly implementation) for 90% memory savings and hardware-accelerated operations. Uses `roaring-wasm` package for universal compatibility (Node.js, browsers, serverless) without requiring native compilation.

```typescript
// EntityIdMapper: UUID ↔ Integer mapping
class EntityIdMapper {
  private uuidToInt = new Map<string, number>()
  private intToUuid = new Map<number, string>()
  private nextId = 1

  getOrAssign(uuid: string): number {
    // O(1) mapping: UUIDs → integers for bitmap storage
    let intId = this.uuidToInt.get(uuid)
    if (!intId) {
      intId = this.nextId++
      this.uuidToInt.set(uuid, intId)
      this.intToUuid.set(intId, uuid)
    }
    return intId
  }

  intsIterableToUuids(ints: Iterable<number>): string[] {
    // Convert bitmap results back to UUIDs
    const result: string[] = []
    for (const intId of ints) {
      const uuid = this.intToUuid.get(intId)
      if (uuid) result.push(uuid)
    }
    return result
  }
}

// ChunkData now uses RoaringBitmap32 instead of Set<string>
class ChunkData {
  chunkId: number
  field: string
  entries: Map<string, RoaringBitmap32>  // value → bitmap of integer IDs
}
```

**Key Benefits**:
- **90% memory savings**: Roaring bitmaps compress much better than UUID strings
- **Hardware-accelerated operations**: SIMD instructions (AVX2/SSE4.2) for ultra-fast bitmap AND/OR
- **Portable serialization**: Cross-platform compatible format (Java/Go/Node.js)
- **Lazy conversion**: UUIDs converted to integers only once, not per query

**Multi-Field Intersection (THE BIG WIN!)**:
```typescript
// Before (v3.42.0): JavaScript array filtering
async getIdsForFilter(filter: {status: 'active', role: 'admin'}): Promise<string[]> {
  // 1. Fetch UUID arrays for each field
  const statusIds = await this.getIds('status', 'active')  // ["uuid1", "uuid2", ...]
  const roleIds = await this.getIds('role', 'admin')       // ["uuid2", "uuid3", ...]

  // 2. JavaScript intersection (SLOW!)
  return statusIds.filter(id => roleIds.includes(id))      // O(n*m) array filtering
}

// After (v3.43.0): Roaring bitmap intersection
async getIdsForMultipleFields(pairs: [{field, value}, ...]): Promise<string[]> {
  // 1. Fetch roaring bitmaps (integers, not UUIDs)
  const bitmaps: RoaringBitmap32[] = []
  for (const {field, value} of pairs) {
    const bitmap = await this.getBitmapFromChunks(field, value)
    if (!bitmap) return []  // Short-circuit if any field has no matches
    bitmaps.push(bitmap)
  }

  // 2. Hardware-accelerated intersection (FAST! AVX2/SSE4.2 SIMD)
  const result = RoaringBitmap32.and(...bitmaps)           // O(1) hardware operation!

  // 3. Convert final bitmap to UUIDs (once, not per-field)
  return this.idMapper.intsIterableToUuids(result)
}
```

**Performance Impact**:
- Multi-field intersection: **1.4x average speedup**, up to 3.3x on 10K entities
- Memory usage: **90% reduction** (17.17 MB → 2.01 MB for 100K entities)
- Hardware acceleration: SIMD instructions make bitmap operations nearly free

**Benchmark Results** (1,000 queries on various dataset sizes):
| Dataset Size | Operation | Set Time | Roaring Time | Speedup | Memory Savings |
|--------------|-----------|----------|--------------|---------|----------------|
| 10,000 entities | 3-field intersection | 3.74ms | 1.14ms | **3.3x faster** | 90% |
| 100,000 entities | 3-field intersection | 2.60ms | 1.78ms | **1.5x faster** | 88% |

**Implementation**: See `src/utils/entityIdMapper.ts` and benchmark at `tests/performance/roaring-bitmap-benchmark.ts`

#### Bloom Filter (Probabilistic Membership Testing)
```typescript
class BloomFilter {
  bits: Uint8Array        // Bit array
  size: number           // Total bits
  hashCount: number      // Number of hash functions (FNV-1a, DJB2)

  mightContain(value): boolean  // ~1% false positive, 0% false negative
}
```

**Use case**: Quickly skip chunks that definitely don't contain a value

#### Zone Map (Range Query Optimization)
```typescript
interface ZoneMap {
  min: any | null       // Minimum value in chunk
  max: any | null       // Maximum value in chunk
  count: number         // Number of entries
  hasNulls: boolean     // Whether chunk contains null values
}
```

**Use case**: Skip entire chunks during range queries (ClickHouse-inspired)

#### Type-Field Affinity
```typescript
// Tracks which fields are commonly used with which types
// Example:
// typeFieldAffinity.get('character') → {
//   'name': 127,      // 127 characters have a 'name' field
//   'age': 89,        // 89 characters have an 'age' field
//   'alignment': 45   // 45 characters have an 'alignment' field
// }
```

**Use case**: Enables NLP to understand "find characters named John" → knows 'name' is a character field

### Query Algorithm (v3.42.0)

**Exact Match Query**:
```typescript
async getIds(field: string, value: any): Promise<string[]> {
  // 1. Load sparse index for field
  const sparseIndex = await this.loadSparseIndex(field)

  // 2. Find candidate chunks using bloom filters
  const candidateChunks = sparseIndex.findChunksForValue(value)
  //    → Bloom filter checks all chunks (~1ms)
  //    → Returns only chunks that *might* contain value

  // 3. Load candidate chunks and collect IDs
  const results = []
  for (const chunkId of candidateChunks) {
    const chunk = await this.chunkManager.loadChunk(field, chunkId)
    const ids = chunk.entries.get(value)
    if (ids) results.push(...ids)
  }

  return results
}
```

**Range Query**:
```typescript
async getIdsForRange(field: string, min: any, max: any): Promise<string[]> {
  // 1. Load sparse index for field
  const sparseIndex = await this.loadSparseIndex(field)

  // 2. Find candidate chunks using zone maps
  const candidateChunks = sparseIndex.findChunksForRange(min, max)
  //    → Check zoneMap.min and zoneMap.max for each chunk
  //    → Skip chunks where max < min or min > max

  // 3. Load chunks and filter values
  const results = []
  for (const chunkId of candidateChunks) {
    const chunk = await this.chunkManager.loadChunk(field, chunkId)
    for (const [value, ids] of chunk.entries) {
      if (value >= min && value <= max) {
        results.push(...ids)
      }
    }
  }

  return results
}
```

**Benefits**:
- Bloom filters: Skip 99% of irrelevant chunks (exact match)
- Zone maps: Skip entire chunks that fall outside range
- Adaptive chunking: ~50 values per chunk optimizes I/O
- Immediate flushing: No need for dirty tracking or batch writes

### Temporal Bucketing (v3.41.0)

**Problem Solved**: High-cardinality timestamp fields created massive file pollution.
- Example: 575 entities with unique timestamps → 358,407 index files (98.7% pollution!)

**Solution**: Automatic bucketing of temporal fields to 1-minute intervals.

```typescript
// In normalizeValue(value, field):
if (field && typeof value === 'number') {
  const fieldLower = field.toLowerCase()
  const isTemporal = fieldLower.includes('time') ||
                     fieldLower.includes('date') ||
                     fieldLower.includes('accessed') ||
                     fieldLower.includes('modified') ||
                     fieldLower.includes('created') ||
                     fieldLower.includes('updated')

  if (isTemporal) {
    // Bucket to 1-minute intervals
    const bucketSize = 60000 // milliseconds
    const bucketed = Math.floor(value / bucketSize) * bucketSize
    return bucketed.toString()
  }
}
```

**Benefits**:
- ✅ Reduces 575 unique timestamps → ~10 buckets
- ✅ File count: 358,407 → ~4,600 (98.7% reduction)
- ✅ Zero configuration - automatic field name detection
- ✅ Still enables range queries (not excluded like before)
- ✅ 1-minute precision sufficient for most use cases

**Field Name Detection**: Automatically buckets fields with these keywords:
- `time`, `date`, `accessed`, `modified`, `created`, `updated`
- Examples: `timestamp`, `createdAt`, `lastModified`, `birthdate`, `eventTime`

### Operations

```typescript
// Add to index (src/brainy.ts:387)
await this.metadataIndex.addToIndex(id, metadata)

// Query exact match
const ids = await this.metadataIndex.getIds('status', 'active')

// Query range
const ids = await this.metadataIndex.getIdsForFilter({
  publishDate: { greaterThan: 1640995200000 }
})

// Filter discovery (what values exist for a field)
const values = await this.metadataIndex.getFilterValues('status')
// → ['active', 'archived', 'draft']

// Statistics (O(1))
const totalEntities = this.metadataIndex.getTotalEntityCount()
const typeBreakdown = this.metadataIndex.getAllEntityCounts()
// → Map { 'character': 127, 'item': 89, 'location': 45 }
```

### Excluded Fields

Some fields are excluded from indexing to prevent pollution:

```typescript
const DEFAULT_EXCLUDE_FIELDS = [
  'id',               // Primary key (redundant to index)
  'uuid',             // Alternative primary key
  'vector',           // High-dimensional data
  'embedding',        // Same as vector
  'content',          // Large text content
  'description',      // Large text content
  'metadata',         // Nested object (too large)
  'data'              // Generic nested object
]
```

**Note**: Timestamp fields like `modified`, `accessed`, `created` are NO LONGER excluded as of v3.41.0 - they are indexed with automatic bucketing.

## 2. HNSWIndex - Vector Similarity Search

**Purpose**: O(log n) semantic similarity search using vector embeddings.

### Internal Architecture

```typescript
class HNSWIndex {
  // Per-noun indexes for efficiency
  private nouns: Map<string, HNSWNoun> = new Map()

  // Global entry point for search
  private entryPointId: string | null = null
  private maxLevel = 0

  // Shared memory management
  private unifiedCache: UnifiedCache
  private storage: BaseStorage | null = null
}

// Each noun has its own HNSW graph
class HNSWNoun {
  noun: string
  nodes: Map<string, HNSWNode>
  entryPointId: string | null
  maxLevel: number
}

// Each node in the graph
class HNSWNode {
  id: string
  vector: Vector | null  // Lazy-loaded from storage
  level: number
  connections: Map<number, string[]>  // level → neighbor IDs
}
```

### Hierarchical Graph Structure

HNSW builds a multi-layered graph:

```
Layer 2: [entry] ←→ [node1]                    (sparse, long-range connections)
           ↓         ↓
Layer 1: [entry] ←→ [node1] ←→ [node2] ←→ [node3]  (medium density)
           ↓         ↓         ↓         ↓
Layer 0: [entry] ←→ [node1] ←→ [node2] ←→ [node3] ←→ [node4] ←→ [node5]  (dense, all nodes)
```

**Search Algorithm**:
1. Start at entry point in top layer
2. Greedy search for nearest neighbor in current layer
3. Move down to next layer with found neighbor
4. Repeat until reaching layer 0
5. Return k nearest neighbors

**Complexity**: O(log n) due to hierarchical structure

### Adaptive Vector Loading

Vectors are lazy-loaded on demand based on memory availability:

```typescript
private async getVectorSafe(noun: HNSWNoun): Promise<Vector> {
  // Check UnifiedCache first
  const cached = this.unifiedCache.get(noun.id)
  if (cached) return cached

  // Load from storage if memory available
  if (this.unifiedCache.canCache()) {
    const vector = await this.storage.loadVector(noun.id)
    this.unifiedCache.set(noun.id, vector)
    return vector
  }

  // Load transiently if memory pressure
  return await this.storage.loadVector(noun.id)
}
```

### Operations

```typescript
// Add entity (src/brainy.ts:add)
await this.index.addEntity(id, vector, noun)

// Search for similar vectors
const results = await this.index.search(queryVector, k, threshold)
// Returns: Array<{id: string, similarity: number}>

// Rebuild from storage
await this.index.rebuild()
```

## 3. GraphAdjacencyIndex - O(1) Relationship Traversal

**Purpose**: Constant-time neighbor lookups regardless of graph size.

### Internal Architecture

```typescript
class GraphAdjacencyIndex {
  // O(1) bidirectional lookups
  private sourceIndex = new Map<string, Set<string>>()  // sourceId → targetIds
  private targetIndex = new Map<string, Set<string>>()  // targetId → sourceIds

  // Full relationship data
  private verbIndex = new Map<string, GraphVerb>()      // verbId → metadata

  // Statistics
  private relationshipCountsByType = new Map<string, number>()

  // Shared memory
  private unifiedCache: UnifiedCache
  private storage: BaseStorage
}
```

### Key Innovation: Bidirectional Adjacency

**Core Insight**: Store BOTH directions of each relationship for O(1) lookups.

```typescript
// Example: Alice KNOWS Bob
// verbId = "verb-123"

// Source index: Alice → Bob
sourceIndex.set('alice', Set(['bob']))

// Target index: Bob ← Alice
targetIndex.set('bob', Set(['alice']))

// Full metadata
verbIndex.set('verb-123', {
  id: 'verb-123',
  verb: 'knows',
  source: 'alice',
  target: 'bob',
  metadata: { since: 2020 }
})
```

**Result**: Finding Alice's friends OR Bob's friends is O(1) - just one Map lookup!

### Operations

```typescript
// Add relationship (src/brainy.ts:relate)
await this.graphIndex.addRelationship(verbId, sourceId, targetId, verb)

// Get neighbors (O(1) per hop)
const outgoing = await this.graphIndex.getNeighbors(id, 'out')  // Who does id point to?
const incoming = await this.graphIndex.getNeighbors(id, 'in')   // Who points to id?
const both = await this.graphIndex.getNeighbors(id, 'both')     // All neighbors

// Get relationships
const verbs = await this.graphIndex.getRelationships(sourceId, targetId)

// Statistics (O(1))
const totalRelationships = this.graphIndex.getTotalRelationshipCount()
const byType = this.graphIndex.getRelationshipCountsByType()
// → Map { 'knows': 45, 'created': 23, 'located_at': 12 }
```

### Graph Traversal

The index supports multi-hop traversal:

```typescript
// Find all entities within 2 hops
const reachable = await this.graphIndex.traverse({
  startId: 'alice',
  depth: 2,
  direction: 'out'
})
// Complexity: O(V + E) breadth-first search, but each neighbor lookup is O(1)
```

## Notes on Other Indexes

### DeletedItemsIndex (Not Currently Used)

**Status**: Utility class exists in `src/utils/deletedItemsIndex.ts` but is **not instantiated** in the Brainy class.

**Purpose** (if used): O(1) tracking of soft-deleted items without removing data.

**Current Behavior**: Brainy uses hard deletes via `storage.deleteNoun()` and `storage.deleteVerb()`. Soft-delete functionality is not currently integrated.

## Shared Memory Management: UnifiedCache

All three main indexes share a single **UnifiedCache** instance for coordinated memory management.

### Architecture

```typescript
class UnifiedCache {
  private cache: Map<string, CachedItem> = new Map()
  private maxSize: number
  private currentSize: number = 0
  private evictionPolicy: 'LRU' | 'LFU' = 'LRU'
}

// Each index gets the same cache instance
const unifiedCache = new UnifiedCache({ maxSize: 1000 })
this.metadataIndex = new MetadataIndexManager(storage, { unifiedCache })
this.hnswIndex = new HNSWIndex(storage, { unifiedCache })
this.graphIndex = new GraphAdjacencyIndex(storage, { unifiedCache })
```

### Benefits

1. **Fair Resource Allocation**: All indexes compete for the same memory pool
2. **Prevents Monopolization**: No single index can starve others of memory
3. **Coordinated Eviction**: LRU eviction across all cached items system-wide
4. **Memory Pressure Handling**: Automatic cache shrinking when memory is tight
5. **Adaptive Loading**: Indexes load data transiently under memory pressure

### Cache Key Patterns

Each index uses different key prefixes:

```typescript
// Metadata index
cache.set(`meta:${field}:${value}`, indexEntry)

// HNSW index
cache.set(`vector:${id}`, vectorData)

// Graph index
cache.set(`graph:${sourceId}`, neighbors)

// Deleted items (no caching needed - uses Set)
```

## How Indexes Work Together

### 1. Entity Creation (`brainy.add()`)

```typescript
// src/brainy.ts:add()
async add(params: AddParams): Promise<string> {
  const id = generateId()
  const vector = await this.embedder(params.content)

  // Add to metadata index (field filtering)
  await this.metadataIndex.addToIndex(id, params.metadata)

  // Add to HNSW index (vector search)
  await this.index.addEntity(id, vector, params.noun)

  // Relationships added via separate relate() calls

  return id
}
```

### 2. Entity Search (`brainy.find()`)

```typescript
// src/brainy.ts:find()
async find(query: FindQuery): Promise<Result[]> {
  let results: Result[] = []

  // Step 1: Metadata filtering (fast pre-filter)
  if (query.where) {
    const filteredIds = await this.metadataIndex.getIdsForFilter(query.where)
    results = await this.getEntitiesByIds(filteredIds)
  }

  // Step 2: Vector similarity search (semantic ranking)
  if (query.like) {
    const queryVector = await this.embedder(query.like)
    const vectorResults = await this.index.search(queryVector, query.limit)

    // Intersect or union with metadata results
    results = this.combineResults(results, vectorResults)
  }

  // Step 3: Graph traversal (relationship filtering)
  if (query.connected) {
    const connectedIds = await this.graphIndex.traverse(query.connected)
    results = results.filter(r => connectedIds.includes(r.id))
  }

  // Step 4: Filter deleted items
  results = results.filter(r => !this.deletedItemsIndex.isDeleted(r.id))

  return results
}
```

### 3. Entity Update (`brainy.update()`)

```typescript
// src/brainy.ts:update()
async update(params: UpdateParams): Promise<void> {
  const existing = await this.get(params.id)

  // Update metadata index (remove old, add new)
  await this.metadataIndex.removeFromIndex(params.id, existing.metadata)
  await this.metadataIndex.addToIndex(params.id, params.metadata)

  // Update HNSW index (re-embed if content changed)
  if (params.content) {
    const newVector = await this.embedder(params.content)
    await this.index.updateEntity(params.id, newVector)
  }

  // Graph relationships unchanged (managed separately)
}
```

### 4. Statistics (`brainy.stats()`)

All indexes provide O(1) statistics:

```typescript
// src/brainy.ts:stats()
async stats(): Promise<Statistics> {
  return {
    // From metadata index
    entities: this.metadataIndex.getTotalEntityCount(),
    entityTypes: this.metadataIndex.getAllEntityCounts(),

    // From graph index
    relationships: this.graphIndex.getTotalRelationshipCount(),
    relationshipTypes: this.graphIndex.getRelationshipCountsByType(),

    // From deleted items index
    deletedItems: this.deletedItemsIndex.getDeletedCount(),

    // From HNSW index
    vectorIndexSize: this.index.getSize()
  }
}
```

### 5. Index Rebuilding (v5.7.7: Lazy Loading Support)

**Two modes of index loading:**

#### Mode 1: Auto-Rebuild on init() (default)

```typescript
// src/brainy.ts:init()
async init(): Promise<void> {
  // When disableAutoRebuild: false (default)
  const metadataStats = await this.metadataIndex.getStats()
  const hnswIndexSize = this.index.size()
  const graphIndexSize = await this.graphIndex.size()

  if (metadataStats.totalEntries === 0 ||
      hnswIndexSize === 0 ||
      graphIndexSize === 0) {
    // Rebuild all indexes in parallel
    await Promise.all([
      metadataStats.totalEntries === 0 ? this.metadataIndex.rebuild() : Promise.resolve(),
      hnswIndexSize === 0 ? this.index.rebuild() : Promise.resolve(),
      graphIndexSize === 0 ? this.graphIndex.rebuild() : Promise.resolve()
    ])
  }
}
```

#### Mode 2: Lazy Loading on First Query (v5.7.7+)

```typescript
// When disableAutoRebuild: true
const brain = new Brainy({
  storage: { type: 'filesystem' },
  disableAutoRebuild: true  // Enable lazy loading
})

await brain.init()  // Returns instantly, indexes empty

// First query triggers lazy rebuild
const results = await brain.find({ limit: 10 })
// → Calls ensureIndexesLoaded() (line 4617)
// → Rebuilds all 3 main indexes with concurrency control
// → Subsequent queries are instant (0ms check)
```

**Performance:**
- First query with lazy loading: ~50-200ms rebuild (1K-10K entities)
- Concurrent queries: Wait for same rebuild (mutex prevents duplicates)
- Subsequent queries: 0ms check (instant)

See [initialization-and-rebuild.md](./initialization-and-rebuild.md) for detailed lazy loading implementation.

## Triple Intelligence Integration

The **TripleIntelligenceSystem** (`src/cortex/tripleIntelligence.ts`) combines all three core indexes:

```typescript
class TripleIntelligenceSystem {
  constructor(
    private metadataIndex: MetadataIndexManager,
    private hnswIndex: HNSWIndex,
    private graphIndex: GraphAdjacencyIndex,
    private embedder: EmbedderFunction,
    private storage: BaseStorage
  ) {}

  async query(nlpQuery: string): Promise<Result[]> {
    // Parse natural language
    const parsed = await this.parseQuery(nlpQuery)

    // Execute across all three indexes
    const [metadataResults, vectorResults, graphResults] = await Promise.all([
      this.metadataIndex.getIdsForFilter(parsed.filters),
      this.hnswIndex.search(parsed.vector, parsed.limit),
      this.graphIndex.traverse(parsed.graphConstraints)
    ])

    // Fuse results with weighted scoring
    return this.fuseResults(metadataResults, vectorResults, graphResults)
  }
}
```

## Performance Characteristics

### Operation Complexity by Index

| Operation | MetadataIndexManager | TypeAwareHNSWIndex | GraphAdjacencyIndex |
|-----------|---------------------|-------------------|---------------------|
| **Add** | O(1) per field | O(log n) | O(1) |
| **Remove** | O(1) per field | O(log n) | O(1) |
| **Exact lookup** | O(1) | N/A | O(1) |
| **Range query** | O(log n) + O(k) | N/A | N/A |
| **Similarity search** | N/A | O(log n) | N/A |
| **Neighbor lookup** | N/A | N/A | O(1) |
| **Statistics** | O(1) | O(1) | O(1) |
| **Rebuild** | O(n) | O(n) | O(n) |

Where:
- n = total number of entities
- k = number of matching results

**Note**: All 3 main indexes have rebuild() methods that load persisted data (O(n)) rather than recomputing (which would be O(n log n) for HNSW).

### Memory Footprint

| Index | Per-Entity Memory | Notes |
|-------|-------------------|-------|
| **MetadataIndexManager** | ~100 bytes | Depends on field count and cardinality (RoaringBitmap32 compression) |
| **TypeAwareHNSWIndex** | ~1.5 KB | Vector (384 dims × 4 bytes) + graph connections across 42 type-specific indexes |
| **GraphAdjacencyIndex** | ~50 bytes per relationship | Bidirectional references + metadata in 4 LSM-trees |

**Total overhead**: ~1.6 KB per entity + ~50 bytes per relationship

**Sub-index memory:**
- ChunkManager: ~20 bytes per chunk descriptor
- EntityIdMapper: ~32 bytes per UUID mapping (50-90% savings vs Set\<string\>)
- LSM-trees: ~200 bytes per relationship (SSTable storage)

### Scalability

All indexes scale gracefully:

| Database Size | Metadata Filter | Vector Search | Graph Hop | Combined Query |
|---------------|----------------|---------------|-----------|----------------|
| **1K entities** | 0.3ms | 0.8ms | 0.05ms | 1.1ms |
| **10K entities** | 0.5ms | 1.2ms | 0.08ms | 1.5ms |
| **100K entities** | 0.8ms | 1.8ms | 0.1ms | 2.1ms |
| **1M entities** | 1.2ms | 2.5ms | 0.1ms | 2.8ms |

**Key observations**:
- Graph queries stay O(1) regardless of scale
- Metadata filtering scales sub-linearly
- Vector search degrades gracefully due to HNSW
- Combined queries remain fast even at scale

## Best Practices

### When to Use Each Index

**MetadataIndex**:
- Filtering by exact field values (status, type, category)
- Range queries on numeric/temporal fields (dates, prices, counts)
- Field discovery (what filters are available)
- Type-based querying (find all characters, all items)

**HNSWIndex**:
- Semantic similarity search ("find similar documents")
- Content-based retrieval ("find posts about AI")
- Fuzzy matching (when exact matches aren't required)
- Recommendation systems (find related items)

**GraphAdjacencyIndex**:
- Relationship queries ("who knows whom")
- Path finding ("how are these entities connected")
- Network analysis ("find communities")
- Multi-hop traversal ("friends of friends")

**Note**: Soft-delete functionality is not currently integrated. Brainy uses hard deletes via storage layer.

### Query Optimization

1. **Start with metadata filters** - They're fastest and most selective
2. **Use graph constraints** - O(1) lookups significantly reduce search space
3. **Vector search last** - Most expensive, best used on pre-filtered set
4. **Leverage temporal bucketing** - Timestamp range queries work efficiently
5. **Monitor statistics** - Use O(1) stats methods for cardinality estimation

### Memory Management

1. **Configure UnifiedCache appropriately** - Balance between speed and memory
2. **Use lazy loading** - HNSW loads vectors on-demand
3. **Monitor cache hit rates** - Adjust cache size if hit rate is low
4. **Consider storage adapter** - Memory storage = fastest, S3 = most scalable

## Related Documentation

- [Find System](../FIND_SYSTEM.md) - Query-centric view of index usage
- [Triple Intelligence](./triple-intelligence.md) - Advanced query system
- [Storage Architecture](./storage-architecture.md) - Storage layer details
- [Performance Guide](../PERFORMANCE.md) - Performance tuning
- [Overview](./overview.md) - High-level architecture

## Summary: Index Hierarchy (v5.7.7)

### Level 1: Main Indexes (3)
All have rebuild() methods and are covered by lazy loading:
1. **TypeAwareHNSWIndex** - `src/hnsw/typeAwareHNSWIndex.ts:403`
2. **MetadataIndexManager** - `src/utils/metadataIndex.ts:2318`
3. **GraphAdjacencyIndex** - `src/graph/graphAdjacencyIndex.ts:389`

### Level 2: Sub-Indexes (~50+)
Automatically managed by parent rebuild():
- **42 type-specific HNSW indexes** (one per NounType)
- **6 metadata components** (ChunkManager, EntityIdMapper, FieldTypeInference, Field Sparse Indexes, Sorted Indexes)
- **4 LSM-trees** (lsmTreeSource, lsmTreeTarget, lsmTreeVerbsBySource, lsmTreeVerbsByTarget)
- **In-memory graph structures** (sourceIndex, targetIndex, verbIndex)

### Lazy Loading (v5.7.7)
- **Mode 1**: Auto-rebuild on init() (default)
- **Mode 2**: Lazy rebuild on first query (when `disableAutoRebuild: true`)
- **Concurrency-safe**: Mutex prevents duplicate rebuilds
- **Performance**: First query ~50-200ms, subsequent queries instant

### Total Functional Index Count
- **3 main indexes** with independent rebuild() methods
- **~50+ sub-components** managed automatically
- **All covered** by rebuildIndexesIfNeeded() or built-in lazy initialization

## Version History

- **v5.7.7** (November 2025): Added production-scale lazy loading with concurrency control. Fixed critical bug where `disableAutoRebuild: true` left indexes empty forever. Added `ensureIndexesLoaded()` helper and `getIndexStatus()` diagnostic.
- **v3.43.0** (October 2025): Migrated from `roaring` (native C++) to `roaring-wasm` (WebAssembly) for universal compatibility. No API changes - maintains identical RoaringBitmap32 interface. Benefits: works in all environments (Node.js, browsers, serverless) without build tools, zero compilation errors, simpler developer experience. 90% memory savings and hardware-accelerated operations unchanged.
- **v3.42.0** (October 2025): Replaced flat file indexing with adaptive chunked sparse indexing. Bloom filters + zone maps for O(1) exact match and O(log n) range queries. 630x file reduction (560k → 89 files). Removed dual code paths.
- **v3.41.0** (October 2025): Added automatic temporal bucketing to MetadataIndex
- **v3.40.0** (October 2025): Enhanced batch processing for imports
- **v3.0.0** (September 2025): Introduced 3-tier index architecture with UnifiedCache
