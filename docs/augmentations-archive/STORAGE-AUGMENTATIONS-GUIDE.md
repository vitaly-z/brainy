# Storage Augmentations Guide

## Overview

Brainy uses a unified augmentation system for storage backends. This guide explains the difference between built-in storage augmentations and how to create custom ones.

## Built-in Storage Augmentations

These wrap existing, battle-tested storage adapters from `/storage/adapters/`:

| Augmentation | Underlying Adapter | Environment | Description |
|--------------|-------------------|-------------|-------------|
| `MemoryStorageAugmentation` | `MemoryStorage` | Universal | Fast in-memory storage (not persistent) |
| `FileSystemStorageAugmentation` | `FileSystemStorage` | Node.js | Persistent file-based storage |
| `OPFSStorageAugmentation` | `OPFSStorage` | Browser | Browser persistent storage |
| `S3StorageAugmentation` | `S3CompatibleStorage` | Universal | Amazon S3 with throttling & caching |
| `R2StorageAugmentation` | `R2Storage` | Universal | Cloudflare R2 storage |
| `GCSStorageAugmentation` | `S3CompatibleStorage` | Universal | Google Cloud Storage |

### Architecture of Built-in Storage

```
BrainyData
    ↓
StorageAugmentation (thin wrapper)
    ↓
StorageAdapter (actual implementation in /storage/adapters/)
    ↓
Actual Storage (filesystem, S3, memory, etc.)
```

### Why This Design?

1. **Preserve existing code** - Storage adapters have years of bug fixes
2. **Complex features intact** - S3 throttling, caching, retry logic preserved
3. **Minimal wrapper** - Augmentations are just 20-30 lines
4. **Zero feature loss** - All 30+ StorageAdapter methods work unchanged

## Using Built-in Storage

### 1. Zero-Config (Auto-Selection)
```typescript
const brain = new BrainyData()
await brain.init()
// Automatically selects:
// - Node.js → FileSystemStorage
// - Browser → OPFSStorage (or Memory fallback)
```

### 2. Configuration-Based
```typescript
const brain = new BrainyData({
  storage: {
    s3Storage: {
      bucketName: 'my-bucket',
      accessKeyId: 'xxx',
      secretAccessKey: 'yyy'
    }
  }
})
```

### 3. Augmentation Override
```typescript
const brain = new BrainyData()
brain.augmentations.register(new S3StorageAugmentation({
  bucketName: 'my-bucket',
  region: 'us-east-1',
  accessKeyId: 'xxx',
  secretAccessKey: 'yyy'
}))
await brain.init()
```

## Creating Custom Storage Augmentations

Custom storage augmentations can either:
1. Wrap an existing adapter (like built-ins do)
2. Implement the StorageAdapter interface directly

### Option 1: Wrapping an Existing Adapter

```typescript
import { StorageAugmentation } from 'brainy'
import { CustomAdapter } from './my-custom-adapter'

export class CustomStorageAugmentation extends StorageAugmentation {
  private config: CustomConfig
  
  constructor(config: CustomConfig) {
    super('custom-storage')
    this.config = config
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    // Create and return your adapter
    const adapter = new CustomAdapter(this.config)
    return adapter
  }
}
```

### Option 2: Self-Contained Implementation

```typescript
import { StorageAugmentation, StorageAdapter } from 'brainy'
import Redis from 'ioredis'

export class RedisStorageAugmentation extends StorageAugmentation {
  private redis: Redis
  
  constructor(config: RedisConfig) {
    super('redis-storage')
    this.redis = new Redis(config)
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    // Return an object implementing StorageAdapter
    return {
      async init() {
        await this.redis.ping()
      },
      
      async saveNoun(noun) {
        await this.redis.set(
          `noun:${noun.id}`,
          JSON.stringify(noun)
        )
      },
      
      async getNoun(id) {
        const data = await this.redis.get(`noun:${id}`)
        return data ? JSON.parse(data) : null
      },
      
      async deleteNoun(id) {
        await this.redis.del(`noun:${id}`)
      },
      
      // ... implement all 30+ required methods
      // See StorageAdapter interface in coreTypes.ts
    }
  }
}
```

## StorageAdapter Interface Requirements

Your custom storage must implement these core methods:

```typescript
interface StorageAdapter {
  // Initialization
  init(): Promise<void>
  
  // Noun operations
  saveNoun(noun: HNSWNoun): Promise<void>
  getNoun(id: string): Promise<HNSWNoun | null>
  deleteNoun(id: string): Promise<void>
  getNounsByNounType(type: string): Promise<HNSWNoun[]>
  
  // Verb operations
  saveVerb(verb: HNSWVerb): Promise<void>
  getVerb(id: string): Promise<HNSWVerb | null>
  deleteVerb(id: string): Promise<void>
  getVerbsBySource(sourceId: string): Promise<HNSWVerb[]>
  getVerbsByTarget(targetId: string): Promise<HNSWVerb[]>
  
  // Metadata operations
  saveMetadata(id: string, metadata: any): Promise<void>
  getMetadata(id: string): Promise<any | null>
  saveVerbMetadata(id: string, metadata: any): Promise<void>
  getVerbMetadata(id: string): Promise<any | null>
  
  // Pagination
  getNouns(options?: PaginationOptions): Promise<PaginatedResult>
  getVerbs(options?: PaginationOptions): Promise<PaginatedResult>
  
  // Statistics
  getStatistics(): Promise<StatisticsData | null>
  saveStatistics(stats: StatisticsData): Promise<void>
  incrementStatistic(type: string, service: string): Promise<void>
  
  // Utility
  clear(): Promise<void>
  getStorageStatus(): Promise<StorageStatus>
  
  // ... plus ~10 more methods
}
```

## Publishing to Brain Cloud (Future)

Custom storage augmentations can be published to the Brain Cloud marketplace:

```json
// package.json
{
  "name": "@brain-cloud/redis-storage",
  "version": "1.0.0",
  "brainy": {
    "type": "augmentation",
    "category": "storage",
    "implements": "StorageAdapter"
  }
}
```

Users will be able to install via:
```bash
brainy augment install redis-storage
```

## Best Practices

1. **Use existing adapters when possible** - They're well-tested
2. **Implement all methods** - StorageAdapter has 30+ required methods
3. **Handle errors gracefully** - Storage is critical infrastructure
4. **Include connection pooling** - For network-based storage
5. **Add retry logic** - Network operations can fail
6. **Implement caching** - Reduce latency for hot data
7. **Track statistics** - Use BaseStorageAdapter if possible
8. **Document configuration** - Make it easy for users

## Examples in the Wild

### MongoDB Storage (Community)
```typescript
class MongoStorageAugmentation extends StorageAugmentation {
  async provideStorage() {
    const client = new MongoClient(this.uri)
    const db = client.db('brainy')
    
    return {
      async saveNoun(noun) {
        await db.collection('nouns').replaceOne(
          { _id: noun.id },
          noun,
          { upsert: true }
        )
      },
      // ... full implementation
    }
  }
}
```

### PostgreSQL Storage (Premium)
```typescript
class PostgreSQLStorageAugmentation extends StorageAugmentation {
  async provideStorage() {
    const pool = new Pool(this.config)
    
    return {
      async saveNoun(noun) {
        await pool.query(
          'INSERT INTO nouns (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
          [noun.id, JSON.stringify(noun)]
        )
      },
      // ... full implementation
    }
  }
}
```

## Summary

- **Built-in augmentations** wrap existing adapters (thin layer)
- **Custom augmentations** can wrap OR implement directly
- **Storage adapters** in `/storage/adapters/` are for core only
- **Premium storage** comes as self-contained augmentations
- **Everything uses** the same StorageAdapter interface
- **Zero-config** still works perfectly

This design provides maximum flexibility while preserving all existing functionality!