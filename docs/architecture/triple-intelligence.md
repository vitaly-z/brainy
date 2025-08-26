# Triple Intelligence System

The Triple Intelligence System is Brainy's revolutionary query engine that unifies vector similarity, graph relationships, and metadata filtering into a single, optimized query interface.

## Overview

Traditional databases force you to choose between vector search, graph traversal, OR metadata filtering. Brainy combines all three intelligences into one magical API that automatically optimizes execution for maximum performance.

## Query Interface

### Unified Query Structure

```typescript
interface TripleQuery {
  // Vector/Semantic search
  like?: string | Vector | any
  similar?: string | Vector | any
  
  // Graph/Relationship search  
  connected?: {
    to?: string | string[]
    from?: string | string[]
    type?: string | string[]
    depth?: number
    direction?: 'in' | 'out' | 'both'
  }
  
  // Field/Attribute search
  where?: Record<string, any>
  
  // Advanced options
  limit?: number
  boost?: 'recent' | 'popular' | 'verified' | string
  explain?: boolean
  threshold?: number
}
```

### Example Queries

#### Natural Language Queries with find()
```typescript
// Brainy understands natural language and extracts intent
const results = await brain.find("research papers about neural networks from 2023")
// Automatically interprets: document type, topic, time range

// Complex temporal and numeric queries
const reports = await brain.find("quarterly reports from Q3 2024 with revenue over 10M")
// Automatically extracts: report type, date range, numeric filters

// Multi-condition natural language
const articles = await brain.find("verified articles by John Smith about machine learning published this year")
// Automatically identifies: author, topic, verification status, time range
```

#### Simple Vector Search
```typescript
const results = await brain.search("machine learning concepts")
```

#### Combined Intelligence Query
```typescript
const results = await brain.find({
  like: "neural networks",
  where: {
    category: "research",
    year: { $gte: 2023 }
  },
  connected: {
    to: "deep-learning-team",
    depth: 2
  },
  limit: 20
})
```

## Query Optimization

### Automatic Plan Generation

The Triple Intelligence engine analyzes each query to create an optimal execution plan:

1. **Selectivity Analysis**: Identifies the most selective filters
2. **Cost Estimation**: Estimates computational cost for each operation
3. **Strategy Selection**: Chooses between parallel or progressive execution
4. **Plan Caching**: Caches successful plans for similar queries

### Execution Strategies

#### Parallel Execution
All three search types execute simultaneously:
- **Best for**: Balanced queries with multiple signals
- **Performance**: Maximum speed through parallelization
- **Use case**: Complex queries needing all intelligence types

```typescript
// Parallel execution for balanced query
const results = await brain.find({
  like: "AI research",           // ~1000 potential matches
  where: { type: "paper" },       // ~500 potential matches
  connected: { to: "stanford" }   // ~200 potential matches
})
// All three execute in parallel, results fused
```

#### Progressive Filtering
Operations chain for maximum efficiency:
- **Best for**: Queries with highly selective filters
- **Performance**: Reduces search space at each step
- **Use case**: Large datasets with specific criteria

```typescript
// Progressive execution for selective query
const results = await brain.find({
  where: { userId: "user123" },   // Very selective (1-10 matches)
  like: "recent posts",            // Applied to filtered set
  limit: 5
})
// Metadata filter first, then vector search on results
```

## Fusion Ranking

### Score Combination

When multiple intelligence types return results, scores are intelligently combined:

```typescript
fusionScore = (
  vectorScore * vectorWeight +    // Semantic relevance (0.4)
  graphScore * graphWeight +      // Relationship strength (0.3)
  fieldScore * fieldWeight        // Exact match confidence (0.3)
) / totalWeight
```

### Adaptive Weights

Weights adjust based on query characteristics:
- **Text-heavy query**: Higher vector weight
- **Relationship query**: Higher graph weight  
- **Specific filters**: Higher field weight

## Natural Language Processing

### Pattern Recognition

Brainy includes 220+ embedded patterns for natural language understanding:

```typescript
// Natural language automatically parsed
const results = await brain.search(
  "show me recent AI papers from Stanford published this year"
)
// Automatically converts to:
// {
//   like: "AI papers",
//   where: { 
//     institution: "Stanford",
//     published: { $gte: "2024-01-01" }
//   }
// }
```

### Intent Detection

The NLP processor identifies query intent:
- **Informational**: "what is", "how does"
- **Navigational**: "find", "show me"
- **Transactional**: "create", "update"
- **Analytical**: "compare", "analyze"

## Performance Optimization

### Query Plan Caching

Successful execution plans are cached:
```typescript
// First query: 50ms (plan generation + execution)
await brain.search("machine learning papers")

// Subsequent similar queries: 10ms (cached plan)
await brain.search("deep learning papers")
```

### Self-Optimization

Brainy uses itself to optimize queries:
- Query patterns stored in separate brain instance
- Execution times tracked and analyzed
- Plans automatically improved based on performance

### Index Utilization

Triple Intelligence leverages all available indexes:
- **HNSW Index**: For vector similarity
- **Metadata Index**: For metadata filtering
- **Graph Index**: For relationship traversal

## Advanced Features

### Explain Mode

Understand how your query was executed:

```typescript
const results = await brain.find({
  like: "quantum computing",
  where: { category: "research" },
  explain: true
})

console.log(results[0].explanation)
// {
//   plan: "field-first-progressive",
//   timing: {
//     fieldFilter: 2,
//     vectorSearch: 8,
//     fusion: 1
//   },
//   selectivity: {
//     field: 0.1,
//     vector: 0.3
//   }
// }
```

### Boosting

Apply custom ranking boosts:

```typescript
const results = await brain.find({
  like: "news articles",
  boost: 'recent',  // Boost recent items
  where: { verified: true }
})
```

### Threshold Control

Set minimum similarity thresholds:

```typescript
const results = await brain.find({
  like: "exact match needed",
  threshold: 0.9,  // Only very similar results
  limit: 10
})
```

## Best Practices

### Query Design

1. **Start specific**: Use selective filters when possible
2. **Combine intelligently**: Don't force all three types if not needed
3. **Use limits**: Always specify reasonable result limits
4. **Cache results**: For repeated queries, cache at application level

### Performance Tips

1. **Index first**: Ensure fields used in `where` clauses are indexed
2. **Batch operations**: Use batch methods for bulk queries
3. **Monitor plans**: Use explain mode to understand performance
4. **Optimize patterns**: Train custom patterns for your domain

### Common Patterns

#### Semantic Search with Filtering
```typescript
// Find similar content with constraints
const results = await brain.find({
  like: query,
  where: { 
    status: 'published',
    language: 'en'
  }
})
```

#### Related Items Discovery
```typescript
// Find items related to a specific item
const results = await brain.find({
  connected: { 
    to: itemId,
    depth: 2,
    type: 'similar'
  },
  limit: 20
})
```

#### Time-based Queries
```typescript
// Recent items matching criteria
const results = await brain.find({
  where: {
    timestamp: { $gte: Date.now() - 86400000 }
  },
  like: "trending topics",
  boost: 'recent'
})
```

## Natural Language Processing

The `find()` method includes advanced NLP capabilities powered by 220+ embedded patterns that understand natural language queries.

### Supported Query Types

```typescript
// Temporal queries
await brain.find("documents from last week")
await brain.find("reports created yesterday")
await brain.find("articles published in Q3 2024")
await brain.find("data from January to March")

// Numeric filters
await brain.find("products with price under $100")
await brain.find("articles with more than 1000 views")
await brain.find("reports showing revenue over 10M")

// Combined conditions
await brain.find("verified research papers about AI from 2024 with high citations")
await brain.find("recent customer reviews with rating above 4 stars")
await brain.find("blog posts by John Smith about machine learning published this month")

// Relationship queries
await brain.find("documents related to project X")
await brain.find("people who work at TechCorp")
await brain.find("products similar to iPhone")
```

### How It Works

1. **Intent Detection**: Identifies what the user is looking for
2. **Entity Extraction**: Extracts names, dates, numbers, categories
3. **Temporal Parsing**: Converts "last week", "Q3 2024" to date ranges
4. **Filter Generation**: Creates appropriate where clauses
5. **Query Fusion**: Combines NLP understanding with vector search

### Pattern Coverage

Brainy includes 220+ pre-computed patterns covering:
- **Temporal**: 40+ patterns for dates and time ranges
- **Numeric**: 30+ patterns for comparisons and ranges
- **Relationships**: 25+ patterns for connections
- **Actions**: 35+ patterns for verbs and intents
- **Entities**: 40+ patterns for people, places, things
- **Domain-specific**: 50+ patterns for tech, business, social

## API Reference

See the [Triple Intelligence API](../api/triple-intelligence.md) for complete method documentation.