# 🧠 Brainy 2.0 API Reference

> **The definitive API documentation for Brainy 2.0**  
> Clean • Powerful • Zero-Configuration

## Quick Start

```typescript
import { BrainyData } from '@soulcraft/brainy'

const brain = new BrainyData()  // Zero config!
await brain.init()

// Add data (text auto-embeds!)
await brain.add('The future of AI is here', { nounType: 'content' })

// Search with Triple Intelligence
const results = await brain.find({
  like: 'artificial intelligence',
  where: { year: { greaterThan: 2020 } },
  connected: { via: 'references' }
})
```

## Core Concepts

### 🧬 Nouns
Vectors with metadata - the fundamental data unit in Brainy.

### 🔗 Verbs  
Relationships between nouns - the connections that create knowledge graphs.

### 🧠 Triple Intelligence
Vector search + Graph traversal + Metadata filtering in one unified query.

---

## API Reference

### Data Operations

#### Nouns (Vectors with Metadata)

##### `addNoun(dataOrVector, metadata?)`
Add a single noun to the database.
- **dataOrVector**: `string | number[]` - Text (auto-embeds) or pre-computed vector
- **metadata**: `object` - Associated metadata
- **Returns**: `Promise<string>` - The noun's ID

##### `getNoun(id)`
Retrieve a noun by ID.
- **id**: `string` - The noun's ID
- **Returns**: `Promise<VectorDocument | null>`

##### `updateNoun(id, dataOrVector?, metadata?)`
Update an existing noun.
- **id**: `string` - The noun's ID
- **dataOrVector**: `string | number[]` - New data/vector (optional)
- **metadata**: `object` - New metadata (optional)
- **Returns**: `Promise<void>`

##### `deleteNoun(id)`
Delete a noun.
- **id**: `string` - The noun's ID
- **Returns**: `Promise<boolean>`

##### `getNouns(options)`
Get multiple nouns (unified method).
- **options**: Can be:
  - `string[]` - Array of IDs
  - `{where: object}` - Metadata filter
  - `{limit: number, offset: number}` - Pagination
- **Returns**: `Promise<VectorDocument[]>`

#### Verbs (Relationships)

##### `addVerb(source, target, type, metadata?)`
Create a relationship between nouns.
- **source**: `string` - Source noun ID
- **target**: `string` - Target noun ID
- **type**: `string` - Relationship type
- **metadata**: `object` - Relationship metadata (optional)
- **Returns**: `Promise<string>` - The verb's ID

##### `getVerbsBySource(sourceId)`
Get all outgoing relationships.
- **sourceId**: `string` - Source noun ID
- **Returns**: `Promise<Verb[]>`

##### `getVerbsByTarget(targetId)`
Get all incoming relationships.
- **targetId**: `string` - Target noun ID
- **Returns**: `Promise<Verb[]>`

---

### Search Operations

#### `search(query, k?)`
Simple vector similarity search.
- **query**: `string | number[]` - Text or vector
- **k**: `number` - Number of results (default: 10)
- **Returns**: `Promise<SearchResult[]>`

> 💡 This is equivalent to: `find({like: query, limit: k})`

#### `find(query)` - Triple Intelligence 🧠
The ultimate search method combining vector, graph, and metadata search.

```typescript
find({
  // Vector similarity
  like: 'text query' | vector | {id: 'noun-id'},
  
  // Metadata filtering (Brainy operators)
  where: {
    field: value,                    // Exact match
    field: {
      equals: value,
      greaterThan: value,
      lessThan: value,
      greaterEqual: value,
      lessEqual: value,
      oneOf: [val1, val2],          // In array
      notOneOf: [val1, val2],       // Not in array
      contains: value,              // Array/string contains
      startsWith: value,
      endsWith: value,
      matches: /pattern/,           // Pattern match
      between: [min, max]
    }
  },
  
  // Graph traversal
  connected: {
    to: 'noun-id',                  // Target noun
    from: 'noun-id',                // Source noun  
    via: 'relationship-type',       // Relationship type
    depth: 2                        // Traversal depth
  },
  
  // Control
  limit: 10,                        // Max results
  offset: 0,                        // Skip results
  explain: false                    // Include explanation
})
```

---

### Neural API

Access advanced AI features via `brain.neural`:

#### `brain.neural.similar(a, b)`
Calculate semantic similarity between two items.
- **Returns**: `Promise<number>` - Similarity score (0-1)

#### `brain.neural.clusters(options?)`
Automatically cluster nouns.
- **Returns**: `Promise<Cluster[]>` - Generated clusters

#### `brain.neural.hierarchy(id)`
Build semantic hierarchy from a noun.
- **Returns**: `Promise<HierarchyTree>` - Hierarchy structure

#### `brain.neural.neighbors(id, k?)`
Find k-nearest neighbors.
- **Returns**: `Promise<Noun[]>` - Nearest neighbors

#### `brain.neural.outliers(threshold?)`
Detect outlier nouns.
- **Returns**: `Promise<string[]>` - Outlier IDs

#### `brain.neural.visualize(options?)`
Generate visualization data for external tools.
```typescript
visualize({
  maxNodes: 100,
  dimensions: 2 | 3,
  algorithm: 'force' | 'hierarchical' | 'radial',
  includeEdges: true
})
// Returns format for D3, Cytoscape, or GraphML
```

---

### Import & Export

#### `neuralImport(data, options?)`
AI-powered smart import that auto-detects format.
- **data**: `any` - Data to import
- **options**: Import configuration
  - `confidenceThreshold`: Minimum confidence (0-1)
  - `autoApply`: Automatically add to database
  - `skipDuplicates`: Skip existing entities
- **Returns**: Detected entities and relationships

#### `backup()`
Create a full backup.
- **Returns**: `Promise<BackupData>`

#### `restore(backup)`
Restore from backup.
- **backup**: `BackupData` - Previous backup
- **Returns**: `Promise<void>`

---

### Intelligence Features

#### Verb Scoring
Train the relationship scoring model:
- `provideFeedbackForVerbScoring(feedback)` - Train model
- `getVerbScoringStats()` - Get statistics
- `exportVerbScoringLearningData()` - Export training
- `importVerbScoringLearningData(data)` - Import training

#### Embeddings
- `embed(text)` - Generate embedding vector
- `calculateSimilarity(a, b, metric?)` - Calculate similarity

---

### Configuration & Management

#### Operational Modes
- `setReadOnly(bool)` - Toggle read-only mode
- `setWriteOnly(bool)` - Toggle write-only mode  
- `setFrozen(bool)` - Freeze all modifications

#### Cache & Performance
- `getCacheStats()` - Get cache statistics
- `clearCache()` - Clear search cache
- `size()` - Get total noun count
- `getStatistics()` - Get full statistics

#### Data Management
- `clear(options?)` - Clear all data
- `clearNouns()` - Clear nouns only
- `clearVerbs()` - Clear verbs only
- `rebuildMetadataIndex()` - Rebuild index

---

### Lifecycle

#### Initialization
```typescript
const brain = new BrainyData({
  storage: 'auto',        // auto | memory | filesystem | s3
  dimensions: 384,        // Vector dimensions
  cache: true,           // Enable caching
  index: true           // Enable indexing
})

await brain.init()       // Required before use!
```

#### Cleanup
```typescript
await brain.shutdown()   // Graceful shutdown
```

#### Static Methods
- `BrainyData.preloadModel()` - Preload ML model
- `BrainyData.warmup()` - Warmup system

---

## Query Operators Reference

Brainy uses its own clean, readable operators:

| Brainy Operator | Description | Example |
|-----------------|-------------|---------|
| `equals` | Exact match | `{age: {equals: 25}}` |
| `greaterThan` | Greater than | `{age: {greaterThan: 18}}` |
| `lessThan` | Less than | `{price: {lessThan: 100}}` |
| `greaterEqual` | Greater or equal | `{score: {greaterEqual: 90}}` |
| `lessEqual` | Less or equal | `{rating: {lessEqual: 3}}` |
| `oneOf` | In array | `{color: {oneOf: ['red', 'blue']}}` |
| `notOneOf` | Not in array | `{status: {notOneOf: ['deleted']}}` |
| `contains` | Contains value | `{tags: {contains: 'ai'}}` |
| `startsWith` | String prefix | `{name: {startsWith: 'John'}}` |
| `endsWith` | String suffix | `{email: {endsWith: '@gmail.com'}}` |
| `matches` | Pattern match | `{text: {matches: /^[A-Z]/}}` |
| `between` | Range | `{year: {between: [2020, 2024]}}` |

---

## Examples

### Basic Usage
```typescript
// Add data
const id = await brain.add('Quantum computing breakthrough', {
  category: 'technology',
  year: 2024,
  importance: 'high'
})

// Simple search
const results = await brain.search('quantum physics', 5)

// Complex query with Triple Intelligence
const articles = await brain.find({
  like: 'quantum computing',
  where: {
    year: { greaterThan: 2022 },
    importance: { oneOf: ['high', 'critical'] }
  },
  connected: {
    via: 'references',
    depth: 2
  },
  limit: 10
})
```

### Creating Knowledge Graphs
```typescript
// Add entities
const ai = await brain.add('Artificial Intelligence', { nounType: 'concept' })
const ml = await brain.add('Machine Learning', { nounType: 'concept' })
const dl = await brain.add('Deep Learning', { nounType: 'concept' })

// Create relationships
await brain.relate(ml, ai, 'subset_of')
await brain.relate(dl, ml, 'subset_of')
await brain.relate(dl, ai, 'enables')

// Traverse the graph
const aiEcosystem = await brain.find({
  connected: { from: ai, depth: 3 }
})
```

### Using Neural Features
```typescript
// Find similar concepts
const similarity = await brain.neural.similar(
  'renewable energy',
  'sustainable power'
)

// Auto-cluster documents
const clusters = await brain.neural.clusters({
  method: 'kmeans',
  k: 5
})

// Generate visualization
const vizData = await brain.neural.visualize({
  maxNodes: 200,
  algorithm: 'force',
  dimensions: 3
})
// Use vizData with D3.js, Cytoscape, etc.
```

---

## Key Features

### ✨ Zero Configuration
Works instantly with sensible defaults. No setup required.

### 🧠 Triple Intelligence  
Combines vector search, graph traversal, and metadata filtering in one query.

### 🚀 Auto-Embedding
Text automatically converts to vectors - no manual embedding needed.

### 📊 Built-in Visualization
Export data formatted for popular visualization libraries.

### 🔒 Clean Operators
Readable, intuitive operators - no cryptic symbols.

### 🎯 Everything Included
All features in the MIT licensed package - no premium tiers.

---

## Support

- **GitHub**: [github.com/soulcraft/brainy](https://github.com/soulcraft/brainy)
- **Documentation**: [docs.soulcraft.com/brainy](https://docs.soulcraft.com/brainy)
- **License**: MIT

---

*Brainy 2.0 - Intelligence for Everyone*