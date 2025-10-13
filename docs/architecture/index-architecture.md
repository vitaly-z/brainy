# Index Architecture

Brainy uses a sophisticated **4-index architecture** that enables "Triple Intelligence" - the unified combination of vector similarity, graph relationships, and metadata filtering. This document provides a comprehensive architectural overview of how these indexes work internally and coordinate with each other.

## Overview: The Four Core Indexes

| Index | Purpose | Data Structure | Complexity | File Location |
|-------|---------|----------------|------------|---------------|
| **MetadataIndex** | Fast metadata filtering | Inverted indexes + sorted arrays | O(1) exact, O(log n) ranges | `src/utils/metadataIndex.ts` |
| **HNSWIndex** | Vector similarity search | Hierarchical graphs | O(log n) search | `src/hnsw/hnswIndex.ts` |
| **GraphAdjacencyIndex** | Relationship traversal | Bidirectional adjacency maps | O(1) per hop | `src/graph/graphAdjacencyIndex.ts` |
| **DeletedItemsIndex** | Soft-delete tracking | Simple Set | O(1) all ops | `src/utils/deletedItemsIndex.ts` |

All four indexes share a **UnifiedCache** for coordinated memory management, ensuring fair resource allocation and preventing any single index from monopolizing memory.

## 1. MetadataIndex - Fast Field Filtering

**Purpose**: Enable O(1) field-value lookups and O(log n) range queries on metadata fields.

### Internal Architecture

```typescript
class MetadataIndexManager {
  // Inverted indexes: field:value → Set<entityId>
  private indexCache = new Map<string, MetadataIndexEntry>()

  // Sorted indices for range queries
  private sortedIndices = new Map<string, SortedFieldIndex>()

  // Field statistics for query optimization
  private fieldStats = new Map<string, FieldStats>()

  // Type-field affinity for NLP understanding
  private typeFieldAffinity = new Map<string, Map<string, number>>()

  // Shared memory management
  private unifiedCache: UnifiedCache
}
```

### Key Data Structures

#### Inverted Index
```typescript
// Example: field="status", value="active"
// Key: "status:active"
// Value: MetadataIndexEntry {
//   ids: Set(['id1', 'id2', 'id3']),  // All entities with status="active"
//   metadata: { lastUpdated: timestamp, count: 3 }
// }
```

**Performance**: O(1) lookup for exact matches

#### Sorted Index
```typescript
// Example: field="publishDate" (numeric/temporal)
// Key: "publishDate"
// Value: SortedFieldIndex {
//   entries: [
//     [1609459200000, Set(['id1', 'id2'])],  // Jan 1, 2021
//     [1640995200000, Set(['id3', 'id4'])],  // Jan 1, 2022
//     [1672531200000, Set(['id5', 'id6'])]   // Jan 1, 2023
//   ]
// }
```

**Performance**: O(log n) binary search + O(k) result collection

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

## 4. DeletedItemsIndex - Soft-Delete Tracking

**Purpose**: O(1) tracking of soft-deleted items without removing data.

### Internal Architecture

```typescript
class DeletedItemsIndex {
  private deletedIds: Set<string> = new Set()
  private deletedCount: number = 0
  private storage: BaseStorage
}
```

**Simplicity is key**: Just a Set of deleted IDs. No complex logic needed.

### Operations

```typescript
// Mark as deleted
this.deletedItemsIndex.markDeleted(id)  // O(1)

// Check if deleted
const isDeleted = this.deletedItemsIndex.isDeleted(id)  // O(1)

// Filter out deleted items
const active = this.deletedItemsIndex.filterDeleted(results)  // O(n)

// Restore
this.deletedItemsIndex.markRestored(id)  // O(1)

// Get all deleted
const deleted = this.deletedItemsIndex.getAllDeleted()  // O(1) - returns Set
```

### Integration

All query results are filtered through the deleted items index:

```typescript
// In brainy.find() (src/brainy.ts:1026+)
let results = await this.performSearch(query)

// Filter out deleted items before returning
results = results.filter(r => !this.deletedItemsIndex.isDeleted(r.id))
```

## Shared Memory Management: UnifiedCache

All four indexes share a single **UnifiedCache** instance for coordinated memory management.

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

### 5. Index Rebuilding

All indexes rebuilt in parallel on initialization:

```typescript
// src/brainy.ts:init()
async init(): Promise<void> {
  // Check if indexes are empty
  const metadataEmpty = await this.metadataIndex.isEmpty()
  const hnswEmpty = await this.index.isEmpty()
  const graphEmpty = await this.graphIndex.isEmpty()

  if (metadataEmpty || hnswEmpty || graphEmpty) {
    // Rebuild all indexes in parallel
    await Promise.all([
      metadataEmpty ? this.metadataIndex.rebuild() : Promise.resolve(),
      hnswEmpty ? this.index.rebuild() : Promise.resolve(),
      graphEmpty ? this.graphIndex.rebuild() : Promise.resolve()
    ])
  }
}
```

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

| Operation | MetadataIndex | HNSWIndex | GraphAdjacencyIndex | DeletedItemsIndex |
|-----------|---------------|-----------|---------------------|-------------------|
| **Add** | O(1) per field | O(log n) | O(1) | O(1) |
| **Remove** | O(1) per field | O(log n) | O(1) | O(1) |
| **Exact lookup** | O(1) | N/A | O(1) | O(1) |
| **Range query** | O(log n) + O(k) | N/A | N/A | N/A |
| **Similarity search** | N/A | O(log n) | N/A | N/A |
| **Neighbor lookup** | N/A | N/A | O(1) | N/A |
| **Statistics** | O(1) | O(1) | O(1) | O(1) |

Where:
- n = total number of entities
- k = number of matching results

### Memory Footprint

| Index | Per-Entity Memory | Notes |
|-------|-------------------|-------|
| **MetadataIndex** | ~100 bytes | Depends on field count and cardinality |
| **HNSWIndex** | ~1.5 KB | Vector (384 dims × 4 bytes) + graph connections |
| **GraphAdjacencyIndex** | ~50 bytes per relationship | Bidirectional references + metadata |
| **DeletedItemsIndex** | ~40 bytes per deleted ID | Just Set storage |

**Total overhead**: ~1.6 KB per entity + ~50 bytes per relationship

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

**DeletedItemsIndex**:
- Soft deletes (preserve data but hide from queries)
- Audit trails (track what was deleted when)
- Restoration workflows (undo deletions)

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

## Version History

- **v3.41.0** (October 2025): Added automatic temporal bucketing to MetadataIndex
- **v3.40.0** (October 2025): Enhanced batch processing for imports
- **v3.0.0** (September 2025): Introduced 4-index architecture with UnifiedCache
