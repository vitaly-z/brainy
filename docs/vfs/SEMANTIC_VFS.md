# Semantic VFS - Revolutionary File System

## What is Semantic VFS?

Semantic VFS transforms traditional hierarchical file systems into **multi-dimensional knowledge graphs**. The same file can be accessed through multiple semantic dimensions simultaneously.

### Traditional vs Semantic

**Traditional File Systems:**
```
/src/auth/login.ts          # One path, one location
/src/users/profile.ts       # Separate location
```

**Semantic VFS:**
```
# Traditional path (still works!)
/src/auth/login.ts

# By concept
/by-concept/authentication/login.ts
/by-concept/security/login.ts

# By author
/by-author/alice/login.ts

# By time
/as-of/2024-03-15/login.ts

# By relationship
/related-to/src/users/profile.ts/depth-2
```

**The same file, accessible 6+ different ways!** This is **polymorphic file access**.

---

## Why Semantic VFS?

### 1. **Natural Organization**
Developers think in concepts, not directories:
```typescript
// Find all authentication-related files
const authFiles = await vfs.readdir('/by-concept/authentication')

// Find all files Alice worked on
const aliceFiles = await vfs.readdir('/by-author/alice')
```

### 2. **Time Travel**
See your codebase as it existed at any point:
```typescript
// Code from March 15th
const snapshot = await vfs.readdir('/as-of/2024-03-15')

// Compare with today
const current = await vfs.readdir('/src')
```

### 3. **Knowledge Graph Navigation**
Navigate by semantic relationships:
```typescript
// Files related to auth system (within 2 hops)
const related = await vfs.readdir('/related-to/src/auth.ts/depth-2')

// Files similar to this implementation
const similar = await vfs.readdir('/similar-to/src/auth.ts/threshold-0.8')
```

### 4. **Tag-Based Organization**
Organize by purpose, not location:
```typescript
// All security-critical files
const security = await vfs.readdir('/by-tag/security')

// All experimental features
const experiments = await vfs.readdir('/by-tag/experimental')
```

---

## Supported Semantic Dimensions

### 1. Traditional Path (Hierarchical)
```typescript
await vfs.readFile('/src/auth/login.ts')
// Works exactly like a normal filesystem
```

### 2. By Concept (Semantic)
```typescript
await vfs.readdir('/by-concept/authentication')
// Returns all files about authentication

await vfs.readFile('/by-concept/authentication/login.ts')
// Find specific file within concept
```

**How it works:** Uses `brain.extractConcepts()` with NeuralEntityExtractor to extract concepts from file content using embeddings and the NounType taxonomy. Indexes concept names for O(log n) queries. See [Neural Extraction API](./NEURAL_EXTRACTION.md) for details.

### 3. By Author (Ownership)
```typescript
await vfs.readdir('/by-author/alice')
// All files owned/modified by alice

await vfs.stat('/by-author/alice/config.ts')
// Check specific file
```

**How it works:** Tracks owner metadata on every file. Indexed by MetadataIndexManager.

### 4. By Time (Temporal)
```typescript
await vfs.readdir('/as-of/2024-03-15')
// Files modified on March 15, 2024

await vfs.readFile('/as-of/2024-03-15/src/auth.ts')
// Read auth.ts as it existed that day
```

**How it works:** Tracks `modified` timestamp. Uses B-tree range queries (`greaterEqual`/`lessEqual`) for O(log n) performance.

### 5. By Relationship (Graph)
```typescript
await vfs.readdir('/related-to/src/auth.ts/depth-2')
// Files within 2 relationship hops

await vfs.readdir('/related-to/src/auth.ts/depth-2/types-contains,references')
// Only follow 'contains' and 'references' relationships
```

**How it works:** Uses GraphAdjacencyIndex for O(1) graph traversal. Supports depth limits and relationship type filtering.

### 6. By Similarity (Vector)
```typescript
await vfs.readdir('/similar-to/src/auth.ts/threshold-0.8')
// Files with 80%+ similarity to auth.ts

await vfs.similar('/src/auth.ts', { threshold: 0.9, limit: 10 })
// Top 10 most similar files (90%+ match)
```

**How it works:** Uses HNSW vector index for O(log n) nearest neighbor search. Based on content embeddings.

### 7. By Tag (Classification)
```typescript
await vfs.readdir('/by-tag/security')
// All security-tagged files

await vfs.writeFile('/src/admin.ts', code, {
  metadata: { tags: ['security', 'admin'] }
})
// Tag files on write
```

**How it works:** Stores tags in metadata. Indexed for fast queries.

---

## Performance Characteristics

### Scalability to Millions of Files

All semantic paths use **indexed data structures** for optimal performance:

| Dimension | Data Structure | Time Complexity | Million-Scale Ready |
|-----------|---------------|-----------------|---------------------|
| Traditional | PathCache + Graph | O(path depth) | ✅ Yes |
| Concept | MetadataIndex (B-tree) | O(log n) | ✅ Yes* |
| Author | MetadataIndex (B-tree) | O(log n) | ✅ Yes |
| Time | MetadataIndex (B-tree) | O(log n) | ✅ Yes |
| Relationship | GraphAdjacency | O(depth) | ✅ Yes |
| Similarity | HNSW Index | O(log n) | ✅ Yes |
| Tag | MetadataIndex (B-tree) | O(log n) | ✅ Yes* |

\* *Requires concept/tag flattening (automatic in future versions)*

### Cache Strategy

Multi-layer caching ensures hot paths are O(1):
```
Request → Hot Path Cache (O(1))
       → Semantic Cache (5 min TTL)
       → Index Lookup (O(log n))
```

---

## Usage Examples

### Example 1: Find All Files by Concept
```typescript
const brain = new Brainy()
await brain.init()
const vfs = brain.vfs()
await vfs.init()

// Write files (concepts extracted automatically)
await vfs.writeFile('/src/auth/login.ts', `
  export function authenticate(user, password) {
    // Authentication logic
  }
`)

// Access by concept
const authFiles = await vfs.readdir('/by-concept/authentication')
console.log(authFiles)
// ['login.ts', 'signup.ts', 'oauth.ts']
```

### Example 2: Time Travel
```typescript
// See what changed today
const today = new Date().toISOString().split('T')[0]
const todaysFiles = await vfs.readdir(`/as-of/${today}`)

// Compare with yesterday
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
const yesterdaysFiles = await vfs.readdir(`/as-of/${yesterday}`)

const newFiles = todaysFiles.filter(f => !yesterdaysFiles.includes(f))
console.log('New files today:', newFiles)
```

### Example 3: Graph Navigation
```typescript
// Find all files related to auth
const authId = await vfs.resolvePath('/src/auth.ts')
const related = await vfs.readdir('/related-to/src/auth.ts/depth-2')

// Get relationship details
for (const file of related) {
  const rels = await vfs.getRelationships(file.path)
  console.log(`${file.name}: ${rels.length} relationships`)
}
```

### Example 4: Semantic Search
```typescript
// Find similar implementations
const similar = await vfs.similar('/src/auth.ts', {
  threshold: 0.8,
  limit: 10
})

for (const result of similar) {
  console.log(`${result.entity.name}: ${result.similarity.toFixed(2)}`)
}
```

---

## API Reference

### Reading Semantic Paths

All standard VFS methods work with semantic paths:

```typescript
// Read directory
await vfs.readdir('/by-concept/authentication')

// Read file
await vfs.readFile('/by-concept/authentication/login.ts')

// Get stats
await vfs.stat('/by-author/alice/config.ts')

// Check existence
await vfs.exists('/as-of/2024-03-15/src/auth.ts')
```

### Writing Files

Files are automatically indexed for semantic access:

```typescript
await vfs.writeFile('/src/auth.ts', content, {
  metadata: {
    tags: ['security', 'authentication'],
    owner: 'alice'
  },
  extractConcepts: true,  // default: true
  extractEntities: true,  // default: true
  recordEvent: true       // default: true
})
```

### Polymorphic Access

The same file is accessible through multiple paths:

```typescript
// All these resolve to the SAME file entity:
const id1 = await vfs.resolvePath('/src/auth/login.ts')
const id2 = await vfs.resolvePath('/by-concept/authentication/login.ts')
const id3 = await vfs.resolvePath('/by-author/alice/login.ts')

console.log(id1 === id2 && id2 === id3)  // true
```

---

## Extending with Custom Projections

Create your own semantic dimensions:

```typescript
import { BaseProjectionStrategy } from '@soulcraft/brainy/vfs/semantic'

class PriorityProjection extends BaseProjectionStrategy {
  readonly name = 'priority'

  async resolve(brain, vfs, priority) {
    return await brain.find({
      where: {
        vfsType: 'file',
        priority: priority  // Custom metadata field
      },
      limit: 1000
    })
    .then(results => results.map(r => r.id))
  }

  async list(brain, vfs, limit = 100) {
    const results = await brain.find({
      where: {
        vfsType: 'file',
        priority: { exists: true }
      },
      limit
    })
    return results.map(r => r.entity)
  }
}

// Register custom projection
const brain = new Brainy()
await brain.init()
const vfs = brain.vfs()

// Access via VFS internals (will be exposed in future API)
vfs.projectionRegistry.register(new PriorityProjection())

// Now use it!
const highPriority = await vfs.readdir('/by-priority/high')
```

See [PROJECTION_STRATEGY_API.md](./PROJECTION_STRATEGY_API.md) for full guide.

---

## Architecture

### Triple Intelligence™ Foundation

Semantic VFS is built on Brainy's Triple Intelligence™:

```
┌─────────────────────────────────────────┐
│         Semantic VFS Layer              │
├─────────────────────────────────────────┤
│    ProjectionRegistry + Strategies      │
├─────────────────────────────────────────┤
│        SemanticPathResolver             │
├─────────────────────────────────────────┤
│                                         │
│    Triple Intelligence™ (Brainy)        │
│  ┌─────────┬─────────┬─────────────┐  │
│  │ Vector  │  Graph  │  Metadata   │  │
│  │  HNSW   │  Adj    │   B-tree    │  │
│  │ O(log n)│  O(1)   │  O(log n)   │  │
│  └─────────┴─────────┴─────────────┘  │
└─────────────────────────────────────────┘
```

### Real Implementations, Zero Mocks

Every component uses **production Brainy APIs**:
- `brain.find()` - Real metadata queries (brainy.ts:580)
- `brain.similar()` - Real HNSW search (brainy.ts:680)
- `brain.getRelations()` - Real graph traversal (brainy.ts:803)
- `MetadataIndexManager` - Real B-tree indexes
- `GraphAdjacencyIndex` - Real graph storage
- `HNSW Index` - Real vector search

**No mocks. No stubs. No fake code.**

---

## Best Practices

### 1. Use Semantic Paths for Discovery
```typescript
// ❌ Don't hardcode paths
const files = ['/src/auth.ts', '/src/login.ts', '/src/oauth.ts']

// ✅ Discover by concept
const authFiles = await vfs.readdir('/by-concept/authentication')
```

### 2. Tag Strategically
```typescript
// ✅ Good: Clear, actionable tags
await vfs.writeFile(path, code, {
  metadata: { tags: ['security', 'requires-review', 'public-api'] }
})

// ❌ Bad: Vague, redundant tags
await vfs.writeFile(path, code, {
  metadata: { tags: ['code', 'file', 'important'] }
})
```

### 3. Optimize for Your Scale
```typescript
// For < 100K files: Post-filtering is fine
// For > 100K files: Use flattened indexes

// Force index refresh after bulk operations
await brain.storage.rebuildIndexes()
```

### 4. Combine Dimensions
```typescript
// Find security files Alice worked on this week
const aliceFiles = await vfs.readdir('/by-author/alice')
const securityFiles = await vfs.readdir('/by-tag/security')
const thisWeek = await vfs.readdir(`/as-of/${weekAgo}`)

const intersection = aliceFiles
  .filter(f => securityFiles.includes(f))
  .filter(f => thisWeek.includes(f))
```

---

## Troubleshooting

### Concepts Not Being Extracted
```typescript
// Check if concepts are enabled (default: true)
await vfs.writeFile(path, code, { extractConcepts: true })

// Verify concept extraction works
const entity = await vfs.getEntity(path)
console.log(entity.metadata.concepts)
```

### Slow Queries on Large Datasets
```typescript
// Check if indexes are built
const stats = await brain.storage.getIndexStats()
console.log(stats)

// Rebuild if needed
await brain.storage.rebuildIndexes()
```

### Semantic Path Returns Empty
```typescript
// Check if metadata exists
const files = await vfs.readdir('/src')
for (const file of files) {
  const entity = await vfs.getEntity(file.path)
  console.log(entity.metadata)
}
```

---

## What's Next?

- **Natural Language Paths**: `/find "authentication logic"`
- **Intent-Based Access**: `/to-review`, `/to-deploy`
- **Temporal Queries**: `/changed-since/2024-03-01`
- **Custom Dimensions**: Plugin system for domain-specific projections

---

## See Also

- [Projection Strategy API](./PROJECTION_STRATEGY_API.md) - Create custom projections
- [Performance Tuning](./PERFORMANCE_TUNING.md) - Million-scale optimization
- [VFS Core API](./VFS_CORE.md) - Base VFS operations
- [Triple Intelligence™](./TRIPLE_INTELLIGENCE.md) - Underlying architecture