# Brainy's Find System - Complete Guide

## Overview

Brainy's `find()` method is the most advanced query system in any vector database, combining **Triple Intelligence** (vector + metadata + graph) with **Type-Aware NLP** for natural language understanding.

## Architecture: Three Intelligence Systems

### 1. Vector Intelligence (HNSW Index)
- **Purpose**: Semantic similarity search using embeddings
- **Algorithm**: Hierarchical Navigable Small World (HNSW)
- **Performance**: O(log n) search, ~1.8ms typical
- **Data Structure**: Multi-layer graph with 16 connections per node
- **Use Cases**: "Find similar documents", "Content like this"

### 2. Metadata Intelligence (Incremental Indices)
- **Purpose**: Fast filtering on structured data
- **Algorithm**: HashMap for exact matches, Sorted arrays for ranges
- **Performance**: O(1) exact, O(log n) ranges, <1ms typical
- **Data Structure**: `Map<field:value, Set<id>>` + sorted value arrays
- **Use Cases**: "Documents from 2023", "Status equals active"

### 3. Graph Intelligence (Adjacency Maps) 
- **Purpose**: Relationship traversal and connection analysis
- **Algorithm**: Pure O(1) neighbor lookups via Map operations
- **Performance**: O(1) per hop, ~0.1ms typical
- **Data Structure**: `Map<sourceId, Set<targetId>>`
- **Use Cases**: "Papers connected to MIT", "Authors who collaborated"

## Query Types Supported

### 1. Natural Language Queries
```typescript
// Type-aware NLP automatically detects entities and fields
await brain.find("documents by Smith published after 2020 with high citations")

// Processing flow:
// 1. Detect: "documents" → NounType.Document
// 2. Parse: "by Smith" → {author: "Smith"} (semantic field matching)
// 3. Parse: "after 2020" → {publishDate: {greaterThan: 2020}}
// 4. Parse: "high citations" → {citations: {greaterThan: 100}} (threshold inference)
// 5. Execute: Triple Intelligence query with type constraints
```

### 2. Structured Queries
```typescript
// Direct query objects with full control
await brain.find({
  // Vector search
  query: "machine learning research",
  
  // Metadata filters  
  where: {
    publishDate: { greaterThan: 2020 },
    citations: { between: [50, 1000] },
    status: "published"
  },
  
  // Type constraints
  type: NounType.Document,
  
  // Graph traversal
  connected: {
    to: "mit-ai-lab",
    via: VerbType.AffiliatedWith,
    depth: 2
  },
  
  // Control options
  limit: 20,
  explain: true  // Get scoring breakdown
})
```

### 3. Proximity Search
```typescript
// Find entities similar to a specific item
await brain.find({
  near: {
    id: "doc-123",
    threshold: 0.8  // Minimum similarity
  },
  type: NounType.Document
})
```

## Index Usage in Detail

### Metadata Index Operations

#### Hash Index (Exact Matches)
```typescript
// Query: {status: "published"}
// Index lookup: indexCache.get("status:published") → Set<id>
// Performance: O(1) average case
// Memory: ~40 bytes per unique field-value combination
```

#### Sorted Index (Range Queries) 
```typescript
// Query: {publishDate: {greaterThan: 2020}}
// Index: sortedIndices.get("publishDate") → [[2019, Set<id>], [2020, Set<id>], [2021, Set<id>]]
// Algorithm: Binary search for start position, collect all values > threshold
// Performance: O(log n) for search + O(k) for result collection
// Memory: ~48 bytes per unique value (value + Set reference)
```

#### Type-Field Affinity (Smart Field Discovery)
```typescript
// When NLP detects NounType.Document:
// 1. getFieldsForType("document") → [{field: "title", affinity: 0.95}, {field: "author", affinity: 0.87}]
// 2. Prioritize fields with high affinity for better matching
// 3. Boost confidence scores for type-relevant fields
// Performance: O(1) lookup in affinity map
// Memory: ~16 bytes per type-field combination
```

### Vector Index Operations

#### HNSW Hierarchical Search
```typescript
// Query: {query: "machine learning"}
// Process:
// 1. Embed query text → 384-dimensional vector
// 2. Start at top layer (entry point)  
// 3. Greedy search for nearest neighbor at each layer
// 4. Move down layers for progressively finer search
// 5. Return k nearest neighbors with similarity scores
// Performance: O(log n) due to hierarchical structure
// Memory: ~1.5KB per item (vector + graph connections)
```

### Graph Index Operations

#### O(1) Neighbor Lookups
```typescript
// Query: {connected: {to: "entity-123"}}
// Index lookup: 
//   - Outgoing: sourceIndex.get("entity-123") → Set<neighborId>
//   - Incoming: targetIndex.get("entity-123") → Set<neighborId>  
//   - Both directions: union of both Sets
// Performance: O(1) per hop, no matter the graph size
// Memory: ~24 bytes per relationship (source + target + metadata)
```

## Query Execution Flow

### Phase 1: Query Parsing
```typescript
if (typeof query === 'string') {
  // Natural Language Processing
  const nlpParams = await this.parseNaturalQuery(query)
  
  // Type-aware parsing:
  // 1. Detect NounType using pre-embedded type vectors
  // 2. Get type-specific fields from real data patterns  
  // 3. Semantic field matching with type affinity boosting
  // 4. Validate field-type compatibility
  // 5. Generate optimized query plan
  
  params = nlpParams
} else {
  params = query  // Direct structured query
}
```

### Phase 2: Parallel Search Execution
```typescript
// Execute multiple searches simultaneously
const searchPromises = []

// Vector search (if query text or vector provided)
if (params.query || params.vector) {
  searchPromises.push(this.executeVectorSearch(params))
}

// Proximity search (if near parameter provided)  
if (params.near) {
  searchPromises.push(this.executeProximitySearch(params))
}

// Wait for all searches to complete
const searchResults = await Promise.all(searchPromises)
```

### Phase 3: Metadata Filtering
```typescript
// Apply metadata filters using optimized indices
if (params.where || params.type || params.service) {
  const filter = {
    ...params.where,
    ...(params.type && { noun: params.type }),
    ...(params.service && { service: params.service })
  }
  
  // Get optimal query plan based on field cardinalities
  const queryPlan = await this.getOptimalQueryPlan(filter)
  
  // Execute filters in optimal order (low cardinality first)
  const filteredIds = await this.metadataIndex.getIdsForFilter(filter)
  
  if (results.length > 0) {
    // Intersect with vector search results
    results = results.filter(r => filteredIds.includes(r.id))
  } else {
    // Create results from metadata matches (metadata-only query)
    results = await this.createResultsFromIds(filteredIds)
  }
}
```

### Phase 4: Graph Traversal  
```typescript
// Apply graph constraints using O(1) lookups
if (params.connected) {
  const connectedIds = await this.graphIndex.getConnectedIds(params.connected)
  
  if (results.length > 0) {
    // Filter existing results to only connected entities
    results = results.filter(r => connectedIds.includes(r.id))
  } else {
    // Create results from connected entities
    results = await this.createResultsFromIds(connectedIds) 
  }
}
```

### Phase 5: Fusion Scoring & Optimization
```typescript
// Combine scores from multiple intelligence sources
if (params.fusion && results.length > 0) {
  results = this.applyFusionScoring(results, params.fusion)
  
  // Example fusion strategies:
  // - Weighted: vectorScore × 0.6 + metadataScore × 0.2 + graphScore × 0.2  
  // - Adaptive: adjust weights based on query characteristics
  // - Progressive: prioritize based on result confidence
}

// Sort by final score and apply pagination
results.sort((a, b) => b.score - a.score)
return results.slice(offset, offset + limit)
```

## Type-Aware NLP Features

### 1. Dynamic Field Discovery
- **No Hardcoded Fields**: Only NounType/VerbType taxonomies are fixed (30+ noun, 40+ verb types)
- **Real Data Learning**: Field affinity learned from actual indexed entities
- **Semantic Matching**: "by" → "author" via embedding similarity (87% confidence)
- **Type Context**: Documents have different fields than Persons or Organizations

### 2. Intelligent Query Enhancement
```typescript
// Input: "research papers by Smith with high impact"
// NLP Processing:
// 1. "research papers" → NounType.Document (0.95 confidence)
// 2. Get Document fields: [title: 0.95, author: 0.87, citations: 0.76, publishDate: 0.89]
// 3. "by Smith" → {author: "Smith"} (0.87 type affinity + semantic boost)
// 4. "high impact" → {citations: {greaterThan: 100}} (threshold inference)
// 5. Query validation: ✅ Documents can have author and citations fields
// 6. Optimization: Process author field first (lower cardinality)
```

### 3. Field-Type Validation
```typescript
// Prevents invalid queries and suggests alternatives:
// "people with publishDate > 2020" 
// → Warning: "Person entities rarely have publishDate field"
// → Suggestion: "Did you mean createdAt, updatedAt, or birthDate?"
// → Auto-correction: Use most likely alternative based on affinity data
```

## Performance Characteristics

### Query Performance by Type

| Query Type | Index Used | Performance | Example |
|------------|------------|-------------|---------|
| **Semantic Search** | HNSW Vector | O(log n), ~1.8ms | `"AI research papers"` |
| **Exact Metadata** | HashMap | O(1), ~0.8ms | `{status: "published"}` |
| **Range Metadata** | Sorted Array | O(log n), ~0.6ms | `{year: {greaterThan: 2020}}` |
| **Graph Traversal** | Adjacency Map | O(1), ~0.1ms | `{connected: {to: "mit"}}` |
| **Type Detection** | Pre-embedded Types | O(t), ~0.3ms | `"documents"` → `NounType.Document` |
| **Field Matching** | Field Embeddings | O(f), ~0.1ms | `"by"` → `"author"` |
| **Combined Query** | All Indices | O(log n), ~1.8ms | NLP + filters + graph |

Where:
- n = number of entities in database
- t = number of types (70 total: 30 noun + 40 verb)  
- f = number of fields for detected entity type (typically 5-15)

### Scalability

| Database Size | Vector Search | Metadata Filter | Graph Query | Combined |
|---------------|---------------|-----------------|-------------|----------|
| **1K entities** | 0.8ms | 0.3ms | 0.05ms | 1.1ms |
| **10K entities** | 1.2ms | 0.5ms | 0.08ms | 1.5ms |
| **100K entities** | 1.8ms | 0.8ms | 0.1ms | 2.1ms |
| **1M entities** | 2.5ms | 1.2ms | 0.1ms | 2.8ms |
| **10M entities** | 3.8ms | 1.8ms | 0.1ms | 4.2ms |

**Key Performance Notes:**
- Graph queries stay O(1) regardless of scale
- Metadata ranges scale as O(log n), not O(n)
- Vector search degrades gracefully due to HNSW
- Type-aware NLP adds minimal overhead (~0.4ms)

## Example Query Flows

### Complex NLP Query
```typescript
// Query: "recent AI papers from Stanford researchers with high citations connected to industry"

// Phase 1: NLP Parsing
// - "papers" → NounType.Document (0.94 confidence)
// - "Stanford researchers" → entity search + NounType.Person
// - "recent" → publishDate: {greaterThan: 2023}  
// - "high citations" → citations: {greaterThan: 100}
// - "connected to industry" → graph traversal via VerbType.AffiliatedWith

// Phase 2: Generated Query
{
  type: NounType.Document,
  where: {
    publishDate: { greaterThan: 2023 },
    citations: { greaterThan: 100 }
  },
  connected: {
    to: ["stanford-researchers"],
    via: VerbType.AffiliatedWith,
    depth: 2
  }
}

// Phase 3: Execution Plan
// 1. Metadata filter: publishDate > 2023 (O(log n) via sorted index)
// 2. Metadata filter: citations > 100 (O(log n) via sorted index)  
// 3. Graph traversal: connected to Stanford (O(1) per hop)
// 4. Intersection: entities matching all constraints
// 5. Sort by relevance score
```

### Pure Performance Query
```typescript
// Query: Direct structured query for maximum performance
await brain.find({
  type: NounType.Document,           // O(1) type filter
  where: {
    status: "published",             // O(1) exact match
    year: 2024,                      // O(1) exact match  
    citations: { greaterThan: 50 }   // O(log n) range query
  },
  connected: {
    from: "author-123",              // O(1) graph lookup
    via: VerbType.Creates
  },
  limit: 10
})
// Total performance: ~1.2ms for 100K entities
```

## Query Operators (v4.5.4+)

### Canonical Operator Syntax

Brainy uses SQL-style canonical operators for maximum clarity and developer familiarity:

```typescript
// Canonical operators (recommended)
await brain.find({
  where: {
    age: { gte: 18 },              // Greater than or equal
    score: { lt: 100 },            // Less than
    status: { eq: 'active' },      // Equals
    role: { ne: 'guest' },         // Not equals
    priority: { in: [1, 2, 3] },   // In array
    date: { between: [start, end] }, // Between range
    tags: { contains: 'featured' }, // Contains value
    email: { exists: true }        // Field exists
  }
})
```

### Complete Operator Reference

| **Canonical** | **Aliases** | **Description** | **Example** |
|---------------|-------------|-----------------|-------------|
| `eq` | `equals` | Exact equality | `{ status: { eq: 'active' } }` |
| `ne` | `notEquals` | Not equal to | `{ role: { ne: 'admin' } }` |
| `gt` | `greaterThan` | Greater than | `{ age: { gt: 18 } }` |
| `gte` | `greaterThanOrEqual` | Greater than or equal | `{ score: { gte: 80 } }` |
| `lt` | `lessThan` | Less than | `{ price: { lt: 100 } }` |
| `lte` | `lessThanOrEqual` | Less than or equal | `{ stock: { lte: 10 } }` |
| `in` | - | Value in array | `{ category: { in: ['A', 'B'] } }` |
| `between` | - | Range (inclusive) | `{ year: { between: [2020, 2024] } }` |
| `contains` | - | Contains substring/value | `{ tags: { contains: 'urgent' } }` |
| `exists` | - | Field exists (boolean) | `{ email: { exists: true } }` |

**Deprecated Operators** (removed in v5.0.0):
- `is`, `isNot` → Use `eq`, `ne` instead
- `greaterEqual`, `lessEqual` → Use `gte`, `lte` instead

**Backward Compatibility**: All aliases are fully supported. Deprecated operators still work but will be removed in v5.0.0.

### Sorting Results (v4.5.4+)

Sort query results by any field, including timestamps:

```typescript
// Sort by timestamp (descending - newest first)
await brain.find({
  type: NounType.Document,
  orderBy: 'createdAt',
  order: 'desc',
  limit: 10
})

// Sort by custom field (ascending)
await brain.find({
  where: { status: { eq: 'published' } },
  orderBy: 'priority',
  order: 'asc'
})

// Sort with filtering and pagination
await brain.find({
  where: {
    publishDate: { gte: startDate },
    citations: { gte: 50 }
  },
  orderBy: 'citations',
  order: 'desc',
  limit: 20,
  offset: 0
})
```

**Sorting Performance**:
- **Production-scale**: O(k log k) where k = filtered results
- **Memory**: O(k) for filtered set, independent of total entity count
- **Timestamp fields**: Exact millisecond precision (createdAt, updatedAt)
- **Works with**: Metadata-only queries and vector + metadata queries
- **Default order**: `asc` if not specified

**Timestamp Sorting**:
```typescript
// Range query + sorting
await brain.find({
  where: {
    createdAt: { gte: Date.now() - 86400000 } // Last 24 hours
  },
  orderBy: 'createdAt',
  order: 'desc'  // Newest first
})

// Works with updatedAt, accessed, modified
await brain.find({
  orderBy: 'updatedAt',
  order: 'desc'
})
```

**Advanced Sorting Examples**:
```typescript
// Sort search results by custom field instead of relevance
await brain.find({
  query: "machine learning",
  where: { publishDate: { gte: 2023 } },
  orderBy: 'citations',  // Sort by citations, not relevance
  order: 'desc'
})

// Paginated sorted results
async function getDocumentsByDate(page: number, pageSize: number = 20) {
  return await brain.find({
    type: NounType.Document,
    where: { status: { eq: 'published' } },
    orderBy: 'publishDate',
    order: 'desc',
    limit: pageSize,
    offset: page * pageSize
  })
}
```

## VFS (Virtual File System) Visibility (v4.7.0+)

### Default Behavior

**VFS entities are now part of the knowledge graph** and included in query results by default:

```typescript
// Default: Searches ALL entities including VFS files
await brain.find({ query: 'authentication setup' })
// Returns: concepts, papers, AND markdown documentation files
```

**Why this change?** VFS files (imported markdown, PDFs, etc.) ARE knowledge entities. When you import documentation or papers into Brainy, you want to search them!

### Excluding VFS Entities

If you need to exclude VFS entities from specific queries, use the `excludeVFS` parameter:

```typescript
// Exclude VFS files from results
await brain.find({
  query: 'machine learning',
  excludeVFS: true  // Only return non-file entities
})
```

**Alternative**: Use explicit where clause for more control:

```typescript
// Explicit filtering (same as excludeVFS: true)
await brain.find({
  query: 'machine learning',
  where: { vfsType: { exists: false } }
})

// Or only search VFS files
await brain.find({
  query: 'setup instructions',
  where: { vfsType: 'file' }  // Only files
})
```

### Performance

**VFS filtering is production-scale:**
- Uses MetadataIndex (O(1) for exists checks)
- No performance penalty - same speed as any metadata filter
- Works seamlessly with vector + metadata + graph queries

### Migration from v4.6.x

**BREAKING CHANGE** (v4.7.0): The `includeVFS` parameter has been removed:

```typescript
// ❌ Old (v4.6.x and earlier)
await brain.find({
  query: 'docs',
  includeVFS: true  // No longer needed!
})

// ✅ New (v4.7.0+)
await brain.find({
  query: 'docs'  // VFS included by default
})

// ✅ To exclude VFS (if needed)
await brain.find({
  query: 'concepts',
  excludeVFS: true
})
```

**Why removed?** The old `includeVFS` parameter was:
1. Broken (metadata filter incompatibility with storage adapters)
2. Confusing (double-negative logic)
3. Wrong default (VFS should be searchable)

This system represents the most advanced query intelligence available in any database, combining the speed of specialized indices with the intelligence of natural language understanding and the power of graph relationships.