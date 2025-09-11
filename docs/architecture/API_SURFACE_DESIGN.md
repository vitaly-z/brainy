# Brainy Neural API Surface Design

## 🎯 **Clean API Hierarchy**

### **Main Class Shortcuts (Simple & Common)**
```typescript
// High-level shortcuts on BrainyData - most common operations
brain.similar(a, b, options?)           // ✅ Keep - very common
brain.clusters(items?, options?)        // ✅ Keep - very common  
brain.related(id, options?)             // ✅ Keep - common (like neighbors but simpler name)

// Remove/deprecate confusing shortcuts
brain.visualize(options?)               // ❌ Remove - too specialized for main class
```

### **Neural Namespace (Full Featured)**
```typescript
// Core semantic operations
brain.neural.similar(a, b, options?)           // Comprehensive similarity
brain.neural.clusters(items?, options?)        // Smart clustering with auto-routing
brain.neural.neighbors(id, options?)           // K-nearest neighbors (full featured)
brain.neural.hierarchy(id, options?)           // Semantic hierarchy building
brain.neural.outliers(options?)                // Anomaly detection
brain.neural.visualize(options?)               // Visualization data generation

// Advanced clustering methods
brain.neural.clusterByDomain(field, options?)  // Domain-aware clustering
brain.neural.clusterByTime(field, windows, options?) // Temporal clustering
brain.neural.clusterStream(options?)           // Streaming/real-time clustering
brain.neural.updateClusters(items, options?)   // Incremental clustering

// Utility methods
brain.neural.getPerformanceMetrics(operation?) // Performance monitoring
brain.neural.clearCaches()                     // Cache management
brain.neural.getCacheStats()                   // Cache statistics
```

## 🔒 **Private Methods (Internal Implementation)**

### **Should NOT be exposed publicly:**
```typescript
// These are implementation details:
brain.neural._clusterFast()              // ❌ Private - use clusters() with algorithm: 'hierarchical'
brain.neural._clusterLarge()             // ❌ Private - use clusters() with algorithm: 'sample' 
brain.neural._performHierarchicalClustering() // ❌ Private - internal routing
brain.neural._performKMeansClustering()  // ❌ Private - internal routing
brain.neural._performDBSCANClustering()  // ❌ Private - internal routing
brain.neural._performSampledClustering() // ❌ Private - internal routing
brain.neural._routeClusteringAlgorithm() // ❌ Private - internal routing
brain.neural._similarityById()           // ❌ Private - internal routing
brain.neural._similarityByVector()       // ❌ Private - internal routing
brain.neural._similarityByText()         // ❌ Private - internal routing
brain.neural._isId()                     // ❌ Private - utility
brain.neural._isVector()                 // ❌ Private - utility
brain.neural._convertToVector()          // ❌ Private - utility
brain.neural._cacheResult()              // ❌ Private - caching
brain.neural._trackPerformance()         // ❌ Private - monitoring
```

### **Current Issues in brain-cloud explorer:**
```typescript
// ❌ BAD: Accessing private implementation details
brain.neural.clusterFast({ maxClusters: count, level: 2 })

// ✅ GOOD: Use public API with proper options
brain.neural.clusters({ algorithm: 'hierarchical', maxClusters: count, level: 2 })
```

## 📊 **API Consistency Fixes**

### **Method Naming Standardization:**
```typescript
// ✅ CONSISTENT: Pick one naming pattern and stick to it
brain.neural.similar()      // Main method name
brain.similar()             // Shortcut matches

// ❌ INCONSISTENT: Don't mix these
brain.neural.similarity()   // Different from shortcut
brain.similar()
```

### **Parameter Patterns:**
```typescript
// ✅ CONSISTENT: Always (data, options?) pattern  
brain.neural.similar(a, b, options?)
brain.neural.clusters(items?, options?)
brain.neural.neighbors(id, options?)
brain.neural.hierarchy(id, options?)

// Options should be objects with clear properties
interface ClusteringOptions {
  algorithm?: 'auto' | 'hierarchical' | 'kmeans' | 'dbscan'
  maxClusters?: number
  threshold?: number
  // ...
}
```

### **Return Type Consistency:**
```typescript
// ✅ CONSISTENT: All clustering methods return SemanticCluster[]
brain.neural.clusters() → Promise<SemanticCluster[]>
brain.neural.clusterByDomain() → Promise<DomainCluster[]>  // extends SemanticCluster
brain.neural.clusterByTime() → Promise<TemporalCluster[]>   // extends SemanticCluster

// ✅ CONSISTENT: All similarity methods return number or SimilarityResult
brain.neural.similar() → Promise<number | SimilarityResult>
brain.similar() → Promise<number>  // Shortcut always returns simple number
```

## 🚀 **Performance & Intelligence Routing**

### **Auto-Algorithm Selection:**
```typescript
// Smart routing based on data size and characteristics
brain.neural.clusters()  // Auto-selects:
//   < 100 items   → hierarchical (fast, accurate)
//   < 1000 items  → k-means (balanced)  
//   > 1000 items  → sampling (scalable)

// Manual override available
brain.neural.clusters({ algorithm: 'hierarchical' })  // Force specific algorithm
```

### **Caching Strategy:**
```typescript
// Intelligent caching with LRU eviction
brain.neural.similar('id1', 'id2')     // First call: compute & cache
brain.neural.similar('id1', 'id2')     // Second call: instant cache hit

// Cache management
brain.neural.clearCaches()              // Manual cache clear
brain.neural.getCacheStats()            // Monitor cache performance
```

## 📚 **Documentation Structure**

### **Main Documentation Sections:**
1. **Quick Start**: Simple examples using shortcuts (`brain.similar()`, `brain.clusters()`)
2. **Neural API Guide**: Comprehensive examples using `brain.neural.*`  
3. **Advanced Clustering**: Domain, temporal, streaming clustering
4. **Performance**: Caching, algorithm selection, monitoring
5. **API Reference**: Complete method documentation

### **Example Progression:**
```typescript
// 1. BEGINNER: Simple shortcuts
const similarity = await brain.similar('text1', 'text2')
const clusters = await brain.clusters()

// 2. INTERMEDIATE: Neural API with options
const detailed = await brain.neural.similar('id1', 'id2', { detailed: true })
const customClusters = await brain.neural.clusters({ algorithm: 'hierarchical', maxClusters: 5 })

// 3. ADVANCED: Specialized clustering
const domainClusters = await brain.neural.clusterByDomain('category')
const streamingClusters = brain.neural.clusterStream({ batchSize: 50 })
```

## ✅ **Implementation Checklist**

### **High Priority:**
- [x] Create comprehensive type definitions
- [x] Implement improved NeuralAPI class with proper public/private separation
- [ ] Update BrainyData integration to use improved API
- [ ] Fix brain-cloud explorer to use public APIs
- [ ] Update test files to use consistent method names
- [ ] Update documentation with new API structure

### **Medium Priority:**
- [ ] Implement placeholder algorithm implementations with real clustering logic
- [ ] Add comprehensive error handling and validation
- [ ] Add performance monitoring and metrics collection
- [ ] Create migration guide for users of deprecated methods

### **Nice to Have:**
- [ ] Add interactive clustering refinement based on user feedback
- [ ] Implement explainable clustering with reasoning
- [ ] Add multi-modal clustering (text + metadata + relationships)
- [ ] Create visualization examples for different graph libraries

## 🎯 **API Surface Summary**

### **✅ PUBLIC API** (What users should use):
- **Main shortcuts**: `brain.similar()`, `brain.clusters()`, `brain.related()`
- **Neural namespace**: `brain.neural.similar()`, `brain.neural.clusters()`, etc.
- **Advanced features**: Domain clustering, temporal clustering, streaming
- **Utilities**: Performance metrics, cache management

### **❌ PRIVATE IMPLEMENTATION** (Internal only):
- **Algorithm implementations**: `_performKMeansClustering()`, etc.
- **Routing logic**: `_routeClusteringAlgorithm()`, etc.  
- **Utility methods**: `_isId()`, `_convertToVector()`, etc.
- **Caching internals**: `_cacheResult()`, `_trackPerformance()`, etc.

### **⚠️ DEPRECATED** (Should be removed/hidden):
- **brain.neural.clusterFast()** → Use `brain.neural.clusters({ algorithm: 'hierarchical' })`
- **brain.neural.clusterLarge()** → Use `brain.neural.clusters({ algorithm: 'sample' })`
- **brain.neural.similarity()** → Use `brain.neural.similar()` (pick one name)
- **brain.visualize()** → Too specialized for main class, use `brain.neural.visualize()`