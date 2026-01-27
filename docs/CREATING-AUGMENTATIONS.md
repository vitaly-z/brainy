# Creating Augmentations for Brainy

> **Updated** - Includes metadata structure changes and type system improvements

## The BrainyAugmentation Interface

Every augmentation implements this simple yet powerful interface:

```typescript
interface BrainyAugmentation {
 // Identification
 name: string // Unique name for your augmentation

 // Execution control
 timing: 'before' | 'after' | 'around' | 'replace' // When to execute
 operations: string[] // Which operations to intercept
 priority: number // Execution order (higher = first)

 // Lifecycle methods
 initialize(context: AugmentationContext): Promise<void>
 execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T>
 shutdown?(): Promise<void> // Optional cleanup
}
```

## Breaking Changes for Augmentation Developers

### 1. Metadata Structure Separation
Brainy introduces strict metadata/vector separation for billion-scale performance:

```typescript
// ✅ Metadata has required type field
interface NounMetadata {
 noun: NounType // Required! Must be a valid noun type
 [key: string]: any // Your custom metadata
}

interface VerbMetadata {
 verb: VerbType // Required! Must be a valid verb type
 sourceId: string
 targetId: string
 [key: string]: any
}
```

### 2. Storage Adapter Return Types
Storage adapters now return different types at different boundaries:

```typescript
// Internal methods: Pure structures (no metadata)
abstract _getNoun(id: string): Promise<HNSWNoun | null>

// Public API: WithMetadata structures
abstract getNoun(id: string): Promise<HNSWNounWithMetadata | null>
```

### 3. Verb Property Renamed
The verb relationship field changed from `type` to `verb`:

```typescript
// ❌ v3.x
verb.type === 'relatedTo'

// ✅ Current
verb.verb === 'relatedTo'
```

## Creating a Storage Augmentation

Storage augmentations are special - they provide the storage backend for Brainy.

### Important: Storage Requirements

Your storage adapter MUST:
1. **Wrap metadata** with required `noun`/`verb` fields
2. **Return pure structures** from internal `_methods`
3. **Return WithMetadata types** from public methods

```typescript
import { StorageAugmentation } from 'brainy/augmentations'
import { BaseStorageAdapter, HNSWNoun, HNSWNounWithMetadata, NounMetadata } from 'brainy'

export class MyCustomStorage extends BaseStorageAdapter {
 // Internal method: Returns pure structure
 async _getNoun(id: string): Promise<HNSWNoun | null> {
 const data = await this.fetchFromDatabase(id)
 return data ? {
 id: data.id,
 vector: data.vector,
 nounType: data.type
 } : null
 }

 // Public method: Returns WithMetadata structure
 async getNoun(id: string): Promise<HNSWNounWithMetadata | null> {
 const noun = await this._getNoun(id)
 if (!noun) return null

 // Fetch metadata separately
 const metadata = await this.getNounMetadata(id)

 return {
 ...noun,
 metadata: metadata || { noun: noun.nounType || 'thing' }
 }
 }

 // CRITICAL: Always save with proper metadata structure
 async saveNoun(noun: HNSWNoun, metadata?: NounMetadata): Promise<void> {
 // Validate metadata has required 'noun' field
 if (!metadata?.noun) {
 throw new Error('NounMetadata requires "noun" field')
 }

 await this.database.save({
 id: noun.id,
 vector: noun.vector,
 nounType: noun.nounType,
 metadata: metadata // Stored separately
 })
 }
}

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
const brain = new Brainy()
brain.augmentations.register(new MyStorageAugmentation({
 connectionString: 'redis://localhost:6379'
}))
await brain.init() // Will use your storage!
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
 this.timing = 'around' // Wrap operations
 this.operations = ['search'] // Only cache searches
 this.priority = 50 // Mid-priority
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
 return next(validated) // Pass modified params
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
 brain: Brainy // The brain instance
 storage: StorageAdapter // Storage backend
 config: BrainyConfig // Configuration
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
 await this.limiter.acquire() // Wait if rate limited
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

### General Practices

1. **Use BaseAugmentation** - Provides common functionality
2. **Set appropriate priority** - Storage (100), System (80-99), Features (10-50)
3. **Be selective with operations** - Don't use 'all' unless necessary
4. **Handle errors gracefully** - Don't break the chain
5. **Clean up in shutdown()** - Release resources
6. **Log appropriately** - Use context.log() for consistent output
7. **Document your augmentation** - Include examples

### Specific Best Practices

8. **Always include `noun` field** when creating/modifying NounMetadata:
 ```typescript
 const metadata: NounMetadata = {
 noun: 'thing', // REQUIRED!
 yourField: 'value'
 }
 ```

9. **Use `verb` property** not `type` when working with relationships:
 ```typescript
 // ✅ Correct
 if (verb.verb === 'relatedTo') { ... }

 // ❌ Wrong (v3.x pattern)
 if (verb.type === 'relatedTo') { ... }
 ```

10. **Access metadata correctly** from storage:
 ```typescript
 // ✅ Correct - metadata is already structured
 const nounType = noun.metadata.noun

 // ⚠️ Fallback pattern for robustness
 const nounType = noun.metadata?.noun || 'thing'
 ```

11. **Respect the two-file storage pattern** - Don't mix vector and metadata operations:
 ```typescript
 // ✅ Good - Separate concerns
 await storage.saveNoun(noun)
 await storage.saveMetadata(noun.id, metadata)

 // ❌ Bad - Mixing concerns
 await storage.saveNounWithEverything(combinedData)
 ```

## Testing Your Augmentation

```typescript
import { Brainy } from 'brainy'
import { MyAugmentation } from './my-augmentation'

describe('MyAugmentation', () => {
 let brain: Brainy

 beforeEach(async () => {
 brain = new Brainy()
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