# 🧠 Brainy 2.0 API Reference

> **Philosophy**: Every method is specific, clear, and purposeful. No ambiguity, no duplicates.

## 📚 Core Data Operations

### Nouns (Vectors with Metadata)
```typescript
// Create
await brain.addNoun(vector, metadata)           // Add single noun
await brain.addNouns(items[])                   // Add multiple nouns

// Read  
await brain.getNoun(id)                         // Get single noun
await brain.getNouns(filter?)                   // Get multiple nouns
await brain.getNounWithVerbs(id)                // Get noun + relationships

// Update
await brain.updateNoun(id, vector?, metadata?)  // Update noun
await brain.updateNounMetadata(id, metadata)    // Update metadata only

// Delete
await brain.deleteNoun(id)                      // Delete single noun
await brain.deleteNouns(ids[])                  // Delete multiple nouns
```

### Verbs (Relationships)
```typescript
// Create
await brain.addVerb(source, target, type, metadata?)  // Add relationship

// Read
await brain.getVerb(id)                         // Get single verb
await brain.getVerbs(filter?)                   // Get multiple verbs
await brain.getVerbsBySource(sourceId)          // Get outgoing relationships
await brain.getVerbsByTarget(targetId)          // Get incoming relationships  
await brain.getVerbsByType(type)                // Get by relationship type

// Delete
await brain.deleteVerb(id)                      // Delete relationship
await brain.deleteVerbs(ids[])                  // Delete multiple relationships
```

## 🔍 Search Operations

### Vector Search
```typescript
await brain.search(query, k?, options?)         // Primary search method
await brain.searchText(text, k?, options?)      // Natural language search
await brain.findSimilar(id, k?, options?)       // Find similar to existing noun
await brain.searchWithCursor(query, cursor)     // Paginated search
```

### Advanced Search
```typescript
await brain.searchByNounTypes(types[], query)   // Filter by noun types
await brain.searchByMetadata(filter, query?)    // Filter by metadata
await brain.searchWithinNouns(ids[], query)     // Search within specific nouns
```

### Triple Intelligence 🧠
```typescript
await brain.find(query)                         // Unified Vector + Graph + Metadata search
// Examples:
await brain.find('documents about AI')          // Natural language
await brain.find({ like: 'sample-id' })        // Similar to ID
await brain.find({ where: { type: 'doc' }})    // Metadata filter
await brain.find({ connected: { to: id }})     // Graph traversal
```

## 🕸️ Graph Operations

```typescript
await brain.getConnections(id, depth?)          // Get all connections
await brain.findPath(sourceId, targetId)        // Find path between nouns
await brain.getNeighbors(id, hops?)            // Get graph neighbors
```

## 📊 Metadata & Filtering

```typescript
await brain.getNounMetadata(id)                 // Get metadata only
await brain.getFilterableFields()               // Get indexed fields
await brain.getFieldValues(field)               // Get unique values for field
```

## 🚀 Performance & Optimization

### Cache Management
```typescript
brain.getCacheStats()                           // Get cache statistics
brain.clearCache()                              // Clear search cache
```

### Statistics
```typescript
await brain.getStats()                          // Complete statistics
await brain.getServiceStats(service?)           // Service-specific stats
brain.getHealthStatus()                         // System health
brain.size()                                    // Total noun count
```

### Intelligent Features
```typescript
// Verb Scoring
await brain.trainVerbScoring(feedback)          // Provide training feedback
brain.getVerbScoringStats()                     // Get scoring statistics

// Real-time Updates
brain.enableRealtimeUpdates(config)             // Enable live sync
brain.disableRealtimeUpdates()                  // Disable live sync
await brain.syncNow()                           // Manual sync
```

## 🌐 Distributed Operations

```typescript
// Remote Connections
await brain.connectRemote(url, options?)        // Connect to remote instance
await brain.disconnectRemote()                  // Disconnect from remote
brain.isRemoteConnected()                       // Check connection status

// Search Modes
await brain.searchLocal(query)                  // Search local only
await brain.searchRemote(query)                 // Search remote only
await brain.searchHybrid(query)                 // Search both

// Operational Modes
brain.setReadOnly(enabled)                      // Toggle read-only mode
brain.setWriteOnly(enabled)                     // Toggle write-only mode
brain.freeze()                                  // Freeze all modifications
brain.unfreeze()                               // Unfreeze modifications
```

## 💾 Import/Export

```typescript
await brain.backup()                            // Create full backup
await brain.restore(backup)                     // Restore from backup
await brain.importData(data, format)            // Import external data
await brain.exportData(format)                  // Export data
```

## 🧹 Data Management

```typescript
await brain.clearNouns(options?)                // Clear all nouns
await brain.clearVerbs(options?)                // Clear all verbs
await brain.clearAll(options?)                  // Clear everything
await brain.rebuildIndex()                      // Rebuild metadata index
```

## 🔧 Utilities

```typescript
// Embeddings
await brain.embed(text)                         // Generate embedding
await brain.embedBatch(texts[])                 // Batch embeddings

// Similarity
await brain.calculateSimilarity(a, b)           // Compare vectors
await brain.calculateDistance(a, b, metric?)    // Calculate distance

// Encryption (if configured)
await brain.encrypt(data)                       // Encrypt data
await brain.decrypt(data)                       // Decrypt data
```

## 🎯 Lifecycle

```typescript
// Initialization
const brain = new BrainyData(config?)           // Create instance
await brain.init()                              // Initialize (required!)

// Cleanup
await brain.shutdown()                          // Graceful shutdown
await brain.cleanup()                           // Clean up resources
```

## ⚡ Static Methods

```typescript
// Model Management
await BrainyData.preloadModel(options?)         // Preload ML model
await BrainyData.warmup(options?)              // Warmup system

// Utilities
BrainyData.version                             // Get version
BrainyData.checkEnvironment()                  // Check environment support
```

## 🎨 Configuration

```typescript
const brain = new BrainyData({
  // Storage
  storage: 'memory' | 'filesystem' | 's3' | 'auto',
  
  // Performance
  cache: true,                    // Enable caching
  index: true,                    // Enable metadata indexing
  metrics: true,                   // Enable metrics collection
  
  // Distributed
  distributed: {
    mode: 'reader' | 'writer' | 'hybrid',
    partitions: 8
  },
  
  // Advanced
  dimensions: 384,                 // Vector dimensions
  similarity: 'cosine',            // Similarity metric
  verbose: false                   // Logging verbosity
})
```

## 📝 Quick Examples

```typescript
// Simple usage
const brain = new BrainyData()
await brain.init()

// Add data
const id = await brain.addNoun(vector, { 
  title: 'My Document',
  type: 'article' 
})

// Search
const results = await brain.search('AI research', 10)

// Graph relationships
await brain.addVerb(id1, id2, 'references')
const connections = await brain.getConnections(id1)

// Triple Intelligence
const insights = await brain.find({
  like: 'sample-doc',
  where: { type: 'article' },
  connected: { to: id1, via: 'references' }
})

// Cleanup
await brain.shutdown()
```

## 🚨 Important: No Aliases!

Brainy 2.0 follows a **ONE METHOD, ONE PURPOSE** philosophy:
- No duplicate methods
- No confusing aliases  
- Clear, specific naming
- If you need the old methods for migration, they're now private

## 🚀 What Changed from 1.x

### Now Private (Use New Methods)
- `add()` → Use `addNoun()`
- `get()` → Use `getNoun()` 
- `delete()` → Use `deleteNoun()`
- `update()` → Use `updateNoun()`
- `updateMetadata()` → Use `updateNounMetadata()`
- `getMetadata()` → Use `getNounMetadata()`
- `relate()` / `connect()` → Use `addVerb()`
- `has()` / `exists()` → Use `hasNoun()`
- `clearAll()` → Use `clear()`
- `addItem()` / `addToBoth()` → Removed

### New in 2.0
- `find()` - Triple Intelligence search
- `getNounWithVerbs()` - Get noun with relationships
- `searchText()` - Natural language search
- `trainVerbScoring()` - Intelligent scoring
- Real-time sync capabilities
- Distributed operations