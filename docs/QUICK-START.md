# 🚀 Brainy Quick Start Guide

Get up and running with Brainy in 5 minutes!

## Installation

```bash
npm install brainy
```

Or install globally for CLI access:
```bash
npm install -g brainy
```

## Basic Usage

### 1. Initialize Brainy

```javascript
import { BrainyData } from 'brainy'

const brain = new BrainyData()
await brain.init()
```

That's it! No configuration needed. Brainy automatically:
- Downloads embedding models (first time only)
- Sets up storage (in-memory by default)
- Initializes all augmentations
- Configures optimal settings

### 2. Add Your First Data

```javascript
// Add a simple string
await brain.add("JavaScript is a versatile programming language", { nounType: 'concept' })

// Add with metadata
await brain.add("React is a JavaScript library", {
  nounType: 'concept',
  type: "library",
  category: "frontend",
  popularity: "high"
})

// Add structured data
await brain.add({
  title: "Introduction to TypeScript",
  content: "TypeScript adds static typing to JavaScript",
  author: "John Doe"
}, {
  nounType: 'document',
  type: "article",
  date: "2024-01-15"
})
```

### 3. Search Your Data

```javascript
// Simple vector search
const results = await brain.search("programming languages")

// Natural language query
const articles = await brain.find("recent articles about TypeScript")

// With metadata filtering
const libraries = await brain.search("JavaScript", {
  metadata: { type: "library" },
  limit: 5
})
```

## Real-World Examples

### Example 1: Document Search System

```javascript
import { BrainyData } from 'brainy'
import fs from 'fs'

const brain = new BrainyData({
  storage: { 
    type: 'filesystem',
    path: './document-index'
  }
})
await brain.init()

// Index documents
const documents = [
  { file: 'api-guide.md', content: fs.readFileSync('./docs/api-guide.md', 'utf8') },
  { file: 'tutorial.md', content: fs.readFileSync('./docs/tutorial.md', 'utf8') },
  { file: 'faq.md', content: fs.readFileSync('./docs/faq.md', 'utf8') }
]

for (const doc of documents) {
  await brain.add(doc.content, {
    filename: doc.file,
    type: 'documentation',
    indexed: new Date().toISOString()
  })
}

// Search documents
const results = await brain.find("how to authenticate users")
console.log(`Found ${results.length} relevant documents:`)
results.forEach(r => console.log(`- ${r.metadata.filename} (${(r.score * 100).toFixed(1)}% match)`))
```

### Example 2: AI Chat with Memory

```javascript
import { BrainyData } from 'brainy'

const brain = new BrainyData()
await brain.init()

class ChatWithMemory {
  constructor(brain) {
    this.brain = brain
    this.sessionId = Date.now().toString()
  }
  
  async addMessage(role, content) {
    await this.brain.add(content, {
      role,
      sessionId: this.sessionId,
      timestamp: Date.now()
    })
  }
  
  async getContext(query, limit = 5) {
    // Find relevant previous messages
    const relevant = await this.brain.find(query, { limit })
    return relevant.map(r => ({
      role: r.metadata.role,
      content: r.content
    }))
  }
  
  async chat(userMessage) {
    // Store user message
    await this.addMessage('user', userMessage)
    
    // Get relevant context
    const context = await this.getContext(userMessage)
    
    // Your AI logic here (OpenAI, Anthropic, etc.)
    const aiResponse = await callYourAI(userMessage, context)
    
    // Store AI response
    await this.addMessage('assistant', aiResponse)
    
    return aiResponse
  }
}

const chat = new ChatWithMemory(brain)
const response = await chat.chat("What did we discuss about JavaScript?")
```

### Example 3: Semantic Code Search

```javascript
import { BrainyData } from 'brainy'
import { glob } from 'glob'
import fs from 'fs'

const brain = new BrainyData()
await brain.init()

// Index all JavaScript files
const files = await glob('src/**/*.js')
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  
  // Extract functions
  const functions = content.match(/function\s+(\w+)|const\s+(\w+)\s*=/g) || []
  
  await brain.add(content, {
    file,
    type: 'code',
    language: 'javascript',
    functions: functions.map(f => f.replace(/function\s+|const\s+|=/g, '').trim())
  })
}

// Search for code
const results = await brain.find("authentication middleware")
console.log('Relevant code files:')
results.forEach(r => {
  console.log(`\n${r.metadata.file}:`)
  console.log(`  Functions: ${r.metadata.functions.join(', ')}`)
  console.log(`  Relevance: ${(r.score * 100).toFixed(1)}%`)
})
```

## CLI Quick Examples

```bash
# Add data from CLI
brainy add "React is a JavaScript library for building UIs"

# Search
brainy search "JavaScript frameworks"

# Natural language find
brainy find "popular frontend libraries"

# Interactive chat mode
brainy chat

# Import JSON data
brainy import data.json

# Export your brain
brainy export --format json > backup.json

# Check status
brainy status
```

## Advanced Features

### Triple Intelligence Query

```javascript
// Combine vector search + metadata filters + graph relationships
const results = await brain.find({
  like: "React",                    // Vector similarity
  where: {                          // Metadata filtering
    type: "library",
    popularity: "high",
    year: { greaterThan: 2015 }
  },
  related: {                        // Graph relationships
    to: "JavaScript",
    depth: 2
  }
}, {
  limit: 10,
  includeContent: true
})
```

### Pagination

```javascript
// Cursor-based pagination for large result sets
let cursor = null
do {
  const results = await brain.search("programming", {
    limit: 100,
    cursor
  })
  
  // Process batch
  results.forEach(processResult)
  
  cursor = results.nextCursor
} while (cursor)
```

### Performance Optimization

```javascript
// Pre-filter with metadata for faster searches
const results = await brain.search("*", {
  metadata: {
    type: "article",
    category: "tech",
    date: { greaterThan: "2024-01-01" }
  },
  limit: 1000
})
```

## Storage Options

### Memory (Testing)
```javascript
const brain = new BrainyData()  // Default
```

### FileSystem (Development)
```javascript
const brain = new BrainyData({
  storage: {
    type: 'filesystem',
    path: './brain-data'
  }
})
```

### Browser (OPFS)
```javascript
const brain = new BrainyData({
  storage: { type: 'opfs' }
})
```

### S3 (Production)
```javascript
const brain = new BrainyData({
  storage: {
    type: 's3',
    bucket: 'my-brain-bucket',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY
    }
  }
})
```

## Tips & Best Practices

1. **Use metadata liberally** - It enables O(log n) filtering
2. **Batch operations when possible** - Use `import()` for bulk data
3. **Enable caching for production** - Automatic with default settings
4. **Use cursor pagination** - For large result sets
5. **Leverage natural language** - `find()` understands context

## Common Patterns

### Similarity Search
```javascript
// Find similar items to an existing one
const item = await brain.getNoun(id)
const similar = await brain.search(item.content, { limit: 5 })
```

### Time-based Queries
```javascript
// Recent items
const recent = await brain.search("*", {
  metadata: { 
    timestamp: { greaterThan: Date.now() - 86400000 } // Last 24 hours
  }
})
```

### Category Browsing
```javascript
// Get all items in a category
const category = await brain.search("*", {
  metadata: { category: "tutorials" },
  limit: 100
})
```

## Troubleshooting

### Models not loading?
```bash
# Clear cache and re-download
rm -rf ~/.cache/brainy
npm run download-models
```

### Slow initialization?
- First run downloads models (~25MB)
- Subsequent runs use cache (< 500ms)
- Use `storage: { type: 'memory' }` for testing

### Out of memory?
- Use filesystem or S3 storage for large datasets
- Enable worker threads (automatic in Node.js)
- Increase Node memory: `NODE_OPTIONS='--max-old-space-size=4096'`

## Next Steps

- 📖 Read the [full documentation](../README.md)
- 🏗️ Learn about [augmentations](augmentations/README.md)
- 🧠 Understand [Triple Intelligence](architecture/triple-intelligence.md)
- ☁️ Explore [Brain Cloud](https://soulcraft.com)

## Get Help

- GitHub Issues: [github.com/brainy-org/brainy](https://github.com/brainy-org/brainy)
- Documentation: [Full Docs](../README.md)
- Examples: [/examples](../../examples)

---

**Ready to build something amazing? You're all set! 🚀**