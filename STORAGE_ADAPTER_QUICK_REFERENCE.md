# Brainy Storage Adapter - Quick Reference Guide

## File Locations

```
src/storage/
├── baseStorageAdapter.ts          # Abstract base class (1,156 lines)
├── baseStorage.ts                 # Implementation layer (1,098 lines)
├── storageFactory.ts              # Factory for adapter selection
├── sharding.ts                    # UUID-based sharding utilities
├── cacheManager.ts                # Cache implementation
└── adapters/
    ├── fileSystemStorage.ts       # Node.js file system (2,677 lines)
    ├── memoryStorage.ts           # In-memory storage (822 lines)
    ├── s3CompatibleStorage.ts     # AWS S3 / R2 / GCS compat (5000+ lines)
    ├── gcsStorage.ts              # Google Cloud Storage native (1,835 lines)
    ├── opfsStorage.ts             # Browser OPFS storage
    └── baseStorageAdapter.ts      # Base class

src/coreTypes.ts
└── StorageAdapter interface (27 methods)
```

## Storage Adapter Hierarchy

```
┌─ StorageAdapter (interface)
│  ├─ StorageAdapter.init()
│  ├─ StorageAdapter.saveNoun()
│  ├─ StorageAdapter.getNouns()
│  └─ ... (23 more methods)
│
└─ BaseStorageAdapter (abstract class)
   ├─ Statistics management
   ├─ Throttling detection
   ├─ Count tracking (O(1))
   ├─ Service-level statistics
   └─ Abstract methods for subclasses
   
   └─ BaseStorage (abstract class)
      ├─ 2-file system routing
      ├─ Pagination support
      ├─ Metadata handling
      ├─ Public API (saveNoun, getNoun, etc.)
      └─ Abstract internal methods
      
      └─ Concrete Adapters
         ├─ FileSystemStorage
         ├─ MemoryStorage
         ├─ S3CompatibleStorage
         ├─ GcsStorage
         └─ OPFSStorage
```

## Abstract Methods to Implement

When creating a new adapter, extend `BaseStorage` and implement:

### Noun/Verb Operations (6 methods)
```typescript
protected abstract saveNoun_internal(noun: HNSWNoun): Promise<void>
protected abstract getNoun_internal(id: string): Promise<HNSWNoun | null>
protected abstract deleteNoun_internal(id: string): Promise<void>
protected abstract saveVerb_internal(verb: HNSWVerb): Promise<void>
protected abstract getVerb_internal(id: string): Promise<HNSWVerb | null>
protected abstract deleteVerb_internal(id: string): Promise<void>
```

### Path Operations (4 methods)
```typescript
protected abstract writeObjectToPath(path: string, data: any): Promise<void>
protected abstract readObjectFromPath(path: string): Promise<any | null>
protected abstract deleteObjectFromPath(path: string): Promise<void>
protected abstract listObjectsUnderPath(prefix: string): Promise<string[]>
```

### Count Management (2 methods)
```typescript
protected abstract initializeCounts(): Promise<void>
protected abstract persistCounts(): Promise<void>
```

### Statistics (2 methods)
```typescript
protected abstract saveStatisticsData(statistics: StatisticsData): Promise<void>
protected abstract getStatisticsData(): Promise<StatisticsData | null>
```

### Lifecycle (3 methods)
```typescript
abstract init(): Promise<void>
abstract clear(): Promise<void>
abstract getStorageStatus(): Promise<StorageStatus>
```

**Total: 17 abstract methods to implement**

## Storage Path Structure

### Modern Entity-Based Structure
```
storage-root/
├── entities/
│   ├── nouns/vectors/{shard}/{id}.json        ← Vector data
│   ├── nouns/metadata/{shard}/{id}.json       ← Metadata
│   ├── nouns/hnsw/{shard}/{id}.json           ← HNSW graph
│   ├── verbs/vectors/{shard}/{id}.json
│   ├── verbs/metadata/{shard}/{id}.json
│   └── verbs/hnsw/{shard}/{id}.json
├── indexes/
│   ├── metadata/...                           ← Search indexes
│   └── graph/...
└── _system/
    ├── statistics.json                        ← Aggregate stats
    ├── counts.json                            ← O(1) totals
    └── hnsw-system.json                       ← HNSW metadata
```

### Shard Format
- First 2 hex chars of UUID (00-ff) = 256 shards
- Example: `ab123456-...` → stored in `ab/` directory
- Enables 2.5M+ entities with consistent performance

## 2-File System Design

### Vector File (always loaded with HNSW)
```json
{
  "id": "ab123456-...",
  "vector": [0.1, 0.2, ...],
  "connections": { "0": [...], "1": [...] },
  "level": 2
}
```

### Metadata File (loaded separately)
```json
{
  "noun": "Person",
  "name": "Alice",
  "email": "alice@example.com",
  "createdAt": "...",
  "service": "user-service"
}
```

**Benefit:** Decouple vector operations from flexible metadata queries

## Existing Adapters Overview

### FileSystemStorage (Node.js)
- 2,677 lines
- Sharding with migration support
- File-based locking for multi-process
- Production-ready

### MemoryStorage (Testing)
- 822 lines
- In-memory Maps
- Fast for testing
- No persistence

### S3CompatibleStorage (Cloud)
- 5,000+ lines
- AWS S3, Cloudflare R2, GCS (via S3 API)
- Adaptive batching, request coalescing
- High-volume mode, write buffers

### GcsStorage (Google Cloud)
- 1,835 lines
- Native @google-cloud/storage SDK
- ADC, service account, HMAC auth
- Cache managers, backpressure

### OPFSStorage (Browser)
- Browser Origin Private File System
- Persistent across sessions
- Modern browsers only

## Factory Integration

```typescript
// src/storage/storageFactory.ts
const storage = await createStorage({
  type: 'filesystem',           // auto, memory, filesystem, s3, gcs, gcs-native, opfs
  path: './data',
  s3Storage: { bucketName, region, ... },
  gcsStorage: { bucketName, credentials, ... },
})
```

## Adding TypeAwareStorageAdapter

### Recommended Approach: Direct Implementation
```typescript
// src/storage/adapters/typeAwareStorageAdapter.ts
export class TypeAwareStorageAdapter extends BaseStorage {
  // Implement 17 abstract methods
  // Add type indexing logic
  // Track noun/verb types in separate indexes
}
```

### Integration Steps
1. Create `/src/storage/adapters/typeAwareStorageAdapter.ts`
2. Add to factory in `/src/storage/storageFactory.ts`
3. Update StorageOptions interface with `type: 'type-aware'`
4. No changes to Brainy.ts or existing adapters needed

## Key Features Inherited from BaseStorageAdapter

- **Statistics Caching:** Batches updates for efficiency
- **Throttling Detection:** Handles 429/503 errors
- **Count Management:** O(1) operations with persistence
- **Service Tracking:** Per-service statistics
- **Field Name Tracking:** Metadata field discovery

## Performance Characteristics

### O(1) Operations
- `getNounCount()` - total noun count
- `getVerbCount()` - total verb count

### O(n) Operations
- `getNouns()` - paginated listing (n = page size)
- `getVerbs()` - paginated listing
- `getNounsByNounType()` - filter by type
- `getVerbsBySource()` - filter by source

### Cloud Storage Features (GCS, S3)
- High-volume mode detection
- Adaptive batching
- Request coalescing for deduplication
- Write buffers for bulk operations
- Backpressure management
- Socket pool management

## Testing Storage Adapters

All adapters implement the same interface, so:

```typescript
// Test with MemoryStorage (fastest)
const storage = new MemoryStorage()

// Test with FileSystemStorage (persistent)
const storage = new FileSystemStorage('./test-data')

// All adapters support the same operations
await storage.init()
await storage.saveNoun(noun)
const result = await storage.getNoun(id)
await storage.clear()
```

## Brainy Integration

```typescript
export class Brainy {
  private storage!: BaseStorage
  
  async init(config: BrainyConfig): Promise<void> {
    // Factory creates appropriate adapter
    this.storage = await createStorage(config.storage) as BaseStorage
    await this.storage.init()
    
    // Pass to HNSW index
    this.index = new HNSWIndex(this.storage, ...)
  }
}
```

Brainy depends on `BaseStorage` interface, not specific adapters.

## Design Patterns Used

1. **Factory Pattern** - `createStorage()` selects adapter
2. **Strategy Pattern** - Adapters are interchangeable
3. **Template Method** - BaseStorage defines skeleton
4. **Decorator Pattern** - Can wrap adapters (e.g., TypeAware wrapper)
5. **Adapter Pattern** - Maps different storage backends to same interface

## Conclusion

TypeAwareStorageAdapter can be added as a **new adapter alongside existing ones** without:
- Modifying Brainy.ts
- Replacing existing adapters
- Breaking the StorageAdapter interface
- Changing how storage is used throughout the codebase

Simply extend `BaseStorage`, implement 17 abstract methods, and register in `storageFactory.ts`.
