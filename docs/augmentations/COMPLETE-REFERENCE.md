# 🔌 Brainy 2.0 Augmentations Complete Reference

> **All 27 augmentations that power Brainy's extensibility - with locations, usage, and examples**

## Quick Start

```typescript
import { BrainyData } from '@soulcraft/brainy'

const brain = new BrainyData({
  // Augmentations auto-configure based on environment
  storage: 'auto',     // Storage augmentation
  cache: true,         // Cache augmentation
  index: true          // Index augmentation
})

await brain.init()  // Augmentations initialize automatically
```

## Core Concepts

### What are Augmentations?
Augmentations are modular extensions that add functionality to Brainy without cluttering the core API. They follow a unified interface and can be:
- **Auto-enabled**: Based on configuration (cache, index, storage)
- **Manually registered**: For custom functionality
- **Chained**: Multiple augmentations work together seamlessly

### Augmentation Lifecycle
1. **Registration**: Augmentations register before init()
2. **Initialization**: Two-phase init (storage first, then others)
3. **Execution**: Hook into operations (before/after/both)
4. **Shutdown**: Clean teardown on brain.shutdown()

---

## Storage Augmentations (8 total)

### MemoryStorageAugmentation
**Location**: `src/augmentations/storageAugmentations.ts`  
**Auto-enabled**: When `storage: 'memory'` or in test environments  
**Purpose**: In-memory storage for testing and temporary data
```typescript
const brain = new BrainyData({ storage: 'memory' })
```

### FileSystemStorageAugmentation  
**Location**: `src/augmentations/storageAugmentations.ts`  
**Auto-enabled**: When `storage: 'filesystem'` or Node.js detected  
**Purpose**: Persistent file-based storage for Node.js applications
```typescript
const brain = new BrainyData({ 
  storage: { type: 'filesystem', path: './data' }
})
```

### OPFSStorageAugmentation
**Location**: `src/augmentations/storageAugmentations.ts`  
**Auto-enabled**: When `storage: 'opfs'` or browser with OPFS support  
**Purpose**: Browser-based persistent storage using Origin Private File System
```typescript
const brain = new BrainyData({ storage: 'opfs' })
```

### S3StorageAugmentation
**Location**: `src/augmentations/storageAugmentations.ts`  
**Manual**: Requires AWS credentials  
**Purpose**: AWS S3-compatible cloud storage
```typescript
const brain = new BrainyData({ 
  storage: {
    type: 's3',
    bucket: 'my-bucket',
    region: 'us-east-1',
    credentials: { accessKeyId, secretAccessKey }
  }
})
```

### R2StorageAugmentation
**Location**: `src/augmentations/storageAugmentations.ts`  
**Manual**: Requires Cloudflare credentials  
**Purpose**: Cloudflare R2 storage (S3-compatible)
```typescript
const brain = new BrainyData({ 
  storage: {
    type: 'r2',
    accountId: 'xxx',
    bucket: 'my-bucket',
    credentials: { accessKeyId, secretAccessKey }
  }
})
```

### GCSStorageAugmentation
**Location**: `src/augmentations/storageAugmentations.ts`  
**Manual**: Requires Google Cloud credentials  
**Purpose**: Google Cloud Storage
```typescript
const brain = new BrainyData({ 
  storage: {
    type: 'gcs',
    bucket: 'my-bucket',
    projectId: 'my-project'
  }
})
```

### StorageAugmentation (base)
**Location**: `src/augmentations/storageAugmentation.ts`  
**Purpose**: Base class for custom storage implementations

### DynamicStorageAugmentation
**Location**: `src/augmentations/storageAugmentation.ts`  
**Purpose**: Runtime storage adapter switching

---

## Performance Augmentations (7 total)

### CacheAugmentation
**Location**: `src/augmentations/cacheAugmentation.ts`  
**Auto-enabled**: When `cache: true` (default)  
**Purpose**: LRU cache for search results and frequent queries
```typescript
brain.clearCache()           // Exposed via API
brain.getCacheStats()        // Cache hit/miss statistics
```

### IndexAugmentation
**Location**: `src/augmentations/indexAugmentation.ts`  
**Auto-enabled**: When `index: true` (default)  
**Purpose**: Metadata indexing for O(1) field lookups
```typescript
brain.rebuildMetadataIndex() // Exposed via API
// Enables fast where queries:
brain.find({ where: { category: 'tech' } })
```

### MetricsAugmentation
**Location**: `src/augmentations/metricsAugmentation.ts`  
**Auto-enabled**: Always active  
**Purpose**: Performance metrics and statistics collection
```typescript
brain.getStatistics()        // Comprehensive metrics
```

### MonitoringAugmentation
**Location**: `src/augmentations/monitoringAugmentation.ts`  
**Manual**: Register for detailed monitoring  
**Purpose**: Real-time performance monitoring and alerts

### BatchProcessingAugmentation
**Location**: `src/augmentations/batchProcessingAugmentation.ts`  
**Auto-enabled**: For batch operations  
**Purpose**: Optimizes bulk add/update/delete operations
```typescript
brain.addNouns([...])        // Automatically batched
```

### RequestDeduplicatorAugmentation
**Location**: `src/augmentations/requestDeduplicatorAugmentation.ts`  
**Auto-enabled**: Always active  
**Purpose**: Prevents duplicate concurrent operations

### ConnectionPoolAugmentation
**Location**: `src/augmentations/connectionPoolAugmentation.ts`  
**Auto-enabled**: For network storage  
**Purpose**: Connection pooling for cloud storage adapters

---

## Data Integrity Augmentations (3 total)

**Auto-enabled**: When `wal: true`  
**Purpose**: Write-ahead logging for crash recovery
```typescript
const brain = new BrainyData({ wal: true })
// Automatic recovery on restart after crash
```

### EntityRegistryAugmentation
**Location**: `src/augmentations/entityRegistryAugmentation.ts`  
**Auto-enabled**: For streaming operations  
**Purpose**: High-speed deduplication for real-time data
```typescript
// Prevents duplicate entities in streaming scenarios
brain.addNoun(data) // Automatically deduplicated
```

### AutoRegisterEntitiesAugmentation
**Location**: `src/augmentations/entityRegistryAugmentation.ts`  
**Manual**: For automatic entity discovery  
**Purpose**: Auto-discovers and registers entities from data

---

## Intelligence Augmentations (2 total)

### NeuralImportAugmentation
**Location**: `src/augmentations/neuralImport.ts`  
**Manual**: Via `brain.neuralImport()`  
**Purpose**: AI-powered smart data import
```typescript
const result = await brain.neuralImport(data, {
  confidenceThreshold: 0.7,
  autoApply: true
})
// Automatically detects entities and relationships
```

### IntelligentVerbScoringAugmentation
**Location**: `src/augmentations/intelligentVerbScoringAugmentation.ts`  
**Auto-enabled**: When verbs are used  
**Purpose**: ML-based relationship strength scoring
```typescript
brain.verbScoring.train(feedback)
brain.verbScoring.getScore(verbId)
```

---

## Communication Augmentations (4 total)

### APIServerAugmentation
**Location**: `src/augmentations/apiServerAugmentation.ts`  
**Manual**: For server deployments  
**Purpose**: REST/WebSocket/MCP API server
```typescript
const augmentation = new APIServerAugmentation()
await brain.registerAugmentation(augmentation)
// Exposes full Brainy API over network
```

### WebSocketConduitAugmentation
**Location**: `src/augmentations/conduitAugmentations.ts`  
**Manual**: For Brainy-to-Brainy sync  
**Purpose**: Real-time sync between Brainy instances
```typescript
const conduit = new WebSocketConduitAugmentation()
await conduit.establishConnection('ws://other-brain')
```

### ServerSearchConduitAugmentation
**Location**: `src/augmentations/serverSearchAugmentations.ts`  
**Manual**: For client-server search  
**Purpose**: Search remote Brainy instance, cache locally

### ServerSearchActivationAugmentation
**Location**: `src/augmentations/serverSearchAugmentations.ts`  
**Manual**: Works with ServerSearchConduit  
**Purpose**: Triggers and manages server search operations

---

## External Integration (2 total)

### SynapseAugmentation (base)
**Location**: `src/augmentations/synapseAugmentation.ts`  
**Purpose**: Base class for external platform integrations
```typescript
// Example: NotionSynapse, SlackSynapse, etc.
class NotionSynapse extends SynapseAugmentation {
  async fetchData() { /* Notion API calls */ }
  async pushData() { /* Sync to Notion */ }
}
```

### ExampleFileSystemSynapse
**Location**: `src/augmentations/synapseAugmentation.ts`  
**Purpose**: Example implementation for file system sync

---

## Augmentation Configuration

### Auto-Configuration
```typescript
const brain = new BrainyData({
  // These auto-register augmentations:
  storage: 'auto',        // Storage augmentation
  cache: true,           // Cache augmentation  
  index: true,           // Index augmentation
  metrics: true         // Metrics augmentation
})
```

### Manual Registration
```typescript
const brain = new BrainyData()

// Register before init()
const customAug = new MyCustomAugmentation()
await brain.registerAugmentation(customAug)

await brain.init()
```

### Creating Custom Augmentations
```typescript
import { BaseAugmentation } from '@soulcraft/brainy'

class MyAugmentation extends BaseAugmentation {
  readonly name = 'my-augmentation'
  readonly timing = 'after'  // before | after | both
  readonly operations = ['addNoun', 'search']  // Which ops to hook
  readonly priority = 10      // Execution order (lower = earlier)
  
  protected async onInit(): Promise<void> {
    // Initialize your augmentation
  }
  
  async execute<T>(
    operation: string,
    params: any,
    context?: AugmentationContext
  ): Promise<T | void> {
    // Your augmentation logic
    if (operation === 'addNoun') {
      console.log('Noun added:', params)
    }
  }
  
  protected async onShutdown(): Promise<void> {
    // Cleanup
  }
}
```

---

## Augmentation Timing & Priority

### Timing Options
- **`before`**: Runs before the operation (can modify params)
- **`after`**: Runs after the operation (can see results)
- **`both`**: Runs before AND after

### Priority (lower = earlier)
1. Storage augmentations (priority: 0)
2. Cache/Index augmentations (priority: 5-10)
3. Monitoring/Metrics (priority: 15-20)
4. Conduits/Synapses (priority: 20-30)

---

## Key Integration Points

### Where Augmentations Hook In

**BrainyData Constructor**:
- Storage augmentations register based on config
- Cache/Index augmentations auto-register if enabled

**brain.init()**:
- Two-phase initialization (storage first, then others)
- Augmentations can access brain instance via context

**Operations** (addNoun, search, etc.):
- Augmentations execute based on timing and operations filter
- Can modify params (before) or see results (after)

**brain.shutdown()**:
- All augmentations cleaned up in reverse order

---

## Performance Impact

Most augmentations have minimal overhead:
- **Cache**: ~1ms per search (saves 10-100ms on hits)
- **Index**: ~1ms per operation (saves 100ms+ on queries)
- **Metrics**: <1ms per operation
- **Storage**: Varies by adapter (memory: 0ms, S3: 50-200ms)

---

## Best Practices

1. **Let auto-configuration work**: Most apps need zero manual config
2. **Storage first**: Always configure storage before other augmentations
3. **Use built-in augmentations**: They're optimized and battle-tested
4. **Custom augmentations**: Extend BaseAugmentation for consistency
5. **Respect timing**: Use 'before' to modify, 'after' to observe
6. **Mind priority**: Lower numbers execute first

---

## Troubleshooting

### Augmentation not working?
```typescript
// Check if registered
brain.listAugmentations()

// Check if enabled
brain.isAugmentationEnabled('cache')

// Enable/disable at runtime
brain.enableAugmentation('cache')
brain.disableAugmentation('cache')
```

### Performance issues?
```typescript
// Check augmentation overhead
const stats = brain.getStatistics()
console.log(stats.augmentations)

// Disable non-critical augmentations
brain.disableAugmentation('monitoring')
```

---


---

*Augmentations make Brainy infinitely extensible while keeping the core API clean and simple!*