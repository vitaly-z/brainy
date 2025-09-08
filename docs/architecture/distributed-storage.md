# 🏗️ Distributed Storage Architecture

> **Technical deep-dive**: How Brainy coordinates storage across multiple nodes and adapters

## Storage Adapter Layer

### Base Storage Interface

Every storage adapter implements this interface:

```typescript
interface StorageAdapter {
  // Basic operations
  get(key: string): Promise<any>
  set(key: string, value: any): Promise<void>
  delete(key: string): Promise<void>
  
  // Batch operations
  getBatch(keys: string[]): Promise<Map<string, any>>
  setBatch(items: Map<string, any>): Promise<void>
  
  // Atomic operations (for coordination)
  compareAndSwap(key: string, oldVal: any, newVal: any): Promise<boolean>
  increment(key: string, delta: number): Promise<number>
  
  // Namespace support
  withNamespace(namespace: string): StorageAdapter
}
```

### Storage Coordination Strategies

#### Strategy 1: Isolated Storage (Default)

Each node has completely separate storage:

```
Node-1 → Local FS: /data/node1/
         └── shards/
             ├── shard-001/
             ├── shard-045/
             └── shard-127/

Node-2 → Local FS: /data/node2/
         └── shards/
             ├── shard-023/
             ├── shard-067/
             └── shard-089/
```

**Coordination**: Via network messages only
- Shard ownership tracked in distributed consensus
- Data transfer via direct node-to-node communication
- No storage-level conflicts possible

#### Strategy 2: Shared Storage with Namespacing

Multiple nodes share storage but use namespaces:

```
S3 Bucket: brainy-cluster/
├── node-abc123/
│   ├── shards/
│   └── wal/
├── node-def456/
│   ├── shards/
│   └── wal/
└── _cluster/
    ├── topology.json
    ├── shard-map.json
    └── elections/
```

**Coordination**: Via storage-level atomic operations
- Each node owns its namespace
- Cluster metadata in shared `_cluster/` namespace
- Atomic operations for leader election
- Conditional writes prevent conflicts

#### Strategy 3: Shared Storage with Fine-Grained Locking

Advanced mode for full shared storage:

```
S3 Bucket: brainy-shared/
├── shards/
│   ├── 001/
│   │   ├── data.bin
│   │   └── .lock (atomic)
│   ├── 002/
│   │   ├── data.bin
│   │   └── .lock
└── metadata/
    ├── index/
    └── locks/
```

**Coordination**: Via distributed locking
- Shard-level locks using atomic operations
- Lock acquisition via compare-and-swap
- Automatic lock expiry (lease-based)
- Deadlock detection and recovery

## Storage Adapter Implementations

### 1. Filesystem Adapter

```typescript
class FilesystemAdapter implements StorageAdapter {
  constructor(private basePath: string) {}
  
  async get(key: string) {
    const path = this.keyToPath(key)
    return fs.readFile(path, 'json')
  }
  
  async compareAndSwap(key: string, oldVal: any, newVal: any) {
    // Use file locking for atomicity
    const lockfile = `${this.keyToPath(key)}.lock`
    await flock(lockfile, 'ex')  // Exclusive lock
    try {
      const current = await this.get(key)
      if (deepEqual(current, oldVal)) {
        await this.set(key, newVal)
        return true
      }
      return false
    } finally {
      await funlock(lockfile)
    }
  }
  
  withNamespace(ns: string) {
    return new FilesystemAdapter(path.join(this.basePath, ns))
  }
}
```

### 2. S3 Adapter

```typescript
class S3Adapter implements StorageAdapter {
  constructor(
    private bucket: string,
    private prefix: string = ''
  ) {}
  
  async get(key: string) {
    const result = await s3.getObject({
      Bucket: this.bucket,
      Key: `${this.prefix}${key}`
    })
    return JSON.parse(result.Body)
  }
  
  async compareAndSwap(key: string, oldVal: any, newVal: any) {
    // Use S3's conditional writes
    const fullKey = `${this.prefix}${key}`
    
    // Get current version
    const head = await s3.headObject({
      Bucket: this.bucket,
      Key: fullKey
    })
    
    // Conditional put with ETag
    try {
      await s3.putObject({
        Bucket: this.bucket,
        Key: fullKey,
        Body: JSON.stringify(newVal),
        IfMatch: head.ETag  // Only succeeds if unchanged
      })
      return true
    } catch (err) {
      if (err.code === 'PreconditionFailed') {
        return false
      }
      throw err
    }
  }
  
  withNamespace(ns: string) {
    const newPrefix = `${this.prefix}${ns}/`
    return new S3Adapter(this.bucket, newPrefix)
  }
}
```

### 3. Cloudflare R2 Adapter

```typescript
class R2Adapter implements StorageAdapter {
  // Similar to S3 but with R2-specific optimizations
  
  async compareAndSwap(key: string, oldVal: any, newVal: any) {
    // R2 supports conditional headers
    const response = await fetch(`${this.endpoint}/${key}`, {
      method: 'PUT',
      body: JSON.stringify(newVal),
      headers: {
        'If-Match': await this.getETag(key)
      }
    })
    return response.ok
  }
  
  // R2-specific: Use Workers for edge computing
  async getWithCache(key: string) {
    // Check Cloudflare edge cache first
    const cached = await caches.default.match(key)
    if (cached) return cached.json()
    
    // Fallback to R2
    const value = await this.get(key)
    
    // Cache at edge
    await caches.default.put(key, new Response(JSON.stringify(value)))
    
    return value
  }
}
```

## Distributed Coordination Patterns

### Pattern 1: Leader-Based Coordination

```typescript
class LeaderCoordinator {
  async acquireShardOwnership(shardId: string) {
    if (!this.isLeader()) {
      // Only leader assigns shards
      return this.requestFromLeader('acquireShard', shardId)
    }
    
    // Leader logic
    const shardMap = await this.storage.get('_cluster/shard-map')
    if (!shardMap[shardId].owner) {
      shardMap[shardId].owner = this.nodeId
      
      // Atomic update
      const success = await this.storage.compareAndSwap(
        '_cluster/shard-map',
        shardMap,
        { ...shardMap, [shardId]: { owner: this.nodeId } }
      )
      
      if (success) {
        this.broadcast('shardAssigned', { shardId, owner: this.nodeId })
      }
    }
  }
}
```

### Pattern 2: Consensus-Based Coordination

```typescript
class ConsensusCoordinator {
  async acquireShardOwnership(shardId: string) {
    // Propose to all nodes
    const proposal = {
      type: 'ACQUIRE_SHARD',
      shardId,
      nodeId: this.nodeId,
      term: this.currentTerm
    }
    
    // Raft consensus
    const votes = await this.gatherVotes(proposal)
    
    if (votes.length > this.nodes.length / 2) {
      // Majority agreed
      await this.commitProposal(proposal)
      return true
    }
    
    return false
  }
}
```

### Pattern 3: Storage-Native Coordination

```typescript
class StorageNativeCoordinator {
  async acquireShardOwnership(shardId: string) {
    // Use storage adapter's native coordination
    const lockKey = `_locks/shard-${shardId}`
    const lease = {
      owner: this.nodeId,
      expires: Date.now() + 30000  // 30 second lease
    }
    
    // Try to acquire lock atomically
    const acquired = await this.storage.compareAndSwap(
      lockKey,
      null,  // Must not exist
      lease
    )
    
    if (acquired) {
      // Start lease renewal
      this.startLeaseRenewal(lockKey, lease)
      return true
    }
    
    return false
  }
  
  private startLeaseRenewal(key: string, lease: any) {
    setInterval(async () => {
      const renewed = await this.storage.compareAndSwap(
        key,
        lease,
        { ...lease, expires: Date.now() + 30000 }
      )
      
      if (!renewed) {
        // Lost lease
        this.handleLeaseLoss(key)
      }
    }, 10000)  // Renew every 10s
  }
}
```

## Multi-Storage Patterns

### Hybrid Storage (Hot/Cold)

```typescript
class HybridStorageAdapter implements StorageAdapter {
  constructor(
    private hot: StorageAdapter,   // Fast SSD
    private cold: StorageAdapter   // Cheap S3
  ) {}
  
  async get(key: string) {
    // Try hot storage first
    const hotValue = await this.hot.get(key).catch(() => null)
    if (hotValue) {
      this.updateAccessTime(key)
      return hotValue
    }
    
    // Fallback to cold storage
    const coldValue = await this.cold.get(key)
    
    // Promote to hot storage if frequently accessed
    if (this.shouldPromote(key)) {
      await this.hot.set(key, coldValue)
    }
    
    return coldValue
  }
  
  async set(key: string, value: any) {
    // Write to hot storage
    await this.hot.set(key, value)
    
    // Async write to cold storage
    setImmediate(() => {
      this.cold.set(key, value).catch(console.error)
    })
  }
  
  // Background process to demote cold data
  async runTiering() {
    const hotKeys = await this.hot.listKeys()
    
    for (const key of hotKeys) {
      const lastAccess = await this.getAccessTime(key)
      
      if (Date.now() - lastAccess > 7 * 24 * 60 * 60 * 1000) {
        // Not accessed in 7 days, demote to cold
        await this.cold.set(key, await this.hot.get(key))
        await this.hot.delete(key)
      }
    }
  }
}
```

### Geo-Distributed Storage

```typescript
class GeoDistributedAdapter implements StorageAdapter {
  constructor(
    private regions: Map<string, StorageAdapter>
  ) {}
  
  async get(key: string) {
    // Determine closest region
    const region = await this.getClosestRegion()
    
    // Try local region first
    const localValue = await this.regions.get(region)
      .get(key)
      .catch(() => null)
    
    if (localValue) return localValue
    
    // Fallback to other regions
    for (const [name, adapter] of this.regions) {
      if (name !== region) {
        const value = await adapter.get(key).catch(() => null)
        if (value) {
          // Replicate to local region for next time
          this.regions.get(region).set(key, value)
          return value
        }
      }
    }
    
    throw new Error('Key not found in any region')
  }
  
  async set(key: string, value: any) {
    // Write to local region immediately
    const region = await this.getClosestRegion()
    await this.regions.get(region).set(key, value)
    
    // Async replication to other regions
    for (const [name, adapter] of this.regions) {
      if (name !== region) {
        adapter.set(key, value).catch(console.error)
      }
    }
  }
}
```

## Storage Optimization Strategies

### 1. Write Batching

```typescript
class BatchingAdapter implements StorageAdapter {
  private writeBatch = new Map()
  private batchTimer?: NodeJS.Timeout
  
  async set(key: string, value: any) {
    this.writeBatch.set(key, value)
    
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), 100)
    }
    
    if (this.writeBatch.size >= 1000) {
      await this.flush()
    }
  }
  
  private async flush() {
    if (this.writeBatch.size === 0) return
    
    const batch = new Map(this.writeBatch)
    this.writeBatch.clear()
    
    await this.underlying.setBatch(batch)
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }
  }
}
```

### 2. Read Caching

```typescript
class CachingAdapter implements StorageAdapter {
  private cache = new LRU({ max: 10000 })
  
  async get(key: string) {
    // Check cache
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }
    
    // Read from storage
    const value = await this.underlying.get(key)
    
    // Cache for next time
    this.cache.set(key, value)
    
    return value
  }
  
  async set(key: string, value: any) {
    // Invalidate cache
    this.cache.delete(key)
    
    // Write through
    await this.underlying.set(key, value)
  }
}
```

### 3. Compression

```typescript
class CompressingAdapter implements StorageAdapter {
  async set(key: string, value: any) {
    const json = JSON.stringify(value)
    
    // Compress if beneficial
    if (json.length > 1024) {
      const compressed = await gzip(json)
      await this.underlying.set(key, {
        _compressed: true,
        data: compressed.toString('base64')
      })
    } else {
      await this.underlying.set(key, value)
    }
  }
  
  async get(key: string) {
    const stored = await this.underlying.get(key)
    
    if (stored._compressed) {
      const compressed = Buffer.from(stored.data, 'base64')
      const json = await gunzip(compressed)
      return JSON.parse(json)
    }
    
    return stored
  }
}
```

## Summary

Brainy's storage layer is designed for:

1. **Flexibility**: Works with any storage backend
2. **Coordination**: Multiple strategies for different needs
3. **Performance**: Batching, caching, compression
4. **Scalability**: From single file to geo-distributed
5. **Simplicity**: Complexity hidden behind simple interface

The key insight: **Storage is just a plugin**. The intelligence is in the coordination layer above it!

---

*For user-facing documentation, see [SCALING.md](../SCALING.md)*