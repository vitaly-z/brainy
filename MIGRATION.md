# Migration Guide: Brainy 1.x → 2.0

This guide helps you migrate from Brainy 1.x to the new 2.0 release with Triple Intelligence Engine.

## 🚨 Breaking Changes Summary

### 1. API Consolidation: 15+ Methods → 2 Clean APIs

Brainy 2.0 consolidates all search methods into just 2 primary APIs:
- `search()` - Vector similarity search
- `find()` - Intelligent natural language queries

### 2. Search Result Format Changed

**Before (1.x):**
```typescript
const results = await brain.search("query")
// Returns: [["id1", 0.9], ["id2", 0.8]]
```

**After (2.0):**
```typescript
const results = await brain.search("query")
// Returns: [{id: "id1", score: 0.9, content: "...", metadata: {...}}, ...]
```

### 3. Method Signature Changes

**Before (1.x):**
```typescript
// Old 3-parameter search
await brain.search(query, limit, options)
await brain.searchByVector(vector, k)
await brain.searchByNounTypes(query, k, types)
await brain.searchWithMetadata(query, k, filters)
// ... 15+ different methods
```

**After (2.0):**
```typescript
// New unified 2-parameter API
await brain.search(query, options)
await brain.find(query, options)
```

## 📦 New Unified API Reference

### `search()` - Vector Similarity Search
```typescript
await brain.search(query, {
  // Pagination
  limit?: number,          // Max results (default: 10, max: 10000)
  offset?: number,         // Skip N results
  cursor?: string,         // Cursor-based pagination
  
  // Filtering
  metadata?: any,          // O(log n) metadata filters
  nounTypes?: string[],    // Filter by types
  itemIds?: string[],      // Search within specific items
  
  // Performance
  parallel?: boolean,      // Enable parallel search (default: true)
  timeout?: number,        // Operation timeout in ms
  
  // Response Options
  includeVectors?: boolean,
  includeContent?: boolean
})
```

### `find()` - Intelligent Natural Language Queries
```typescript
// Simple natural language query
await brain.find("recent JavaScript frameworks with good performance")

// Structured query with Triple Intelligence
await brain.find({
  like: "JavaScript",           // Vector similarity
  where: {                      // Metadata filtering
    year: { greaterThan: 2020 },
    performance: "high"
  },
  related: {                     // Graph relationships
    to: "React",
    depth: 2
  }
}, {
  limit: 10,
  mode: 'auto'  // auto | semantic | structured
})
```

## 🔄 Migration Steps

### Step 1: Update Search Calls

```typescript
// OLD (1.x)
const results = await brain.search("query", 10, {
  metadata: { type: "document" }
})

// NEW (2.0)
const results = await brain.search("query", {
  limit: 10,
  metadata: { type: "document" }
})
```

### Step 2: Update Result Handling

```typescript
// OLD (1.x)
const results = await brain.search("query")
results.forEach(([id, score]) => {
  console.log(`ID: ${id}, Score: ${score}`)
})

// NEW (2.0)
const results = await brain.search("query")
results.forEach(result => {
  console.log(`ID: ${result.id}, Score: ${result.score}`)
  console.log(`Content: ${result.content}`)
  console.log(`Metadata:`, result.metadata)
})
```

### Step 3: Replace Deprecated Methods

| Old Method (1.x) | New Method (2.0) |
|-----------------|------------------|
| `searchByVector(vector, k)` | `search(vector, { limit: k })` |
| `searchByNounTypes(q, k, types)` | `search(q, { limit: k, nounTypes: types })` |
| `searchWithMetadata(q, k, filters)` | `search(q, { limit: k, metadata: filters })` |
| `searchWithCursor(q, k, cursor)` | `search(q, { limit: k, cursor })` |
| `searchSimilar(id, k)` | `search(id, { limit: k, mode: 'similar' })` |
| `semanticSearch(q)` | `find(q)` |
| `complexSearch(q, filters, opts)` | `find({ like: q, where: filters }, opts)` |

### Step 4: Update Storage Configuration

**Before (1.x):**
```typescript
const brain = new BrainyData({
  type: 'filesystem',
  path: './data'
})
```

**After (2.0):**
```typescript
const brain = new BrainyData({
  storage: {
    type: 'filesystem',
    path: './data'
  }
})
```

### Step 5: Update CLI Commands

If using the CLI, update your commands:

```bash
# OLD (1.x)
brainy search-similar --id xyz --limit 5

# NEW (2.0)  
brainy search xyz --limit 5 --mode similar
```

## ✨ New Features in 2.0

### Triple Intelligence Engine
- Vector search + Graph relationships + Metadata filtering
- O(log n) performance on all operations
- 220+ pre-computed NLP patterns

### Zero Configuration
- Works instantly with no setup
- Automatic model loading
- Smart defaults for everything

### Enhanced Natural Language
```typescript
// Natural language queries now understand context
await brain.find("Show me recent React components with tests")
await brain.find("Popular JavaScript libraries similar to Vue")
await brain.find("Documentation about authentication from last month")
```

### Improved Performance
- 3ms average search latency
- 24MB memory footprint
- Worker-based embeddings
- Automatic caching

## 🔍 Validation

After migration, validate your system:

```typescript
// Test basic search
const results = await brain.search("test query")
console.assert(results[0].id !== undefined, "Result should have ID")
console.assert(results[0].score !== undefined, "Result should have score")

// Test natural language
const nlpResults = await brain.find("recent important documents")
console.assert(Array.isArray(nlpResults), "Should return array")

// Test metadata filtering
const filtered = await brain.search("*", {
  metadata: { type: "document" }
})
console.assert(filtered.length > 0, "Should find filtered results")
```

## 💡 Tips

1. **Start with `find()`** for natural language queries
2. **Use `search()`** for vector similarity when you know exactly what you want
3. **Leverage metadata filters** for O(log n) performance
4. **Enable cursor pagination** for large result sets
5. **Use the new CLI** for testing: `brainy find "your query"`

## 📚 Resources

- [API Documentation](docs/api/README.md)
- [Triple Intelligence Guide](docs/architecture/triple-intelligence.md)
- [Natural Language Guide](docs/guides/natural-language.md)
- [Getting Started](docs/guides/getting-started.md)

## 🆘 Need Help?

- GitHub Issues: [github.com/brainy-org/brainy/issues](https://github.com/brainy-org/brainy/issues)
- Documentation: [docs/README.md](docs/README.md)

---

*Brainy 2.0 - Zero-Configuration AI Database with Triple Intelligence™*