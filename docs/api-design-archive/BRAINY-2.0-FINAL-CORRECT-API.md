# 🧠 Brainy 2.0 Final API Reference

> **The definitive API - Clean, Correct, Complete**

## ✅ KEY CORRECTIONS FROM REVIEW:
1. **Brainy Operators (NOT MongoDB)** - `greaterThan` not `$gt`
2. **Neural API is complete** - All methods available via `brain.neural`
3. **Code is correct** - Implementation uses right operators, just docs were wrong
4. **Nothing lost** - All features still present, just reorganized

---

## 📚 CORE DATA OPERATIONS

### Nouns
```typescript
// Single
addNoun(textOrVector, metadata?)           // Auto-embeds text!
getNoun(id)
updateNoun(id, textOrVector?, metadata?)
deleteNoun(id)
hasNoun(id)

// Metadata
getNounMetadata(id)
updateNounMetadata(id, metadata)
getNounWithVerbs(id)

// Batch
addNouns(items[])
getNouns(idsOrOptions)                    // Unified: IDs, filter, or pagination
deleteNouns(ids[])
```

### Verbs
```typescript
addVerb(source, target, type, metadata?)
getVerb(id)
deleteVerb(id)
getVerbsBySource(sourceId)
getVerbsByTarget(targetId)
getVerbsByType(type)
```

## 🔍 SEARCH

Just TWO methods - simple and powerful:

```typescript
search(query, k?)         // Convenience: same as find({like: query, limit: k})
find(query)              // TRIPLE INTELLIGENCE: Vector + Graph + Metadata
```

### Find Query (with CORRECT Brainy Operators):
```typescript
find({
  // Vector
  like: 'text' | vector | {id: 'noun-id'},
  
  // Fields (BRAINY operators, NOT MongoDB!)
  where: {
    field: value,                    // Direct equality
    field: {
      equals: value,
      greaterThan: value,           // NOT $gt
      lessThan: value,              // NOT $lt
      greaterEqual: value,
      lessEqual: value,
      oneOf: [values],              // NOT $in
      notOneOf: [values],           // NOT $nin
      contains: value,
      startsWith: value,
      endsWith: value,
      matches: pattern,             // NOT $regex
      between: [min, max]
    }
  },
  
  // Graph
  connected: {
    to: 'id',
    from: 'id',
    via: 'type',
    depth: 2
  },
  
  // Control
  limit: 10,
  offset: 0,
  explain: true
})
```

## 🧠 NEURAL API

Complete and available via `brain.neural`:

```typescript
brain.neural.similar(a, b)              // Similarity 0-1
brain.neural.clusters()                 // Auto-clustering
brain.neural.hierarchy(id)              // Semantic tree
brain.neural.neighbors(id, k?)          // K-nearest
brain.neural.outliers(threshold?)       // Outlier detection
brain.neural.semanticPath(from, to)     // Path finding
brain.neural.visualize(options?)        // For D3/Cytoscape/GraphML

// Performance
brain.neural.clusterFast()              // O(n) HNSW
brain.neural.clusterLarge()             // Million+ items
brain.neural.clusterStream()            // Progressive
```

### Visualization Format:
```typescript
brain.neural.visualize({
  maxNodes: 100,
  dimensions: 2,
  algorithm: 'force',
  includeEdges: true
})
// Returns: {
//   format: 'd3' | 'cytoscape' | 'graphml',
//   nodes: [...], edges: [...], layout: {...}
// }
```

## 📥 IMPORT

Simple, AI-powered:

```typescript
brain.neuralImport(data, options?)      // Auto-detects format!
// Options: {
//   confidenceThreshold: 0.7,
//   autoApply: false,
//   skipDuplicates: true
// }
```

## 🎯 INTELLIGENCE

```typescript
// Verb Scoring
provideFeedbackForVerbScoring(feedback)
getVerbScoringStats()
exportVerbScoringLearningData()
importVerbScoringLearningData(data)

// Embeddings
embed(text)                             // Generate vector
calculateSimilarity(a, b, metric?)      // Compare
```

## 🔄 SYNC

```typescript
// Remote
connectToRemoteServer(url)
disconnectFromRemoteServer()
isConnectedToRemoteServer()

// Real-time
enableRealtimeUpdates(config)
disableRealtimeUpdates()
checkForUpdatesNow()

// Search modes
searchLocal(query, k?)
searchRemote(query, k?)
searchCombined(query, k?)
```

## 📊 MONITORING

```typescript
size()                                  // Total nouns
getStatistics()                         // Full stats
getHealthStatus()                       // Health
getCacheStats()                         // Cache
clearCache()                            // Clear
```

## ⚙️ CONFIGURATION

```typescript
// Modes
setReadOnly(bool)
setWriteOnly(bool)
setFrozen(bool)

// Augmentations
augmentations.register(aug)
augmentations.list()
augmentations.get(name)
```

## 💾 DATA MANAGEMENT

```typescript
clear(options?)                         // Clear all
clearNouns()                           // Nouns only
clearVerbs()                           // Verbs only
backup()                               // Create backup
restore(backup)                        // Restore
rebuildMetadataIndex()                 // Rebuild index
```

## 🚀 LIFECYCLE

```typescript
const brain = new BrainyData({
  storage: 'auto',                     // auto | memory | filesystem | s3
  dimensions: 384,
  cache: true,
  index: true
})

await brain.init()                     // REQUIRED!
await brain.shutdown()                 // Cleanup

// Static
BrainyData.preloadModel()              // Preload
BrainyData.warmup()                    // Warmup
```

---

## ✨ What Makes Brainy 2.0 Special:

1. **Zero-Config** - Works instantly, no setup
2. **Auto-Embedding** - Text automatically becomes vectors
3. **Triple Intelligence** - Vector + Graph + Metadata combined
4. **Brainy Operators** - Clean, legal, no MongoDB style
5. **Complete Neural API** - All clustering/viz features
6. **Simple Import** - One method, auto-detects everything
7. **Clean Architecture** - Augmentations for extensibility

## 🎯 Remember:
- **NO $operators** - We use readable names (legal requirement)
- **search() is simple** - Just wraps find({like: query})
- **find() is powerful** - Full Triple Intelligence
- **neural API complete** - All methods via brain.neural
- **Everything included** - No premium features, all MIT