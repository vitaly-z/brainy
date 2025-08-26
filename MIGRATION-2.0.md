# 🚀 Brainy 2.0 Migration Guide

## Breaking Changes - Consolidated Search API

Brainy 2.0 consolidates 15+ search methods into just 2 primary APIs: `search()` and `find()`. This simplifies the API surface and makes Brainy easier to use while maintaining all functionality through options.

## New Primary APIs

### 1. `search()` - Vector Similarity Search
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
  excludeDeleted?: boolean,// Filter soft-deleted (default: true)
  
  // Enhancement
  includeVerbs?: boolean,  // Include relationships
  threshold?: number,      // Min similarity score
  
  // Performance
  useCache?: boolean,      // Use cache (default: true)
  timeout?: number        // Query timeout (ms)
})
```

### 2. `find()` - Natural Language & Complex Queries
```typescript
await brain.find(query, {
  // Pagination
  limit?: number,
  offset?: number,
  cursor?: string,
  
  // Triple Intelligence
  mode?: 'auto' | 'vector' | 'graph' | 'metadata' | 'fusion',
  maxDepth?: number,       // Graph traversal depth
  parallel?: boolean,      // Parallel execution
  
  // Filtering
  excludeDeleted?: boolean
})
```

## Migration Table

| Old Method | Migration Path |
|------------|---------------|
| `searchByNounTypes(query, 10, ['type1'])` | `search(query, { limit: 10, nounTypes: ['type1'] })` |
| `searchWithCursor(query, 10, { cursor })` | `search(query, { limit: 10, cursor })` |
| `searchWithinItems(query, ids, 10)` | `search(query, { limit: 10, itemIds: ids })` |
| `searchText('text', 10)` | `search('text', { limit: 10 })` |
| `searchLocal(query, 10, opts)` | `search(query, { limit: 10, ...opts })` |

## Deprecated Methods

The following methods are deprecated in 2.0 but still work for backward compatibility:

- `searchByNounTypes()` → Use `search()` with `nounTypes` option
- `searchWithCursor()` → Use `search()` with `cursor` option  
- `searchWithinItems()` → Use `search()` with `itemIds` option
- `searchText()` → Use `search()` directly with text
- `searchLocal()` → Use `search()` with options

## Specialized Methods (Still Available)

These methods provide unique functionality and remain available:

- `findSimilar(id, options)` - Find similar items to an existing entity
- `searchVerbs(query, options)` - Search relationships/verbs specifically
- `searchNounsByVerbs(query, options)` - Graph traversal search
- `searchByStandardField(field, term)` - Cross-service field standardization

## Examples

### Before (Multiple Methods)
```javascript
// Search with noun types
const results1 = await brain.searchByNounTypes('AI', 10, ['article', 'paper'])

// Search with cursor
const results2 = await brain.searchWithCursor('ML', 20, { 
  cursor: 'abc123',
  metadata: { year: 2024 }
})

// Search within items
const results3 = await brain.searchWithinItems('deep learning', itemIds, 10)

// Text search
const results4 = await brain.searchText('neural networks', 10)
```

### After (Consolidated)
```javascript
// All functionality through search()
const results1 = await brain.search('AI', {
  limit: 10,
  nounTypes: ['article', 'paper']
})

const results2 = await brain.search('ML', {
  limit: 20,
  cursor: 'abc123',
  metadata: { year: 2024 }
})

const results3 = await brain.search('deep learning', {
  limit: 10,
  itemIds: itemIds
})

const results4 = await brain.search('neural networks', {
  limit: 10
})
```

### Advanced Natural Language Queries
```javascript
// Simple natural language
const results = await brain.find('papers about AI from last year')

// Complex structured query with pagination
const results = await brain.find({
  like: 'machine learning',
  where: { 
    year: { greaterThan: 2020 },
    type: 'research'
  },
  connected: { 
    from: 'authorId123',
    verb: 'CREATED'
  }
}, {
  limit: 50,
  cursor: lastCursor,
  maxDepth: 3
})
```

## Performance Improvements

### Soft Deletes with O(log n) Performance
Both nouns and verbs now use soft deletes by default:
```javascript
// Soft delete (default) - O(log n) filtering via MetadataIndex
await brain.deleteNoun(id)  
await brain.deleteVerb(id)

// Hard delete (optional) - physical removal
await brain.deleteNoun(id, { hard: true })
await brain.deleteVerb(id, { hard: true })
```

### Query Safety
- Maximum result limit: 10,000 items
- Automatic pagination with cursor support
- Graph traversal depth limits
- Timeout protection for long-running queries

## Benefits of Consolidation

1. **Simpler API**: 2 methods instead of 15+
2. **Consistent Interface**: Same options pattern for both search and find
3. **Better Performance**: O(log n) metadata filtering, automatic pagination
4. **Future-Proof**: New features added as options, not new methods
5. **Cleaner Code**: Less methods to remember and document

## Support

The deprecated methods will continue to work in 2.0 but will be removed in 3.0. We recommend migrating to the new consolidated APIs as soon as possible for the best performance and feature support.