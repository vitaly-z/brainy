# 🔄 How Augmentations Hook Into Brainy

## The Complete Pipeline Architecture

```
User Code → BrainyData Method → Augmentation Pipeline → Storage/Operations
                     ↑                    ↓
                     └────── Augmentations Execute Here ──┘
```

## 🎯 How Augmentations Register & Execute

### 1. **Registration During Initialization**

```typescript
// In BrainyData constructor/init
class BrainyData {
  private augmentations = new AugmentationRegistry()
  
  async init() {
    // Register built-in augmentations in priority order
    this.augmentations.register(new WALAugmentation())        // Priority: 100
    this.augmentations.register(new EntityRegistryAugmentation()) // Priority: 90
    this.augmentations.register(new NeuralImportAugmentation())   // Priority: 80
    this.augmentations.register(new BatchProcessingAugmentation()) // Priority: 50
    
    // Initialize all with context
    const context: AugmentationContext = {
      brain: this,
      storage: this.storage,
      config: this.config,
      log: (msg, level) => console.log(msg)
    }
    
    await this.augmentations.initialize(context)
  }
}
```

### 2. **Execution Through Method Interception**

Every BrainyData operation wraps its core logic with augmentation execution:

```typescript
// Example: The add() method
async add(content: string, metadata?: any): Promise<string> {
  // Augmentations wrap the core operation
  return this.augmentations.execute(
    'add',                    // Operation name
    { content, metadata },    // Parameters
    async () => {             // Core operation
      // Actual add logic here
      const id = generateId()
      await this.storage.set(id, { content, metadata })
      return id
    }
  )
}
```

### 3. **The Execution Chain**

```typescript
// In AugmentationRegistry
async execute<T>(operation: string, params: any, mainOperation: () => Promise<T>): Promise<T> {
  // 1. Filter augmentations that should run for this operation
  const applicable = this.augmentations.filter(aug => 
    aug.shouldExecute(operation, params)
  )
  
  // 2. Sort by priority (already sorted during registration)
  // Priority 100 runs first, then 90, 80, etc.
  
  // 3. Create middleware chain
  let index = 0
  const executeNext = async (): Promise<T> => {
    if (index >= applicable.length) {
      // All augmentations processed, run main operation
      return mainOperation()
    }
    
    const augmentation = applicable[index++]
    // Each augmentation decides what to do with the operation
    return augmentation.execute(operation, params, executeNext)
  }
  
  return executeNext()
}
```

## 🎭 The Four Timing Modes in Action

### **`timing: 'before'`** - Pre-processing
```typescript
class NeuralImportAugmentation {
  timing = 'before'
  
  async execute(op, params, next) {
    // Analyze data BEFORE storage
    const analysis = await this.analyzeWithAI(params.content)
    params.metadata._neural = analysis
    
    // Continue with enhanced params
    return next()
  }
}
```

### **`timing: 'after'`** - Post-processing
```typescript
class NotionSynapse {
  timing = 'after'
  
  async execute(op, params, next) {
    // Let operation complete first
    const result = await next()
    
    // Then sync to Notion
    await this.syncToNotion(op, params, result)
    
    return result
  }
}
```

### **`timing: 'around'`** - Wrapping
```typescript
class WALAugmentation {
  timing = 'around'
  
  async execute(op, params, next) {
    // Write to WAL before
    await this.wal.write({ op, params, timestamp: Date.now() })
    
    try {
      // Execute operation
      const result = await next()
      
      // Mark as committed
      await this.wal.commit()
      
      return result
    } catch (error) {
      // Rollback on failure
      await this.wal.rollback()
      throw error
    }
  }
}
```

### **`timing: 'replace'`** - Complete replacement
```typescript
class S3StorageAugmentation {
  timing = 'replace'
  
  async execute(op, params, next) {
    if (op === 'storage.get') {
      // Don't call next() - completely replace
      return await this.s3.getObject(params.key)
    }
    // For other operations, pass through
    return next()
  }
}
```

## 📊 Real Example: How `brain.add()` Works

```typescript
// User calls:
await brain.add("John is a developer", { type: "person" })

// This triggers the chain:

1. BrainyData.add() calls augmentations.execute('add', params, coreLogic)

2. AugmentationRegistry filters applicable augmentations:
   - WALAugmentation (priority: 100, operations: ['all'])
   - EntityRegistryAugmentation (priority: 90, operations: ['add'])
   - NeuralImportAugmentation (priority: 80, operations: ['add'])
   - BatchProcessingAugmentation (priority: 50, operations: ['add'])

3. Execution chain (highest priority first):
   
   WALAugmentation.execute() {
     await wal.write(operation)      // Log to WAL
     const result = await next()     // Call next in chain
     await wal.commit()               // Commit WAL
     return result
   }
   ↓
   EntityRegistryAugmentation.execute() {
     const hash = computeHash(params.content)
     if (registry.has(hash)) {
       return registry.get(hash)     // Return existing ID
     }
     const result = await next()     // Continue chain
     registry.set(hash, result)      // Register new entity
     return result
   }
   ↓
   NeuralImportAugmentation.execute() {
     const analysis = await analyzeWithAI(params)
     params.metadata._neural = analysis  // Add AI insights
     return next()                        // Continue with enhanced data
   }
   ↓
   BatchProcessingAugmentation.execute() {
     batch.add(params)                   // Add to batch
     if (batch.isFull()) {
       await batch.flush()               // Process batch if full
     }
     return next()                        // Continue
   }
   ↓
   Core add() logic {
     // Finally, the actual storage operation
     const id = generateId()
     await storage.set(id, params)
     await index.add(id, vector)
     return id
   }
```

## 🔌 Dynamic Registration

Augmentations can be registered at any time:

```typescript
// During initialization
brain.augmentations.register(new CustomAugmentation())

// Or later, dynamically
const synapse = new NotionSynapse({ apiKey: 'xxx' })
brain.augmentations.register(synapse)

// From Brain Cloud marketplace
import { EmotionalIntelligence } from '@brain-cloud/empathy'
brain.augmentations.register(new EmotionalIntelligence())
```

## 🎯 Operation Targeting

Augmentations declare which operations they care about:

```typescript
class SearchOptimizer {
  operations = ['search', 'searchText', 'findSimilar']  // Only search ops
}

class GlobalLogger {
  operations = ['all']  // Every operation
}

class StorageReplacer {
  operations = ['storage']  // Storage operations only
}
```

## 🔍 On-Demand Execution

Some augmentations can be triggered manually:

```typescript
// Get specific augmentation
const neuralImport = brain.augmentations.get('neural-import')

// Use its public API directly
const analysis = await neuralImport.getNeuralAnalysis(data, 'json')

// Or trigger through operations
await brain.add(data)  // Automatically uses neural import if registered
```

## 📈 Priority System

```
100: Critical Infrastructure (WAL, Transactions)
 90: Data Integrity (Entity Registry, Deduplication)
 80: Data Processing (Neural Import, Transformation)
 50: Performance (Batching, Caching)
 10: Features (Scoring, Analytics)
  1: Monitoring (Logging, Metrics)
```

## 🌊 The Flow

1. **User Action** → `brain.add()`, `brain.search()`, etc.
2. **Method Wraps** → Core logic wrapped with `augmentations.execute()`
3. **Filter** → Find augmentations for this operation
4. **Sort** → Order by priority
5. **Chain** → Each augmentation calls next() or not
6. **Core** → Eventually hits actual implementation
7. **Unwind** → Results flow back through chain
8. **Return** → Enhanced result to user

## 💡 Key Insights

1. **Everything is interceptable** - All operations go through the pipeline
2. **Augmentations compose** - They stack like middleware
3. **Priority matters** - Higher priority runs first
4. **Timing is flexible** - before/after/around/replace covers all needs
5. **Simple but powerful** - One interface, infinite possibilities

This is why the single `BrainyAugmentation` interface works for EVERYTHING - it's just middleware with superpowers! 🚀