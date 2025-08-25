# Simple Guide: Creating Augmentations

## The One Interface That Rules Them All

**EVERY augmentation is a `BrainyAugmentation`:**

```typescript
interface BrainyAugmentation {
  name: string                                      // Unique name
  timing: 'before' | 'after' | 'around' | 'replace' // When to run
  operations: string[]                              // What to intercept
  priority: number                                  // Order (higher = first)
  
  initialize(context): Promise<void>                // Setup
  execute(op, params, next): Promise<T>            // Do work
  shutdown?(): Promise<void>                        // Cleanup (optional)
}
```

That's it! Every augmentation implements this interface.

## Creating Different Types of Augmentations

### 1. Basic Feature Augmentation

**Use Case:** Add logging, caching, validation, etc.

```typescript
import { BaseAugmentation } from 'brainy'

export class LoggingAugmentation extends BaseAugmentation {
  name = 'logging'
  timing = 'around'           // Wrap operations
  operations = ['add', 'delete']  // What to log
  priority = 10               // Low priority
  
  async execute(op, params, next) {
    console.log(`Starting ${op}`)
    const result = await next()
    console.log(`Completed ${op}`)
    return result
  }
}

// Usage
brain.augmentations.register(new LoggingAugmentation())
```

### 2. Storage Augmentation

**Use Case:** Provide a storage backend (special: has `provideStorage()` method)

```typescript
import { StorageAugmentation } from 'brainy'

export class RedisStorageAugmentation extends StorageAugmentation {
  constructor(config) {
    super('redis-storage')  // Pass name to parent
    this.config = config
  }
  
  // Special method for storage only!
  async provideStorage() {
    return new RedisAdapter(this.config)
  }
}

// Usage (BEFORE init!)
brain.augmentations.register(new RedisStorageAugmentation({
  host: 'localhost',
  port: 6379
}))
await brain.init()  // Will use Redis!
```

### 3. Data Processing Augmentation

**Use Case:** Transform or validate data before storage

```typescript
export class ValidationAugmentation extends BaseAugmentation {
  name = 'validator'
  timing = 'before'        // Run before operation
  operations = ['add']     // Validate on add
  priority = 50
  
  async execute(op, params, next) {
    // Validate data
    if (!params.data || !params.data.title) {
      throw new Error('Title is required')
    }
    
    // Add timestamp
    params.data.createdAt = new Date()
    
    // Continue with modified params
    return next()
  }
}
```

### 4. External System Augmentation (Synapse)

**Use Case:** Sync with external systems like Notion, Slack, etc.

```typescript
export class NotionSyncAugmentation extends BaseAugmentation {
  name = 'notion-sync'
  timing = 'after'         // Sync after local operation
  operations = ['add', 'update', 'delete']
  priority = 30
  
  private notion: NotionClient
  
  async initialize(context) {
    await super.initialize(context)
    this.notion = new NotionClient(this.apiKey)
  }
  
  async execute(op, params, next) {
    // Do local operation first
    const result = await next()
    
    // Then sync to Notion
    if (op === 'add') {
      await this.notion.createPage({
        title: params.data.title,
        content: params.data.content
      })
    }
    
    return result
  }
}
```

### 5. Performance Optimization Augmentation

**Use Case:** Add caching, batching, deduplication

```typescript
export class CacheAugmentation extends BaseAugmentation {
  name = 'smart-cache'
  timing = 'around'        // Wrap to check cache
  operations = ['search']  // Cache searches only
  priority = 60
  
  private cache = new Map()
  
  async execute(op, params, next) {
    const key = JSON.stringify(params)
    
    // Check cache
    if (this.cache.has(key)) {
      this.log('Cache hit!')
      return this.cache.get(key)
    }
    
    // Miss - execute and cache
    const result = await next()
    this.cache.set(key, result)
    
    // Clear old entries if too many
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    return result
  }
}
```

## Quick Reference: When to Use Each Timing

| Timing | Use For | Example |
|--------|---------|---------|
| `before` | Validation, transformation | Check required fields |
| `after` | Logging, syncing, analytics | Send to external API |
| `around` | Caching, error handling, timing | Wrap with try/catch |
| `replace` | Complete replacement | Storage backends |

## Quick Reference: Common Operations

| Operation | Description |
|-----------|-------------|
| `'add'` | Adding data to brain |
| `'search'` | Searching/querying |
| `'update'` | Updating existing data |
| `'delete'` | Removing data |
| `'storage'` | Storage resolution (special) |
| `'all'` | Intercept everything |

## The Context Object

Every augmentation gets this during `initialize()`:

```typescript
{
  brain: BrainyData,      // The brain instance
  storage: StorageAdapter, // Storage backend
  config: BrainyDataConfig, // Configuration
  log: (msg, level) => void // Logger
}
```

## Priority Guidelines

| Priority | Use For |
|----------|---------|
| 100 | Storage (critical infrastructure) |
| 80-99 | System operations (WAL, connections) |
| 50-79 | Performance (caching, batching) |
| 20-49 | Features (validation, transformation) |
| 1-19 | Logging, analytics |

## Complete Working Example

Here's a full augmentation that adds word count to all documents:

```typescript
import { BaseAugmentation } from 'brainy'

export class WordCountAugmentation extends BaseAugmentation {
  name = 'word-counter'
  timing = 'before'
  operations = ['add', 'update']
  priority = 40
  
  async execute(operation, params, next) {
    // Add word count to metadata
    if (params.data && params.data.content) {
      const wordCount = params.data.content.split(/\s+/).length
      params.metadata = params.metadata || {}
      params.metadata.wordCount = wordCount
      
      this.log(`Added word count: ${wordCount}`)
    }
    
    // Continue with enhanced params
    return next()
  }
  
  async initialize(context) {
    await super.initialize(context)
    this.log('Word counter ready!')
  }
}

// Usage
const brain = new BrainyData()
brain.augmentations.register(new WordCountAugmentation())
await brain.init()

// Now all adds include word count
await brain.add('Hello world', { 
  content: 'This is a test document with nine words here'
})
// Automatically adds: metadata.wordCount = 9
```

## Key Points to Remember

1. **All augmentations are `BrainyAugmentation`** - One interface
2. **Storage augmentations** add `provideStorage()` method
3. **Register before `init()`** for storage, anytime for others
4. **Use `BaseAugmentation`** for convenience (has helpers)
5. **`next()` is crucial** - Always call it (unless `replace`)
6. **Order matters** - Use priority to control execution order

## Testing Your Augmentation

```typescript
describe('MyAugmentation', () => {
  it('should enhance data', async () => {
    const brain = new BrainyData()
    brain.augmentations.register(new MyAugmentation())
    await brain.init()
    
    await brain.add('test', { data: 'test' })
    const result = await brain.search('test')
    
    expect(result[0].metadata.enhanced).toBe(true)
  })
})
```

That's it! Augmentations are simple middleware that intercept operations. Pick your timing, operations, and priority, then implement `execute()`!