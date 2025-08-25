# 🧠 Brainy 2.0 CORRECT API Reference

> **The actual API we need, with all features, correct operators, and proper methods**

## 📚 CORE DATA OPERATIONS

### Nouns (Vectors with Metadata)
```typescript
// Single Operations
addNoun(textOrVector, metadata?)           // Auto-embeds text
getNoun(id)                                // Get one noun
updateNoun(id, textOrVector?, metadata?)   // Update noun
deleteNoun(id)                             // Delete noun
hasNoun(id)                                // Check existence

// Metadata
getNounMetadata(id)                        // Metadata only
updateNounMetadata(id, metadata)           // Update metadata
getNounWithVerbs(id)                       // With relationships

// Batch
addNouns(items[])                         // Add multiple
getNouns(idsOrOptions)                    // Get multiple (unified)
deleteNouns(ids[])                        // Delete multiple
```

### Verbs (Relationships)
```typescript
addVerb(source, target, type, metadata?)   // Create relationship
getVerb(id)                                // Get verb
deleteVerb(id)                             // Delete verb
getVerbsBySource(sourceId)                // Outgoing
getVerbsByTarget(targetId)                // Incoming
getVerbsByType(type)                      // By type
```

## 🔍 SEARCH (Simplified & Powerful)

```typescript
// Just TWO search methods:
search(query, k?)                         // Simple convenience
find(query)                               // TRIPLE INTELLIGENCE 🧠
```

### Find Query Structure (with CORRECT Brainy Operators):
```typescript
find({
  // Vector search
  like: 'text' | vector | {id: 'noun-id'},
  
  // Metadata filtering with BRAINY OPERATORS (NOT MongoDB!)
  where: {
    // Direct equality
    field: value,
    
    // Brainy operators (NO $ prefix!)
    field: {
      equals: value,              // Exact match
      notEquals: value,           // Not equal
      greaterThan: value,        // Greater than
      greaterEqual: value,       // Greater or equal
      lessThan: value,           // Less than
      lessEqual: value,          // Less or equal
      oneOf: [values],           // In array (NOT $in)
      notOneOf: [values],        // Not in array
      contains: value,           // Contains (arrays/strings)
      startsWith: value,         // String starts with
      endsWith: value,           // String ends with
      matches: pattern,          // Pattern match (NOT $regex)
      between: [min, max]        // Between two values
    }
  },
  
  // Graph traversal
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

## 🧠 NEURAL API (Complete)

```typescript
// Access via brain.neural
brain.neural.similar(a, b)                // Semantic similarity
brain.neural.clusters(options?)           // Auto-clustering
brain.neural.hierarchy(id)                // Semantic hierarchy
brain.neural.neighbors(id, k?)            // K nearest neighbors
brain.neural.outliers(threshold?)         // Outlier detection
brain.neural.semanticPath(from, to)       // Path finding
brain.neural.visualize(options?)          // Visualization data

// Enterprise performance methods
brain.neural.clusterFast(options?)        // O(n) HNSW clustering
brain.neural.clusterLarge(options?)       // Million-item clustering
brain.neural.clusterStream(options?)      // Progressive streaming
```

### Visualization Data Format:
```typescript
brain.neural.visualize({
  maxNodes: 100,
  dimensions: 2 | 3,
  algorithm: 'force' | 'hierarchical' | 'radial',
  includeEdges: true
})

// Returns:
{
  format: 'd3' | 'cytoscape' | 'graphml',
  nodes: [{
    id: string,
    x: number,
    y: number,
    z?: number,
    label: string,
    cluster?: number,
    metadata: any
  }],
  edges: [{
    source: string,
    target: string,
    type: string,
    weight?: number
  }],
  layout: {
    dimensions: 2 | 3,
    algorithm: string,
    bounds: {min: [x,y,z], max: [x,y,z]}
  }
}
```

## 📥 NEURAL IMPORT (Simple & Powerful)

```typescript
// One simple method for smart import
brain.neuralImport(data, options?)

// Options:
{
  confidenceThreshold: 0.7,   // Min confidence for entities
  autoApply: false,           // Auto-add to database
  enableWeights: true,        // Use confidence weights
  previewOnly: false,         // Just preview, don't import
  skipDuplicates: true,       // Skip existing entities
  format?: 'auto' | 'csv' | 'json' | 'text'  // Auto-detect by default
}

// Returns:
{
  detectedEntities: [{
    suggestedId: string,
    nounType: string,
    confidence: number,
    originalData: any
  }],
  detectedRelationships: [{
    sourceId: string,
    targetId: string,
    verbType: string,
    confidence: number
  }],
  confidence: number,          // Overall confidence
  insights: string[],          // AI insights
  preview: string             // Human-readable preview
}
```

## 🎯 VERB SCORING

```typescript
brain.verbScoring.train(feedback)         // Train model
brain.verbScoring.getScore(verbId)        // Get score
brain.verbScoring.export()                // Export training
brain.verbScoring.import(data)            // Import training
brain.verbScoring.stats()                 // Statistics
```

## 🔄 SYNC & DISTRIBUTION

### Conduits (Brainy-to-Brainy)
```typescript
brain.conduit.establish(url)              // Connect to another Brainy
brain.conduit.sync()                      // Sync data
brain.conduit.close()                     // Disconnect
```

### Synapses (External Platforms)
```typescript
brain.synapse.notion.connect(config)      // Notion integration
brain.synapse.slack.connect(config)       // Slack integration
brain.synapse.salesforce.connect(config)  // Salesforce
brain.synapse.custom(name, config)        // Custom platform
```

## 📊 MONITORING & STATS

```typescript
brain.size()                              // Total nouns
brain.stats()                             // Full statistics
brain.health()                            // Health check
brain.cache.stats()                       // Cache stats
brain.cache.clear()                       // Clear cache
```

## 💾 DATA MANAGEMENT

```typescript
brain.clear(options?)                     // Clear all
brain.clearNouns()                        // Clear nouns only
brain.clearVerbs()                        // Clear verbs only
brain.backup()                            // Create backup
brain.restore(backup)                     // Restore
```

## 🚀 LIFECYCLE

```typescript
const brain = new BrainyData(config?)     // Create
await brain.init()                        // Initialize (REQUIRED!)
await brain.shutdown()                    // Cleanup

// Configuration
{
  storage: 'auto' | 'memory' | 'filesystem' | 's3',
  dimensions: 384,
  cache: true,
  index: true,
  augmentations: []
}
```

## ⚙️ EMBEDDINGS

```typescript
brain.embed(text)                         // Generate embedding
brain.similarity(a, b)                    // Calculate similarity
```

## 🎲 UTILITIES

```typescript
brain.generateRandomGraph(nodes, edges)   // Test data
```

---

## ✅ KEY CORRECTIONS FROM MISTAKES:

1. **NO MongoDB operators** - We use Brainy operators (legal reasons)
2. **Neural API is complete** - All clustering, visualization methods
3. **Simple neuralImport** - One method, smart detection
4. **Visualization exports** - For D3, Cytoscape, GraphML
5. **search() is just convenience** - Not a complete alias
6. **find() has Triple Intelligence** - Vector + Graph + Metadata
7. **Proper operator names** - greaterThan not $gt
8. **Complete clustering API** - Fast, large, streaming options
9. **Synapses and Conduits** - External and internal sync
10. **Verb scoring** - Intelligent relationship scoring