# Brainy Storage System - Complete File Reference

## Core Storage Files

### 1. Storage Interface Definition
**File:** `src/coreTypes.ts`
- **Lines:** ~250 (StorageAdapter interface)
- **Type:** Interface definition
- **Content:** 
  - `StorageAdapter` interface (27 methods)
  - Supporting types: `HNSWNoun`, `HNSWVerb`, `GraphVerb`
  - Statistics types: `StatisticsData`, `ServiceStatistics`

### 2. Base Storage Adapter (Abstract Class)
**File:** `src/storage/adapters/baseStorageAdapter.ts`
- **Lines:** 1,156
- **Type:** Abstract base class
- **Purpose:** Common functionality for all adapters
- **Key Features:**
  - Statistics caching and batching
  - Throttling detection and backoff
  - Count management (O(1) operations)
  - Service-level statistics tracking
  - Field name discovery
- **Implements:** StorageAdapter interface
- **Key Methods:**
  - `flushStatistics()` - Write statistics to storage
  - `isThrottlingError()` - Detect cloud storage throttling
  - `handleThrottling()` - Exponential backoff
  - `trackThrottlingEvent()` - Record throttling events
  - `incrementStatistic()` - Increment service stats
  - `decrementStatistic()` - Decrement service stats

### 3. Base Storage Implementation
**File:** `src/storage/baseStorage.ts`
- **Lines:** 1,098
- **Type:** Abstract class extending BaseStorageAdapter
- **Purpose:** Core storage logic (routing, sharding, metadata)
- **Key Features:**
  - 2-file system implementation (vectors + metadata)
  - UUID-based sharding (256 directories)
  - Metadata routing and separation
  - Pagination support
  - Backward compatibility with legacy paths
- **Implements:** 
  - Public API (saveNoun, getNoun, etc.)
  - Metadata operations (saveNounMetadata, etc.)
- **Key Abstract Methods:**
  - `saveNoun_internal()` - Adapter-specific noun save
  - `getNoun_internal()` - Adapter-specific noun read
  - `writeObjectToPath()` - Generic write
  - `readObjectFromPath()` - Generic read
  - `listObjectsUnderPath()` - Listing support

### 4. Storage Factory
**File:** `src/storage/storageFactory.ts`
- **Lines:** ~200
- **Purpose:** Factory function for adapter selection
- **Function:** `createStorage(options: StorageOptions): Promise<StorageAdapter>`
- **Selection Logic:**
  1. Forced memory/filesystem (testing)
  2. Explicit type selection
  3. Auto-detection (browser vs Node.js)
- **Supported Types:**
  - `'memory'` - MemoryStorage
  - `'filesystem'` - FileSystemStorage
  - `'s3'` - S3CompatibleStorage (AWS S3, R2)
  - `'gcs'` - S3CompatibleStorage (GCS S3 API)
  - `'gcs-native'` - GcsStorage (native SDK)
  - `'opfs'` - OPFSStorage (browser)

### 5. Sharding Utilities
**File:** `src/storage/sharding.ts`
- **Purpose:** UUID-based sharding helpers
- **Key Functions:**
  - `getShardIdFromUuid(id: string): string` - Get first 2 hex chars
  - `getShardIdByIndex(index: number): string` - Get shard by index
  - `getAllShardIds(): string[]` - All 256 shard IDs
- **Constants:**
  - `TOTAL_SHARDS = 256`
  - `MIN_SHARD_ID = '00'`
  - `MAX_SHARD_ID = 'ff'`

### 6. Cache Manager
**File:** `src/storage/cacheManager.ts`
- **Purpose:** Generic LRU cache for storage
- **Type:** Generic class `CacheManager<T>`
- **Used By:** GcsStorage, S3CompatibleStorage
- **Features:**
  - LRU eviction
  - TTL support
  - Max size limits
  - Batch operations

## Storage Adapter Implementations

### FileSystemStorage (Node.js)
**File:** `src/storage/adapters/fileSystemStorage.ts`
- **Lines:** 2,677
- **Type:** Concrete implementation extending BaseStorage
- **Platform:** Node.js only
- **Storage Target:** Local file system
- **Key Features:**
  - Sharding with automatic migration
  - File-based locking (multi-process)
  - O(1) count persistence
  - HNSW index persistence
  - Dual-write for migrations
  - Path depth migration (0→1, 2→1)

**Key Methods:**
```typescript
private getNounPath(id: string, depth: number): string
private getVerbPath(id: string, depth: number): string
private getNounMetadataPath(id: string, depth: number): string
async migrateShardingStructure(fromDepth: number, toDepth: number): Promise<void>
async migrateFromOldStructure(): Promise<void>
```

**Statistics Tracking:**
- Persists counts to `_system/counts.json`
- Tracks noun/verb type distributions
- Service-level activity timestamps
- Field name discovery

### MemoryStorage (Testing)
**File:** `src/storage/adapters/memoryStorage.ts`
- **Lines:** 822
- **Type:** Concrete implementation extending BaseStorage
- **Platform:** Browser & Node.js
- **Storage Target:** In-memory Maps
- **Key Features:**
  - Fast for testing
  - No persistence (ephemeral)
  - Full pagination support
  - Filtering capabilities
  - 2-file system simulation

**Key Maps:**
```typescript
private nouns: Map<string, HNSWNoun>
private verbs: Map<string, HNSWVerb>
private objectStore: Map<string, any>  // Unified metadata store
```

**Methods:**
- `getNouns()` - Paginated noun listing
- `getVerbs()` - Paginated verb listing
- `getMetadataBatch()` - Batch metadata loading

### S3CompatibleStorage (Cloud)
**File:** `src/storage/adapters/s3CompatibleStorage.ts`
- **Lines:** 5,000+
- **Type:** Concrete implementation extending BaseStorage
- **Platform:** Node.js (server-side)
- **Storage Targets:**
  - Amazon S3
  - Cloudflare R2 (via S3 API)
  - Google Cloud Storage (via S3 API)

**Key Features:**
- Adaptive batching (10-1000 items)
- Request coalescing for deduplication
- High-volume mode detection
- Write buffers for bulk operations
- Socket pool management
- Backpressure system
- Change log tracking
- Cache management (nouns & verbs)

**Performance Optimization:**
- `nounWriteBuffer` - Batches noun writes
- `verbWriteBuffer` - Batches verb writes
- `requestCoalescer` - Deduplicates requests
- `highVolumeMode` - Activates at >20 pending ops
- `baseBatchSize` - Adaptive from 10 to 1000

### GcsStorage (Google Cloud Native)
**File:** `src/storage/adapters/gcsStorage.ts`
- **Lines:** 1,835
- **Type:** Concrete implementation extending BaseStorage
- **Platform:** Node.js (server-side)
- **Storage Target:** Google Cloud Storage
- **SDK:** `@google-cloud/storage` (native)

**Key Features:**
- Application Default Credentials (ADC)
- Service Account Key File support
- Service Account Credentials Object
- HMAC Keys (backward compatible)
- Multi-level cache managers
- Backpressure management
- High-volume mode
- Request coalescing

**Authentication Priority:**
1. ADC (Application Default Credentials)
2. Service Account Key File
3. Service Account Credentials
4. HMAC Keys

**Cache Managers:**
```typescript
private nounCacheManager: CacheManager<HNSWNode>
private verbCacheManager: CacheManager<Edge>
```

### OPFSStorage (Browser Storage)
**File:** `src/storage/adapters/opfsStorage.ts`
- **Type:** Concrete implementation extending BaseStorage
- **Platform:** Browser only
- **Storage Target:** Origin Private File System (OPFS)
- **Fallback:** MemoryStorage if OPFS unavailable

**Browser Compatibility:**
- Chrome 96+
- Edge 96+
- Safari 15.1+

## Storage Patterns and Utilities

### Backward Compatibility
**File:** `src/storage/backwardCompatibility.ts`
- **Purpose:** Handle legacy storage paths
- **Features:**
  - Path migration detection
  - Dual-write during transition
  - Graceful fallback to old locations
  - Read-from-new, fallback-to-old

### Metadata Index
**File:** `src/utils/metadataIndex.ts`
- **Purpose:** Build searchable indexes from metadata
- **Used By:** Brainy for fast metadata queries
- **Features:**
  - Field name discovery
  - Standard field mapping
  - Service-level statistics

### Storage Discovery (Distributed)
**File:** `src/distributed/storageDiscovery.ts`
- **Purpose:** Discover storage config in distributed systems
- **Features:**
  - Node coordination
  - Storage synchronization

### Adaptive Backpressure
**File:** `src/utils/adaptiveBackpressure.ts`
- **Purpose:** Flow control for storage operations
- **Used By:** All cloud storage adapters
- **Features:**
  - Request queuing
  - Throttling detection
  - Backoff scheduling

### Write Buffer
**File:** `src/utils/writeBuffer.ts`
- **Purpose:** Batch write operations
- **Used By:** S3, GCS adapters
- **Features:**
  - Configurable batch size
  - Flush on timeout
  - Deduplication

### Request Coalescer
**File:** `src/utils/requestCoalescer.ts`
- **Purpose:** Deduplicate concurrent requests
- **Used By:** S3, GCS adapters
- **Features:**
  - Request deduplication
  - Batch processing

## Integration Points

### In Brainy.ts (Main Class)
```typescript
private storage!: BaseStorage

async init(): Promise<void> {
  // Create storage from factory
  const storageAdapter = await createStorage(this.config.storage)
  this.storage = storageAdapter as BaseStorage
  
  // Initialize
  await this.storage.init()
  
  // Pass to HNSW index
  this.index = new HNSWIndex(this.storage, ...)
}
```

### In HNSW Index
```typescript
export class HNSWIndex {
  constructor(private storage: StorageAdapter, ...)
  
  // Uses storage for node/edge persistence
  async saveNode(noun: HNSWNoun): Promise<void>
  async getNode(id: string): Promise<HNSWNoun>
}
```

### In Metadata Index
```typescript
export class MetadataIndexManager {
  constructor(storage: StorageAdapter, ...)
  
  // Uses storage for metadata queries
  async getNounsByFilter(filter: Filter): Promise<HNSWNoun[]>
}
```

## Data Flow

### Saving a Noun
```
Brainy.add()
  ↓
HNSWIndex.insert()
  ↓
BaseStorage.saveNoun()
  ├─ saveNoun_internal() → adapter-specific
  ├─ saveNounMetadata() → path routing
  └─ updateStatistics()

FileSystemStorage.saveNoun_internal()
  ├─ Create shard directory (ab/)
  ├─ Write JSON file
  └─ Update counts
```

### Querying Nouns
```
Brainy.search()
  ↓
HNSW.search()
  ↓
BaseStorage.getNoun()
  ├─ getNoun_internal() → adapter-specific
  └─ getNounMetadata() → path routing

S3CompatibleStorage.getNoun_internal()
  ├─ Check cache
  ├─ Download from S3
  ├─ Parse JSON
  └─ Update cache
```

## Storage Statistics Tracking

### Stored in `_system/statistics.json`
```json
{
  "nounCount": { "Person": 5, "Company": 2 },
  "verbCount": { "knows": 10, "works_at": 3 },
  "metadataCount": { "user-service": 50 },
  "hnswIndexSize": 15,
  "totalNodes": 7,
  "totalEdges": 13,
  "services": [
    { "name": "user-service", "totalNouns": 5, ... }
  ],
  "lastUpdated": "2024-10-15T..."
}
```

### Stored in `_system/counts.json`
```json
{
  "totalNounCount": 7,
  "totalVerbCount": 13,
  "entityCounts": { "Person": 5, "Company": 2 },
  "verbCounts": { "knows": 10, "works_at": 3 }
}
```

## Type Definitions

### HNSWNoun (Vector + HNSW)
```typescript
interface HNSWNoun {
  id: string
  vector: number[]
  connections: Map<number, Set<string>>  // level → node IDs
  level: number
  metadata?: any  // Optional in vector file, separate file system
}
```

### GraphVerb (Relationship)
```typescript
interface GraphVerb {
  id: string
  sourceId: string
  targetId: string
  vector: number[]
  type?: string
  weight?: number
  metadata?: any
  // Plus aliases: source, target, verb, embedding
  createdAt?: Timestamp
  createdBy?: { augmentation: string; version: string }
}
```

## Summary Statistics

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| StorageAdapter Interface | coreTypes.ts | 250 | Interface definition |
| BaseStorageAdapter | baseStorageAdapter.ts | 1,156 | Common functionality |
| BaseStorage | baseStorage.ts | 1,098 | Core routing & pagination |
| storageFactory | storageFactory.ts | 200 | Adapter selection |
| FileSystemStorage | fileSystemStorage.ts | 2,677 | Node.js FS |
| MemoryStorage | memoryStorage.ts | 822 | In-memory (test) |
| S3CompatibleStorage | s3CompatibleStorage.ts | 5,000+ | AWS S3 / R2 / GCS |
| GcsStorage | gcsStorage.ts | 1,835 | Google Cloud native |
| sharding.ts | sharding.ts | ~100 | UUID sharding |
| cacheManager.ts | cacheManager.ts | ~200 | LRU cache |
| **TOTAL** | | **~13,000+** | **Complete storage system** |

## Conclusion

Brainy's storage architecture is:
- Well-layered (Interface → Abstract → Concrete)
- Extensible (factory pattern)
- Flexible (multiple backends)
- Scalable (sharding, caching, batching)
- Type-safe (full TypeScript support)

New adapters like TypeAwareStorageAdapter simply extend BaseStorage and implement 17 abstract methods.
