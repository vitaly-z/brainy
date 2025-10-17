# 🛠️ Brainy Augmentation Developer Guide

> **How to create, test, and use augmentations in Brainy v4.0.0**
>
> **⚠️ v4.0.0 Update**: This guide has been updated with breaking changes for metadata structure and type system improvements.

## v4.0.0 Migration Guide

### What Changed?

1. **Metadata Structure**: All metadata now requires type fields (`noun` or `verb`)
2. **Property Rename**: `verb.type` → `verb.verb` for relationships
3. **Two-File Storage**: Vectors and metadata stored separately for performance
4. **Return Types**: Storage methods distinguish between internal (pure) and public (WithMetadata) returns

### Migration Checklist

- [ ] Update metadata creation to include required `noun` field
- [ ] Change `verb.type` to `verb.verb` in all relationship code
- [ ] Update storage adapter methods to follow internal/public pattern
- [ ] Ensure metadata access uses correct structure

### Quick Migration Example

```typescript
// ❌ v3.x
const verb = {
  type: 'relatedTo',
  sourceId: 'a',
  targetId: 'b'
}
if (verb.type === 'relatedTo') { ... }

// ✅ v4.0.0
const verb = {
  verb: 'relatedTo',
  sourceId: 'a',
  targetId: 'b'
}
const metadata: VerbMetadata = {
  verb: 'relatedTo',
  sourceId: 'a',
  targetId: 'b'
}
if (verb.verb === 'relatedTo') { ... }
```

## Quick Start: Your First Augmentation

```typescript
import { BaseAugmentation, BrainyAugmentation, AugmentationContext } from '@soulcraft/brainy'

export class MyFirstAugmentation extends BaseAugmentation {
  readonly name = 'my-first-augmentation'
  readonly timing = 'after' as const       // When to run: before | after | both
  readonly operations = ['add'] as const  // Which operations to hook
  readonly priority = 10                    // Execution order (lower = first)

  protected async onInit(): Promise<void> {
    // Initialize your augmentation
    console.log('MyFirstAugmentation initialized!')
  }

  async execute<T = any>(
    operation: string,
    params: any,
    context?: AugmentationContext
  ): Promise<T | void> {
    // Your augmentation logic
    if (operation === 'add') {
      console.log('Noun added:', params.noun)

      // v4.0.0: Access metadata correctly
      if (params.noun?.metadata) {
        console.log('Noun type:', params.noun.metadata.noun)  // Required field
      }

      // You can access the brain instance
      const stats = await context?.brain.getStats()
      console.log('Total nouns:', stats.totalNouns)
    }
  }

  protected async onShutdown(): Promise<void> {
    // Cleanup
    console.log('MyFirstAugmentation shutting down')
  }
}
```

## Using Your Augmentation

```typescript
import { Brainy } from '@soulcraft/brainy'
import { MyFirstAugmentation } from './my-first-augmentation'

const brain = new Brainy()

// Register before init()
brain.augmentations.register(new MyFirstAugmentation())

await brain.init()

// Now your augmentation runs automatically!
await brain.add('Hello World')
// Console: "Noun added: { id: '...', vector: [...], metadata: {} }"
```

---

## Augmentation Lifecycle

### 1. Registration Phase
```typescript
const aug = new MyAugmentation()
brain.augmentations.register(aug)  // Before brain.init()!
```

### 2. Initialization Phase
```typescript
await brain.init()  // Calls aug.initialize() internally
// Your onInit() method runs here
```

### 3. Execution Phase
```typescript
await brain.add('data')  // Your execute() method runs
```

### 4. Shutdown Phase
```typescript
await brain.shutdown()  // Your onShutdown() method runs
```

---

## Timing Options

### `before` - Modify Input
```typescript
class ValidationAugmentation extends BaseAugmentation {
  readonly timing = 'before' as const
  
  async execute<T>(operation: string, params: any): Promise<any> {
    if (operation === 'add') {
      // Validate and/or modify params
      if (!params.content) {
        throw new Error('Content required')
      }
      // Return modified params
      return { ...params, validated: true }
    }
  }
}
```

### `after` - React to Results
```typescript
class LoggingAugmentation extends BaseAugmentation {
  readonly timing = 'after' as const
  
  async execute<T>(operation: string, params: any): Promise<void> {
    if (operation === 'search') {
      console.log(`Search for "${params.query}" returned ${params.result.length} results`)
    }
    // Don't return anything - just observe
  }
}
```

### `both` - Before AND After
```typescript
class TimingAugmentation extends BaseAugmentation {
  readonly timing = 'both' as const
  private startTime?: number
  
  async execute<T>(operation: string, params: any, context?: AugmentationContext): Promise<void> {
    if (!this.startTime) {
      // Before execution
      this.startTime = Date.now()
    } else {
      // After execution
      const duration = Date.now() - this.startTime
      console.log(`${operation} took ${duration}ms`)
      this.startTime = undefined
    }
  }
}
```

---

## Operation Hooks

### Core Operations You Can Hook
```typescript
readonly operations = [
  'add',            // Adding data
  'update',         // Updating data
  'delete',         // Deleting data
  'get',            // Retrieving data
  'search',         // Searching
  'find',           // Triple Intelligence queries
  'relate',         // Adding relationships
  'unrelate',       // Removing relationships
  'clear',          // Clearing data
  'all'            // Hook ALL operations
] as const
```

### Example: Multi-Operation Hook
```typescript
class AuditAugmentation extends BaseAugmentation {
  readonly operations = ['add', 'update', 'delete'] as const
  
  async execute<T>(operation: string, params: any): Promise<void> {
    // Log all data modifications
    await this.logToAuditTrail(operation, params)
  }
}
```

---

## Accessing Brain Context

```typescript
class ContextAwareAugmentation extends BaseAugmentation {
  async execute<T>(
    operation: string,
    params: any,
    context?: AugmentationContext
  ): Promise<void> {
    // Access the brain instance
    const brain = context?.brain
    if (!brain) return
    
    // Use any brain method
    const stats = await brain.getStats()
    const size = await brain.size()
    const results = await brain.search('query')
    
    // Access other augmentations
    const cache = brain.augmentations.get('cache')
    if (cache) {
      await cache.clear()
    }
  }
}
```

---

## Real-World Examples

### 1. Backup Augmentation
```typescript
class BackupAugmentation extends BaseAugmentation {
  readonly name = 'backup'
  readonly timing = 'after' as const
  readonly operations = ['add', 'update', 'delete'] as const
  readonly priority = 5
  
  private changes = 0
  private readonly backupThreshold = 100
  
  async execute<T>(operation: string, params: any, context?: AugmentationContext): Promise<void> {
    this.changes++
    
    if (this.changes >= this.backupThreshold) {
      await this.performBackup(context?.brain)
      this.changes = 0
    }
  }
  
  private async performBackup(brain?: any): Promise<void> {
    if (!brain) return
    const backup = await brain.backup()
    await this.saveToCloud(backup)
    console.log('Automatic backup completed')
  }
}
```

### 2. Rate Limiting Augmentation
```typescript
class RateLimitAugmentation extends BaseAugmentation {
  readonly name = 'rate-limit'
  readonly timing = 'before' as const
  readonly operations = ['search', 'find'] as const
  readonly priority = 100  // High priority - run first
  
  private requests = new Map<string, number[]>()
  private readonly limit = 100  // 100 requests
  private readonly window = 60000  // per minute
  
  async execute<T>(operation: string, params: any): Promise<void> {
    const now = Date.now()
    const key = params.userId || 'anonymous'
    
    // Get request timestamps
    const timestamps = this.requests.get(key) || []
    
    // Remove old timestamps
    const recent = timestamps.filter(t => now - t < this.window)
    
    // Check limit
    if (recent.length >= this.limit) {
      throw new Error('Rate limit exceeded')
    }
    
    // Add current request
    recent.push(now)
    this.requests.set(key, recent)
  }
}
```

### 3. Encryption Augmentation
```typescript
class EncryptionAugmentation extends BaseAugmentation {
  readonly name = 'encryption'
  readonly timing = 'both' as const
  readonly operations = ['add', 'get'] as const
  readonly priority = 90  // Run early
  
  async execute<T>(operation: string, params: any): Promise<any> {
    if (operation === 'add') {
      // Encrypt before storing
      if (params.metadata?.sensitive) {
        params.content = await this.encrypt(params.content)
        params.encrypted = true
      }
      return params
    }

    if (operation === 'get' && params.result?.encrypted) {
      // Decrypt after retrieval
      params.result.content = await this.decrypt(params.result.content)
      delete params.result.encrypted
      return params.result
    }
  }
}
```

---

## Testing Your Augmentation

```typescript
import { describe, it, expect } from 'vitest'
import { Brainy } from '@soulcraft/brainy'
import { MyAugmentation } from './my-augmentation'

describe('MyAugmentation', () => {
  it('should hook into addNoun', async () => {
    const brain = new Brainy({ storage: 'memory' })
    const aug = new MyAugmentation()
    
    // Spy on the execute method
    const executeSpy = vi.spyOn(aug, 'execute')
    
    brain.augmentations.register(aug)
    await brain.init()
    
    // Trigger the augmentation
    await brain.add('test data')

    // Verify it was called
    expect(executeSpy).toHaveBeenCalledWith(
      'add',
      expect.objectContaining({ content: 'test data' }),
      expect.any(Object)
    )
  })
})
```

---

## Best Practices

### 1. Use Proper Timing
- `before`: Validation, modification, rate limiting
- `after`: Logging, metrics, side effects
- `both`: Timing, tracing, wrapping

### 2. Set Appropriate Priority
```typescript
// Priority guidelines
100: Critical (auth, rate limiting)
50:  Important (validation, transformation)
10:  Normal (logging, metrics)
1:   Optional (debugging, tracing)
```

### 3. Handle Errors Gracefully
```typescript
async execute<T>(operation: string, params: any): Promise<void> {
  try {
    await this.riskyOperation()
  } catch (error) {
    // Log but don't break the main operation
    console.error(`Augmentation error in ${this.name}:`, error)
    // Optionally report to monitoring
    this.reportError(error)
  }
}
```

### 4. Be Performance Conscious
```typescript
class CachedAugmentation extends BaseAugmentation {
  private cache = new Map<string, any>()
  
  async execute<T>(operation: string, params: any): Promise<any> {
    const key = this.getCacheKey(params)
    
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }
    
    // Expensive operation
    const result = await this.expensiveOperation(params)
    this.cache.set(key, result)
    
    return result
  }
}
```

### 5. Clean Up Resources
```typescript
protected async onShutdown(): Promise<void> {
  // Close connections
  await this.connection?.close()
  
  // Clear intervals
  clearInterval(this.interval)
  
  // Flush buffers
  await this.flush()
  
  // Clear caches
  this.cache.clear()
}
```

---

## Publishing Your Augmentation (Future)

### Package Structure
```
my-augmentation/
├── src/
│   └── index.ts          # Your augmentation
├── dist/                 # Built output
├── tests/
│   └── augmentation.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### package.json
```json
{
  "name": "@mycompany/brainy-custom-augmentation",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["brainy-augmentation"],
  "peerDependencies": {
    "@soulcraft/brainy": ">=2.0.0"
  },
  "brainy": {
    "type": "augmentation",
    "class": "CustomAugmentation",
    "timing": "after",
    "operations": ["add"],
    "priority": 10
  }
}
```

### Future: Brain Cloud Registry
```bash
# Coming in 2.1+
npm run build
npm test
brainy publish  # Publishes to brain-cloud registry
```

---

## FAQ

### Q: Can I modify the operation result?
**A**: Yes, if `timing: 'before'`, return modified params. If `timing: 'after'`, you can see but not modify results.

### Q: Can augmentations communicate?
**A**: Yes, through the context: `context.brain.augmentations.get('other-augmentation')`

### Q: What if my augmentation fails?
**A**: Handle errors internally. Don't break the main operation unless critical.

### Q: Can I use async operations?
**A**: Yes, everything is async-friendly.

### Q: How do I access storage directly?
**A**: Through context: `context.brain.storage` (but prefer using brain methods)

---

## Get Help

- **GitHub**: [github.com/soulcraft/brainy](https://github.com/soulcraft/brainy)
- **Discord**: [discord.gg/brainy](https://discord.gg/brainy)
- **Examples**: See `/examples/augmentations/` in the repo

---

*Start building your augmentation today! The marketplace is coming in 2.1 🚀*