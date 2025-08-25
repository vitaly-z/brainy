# Coordinated Index Optimization Strategy

## The Problem
Two independent index systems competing for resources:
- **HNSW Index**: Wants to cache hot vectors in RAM
- **MetadataIndex**: Wants to cache hot field values in RAM
- **Conflict**: Both trying to use same memory/disk without coordination!

## The Solution: Unified Resource Manager

### 1. Shared Resource Pool
```typescript
class UnifiedIndexManager {
  private totalMemoryBudget: number = 2 * 1024 * 1024 * 1024 // 2GB total
  private hnswMemoryUsage: number = 0
  private metadataMemoryUsage: number = 0
  
  // Intelligent allocation based on usage patterns
  allocateMemory(requester: 'hnsw' | 'metadata', size: number): boolean {
    const available = this.totalMemoryBudget - this.hnswMemoryUsage - this.metadataMemoryUsage
    
    if (size <= available) {
      if (requester === 'hnsw') {
        this.hnswMemoryUsage += size
      } else {
        this.metadataMemoryUsage += size
      }
      return true
    }
    
    // Try to steal from other index if one is underutilized
    return this.rebalance(requester, size)
  }
  
  private rebalance(requester: string, needed: number): boolean {
    // If HNSW is using 80% and metadata only 20%, rebalance
    const hnswRatio = this.hnswMemoryUsage / this.totalMemoryBudget
    const metadataRatio = this.metadataMemoryUsage / this.totalMemoryBudget
    
    // Intelligent rebalancing logic
    // ...
  }
}
```

### 2. Coordinated LRU Eviction
```typescript
class CoordinatedLRUCache {
  private hnswLRU: LRUCache
  private metadataLRU: LRUCache
  private accessPatterns: AccessTracker
  
  // When memory pressure, evict from the index with lowest utility
  async evict(bytesNeeded: number): Promise<void> {
    const hnswUtility = this.calculateUtility(this.hnswLRU)
    const metadataUtility = this.calculateUtility(this.metadataLRU)
    
    if (hnswUtility < metadataUtility) {
      // HNSW items are less frequently accessed
      await this.hnswLRU.evict(bytesNeeded)
    } else {
      // Metadata items are less frequently accessed
      await this.metadataLRU.evict(bytesNeeded)
    }
  }
  
  private calculateUtility(cache: LRUCache): number {
    // Factors:
    // - Access frequency
    // - Recency
    // - Cost to rebuild (HNSW is expensive, metadata is cheap)
    // - Current query patterns
  }
}
```

### 3. Query-Aware Optimization
```typescript
class QueryOptimizer {
  private queryHistory: QueryPattern[] = []
  
  optimizeForQuery(query: TripleQuery) {
    // Analyze query type
    const usesVector = !!(query.like || query.similar)
    const usesMetadata = !!query.where
    
    // Pre-warm appropriate caches
    if (usesVector && usesMetadata) {
      // Hybrid query - balance resources 50/50
      this.resourceManager.setRatio(0.5, 0.5)
    } else if (usesVector) {
      // Vector-heavy - give HNSW more memory
      this.resourceManager.setRatio(0.8, 0.2)
    } else {
      // Metadata-heavy - give MetadataIndex more memory
      this.resourceManager.setRatio(0.2, 0.8)
    }
  }
}
```

### 4. Unified Persistence Strategy
```typescript
class UnifiedPersistence {
  private writeBuffer: WriteBuffer
  private flushScheduler: FlushScheduler
  
  async flush() {
    // Coordinate flushes to avoid disk contention
    const tasks = []
    
    // Flush metadata first (smaller, faster)
    if (this.metadataIndex.isDirty) {
      tasks.push(this.flushMetadata())
    }
    
    // Then flush HNSW (larger, slower)
    if (this.hnswIndex.isDirty) {
      tasks.push(this.flushHNSW())
    }
    
    // Sequential to avoid disk thrashing
    for (const task of tasks) {
      await task
    }
  }
  
  private async flushMetadata() {
    // Flush sorted indices
    await this.storage.save('metadata_sorted', this.metadataIndex.sortedIndices)
    // Flush hash indices
    await this.storage.save('metadata_hash', this.metadataIndex.hashIndices)
  }
}
```

## Implementation Plan

### Phase 1: Shared Memory Manager (Quick Win)
```typescript
// In BrainyData constructor
this.resourceManager = new UnifiedResourceManager({
  totalMemory: config.maxMemory || 2 * GB,
  hnswRatio: 0.6,  // 60% for vectors by default
  metadataRatio: 0.4 // 40% for metadata by default
})

// Pass to both indices
this.hnswIndex = new HNSWIndexOptimized({
  resourceManager: this.resourceManager
})

this.metadataIndex = new MetadataIndexOptimized({
  resourceManager: this.resourceManager
})
```

### Phase 2: Coordinated Eviction
- Single LRU that tracks both index types
- Utility-based eviction (not just recency)
- Consider rebuild cost in eviction decisions

### Phase 3: Query-Driven Optimization
- Track query patterns
- Dynamically adjust memory allocation
- Pre-warm caches based on query type

## Benefits of Coordination

1. **No Resource Conflicts**: Indices cooperate instead of compete
2. **Better Memory Usage**: Allocate based on actual query patterns
3. **Smarter Eviction**: Keep data that's actually needed
4. **Unified Monitoring**: Single place to track all index performance
5. **Auto-Optimization**: System learns and adapts to usage

## Configuration Example
```typescript
const brain = new BrainyData({
  indexOptimization: {
    mode: 'coordinated',     // vs 'independent'
    totalMemory: 4 * GB,     // Total for ALL indices
    autoBalance: true,       // Dynamic rebalancing
    persistenceInterval: 60000, // Coordinated flush every minute
    monitoring: {
      trackQueryPatterns: true,
      optimizeForPatterns: true,
      rebalanceInterval: 300000 // Every 5 minutes
    }
  }
})
```

## Monitoring & Metrics
```typescript
const stats = brain.getIndexStats()
// {
//   hnsw: {
//     memoryUsed: 1.2 * GB,
//     cacheHitRate: 0.89,
//     avgQueryTime: 12ms
//   },
//   metadata: {
//     memoryUsed: 0.8 * GB,
//     cacheHitRate: 0.95,
//     avgQueryTime: 2ms
//   },
//   coordination: {
//     rebalances: 5,
//     memoryUtilization: 0.95,
//     queryPatternDetected: 'hybrid-heavy'
//   }
// }