# Neural API Guide

> Semantic intelligence features for clustering, similarity, and analysis

## Overview

The Neural API provides advanced AI-powered features for understanding relationships and patterns in your data. Access it through `brain.neural` after initializing Brainy.

## Quick Start

```javascript
import { BrainyData } from '@soulcraft/brainy'

const brain = new BrainyData()
await brain.init()

// Access Neural API
const neural = brain.neural

// Find similar items
const similarity = await neural.similar('text1', 'text2')

// Auto-cluster your data
const clusters = await neural.clusters()
```

## Core Features

### 1. Semantic Clustering

Automatically group related items based on their meaning:

```javascript
// Simple clustering - let Brainy decide
const clusters = await neural.clusters()

// Each cluster contains:
// - id: Unique identifier
// - members: Array of item IDs in this cluster
// - centroid: The "center" of the cluster
// - label: Optional descriptive label
// - confidence: How confident the clustering is

// Example: Organize customer feedback
const feedback = [
  await brain.add("The app crashes when I upload photos"),
  await brain.add("Photo upload feature is broken"),
  await brain.add("Great customer service!"),
  await brain.add("Support team was very helpful"),
  await brain.add("Pricing is too high"),
  await brain.add("Too expensive for what it offers")
]

const themes = await neural.clusters()
// Results in 3 clusters: bugs, support, pricing
```

#### Advanced Clustering Options

```javascript
// Control clustering behavior
const clusters = await neural.clusters({
  algorithm: 'kmeans',      // Algorithm to use
  maxClusters: 5,           // Maximum clusters to create
  threshold: 0.7            // Minimum similarity within clusters
})

// Cluster specific items only
const techItems = ['id1', 'id2', 'id3', 'id4']
const techClusters = await neural.clusters(techItems)

// Find clusters near a specific item
const relatedClusters = await neural.clusters('central-item-id')
```

### 2. Similarity Calculation

Compare any two items to see how similar they are:

```javascript
// Compare by ID
const score = await neural.similar('item1-id', 'item2-id')
// Returns 0-1 (0 = completely different, 1 = identical)

// Compare text directly
const score = await neural.similar(
  "Machine learning is fascinating",
  "AI and deep learning are interesting"
)
// Returns ~0.75 (pretty similar)

// Compare vectors
const v1 = await brain.embed("concept 1")
const v2 = await brain.embed("concept 2")
const score = await neural.similar(v1, v2)

// Get detailed similarity analysis
const detailed = await neural.similar('id1', 'id2', { 
  detailed: true 
})
// Returns: {
//   score: 0.85,
//   confidence: 0.92,
//   explanation: "High semantic overlap in technology domain"
// }
```

### 3. Finding Neighbors

Discover items similar to a given item:

```javascript
// Find 5 most similar items
const neighbors = await neural.neighbors('item-id', 5)

// Each neighbor has:
// - id: The neighbor's ID
// - similarity: How similar (0-1)
// - data: The actual content

// Example: Recommend similar articles
const articleId = await brain.add("Guide to React Hooks")
const similar = await neural.neighbors(articleId, 3)

for (const article of similar) {
  console.log(`${article.similarity * 100}% similar: ${article.data}`)
}
```

### 4. Semantic Hierarchy

Build a hierarchy showing relationships between items:

```javascript
const hierarchy = await neural.hierarchy('item-id')

// Returns structure like:
// {
//   self: { id: 'item-id', type: 'article' },
//   parent: { id: 'parent-id', similarity: 0.8 },
//   siblings: [
//     { id: 'sibling1', similarity: 0.75 },
//     { id: 'sibling2', similarity: 0.72 }
//   ],
//   children: [
//     { id: 'child1', similarity: 0.85 }
//   ]
// }

// Use for navigation or breadcrumbs
const hier = await neural.hierarchy(currentDoc)
console.log(`You are here: ${hier.self.id}`)
if (hier.parent) {
  console.log(`Parent topic: ${hier.parent.id}`)
}
```

### 5. Outlier Detection

Find unusual or anomalous items in your data:

```javascript
// Find items that don't fit patterns
const outliers = await neural.outliers(0.3)
// Returns array of IDs that are > 0.3 distance from others

// Example: Detect spam or unusual content
const messages = [
  await brain.add("Meeting at 3pm"),
  await brain.add("Lunch plans for tomorrow"),
  await brain.add("BUY NOW!!! AMAZING DEALS!!!"),
  await brain.add("Project deadline next week")
]

const suspicious = await neural.outliers(0.4)
// Returns the spam message ID
```

### 6. Visualization Support

Generate data for visualization libraries:

```javascript
// Create force-directed graph data
const vizData = await neural.visualize({
  maxNodes: 100,        // Limit nodes for performance
  dimensions: 2,        // 2D or 3D
  algorithm: 'force'    // Layout algorithm
})

// Returns:
// {
//   nodes: [
//     { id: 'n1', x: 10, y: 20, cluster: 'c1' },
//     { id: 'n2', x: 30, y: 40, cluster: 'c1' }
//   ],
//   edges: [
//     { source: 'n1', target: 'n2', weight: 0.8 }
//   ],
//   clusters: [
//     { id: 'c1', color: '#ff6b6b', size: 15 }
//   ]
// }

// Use with D3.js, Cytoscape, or other viz libraries
const data = await neural.visualize({ dimensions: 3 })
// Now feed to Three.js for 3D visualization
```

## Practical Examples

### Content Recommendation System

```javascript
// User reads an article
const currentArticle = 'article-123'

// Find similar content
const recommendations = await neural.neighbors(currentArticle, 5)

// Group all content into topics
const topics = await neural.clusters()

// Find which topic this article belongs to
const currentTopic = topics.find(t => 
  t.members.includes(currentArticle)
)

// Recommend from same topic first, then similar items
const sameTopicArticles = currentTopic.members
  .filter(id => id !== currentArticle)
  .slice(0, 3)
```

### Customer Feedback Analysis

```javascript
// Add feedback with metadata
const feedbackIds = []
for (const feedback of customerFeedback) {
  const id = await brain.add(feedback.text, {
    rating: feedback.rating,
    date: feedback.date,
    product: feedback.product
  })
  feedbackIds.push(id)
}

// Cluster to find themes
const themes = await neural.clusters(feedbackIds)

// Analyze each theme
for (const theme of themes) {
  const items = await brain.getNouns(theme.members)
  
  const avgRating = items.reduce((sum, item) => 
    sum + item.metadata.rating, 0) / items.length
  
  console.log(`Theme with ${theme.members.length} items`)
  console.log(`Average rating: ${avgRating}`)
  
  // Find representative feedback for this theme
  const centroidId = theme.members[0] // Closest to center
  const example = await brain.getNoun(centroidId)
  console.log(`Example: "${example.data}"`)
}
```

### Knowledge Base Organization

```javascript
// Analyze existing knowledge base
const allDocs = await brain.getNouns({ type: 'document' })

// Find duplicate or highly similar content
const duplicates = []
for (let i = 0; i < allDocs.length; i++) {
  for (let j = i + 1; j < allDocs.length; j++) {
    const similarity = await neural.similar(
      allDocs[i].id, 
      allDocs[j].id
    )
    if (similarity > 0.95) {
      duplicates.push([allDocs[i].id, allDocs[j].id])
    }
  }
}

// Build topic hierarchy
const mainTopics = await neural.clusters({
  maxClusters: 10,
  algorithm: 'hierarchical'
})

// For each main topic, find subtopics
for (const topic of mainTopics) {
  const subtopics = await neural.clusters(topic.members)
  console.log(`Topic has ${subtopics.length} subtopics`)
}
```

## Performance Tips

1. **Caching**: Neural API automatically caches results. Repeated calls with same parameters are instant.

2. **Batch Operations**: Process multiple items together rather than one at a time.

3. **Sampling**: For large datasets, use sampling:
   ```javascript
   const clusters = await neural.clusters({
     algorithm: 'sample',
     sampleSize: 1000  // Only analyze 1000 items
   })
   ```

4. **Async Processing**: All neural operations are async and non-blocking.

## Error Handling

```javascript
try {
  const similarity = await neural.similar('id1', 'id2')
} catch (error) {
  // Handle errors
  if (error.message.includes('not found')) {
    console.log('One of the items does not exist')
  }
}

// Safe clustering with empty data
const clusters = await neural.clusters([])
// Returns empty array, doesn't throw

// Non-existent IDs return 0 similarity
const sim = await neural.similar('fake-id-1', 'fake-id-2')
// Returns 0
```

## Advanced Configuration

```javascript
// Configure neural behavior at initialization
const brain = new BrainyData({
  neural: {
    cacheSize: 1000,        // Cache up to 1000 results
    defaultAlgorithm: 'kmeans',
    similarityMetric: 'cosine'
  }
})
```

## Next Steps

- Explore [Triple Intelligence](../architecture/triple-intelligence.md) for combined vector + graph + metadata queries
- Learn about [Augmentations](../augmentations/README.md) to extend Neural API
- See [API Reference](../api/README.md) for complete method documentation