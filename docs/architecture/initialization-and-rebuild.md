# Initialization and Rebuild Processes

This document explains how Brainy's four indexes (MetadataIndex, HNSWIndex, GraphAdjacencyIndex, DeletedItemsIndex) initialize and rebuild from persisted storage.

## Core Principle: All Indexes Are Disk-Based

**KEY INSIGHT**: All indexes in Brainy are already disk-based. There is no need for snapshots or separate backup mechanisms. Initialization simply loads the right amount of data from storage into memory based on available resources.

### What Gets Persisted

| Index | Persisted Data | Storage Method | Since Version |
|-------|---------------|----------------|---------------|
| **MetadataIndex** | Field registry + chunked sparse indices with bloom filters + zone maps | `storage.saveMetadata()` | v3.42.0 (chunks), v4.2.1 (registry) |
| **HNSWIndex** | Vector embeddings + HNSW graph connections | `storage.saveHNSWData()` + `storage.saveHNSWSystem()` | v3.35.0 |
| **GraphAdjacencyIndex** | Relationships via LSM-tree SSTables | LSM-tree auto-persistence | v3.44.0 |
| **DeletedItemsIndex** | Set of deleted IDs | `storage.saveDeletedItems()` | v3.0.0 |

#### MetadataIndex Persistence Details (v4.2.1+)

The MetadataIndex now persists two components:

1. **Field Registry** (`__metadata_field_registry__`): Directory of indexed fields for O(1) discovery
   - Size: ~4-8KB (50-200 fields typical)
   - Enables instant cold starts by discovering persisted indices
   - Auto-saved during every flush operation

2. **Sparse Indices** (`__sparse_index__<field>`): Per-field index directories
   - Contains chunk metadata, zone maps, and bloom filters
   - Lazy-loaded via UnifiedCache on first query

3. **Chunks** (`__metadata_chunk__<field>_<chunkId>`): Actual inverted index data
   - Roaring bitmaps for compressed entity ID storage
   - Loaded on-demand based on query patterns

All storage operations use the **StorageAdapter** interface, which works with FileSystem, OPFS, S3, GCS, R2, and Memory backends.

## Initialization Process

### 1. Lazy Initialization Pattern

All indexes use lazy initialization - they don't load data until first use:

```typescript
// Example: GraphAdjacencyIndex
class GraphAdjacencyIndex {
  private initialized = false

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    // Initialize LSM-trees from storage
    await this.lsmTreeSource.init()
    await this.lsmTreeTarget.init()

    this.initialized = true
  }

  // Every public method calls ensureInitialized() first
  async getNeighbors(id: string): Promise<string[]> {
    await this.ensureInitialized()  // Lazy init!
    // ... actual logic
  }
}
```

**Benefits**:
- Zero-cost abstraction: No initialization overhead if index not used
- Faster startup: Indexes initialize in parallel on first use
- Lower memory: Only used indexes consume memory

### 2. Brain Initialization Flow

When you create a `Brain` instance and call `init()`, behavior depends on the `disableAutoRebuild` configuration:

#### Mode 1: Auto-Rebuild on init() (Default)

```typescript
// src/brainy.ts (lines 192-237)
async init(): Promise<void> {
  const initStartTime = Date.now()

  // STEP 1: Initialize storage and unified cache
  await this.storage.init()

  // STEP 2: Check index sizes (lazy initialization triggers here)
  const metadataStats = await this.metadataIndex.getStats()
  const hnswIndexSize = this.index.size()
  const graphIndexSize = await this.graphIndex.size()

  // STEP 3: Rebuild empty indexes from storage in parallel
  if (metadataStats.totalEntries === 0 ||
      hnswIndexSize === 0 ||
      graphIndexSize === 0) {

    const rebuildStartTime = Date.now()
    await Promise.all([
      metadataStats.totalEntries === 0
        ? this.metadataIndex.rebuild()
        : Promise.resolve(),
      hnswIndexSize === 0
        ? this.index.rebuild()
        : Promise.resolve(),
      graphIndexSize === 0
        ? this.graphIndex.rebuild()
        : Promise.resolve()
    ])

    const rebuildDuration = Date.now() - rebuildStartTime
    console.log(`✅ All indexes rebuilt in ${rebuildDuration}ms`)
  }

  // STEP 4: Log statistics
  const stats = await this.stats()
  console.log(`📊 Brain initialized with ${stats.entities} entities`)
}
```

**Timeline** (typical cold start with 10K entities):
- 0-50ms: Storage adapter initialization
- 50-100ms: Field registry loading (O(1) discovery of persisted indices)
- 100-200ms: Index lazy initialization (LSM-tree loading)
- 200-500ms: Cache warming (preload common fields)
- **No rebuild needed!** Registry discovers existing indices
- Total: ~0.5-1 second (instant cold starts)

**Timeline** (cold start WITHOUT field registry - first run only):
- 0-50ms: Storage adapter initialization
- 50-100ms: Index lazy initialization
- 100-2000ms: One-time rebuild to create indices
- Total: ~1-3 seconds (one time only)

#### Mode 2: Lazy Loading on First Query (v5.7.7+)

When `disableAutoRebuild: true`, indexes remain empty after init() and rebuild on first query:

```typescript
// User code
const brain = new Brainy({
  storage: { type: 'filesystem' },
  disableAutoRebuild: true  // Enable lazy loading
})

await brain.init()  // Returns instantly (0-10ms)

// First query triggers lazy rebuild
const results = await brain.find({ limit: 10 })
// → Calls ensureIndexesLoaded() internally (brainy.ts:4617)
// → Rebuilds all 3 main indexes with concurrency control
// → Returns results (~50-200ms total for 1K-10K entities)

// Subsequent queries are instant
const more = await brain.find({ limit: 100 })  // 0ms check, instant
```

**ensureIndexesLoaded() Implementation** (brainy.ts:4617-4664):
```typescript
private async ensureIndexesLoaded(): Promise<void> {
  // Fast path: Already loaded
  if (this.lazyRebuildCompleted) {
    return  // 0ms
  }

  // Concurrency control: Wait for in-progress rebuild
  if (this.lazyRebuildInProgress && this.lazyRebuildPromise) {
    await this.lazyRebuildPromise  // Wait for same rebuild
    return
  }

  // Check if storage has data
  const entities = await this.storage.getNouns({ pagination: { limit: 1 } })
  const hasData = (entities.totalCount && entities.totalCount > 0) || entities.items.length > 0

  if (!hasData) {
    this.lazyRebuildCompleted = true
    return
  }

  // Start lazy rebuild with mutex
  this.lazyRebuildInProgress = true
  this.lazyRebuildPromise = this.rebuildIndexesIfNeeded(true)
    .then(() => {
      this.lazyRebuildCompleted = true
    })
    .finally(() => {
      this.lazyRebuildInProgress = false
      this.lazyRebuildPromise = null
    })

  await this.lazyRebuildPromise
}
```

**Lazy Loading Performance:**
- First query: ~50-200ms (1K-10K entities) - triggers rebuild
- Concurrent queries: Wait for same rebuild (mutex prevents duplicates)
- Subsequent queries: 0ms check (instant)
- Zero-config: Works automatically, no code changes needed

**Use Cases for Lazy Loading:**
- **Serverless/Edge**: Minimize cold start time, indexes load on demand
- **Development**: Faster restarts during development
- **Large datasets**: Defer index loading until actually needed
- **Read-heavy workloads**: Write operations don't wait for index rebuild

## Rebuild Process

### What "Rebuild" Actually Means

**IMPORTANT**: "Rebuild" does NOT mean recomputing data. It means:
1. **Load persisted data** from storage (HNSW connections, metadata chunks, LSM-tree SSTables)
2. **Populate in-memory structures** (Maps, Sets, graphs)
3. **Apply adaptive caching** (preload vectors if small dataset, lazy load if large)

**Complexity**: O(N) - linear scan through storage, NOT O(N log N) recomputation!

### 1. HNSWIndex Rebuild (Correct Pattern)

```typescript
// src/hnsw/hnswIndex.ts (lines 809-947)
public async rebuild(options: {
  lazy?: boolean
  batchSize?: number
  onProgress?: (loaded: number, total: number) => void
} = {}): Promise<void> {
  // STEP 1: Clear in-memory structures
  this.clear()

  // STEP 2: Load system data (entry point, max level)
  const systemData = await this.storage.getHNSWSystem()
  this.entryPointId = systemData.entryPointId
  this.maxLevel = systemData.maxLevel

  // STEP 3: Determine preloading strategy (adaptive caching)
  const totalNouns = await this.storage.getNounCount()
  const vectorMemory = totalNouns * 384 * 4  // 384 dims × 4 bytes
  const availableCache = this.unifiedCache.getRemainingCapacity()
  const shouldPreload = vectorMemory < availableCache * 0.3

  // STEP 4: Load entities with persisted HNSW connections
  let hasMore = true
  let cursor: string | undefined = undefined

  while (hasMore) {
    const result = await this.storage.getNouns({
      pagination: { limit: 1000, cursor }
    })

    for (const nounData of result.items) {
      // Load HNSW graph data from storage (NOT recomputed!)
      const hnswData = await this.storage.getHNSWData(nounData.id)

      // Create noun with restored connections
      const noun: HNSWNoun = {
        id: nounData.id,
        vector: shouldPreload ? nounData.vector : [],  // Adaptive!
        connections: new Map(),
        level: hnswData.level
      }

      // Restore connections from persisted data
      for (const [levelStr, nounIds] of Object.entries(hnswData.connections)) {
        const level = parseInt(levelStr, 10)
        noun.connections.set(level, new Set<string>(nounIds))
      }

      // Just add to memory (no recomputation!)
      this.nouns.set(nounData.id, noun)
    }

    hasMore = result.hasMore
    cursor = result.nextCursor
  }
}
```

**Key Points**:
- ✅ Loads HNSW connections from storage via `getHNSWData()`
- ✅ Uses adaptive caching (preload vectors if < 30% of available cache)
- ✅ O(N) complexity - just loads existing data
- ❌ Does NOT call `addItem()` which would recompute connections (O(N log N))

### 2. TypeAwareHNSWIndex Rebuild (Fixed in v3.45.0)

**Critical Architectural Fix**: TypeAwareHNSWIndex previously had TWO major bugs:

1. **Bug #1**: Called `addItem()` during rebuild → O(N log N) recomputation instead of O(N) loading
2. **Bug #2**: Loaded ALL nouns 31 times in parallel (once per type) → O(31*N) complexity causing timeouts

Both were fixed in v3.45.0 by loading ALL nouns ONCE and routing to correct type indexes:

```typescript
// src/hnsw/typeAwareHNSWIndex.ts (lines 379-571)
public async rebuild(options?: {
  lazy?: boolean
  batchSize?: number
  onProgress?: (loaded: number, total: number) => void
}): Promise<void> {
  // STEP 1: Clear all type-specific indexes
  for (const index of this.typeIndexes.values()) {
    index.clear()
  }

  // STEP 2: Determine preloading strategy (same as HNSWIndex)
  const totalNouns = await this.storage.getNounCount()
  const vectorMemory = totalNouns * 384 * 4
  const availableCache = this.unifiedCache.getRemainingCapacity()
  const shouldPreload = vectorMemory < availableCache * 0.3

  // STEP 3: Load entities grouped by type
  for (const nounType of ALL_NOUN_TYPES) {
    const index = this.getOrCreateIndex(nounType)
    let hasMore = true
    let cursor: string | undefined = undefined

    while (hasMore) {
      const result = await this.storage.getNouns({
        type: nounType,
        pagination: { limit: 1000, cursor }
      })

      for (const nounData of result.items) {
        // CORRECT: Load persisted HNSW data (not recomputed!)
        const hnswData = await this.storage.getHNSWData(nounData.id)

        const noun = {
          id: nounData.id,
          vector: shouldPreload ? nounData.vector : [],
          connections: new Map(),
          level: hnswData.level
        }

        // Restore connections from storage
        for (const [levelStr, nounIds] of Object.entries(hnswData.connections)) {
          const level = parseInt(levelStr, 10)
          noun.connections.set(level, new Set<string>(nounIds))
        }

        // Add to in-memory index (no recomputation!)
        index.nouns.set(nounData.id, noun)
      }

      hasMore = result.hasMore
      cursor = result.nextCursor
    }
  }
}
```

**Bug Fix**: Changed from `index.addItem()` (recomputation) to direct `nouns.set()` (restoration).

**Performance Impact**: 200-600x speedup (5 minutes → 500ms for 10K entities)

**Correct Pattern** (v3.45.0):
```typescript
// Load ALL nouns ONCE (not 31 times!)
while (hasMore) {
  const result = await storage.getNounsWithPagination({ limit: 1000, cursor })

  for (const noun of result.items) {
    const type = noun.nounType || noun.metadata?.noun
    const index = this.getIndexForType(type)

    // Load persisted HNSW data
    const hnswData = await storage.getHNSWData(noun.id)

    // Restore connections (not recompute!)
    const restoredNoun = {
      id: noun.id,
      vector: shouldPreload ? noun.vector : [],
      connections: restoreConnections(hnswData),
      level: hnswData.level
    }

    // Add to correct type index
    index.nouns.set(noun.id, restoredNoun)
  }

  cursor = result.nextCursor
  hasMore = result.hasMore
}
```

**Performance Improvements**:
- 31x speedup: Load nouns ONCE instead of 31 times (O(N) vs O(31*N))
- 200-600x speedup: Load from storage instead of recomputing (O(N) vs O(N log N))
- **Combined**: ~6000x speedup! (150 minutes → 1.5 seconds for 10K entities)

### 3. MetadataIndex Rebuild (v4.2.1+ with Field Registry)

**v4.2.1 Critical Fix**: Field registry persistence eliminates unnecessary rebuilds!

```typescript
// src/utils/metadataIndex.ts (lines 202-216)
async init(): Promise<void> {
  // STEP 1: Load field registry to discover persisted indices (v4.2.1)
  // This is THE KEY FIX - O(1) discovery of existing indices
  await this.loadFieldRegistry()

  // If registry found, fieldIndexes Map is now populated
  // getStats() will return totalEntries > 0 → skips rebuild!

  // STEP 2: Initialize EntityIdMapper
  await this.idMapper.init()

  // STEP 3: Warm cache with discovered fields
  await this.warmCache()
}

async loadFieldRegistry(): Promise<void> {
  const registry = await this.storage.getMetadata('__metadata_field_registry__')

  if (registry?.fields) {
    // Populate fieldIndexes Map from discovered fields
    // Sparse indices are lazy-loaded when first accessed
    for (const field of registry.fields) {
      this.fieldIndexes.set(field, {
        values: {},
        lastUpdated: registry.lastUpdated
      })
    }
    // Result: getStats() now returns totalEntries > 0
    // → Brain skips rebuild, cold start in 2-3 seconds!
  }
}
```

**Rebuild Only Happens If**:
1. **First run** (no field registry exists yet)
2. **Registry corruption** (rare)
3. **Explicit rebuild request** (manual operation)

```typescript
// Only runs if field registry not found
async rebuild(): Promise<void> {
  // STEP 1: Clear in-memory structures
  this.fieldIndexes.clear()

  // STEP 2: Load all entity metadata and rebuild indices
  // Sequential batching (25/batch) to prevent socket exhaustion
  // After rebuild: Field registry saved during next flush()

  // One-time cost: ~2-3 seconds for 1K entities
}
```

**Performance Comparison**:

| Version | Cold Start | Discovery Method | Rebuild Needed? |
|---------|------------|------------------|-----------------|
| v4.2.0 | 8-9 min | None (always rebuild) | Always |
| v4.2.1 | 2-3 sec | Field registry O(1) | First run only |

**Key Points**:
- ✅ Field registry enables O(1) discovery (4-8KB file)
- ✅ Sparse indices lazy-loaded on first query
- ✅ Bloom filters + zone maps loaded for fast filtering
- ✅ One-time rebuild on first run, then instant restarts forever
- ✅ Automatic: No configuration needed

### 4. GraphAdjacencyIndex Rebuild

```typescript
// src/graph/graphAdjacencyIndex.ts (lines 279-336)
async rebuild(): Promise<void> {
  // STEP 1: Clear in-memory caches
  this.verbIndex.clear()
  this.relationshipCountsByType.clear()

  // STEP 2: Load all verbs from storage
  let hasMore = true
  let cursor: string | undefined = undefined

  while (hasMore) {
    const result = await this.storage.getVerbs({
      pagination: { limit: 1000, cursor }
    })

    for (const verb of result.items) {
      // Add to index (which updates LSM-trees)
      await this.addVerb(verb)
    }

    hasMore = result.hasMore
    cursor = result.nextCursor
  }

  // Note: LSM-trees (lsmTreeSource, lsmTreeTarget) are already
  // initialized from persisted SSTables during ensureInitialized()
}
```

**Key Points**:
- ✅ LSM-tree SSTables already loaded during `init()`
- ✅ Rebuild just repopulates verb cache
- ✅ O(E) complexity where E = number of edges

## Adaptive Memory Management

### Strategy: Preload vs Lazy Load

All indexes use the **UnifiedCache** to determine memory allocation:

```typescript
// Decision logic (in all indexes)
const totalDataSize = estimateDataSize()
const availableCache = unifiedCache.getRemainingCapacity()

if (totalDataSize < availableCache * 0.3) {
  // PRELOAD: Dataset is small relative to available memory
  // Load everything into memory for maximum performance
  shouldPreload = true
} else {
  // LAZY LOAD: Dataset is large
  // Load on-demand with LRU eviction
  shouldPreload = false
}
```

**Thresholds**:
- **< 30% of available cache**: Preload all vectors
- **> 30% of available cache**: Lazy load on demand

**Example** (default 100MB cache):
- 10K entities × 1.5KB = 15MB → **Preload** (15MB < 30MB)
- 100K entities × 1.5KB = 150MB → **Lazy load** (150MB > 30MB)

### UnifiedCache Integration

```typescript
// All indexes share the same cache
const unifiedCache = getGlobalCache()  // Singleton, 100MB default

// MetadataIndex
this.unifiedCache = unifiedCache

// HNSWIndex
this.unifiedCache = unifiedCache

// GraphAdjacencyIndex
this.unifiedCache = unifiedCache
```

**Benefits**:
- Fair resource allocation across indexes
- Prevents any single index from monopolizing memory
- Coordinated LRU eviction system-wide

## Performance Characteristics

### Rebuild Times (Typical Hardware)

| Dataset Size | Metadata | HNSW | Graph | Total (Parallel) |
|--------------|----------|------|-------|------------------|
| 1K entities | 50ms | 100ms | 30ms | **150ms** |
| 10K entities | 200ms | 500ms | 150ms | **600ms** |
| 100K entities | 1s | 3s | 1s | **3.5s** |
| 1M entities | 8s | 25s | 10s | **28s** |

**Note**: Parallel rebuild means total time ≈ max(individual times), not sum.

### Memory Overhead

| Index | In-Memory Overhead | Disk Storage |
|-------|-------------------|--------------|
| **MetadataIndex** | ~100 bytes/entity | ~500 bytes/entity (chunks) |
| **HNSWIndex** | ~200 bytes/entity (no vectors) | ~1.5 KB/entity (vectors + connections) |
| **GraphAdjacencyIndex** | ~128 bytes/relationship | ~200 bytes/relationship (LSM-tree) |
| **DeletedItemsIndex** | ~40 bytes/deleted ID | ~50 bytes/deleted ID |

**Total overhead** (lazy loading):
- **In-memory**: ~300 bytes per entity + ~128 bytes per relationship
- **On-disk**: ~2 KB per entity + ~200 bytes per relationship

### O(N) vs O(N log N) Comparison

**Before fix** (TypeAwareHNSWIndex bug):
```typescript
// BAD: Recomputes HNSW connections during rebuild
for (const noun of nouns) {
  await index.addItem(noun)  // O(log N) per item → O(N log N) total
}
// 10K entities: ~5 minutes
```

**After fix** (correct pattern):
```typescript
// GOOD: Loads connections from storage
for (const noun of nouns) {
  const hnswData = await storage.getHNSWData(noun.id)  // O(1) per item
  noun.connections = restoreConnections(hnswData)      // O(1) per item
  index.nouns.set(noun.id, noun)                       // O(1) per item
}
// 10K entities: ~500ms (600x faster!)
```

## Common Patterns

### Cold Start (Empty Storage)

```typescript
const brain = new Brain({ storage })

// First init: All indexes are empty
await brain.init()
// → No rebuild needed, indexes start empty

// Add data
await brain.add({ content: 'Hello', noun: 'message' })

// Second init: Indexes populated
const brain2 = new Brain({ storage })
await brain2.init()
// → Rebuilds all indexes from storage (~1-3s for 10K entities)
```

### Warm Start (Storage Already Populated)

```typescript
const brain = new Brain({ storage })

// Init with existing data
await brain.init()
// → Detects non-empty storage
// → Rebuilds indexes in parallel
// → Uses adaptive caching (preload if small, lazy if large)
```

### Manual Rebuild

```typescript
const brain = new Brain({ storage })
await brain.init()

// Force rebuild (e.g., after data corruption)
await brain.metadataIndex.rebuild()
await brain.index.rebuild()
await brain.graphIndex.rebuild()
```

## Troubleshooting

### Slow Rebuild Times

**Symptom**: Rebuild takes minutes instead of seconds

**Diagnosis**:
```typescript
// Check if rebuild is recomputing instead of loading
console.time('rebuild')
await brain.index.rebuild()
console.timeEnd('rebuild')

// For 10K entities:
// - Expected: 500-800ms (loading from storage)
// - Bug: 5-10 minutes (recomputing HNSW connections)
```

**Solution**: Ensure index is loading from storage, not calling `addItem()` during rebuild.

### High Memory Usage

**Symptom**: Memory usage exceeds expectations

**Diagnosis**:
```typescript
// Check if vectors are being preloaded
const stats = brain.index.getStats()
console.log('Preloaded vectors:', stats.preloadedVectors)

// Expected:
// - Small dataset (< 30% cache): Most vectors preloaded
// - Large dataset (> 30% cache): Few vectors preloaded
```

**Solution**: Adjust `UnifiedCache` size or force lazy loading:
```typescript
const brain = new Brain({
  storage,
  cache: { maxSize: 50 * 1024 * 1024 }  // 50MB cache
})
```

### Missing Data After Rebuild

**Symptom**: Entities disappear after restart

**Diagnosis**:
```typescript
// Check storage persistence
const nouns = await storage.getNouns({ pagination: { limit: 10 } })
console.log('Nouns in storage:', nouns.items.length)

// If empty: Storage not persisting
// If populated: Rebuild not loading correctly
```

**Solution**: Verify storage adapter is configured correctly (e.g., FileSystem path exists).

## Related Documentation

- [Index Architecture](./index-architecture.md) - Data structures and operations
- [Storage Architecture](./storage-architecture.md) - Storage layer details
- [Performance Guide](../PERFORMANCE.md) - Performance tuning
- [Scaling Guide](../SCALING.md) - Large dataset optimization

## Version History

- **v5.7.7** (November 2025): Added production-scale lazy loading with `ensureIndexesLoaded()` helper. Fixed critical bug where `disableAutoRebuild: true` left indexes empty forever. Added concurrency control (mutex) to prevent duplicate rebuilds from concurrent queries. Added `getIndexStatus()` diagnostic method. Zero-config operation - works automatically.
- **v3.45.0** (October 2025): Fixed TypeAwareHNSWIndex.rebuild() to load from storage instead of recomputing. Removed all snapshot code (unnecessary with correct rebuild pattern). 200-600x speedup.
- **v3.44.0** (October 2025): GraphAdjacencyIndex migrated to LSM-tree storage for billion-scale relationships
- **v3.42.0** (October 2025): MetadataIndex migrated to chunked sparse indexing
- **v3.35.0** (August 2025): HNSW connections first persisted to storage
- **v3.0.0** (September 2025): Initial 3-tier index architecture
