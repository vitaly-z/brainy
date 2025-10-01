# 🧠 Neural API Patterns: AI-Powered Intelligence

> Learn the correct patterns for Brainy's Neural API. Avoid performance pitfalls and use AI features effectively.

## 🚨 Critical: Access Neural APIs Correctly

### ❌ **WRONG - Outdated Access Patterns**

```typescript
// DON'T DO THIS - Outdated documentation patterns
import { Brainy } from '@soulcraft/brainy'  // ❌ Wrong import
const brain = new Brainy()                  // ❌ Old class name

// These may not work as expected:
const neural = brain.neural                     // ❌ May be undefined
```

### ✅ **CORRECT - Modern Neural Access**

```typescript
// ✅ Use modern Brainy class
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

// ✅ Neural API is available after initialization
const clusters = await brain.neural.clusters()
const similarity = await brain.neural.similar('item1', 'item2')
```

## 🔍 Similarity Analysis Patterns

### ❌ **WRONG - Inefficient Similarity Checks**

```typescript
// DON'T DO THIS - N² comparisons
const items = await brain.find({ limit: 1000 })
const similarities = []

for (const item1 of items) {
  for (const item2 of items) {
    if (item1.id !== item2.id) {
      const sim = await brain.neural.similar(item1.id, item2.id)  // ❌ Millions of calls
      similarities.push({ from: item1.id, to: item2.id, score: sim })
    }
  }
}
```

### ✅ **CORRECT - Efficient Similarity Patterns**

```typescript
// ✅ Pattern 1: Find neighbors (much more efficient)
const item = await brain.get('target-item-id')
const neighbors = await brain.neural.neighbors(item.id, {
  limit: 10,                     // Top 10 most similar
  threshold: 0.7,               // Minimum similarity
  includeScores: true           // Include similarity scores
})

console.log(`Found ${neighbors.length} similar items`)

// ✅ Pattern 2: Batch similarity for specific pairs
const itemPairs = [
  ['item1', 'item2'],
  ['item1', 'item3'],
  ['item2', 'item3']
]

const similarities = await Promise.all(
  itemPairs.map(async ([a, b]) => ({
    from: a,
    to: b,
    score: await brain.neural.similar(a, b)
  }))
)

// ✅ Pattern 3: Text-to-text similarity (no need for IDs)
const textSimilarity = await brain.neural.similar(
  "Machine learning is fascinating",
  "AI and deep learning are interesting",
  { detailed: true }  // Get explanation of similarity
)

console.log(`Similarity: ${textSimilarity.score}`)
console.log(`Explanation: ${textSimilarity.explanation}`)

// ✅ Pattern 4: Vector-level similarity for optimization
const vector1 = await brain.embed("First concept")
const vector2 = await brain.embed("Second concept")
const vectorSimilarity = await brain.neural.similar(vector1, vector2)
```

## 🎯 Clustering Patterns

### ❌ **WRONG - Uncontrolled Clustering**

```typescript
// DON'T DO THIS - Clustering everything without limits
const everything = await brain.find({ limit: 100000 })  // ❌ Too much data
const clusters = await brain.neural.clusters()          // ❌ May crash or timeout
```

### ✅ **CORRECT - Smart Clustering Patterns**

```typescript
// ✅ Pattern 1: Controlled clustering with limits
const recentItems = await brain.find({
  where: {
    createdAt: { $gte: Date.now() - 30 * 24 * 60 * 60 * 1000 } // Last 30 days
  },
  limit: 1000  // Reasonable limit
})

const clusters = await brain.neural.clusters(
  recentItems.map(item => item.id),
  {
    algorithm: 'kmeans',        // Reliable algorithm
    maxClusters: 10,           // Reasonable number
    threshold: 0.75,           // High similarity required
    iterations: 50             // Convergence limit
  }
)

// ✅ Pattern 2: Domain-specific clustering
const techDocs = await brain.find({
  where: { category: 'technology', type: 'document' },
  limit: 500
})

const techClusters = await brain.neural.clusterByDomain(
  'category',  // Group by this field
  {
    items: techDocs.map(doc => doc.id),
    minClusterSize: 3,         // Minimum items per cluster
    maxClusters: 8
  }
)

// ✅ Pattern 3: Temporal clustering for time-series data
const timebasedClusters = await brain.neural.clusterByTime(
  'createdAt',  // Time field
  'week',       // Time window (hour, day, week, month)
  {
    items: recentItems.map(item => item.id),
    overlap: 0.2,              // 20% overlap between windows
    minPerWindow: 5            // Minimum items per time window
  }
)

// ✅ Pattern 4: Streaming clustering for large datasets
async function clusterLargeDataset() {
  const clusterStream = brain.neural.clusterStream({
    batchSize: 100,            // Process 100 items at a time
    updateInterval: 1000,      // Update clusters every 1000 items
    maxMemory: 512 * 1024 * 1024  // 512MB memory limit
  })

  const allClusters = []
  for await (const batch of clusterStream) {
    console.log(`Processed ${batch.processed} items, found ${batch.clusters.length} clusters`)
    allClusters.push(...batch.clusters)
  }

  return allClusters
}
```

## 🔍 Neighbor Discovery Patterns

### ❌ **WRONG - Manual Similarity Searches**

```typescript
// DON'T DO THIS - Reinventing neighbor search
async function findSimilarManually(targetId: string) {
  const allItems = await brain.find({ limit: 10000 })  // ❌ Load everything
  const similarities = []

  for (const item of allItems) {
    if (item.id !== targetId) {
      const score = await brain.neural.similar(targetId, item.id)  // ❌ Slow
      if (score > 0.7) {
        similarities.push({ id: item.id, score })
      }
    }
  }

  return similarities.sort((a, b) => b.score - a.score).slice(0, 10)  // ❌ Inefficient
}
```

### ✅ **CORRECT - Optimized Neighbor Patterns**

```typescript
// ✅ Pattern 1: Basic neighbor search
const neighbors = await brain.neural.neighbors('target-item-id', {
  limit: 20,                   // Top 20 neighbors
  threshold: 0.6,             // Minimum similarity
  includeMetadata: true,      // Include item metadata
  includeDistances: true      // Include exact similarity scores
})

// ✅ Pattern 2: Filtered neighbor search
const filteredNeighbors = await brain.neural.neighbors('article-id', {
  limit: 10,
  filter: {
    type: 'document',          // Only find similar documents
    status: 'published',       // Only published content
    language: 'en'            // Only English content
  },
  excludeIds: ['self-id', 'duplicate-id']  // Exclude specific items
})

// ✅ Pattern 3: Multi-level neighbor discovery
async function discoverNeighborNetwork(rootId: string, maxDepth = 2) {
  const network = new Map()
  const visited = new Set()
  const queue = [{ id: rootId, depth: 0 }]

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!

    if (visited.has(id) || depth >= maxDepth) continue
    visited.add(id)

    const neighbors = await brain.neural.neighbors(id, {
      limit: 5,
      threshold: 0.8
    })

    network.set(id, neighbors)

    // Add neighbors to queue for next depth level
    if (depth < maxDepth - 1) {
      neighbors.forEach(neighbor => {
        queue.push({ id: neighbor.id, depth: depth + 1 })
      })
    }
  }

  return network
}

// ✅ Pattern 4: Recommendation engine
async function getRecommendations(userId: string) {
  // Get user's liked items
  const userItems = await brain.find({
    connected: { to: userId, via: 'liked-by' }
  })

  // Find neighbors for each liked item
  const allNeighbors = await Promise.all(
    userItems.map(item =>
      brain.neural.neighbors(item.id, {
        limit: 10,
        threshold: 0.7,
        excludeConnected: { to: userId, via: 'liked-by' }  // Exclude already liked
      })
    )
  )

  // Aggregate and rank recommendations
  const recommendations = new Map()
  allNeighbors.flat().forEach(neighbor => {
    const current = recommendations.get(neighbor.id) || { score: 0, count: 0 }
    current.score += neighbor.score
    current.count += 1
    recommendations.set(neighbor.id, current)
  })

  // Return top recommendations by average score
  return Array.from(recommendations.entries())
    .map(([id, stats]) => ({
      id,
      avgScore: stats.score / stats.count,
      mentions: stats.count
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10)
}
```

## 🏗️ Hierarchy & Structure Patterns

### ❌ **WRONG - Manual Hierarchy Building**

```typescript
// DON'T DO THIS - Building hierarchies manually
async function buildHierarchyManually(rootId: string) {
  const root = await brain.get(rootId)
  const allItems = await brain.find({ limit: 1000 })  // ❌ Load everything

  // Manual tree building with nested loops
  const hierarchy = { root, children: [] }
  // ... complex manual logic
}
```

### ✅ **CORRECT - Semantic Hierarchy Patterns**

```typescript
// ✅ Pattern 1: Automatic semantic hierarchy
const hierarchy = await brain.neural.hierarchy('root-concept-id', {
  maxDepth: 4,                 // Maximum tree depth
  minSimilarity: 0.6,         // Minimum similarity for inclusion
  branchingFactor: 5,         // Maximum children per node
  algorithm: 'semantic'       // Use semantic clustering
})

// ✅ Pattern 2: Domain-specific hierarchy
const techHierarchy = await brain.neural.hierarchy('technology-id', {
  filter: { category: 'technology' },
  weights: {
    semantic: 0.7,            // 70% based on content similarity
    metadata: 0.3            // 30% based on metadata similarity
  },
  includeMetrics: true        // Include hierarchy quality metrics
})

// ✅ Pattern 3: Multi-root hierarchy for complex domains
async function buildMultiRootHierarchy(rootIds: string[]) {
  const hierarchies = await Promise.all(
    rootIds.map(rootId =>
      brain.neural.hierarchy(rootId, {
        maxDepth: 3,
        crossReference: true    // Allow cross-hierarchy connections
      })
    )
  )

  // Merge hierarchies and find connections
  const merged = {
    roots: hierarchies,
    connections: await findCrossHierarchyConnections(hierarchies)
  }

  return merged
}

async function findCrossHierarchyConnections(hierarchies: any[]) {
  const connections = []

  for (let i = 0; i < hierarchies.length; i++) {
    for (let j = i + 1; j < hierarchies.length; j++) {
      const leafNodes1 = extractLeafNodes(hierarchies[i])
      const leafNodes2 = extractLeafNodes(hierarchies[j])

      // Find connections between leaf nodes of different hierarchies
      for (const leaf1 of leafNodes1) {
        const neighbors = await brain.neural.neighbors(leaf1.id, {
          limit: 5,
          threshold: 0.8,
          filter: { id: { $in: leafNodes2.map(l => l.id) } }
        })

        connections.push(...neighbors.map(n => ({
          from: leaf1.id,
          to: n.id,
          hierarchyPair: [i, j],
          similarity: n.score
        })))
      }
    }
  }

  return connections
}
```

## 🚨 Outlier Detection Patterns

### ❌ **WRONG - Manual Outlier Detection**

```typescript
// DON'T DO THIS - Manual statistical outlier detection
async function findOutliersManually() {
  const items = await brain.find({ limit: 1000 })
  const similarities = []

  // Calculate average similarity for each item (expensive)
  for (const item of items) {
    let totalSim = 0
    let count = 0
    for (const other of items) {
      if (item.id !== other.id) {
        totalSim += await brain.neural.similar(item.id, other.id)  // ❌ N² operations
        count++
      }
    }
    similarities.push({ id: item.id, avgSimilarity: totalSim / count })
  }

  // Manual outlier calculation
  const threshold = calculateManualThreshold(similarities)  // ❌ Complex statistics
  return similarities.filter(s => s.avgSimilarity < threshold)
}
```

### ✅ **CORRECT - AI-Powered Outlier Detection**

```typescript
// ✅ Pattern 1: Automatic outlier detection
const outliers = await brain.neural.outliers({
  threshold: 0.3,              // Items with < 30% avg similarity to others
  method: 'isolation-forest',  // AI-based outlier detection
  contamination: 0.1,         // Expect ~10% outliers
  includeReasons: true        // Explain why each item is an outlier
})

console.log(`Found ${outliers.length} outliers`)
outliers.forEach(outlier => {
  console.log(`Outlier: ${outlier.id}, Score: ${outlier.score}`)
  console.log(`Reason: ${outlier.reason}`)
})

// ✅ Pattern 2: Domain-specific outlier detection
const techOutliers = await brain.neural.outliers({
  filter: { category: 'technology' },
  features: ['content', 'metadata.tags', 'metadata.complexity'],
  method: 'local-outlier-factor',
  neighbors: 20               // Consider 20 nearest neighbors
})

// ✅ Pattern 3: Temporal outlier detection
const recentOutliers = await brain.neural.outliers({
  timeWindow: '7days',        // Look at last 7 days
  baseline: '30days',         // Compare to 30-day baseline
  method: 'statistical',      // Use statistical methods
  autoThreshold: true         // Automatically determine threshold
})

// ✅ Pattern 4: Streaming outlier detection
async function detectOutliersInStream() {
  const outlierStream = brain.neural.outlierStream({
    batchSize: 50,
    updateInterval: 100,       // Check every 100 new items
    adaptiveThreshold: true    // Threshold adapts as data changes
  })

  for await (const batch of outlierStream) {
    console.log(`Batch ${batch.batchNumber}: ${batch.outliers.length} outliers detected`)

    // Process outliers immediately
    for (const outlier of batch.outliers) {
      await handleOutlier(outlier)
    }
  }
}

async function handleOutlier(outlier: any) {
  // Flag for manual review
  await brain.update(outlier.id, {
    metadata: {
      flagged: true,
      outlierScore: outlier.score,
      outlierReason: outlier.reason,
      flaggedAt: Date.now()
    }
  })
}
```

## 📊 Visualization Patterns

### ❌ **WRONG - Manual Visualization Data Preparation**

```typescript
// DON'T DO THIS - Manual coordinate calculation
async function prepareVisualizationManually() {
  const items = await brain.find({ limit: 500 })
  const coordinates = []

  // Manual dimensionality reduction (complex math)
  for (const item of items) {
    const vector = await brain.embed(item.data)
    // Complex PCA/t-SNE calculations manually
    const x = complexMathFunction(vector)  // ❌ Error-prone
    const y = anotherComplexFunction(vector)
    coordinates.push({ id: item.id, x, y })
  }

  return coordinates
}
```

### ✅ **CORRECT - AI-Powered Visualization**

```typescript
// ✅ Pattern 1: Automatic 2D visualization
const visualization = await brain.neural.visualize({
  dimensions: 2,               // 2D plot
  algorithm: 'umap',          // UMAP for better clustering preservation
  maxItems: 1000,             // Performance limit
  includeMetadata: true,      // Include item metadata in output
  colorBy: 'cluster'          // Color points by cluster membership
})

// Result format:
// {
//   points: [{ id, x, y, cluster, metadata }, ...],
//   clusters: [{ id, centroid: [x, y], members: [...] }, ...],
//   stats: { stress, kruskalStress, trustworthiness }
// }

// ✅ Pattern 2: 3D visualization for complex data
const viz3D = await brain.neural.visualize({
  dimensions: 3,
  algorithm: 'tsne',
  perplexity: 30,             // t-SNE parameter
  learningRate: 200,          // t-SNE learning rate
  iterations: 1000            // Number of optimization steps
})

// ✅ Pattern 3: Interactive visualization with filtering
const interactiveViz = await brain.neural.visualize({
  filter: {
    type: 'document',
    createdAt: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 }
  },
  groupBy: 'category',        // Group points by metadata field
  showLabels: true,           // Include text labels
  labelField: 'title',        // Field to use for labels
  includeEdges: true,         // Show connections between similar items
  edgeThreshold: 0.8          // Only show high-similarity connections
})

// ✅ Pattern 4: Real-time visualization updates
class LiveVisualization {
  private visualization: any = null
  private updateInterval: NodeJS.Timeout | null = null

  async start() {
    // Initial visualization
    this.visualization = await brain.neural.visualize({
      dimensions: 2,
      algorithm: 'umap',
      maxItems: 500,
      includeMetadata: true
    })

    // Update every 30 seconds
    this.updateInterval = setInterval(async () => {
      await this.update()
    }, 30000)
  }

  async update() {
    // Get recent items
    const recentItems = await brain.find({
      where: {
        createdAt: { $gte: Date.now() - 30000 }  // Last 30 seconds
      },
      limit: 50
    })

    if (recentItems.length > 0) {
      // Incrementally update visualization
      const updates = await brain.neural.updateVisualization(
        this.visualization.id,
        {
          newItems: recentItems.map(item => item.id),
          algorithm: 'incremental'  // Faster incremental updates
        }
      )

      this.visualization = { ...this.visualization, ...updates }
      this.onUpdate(updates)
    }
  }

  onUpdate(updates: any) {
    // Emit updates to frontend
    console.log(`Visualization updated: ${updates.newPoints.length} new points`)
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }
}
```

## 🚀 Performance Optimization Patterns

### ✅ **High-Performance Neural Operations**

```typescript
// ✅ Pattern 1: Batch processing for similarity
async function batchSimilarityCalculation(itemPairs: Array<[string, string]>) {
  const batchSize = 100
  const results = []

  for (let i = 0; i < itemPairs.length; i += batchSize) {
    const batch = itemPairs.slice(i, i + batchSize)

    const batchResults = await Promise.all(
      batch.map(async ([a, b]) => ({
        from: a,
        to: b,
        similarity: await brain.neural.similar(a, b)
      }))
    )

    results.push(...batchResults)

    // Progress reporting
    console.log(`Processed ${Math.min(i + batchSize, itemPairs.length)}/${itemPairs.length} pairs`)
  }

  return results
}

// ✅ Pattern 2: Caching expensive operations
class NeuralCache {
  private clusterCache = new Map()
  private similarityCache = new Map()
  private readonly TTL = 5 * 60 * 1000  // 5 minutes

  async getClusters(options: any) {
    const key = JSON.stringify(options)
    const cached = this.clusterCache.get(key)

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data
    }

    const clusters = await brain.neural.clusters(undefined, options)
    this.clusterCache.set(key, {
      data: clusters,
      timestamp: Date.now()
    })

    return clusters
  }

  async getSimilarity(id1: string, id2: string) {
    // Create consistent cache key regardless of order
    const key = [id1, id2].sort().join('-')
    const cached = this.similarityCache.get(key)

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data
    }

    const similarity = await brain.neural.similar(id1, id2)
    this.similarityCache.set(key, {
      data: similarity,
      timestamp: Date.now()
    })

    return similarity
  }
}

// ✅ Pattern 3: Memory-efficient streaming
async function processLargeDatasetEfficiently() {
  const stream = brain.neural.clusterStream({
    batchSize: 50,              // Small batches for memory efficiency
    maxMemoryMB: 256,          // Memory limit
    diskCache: true,           // Use disk for temporary storage
    compression: true          // Compress cached data
  })

  const results = []
  let totalProcessed = 0

  for await (const batch of stream) {
    // Process batch immediately, don't accumulate in memory
    const processedBatch = await processBatch(batch)

    // Save to disk or send to another service
    await saveBatchToDisk(processedBatch)

    totalProcessed += batch.items.length
    console.log(`Processed ${totalProcessed} items`)

    // Clear memory
    batch.items = null
  }

  return { totalProcessed }
}

// ✅ Pattern 4: Parallel processing with worker threads
async function parallelNeuralProcessing(items: string[]) {
  const numWorkers = require('os').cpus().length
  const batchSize = Math.ceil(items.length / numWorkers)

  const workers = []
  for (let i = 0; i < numWorkers; i++) {
    const batch = items.slice(i * batchSize, (i + 1) * batchSize)
    if (batch.length > 0) {
      workers.push(processWorkerBatch(batch))
    }
  }

  const results = await Promise.all(workers)
  return results.flat()
}

async function processWorkerBatch(batch: string[]) {
  // This would run in a worker thread in real implementation
  return Promise.all(
    batch.map(async itemId => {
      const neighbors = await brain.neural.neighbors(itemId, { limit: 5 })
      return { itemId, neighbors }
    })
  )
}
```

## 🎯 Summary: Neural API Best Practices

| ❌ **Avoid These Patterns** | ✅ **Use These Instead** |
|---------------------------|------------------------|
| Manual similarity loops | `brain.neural.neighbors()` |
| Uncontrolled clustering | Limit items and set maxClusters |
| Manual outlier detection | `brain.neural.outliers()` |
| Manual visualization prep | `brain.neural.visualize()` |
| Loading entire datasets | Streaming and batch processing |
| No caching | Cache expensive operations |
| Blocking operations | Parallel and async patterns |

---

**🎉 Following these patterns gives you:**
- 🚀 **Optimized performance** with intelligent algorithms
- 🧠 **AI-powered insights** instead of manual statistics
- 📊 **Rich visualizations** for data exploration
- 🎯 **Accurate clustering** with semantic understanding
- 🚨 **Smart outlier detection** for quality control
- ⚡ **Scalable processing** for large datasets

**Next:** [Augmentation Patterns →](./AUGMENTATION_PATTERNS.md) | [Core API Patterns →](./CORE_API_PATTERNS.md)