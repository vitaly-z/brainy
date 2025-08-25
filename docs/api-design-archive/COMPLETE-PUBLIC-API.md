# 🧠 Brainy 2.0 Complete Public API

> **ONE METHOD, ONE PURPOSE** - No duplicates, no aliases, just clean specific methods.

## 📚 NOUNS (Vectors with Metadata)

### Single Operations
```typescript
addNoun(vector, metadata?)                  // Add one noun
getNoun(id)                                 // Get one noun
updateNoun(id, vector?, metadata?)          // Update noun
updateNounMetadata(id, metadata)            // Update metadata only  
getNounMetadata(id)                         // Get metadata only
deleteNoun(id)                              // Delete one noun
hasNoun(id)                                 // Check if exists
getNounWithVerbs(id)                        // Get with relationships
```

### Batch Operations  
```typescript
addNouns(items[])                          // Add multiple nouns
getNounsByIds(ids[])                       // Get multiple by IDs
deleteNouns(ids[])                         // Delete multiple nouns
queryNouns(options)                        // Query with filters/pagination
```

## 🔗 VERBS (Relationships)

### Single Operations
```typescript
addVerb(source, target, type, metadata?)    // Add relationship
getVerb(id)                                 // Get one verb
deleteVerb(id)                              // Delete one verb
```

### Batch Operations
```typescript
addVerbs(verbs[])                          // Add multiple verbs
getVerbs(filter?)                          // Get filtered verbs
deleteVerbs(ids[])                         // Delete multiple verbs
getVerbsBySource(sourceId)                 // Get outgoing relationships
getVerbsByTarget(targetId)                 // Get incoming relationships
getVerbsByType(type)                       // Get by relationship type
```

## 🔍 SEARCH

### Vector Search
```typescript
search(query, k?, options?)                 // Primary vector search
searchText(text, k?, options?)              // Natural language search
findSimilar(id, k?, options?)              // Find similar to noun
searchWithCursor(query, cursor)            // Paginated search
```

### Advanced Search
```typescript
find(query)                                // Triple Intelligence 🧠
searchByNounTypes(types[], query)          // Filter by noun types
searchWithinItems(query, ids[], k?)        // Search within specific nouns
searchVerbs(query)                         // Search relationships
searchNounsByVerbs(conditions)             // Graph-based noun search
searchByStandardField(field, value)        // Metadata-based search
```

### Distributed Search
```typescript
searchLocal(query)                         // Local only
searchRemote(query)                        // Remote only
searchCombined(query)                      // Both sources
```

## 📊 GRAPH OPERATIONS

```typescript
getConnections(id, depth?)                 // Get all connections
getVerbsBySource(sourceId)                 // Outgoing edges
getVerbsByTarget(targetId)                 // Incoming edges
getVerbsByType(type)                       // Filter by type
```

## 🎯 PERFORMANCE & STATS

### Cache
```typescript
getCacheStats()                            // Cache statistics
clearCache()                               // Clear search cache
```

### Statistics
```typescript
size()                                     // Total noun count
getStatistics(options?)                    // Complete statistics
getServiceStatistics(service)              // Per-service stats
listServices()                             // List all services
flushStatistics()                          // Flush to storage
```

### Health & Status
```typescript
getHealthStatus()                          // System health
status()                                   // Full status report
```

## 🔧 CONFIGURATION & MODES

### Operational Modes
```typescript
isReadOnly() / setReadOnly(bool)          // Read-only mode
isWriteOnly() / setWriteOnly(bool)        // Write-only mode  
isFrozen() / setFrozen(bool)              // Freeze modifications
```

### Real-time Updates
```typescript
enableRealtimeUpdates(config)              // Enable live sync
disableRealtimeUpdates()                   // Disable sync
getRealtimeUpdateConfig()                  // Get config
checkForUpdatesNow()                       // Manual sync
```

### Remote Connection
```typescript
connectToRemoteServer(url, options?)       // Connect remote
disconnectFromRemoteServer()               // Disconnect
isConnectedToRemoteServer()               // Check connection
```

## 🧠 INTELLIGENCE FEATURES

### Verb Scoring
```typescript
provideFeedbackForVerbScoring(feedback)    // Train scoring
getVerbScoringStats()                      // Get statistics
exportVerbScoringLearningData()           // Export training
importVerbScoringLearningData(data)       // Import training
```

### Embeddings
```typescript
embed(text)                                // Generate embedding
calculateSimilarity(a, b)                  // Compare vectors
```

## 💾 DATA MANAGEMENT

### Clear Operations
```typescript
clear(options?)                           // Clear all data
clearNouns(options?)                      // Clear all nouns
clearVerbs(options?)                      // Clear all verbs
```

### Import/Export
```typescript
backup()                                   // Create backup
restore(backup)                           // Restore backup
import(data, format)                      // Import data
importSparseData(data)                    // Import sparse
```

### Index Management
```typescript
rebuildMetadataIndex()                    // Rebuild index
getFilterFields()                         // Get indexed fields
getFilterValues(field)                    // Get field values
```

## 🔒 SECURITY

```typescript
encryptData(data)                         // Encrypt
decryptData(data)                         // Decrypt
```

## 🎲 UTILITIES

```typescript
generateRandomGraph(nodes, edges)         // Generate test data
getAvailableFieldNames()                  // Available fields
getStandardFieldMappings()                // Field mappings
```

## 🚀 LIFECYCLE

### Instance Methods
```typescript
init()                                     // Initialize (required!)
shutDown()                                // Graceful shutdown
cleanup()                                  // Clean resources
```

### Static Methods
```typescript
BrainyData.preloadModel(options?)         // Preload ML model
BrainyData.warmup(options?)              // Warmup system
```

## 📐 PROPERTIES

```typescript
dimensions                                // Vector dimensions (readonly)
maxConnections                           // HNSW max connections (readonly)
efConstruction                           // HNSW ef construction (readonly)
initialized                              // Is initialized (readonly)
```

## ❌ REMOVED/PRIVATE IN 2.0

These methods are now **private** - use the new specific methods above:
- ~~add()~~ → Use `addNoun()`
- ~~get()~~ → Use `getNoun()`
- ~~delete()~~ → Use `deleteNoun()`
- ~~update()~~ → Use `updateNoun()`
- ~~relate()~~ → Use `addVerb()`
- ~~connect()~~ → Use `addVerb()`
- ~~has()~~ → Use `hasNoun()`
- ~~exists()~~ → Use `hasNoun()`
- ~~getMetadata()~~ → Use `getNounMetadata()`
- ~~updateMetadata()~~ → Use `updateNounMetadata()`
- ~~clearAll()~~ → Use `clear()`
- ~~addItem()~~ → Removed
- ~~addToBoth()~~ → Removed
- ~~addBatch()~~ → Use `addNouns()`
- ~~getBatch()~~ → Use `getNounsByIds()`
- ~~getNouns()~~ with IDs → Use `getNounsByIds()`
- ~~getNouns()~~ with filters → Use `queryNouns()`