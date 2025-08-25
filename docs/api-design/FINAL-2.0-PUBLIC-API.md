# 🧠 Brainy 2.0 Final Public API

> **Clean, Specific, Beautiful** - Every method has ONE clear purpose.

## 📚 NOUNS (Vectors with Metadata)

```typescript
// Single Operations
addNoun(vector, metadata?)                  // Add one noun
getNoun(id)                                 // Get one noun by ID
updateNoun(id, vector?, metadata?)          // Update entire noun
updateNounMetadata(id, metadata)            // Update metadata only  
getNounMetadata(id)                         // Get metadata only
getNounWithVerbs(id)                        // Get noun with all relationships
deleteNoun(id)                              // Delete one noun
hasNoun(id)                                 // Check if noun exists

// Batch Operations  
addNouns(items[])                          // Add multiple nouns
getNouns(idsOrOptions)                     // Get multiple nouns (by IDs or query)
  // getNouns(['id1', 'id2'])              // Get by specific IDs
  // getNouns({ filter: {...} })           // Get with filters
  // getNouns({ limit: 10, offset: 20 })   // Get with pagination
deleteNouns(ids[])                         // Delete multiple nouns
```

## 🔗 VERBS (Relationships)

```typescript
// Single Operations
addVerb(source, target, type, metadata?)    // Create relationship
getVerb(id)                                 // Get one verb by ID
deleteVerb(id)                              // Delete one verb

// Batch Operations
addVerbs(verbs[])                          // Add multiple relationships
getVerbs(filter?)                          // Get filtered verbs
getVerbsBySource(sourceId)                 // Get outgoing relationships
getVerbsByTarget(targetId)                 // Get incoming relationships
getVerbsByType(type)                       // Get by relationship type
deleteVerbs(ids[])                         // Delete multiple verbs
```

## 🔍 SEARCH

```typescript
// Core Search
search(query, k?, options?)                 // Primary vector search
searchText(text, k?, options?)              // Natural language search
find(query)                                 // Triple Intelligence (Vector+Graph+Field) 🧠
findSimilar(id, k?, options?)              // Find similar to existing noun

// Advanced Search
searchByNounTypes(types[], query, k?)      // Filter by noun types
searchWithinItems(query, ids[], k?)        // Search within specific nouns
searchWithCursor(query, cursor)            // Paginated search
searchByStandardField(field, value, k?)    // Field-based search

// Graph Search
searchVerbs(query, options?)               // Search relationships
searchNounsByVerbs(conditions)             // Find nouns by relationships

// Distributed Search
searchLocal(query, k?)                     // Search local instance only
searchRemote(query, k?)                    // Search remote instance only
searchCombined(query, k?)                  // Search both local and remote
```

## 📊 METADATA & FILTERING

```typescript
getFilterFields()                          // Get all indexed fields
getFilterValues(field)                     // Get unique values for a field
getAvailableFieldNames()                   // Get available field names
getStandardFieldMappings()                 // Get standard field mappings
```

## 🚀 PERFORMANCE & MONITORING

```typescript
// Cache
getCacheStats()                            // Get cache statistics
clearCache()                               // Clear search cache

// Statistics
size()                                     // Total noun count
getStatistics(options?)                    // Comprehensive statistics
getServiceStatistics(service)              // Per-service statistics
listServices()                             // List all services
flushStatistics()                          // Persist statistics to storage

// Health
getHealthStatus()                          // System health check
status()                                   // Full status report
```

## ⚙️ CONFIGURATION

```typescript
// Operational Modes
isReadOnly() / setReadOnly(bool)          // Read-only mode
isWriteOnly() / setWriteOnly(bool)        // Write-only mode  
isFrozen() / setFrozen(bool)              // Freeze all modifications

// Real-time Sync
enableRealtimeUpdates(config)              // Enable live synchronization
disableRealtimeUpdates()                   // Disable synchronization
getRealtimeUpdateConfig()                  // Get current config
checkForUpdatesNow()                       // Manual sync trigger

// Remote Connection
connectToRemoteServer(url, options?)       // Connect to remote instance
disconnectFromRemoteServer()               // Disconnect from remote
isConnectedToRemoteServer()               // Check connection status
```

## 🧠 INTELLIGENCE

```typescript
// Verb Scoring
provideFeedbackForVerbScoring(feedback)    // Train relationship scoring
getVerbScoringStats()                      // Get scoring statistics
exportVerbScoringLearningData()           // Export training data
importVerbScoringLearningData(data)       // Import training data

// Embeddings
embed(text)                                // Generate embedding vector
calculateSimilarity(a, b, metric?)         // Calculate vector similarity
```

## 💾 DATA MANAGEMENT

```typescript
// Clear Operations
clear(options?)                           // Clear all data
clearNouns(options?)                      // Clear all nouns only
clearVerbs(options?)                      // Clear all verbs only

// Backup & Restore
backup()                                   // Create full backup
restore(backup)                           // Restore from backup

// Import/Export
import(data, format)                      // Import external data
importSparseData(data)                    // Import sparse format

// Index Management
rebuildMetadataIndex()                    // Rebuild metadata index
```

## 🔒 SECURITY

```typescript
encryptData(data)                         // Encrypt data
decryptData(data)                         // Decrypt data
```

## 🎲 UTILITIES

```typescript
generateRandomGraph(nodes, edges)         // Generate test graph data
```

## 🚀 LIFECYCLE

```typescript
// Instance Methods
new BrainyData(config?)                   // Create instance
init()                                     // Initialize (REQUIRED!)
shutDown()                                // Graceful shutdown
cleanup()                                  // Clean up resources

// Static Methods
BrainyData.preloadModel(options?)         // Preload ML model
BrainyData.warmup(options?)              // Warmup system
```

## 📐 PROPERTIES (Read-only)

```typescript
dimensions                                // Vector dimensions
maxConnections                           // HNSW max connections
efConstruction                           // HNSW ef construction
initialized                              // Is initialized?
```

---

## 📝 Key Changes in 2.0

### ✅ Simplified & Unified
- `getNouns()` now handles ALL plural queries (by IDs, filters, or pagination)
- No more `getNounsByIds()`, `queryNouns()`, `getBatch()` - just `getNouns()`
- Clear singular vs plural: `getNoun()` for one, `getNouns()` for many

### ✅ Specific Naming
- Always specify noun/verb: `addNoun()` not `add()`
- No aliases or duplicates
- One method, one purpose

### ✅ Private Legacy Methods
These are now private (use new methods above):
- `add()`, `get()`, `delete()`, `update()`
- `relate()`, `connect()`, `has()`, `exists()`
- `getMetadata()`, `updateMetadata()`
- `addItem()`, `addToBoth()`, `addBatch()`, `getBatch()`

### ✅ Triple Intelligence
- New `find()` method unifies Vector + Graph + Field search
- Most powerful search capability in one simple method