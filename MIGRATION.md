# Migration Guide: Brainy 1.x → 2.0

This guide helps you migrate from Brainy 1.x to the new 2.0 release with Triple Intelligence Engine.

## 🚨 Breaking Changes

### 1. Search Result Format
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

### 2. Storage Configuration
**Before (1.x):**
```typescript
const brain = new BrainyData("./data")
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

### 3. Metadata Filtering
**Before (1.x):**
```typescript
// Limited filtering capabilities
const results = await brain.search("query", { category: "tech" })
```

**After (2.0):**
```typescript
// Advanced field filtering with O(1) performance
const results = await brain.search("query", {
  where: {
    category: "tech",
    rating: { $gte: 4.0 },
    date: { $between: ["2024-01-01", "2024-12-31"] }
  }
})
```

## ✨ New Features in 2.0

### Triple Intelligence Engine
Combine three types of intelligence in a single query:

```typescript
// Vector similarity + Field filtering + Graph relationships
const results = await brain.search("machine learning algorithms", {
  where: {
    category: { $in: ["ai", "technology"] },
    difficulty: { $lte: 5 }
  },
  includeRelated: true,
  depth: 2
})
```

### Brain Patterns Query Language
MongoDB-compatible syntax with semantic extensions:

```typescript
const results = await brain.find({
  $or: [
    { category: "technology" },
    { $vector: { $similar: "artificial intelligence", threshold: 0.8 } }
  ],
  published: { $gte: "2024-01-01" }
})
```

### Universal Storage Support
```typescript
// File System (default)
const brain = new BrainyData({
  storage: { type: 'filesystem', path: './data' }
})

// Amazon S3 / Compatible
const brain = new BrainyData({
  storage: {
    type: 's3',
    bucket: 'my-data',
    region: 'us-east-1'
  }
})

// Origin Private File System (Browser)
const brain = new BrainyData({
  storage: { type: 'opfs' }
})
```

## 🔄 Migration Steps

### Step 1: Update Package
```bash
npm install brainy@2.0.0
```

### Step 2: Update Initialization
```typescript
// Old
const brain = new BrainyData("./data")

// New  
const brain = new BrainyData({
  storage: {
    type: 'filesystem',
    path: './data'
  }
})
```

### Step 3: Update Search Result Handling
```typescript
// Old
const results = await brain.search("query")
for (const [id, score] of results) {
  const item = await brain.get(id)
  console.log(item.content, score)
}

// New
const results = await brain.search("query")  
for (const result of results) {
  console.log(result.content, result.score)
}
```

### Step 4: Upgrade Filtering (Optional)
```typescript
// Old basic filtering
const results = await brain.search("query", { category: "tech" })

// New advanced filtering  
const results = await brain.search("query", {
  where: {
    category: "tech",
    rating: { $gte: 4.0 }
  }
})
```

## 📊 Performance Improvements

### Automatic Data Migration
- Brainy 2.0 automatically migrates your existing 1.x data
- No manual data conversion required
- First startup may take longer for large datasets

### New Indexing Performance
- 10x faster metadata filtering with field indexes
- Sub-millisecond vector search with HNSW indexing  
- Smart caching reduces repeated query latency

## 🛠 Compatibility Mode

Enable 1.x compatibility for gradual migration:

```typescript
const brain = new BrainyData({
  compatibility: {
    version: "1.x",
    searchResultFormat: "array" // Use old [id, score] format
  }
})
```

## 🔧 New APIs to Explore

### Clustering
```typescript
const clusters = await brain.cluster({ 
  algorithm: 'kmeans',
  numClusters: 5 
})
```

### Relationship Discovery
```typescript
const related = await brain.findRelated(itemId, {
  depth: 2,
  minSimilarity: 0.7
})
```

### Statistics & Analytics
```typescript
const stats = await brain.statistics()
console.log(`Total items: ${stats.totalItems}`)
console.log(`Query performance: ${stats.avgQueryTime}ms`)
```

## 🆘 Need Help?

- **Issues**: Report bugs at [GitHub Issues](https://github.com/brainy-org/brainy/issues)  
- **Discussions**: Get help at [GitHub Discussions](https://github.com/brainy-org/brainy/discussions)
- **Examples**: Check the `/examples` directory for migration examples

## 📋 Migration Checklist

- [ ] Updated to Brainy 2.0
- [ ] Changed initialization to new config format
- [ ] Updated search result handling from arrays to objects
- [ ] Tested core functionality with your data
- [ ] Explored new Triple Intelligence features
- [ ] Updated tests to use new API patterns
- [ ] Leveraged new storage adapters (if applicable)

**Migration typically takes 15-30 minutes for most applications.**