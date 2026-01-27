# Brainy Complete Public API Reference

> **Accurate API documentation for Brainy**

## Initialization

```typescript
import { Brainy, NounType, VerbType } from '@soulcraft/brainy'

// Zero-config (just works)
const brain = new Brainy()
await brain.init()

// With configuration
const brain = new Brainy({
 storage: { type: 'memory' }, // or { path: './my-data' } for filesystem
 embeddingModel: 'Q8', // Q4, Q8, F16, F32
 silent: true // Suppress logs
})
await brain.init()
```

## Readiness API

For reliable initialization detection, especially in cloud environments with progressive initialization:

### `brain.ready` - Await Initialization

```typescript
const brain = new Brainy()
brain.init() // Fire and forget

// Elsewhere (e.g., API handler)
await brain.ready // Wait until init() completes
const results = await brain.find({ query: 'test' })
```

### `brain.isInitialized` - Check Basic Readiness

```typescript
if (brain.isInitialized) {
 // Safe to use brain methods
}
```

### `brain.isFullyInitialized()` - Check Background Tasks

```typescript
// Returns true when ALL initialization is complete, including background tasks
// Useful for cloud storage adapters with progressive initialization
if (brain.isFullyInitialized()) {
 console.log('All background tasks complete')
}
```

### `brain.awaitBackgroundInit()` - Wait for Background Tasks

```typescript
const brain = new Brainy({ storage: { type: 'gcs', ... } })
await brain.init() // Fast return in cloud (<200ms)

// Optional: wait for all background tasks (bucket validation, count sync)
await brain.awaitBackgroundInit()
console.log('Fully initialized including background tasks')
```

### Health Check Pattern

```typescript
app.get('/health', async (req, res) => {
 try {
 await brain.ready
 res.json({
 status: 'ready',
 fullyInitialized: brain.isFullyInitialized()
 })
 } catch (error) {
 res.status(503).json({ status: 'initializing', error: error.message })
 }
})
```

## Core CRUD Operations

### `brain.add(params)` - Add Entity

```typescript
// Add with data (auto-embedded)
const id = await brain.add({
 data: 'Machine learning is a subset of AI',
 type: NounType.Document,
 metadata: { author: 'Alice', tags: ['ml', 'ai'] }
})

// Add with pre-computed vector
const id = await brain.add({
 data: 'Content here',
 vector: [0.1, 0.2, ...], // 384 dimensions
 type: NounType.Concept
})
```

**Parameters:**
- `data` (required): Content to embed (string, object, or any serializable data)
- `type?`: NounType enum value
- `metadata?`: Custom key-value pairs
- `vector?`: Pre-computed embedding vector
- `id?`: Custom ID (auto-generated if not provided)

### `brain.get(id, options?)` - Get Entity

```typescript
const entity = await brain.get('entity-id')

// Include vector embeddings (not loaded by default for performance)
const entity = await brain.get('entity-id', { includeVectors: true })
```

### `brain.update(params)` - Update Entity

```typescript
await brain.update({
 id: 'entity-id',
 data: 'Updated content', // Re-embeds if changed
 metadata: { reviewed: true } // Merges with existing
})
```

### `brain.delete(id)` - Delete Entity

```typescript
await brain.delete('entity-id')
```

### `brain.clear()` - Clear All Data

```typescript
await brain.clear()
```

## Relationships

### `brain.relate(params)` - Create Relationship

```typescript
const relationId = await brain.relate({
 from: 'source-entity-id',
 to: 'target-entity-id',
 type: VerbType.RelatedTo,
 metadata: { strength: 0.9 }
})
```

**Parameters:**
- `from` (required): Source entity ID
- `to` (required): Target entity ID
- `type` (required): VerbType enum value
- `metadata?`: Custom relationship metadata

### `brain.getRelations(params)` - Query Relationships

```typescript
// Get all relationships from an entity
const relations = await brain.getRelations({ from: 'entity-id' })

// Get relationships to an entity
const relations = await brain.getRelations({ to: 'entity-id' })

// Filter by type
const relations = await brain.getRelations({
 from: 'entity-id',
 type: VerbType.Contains
})
```

### `brain.unrelate(id)` - Delete Relationship

```typescript
await brain.unrelate('relationship-id')
```

## Search & Query

### `brain.find(query)` - Semantic Search

The primary search method with Triple Intelligence (semantic + graph + metadata).

```typescript
// Simple text search
const results = await brain.find('machine learning algorithms')

// With options
const results = await brain.find({
 query: 'machine learning',
 limit: 10,
 threshold: 0.7,
 type: NounType.Document,
 where: { author: 'Alice' },
 excludeVFS: true // Exclude VFS files from results
})

// Natural language query (Triple Intelligence)
const results = await brain.find(
 'Show me documents about AI written by Alice in 2024'
)
```

**Parameters:**
- `query`: Search text (required)
- `limit?`: Max results (default: 10)
- `threshold?`: Minimum similarity (0-1)
- `type?`: Filter by NounType
- `where?`: Metadata filters
- `excludeVFS?`: Exclude VFS entities

### `brain.similar(params)` - Find Similar Entities

```typescript
// Find similar to entity ID
const similar = await brain.similar({
 to: 'entity-id',
 limit: 5
})

// Find similar to vector
const similar = await brain.similar({
 to: [0.1, 0.2, ...], // Vector
 limit: 10,
 type: NounType.Document
})
```

## Batch Operations

### `brain.addMany(params)` - Batch Add

```typescript
const result = await brain.addMany({
 items: [
 { data: 'First item', type: NounType.Document },
 { data: 'Second item', type: NounType.Concept },
 { data: 'Third item', metadata: { priority: 'high' } }
 ],
 continueOnError: true, // Don't stop on failures
 onProgress: (completed, total) => {
 console.log(`${completed}/${total} complete`)
 }
})

console.log(`Added: ${result.successful.length}, Failed: ${result.failed.length}`)
```

### `brain.deleteMany(params)` - Batch Delete

```typescript
// Delete by IDs
const result = await brain.deleteMany({
 ids: ['id1', 'id2', 'id3'],
 continueOnError: true
})

// Delete by type
const result = await brain.deleteMany({
 type: NounType.TempData
})

// Delete by metadata filter
const result = await brain.deleteMany({
 where: { status: 'archived' }
})
```

### `brain.relateMany(params)` - Batch Relate

```typescript
const ids = await brain.relateMany({
 items: [
 { from: 'a', to: 'b', type: VerbType.RelatedTo },
 { from: 'b', to: 'c', type: VerbType.Contains },
 { from: 'c', to: 'd', type: VerbType.References }
 ],
 continueOnError: true
})
```

### `brain.updateMany(params)` - Batch Update

```typescript
const result = await brain.updateMany({
 items: [
 { id: 'id1', metadata: { reviewed: true } },
 { id: 'id2', data: 'Updated content' }
 ],
 continueOnError: true
})
```

## Neural API

Access advanced AI/ML features via `brain.neural()`:

```typescript
const neural = brain.neural()

// Similarity calculation
const similarity = await neural.similar('text1', 'text2')
const detailed = await neural.similar('text1', 'text2', { detailed: true })

// Clustering
const clusters = await neural.clusters()
const clusters = await neural.clusters({
 algorithm: 'hierarchical',
 maxClusters: 10
})

// K-nearest neighbors
const neighbors = await neural.neighbors('entity-id', { k: 5 })

// Semantic hierarchy
const hierarchy = await neural.hierarchy('entity-id')

// Outlier/anomaly detection
const outliers = await neural.outliers({ threshold: 2.0 })

// Domain-aware clustering
const domainClusters = await neural.clusterByDomain('category')

// Temporal clustering
const temporalClusters = await neural.clusterByTime('createdAt', [
 { start: new Date('2024-01-01'), end: new Date('2024-06-30'), label: 'H1' },
 { start: new Date('2024-07-01'), end: new Date('2024-12-31'), label: 'H2' }
])

// Streaming clusters (for large datasets)
for await (const batch of neural.clusterStream({ batchSize: 100 })) {
 console.log(`Progress: ${batch.progress.percentage}%`)
}
```

## Virtual File System (VFS)

Access via `brain.vfs`:

```typescript
const vfs = brain.vfs
await vfs.init()

// File operations
await vfs.writeFile('/docs/readme.md', '# Hello')
const content = await vfs.readFile('/docs/readme.md')
await vfs.unlink('/docs/readme.md')

// Directory operations
await vfs.mkdir('/project/src', { recursive: true })
const files = await vfs.readdir('/project')
await vfs.rmdir('/project', { recursive: true })

// Bulk operations
const result = await vfs.bulkWrite([
 { type: 'mkdir', path: '/data' },
 { type: 'write', path: '/data/config.json', data: '{}' },
 { type: 'write', path: '/data/users.json', data: '[]' }
])
// Note: mkdir operations run first (sequentially), then other ops in parallel

// Semantic search
const results = await vfs.search('authentication code', { path: '/src' })

// File metadata
const stats = await vfs.stat('/file.txt')
await vfs.setMetadata('/file.txt', { author: 'Alice' })
```

## Counts (O(1) Performance)

```typescript
// Entity counts
const total = brain.counts.entities()
const byType = await brain.counts.byType(NounType.Document)
const nonVFS = await brain.counts.byType({ excludeVFS: true })

// Relationship counts
const relations = brain.counts.relationships()
const byVerb = await brain.counts.byVerbType(VerbType.Contains)
```

## Versioning & Branching

```typescript
// Create branch
await brain.fork('feature-branch')

// List branches
const branches = await brain.listBranches()

// Switch branch
await brain.checkout('feature-branch')

// Get current branch
const current = await brain.getCurrentBranch()

// Commit changes
await brain.commit({ message: 'Added new features' })

// View history
const history = await brain.getHistory({ limit: 10 })

// Time travel (read-only snapshot)
const snapshot = await brain.asOf('commit-id')
```

## Streaming API

```typescript
// Stream all entities
for await (const entity of brain.streaming.entities()) {
 console.log(entity.id)
}

// Stream with filters
for await (const entity of brain.streaming.entities({
 type: NounType.Document,
 where: { status: 'active' }
})) {
 // Process each entity
}

// Stream relationships
for await (const relation of brain.streaming.relations({
 from: 'entity-id'
})) {
 console.log(relation)
}
```

## Pagination API

```typescript
// Paginated queries
const page1 = await brain.pagination.find({
 query: 'machine learning',
 page: 1,
 pageSize: 20
})

console.log(`Page ${page1.page} of ${page1.totalPages}`)
console.log(`Total results: ${page1.total}`)

// Get next page
const page2 = await brain.pagination.find({
 query: 'machine learning',
 page: 2,
 pageSize: 20
})
```

## Augmentations

```typescript
// List active augmentations
const augmentations = brain.augmentations.list()

// Get specific augmentation
const cache = brain.augmentations.get('cache')

// Augmentations are auto-loaded based on config
// Common augmentations: cache, display, metrics, intelligent-import
```

## Utilities

```typescript
// Manual embedding
const vector = await brain.embed('text to embed')

// Flush pending writes
await brain.flush()

// Get statistics
const stats = await brain.getStats()
const statsNoVFS = await brain.getStats({ excludeVFS: true })

// Close (cleanup)
await brain.close()
```

## Type Enums

```typescript
import { NounType, VerbType } from '@soulcraft/brainy'

// NounType - Entity types
NounType.Document
NounType.Person
NounType.Concept
NounType.Event
NounType.Location
NounType.Organization
NounType.Product
NounType.Content
NounType.Collection
// ... and more

// VerbType - Relationship types
VerbType.RelatedTo
VerbType.Contains
VerbType.References
VerbType.DependsOn
VerbType.Precedes
VerbType.Follows
VerbType.CreatedBy
VerbType.ModifiedBy
// ... and more
```

## Error Handling

```typescript
try {
 await brain.get('nonexistent-id')
} catch (error) {
 if (error.message.includes('not found')) {
 // Handle missing entity
 }
}

// VFS errors use POSIX codes
try {
 await vfs.readFile('/nonexistent')
} catch (error) {
 if (error.code === 'ENOENT') {
 // File not found
 }
}
```

## Configuration Reference

```typescript
const brain = new Brainy({
 // Storage
 storage: {
 type: 'memory' | 'filesystem',
 path: './data', // For filesystem
 forceMemoryStorage: false // Force memory even if path exists
 },

 // Embeddings
 embeddingModel: 'Q8', // Q4, Q8, F16, F32
 dimensions: 384, // Auto-detected

 // Performance
 silent: false, // Suppress console output
 verbose: false, // Extra logging

 // Augmentations (auto-enabled by default)
 augmentations: {
 cache: true,
 display: true,
 metrics: true
 }
})
```
