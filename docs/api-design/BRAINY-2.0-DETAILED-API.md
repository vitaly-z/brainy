# 🧠 Brainy 2.0 Detailed API Reference

> **Complete API with full parameter descriptions**

## 📚 CORE DATA OPERATIONS

### Nouns (Vectors with Metadata)

#### `addNoun(textOrVector, metadata?)`
Add a single noun to the database
- **textOrVector**: `string | number[]` - Text to auto-embed OR pre-computed vector
- **metadata**: `object` (optional) - Associated metadata
- **Returns**: `Promise<string>` - The ID of the created noun

#### `getNoun(id)`
Retrieve a single noun by ID
- **id**: `string` - The noun's unique identifier
- **Returns**: `Promise<VectorDocument | null>` - The noun with vector and metadata

#### `updateNoun(id, textOrVector?, metadata?)`
Update an existing noun
- **id**: `string` - The noun's ID to update
- **textOrVector**: `string | number[]` (optional) - New text/vector
- **metadata**: `object` (optional) - New metadata (merged with existing)
- **Returns**: `Promise<void>`

#### `deleteNoun(id)`
Delete a single noun
- **id**: `string` - The noun's ID to delete
- **Returns**: `Promise<boolean>` - True if deleted

#### `hasNoun(id)`
Check if a noun exists
- **id**: `string` - The noun's ID to check
- **Returns**: `Promise<boolean>` - True if exists

#### `getNounMetadata(id)`
Get only the metadata of a noun (no vector)
- **id**: `string` - The noun's ID
- **Returns**: `Promise<object | null>` - Just the metadata

#### `updateNounMetadata(id, metadata)`
Update only the metadata of a noun
- **id**: `string` - The noun's ID
- **metadata**: `object` - New metadata (replaces existing)
- **Returns**: `Promise<void>`

#### `getNounWithVerbs(id)`
Get a noun with all its relationships
- **id**: `string` - The noun's ID
- **Returns**: `Promise<{noun: VectorDocument, verbs: Verb[]}>` - Noun and relationships

#### `addNouns(items[])`
Add multiple nouns in batch
- **items**: `Array<{vector: number[] | string, metadata?: object}>` - Array of nouns
- **Returns**: `Promise<string[]>` - Array of created IDs

#### `getNouns(idsOrOptions)`
Get multiple nouns (unified method)
- **idsOrOptions**: Can be one of:
  - `string[]` - Array of IDs to fetch
  - `{filter: object}` - Filter by metadata fields
  - `{limit: number, offset: number}` - Pagination
- **Returns**: `Promise<VectorDocument[]>` - Array of nouns

#### `deleteNouns(ids[])`
Delete multiple nouns
- **ids**: `string[]` - Array of IDs to delete
- **Returns**: `Promise<boolean[]>` - Success status for each

---

### Verbs (Relationships)

#### `addVerb(source, target, type, metadata?)`
Create a relationship between nouns
- **source**: `string` - Source noun ID
- **target**: `string` - Target noun ID
- **type**: `string` - Relationship type (e.g., 'references', 'contains')
- **metadata**: `object` (optional) - Relationship metadata
- **Returns**: `Promise<string>` - The verb ID

#### `getVerb(id)`
Get a single relationship
- **id**: `string` - The verb's ID
- **Returns**: `Promise<Verb | null>` - The relationship

#### `deleteVerb(id)`
Delete a relationship
- **id**: `string` - The verb's ID
- **Returns**: `Promise<boolean>` - True if deleted

#### `getVerbsBySource(sourceId)`
Get all outgoing relationships from a noun
- **sourceId**: `string` - The source noun's ID
- **Returns**: `Promise<Verb[]>` - Array of relationships

#### `getVerbsByTarget(targetId)`
Get all incoming relationships to a noun
- **targetId**: `string` - The target noun's ID
- **Returns**: `Promise<Verb[]>` - Array of relationships

#### `getVerbsByType(type)`
Get all relationships of a specific type
- **type**: `string` - The relationship type
- **Returns**: `Promise<Verb[]>` - Array of relationships

---

## 🔍 SEARCH & INTELLIGENCE

### Core Search Methods

#### `search(query, k?)`
Simple vector similarity search (convenience wrapper)
- **query**: `string | number[]` - Text query or vector
- **k**: `number` (default: 10) - Number of results
- **Returns**: `Promise<SearchResult[]>` - Ranked results with scores
- **Note**: Equivalent to `find({like: query, limit: k})`

#### `find(query)`
**TRIPLE INTELLIGENCE** - The ultimate search method
- **query**: `object` - Complex query object supporting:
  ```typescript
  {
    // Vector similarity
    like?: string | number[] | {id: string},  // Text, vector, or noun ID
    
    // Field filtering
    where?: {
      field: value,                          // Exact match
      field: {$in: [values]},                // In array
      field: {$gt: value},                   // Greater than
      field: {$regex: pattern}               // Pattern match
    },
    
    // Graph traversal
    connected?: {
      to?: string,                           // Target noun ID
      from?: string,                         // Source noun ID
      via?: string,                          // Relationship type
      depth?: number                         // Traversal depth (default: 1)
    },
    
    // Control
    limit?: number,                          // Max results (default: 10)
    offset?: number,                         // Skip results
    threshold?: number                       // Min similarity score
  }
  ```
- **Returns**: `Promise<EnhancedSearchResult[]>` - Results with scores and explanations

#### `findSimilar(id, k?)`
Find nouns similar to an existing noun
- **id**: `string` - Reference noun ID
- **k**: `number` (default: 10) - Number of results
- **Returns**: `Promise<SearchResult[]>` - Similar nouns

---

### Neural API

#### `neural.search(query, options?)`
Neural-enhanced semantic search
- **query**: `string` - Natural language query
- **options**: `{expand?: boolean, rerank?: boolean}` - Enhancement options
- **Returns**: `Promise<NeuralSearchResult[]>` - Enhanced results

#### `neural.cluster(options?)`
Automatic clustering of nouns
- **options**: `{k?: number, method?: 'kmeans'|'dbscan', minSize?: number}`
- **Returns**: `Promise<Cluster[]>` - Generated clusters

#### `neural.extract(text)`
Extract entities from text
- **text**: `string` - Text to analyze
- **Returns**: `Promise<{entities: Entity[], relationships: Relationship[]}>`

#### `neural.summarize(ids[])`
Generate summary from multiple nouns
- **ids**: `string[]` - Noun IDs to summarize
- **Returns**: `Promise<string>` - Generated summary

#### `neural.analyze(id)`
Deep analysis of a noun
- **id**: `string` - Noun ID to analyze
- **Returns**: `Promise<Analysis>` - Detailed analysis

#### `neural.compare(id1, id2)`
Semantic comparison of two nouns
- **id1**: `string` - First noun ID
- **id2**: `string` - Second noun ID
- **Returns**: `Promise<{similarity: number, differences: string[], commonalities: string[]}>`

#### `neural.topics(options?)`
Topic modeling across all nouns
- **options**: `{k?: number, method?: 'lda'|'nmf'}` - Topic extraction options
- **Returns**: `Promise<Topic[]>` - Discovered topics

#### `neural.patterns(options?)`
Pattern detection in data
- **options**: `{minSupport?: number, minConfidence?: number}`
- **Returns**: `Promise<Pattern[]>` - Detected patterns

---

## 📥 IMPORT/EXPORT

### Neural Import

#### `neuralImport(data, options?)`
Smart AI-powered data import
- **data**: `any` - Data to import (auto-detects format)
- **options**: `{autoExtract?: boolean, autoRelate?: boolean, batchSize?: number}`
- **Returns**: `Promise<{nouns: string[], verbs: string[]}>`

#### `neuralImport.csv(file, options?)`
Import CSV with intelligent parsing
- **file**: `string | Buffer` - CSV file path or content
- **options**: `{headers?: boolean, delimiter?: string, embedColumns?: string[]}`
- **Returns**: `Promise<ImportResult>`

#### `neuralImport.json(data, options?)`
Import JSON with structure detection
- **data**: `object | string` - JSON data or string
- **options**: `{flatten?: boolean, keyPaths?: string[]}`
- **Returns**: `Promise<ImportResult>`

#### `neuralImport.text(text, options?)`
Import text with NLP processing
- **text**: `string` - Raw text
- **options**: `{chunk?: boolean, chunkSize?: number, extractEntities?: boolean}`
- **Returns**: `Promise<ImportResult>`

---

## 🔄 SYNC & DISTRIBUTION

### Real-time Sync

#### `sync.enable(config)`
Enable real-time synchronization
- **config**: `{url: string, interval?: number, bidirectional?: boolean}`
- **Returns**: `Promise<void>`

#### `sync.disable()`
Disable synchronization
- **Returns**: `Promise<void>`

#### `sync.now()`
Trigger manual sync
- **Returns**: `Promise<SyncResult>`

#### `sync.status()`
Get sync status
- **Returns**: `Promise<{enabled: boolean, lastSync: Date, pending: number}>`

---

### Remote Operations

#### `remote.connect(url, options?)`
Connect to remote Brainy instance
- **url**: `string` - Remote instance URL
- **options**: `{auth?: string, timeout?: number, retry?: boolean}`
- **Returns**: `Promise<Connection>`

#### `remote.search(query)`
Search remote instance
- **query**: `any` - Same as find() query
- **Returns**: `Promise<SearchResult[]>`

---

## 🧠 INTELLIGENCE FEATURES

### Verb Scoring

#### `verbScoring.train(feedback)`
Train the verb scoring model
- **feedback**: `{verbId: string, score: number, context?: object}`
- **Returns**: `Promise<void>`

#### `verbScoring.getScore(verbId)`
Get intelligent score for a verb
- **verbId**: `string` - The verb to score
- **Returns**: `Promise<number>` - Score between 0-1

#### `verbScoring.export()`
Export training data
- **Returns**: `Promise<TrainingData>`

#### `verbScoring.import(data)`
Import training data
- **data**: `TrainingData` - Previously exported data
- **Returns**: `Promise<void>`

---

### Embeddings

#### `embed(text)`
Generate embedding vector for text
- **text**: `string` - Text to embed
- **Returns**: `Promise<number[]>` - Embedding vector

#### `embedBatch(texts[])`
Generate embeddings for multiple texts
- **texts**: `string[]` - Array of texts
- **Returns**: `Promise<number[][]>` - Array of vectors

#### `similarity(a, b, metric?)`
Calculate similarity between vectors or texts
- **a**: `string | number[]` - First item
- **b**: `string | number[]` - Second item
- **metric**: `'cosine' | 'euclidean' | 'manhattan'` (default: 'cosine')
- **Returns**: `Promise<number>` - Similarity score

---

## 📊 MONITORING & PERFORMANCE

#### `size()`
Get total noun count
- **Returns**: `number` - Total nouns in database

#### `stats()`
Get comprehensive statistics
- **Returns**: `Promise<Statistics>` - Detailed stats

#### `health()`
System health check
- **Returns**: `Promise<{status: 'healthy'|'degraded'|'unhealthy', details: object}>`

#### `cache.stats()`
Get cache statistics
- **Returns**: `CacheStats` - Hit rates, size, etc.

#### `cache.clear()`
Clear all caches
- **Returns**: `void`

---

## 🚀 LIFECYCLE

#### `new BrainyData(config?)`
Create new Brainy instance
- **config**: `object` (optional)
  ```typescript
  {
    storage?: 'auto' | 'memory' | 'filesystem' | 's3',
    dimensions?: number,              // Vector dimensions (default: 384)
    cache?: boolean,                  // Enable caching (default: true)
    index?: boolean,                  // Enable indexing (default: true)
    verbose?: boolean,                 // Verbose logging (default: false)
    augmentations?: Augmentation[]    // Custom augmentations
  }
  ```

#### `init()`
Initialize the instance (REQUIRED!)
- **Returns**: `Promise<void>`
- **Note**: Must be called before any operations

#### `shutdown()`
Graceful shutdown
- **Returns**: `Promise<void>` - Saves state and closes connections

---

## 📐 READ-ONLY PROPERTIES

- **dimensions**: `number` - Vector dimensions
- **initialized**: `boolean` - Whether init() was called
- **mode**: `string` - Current operational mode