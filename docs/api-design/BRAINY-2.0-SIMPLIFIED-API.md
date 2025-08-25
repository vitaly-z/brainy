# 🧠 Brainy 2.0 Simplified Public API

> **Ultra-clean, Simple, Powerful** - Minimal methods, maximum capability.

## 📚 NOUNS (Data with Vectors)

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

## 🔗 VERBS (Relationships)

```typescript
// Core Operations
addVerb(source, target, type, metadata?)   // Create relationship
getVerb(id)                                // Get verb
deleteVerb(id)                             // Delete verb

// Queries
getVerbsBySource(sourceId)                // Outgoing relationships
getVerbsByTarget(targetId)                // Incoming relationships  
getVerbsByType(type)                      // By relationship type
```

## 🔍 SEARCH (One Method to Rule Them All)

```typescript
// THE ONLY SEARCH METHODS YOU NEED:
search(query, k?)                         // Simple vector search (alias to find)
find(query)                               // TRIPLE INTELLIGENCE 🧠
```

### Find Query Examples:
```typescript
// Text search (auto-embeds)
find('documents about AI')                

// Similar to existing noun
find({ like: 'noun-id-123' })            

// Field filtering
find({ where: { type: 'article' }})      

// Graph traversal
find({ connected: { to: 'id', via: 'references' }})

// Combined queries (Triple Intelligence!)
find({
  like: 'sample-doc',                    // Vector similarity
  where: { status: 'published' },        // Field filter
  connected: { via: 'cites' },          // Graph relationships
  limit: 10                              // Pagination
})
```

## 📊 METADATA

```typescript
getFilterableFields()                     // Get indexed fields
getFieldValues(field)                     // Get unique values for field
```

## 🚀 PERFORMANCE

```typescript
// Cache
getCacheStats()                           // Cache statistics
clearCache()                              // Clear cache

// Stats
size()                                    // Total count
getStatistics()                           // Full statistics
getHealthStatus()                         // Health check
```

## ⚙️ CONFIGURATION

```typescript
// Modes
setReadOnly(bool)                        // Read-only mode
setWriteOnly(bool)                       // Write-only mode
setFrozen(bool)                          // Freeze all changes

// Remote Sync
connectRemote(url)                       // Connect to remote
disconnectRemote()                       // Disconnect
syncNow()                                // Manual sync
```

## 💾 DATA MANAGEMENT

```typescript
clear(options?)                          // Clear all
clearNouns()                             // Clear nouns
clearVerbs()                             // Clear verbs
backup()                                 // Create backup
restore(backup)                          // Restore backup
```

## 🚀 LIFECYCLE

```typescript
new BrainyData(config?)                  // Create
init()                                   // Initialize (REQUIRED!)
shutdown()                               // Cleanup
```

---

## 🎯 Philosophy

### Why So Simple?

1. **`addNoun()` handles everything** - Text? Auto-embeds. Vector? Uses directly.
2. **`find()` is the ultimate search** - Combines vector, graph, and field search
3. **`search()` is just convenience** - Simple alias to `find()` for basic queries
4. **No duplicate methods** - One way to do each thing

### The Power of Find

The `find()` method is your Swiss Army knife:
- Text search → Auto-embeds and searches
- Vector search → `{ like: 'id' }` or `{ like: vector }`
- Field search → `{ where: { field: value }}`
- Graph search → `{ connected: { to/from: 'id' }}`
- Combine them all → Triple Intelligence!

### Zero Configuration

Everything just works:
- Text auto-embeds
- Vectors auto-index
- Metadata auto-indexes
- Relationships auto-optimize