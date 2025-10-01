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
  storage: { type: 'memory' },
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
  }
})
```

---

### `async get(id: string): Promise<Entity | null>`
Retrieves an entity by ID.

**Parameters:**
- `id` - Entity ID

**Returns:** Entity object or null if not found

**Example:**
```typescript
const entity = await brain.get('uuid-1234')
if (entity) {
  console.log(entity.type)     // NounType.Document
  console.log(entity.metadata)  // { date: '2024-01-15', ... }
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

**Example:**
```typescript
await brain.update({
  id: 'uuid-1234',
  metadata: { status: 'reviewed' },
  merge: true  // Keeps existing metadata, adds status
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

**Example:**
```typescript
// Natural language search
const results = await brain.find('recent product launches')

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

**Example:**
```typescript
const similar = await brain.similar({
  to: 'doc-123',
  limit: 5,
  threshold: 0.8,
  type: NounType.Document
})
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

### `async getStats(): Promise<StorageStats>`
Gets storage statistics.

**Returns:**
- `entities` - Entity count
- `relations` - Relationship count
- `storageSize` - Storage size in bytes
- `vectorDimensions` - Embedding dimensions

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

```typescript
interface Entity<T = any> {
  id: string
  vector: Vector
  type: NounType
  metadata?: T
  service?: string
  createdAt: number
  updatedAt?: number
}

interface Relation<T = any> {
  id: string
  from: string
  to: string
  type: VerbType
  weight?: number
  metadata?: T
  service?: string
  createdAt: number
}

interface Result<T = any> {
  id: string
  score: number
  entity: Entity<T>
  explanation?: ScoreExplanation
}
```

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