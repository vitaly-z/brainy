# 🧠 Core API Patterns: Modern Brainy v3.x

> Learn the correct patterns for Brainy's core operations. Avoid v2.x confusion and use modern, efficient APIs.

## 🚨 Critical: Use v3.x APIs Only

### ❌ **WRONG - Deprecated v2.x APIs**

```typescript
// DON'T DO THIS - These methods don't exist in v3.x!
await brain.addNoun(text, type, metadata)     // ❌ Removed
await brain.getNouns({ pagination })          // ❌ Removed
await brain.addVerb(source, target, type)     // ❌ Removed
await brain.getVerbs()                        // ❌ Removed
await brain.deleteNoun(id)                    // ❌ Removed
await brain.deleteVerb(id)                    // ❌ Removed
```

### ✅ **CORRECT - Modern v3.x APIs**

```typescript
// ✅ Use these modern methods instead
await brain.add({ data, type, metadata })     // Modern unified add
await brain.find({ limit: 100 })              // Natural language search
await brain.relate({ from, to, type })        // Clean relationship creation
await brain.getRelations()                    // Modern relationship queries
await brain.delete(id)                        // Unified deletion
// Relationships auto-cascade when entities are deleted
```

## 📋 Entity Management Patterns

### ❌ **WRONG - v2.x Style**

```typescript
// DON'T DO THIS - Old API patterns
import { BrainyData } from 'old-brainy'  // ❌ Wrong import

const brain = new BrainyData({           // ❌ Old class name
  complexConfig: true
})

const id = await brain.addNoun(          // ❌ Deprecated method
  "John Smith is a developer",
  "Person",
  { role: "engineer" }
)
```

### ✅ **CORRECT - Modern Patterns**

```typescript
// ✅ Pattern 1: Basic entity creation
import { Brainy, NounType } from '@soulcraft/brainy'

const brain = new Brainy()  // ✅ Zero config
await brain.init()

const id = await brain.add({
  data: "John Smith is a developer",
  type: NounType.Person,
  metadata: { role: "engineer", team: "backend" }
})

// ✅ Pattern 2: Bulk entity creation
const entities = [
  { data: "React framework", type: NounType.Technology },
  { data: "Vue.js framework", type: NounType.Technology },
  { data: "Angular framework", type: NounType.Technology }
]

const ids = await Promise.all(
  entities.map(entity => brain.add(entity))
)

// ✅ Pattern 3: Entity with pre-computed vector
const customVector = await brain.embed("Custom text")
const vectorId = await brain.add({
  data: "Optimized content",
  type: NounType.Document,
  vector: customVector,  // Skip re-embedding
  metadata: { source: "api", optimized: true }
})
```

## 🔍 Search & Discovery Patterns

### ❌ **WRONG - Confusing Old Patterns**

```typescript
// DON'T DO THIS - Mixing old and new APIs
const results1 = await brain.searchText("query")     // ❌ Old method
const results2 = await brain.getNouns({ filter })    // ❌ Doesn't exist
const results3 = await brain.findSimilar(text)       // ❌ Unclear naming
```

### ✅ **CORRECT - Clean Search Patterns**

```typescript
// ✅ Pattern 1: Natural language search
const results = await brain.find("React developers working on authentication")

// ✅ Pattern 2: Structured search with filters
const filteredResults = await brain.find({
  like: "machine learning",           // Vector similarity
  where: {                           // Metadata filtering
    type: NounType.Document,
    year: { $gte: 2020 },
    status: "published"
  },
  limit: 50,
  orderBy: 'relevance'
})

// ✅ Pattern 3: Similarity search
const similarItems = await brain.similar({
  to: existingEntityId,              // Find items similar to this
  threshold: 0.8,                    // Minimum similarity
  limit: 10,
  exclude: [existingEntityId]        // Don't include the source
})

// ✅ Pattern 4: Advanced search with relationships
const connectedResults = await brain.find({
  like: "frontend frameworks",
  connected: {
    to: reactId,                     // Connected to React
    via: "related-to",               // Through this relationship
    depth: 2                         // Up to 2 hops away
  }
})
```

## 🔗 Relationship Patterns

### ❌ **WRONG - Old Relationship APIs**

```typescript
// DON'T DO THIS - Old relationship patterns
await brain.addVerb(sourceId, targetId, "uses", { strength: 0.9 })  // ❌ Old API
const verbs = await brain.getVerbsBySource(sourceId)               // ❌ Removed
await brain.deleteVerb(verbId)                                     // ❌ Old pattern
```

### ✅ **CORRECT - Modern Relationship Management**

```typescript
// ✅ Pattern 1: Create relationships
const relationId = await brain.relate({
  from: developerId,
  to: frameworkId,
  type: VerbType.Uses,
  metadata: {
    since: "2023-01-01",
    proficiency: "expert",
    hours_per_week: 40
  }
})

// ✅ Pattern 2: Query relationships
const relationships = await brain.getRelations({
  from: developerId,                 // Relationships from this entity
  type: VerbType.Uses,              // Of this type
  limit: 100
})

// ✅ Pattern 3: Bidirectional relationships
await brain.relate({
  from: projectId,
  to: developerId,
  type: VerbType.AssignedTo,
  bidirectional: true,              // Creates reverse relationship
  metadata: { role: "lead", start_date: "2024-01-01" }
})

// ✅ Pattern 4: Relationship-based discovery
const collaborators = await brain.find({
  connected: {
    to: currentProjectId,
    via: VerbType.WorksOn,
    direction: "incoming"           // Who works on this project
  }
})
```

## 🗃️ Data Retrieval Patterns

### ❌ **WRONG - Inefficient Patterns**

```typescript
// DON'T DO THIS - Loading everything
const everything = await brain.getNouns({ limit: 1000000 })  // ❌ Crashes
const allData = await brain.exportAll()                      // ❌ Memory explosion
```

### ✅ **CORRECT - Efficient Data Access**

```typescript
// ✅ Pattern 1: Paginated retrieval
async function getAllEntitiesPaginated() {
  const pageSize = 100
  let offset = 0
  let allEntities = []

  while (true) {
    const page = await brain.find({
      limit: pageSize,
      offset: offset
    })

    if (page.length === 0) break

    allEntities.push(...page)
    offset += pageSize

    // Optional: Progress reporting
    console.log(`Loaded ${allEntities.length} entities...`)
  }

  return allEntities
}

// ✅ Pattern 2: Streaming large datasets
async function* streamEntities() {
  const pageSize = 50
  let offset = 0

  while (true) {
    const page = await brain.find({
      limit: pageSize,
      offset: offset
    })

    if (page.length === 0) break

    for (const entity of page) {
      yield entity
    }

    offset += pageSize
  }
}

// Usage
for await (const entity of streamEntities()) {
  await processEntity(entity)
}

// ✅ Pattern 3: Specific entity retrieval
const entity = await brain.get(entityId)
if (entity) {
  console.log('Entity data:', entity.data)
  console.log('Metadata:', entity.metadata)
} else {
  console.log('Entity not found')
}
```

## 🔄 Update & Delete Patterns

### ❌ **WRONG - Manual Update Patterns**

```typescript
// DON'T DO THIS - Recreating entities
await brain.delete(oldId)
const newId = await brain.add(updatedData)  // ❌ Loses relationships
```

### ✅ **CORRECT - Update Operations**

```typescript
// ✅ Pattern 1: Update entity data
await brain.update(entityId, {
  data: "Updated content here",
  metadata: {
    lastModified: Date.now(),
    version: "2.0"
  }
})

// ✅ Pattern 2: Partial metadata updates
await brain.updateMetadata(entityId, {
  status: "published",
  tags: ["important", "featured"]
  // Merges with existing metadata
})

// ✅ Pattern 3: Safe deletion with cascade options
await brain.delete(entityId, {
  cascade: true,          // Delete related relationships
  backup: true           // Create backup before deletion
})

// ✅ Pattern 4: Bulk operations
const updateOperations = entities.map(entity => ({
  id: entity.id,
  changes: { status: "processed" }
}))

await brain.updateMany(updateOperations)
```

## 🧮 Vector & Embedding Patterns

### ❌ **WRONG - Manual Vector Handling**

```typescript
// DON'T DO THIS - Manual embedding without understanding
const vector = await brain.embed(text)
// Store vector somewhere manually                    // ❌ Missing integration
```

### ✅ **CORRECT - Smart Vector Operations**

```typescript
// ✅ Pattern 1: Automatic embedding (recommended)
const id = await brain.add({
  data: "Content to be embedded",
  type: NounType.Document
  // Vector computed automatically
})

// ✅ Pattern 2: Pre-computed vectors for optimization
const texts = ["Text 1", "Text 2", "Text 3"]
const vectors = await Promise.all(
  texts.map(text => brain.embed(text))
)

const entities = await Promise.all(
  texts.map((text, i) => brain.add({
    data: text,
    type: NounType.Document,
    vector: vectors[i]  // Skip re-embedding
  }))
)

// ✅ Pattern 3: Vector similarity search
const queryVector = await brain.embed("search query")
const similar = await brain.similar({
  vector: queryVector,              // Use vector directly
  threshold: 0.75,
  limit: 20
})

// ✅ Pattern 4: Compare vectors directly
const vector1 = await brain.embed("First text")
const vector2 = await brain.embed("Second text")
const similarity = brain.computeSimilarity(vector1, vector2)
console.log(`Similarity: ${similarity}`)
```

## 🏗️ Configuration Patterns

### ❌ **WRONG - Over-Configuration**

```typescript
// DON'T DO THIS - Complex configurations that break
const brain = new Brainy({
  storage: {
    type: 'complex',
    options: {
      nested: {
        configuration: true,
        that: "breaks"
      }
    }
  },
  embedding: {
    customModel: "broken-model",
    dimensions: 999999
  }
})
```

### ✅ **CORRECT - Smart Configuration**

```typescript
// ✅ Pattern 1: Zero configuration (recommended)
const brain = new Brainy()  // Auto-detects everything
await brain.init()

// ✅ Pattern 2: Simple storage selection
const fsBrain = new Brainy({
  storage: { type: 'filesystem', path: './data' }
})

const cloudBrain = new Brainy({
  storage: { type: 's3', bucket: 'my-data' }
})

// ✅ Pattern 3: Production configuration
const prodBrain = new Brainy({
  storage: {
    type: 's3',
    bucket: process.env.BRAINY_BUCKET,
    region: process.env.AWS_REGION
  },
  silent: true,                    // No console output
  distributed: true,               // Enable clustering
  cache: { maxSize: 10000 }       // Larger cache
})

// ✅ Pattern 4: Development vs production
const isDev = process.env.NODE_ENV === 'development'

const brain = new Brainy({
  storage: isDev
    ? { type: 'memory' }           // Fast for dev
    : { type: 'filesystem', path: './brainy-data' },  // Persistent for prod
  silent: !isDev,                 // Verbose in dev, quiet in prod
  cache: { maxSize: isDev ? 100 : 5000 }
})
```

## 🔄 Migration from v2.x

### ✅ **Migration Patterns**

```typescript
// If you have old v2.x code, here's how to migrate:

// OLD v2.x:
// await brain.addNoun(text, type, metadata)
// NEW v3.x:
await brain.add({ data: text, type, metadata })

// OLD v2.x:
// await brain.getNouns({ pagination: { limit: 100 } })
// NEW v3.x:
await brain.find({ limit: 100 })

// OLD v2.x:
// await brain.addVerb(sourceId, targetId, verbType, metadata)
// NEW v3.x:
await brain.relate({ from: sourceId, to: targetId, type: verbType, metadata })

// OLD v2.x:
// await brain.searchText(query)
// NEW v3.x:
await brain.find(query)  // More powerful natural language search
```

## 🚀 Performance Patterns

### ✅ **High-Performance Patterns**

```typescript
// ✅ Pattern 1: Batch operations
const entities = [/* large array */]
const batchSize = 100

for (let i = 0; i < entities.length; i += batchSize) {
  const batch = entities.slice(i, i + batchSize)
  await Promise.all(
    batch.map(entity => brain.add(entity))
  )

  // Optional: Rate limiting
  await new Promise(resolve => setTimeout(resolve, 100))
}

// ✅ Pattern 2: Connection pooling for distributed
const brain = new Brainy({
  distributed: true,
  connectionPool: {
    min: 5,
    max: 50,
    acquireTimeoutMillis: 30000
  }
})

// ✅ Pattern 3: Efficient caching
const brain = new Brainy({
  cache: {
    maxSize: 10000,              // Number of items
    ttl: 300000,                 // 5 minutes
    updateAgeOnGet: true         // LRU behavior
  }
})

// ✅ Pattern 4: Memory-conscious operations
const results = await brain.find({
  query: "large dataset query",
  limit: 1000,                   // Reasonable limit
  includeVectors: false          // Exclude vectors if not needed
})
```

## 🛡️ Error Handling Patterns

### ✅ **Robust Error Handling**

```typescript
// ✅ Pattern 1: Specific error handling
try {
  const result = await brain.add({ data, type, metadata })
  return result
} catch (error) {
  if (error.code === 'DUPLICATE_ENTITY') {
    console.log('Entity already exists, updating instead...')
    return await brain.update(error.existingId, { data, metadata })
  } else if (error.code === 'STORAGE_FULL') {
    throw new Error('Storage capacity exceeded')
  } else if (error.code === 'EMBEDDING_FAILED') {
    console.warn('Embedding failed, retrying with simpler text...')
    return await brain.add({
      data: data.substring(0, 1000), // Truncate
      type,
      metadata
    })
  }
  throw error
}

// ✅ Pattern 2: Retry with exponential backoff
async function resilientAdd(data: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await brain.add(data)
    } catch (error) {
      if (attempt === maxRetries) throw error

      const delay = Math.pow(2, attempt) * 1000
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// ✅ Pattern 3: Graceful degradation
async function robustSearch(query: string) {
  try {
    // Try advanced semantic search first
    return await brain.find({
      like: query,
      threshold: 0.8,
      limit: 50
    })
  } catch (error) {
    console.warn('Semantic search failed, falling back to basic search:', error.message)

    try {
      // Fallback to simple text search
      return await brain.find(query)
    } catch (fallbackError) {
      console.error('All search methods failed:', fallbackError.message)
      return []  // Return empty results rather than crash
    }
  }
}
```

## 📊 Monitoring Patterns

### ✅ **Production Monitoring**

```typescript
// ✅ Pattern 1: Performance monitoring
const startTime = Date.now()
const result = await brain.add(data)
const duration = Date.now() - startTime

if (duration > 1000) {
  console.warn(`Slow add operation: ${duration}ms`)
}

// ✅ Pattern 2: Health checks
async function healthCheck() {
  try {
    // Test basic operations
    const testId = await brain.add({
      data: "health check",
      type: NounType.System,
      metadata: { test: true }
    })

    await brain.get(testId)
    await brain.delete(testId)

    return { status: 'healthy', timestamp: Date.now() }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now()
    }
  }
}

// ✅ Pattern 3: Metrics collection
class BrainyMetrics {
  private metrics = {
    operations: 0,
    errors: 0,
    totalTime: 0
  }

  async timedOperation<T>(operation: () => Promise<T>): Promise<T> {
    const start = Date.now()
    try {
      const result = await operation()
      this.metrics.operations++
      this.metrics.totalTime += Date.now() - start
      return result
    } catch (error) {
      this.metrics.errors++
      throw error
    }
  }

  getStats() {
    return {
      ...this.metrics,
      avgTime: this.metrics.totalTime / this.metrics.operations || 0,
      errorRate: this.metrics.errors / this.metrics.operations || 0
    }
  }
}
```

## 🎯 Summary: Modern Brainy v3.x Best Practices

| ❌ **Avoid v2.x** | ✅ **Use v3.x** |
|------------------|----------------|
| `addNoun()` | `add()` |
| `getNouns()` | `find()` |
| `addVerb()` | `relate()` |
| `getVerbs()` | `getRelations()` |
| `deleteNoun()` | `delete()` |
| Complex configs | Zero-config with `new Brainy()` |
| Manual pagination | Built-in smart pagination |
| String-based search | Natural language queries |

---

**🎉 Following these patterns gives you:**
- 🚀 **Modern APIs** that are actively maintained
- ⚡ **Better performance** with intelligent defaults
- 🛡️ **Robust error handling** with specific error types
- 📈 **Scalable patterns** for production applications
- 🧠 **Natural language** search capabilities

**Next:** [Neural API Patterns →](./NEURAL_API_PATTERNS.md) | [VFS Patterns →](./vfs/COMMON_PATTERNS.md)