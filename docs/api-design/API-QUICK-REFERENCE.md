# 🧠 Brainy 2.0 Quick Reference Card

## Core Operations
```typescript
// Nouns
await brain.addNoun(vector, metadata)     // Create
await brain.getNoun(id)                   // Read
await brain.updateNoun(id, vector?, meta?) // Update  
await brain.deleteNoun(id)                // Delete

// Verbs
await brain.addVerb(source, target, type) // Create relationship
await brain.getVerb(id)                   // Get relationship
await brain.deleteVerb(id)                // Delete relationship

// Metadata
await brain.getNounMetadata(id)           // Get metadata only
await brain.updateNounMetadata(id, meta)  // Update metadata only
await brain.hasNoun(id)                   // Check existence
```

## Search
```typescript
await brain.search(query, k?)             // Vector search
await brain.searchText('natural language') // NLP search
await brain.findSimilar(id, k?)           // Similarity search
await brain.find(tripleQuery)             // Triple Intelligence 🧠
```

## Graph
```typescript
await brain.getConnections(id)            // All connections
await brain.getVerbsBySource(id)          // Outgoing
await brain.getVerbsByTarget(id)          // Incoming
await brain.getVerbsByType(type)          // By type
```

## Management
```typescript
brain.getCacheStats()                      // Cache stats
brain.clearCache()                         // Clear cache
brain.size()                              // Total count
await brain.getStats()                    // All statistics
await brain.clear()                       // Clear all data
```

## Lifecycle
```typescript
const brain = new BrainyData()            // Create
await brain.init()                        // Initialize
await brain.shutdown()                    // Cleanup
```

## Configuration
```typescript
new BrainyData({
  storage: 'auto',      // auto | memory | filesystem | s3
  cache: true,          // Enable caching
  index: true,          // Enable indexing
  dimensions: 384       // Vector dimensions
})
```