# Creating Augmentations for Brainy

## The BrainyAugmentation Interface

Every augmentation implements this simple yet powerful interface:

```typescript
interface BrainyAugmentation {
  // Identification
  name: string                    // Unique name for your augmentation
  
  // Execution control
  timing: 'before' | 'after' | 'around' | 'replace'  // When to execute
  operations: string[]            // Which operations to intercept
  priority: number                 // Execution order (higher = first)
  
  // Lifecycle methods
  initialize(context: AugmentationContext): Promise<void>
  execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T>
  shutdown?(): Promise<void>      // Optional cleanup
}
```

## Creating a Storage Augmentation

Storage augmentations are special - they provide the storage backend for Brainy:

```typescript
import { StorageAugmentation } from 'brainy/augmentations'
import { MyCustomStorage } from './my-storage'

export class MyStorageAugmentation extends StorageAugmentation {
  private config: MyStorageConfig
  
  constructor(config: MyStorageConfig) {
    super()
    this.name = 'my-custom-storage'
    this.config = config
  }
  
  // Called during storage resolution phase
  async provideStorage(): Promise<StorageAdapter> {
    const storage = new MyCustomStorage(this.config)
    this.storageAdapter = storage
    return storage
  }
  
  // Called during augmentation initialization
  protected async onInitialize(): Promise<void> {
    await this.storageAdapter!.init()
    this.log(`Custom storage initialized`)
  }
}
```

### Using Your Storage Augmentation

```typescript
// Register before brain.init()
const brain = new BrainyData()
brain.augmentations.register(new MyStorageAugmentation({
  connectionString: 'redis://localhost:6379'
}))
await brain.init()  // Will use your storage!
```

## Creating a Feature Augmentation

Here's a complete example of a caching augmentation:

```typescript
import { BaseAugmentation, BrainyAugmentation } from 'brainy/augmentations'

export class CachingAugmentation extends BaseAugmentation {
  private cache = new Map<string, any>()
  
  constructor() {
    super()
    this.name = 'smart-cache'
    this.timing = 'around'        // Wrap operations
    this.operations = ['search']   // Only cache searches
    this.priority = 50             // Mid-priority
  }
  
  async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    if (operation === 'search') {
      // Check cache
      const cacheKey = JSON.stringify(params)
      if (this.cache.has(cacheKey)) {
        this.log('Cache hit!')
        return this.cache.get(cacheKey)
      }
      
      // Execute and cache
      const result = await next()
      this.cache.set(cacheKey, result)
      return result
    }
    
    // Pass through other operations
    return next()
  }
  
  protected async onInitialize(): Promise<void> {
    this.log('Cache initialized')
  }
  
  async shutdown(): Promise<void> {
    this.cache.clear()
    await super.shutdown()
  }
}
```

## The Four Timing Modes

### 1. `before` - Pre-processing
```typescript
timing = 'before'
async execute(op, params, next) {
  // Validate/transform input
  const validated = await validate(params)
  return next(validated)  // Pass modified params
}
```

### 2. `after` - Post-processing  
```typescript
timing = 'after'
async execute(op, params, next) {
  const result = await next()
  // Log, analyze, or modify result
  console.log(`Operation ${op} returned:`, result)
  return result
}
```

### 3. `around` - Wrapping (middleware)
```typescript
timing = 'around'
async execute(op, params, next) {
  console.log('Starting', op)
  try {
    const result = await next()
    console.log('Success', op)
    return result
  } catch (error) {
    console.log('Failed', op, error)
    throw error
  }
}
```

### 4. `replace` - Complete replacement
```typescript
timing = 'replace'
async execute(op, params, next) {
  // Don't call next() - replace entirely!
  return myCustomImplementation(params)
}
```

## Operations You Can Intercept

Common operations in Brainy:
- `'storage'` - Storage resolution (special)
- `'add'` - Adding data
- `'search'`, `'similar'` - Searching
- `'update'`, `'delete'` - Modifications
- `'saveNoun'`, `'saveVerb'` - Storage operations
- `'all'` - Intercept everything

## Context Available to Augmentations

```typescript
interface AugmentationContext {
  brain: BrainyData         // The brain instance
  storage: StorageAdapter   // Storage backend
  config: BrainyDataConfig  // Configuration
  log: (message: string, level?: 'info' | 'warn' | 'error') => void
}
```

## Real-World Examples

### 1. Redis Storage Augmentation
```typescript
export class RedisStorageAugmentation extends StorageAugmentation {
  async provideStorage(): Promise<StorageAdapter> {
    return new RedisAdapter({
      host: 'localhost',
      port: 6379,
      // Implement full StorageAdapter interface
    })
  }
}
```

### 2. Audit Trail Augmentation
```typescript
export class AuditAugmentation extends BaseAugmentation {
  timing = 'after'
  operations = ['add', 'update', 'delete']
  
  async execute(op, params, next) {
    const result = await next()
    
    // Log to audit trail
    await this.logAudit({
      operation: op,
      params,
      result,
      timestamp: new Date(),
      user: this.context.config.currentUser
    })
    
    return result
  }
}
```

### 3. Rate Limiting Augmentation
```typescript
export class RateLimitAugmentation extends BaseAugmentation {
  timing = 'before'
  operations = ['search']
  private limiter = new RateLimiter({ rps: 100 })
  
  async execute(op, params, next) {
    await this.limiter.acquire()  // Wait if rate limited
    return next()
  }
}
```

## Publishing to Brain Cloud Marketplace

Future capability for premium augmentations:

```typescript
// package.json
{
  "name": "@brain-cloud/redis-storage",
  "brainy": {
    "type": "augmentation",
    "category": "storage",
    "premium": true
  }
}

// Users can install via:
// brainy augment install redis-storage
```

## Best Practices

1. **Use BaseAugmentation** - Provides common functionality
2. **Set appropriate priority** - Storage (100), System (80-99), Features (10-50)
3. **Be selective with operations** - Don't use 'all' unless necessary
4. **Handle errors gracefully** - Don't break the chain
5. **Clean up in shutdown()** - Release resources
6. **Log appropriately** - Use context.log() for consistent output
7. **Document your augmentation** - Include examples

## Testing Your Augmentation

```typescript
import { BrainyData } from 'brainy'
import { MyAugmentation } from './my-augmentation'

describe('MyAugmentation', () => {
  let brain: BrainyData
  
  beforeEach(async () => {
    brain = new BrainyData()
    brain.augmentations.register(new MyAugmentation())
    await brain.init()
  })
  
  afterEach(async () => {
    await brain.destroy()
  })
  
  it('should enhance searches', async () => {
    // Test your augmentation's effect
    const results = await brain.search('test')
    expect(results).toHaveProperty('enhanced', true)
  })
})
```

## Summary

Augmentations are Brainy's extension system. They can:
- Replace storage backends
- Add caching layers
- Implement audit trails
- Add rate limiting
- Sync with external systems
- Transform data
- And much more!

The unified BrainyAugmentation interface makes it easy to create powerful extensions while maintaining consistency across the entire system.