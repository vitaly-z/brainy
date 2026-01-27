# Brainy's Find System - Complete Guide

## Overview

Brainy's `find()` method is the most advanced query system in any vector database, combining **Triple Intelligence** (vector + metadata + graph) with **Type-Aware NLP** for natural language understanding.

## Architecture: Four Intelligence Systems

### 1. Vector Intelligence (HNSW Index)
- **Purpose**: Semantic similarity search using embeddings
- **Algorithm**: Hierarchical Navigable Small World (HNSW)
- **Performance**: O(log n) search, ~1.8ms typical
- **Data Structure**: Multi-layer graph with 16 connections per node
- **Use Cases**: "Find similar documents", "Content like this"

### 2. Text Intelligence (Word Index) - v7.7.0
- **Purpose**: Keyword/exact text matching
- **Algorithm**: Inverted word index with FNV-1a hashing
- **Performance**: O(log C) where C = chunks (~50 values each)
- **Data Structure**: `__words__ → hash → Roaring Bitmap of entity IDs`
- **Use Cases**: "Find exact name", "Keyword search"
- **Integration**: Automatically combined with Vector via RRF fusion

### 3. Metadata Intelligence (Incremental Indices)
- **Purpose**: Fast filtering on structured data
- **Algorithm**: HashMap for exact matches, Sorted arrays for ranges
- **Performance**: O(1) exact, O(log n) ranges, <1ms typical
- **Data Structure**: `Map<field:value, Set<id>>` + sorted value arrays
- **Use Cases**: "Documents from 2023", "Status equals active"

### 4. Graph Intelligence (Adjacency Maps) 
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

### 4. Hybrid Search (v7.7.0+)
```typescript
// Zero-config hybrid: automatically combines text + semantic search
await brain.find({ query: "David Smith" })
// Uses Reciprocal Rank Fusion (RRF) to combine results

// Force text-only search
await brain.find({ query: "exact keyword", searchMode: 'text' })

// Force semantic-only search
await brain.find({ query: "AI concepts", searchMode: 'semantic' })

// Custom hybrid weighting (0 = text only, 1 = semantic only)
await brain.find({ query: "search term", hybridAlpha: 0.3 })
```

**How Auto-Alpha Works:**
- Short queries (1-2 words): alpha = 0.3 (favor text matching)
- Medium queries (3-4 words): alpha = 0.5 (balanced)
- Long queries (5+ words): alpha = 0.7 (favor semantic matching)

### 5. Match Visibility (v7.8.0)

Search results include match details showing what matched:

```typescript
const results = await brain.find({ query: 'david the warrior' })

// Each result has:
results[0].textMatches     // ["david", "warrior"] - exact words found
results[0].textScore       // 0.25 - text match quality (0-1)
results[0].semanticScore   // 0.87 - semantic similarity (0-1)
results[0].matchSource     // 'both' | 'text' | 'semantic'
```

Use this for:
- **Highlighting** exact matches in UI (textMatches)
- **Explaining** why a result was found (matchSource)
- **Debugging** search behavior (separate scores)

### 6. Semantic Highlighting (v7.8.0)

Highlight which concepts/words in text matched your query:

```typescript
// Find semantically similar words + exact matches
const highlights = await brain.highlight({
  query: "david the warrior",
  text: "David Smith is a brave fighter who battles dragons"
})

// Returns:
// [
//   { text: "David", score: 1.0, position: [0, 5], matchType: 'text' },
//   { text: "fighter", score: 0.78, position: [25, 32], matchType: 'semantic' },
//   { text: "battles", score: 0.72, position: [37, 44], matchType: 'semantic' }
// ]
```

**Features:**
- `matchType: 'text'` - Exact word match (score = 1.0)
- `matchType: 'semantic'` - Concept match (score varies)
- `position` - [start, end] for precise highlighting
- `granularity` - 'word' (default), 'phrase', or 'sentence'
- `threshold` - Minimum semantic score (default: 0.5)

**UI Usage Pattern:**
```typescript
// Highlight search results with different styles
function highlightResult(text: string, highlights: Highlight[]) {
  return highlights.map(h => ({
    text: h.text,
    position: h.position,
    style: h.matchType === 'text' ? 'strong' : 'emphasis'  // Different UI styles
  }))
}
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
- **No Hardcoded Fields**: Only NounType/VerbType taxonomies are fixed (42 noun, 127 verb types)
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
- t = number of types (169 total: 42 noun + 127 verb)  
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

## Filter Syntax Reference (v5.8.0+)

### Where Clause: Complete Operator Guide

Brainy provides a comprehensive set of operators for filtering entities by metadata fields. All operators work seamlessly with Triple Intelligence (vector + metadata + graph).

#### Basic Operators

**Exact Match** (shorthand):
```typescript
await brain.find({
  where: {
    status: 'active',        // Shorthand for { eq: 'active' }
    year: 2024,              // Exact match for numbers
    verified: true           // Boolean matching
  }
})
```

**Comparison Operators**:
```typescript
await brain.find({
  where: {
    age: { gt: 18 },                    // Greater than
    score: { gte: 80 },                 // Greater than or equal
    price: { lt: 100 },                 // Less than
    stock: { lte: 10 },                 // Less than or equal
    status: { eq: 'active' },           // Equals (explicit)
    role: { ne: 'guest' }               // Not equals
  }
})
```

**Performance**: O(log n) for comparisons using sorted indices, O(1) for exact matches using hash maps.

#### Range Operators

**Between** (inclusive):
```typescript
await brain.find({
  where: {
    publishDate: { between: [2020, 2024] },      // Year range
    price: { between: [10.00, 99.99] },          // Price range
    timestamp: { between: [startMs, endMs] }     // Time range
  }
})
```

**Performance**: O(log n) for finding range boundaries, O(k) for collecting results where k = matching entities.

#### Set Membership

**In/Not In**:
```typescript
await brain.find({
  where: {
    category: { in: ['tech', 'science', 'research'] },
    status: { notIn: ['draft', 'deleted'] },
    priority: { in: [1, 2, 3] }
  }
})
```

**Performance**: O(1) per set member check via hash lookup, O(m) total where m = set size.

#### String Matching

**Contains/Starts/Ends**:
```typescript
await brain.find({
  where: {
    title: { contains: 'machine learning' },     // Substring search
    email: { startsWith: 'admin@' },             // Prefix match
    filename: { endsWith: '.pdf' }               // Suffix match
  }
})
```

**Performance**: O(n) substring scan (not indexed), best used with additional indexed filters.

**Note**: For semantic similarity, use `query` parameter instead:
```typescript
// ❌ Slow substring search
where: { description: { contains: 'AI' } }

// ✅ Fast semantic search
query: 'artificial intelligence'
```

#### Existence Checks

**Exists/Missing**:
```typescript
await brain.find({
  where: {
    email: { exists: true },           // Has email field
    deletedAt: { exists: false },      // No deletedAt field (not deleted)
    profileImage: { exists: true }     // Has profile image
  }
})
```

**Performance**: O(1) via hash index of fields.

### Compound Filters

Combine multiple conditions with boolean logic:

#### AND Logic (Default)

All conditions at the same level are implicitly AND:

```typescript
await brain.find({
  where: {
    status: 'published',             // AND
    year: { gte: 2020 },            // AND
    citations: { gte: 50 }          // AND
  }
})
// Returns: entities matching ALL three conditions
```

**Explicit AND with `allOf`**:
```typescript
await brain.find({
  where: {
    allOf: [
      { status: 'published' },
      { year: { gte: 2020 } },
      { citations: { gte: 50 } }
    ]
  }
})
```

**Performance**: O(log n) total - processes filters in optimal order (low cardinality first).

#### OR Logic

Match ANY condition:

```typescript
await brain.find({
  where: {
    anyOf: [
      { status: 'urgent' },
      { priority: { gte: 8 } },
      { assignee: 'admin' }
    ]
  }
})
// Returns: entities matching ANY condition
```

**Combined AND + OR**:
```typescript
await brain.find({
  where: {
    status: 'active',              // Must be active
    anyOf: [                       // AND (urgent OR high priority)
      { tags: { contains: 'urgent' } },
      { priority: { gte: 8 } }
    ]
  }
})
```

**Performance**: O(m × log n) where m = number of OR conditions, results are merged with Set union.

#### Nested Logic

Complex boolean expressions:

```typescript
await brain.find({
  where: {
    allOf: [
      { status: 'published' },
      {
        anyOf: [
          { featured: true },
          { citations: { gte: 100 } }
        ]
      }
    ]
  }
})
// Returns: published AND (featured OR highly cited)
```

### Complete Operator Reference Table

| **Operator** | **Aliases** | **Description** | **Performance** | **Example** |
|--------------|-------------|-----------------|-----------------|-------------|
| `eq` | `equals` | Exact equality | O(1) | `{ status: { eq: 'active' } }` |
| `ne` | `notEquals` | Not equal | O(n) scan | `{ role: { ne: 'admin' } }` |
| `gt` | `greaterThan` | Greater than | O(log n) | `{ age: { gt: 18 } }` |
| `gte` | `greaterThanOrEqual` | Greater/equal | O(log n) | `{ score: { gte: 80 } }` |
| `lt` | `lessThan` | Less than | O(log n) | `{ price: { lt: 100 } }` |
| `lte` | `lessThanOrEqual` | Less/equal | O(log n) | `{ stock: { lte: 10 } }` |
| `in` | - | In array | O(m) | `{ category: { in: ['A', 'B'] } }` |
| `notIn` | - | Not in array | O(n) scan | `{ status: { notIn: ['draft'] } }` |
| `between` | - | Range (inclusive) | O(log n + k) | `{ year: { between: [2020, 2024] } }` |
| `contains` | - | Substring | O(n) scan | `{ title: { contains: 'AI' } }` |
| `startsWith` | - | Prefix | O(n) scan | `{ email: { startsWith: 'admin' } }` |
| `endsWith` | - | Suffix | O(n) scan | `{ file: { endsWith: '.pdf' } }` |
| `exists` | - | Field exists | O(1) | `{ email: { exists: true } }` |
| `anyOf` | - | OR logic | O(m × log n) | `{ anyOf: [{...}, {...}] }` |
| `allOf` | - | AND logic | O(log n) | `{ allOf: [{...}, {...}] }` |

**Performance Notes**:
- **O(1)**: Hash index lookup (exact matches, exists)
- **O(log n)**: Sorted index binary search (comparisons, ranges)
- **O(n)**: Full scan (string matching, negations)
- **O(k)**: Result collection where k = matches

**Optimization Tips**:
1. **Combine fast + slow filters**: Put indexed filters first
2. **Avoid `ne` and `notIn`**: Require full scans, use positive filters when possible
3. **Use `query` for text search**: Semantic search is faster than substring matching
4. **Limit string operations**: `contains`/`startsWith`/`endsWith` are unindexed

### Type Filtering

Filter entities by NounType:

#### Single Type

```typescript
await brain.find({
  type: NounType.Document,
  where: { year: { gte: 2020 } }
})
```

#### Multiple Types

```typescript
await brain.find({
  type: [NounType.Person, NounType.Organization],
  where: { verified: true }
})
```

#### All 42 Available NounTypes

```typescript
// People & Organizations
NounType.Person, NounType.Organization, NounType.Team, NounType.Role

// Content
NounType.Document, NounType.Image, NounType.Video, NounType.Audio

// Knowledge
NounType.Concept, NounType.Topic, NounType.Category, NounType.Tag

// Technical
NounType.Code, NounType.API, NounType.Database, NounType.Service

// Events & Time
NounType.Event, NounType.Timeline, NounType.Schedule

// Location & Physical
NounType.Place, NounType.Building, NounType.Room, NounType.Device

// Abstract
NounType.Thing, NounType.Entity, NounType.Object

// And 19 more... (see src/types/graphTypes.ts for complete list)
```

**Performance**: O(1) - type stored as indexed metadata field.

### Graph Query Syntax

Traverse relationships using the GraphIndex:

#### Basic Connection

```typescript
await brain.find({
  connected: {
    to: 'entity-id-123',           // Connected to this entity
    via: VerbType.WorksFor,         // Through this relationship type
    direction: 'out'                // Direction: 'in', 'out', or 'both'
  }
})
```

**Performance**: O(1) per hop via adjacency map lookup.

#### Multi-Hop Traversal

```typescript
await brain.find({
  connected: {
    to: 'research-institution',
    via: VerbType.AffiliatedWith,
    depth: 2                        // Up to 2 hops away
  }
})
```

**Performance**: O(d) where d = depth, each hop is O(1).

#### Combined with Other Filters

```typescript
await brain.find({
  type: NounType.Person,
  where: {
    verified: true,
    reputation: { gte: 100 }
  },
  connected: {
    to: 'stanford-ai-lab',
    via: VerbType.WorksAt,
    direction: 'out'
  },
  limit: 20
})
// Returns: Verified people with high reputation who work at Stanford AI Lab
```

#### Pagination with Graph Queries (v5.8.0+)

```typescript
// Page through high-degree nodes efficiently
const neighbors = await brain.graphIndex.getNeighbors('hub-entity-id', {
  direction: 'out',
  limit: 50,
  offset: 0
})

// Get verb IDs with pagination
const verbIds = await brain.graphIndex.getVerbIdsBySource('source-id', {
  limit: 100,
  offset: 0
})
```

**Performance**: O(1) lookup + O(log k) slice where k = total neighbors.

**Note**: See `src/graph/graphAdjacencyIndex.ts` for low-level graph operations.

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

## Common Query Patterns

### Pagination

**Offset-based pagination**:
```typescript
async function getPaginatedResults(page: number, pageSize: number = 20) {
  return await brain.find({
    type: NounType.Document,
    where: { status: 'published' },
    orderBy: 'createdAt',
    order: 'desc',
    limit: pageSize,
    offset: page * pageSize
  })
}

// Usage
const page1 = await getPaginatedResults(0)  // First 20
const page2 = await getPaginatedResults(1)  // Next 20
```

**Graph pagination** (v5.8.0+):
```typescript
// Paginate through high-degree node relationships
async function getNeighborPage(entityId: string, page: number, pageSize: number = 50) {
  return await brain.graphIndex.getNeighbors(entityId, {
    direction: 'out',
    limit: pageSize,
    offset: page * pageSize
  })
}
```

**Performance**: O(1) for offset calculation, O(k) for slice where k = page size.

### Time-based Queries

**Recent entities**:
```typescript
// Last 24 hours
const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
await brain.find({
  where: {
    createdAt: { gte: oneDayAgo }
  },
  orderBy: 'createdAt',
  order: 'desc'
})

// Last 7 days with additional filters
const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
await brain.find({
  type: NounType.Document,
  where: {
    createdAt: { gte: oneWeekAgo },
    status: 'published'
  },
  orderBy: 'createdAt',
  order: 'desc'
})
```

**Date ranges**:
```typescript
// Specific year
await brain.find({
  where: {
    publishDate: { between: [
      new Date('2023-01-01').getTime(),
      new Date('2023-12-31').getTime()
    ]}
  }
})

// Quarter
const Q1_2024_start = new Date('2024-01-01').getTime()
const Q1_2024_end = new Date('2024-03-31').getTime()
await brain.find({
  where: {
    createdAt: { between: [Q1_2024_start, Q1_2024_end] }
  }
})
```

### Combining Vector + Metadata + Graph

**Triple Intelligence query**:
```typescript
// Find: AI research papers from verified authors at top institutions
const results = await brain.find({
  // Vector search (semantic)
  query: 'artificial intelligence machine learning',

  // Metadata filters
  type: NounType.Document,
  where: {
    publishDate: { gte: 2020 },
    citations: { gte: 50 },
    peerReviewed: true
  },

  // Graph traversal
  connected: {
    to: topInstitutionIds,  // Array of institution entity IDs
    via: VerbType.AffiliatedWith,
    depth: 2  // Authors affiliated with institutions (2 hops)
  },

  // Results
  limit: 50,
  orderBy: 'citations',
  order: 'desc'
})
```

**Performance**: O(log n) vector search + O(log n) metadata filters + O(1) graph traversal = ~2-3ms total.

### Excluding Soft-Deleted Entities

**Common pattern**:
```typescript
// Standard query excludes deleted
await brain.find({
  where: {
    deletedAt: { exists: false }  // Not soft-deleted
  }
})

// Or use compound filter
await brain.find({
  where: {
    allOf: [
      { status: 'active' },
      { deletedAt: { exists: false } }
    ]
  }
})
```

**Note**: Consider implementing this as a default filter in your application layer if all queries need it.

### Finding Similar Entities

**Semantic similarity**:
```typescript
// Find documents similar to a specific document
await brain.find({
  near: {
    id: 'doc-123',
    threshold: 0.8  // Minimum 80% similarity
  },
  type: NounType.Document,
  limit: 10
})

// With metadata constraints
await brain.find({
  near: { id: 'paper-456', threshold: 0.75 },
  where: {
    publishDate: { gte: 2020 },
    language: 'en'
  }
})
```

**Performance**: O(log n) HNSW search with early termination at threshold.

### Aggregation Patterns

**Count matching entities**:
```typescript
// Get total count (metadata-only query is fastest)
const results = await brain.find({
  where: { status: 'published' },
  limit: 1  // We only need the count
})
// Note: Current API returns results, not counts
// For production, consider caching counts or using metadata indices directly
```

**Group by type**:
```typescript
// Find all entities, then group by type in application
const allEntities = await brain.find({ limit: 10000 })
const byType = allEntities.reduce((acc, entity) => {
  const type = entity.noun || 'unknown'
  if (!acc[type]) acc[type] = []
  acc[type].push(entity)
  return acc
}, {})
```

### Multi-Condition OR Queries

**Any of multiple values**:
```typescript
await brain.find({
  where: {
    anyOf: [
      { priority: 'urgent' },
      { priority: 'high' },
      { assignee: 'admin' },
      { dueDate: { lte: Date.now() } }
    ]
  }
})
// Returns: urgent OR high priority OR assigned to admin OR overdue
```

**Complex business logic**:
```typescript
// Find: (Premium users OR trial users with activity) AND not banned
await brain.find({
  type: NounType.Person,
  where: {
    allOf: [
      {
        anyOf: [
          { subscription: 'premium' },
          {
            allOf: [
              { subscription: 'trial' },
              { lastActive: { gte: Date.now() - 86400000 } }  // 24h
            ]
          }
        ]
      },
      { banned: { ne: true } }
    ]
  }
})
```

## Troubleshooting Guide

### Query Returns No Results

**Check 1: Verify entity exists**
```typescript
// List all entities of a type
const all = await brain.find({
  type: NounType.Document,
  limit: 10
})
console.log(`Found ${all.length} documents`)
```

**Check 2: Test filters individually**
```typescript
// Remove filters one by one to find the culprit
await brain.find({ where: { status: 'published' } })  // Works?
await brain.find({ where: { year: 2024 } })           // Works?
await brain.find({ where: {
  status: 'published',
  year: 2024  // Combined - works?
}})
```

**Check 3: Verify field names**
```typescript
// Get a sample entity to see actual field names
const sample = await brain.find({ type: NounType.Document, limit: 1 })
console.log(Object.keys(sample[0].data))  // Actual fields
```

**Common issues**:
- Field name typo: `publishDate` vs `published_date`
- Wrong type: `type: NounType.Document` but entities are `NounType.Paper`
- Case sensitivity: `status: 'Active'` vs `status: 'active'`

### Slow Query Performance

**Check 1: Identify slow operation**
```typescript
// Use explain mode (if available)
const results = await brain.find({
  query: 'machine learning',
  where: { title: { contains: 'AI' } },  // ⚠️ O(n) substring search
  explain: true
})
```

**Check 2: Avoid O(n) operations**
```typescript
// ❌ Slow: Substring search
where: { description: { contains: 'machine' } }

// ✅ Fast: Semantic search
query: 'machine learning'

// ❌ Slow: Negation
where: { status: { ne: 'draft' } }

// ✅ Fast: Positive filter
where: { status: 'published' }
```

**Check 3: Optimize filter order**
```typescript
// ❌ Suboptimal: Slow filter first
where: {
  description: { contains: 'AI' },  // O(n) - runs first
  year: 2024                        // O(1) - runs second
}

// ✅ Optimal: Fast filter first (automatic optimization)
where: {
  year: 2024,                       // O(1) - narrow results
  status: 'published'               // O(1) - further narrow
  // Only then apply O(n) operations if needed
}
```

**Performance budget**:
- **< 2ms**: Metadata-only or graph-only queries
- **< 5ms**: Vector search with simple filters
- **< 10ms**: Complex Triple Intelligence queries
- **> 10ms**: Check for O(n) operations or missing indices

### Type Errors

**TypeScript type mismatches**:
```typescript
// ❌ Error: Type 'string' is not assignable to type 'NounType'
await brain.find({ type: 'Document' })

// ✅ Correct: Use NounType enum
import { NounType } from '@soulcraft/brainy'
await brain.find({ type: NounType.Document })

// ❌ Error: Operator not recognized
where: { age: { greaterThan: 18 } }  // Old API

// ✅ Correct: Use canonical operators
where: { age: { gt: 18 } }           // v5.0.0+
```

### Graph Traversal Issues

**No connected entities found**:
```typescript
// Verify relationship exists
const relations = await brain.getRelations({
  from: 'entity-a',
  to: 'entity-b'
})
console.log('Relationships:', relations)

// Check direction
await brain.find({
  connected: {
    to: 'entity-id',
    direction: 'in'   // Try 'out' or 'both'
  }
})

// Verify verb type
await brain.find({
  connected: {
    to: 'entity-id',
    via: VerbType.WorksFor  // Correct VerbType?
  }
})
```

### Vector Search Not Working

**Check embeddings**:
```typescript
// Ensure vectors are generated (automatic in v5.0+)
const entity = await brain.get('entity-id')
console.log('Has vector:', !!entity.vector)

// If missing, entity may predate vector support
// Re-add entity to generate vector
await brain.update(entity.id, { data: entity.data })
```

**Similarity threshold too high**:
```typescript
// ❌ Too strict: May return nothing
await brain.find({
  near: { id: 'doc-123', threshold: 0.95 }
})

// ✅ Reasonable: 0.7-0.85 is typical
await brain.find({
  near: { id: 'doc-123', threshold: 0.75 }
})
```

### Unexpected Results

**Entity appears in wrong type query**:
```typescript
// Check actual entity type
const entity = await brain.get('unexpected-id')
console.log('Entity type:', entity.noun)

// Verify type filter is working
await brain.find({
  type: NounType.Document,
  where: { id: 'unexpected-id' }  // Should not return if wrong type
})
```

**Duplicate results**:
```typescript
// Check for duplicate entity IDs
const results = await brain.find({ query: 'test' })
const ids = results.map(r => r.id)
const uniqueIds = new Set(ids)
console.log(`Results: ${results.length}, Unique: ${uniqueIds.size}`)

// Brainy should never return duplicates - report if found
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