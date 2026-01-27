# 🧠 Brainy 3.0 Complete API Reference

> The neural database that thinks - Complete API documentation for all public methods

## Table of Contents

- [Quick Start](#quick-start)
- [Core API](#core-api)
- [Batch Operations](#batch-operations)
- [Search & Discovery](#search--discovery)
- [Security API](#security-api)
- [Configuration API](#configuration-api)
- [Data Management API](#data-management-api)
- [Query API](#query-api)
- [Neural API](#neural-api)
- [NLP API](#nlp-api)
- [Streaming Pipeline API](#streaming-pipeline-api)
- [Type Definitions](#type-definitions)

---

## Quick Start

```typescript
import { Brainy, NounType, VerbType } from '@soulcraft/brainy'

// Initialize
const brain = new Brainy({
  storage: { type: 'filesystem', path: './brainy-data' },
  model: { type: 'fast', precision: 'Q8' }
})
await brain.init()

// Add entities
const id = await brain.add({
  data: 'John Smith is a software engineer',
  type: NounType.Person,
  metadata: { role: 'engineer' }
})

// Search
const results = await brain.find('engineers')

// Clean up
await brain.close()
```

---

## Core API

### `new Brainy(config?: BrainyConfig)`
Creates a new Brainy instance.

**Parameters:**
- `config` - Optional configuration object

**Returns:** `Brainy` instance

**Example:**
```typescript
const brain = new Brainy({
  storage: { type: 'filesystem', options: { path: './data' } },
  model: { type: 'accurate', precision: 'FP32' },
  cache: { maxSize: 5000, ttl: 600000 }
})
```

---

### `async init(): Promise<void>`
Initializes the brain, loading models and preparing storage.

**Must be called before any other operations.**

**Example:**
```typescript
await brain.init()
```

---

### `async add(params: AddParams): Promise<string>`
Adds a new entity to the brain.

**Parameters:**
- `data` (required) - Content to embed and store
- `type` (required) - NounType classification
- `metadata` - Custom metadata object
- `id` - Custom ID (auto-generated if not provided)
- `vector` - Pre-computed embedding vector
- `service` - Service name for multi-tenancy
- `confidence` - Type classification confidence (0-1) ✨ *New in v4.3.0*
- `weight` - Entity importance/salience (0-1) ✨ *New in v4.3.0*
- `writeOnly` - Skip validation for high-speed ingestion

**Returns:** Entity ID

**Example:**
```typescript
const id = await brain.add({
  data: 'Important meeting notes from Q4 planning',
  type: NounType.Document,
  metadata: {
    date: '2024-01-15',
    author: 'John Smith',
    tags: ['planning', 'Q4']
  },
  confidence: 0.95,  // High confidence in Document classification
  weight: 0.85       // High importance
})
```

---

### `async get(id: string, options?: GetOptions): Promise<Entity | null>`
Retrieves an entity by ID.

✨ **v5.11.1 Performance Optimization**:
- **Default (metadata-only)**: 76-81% faster, 95% less bandwidth - perfect for VFS, existence checks, metadata access
- **Opt-in vectors**: Use `{ includeVectors: true }` when computing similarity

**Parameters:**
- `id` - Entity ID
- `options` (optional):
  - `includeVectors?: boolean` - Include 384-dim vectors (default: false for 76-81% speedup)

**Returns:** Entity object or null if not found

**Entity Properties:** ✨ *Updated in v4.3.0, v5.11.1*
- `id` - Unique identifier
- `type` - NounType classification
- `data` - Original content
- `metadata` - Custom metadata
- `vector` - Embedding vector (empty array `[]` if includeVectors: false)
- `confidence` - Type classification confidence (0-1)
- `weight` - Entity importance/salience (0-1)
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp
- `service` - Service name (multi-tenancy)

**Example (Metadata-Only - Default, 76-81% faster):**
```typescript
// Perfect for VFS, metadata access, existence checks
const entity = await brain.get('uuid-1234')
if (entity) {
  console.log(entity.type)        // NounType.Document
  console.log(entity.metadata)    // { date: '2024-01-15', ... }
  console.log(entity.vector)      // [] (empty - not loaded for performance)
}
```

**Example (Full Entity with Vectors):**
```typescript
// Use when computing similarity on this specific entity
const entity = await brain.get('uuid-1234', { includeVectors: true })
if (entity) {
  console.log(entity.vector.length)  // 384 (full embeddings loaded)
  // Now can use for similarity calculations
}
```

---

### `async update(params: UpdateParams): Promise<void>`
Updates an existing entity.

**Parameters:**
- `id` (required) - Entity ID to update
- `data` - New content (will re-embed)
- `type` - New type classification
- `metadata` - New or partial metadata
- `merge` - Merge metadata (true) or replace (false), default: true
- `vector` - New embedding vector
- `confidence` - Update type classification confidence ✨ *New in v4.3.0*
- `weight` - Update entity importance/salience ✨ *New in v4.3.0*

**Example:**
```typescript
await brain.update({
  id: 'uuid-1234',
  metadata: { status: 'reviewed' },
  confidence: 0.98,  // Increase confidence after review
  weight: 0.90,      // Boost importance
  merge: true        // Keeps existing metadata, adds status
})
```

---

### `async delete(id: string): Promise<void>`
Deletes an entity and all its relationships.

**Parameters:**
- `id` - Entity ID to delete

**Example:**
```typescript
await brain.delete('uuid-1234')
```

---

### `async relate(params: RelateParams): Promise<string>`
Creates a relationship between two entities.

**Parameters:**
- `from` (required) - Source entity ID
- `to` (required) - Target entity ID
- `type` (required) - VerbType enum value
- `weight` - Relationship strength (0-1), default: 1
- `metadata` - Relationship metadata
- `bidirectional` - Create reverse relationship
- `service` - Service name for multi-tenancy
- `writeOnly` - Skip validation

**Validation:**
- `from` and `to` must be different (no self-referential relationships)
- `type` must be a valid VerbType enum value
- `weight` if provided must be between 0 and 1

**Returns:** Relationship ID

**Example:**
```typescript
const relationId = await brain.relate({
  from: 'person-123',
  to: 'org-456',
  type: VerbType.WorksWith,
  weight: 0.95,
  metadata: { since: '2020-01-01' },
  bidirectional: true
})
```

---

### `async unrelate(id: string): Promise<void>`
Removes a relationship.

**Parameters:**
- `id` - Relationship ID

**Example:**
```typescript
await brain.unrelate('relation-789')
```

---

### `async getRelations(params?: GetRelationsParams): Promise<Relation[]>`
Gets relationships for entities.

**Parameters:**
- `from` - Source entity ID
- `to` - Target entity ID
- `type` - Filter by VerbType(s)
- `limit` - Maximum results (default: 100)
- `offset` - Pagination offset
- `service` - Filter by service

**Example:**
```typescript
// Get all relationships from an entity
const relations = await brain.getRelations({
  from: 'person-123',
  type: [VerbType.WorksWith, VerbType.ReportsTo],
  limit: 50
})
```

---

### `async close(): Promise<void>`
Shuts down the brain, cleaning up resources.

**Example:**
```typescript
await brain.close()
```

---

## Batch Operations

### `async addMany(params: AddManyParams): Promise<BatchResult>`
Adds multiple entities in batch.

**Parameters:**
- `items` (required) - Array of AddParams
- `parallel` - Process in parallel (default: true)
- `chunkSize` - Batch size (default: 100)
- `continueOnError` - Continue if some fail
- `onProgress` - Progress callback

**Returns:** BatchResult with successful/failed counts

**Example:**
```typescript
const result = await brain.addMany({
  items: [
    { data: 'Doc 1', type: NounType.Document },
    { data: 'Doc 2', type: NounType.Document },
    { data: 'Doc 3', type: NounType.Document }
  ],
  parallel: true,
  onProgress: (done, total) => console.log(`${done}/${total}`)
})

console.log(`Added: ${result.successful.length}`)
console.log(`Failed: ${result.failed.length}`)
```

---

### `async updateMany(params: UpdateManyParams): Promise<BatchResult>`
Updates multiple entities in batch.

**Parameters:**
- `updates` (required) - Array of UpdateParams
- `parallel` - Process in parallel
- `continueOnError` - Continue on failures
- `onProgress` - Progress callback

**Example:**
```typescript
const result = await brain.updateMany({
  updates: ids.map(id => ({
    id,
    metadata: { processed: true },
    merge: true
  })),
  parallel: true
})
```

---

### `async deleteMany(params: DeleteManyParams): Promise<BatchResult>`
Deletes multiple entities.

**Parameters:**
- `ids` - Specific IDs to delete
- `type` - Delete all of a type
- `where` - Delete by metadata filter
- `limit` - Maximum to delete (safety limit)
- `onProgress` - Progress callback

**Example:**
```typescript
// Delete specific IDs
await brain.deleteMany({
  ids: ['id1', 'id2', 'id3']
})

// Delete by type
await brain.deleteMany({
  type: NounType.Document,
  where: { status: 'draft' },
  limit: 100
})
```

---

### `async relateMany(params: RelateManyParams): Promise<BatchResult>`
Creates multiple relationships in batch.

**Parameters:**
- `relations` (required) - Array of RelateParams
- `parallel` - Process in parallel
- `continueOnError` - Continue on failures
- `onProgress` - Progress callback

**Example:**
```typescript
const result = await brain.relateMany({
  relations: [
    { from: 'a', to: 'b', type: VerbType.RelatedTo },
    { from: 'b', to: 'c', type: VerbType.DependsOn },
    { from: 'c', to: 'a', type: VerbType.References }
  ]
})
```

---

## Search & Discovery

### `async find(query: string | FindParams): Promise<Result[]>`
Universal search with Triple Intelligence fusion.

**Parameters:**
- `query` - Natural language query or structured params
- `vector` - Direct vector search
- `type` - Filter by NounType(s)
- `where` - Metadata filters
- `connected` - Graph constraints
- `near` - Proximity search
- `fusion` - Fusion strategy and weights
- `limit` - Maximum results
- `offset` - Pagination offset
- `explain` - Include score explanation
- `service` - Filter by service
- `writeOnly` - Skip validation

**Returns:** Array of Result objects with scores

**Result Properties:** ✨ *Enhanced in v4.3.0*
- `id` - Entity ID
- `score` - Relevance score (0-1)
- `type` - Entity type (flattened for convenience) *Enhanced*
- `metadata` - Entity metadata (flattened) *Enhanced*
- `data` - Entity data (flattened) *Enhanced*
- `confidence` - Type classification confidence (flattened) *New*
- `weight` - Entity importance (flattened) *New*
- `entity` - Full Entity object (preserved for backward compatibility)
- `explanation` - Score explanation (if `explain: true`)

**Example:**
```typescript
// Natural language search
const results = await brain.find('recent product launches')

// NEW in v4.3.0: Direct access to flattened fields
console.log(results[0].metadata)    // Direct access (convenient!)
console.log(results[0].confidence)  // Type confidence
console.log(results[0].weight)      // Entity importance

// Backward compatible: Nested access still works
console.log(results[0].entity.metadata)  // Also works

// Structured search with fusion
const results = await brain.find({
  query: 'machine learning',
  type: [NounType.Document, NounType.Project],
  where: { year: 2024 },
  connected: {
    to: 'research-dept',
    via: VerbType.CreatedBy
  },
  fusion: {
    strategy: 'adaptive',
    weights: { vector: 0.5, graph: 0.3, field: 0.2 }
  },
  limit: 20,
  explain: true
})

// Access results with clean, predictable patterns
for (const result of results) {
  console.log(`Score: ${result.score}`)
  console.log(`Type: ${result.type}`)
  console.log(`Confidence: ${result.confidence ?? 'N/A'}`)
  console.log(`Weight: ${result.weight ?? 'N/A'}`)
  console.log(`Metadata:`, result.metadata)
}
```

---

### `async similar(params: SimilarParams): Promise<Result[]>`
Finds similar entities using vector similarity.

**Parameters:**
- `to` (required) - Entity ID, Entity object, or Vector
- `limit` - Maximum results (default: 10)
- `threshold` - Minimum similarity (0-1)
- `type` - Filter by type(s)
- `where` - Metadata filters

**Returns:** Array of Result objects (same structure as `find()`) ✨ *Enhanced in v4.3.0*

**Example:**
```typescript
const similar = await brain.similar({
  to: 'doc-123',
  limit: 5,
  threshold: 0.8,
  type: NounType.Document
})

// NEW in v4.3.0: Access flattened fields directly
for (const result of similar) {
  console.log(`Similarity: ${result.score}`)
  console.log(`Type: ${result.type}`)           // Flattened
  console.log(`Confidence: ${result.confidence}`) // Flattened
  console.log(`Metadata:`, result.metadata)     // Flattened
}
```

---

### `async embed(data: any): Promise<Vector>` ✨ *v7.1.0*
Generates an embedding vector from data.

**Parameters:**
- `data` - Text, array, or object to embed

**Returns:** 384-dimensional embedding vector

**Example:**
```typescript
const vector = await brain.embed('Machine learning concepts')
console.log(vector.length) // 384
```

---

### `async embedBatch(texts: string[]): Promise<number[][]>` ✨ *v7.1.0, Optimized v7.9.0*
Batch embed multiple texts using native WASM batch API (single forward pass).

**Parameters:**
- `texts` - Array of strings to embed

**Returns:** Array of 384-dimensional vectors

> **v7.9.0**: Uses the engine's native `embed_batch()` for a single model forward pass instead of N individual `embed()` calls.

**Example:**
```typescript
const embeddings = await brain.embedBatch([
  'Machine learning is fascinating',
  'Deep neural networks',
  'Natural language processing'
])
console.log(embeddings.length)    // 3
console.log(embeddings[0].length) // 384
```

---

### `async similarity(textA: string, textB: string): Promise<number>` ✨ *v7.1.0*
Calculate semantic similarity between two texts.

**Parameters:**
- `textA` - First text
- `textB` - Second text

**Returns:** Similarity score between 0 (different) and 1 (identical)

**Example:**
```typescript
const score = await brain.similarity(
  'The cat sat on the mat',
  'A feline was resting on the rug'
)
console.log(score) // ~0.85 (high semantic similarity)
```

---

### `async neighbors(entityId: string, options?): Promise<string[]>` ✨ *v7.1.0*
Get graph neighbors of an entity.

**Parameters:**
- `entityId` - Entity to get neighbors for
- `options.direction` - 'outgoing', 'incoming', or 'both' (default: 'both')
- `options.depth` - Traversal depth (default: 1)
- `options.verbType` - Filter by relationship type
- `options.limit` - Maximum neighbors to return

**Returns:** Array of neighbor entity IDs

**Example:**
```typescript
// Get all connected entities
const neighbors = await brain.neighbors(entityId)

// Get outgoing connections only
const outgoing = await brain.neighbors(entityId, {
  direction: 'outgoing',
  limit: 10
})

// Multi-hop traversal
const extended = await brain.neighbors(entityId, {
  depth: 2,
  direction: 'both'
})
```

---

### `async findDuplicates(options?): Promise<DuplicateResult[]>` ✨ *v7.1.0*
Find semantic duplicates in the database.

**Parameters:**
- `options.threshold` - Minimum similarity (default: 0.85)
- `options.type` - Filter by NounType
- `options.limit` - Maximum duplicate groups (default: 100)

**Returns:** Array of duplicate groups with similarity scores

**Example:**
```typescript
// Find all duplicates
const duplicates = await brain.findDuplicates()

for (const group of duplicates) {
  console.log('Original:', group.entity.id)
  for (const dup of group.duplicates) {
    console.log(`  Duplicate: ${dup.entity.id} (${dup.similarity.toFixed(2)})`)
  }
}

// Find person duplicates with higher threshold
const personDupes = await brain.findDuplicates({
  type: NounType.PERSON,
  threshold: 0.9,
  limit: 50
})
```

---

### `async indexStats(): Promise<IndexStats>` ✨ *v7.1.0*
Get comprehensive index statistics.

**Returns:**
- `entities` - Total entity count
- `vectors` - Total vectors in HNSW index
- `relationships` - Total relationships in graph
- `metadataFields` - Indexed metadata fields
- `memoryUsage.vectors` - Vector memory in bytes
- `memoryUsage.graph` - Graph memory in bytes
- `memoryUsage.metadata` - Metadata index memory in bytes
- `memoryUsage.total` - Total memory usage

**Example:**
```typescript
const stats = await brain.indexStats()
console.log(`Entities: ${stats.entities}`)
console.log(`Vectors: ${stats.vectors}`)
console.log(`Relationships: ${stats.relationships}`)
console.log(`Memory: ${(stats.memoryUsage.total / 1024 / 1024).toFixed(1)}MB`)
console.log(`Fields: ${stats.metadataFields.join(', ')}`)
```

---

### `async cluster(options?): Promise<ClusterResult[]>` ✨ *v7.1.0*
Cluster entities by semantic similarity.

Groups entities into clusters based on their embedding similarity using
a greedy algorithm with HNSW-based neighbor lookup.

**Parameters:**
- `options.threshold` - Similarity threshold (default: 0.8)
- `options.type` - Filter by NounType
- `options.minClusterSize` - Minimum entities per cluster (default: 2)
- `options.limit` - Maximum clusters to return (default: 100)
- `options.includeCentroid` - Calculate cluster centroids (default: false)

**Returns:** Array of clusters with entities

**Example:**
```typescript
// Find all clusters
const clusters = await brain.cluster()

for (const cluster of clusters) {
  console.log(`${cluster.clusterId}: ${cluster.entities.length} entities`)
}

// Find document clusters with centroids
const docClusters = await brain.cluster({
  type: NounType.Document,
  threshold: 0.85,
  minClusterSize: 3,
  includeCentroid: true
})

// Use centroids for cluster comparison
for (const cluster of docClusters) {
  console.log(`${cluster.clusterId}: ${cluster.entities.length} entities`)
  if (cluster.centroid) {
    console.log(`  Centroid dimensions: ${cluster.centroid.length}`)
  }
}
```

---

### `async insights(): Promise<InsightsResult>`
Gets statistics and insights about the data.

**Returns:**
- `entities` - Total entity count
- `relationships` - Total relationship count
- `types` - Count by NounType
- `services` - List of services
- `density` - Relationships per entity

**Example:**
```typescript
const insights = await brain.insights()
console.log(`Entities: ${insights.entities}`)
console.log(`Graph density: ${insights.density.toFixed(2)}`)
```

---

### `async suggest(params?: SuggestParams): Promise<Suggestions>`
AI-powered suggestions based on current data.

**Parameters:**
- `context` - Context for suggestions
- `type` - Filter by type(s)
- `limit` - Maximum suggestions per category
- `service` - Filter by service

**Returns:**
- `queries` - Suggested search queries
- `connections` - Suggested relationships
- `insights` - Data insights
- `patterns` - Detected patterns

**Example:**
```typescript
const suggestions = await brain.suggest({
  context: 'product development',
  limit: 5
})

// Use suggestions
for (const query of suggestions.queries) {
  console.log(`Try searching: ${query}`)
}
```

---

## Security API

Access via: `const security = await brain.security()`

### `async encrypt(data: string): Promise<string>`
Encrypts data using AES-256-CBC.

**Example:**
```typescript
const encrypted = await security.encrypt('sensitive data')
```

---

### `async decrypt(encryptedData: string): Promise<string>`
Decrypts previously encrypted data.

**Example:**
```typescript
const decrypted = await security.decrypt(encrypted)
```

---

### `async hash(data: string, algorithm?: 'sha256'|'sha512'): Promise<string>`
Creates cryptographic hash.

**Example:**
```typescript
const hash = await security.hash('password', 'sha512')
```

---

### `async compare(data: string, hash: string): Promise<boolean>`
Compares data against hash (constant-time).

**Example:**
```typescript
const matches = await security.compare('password', hash)
```

---

### `async generateToken(bytes?: number): Promise<string>`
Generates secure random token.

**Example:**
```typescript
const token = await security.generateToken(32)
```

---

### `async deriveKey(password: string, salt?: string): Promise<{key: string, salt: string}>`
Derives key from password using PBKDF2-like iterations.

**Example:**
```typescript
const { key, salt } = await security.deriveKey('userPassword')
```

---

### `async sign(data: string, secret?: string): Promise<string>`
Signs data with HMAC-SHA256.

**Example:**
```typescript
const signature = await security.sign(data, secret)
```

---

### `async verify(data: string, signature: string, secret: string): Promise<boolean>`
Verifies HMAC signature.

**Example:**
```typescript
const valid = await security.verify(data, signature, secret)
```

---

## Storage Configuration

Brainy supports multiple storage backends for different deployment scenarios.

### Storage Types

#### File System Storage (Recommended for Development)
Persistent local storage using the filesystem.

```typescript
const brain = new Brainy({
  storage: {
    type: 'filesystem',
    rootDirectory: './brainy-data'
  }
})
```

#### Amazon S3 Storage
Scalable cloud storage with S3.

```typescript
const brain = new Brainy({
  storage: {
    type: 's3',
    s3Storage: {
      bucketName: 'my-bucket',
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
})
```

#### Cloudflare R2 Storage
Scalable cloud storage with Cloudflare R2 (S3-compatible).

```typescript
const brain = new Brainy({
  storage: {
    type: 'r2',
    r2Storage: {
      bucketName: 'my-bucket',
      accountId: process.env.CF_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  }
})
```

#### Google Cloud Storage (Native SDK) 🆕
**Recommended for GCS deployments.** Uses native `@google-cloud/storage` SDK with automatic authentication.

**Key Benefits:**
- ✅ Application Default Credentials (ADC) - Zero config in Cloud Run/GCE
- ✅ Better performance with native GCS optimizations
- ✅ No HMAC key management required
- ✅ Automatic service account integration

**Option 1: Explicit Type (Recommended)**

With Application Default Credentials (Cloud Run/GCE):
```typescript
const brain = new Brainy({
  storage: {
    type: 'gcs-native',  // ⚠️ Must be 'gcs-native' for native SDK
    gcsNativeStorage: {
      bucketName: 'my-bucket'
      // No credentials needed - ADC automatic!
    }
  }
})
```

With Service Account Key File:
```typescript
const brain = new Brainy({
  storage: {
    type: 'gcs-native',
    gcsNativeStorage: {
      bucketName: 'my-bucket',
      keyFilename: '/path/to/service-account.json'
    }
  }
})
```

With Service Account Credentials Object:
```typescript
const brain = new Brainy({
  storage: {
    type: 'gcs-native',
    gcsNativeStorage: {
      bucketName: 'my-bucket',
      credentials: {
        client_email: 'service@project.iam.gserviceaccount.com',
        private_key: process.env.GCS_PRIVATE_KEY
      }
    }
  }
})
```

**Option 2: Auto-Detection**

You can omit the `type` field and let Brainy auto-detect based on the config object:
```typescript
const brain = new Brainy({
  storage: {
    gcsNativeStorage: {
      bucketName: 'my-bucket'
      // type defaults to 'auto', will use native SDK
    }
  }
})
```

#### Google Cloud Storage (S3-Compatible) - Legacy
GCS using HMAC keys for S3-compatible access. **Consider migrating to 'gcs-native' for better performance.**

```typescript
const brain = new Brainy({
  storage: {
    type: 'gcs',  // ⚠️ Must be 'gcs' for S3-compatible mode
    gcsStorage: {  // ⚠️ Must use 'gcsStorage' (not 'gcsNativeStorage')
      bucketName: 'my-bucket',
      region: 'us-central1',
      accessKeyId: process.env.GCS_ACCESS_KEY_ID,
      secretAccessKey: process.env.GCS_SECRET_ACCESS_KEY,
      endpoint: 'https://storage.googleapis.com'
    }
  }
})
```

**⚠️ Common Mistakes:**
```typescript
// ❌ WRONG - type/config mismatch (will fall back to memory storage)
{
  type: 'gcs',
  gcsNativeStorage: { bucketName: 'my-bucket' }
}

// ❌ WRONG - type/config mismatch (will fall back to memory storage)
{
  type: 'gcs-native',
  gcsStorage: { bucketName: 'my-bucket', accessKeyId: '...', secretAccessKey: '...' }
}

// ✅ CORRECT - type matches config object
{
  type: 'gcs-native',
  gcsNativeStorage: { bucketName: 'my-bucket' }
}

// ✅ CORRECT - auto-detection
{
  gcsNativeStorage: { bucketName: 'my-bucket' }
}
```

### Storage Features

All storage adapters support:
- ✅ **UUID-based sharding** - 256 buckets (00-ff) for scalability
- ✅ **Pagination** - Efficient cursor-based pagination across shards
- ✅ **Statistics** - O(1) count operations
- ✅ **Caching** - Multi-level cache for performance
- ✅ **Backpressure** - Automatic flow control
- ✅ **Throttling detection** - Adaptive retry on rate limits

### Migration from HMAC to Native GCS

If you're currently using `type: 'gcs'` with HMAC keys, migrating to `type: 'gcs-native'` is straightforward:

**Before (S3-Compatible with HMAC):**
```typescript
const brain = new Brainy({
  storage: {
    type: 'gcs',              // ⚠️ Old: S3-compatible mode
    gcsStorage: {              // ⚠️ Old: HMAC credentials
      bucketName: 'my-bucket',
      accessKeyId: process.env.GCS_ACCESS_KEY_ID,
      secretAccessKey: process.env.GCS_SECRET_ACCESS_KEY
    }
  }
})
```

**After (Native SDK with ADC):**
```typescript
const brain = new Brainy({
  storage: {
    type: 'gcs-native',        // ✅ New: Native SDK mode
    gcsNativeStorage: {        // ✅ New: ADC authentication
      bucketName: 'my-bucket'
      // ADC handles authentication automatically
    }
  }
})
```

**⚠️ Important Migration Notes:**

1. **Change BOTH the type AND the config object:**
   - `type: 'gcs'` → `type: 'gcs-native'`
   - `gcsStorage` → `gcsNativeStorage`

2. **Remove HMAC keys** - Not needed with ADC:
   - Remove `accessKeyId`
   - Remove `secretAccessKey`
   - Remove `region` (optional with native SDK)

3. **Set up ADC in your environment:**
   ```bash
   # Cloud Run/GCE: Nothing needed, ADC is automatic

   # Local development:
   gcloud auth application-default login

   # Or set GOOGLE_APPLICATION_CREDENTIALS:
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
   ```

**Data Migration:**
✅ **No data migration required!** Both adapters use the same path structure:
- `entities/nouns/vectors/{shard}/{id}.json`
- `entities/nouns/metadata/{shard}/{id}.json`
- `entities/verbs/vectors/{shard}/{id}.json`

Simply change your code and restart your application. Existing data will work immediately.

---

## Configuration API

Access via: `const config = await brain.config()`

### `async set(params): Promise<void>`
Sets configuration value.

**Parameters:**
- `key` (required) - Configuration key
- `value` (required) - Value to store
- `encrypt` - Encrypt value

**Example:**
```typescript
await config.set({
  key: 'api.key',
  value: 'secret-key-123',
  encrypt: true
})
```

---

### `async get(params): Promise<any>`
Gets configuration value.

**Parameters:**
- `key` (required) - Configuration key
- `decrypt` - Decrypt if encrypted
- `defaultValue` - Default if not found

**Example:**
```typescript
const apiKey = await config.get({
  key: 'api.key',
  decrypt: true,
  defaultValue: 'default-key'
})
```

---

### `async delete(key: string): Promise<void>`
Deletes configuration key.

---

### `async list(): Promise<string[]>`
Lists all configuration keys.

---

### `async has(key: string): Promise<boolean>`
Checks if key exists.

---

### `async clear(): Promise<void>`
Clears all configuration.

---

### `async export(): Promise<Record<string, ConfigEntry>>`
Exports all configuration.

---

### `async import(config: Record<string, ConfigEntry>): Promise<void>`
Imports configuration.

---

## Data Management API

Access via: `const data = await brain.data()`

### `async backup(options?: BackupOptions): Promise<BackupData>`
Creates backup of all data.

**Parameters:**
- `includeVectors` - Include embeddings (default: true)
- `compress` - Compress backup (default: false)

**Example:**
```typescript
const backup = await data.backup({
  includeVectors: true,
  compress: true
})
// Save backup to file
fs.writeFileSync('backup.json', JSON.stringify(backup))
```

---

### `async restore(params): Promise<void>`
Restores from backup.

**Parameters:**
- `backup` (required) - Backup data
- `merge` - Merge with existing data
- `overwrite` - Overwrite conflicts
- `validate` - Validate backup format

**Example:**
```typescript
const backup = JSON.parse(fs.readFileSync('backup.json'))
await data.restore({
  backup,
  merge: false,
  overwrite: true
})
```

---

### `async clear(params): Promise<void>`
Clears specified data types.

**Parameters:**
- `entities` - Clear entities
- `relations` - Clear relationships
- `config` - Clear configuration

**Example:**
```typescript
await data.clear({
  entities: true,
  relations: true
})
```

---

### `async import(params): Promise<ImportResult>`
Imports data from various formats with automatic detection.

**Parameters:**
- `data` (required) - Data to import (Buffer, string, array, or file path)
- `format` - 'auto' | 'json' | 'csv' | 'excel' | 'pdf' | 'yaml' | 'text' (default: 'auto')
- `mapping` - Field mapping configuration
- `batchSize` - Import batch size (default: 50)
- `validate` - Validate items before import
- `relationships` - Extract relationships automatically (default: true)

**CSV-specific options:**
- `csvDelimiter` - Column delimiter (auto-detected if not specified)
- `csvHeaders` - First row contains headers (default: true)
- `encoding` - Character encoding (auto-detected if not specified)

**Excel-specific options:**
- `excelSheets` - Sheet names array or 'all' for all sheets

**PDF-specific options:**
- `pdfExtractTables` - Extract tables from PDFs (default: true)
- `pdfPreserveLayout` - Preserve text layout (default: true)

**Examples:**
```typescript
// Import CSV file with auto-detection
const csvResult = await brain.import('customers.csv')
// Auto-detects: format, encoding, delimiter, field types

// Import Excel workbook
const excelResult = await brain.import('sales-data.xlsx', {
  excelSheets: ['Q1', 'Q2']  // Import specific sheets
})

// Import PDF with table extraction
const pdfResult = await brain.import('report.pdf', {
  pdfExtractTables: true
})

// Import data array
const dataResult = await brain.import([
  { name: 'Alice', role: 'Engineer' },
  { name: 'Bob', role: 'Designer' }
], {
  batchSize: 100,
  relationships: true  // Auto-extract relationships
})

// Import with custom CSV delimiter
const tsvResult = await brain.import('data.tsv', {
  format: 'csv',
  csvDelimiter: '\t'
})
```

**Returns:**
```typescript
{
  success: boolean
  imported: number      // Number of items successfully imported
  failed: number        // Number of items that failed
  entityIds: string[]   // IDs of created entities
  metadata: {
    format: string      // Detected format
    encoding?: string   // Detected encoding (CSV)
    delimiter?: string  // Detected delimiter (CSV)
    sheets?: string[]   // Processed sheets (Excel)
    pageCount?: number  // Number of pages (PDF)
  }
}
```

---

### `async export(params?: ExportOptions): Promise<any>`
Exports data in various formats.

**Parameters:**
- `format` - 'json' | 'csv' | 'parquet'
- `filter` - Filter options
- `includeVectors` - Include embeddings

**Example:**
```typescript
const exported = await data.export({
  format: 'csv',
  where: { type: NounType.Document },
  includeVectors: false
})
```

---

### `getStats(): StatsResult`
Gets complete statistics about entities and relationships. All stats are **O(1) pre-calculated** - updated when entities/relationships are added/removed.

**Returns:**
```typescript
{
  entities: {
    total: number                      // Total entity count
    byType: Record<string, number>     // Entity count by type
  }
  relationships: {
    totalRelationships: number         // Total relationship/edge count
    relationshipsByType: Record<string, number>  // Relationship count by type
    uniqueSourceNodes: number          // Number of unique source entities
    uniqueTargetNodes: number          // Number of unique target entities
    totalNodes: number                 // Total unique entities in relationships
  }
  density: number  // Relationships per entity ratio
}
```

**Example:**
```typescript
const stats = brain.getStats()

// Total counts (O(1) operations)
const totalNouns = stats.entities.total
const totalVerbs = stats.relationships.totalRelationships
const totalRelations = stats.relationships.totalRelationships  // alias

// Counts by type (O(1) operations)
const nounTypes = stats.entities.byType
const verbTypes = stats.relationships.relationshipsByType

// Graph metrics
console.log(`Entities: ${totalNouns}`)
console.log(`Relationships: ${totalVerbs}`)
console.log(`Density: ${stats.density.toFixed(2)}`)
console.log(`Types:`, Object.keys(nounTypes))
```

**Performance:**
- ✅ All counts pre-calculated in memory
- ✅ O(1) access time
- ✅ Updated automatically on add/remove
- ✅ No expensive full scans required

**Note:** For more granular counting operations, see the `brain.counts` API below.

---

## Query API

Access via: `brain.query`

### `async entities(params?): Promise<PaginatedResult<Entity>>`
Query entities with pagination.

**Parameters:**
- `type` - Filter by type
- `where` - Metadata filters
- `limit` - Page size
- `cursor` - Pagination cursor
- `service` - Filter by service

**Example:**
```typescript
const result = await brain.query.entities({
  type: NounType.Document,
  where: { status: 'published' },
  limit: 50
})

// Get next page
if (result.nextCursor) {
  const nextPage = await brain.query.entities({
    cursor: result.nextCursor
  })
}
```

---

### `async relations(params?): Promise<PaginatedResult<Relation>>`
Query relationships with pagination.

**Parameters:**
- `from` - Source entity
- `to` - Target entity
- `type` - Relationship type
- `limit` - Page size
- `cursor` - Pagination cursor

---

## Neural API

Access via: `brain.neural()`

### Similarity Operations

#### `async similar(a, b, options?): Promise<SimilarityResult>`
Calculates similarity between items.

**Example:**
```typescript
const similarity = await neural.similar('doc1', 'doc2', {
  explain: true
})
```

---

### Clustering Operations

#### `async clusters(options?): Promise<SemanticCluster[]>`
General purpose clustering.

**Parameters:**
- `algorithm` - 'hierarchical' | 'kmeans' | 'dbscan' | 'spectral'
- `k` - Number of clusters (for kmeans)
- `threshold` - Distance threshold
- `minPoints` - Minimum points per cluster

**Example:**
```typescript
const clusters = await neural.clusters({
  algorithm: 'kmeans',
  k: 5
})
```

---

#### `async clustersByDomain(params): Promise<SemanticCluster[]>`
Domain-specific clustering.

**Example:**
```typescript
const clusters = await neural.clustersByDomain({
  domain: 'technology',
  field: 'category',
  maxClusters: 10
})
```

---

### Outlier Detection

#### `async outliers(options?): Promise<OutlierResult[]>`
Detects anomalous entities.

**Parameters:**
- `method` - 'isolation' | 'lof' | 'statistical' | 'autoencoder'
- `threshold` - Outlier threshold (default: 2.5 std deviations)
- `returnScores` - Return anomaly scores

**Example:**
```typescript
const outliers = await neural.outliers({
  method: 'isolation',
  threshold: 3.0,
  returnScores: true
})
```

---

### Visualization

#### `async visualize(options?): Promise<VisualizationData>`
Generates visualization data for entities.

**Parameters:**
- `layout` - 'force' | 'circular' | 'hierarchical' | 'random'
- `dimensions` - 2D or 3D
- `includeEdges` - Include relationships

**Example:**
```typescript
const vizData = await neural.visualize({
  layout: 'force',
  dimensions: 3,
  includeEdges: true
})
```

---

## NLP API

Access via: `brain.nlp()`

### `async processNaturalQuery(query: string): Promise<TripleQuery>`
Converts natural language to structured query.

**Example:**
```typescript
const structured = await nlp.processNaturalQuery(
  "Find all documents about AI created last month"
)
// Returns structured query with type, time filters, etc.
```

---

### `async extract(text: string, options?): Promise<ExtractedEntity[]>`
Extracts entities from text using neural matching to NounTypes.

**Parameters:**
- `types` - Target NounTypes to extract
- `confidence` - Minimum confidence (0-1)
- `includeVectors` - Include embeddings
- `neuralMatching` - Use neural type matching (default: true)

**Returns:** Array of extracted entities with proper NounType classification

**Example:**
```typescript
const entities = await nlp.extract(
  "John Smith from Microsoft visited New York on Jan 15",
  {
    types: [NounType.Person, NounType.Organization, NounType.Location],
    confidence: 0.7,
    neuralMatching: true
  }
)
// Returns:
// [
//   { text: "John Smith", type: NounType.Person, confidence: 0.92 },
//   { text: "Microsoft", type: NounType.Organization, confidence: 0.88 },
//   { text: "New York", type: NounType.Location, confidence: 0.85 }
// ]
```

---

### `async sentiment(text: string, options?): Promise<SentimentResult>`
Analyzes text sentiment.

**Parameters:**
- `granularity` - 'document' | 'sentence' | 'aspect'
- `aspects` - Aspects to analyze

**Returns:**
- `overall` - Document sentiment (-1 to 1)
- `sentences` - Sentence-level sentiment
- `aspects` - Aspect-based sentiment

**Example:**
```typescript
const sentiment = await nlp.sentiment(
  "The product quality is excellent but the price is too high",
  {
    granularity: 'aspect',
    aspects: ['quality', 'price']
  }
)
// Returns:
// overall: { score: 0.2, label: 'mixed' }
// aspects: {
//   quality: { score: 0.9, magnitude: 0.8 },
//   price: { score: -0.7, magnitude: 0.7 }
// }
```

---

## Streaming Pipeline API

Access via: `brain.stream()`

### Source Operations

#### `source(generator): Pipeline`
Sets data source.

**Example:**
```typescript
async function* dataGenerator() {
  for (let i = 0; i < 100; i++) {
    yield { id: i, data: `Item ${i}` }
  }
}

brain.stream()
  .source(dataGenerator())
  .map(item => item.data)
  .sink(console.log)
  .run()
```

---

### Transform Operations

#### `map(fn): Pipeline`
Transforms each item.

#### `flatMap(fn): Pipeline`
Maps and flattens arrays.

#### `filter(predicate): Pipeline`
Filters items.

#### `tap(fn): Pipeline`
Side effects without modification.

#### `retry(fn, maxRetries?, backoff?): Pipeline`
Retries failed operations.

---

### Batching & Windowing

#### `batch(size, timeoutMs?): Pipeline`
Groups items into batches.

#### `window(size, type?): Pipeline`
Creates sliding or tumbling windows.

#### `buffer(size, strategy?): Pipeline`
Buffers with backpressure handling.

---

### Sink Operations

#### `sink(handler): Pipeline`
Custom sink handler.

#### `toBrainy(options?): Pipeline`
Sinks data to Brainy.

**Example:**
```typescript
brain.stream()
  .source(dataSource)
  .map(transform)
  .batch(100)
  .toBrainy({
    type: NounType.Document,
    metadata: { source: 'stream' }
  })
  .run()
```

---

### Execution

#### `run(options?): Promise<void>`
Executes the pipeline.

**Parameters:**
- `workers` - Number of workers or 'auto'
- `monitoring` - Enable monitoring
- `maxThroughput` - Rate limiting
- `backpressure` - 'drop' | 'buffer' | 'pause'
- `errorHandler` - Error callback

---

## Type Definitions

### Entity Types (NounType)
31 types including:
- `Person`, `Organization`, `Location`
- `Document`, `File`, `Message`, `Content`
- `Product`, `Service`, `Resource`
- `Event`, `Task`, `Project`, `Process`
- `User`, `Role`, `State`
- `Concept`, `Topic`, `Hypothesis`
- And more...

### Relationship Types (VerbType)
40 types including:
- `RelatedTo`, `Contains`, `PartOf`
- `Creates`, `Modifies`, `Transforms`
- `DependsOn`, `Requires`, `Uses`
- `Owns`, `BelongsTo`, `MemberOf`
- `Supervises`, `ReportsTo`, `WorksWith`
- And more...

### Core Interfaces

✨ *Updated in v4.3.0 - Added confidence/weight to Entity, flattened Result fields*

```typescript
interface Entity<T = any> {
  id: string
  vector: Vector
  type: NounType
  data?: any
  metadata?: T
  service?: string
  createdAt: number
  updatedAt?: number
  confidence?: number  // NEW: Type classification confidence (0-1)
  weight?: number      // NEW: Entity importance/salience (0-1)
}

interface Relation<T = any> {
  id: string
  from: string
  to: string
  type: VerbType
  weight?: number
  confidence?: number  // Relationship confidence
  metadata?: T
  evidence?: RelationEvidence  // Why this relationship exists
  service?: string
  createdAt: number
}

interface Result<T = any> {
  // Search metadata
  id: string
  score: number

  // NEW: Flattened entity fields for convenience
  type?: NounType
  metadata?: T
  data?: any
  confidence?: number
  weight?: number

  // Full entity (backward compatible)
  entity: Entity<T>

  // Score explanation
  explanation?: ScoreExplanation
}
```

**Key Changes in v4.3.0:**
- ✅ `Entity` now exposes `confidence` and `weight`
- ✅ `Result` flattens commonly-used entity fields to top level
- ✅ Direct access: `result.metadata` instead of `result.entity.metadata`
- ✅ Backward compatible: `result.entity` still available

---

## Performance Characteristics

### Speed Benchmarks
- **Add entity**: ~5-10ms (with embedding)
- **Vector search**: ~1-5ms for 1M entities
- **Graph traversal**: ~10-20ms (2-hop)
- **Batch operations**: 1000+ items/second

### Scalability
- **Entities**: Tested to 10M+
- **Relationships**: Tested to 100M+
- **Concurrent operations**: 1000+ parallel
- **Memory usage**: ~1GB per million entities

### Storage Requirements
- **Per entity**: ~2KB (with vector)
- **Per relationship**: ~200 bytes
- **Indexes**: ~20% overhead

---

## Best Practices

### 1. Always Initialize
```typescript
const brain = new Brainy()
await brain.init() // Required before operations
```

### 2. Use Proper Types
```typescript
// ✅ Good - specific type
await brain.add({ data: 'John', type: NounType.Person })

// ❌ Bad - generic type
await brain.add({ data: 'John', type: NounType.Thing })
```

### 3. Batch When Possible
```typescript
// ✅ Good - batch operation
await brain.addMany({ items: documents })

// ❌ Bad - individual adds in loop
for (const doc of documents) {
  await brain.add(doc) // Slow!
}
```

### 4. Use Write-Only for Speed
```typescript
// For high-speed ingestion
await brain.add({
  data: content,
  type: NounType.Document,
  writeOnly: true // Skip validation
})
```

### 5. Clean Up Resources
```typescript
try {
  // Your operations
} finally {
  await brain.close() // Always close
}
```

---

## Input Validation

Brainy uses a **zero-config validation system** that automatically adapts to your system resources:

### Auto-Configured Limits
- `limit` parameter maximum: Based on available memory (e.g., 8GB RAM = 80K max limit)
- Query string length: Auto-scaled based on memory
- Vector dimensions: Must be exactly 384 for all-MiniLM-L6-v2 model

### Common Validation Rules
- **Pagination**: `limit` and `offset` must be non-negative
- **Thresholds**: Values like `weight` and `threshold` must be between 0 and 1
- **Mutual Exclusion**: Cannot use both `query` and `vector` in same request
- **Type Safety**: `NounType` and `VerbType` must be valid enum values
- **Self-Reference**: Cannot create relationships from an entity to itself

### Performance Auto-Tuning
The validation system monitors query performance and adjusts limits automatically:
- Fast queries with large results → increases limits
- Slow queries → reduces limits to maintain performance

## Error Handling

All methods validate parameters and throw descriptive errors:

```typescript
try {
  await brain.add({ data: '', type: NounType.Document })
} catch (error) {
  // Error: "must provide either data or vector"
}

try {
  await brain.find({ limit: -1 })
} catch (error) {
  // Error: "limit must be non-negative"
}

try {
  await brain.update({ id: 'xyz', metadata: null, merge: false })
} catch (error) {
  // Error: "must specify at least one field to update"
  // Note: Use metadata: {} to clear, not null
}
```

---

## Migration from v2

### Old (v2.15)
```typescript
brain.add({ data, type: NounType.Document, metadata })
brain.find({ query, limit: 10 })
brain.insights()
```

### New (v3.0)
```typescript
brain.add({ data, type: NounType.Document, metadata })
brain.find({ query, limit: 10 })
brain.insights()
```

---

## Support

- **GitHub**: https://github.com/soulcraft/brainy
- **NPM**: https://www.npmjs.com/package/@soulcraft/brainy
- **Discord**: https://discord.gg/brainy

---

*Brainy v3.0 - The Neural Database That Thinks*