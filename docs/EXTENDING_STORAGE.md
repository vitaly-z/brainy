# 🔌 Extending Brainy Storage with Augmentations

## Overview

Brainy's zero-config system is **fully extensible**. Augmentations can register new storage providers, presets, and auto-detection logic that integrates seamlessly with the existing system.

## How Storage Extensions Work

### 1. Storage Provider Registration

When an augmentation is installed, it can register a new storage provider:

```typescript
import { StorageProvider, registerStorageAugmentation } from '@soulcraft/brainy/config'

const redisProvider: StorageProvider = {
  type: 'redis',
  name: 'Redis Storage',
  description: 'High-performance in-memory data store',
  priority: 10,  // Higher priority = checked first in auto-detection
  
  // Auto-detection logic
  async detect(): Promise<boolean> {
    // Check if Redis is available
    if (process.env.REDIS_URL) {
      try {
        const redis = await import('ioredis')
        const client = new redis.default(process.env.REDIS_URL)
        await client.ping()
        await client.quit()
        return true
      } catch {
        return false
      }
    }
    return false
  },
  
  // Configuration builder
  async getConfig(): Promise<any> {
    return {
      type: 'redis',
      redisStorage: {
        url: process.env.REDIS_URL,
        prefix: 'brainy:',
        ttl: 3600
      }
    }
  }
}

// Register the provider
registerStorageAugmentation(redisProvider)
```

### 2. Using Extended Storage

Once registered, the new storage type works with zero-config:

```typescript
// Auto-detection will now check Redis
const brain = new Brainy()  // Will use Redis if available!

// Or explicitly specify
const brain = new Brainy({ storage: 'redis' })

// Or with custom config
const brain = new Brainy({
  storage: {
    type: 'redis',
    redisStorage: {
      url: 'redis://localhost:6379',
      prefix: 'myapp:'
    }
  }
})
```

## Real-World Examples

### Redis Augmentation

```typescript
// @soulcraft/brainy-redis package
export class RedisStorageAugmentation {
  async init() {
    // Register the storage provider
    registerStorageAugmentation({
      type: 'redis',
      name: 'Redis Storage',
      priority: 10,
      
      async detect() {
        return !!(process.env.REDIS_URL || process.env.REDIS_HOST)
      },
      
      async getConfig() {
        return {
          type: 'redis',
          redisStorage: {
            url: process.env.REDIS_URL || 
                 `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
          }
        }
      }
    })
    
    // Register Redis-specific presets
    registerPresetAugmentation('redis-cache', {
      storage: 'redis',
      model: ModelPrecision.Q8,
      features: ['core', 'cache'],
      distributed: true,
      description: 'Redis-backed cache layer',
      category: PresetCategory.SERVICE
    })
  }
}
```

### MongoDB Augmentation

```typescript
// @soulcraft/brainy-mongodb package
export class MongoStorageAugmentation {
  async init() {
    registerStorageAugmentation({
      type: 'mongodb',
      name: 'MongoDB Storage',
      priority: 8,
      
      async detect() {
        return !!(process.env.MONGODB_URI || process.env.MONGO_URL)
      },
      
      async getConfig() {
        return {
          type: 'mongodb',
          mongoStorage: {
            uri: process.env.MONGODB_URI,
            database: 'brainy',
            collection: 'vectors'
          }
        }
      }
    })
  }
}
```

### PostgreSQL + pgvector Augmentation

```typescript
// @soulcraft/brainy-postgres package
export class PostgresStorageAugmentation {
  async init() {
    registerStorageAugmentation({
      type: 'postgres',
      name: 'PostgreSQL + pgvector',
      priority: 9,
      
      async detect() {
        const url = process.env.DATABASE_URL
        if (url?.includes('postgres')) {
          // Check for pgvector extension
          const client = new Client({ connectionString: url })
          await client.connect()
          const result = await client.query(
            "SELECT * FROM pg_extension WHERE extname = 'vector'"
          )
          await client.end()
          return result.rows.length > 0
        }
        return false
      },
      
      async getConfig() {
        return {
          type: 'postgres',
          postgresStorage: {
            connectionString: process.env.DATABASE_URL,
            table: 'brainy_vectors'
          }
        }
      }
    })
  }
}
```

## Auto-Detection Priority

Storage providers are checked in priority order:

1. **Custom providers** (highest priority first)
2. **Cloud storage** (S3, GCS, R2)
3. **Database storage** (Redis, MongoDB, PostgreSQL)
4. **Local storage** (filesystem, OPFS)
5. **Memory** (fallback)

```typescript
// Example priority chain
Redis (priority: 10) → PostgreSQL (9) → MongoDB (8) → S3 (5) → Filesystem (1) → Memory (0)
```

## Creating Custom Presets

Augmentations can also register new presets:

```typescript
registerPresetAugmentation('redis-cluster', {
  storage: 'redis',
  model: ModelPrecision.Q8,
  features: ['core', 'cache', 'cluster'],
  distributed: true,
  role: DistributedRole.HYBRID,
  cache: {
    hotCacheMaxSize: 100000,  // Large distributed cache
    autoTune: true
  },
  description: 'Redis Cluster configuration',
  category: PresetCategory.SERVICE
})

// Users can then use:
const brain = new Brainy('redis-cluster')
```

## Type Safety with Extensions

To maintain type safety with dynamic storage types:

```typescript
// Augmentation declares its types
declare module '@soulcraft/brainy' {
  interface StorageTypes {
    redis: {
      url: string
      prefix?: string
      ttl?: number
    }
  }
  
  interface PresetNames {
    'redis-cache': 'redis-cache'
    'redis-cluster': 'redis-cluster'
  }
}
```

## Best Practices for Storage Augmentations

1. **Always provide auto-detection** - Check environment variables and connectivity
2. **Set appropriate priority** - Higher for specialized storage, lower for general
3. **Handle failures gracefully** - Return false from detect() if not available
4. **Document requirements** - List required packages and environment variables
5. **Provide presets** - Include common configuration patterns
6. **Maintain compatibility** - Ensure model precision matches across instances

## Example: Complete Redis Augmentation

```typescript
import { 
  StorageProvider, 
  registerStorageAugmentation,
  registerPresetAugmentation,
  PresetCategory,
  ModelPrecision,
  DistributedRole
} from '@soulcraft/brainy/config'
import Redis from 'ioredis'

export class BrainyRedisAugmentation {
  private client: Redis
  
  async init() {
    // Register storage provider
    registerStorageAugmentation({
      type: 'redis',
      name: 'Redis Vector Storage',
      description: 'Redis with RediSearch for vector similarity',
      priority: 10,
      
      requirements: {
        env: ['REDIS_URL'],
        packages: ['ioredis', 'redis']
      },
      
      async detect() {
        if (!process.env.REDIS_URL) return false
        
        try {
          const client = new Redis(process.env.REDIS_URL)
          
          // Check for RediSearch module
          const modules = await client.call('MODULE', 'LIST')
          const hasRediSearch = modules.some(m => m[1] === 'search')
          
          await client.quit()
          return hasRediSearch
        } catch {
          return false
        }
      },
      
      async getConfig() {
        return {
          type: 'redis',
          redisStorage: {
            url: process.env.REDIS_URL,
            prefix: process.env.REDIS_PREFIX || 'brainy:',
            index: process.env.REDIS_INDEX || 'brainy-vectors',
            ttl: process.env.REDIS_TTL ? parseInt(process.env.REDIS_TTL) : undefined
          }
        }
      }
    })
    
    // Register presets
    this.registerPresets()
  }
  
  private registerPresets() {
    // Fast cache preset
    registerPresetAugmentation('redis-fast-cache', {
      storage: 'redis' as any,
      model: ModelPrecision.Q8,
      features: ['core', 'cache', 'search'],
      distributed: false,
      cache: {
        hotCacheMaxSize: 10000,
        autoTune: true
      },
      description: 'Redis-backed fast cache',
      category: PresetCategory.SERVICE
    })
    
    // Distributed cache preset
    registerPresetAugmentation('redis-distributed', {
      storage: 'redis' as any,
      model: ModelPrecision.AUTO,
      features: ['core', 'cache', 'search', 'cluster'],
      distributed: true,
      role: DistributedRole.HYBRID,
      cache: {
        hotCacheMaxSize: 50000,
        autoTune: true
      },
      description: 'Redis distributed cache cluster',
      category: PresetCategory.SERVICE
    })
    
    // Session store preset
    registerPresetAugmentation('redis-sessions', {
      storage: 'redis' as any,
      model: ModelPrecision.Q8,
      features: ['core', 'cache'],
      distributed: false,
      cache: {
        hotCacheMaxSize: 5000,
        autoTune: false
      },
      description: 'Redis session storage',
      category: PresetCategory.SERVICE
    })
  }
}

// Usage after installing the augmentation:
import { Brainy } from '@soulcraft/brainy'
import '@soulcraft/brainy-redis'  // Registers the augmentation

// Now Redis is automatically detected!
const brain = new Brainy()  // Uses Redis if REDIS_URL is set

// Or use a Redis preset
const brain = new Brainy('redis-fast-cache')

// Or explicitly configure
const brain = new Brainy({
  storage: 'redis',
  model: ModelPrecision.FP32
})
```

## Summary

The extensible configuration system allows:

1. **New storage types** via `registerStorageAugmentation()`
2. **Custom presets** via `registerPresetAugmentation()`
3. **Auto-detection logic** that integrates with zero-config
4. **Type-safe extensions** with TypeScript declarations
5. **Priority-based selection** for intelligent defaults

This ensures Brainy can grow with new storage technologies while maintaining its zero-configuration philosophy!