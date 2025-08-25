# 🧠 Brainy 2.0 Unified Public API

> **The complete, accurate API based on actual implementation**

## 📚 CORE DATA OPERATIONS

### Nouns (Vectors with Metadata)

```typescript
// === SINGLE OPERATIONS ===
addNoun(textOrVector, metadata?)           // Add noun (auto-embeds text)
getNoun(id)                                // Get one noun
updateNoun(id, textOrVector?, metadata?)   // Update noun
deleteNoun(id)                             // Delete noun
hasNoun(id)                                // Check if exists

// === METADATA OPERATIONS ===
getNounMetadata(id)                        // Get metadata only
updateNounMetadata(id, metadata)           // Update metadata only
getNounWithVerbs(id)                       // Get noun with relationships

// === BATCH OPERATIONS ===
addNouns(items[])                         // Add multiple nouns
getNouns(idsOrOptions)                    // Get multiple (unified method)
  // getNouns(['id1', 'id2'])             // By IDs
  // getNouns({filter: {...}})            // By filter
  // getNouns({limit: 10, offset: 20})    // Paginated
deleteNouns(ids[])                        // Delete multiple
```

### Verbs (Relationships)

```typescript
// === SINGLE OPERATIONS ===
addVerb(source, target, type, metadata?)   // Create relationship
getVerb(id)                                // Get verb
deleteVerb(id)                             // Delete verb

// === QUERY OPERATIONS ===
getVerbsBySource(sourceId)                // Outgoing relationships
getVerbsByTarget(targetId)                // Incoming relationships
getVerbsByType(type)                      // By relationship type
getVerbs(filter?)                         // Get filtered verbs
deleteVerbs(ids[])                        // Delete multiple
```

## 🔍 SEARCH & INTELLIGENCE

### Primary Search Methods

```typescript
// === TWO MAIN METHODS ===
search(query, k?)                         // Simple vector search
  // Equivalent to: find({like: query, limit: k})

find(query)                               // TRIPLE INTELLIGENCE 🧠
  // Combines Vector + Graph + Field search
```

### Find Query Structure

```typescript
find({
  // === VECTOR SEARCH ===
  like: 'text query' | vector | {id: 'noun-id'},
  similar: 'text' | vector,                // Alternative to 'like'
  
  // === FIELD FILTERING (Brainy Operators) ===
  where: {
    // Direct equality
    field: value,
    
    // Brainy operators (CORRECT - NO MongoDB $)
    field: {
      equals: value,              // Exact match
      is: value,                  // Same as equals
      greaterThan: value,        // Greater than
      lessThan: value,           // Less than
      oneOf: [values],           // In array (NOT $in)
      contains: value            // Array/string contains
      // Note: Additional operators can be added
    }
  },
  
  // === GRAPH TRAVERSAL ===
  connected: {
    to: 'id' | ['id1', 'id2'],    // Target nodes
    from: 'id' | ['id1', 'id2'],  // Source nodes
    type: 'type' | ['type1'],      // Relationship types
    depth: 2,                      // Traversal depth
    direction: 'in' | 'out' | 'both'
  },
  
  // === CONTROL OPTIONS ===
  limit: 10,                      // Max results
  offset: 0,                      // Skip results
  explain: false,                 // Add explanations
  boost: 'recent' | 'popular'     // Result boosting
})
```

## 🧠 NEURAL API

Access via `brain.neural`:

```typescript
// === SIMILARITY & CLUSTERING ===
brain.neural.similar(a, b, options?)       // Semantic similarity (0-1)
brain.neural.clusters(input?)              // Auto-clustering
brain.neural.hierarchy(id)                 // Semantic hierarchy tree
brain.neural.neighbors(id, options?)       // K-nearest neighbors

// === ANALYSIS ===
brain.neural.outliers(threshold?)          // Outlier detection
brain.neural.semanticPath(from, to)        // Find semantic path

// === VISUALIZATION ===
brain.neural.visualize(options?)           // Export for visualization
  // options: {
  //   maxNodes: 100,
  //   dimensions: 2 | 3,
  //   algorithm: 'force' | 'hierarchical' | 'radial',
  //   includeEdges: true
  // }
  // Returns: {
  //   format: 'd3' | 'cytoscape' | 'graphml',
  //   nodes: [...], edges: [...], layout: {...}
  // }

// === PERFORMANCE METHODS ===
brain.neural.clusterFast(options?)         // O(n) HNSW clustering
brain.neural.clusterLarge(options?)        // Million+ items
brain.neural.clusterStream(options?)       // Progressive streaming
```

## 📥 IMPORT & EXPORT

### Neural Import

```typescript
// === SMART IMPORT (from cortex) ===
brain.neuralImport(filePath, options?)     // AI-powered import
  // options: {
  //   confidenceThreshold: 0.7,
  //   autoApply: false,
  //   enableWeights: true,
  //   previewOnly: false,
  //   skipDuplicates: true
  // }
  // Returns: {
  //   detectedEntities: [...],
  //   detectedRelationships: [...],
  //   confidence: 0.85,
  //   insights: [...],
  //   preview: "..."
  // }
```

### Standard Import/Export

```typescript
import(data, format)                      // Standard import
importSparseData(data)                    // Sparse format import
backup()                                   // Create full backup
restore(backup)                           // Restore from backup
```

## 🎯 VERB SCORING

```typescript
// === INTELLIGENT SCORING ===
provideFeedbackForVerbScoring(feedback)    // Train model
getVerbScoringStats()                      // Get statistics
exportVerbScoringLearningData()           // Export training
importVerbScoringLearningData(data)       // Import training
```

## 🔄 SYNC & DISTRIBUTION

### Remote Operations

```typescript
// === REMOTE CONNECTION ===
connectToRemoteServer(url, options?)       // Connect to remote
disconnectFromRemoteServer()               // Disconnect
isConnectedToRemoteServer()               // Check status

// === SEARCH MODES ===
searchLocal(query, k?)                     // Local only
searchRemote(query, k?)                    // Remote only
searchCombined(query, k?)                  // Both sources
```

### Real-time Sync

```typescript
enableRealtimeUpdates(config)              // Enable sync
disableRealtimeUpdates()                   // Disable sync
getRealtimeUpdateConfig()                  // Get config
checkForUpdatesNow()                       // Manual sync
```

## 📊 MONITORING & STATS

```typescript
// === STATISTICS ===
size()                                     // Total noun count
getStatistics(options?)                    // Full statistics
getServiceStatistics(service)              // Per-service stats
listServices()                             // List all services
flushStatistics()                          // Persist stats

// === HEALTH & CACHE ===
getHealthStatus()                          // System health
status()                                   // Full status report
getCacheStats()                            // Cache statistics
clearCache()                               // Clear all caches
```

## ⚙️ CONFIGURATION

### Operational Modes

```typescript
// === MODE CONTROL ===
isReadOnly() / setReadOnly(bool)          // Read-only mode
isWriteOnly() / setWriteOnly(bool)        // Write-only mode
isFrozen() / setFrozen(bool)              // Freeze all changes
```

### Augmentations

```typescript
// === AUGMENTATION SYSTEM ===
augmentations.register(augmentation)       // Add augmentation
augmentations.list()                       // List all
augmentations.get(name)                   // Get by name
```

## 💾 DATA MANAGEMENT

```typescript
// === CLEAR OPERATIONS ===
clear(options?)                           // Clear all data
clearNouns(options?)                      // Clear nouns only
clearVerbs(options?)                      // Clear verbs only

// === INDEX MANAGEMENT ===
rebuildMetadataIndex()                    // Rebuild index
getFilterFields()                         // Get indexed fields
getFilterValues(field)                    // Get unique values
```

## 🧬 EMBEDDINGS & SIMILARITY

```typescript
embed(text)                               // Generate embedding
calculateSimilarity(a, b, metric?)        // Calculate similarity
  // metric: 'cosine' | 'euclidean' | 'manhattan'
```

## 🔒 SECURITY

```typescript
encryptData(data)                         // Encrypt data
decryptData(data)                         // Decrypt data
```

## 🎲 UTILITIES

```typescript
generateRandomGraph(nodes, edges)         // Generate test data
getAvailableFieldNames()                  // Get field names
getStandardFieldMappings()                // Get field mappings
```

## 🚀 LIFECYCLE

```typescript
// === INITIALIZATION ===
const brain = new BrainyData(config?)     // Create instance
await brain.init()                        // Initialize (REQUIRED!)
await brain.shutDown()                    // Graceful shutdown
await brain.cleanup()                     // Clean resources

// === STATIC METHODS ===
BrainyData.preloadModel(options?)         // Preload ML model
BrainyData.warmup(options?)              // Warmup system
```

### Configuration Options

```typescript
new BrainyData({
  // Storage
  storage: 'auto' | 'memory' | 'filesystem' | 's3' | {
    adapter: 'custom',
    // ... storage options
  },
  
  // Vector configuration
  dimensions: 384,                 // Vector dimensions
  similarity: 'cosine',            // Similarity metric
  
  // Performance
  cache: true,                     // Enable caching
  index: true,                     // Enable indexing
  metrics: true,                   // Enable metrics
  
  // Advanced
  augmentations: [...],            // Custom augmentations
  verbose: false                   // Logging verbosity
})
```

## 📐 READ-ONLY PROPERTIES

```typescript
brain.dimensions                          // Vector dimensions
brain.maxConnections                      // HNSW max connections
brain.efConstruction                      // HNSW ef construction
brain.initialized                         // Is initialized?
```

---

## ✅ KEY POINTS:

1. **Brainy Operators** - NOT MongoDB style ($gt, $lt)
2. **Neural API** - Complete with visualization export
3. **Simple Search** - Just `search()` and `find()`
4. **Triple Intelligence** - Vector + Graph + Field in `find()`
5. **Auto-embedding** - `addNoun()` accepts text directly
6. **Unified Methods** - `getNouns()` handles all plural queries
7. **Clean Architecture** - Augmentation system for extensibility

## ⚠️ IMPORTANT NOTES:

- **NO MongoDB operators** - We use `greaterThan` not `$gt` (legal reasons)
- **Neural API is via brain.neural** - All clustering/viz methods available
- **search() is convenience** - Just wraps `find({like: query})`
- **find() is powerful** - Full Triple Intelligence capabilities
- **One import method** - `neuralImport()` auto-detects format