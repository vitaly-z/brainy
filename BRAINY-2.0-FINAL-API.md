# 🧠 Brainy 2.0 Final Complete API

> **Clean, Powerful, Complete** - All features, beautifully organized.

## 📚 CORE DATA

### Nouns (Vectors with Metadata)
```typescript
// Single Operations
addNoun(textOrVector, metadata?)           // Add noun (auto-embeds text!)
getNoun(id)                                // Get one noun
updateNoun(id, textOrVector?, metadata?)   // Update noun
deleteNoun(id)                             // Delete noun
hasNoun(id)                                // Check if exists

// Metadata Operations
getNounMetadata(id)                        // Get metadata only
updateNounMetadata(id, metadata)           // Update metadata only
getNounWithVerbs(id)                       // Get noun with relationships

// Batch Operations  
addNouns(items[])                         // Add multiple nouns
getNouns(idsOrOptions)                    // Get multiple nouns (unified)
deleteNouns(ids[])                        // Delete multiple nouns
```

### Verbs (Relationships)
```typescript
addVerb(source, target, type, metadata?)   // Create relationship
getVerb(id)                                // Get verb
deleteVerb(id)                             // Delete verb
getVerbsBySource(sourceId)                // Outgoing relationships
getVerbsByTarget(targetId)                // Incoming relationships  
getVerbsByType(type)                      // By relationship type
```

## 🔍 SEARCH & INTELLIGENCE

### Core Search
```typescript
search(query, k?)                         // Simple vector search
find(query)                               // TRIPLE INTELLIGENCE 🧠
findSimilar(id, k?)                       // Find similar to noun
```

### Neural API
```typescript
neural.search(query)                      // Neural-enhanced search
neural.cluster(options?)                  // Automatic clustering
neural.extract(text)                      // Entity extraction
neural.summarize(ids[])                   // Summarize nouns
neural.analyze(id)                        // Deep analysis
neural.compare(id1, id2)                  // Semantic comparison
neural.topics()                           // Topic modeling
neural.patterns()                         // Pattern detection
```

### Clustering
```typescript
clusters.create(options?)                 // Create clusters
clusters.get(id)                          // Get cluster
clusters.list()                           // List all clusters
clusters.addToCluster(clusterId, nounId)  // Add to cluster
clusters.optimize()                       // Re-optimize clusters
clusters.suggest(nounId)                  // Suggest best cluster
```

## 🧠 INTELLIGENCE FEATURES

### Triple Intelligence
```typescript
tripleIntelligence.analyze(query)         // Combined V+G+F analysis
tripleIntelligence.explain(results)       // Explain search results
tripleIntelligence.optimize(query)        // Query optimization
```

### Verb Scoring
```typescript
verbScoring.train(feedback)               // Train scoring model
verbScoring.getScore(verb)                // Get verb score
verbScoring.export()                      // Export training data
verbScoring.import(data)                  // Import training data
verbScoring.stats()                       // Get statistics
```

### Embeddings
```typescript
embed(text)                               // Generate embedding
embedBatch(texts[])                       // Batch embeddings
similarity(a, b)                          // Calculate similarity
distance(a, b, metric?)                   // Calculate distance
```

## 📥 IMPORT/EXPORT

### Neural Import
```typescript
neuralImport(data, options?)              // Smart data import
neuralImport.csv(file, options?)          // Import CSV with AI
neuralImport.json(data, options?)         // Import JSON with AI
neuralImport.text(text, options?)         // Import text with NLP
neuralImport.url(url, options?)           // Import from URL
neuralImport.batch(items[], options?)     // Batch neural import
```

### Data Management
```typescript
import(data, format)                      // Standard import
export(format)                            // Export data
importSparse(data)                        // Import sparse format
backup()                                  // Create backup
restore(backup)                          // Restore backup
```

## 🔄 SYNC & DISTRIBUTION

### Real-time Sync
```typescript
sync.enable(config)                       // Enable real-time sync
sync.disable()                            // Disable sync
sync.now()                                // Manual sync
sync.status()                             // Sync status
```

### Remote Operations
```typescript
remote.connect(url, options?)             // Connect to remote
remote.disconnect()                       // Disconnect
remote.search(query)                      // Search remote
remote.sync()                             // Sync with remote
```

### Conduits (Brainy-to-Brainy)
```typescript
conduit.establish(url)                    // Create conduit
conduit.send(data)                        // Send via conduit
conduit.receive(callback)                 // Receive data
conduit.close()                           // Close conduit
```

### Synapses (External Platforms)
```typescript
synapse.notion.connect(config)            // Connect to Notion
synapse.slack.connect(config)             // Connect to Slack
synapse.salesforce.connect(config)        // Connect to Salesforce
synapse.custom(platform, config)          // Custom platform
```

## 📊 ANALYTICS & MONITORING

### Statistics
```typescript
size()                                    // Total count
stats()                                   // Full statistics
stats.byService(service)                  // Per-service stats
stats.byType(type)                       // Per-type stats
health()                                  // Health check
```

### Performance
```typescript
cache.stats()                             // Cache statistics
cache.clear()                             // Clear cache
cache.optimize()                          // Optimize cache
index.rebuild()                           // Rebuild index
index.optimize()                          // Optimize index
```

### Monitoring
```typescript
monitor.enable()                          // Enable monitoring
monitor.metrics()                         // Get metrics
monitor.alerts()                          // Get alerts
monitor.logs(options?)                    // Get logs
```

## ⚙️ CONFIGURATION

### Operational Modes
```typescript
setReadOnly(bool)                        // Read-only mode
setWriteOnly(bool)                       // Write-only mode
setFrozen(bool)                          // Freeze all changes
getMode()                                 // Current mode
```

### Augmentations
```typescript
augmentations.register(augmentation)      // Add augmentation
augmentations.list()                      // List all
augmentations.get(name)                   // Get by name
augmentations.enable(name)                // Enable
augmentations.disable(name)               // Disable
```

## 🔧 UTILITIES

### Data Operations
```typescript
clear(options?)                          // Clear all
clearNouns()                             // Clear nouns
clearVerbs()                             // Clear verbs
generateRandomGraph(nodes, edges)        // Generate test data
```

### Field Management
```typescript
fields.list()                            // List indexed fields
fields.values(field)                     // Get unique values
fields.add(field)                        // Add field to index
fields.remove(field)                     // Remove from index
```

## 🚀 LIFECYCLE

```typescript
// Creation & Initialization
new BrainyData(config?)                  // Create instance
init()                                   // Initialize (REQUIRED!)
warmup()                                 // Warmup caches

// Cleanup
shutdown()                               // Graceful shutdown
cleanup()                                // Clean resources

// Static Methods
BrainyData.preloadModel()                // Preload ML model
BrainyData.version                      // Get version
```

## 📐 PROPERTIES

```typescript
dimensions                               // Vector dimensions (readonly)
initialized                              // Is initialized (readonly)
mode                                     // Current mode (readonly)
```

---

## 🎯 Key Features Preserved

✅ **Neural Import** - Smart AI-powered data import
✅ **Clustering** - Automatic and manual clustering
✅ **Triple Intelligence** - Vector + Graph + Field combined
✅ **Verb Scoring** - Intelligent relationship scoring
✅ **Synapses** - External platform connectors
✅ **Conduits** - Brainy-to-Brainy sync
✅ **Neural API** - Advanced AI operations
✅ **Real-time Sync** - Live data synchronization
✅ **Monitoring** - Performance and health tracking

## 🚀 What's New in 2.0

1. **Auto-embedding** - `addNoun()` accepts text directly
2. **Unified `find()`** - One method for all complex queries
3. **Neural API** - Powerful AI operations built-in
4. **Augmentation System** - Extensible architecture
5. **Clean naming** - Specific noun/verb terminology
6. **No duplicates** - One method per operation