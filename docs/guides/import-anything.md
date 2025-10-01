# Import Anything - ONE Method, Infinite Intelligence 🚀

Brainy's import is **ONE magical method** that understands EVERYTHING:
- 📊 Data (objects, arrays, strings)
- 📁 Files (auto-detects by path)
- 🌐 URLs (auto-fetches)
- 📄 Formats (JSON, CSV, YAML, text - all auto-detected)

## The Ultimate Simplicity

```javascript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

// ONE method for EVERYTHING:
await brain.import(anything)
```

## Import Examples - It Just Works™

### 📊 Import JSON Data
```javascript
// Array of objects? No problem.
const people = [
  { name: 'Alice', role: 'Engineer', company: 'TechCorp' },
  { name: 'Bob', role: 'Designer', company: 'TechCorp' }
]

await brain.import(people)
// ✨ Automatically detected as Person entities with Organization relationships!
```

### 📄 Import CSV - File or String
```javascript
// From file? Just pass the path!
await brain.import('customers.csv')
// ✨ Auto-detects it's a file, parses CSV, creates entities!

// Or pass CSV content directly
const csv = `name,age,city
John,30,NYC
Jane,25,SF`

await brain.import(csv, { format: 'csv' })
// ✨ Smart CSV parsing handles quotes, escapes, everything!
```

### 📝 Import YAML - File or String
```javascript
// From file? Auto-detected!
await brain.import('config.yaml')
// ✨ Knows it's a file, reads it, parses YAML!

// Or directly:
const yaml = `
project: AI Assistant
team:
  - name: Alice
    role: Lead
  - name: Bob
    role: Dev
`
await brain.import(yaml, { format: 'yaml' })
// ✨ Hierarchical data becomes a connected graph!
```

### 🌐 Import from URLs - Auto-Detected!
```javascript
// Just pass the URL - it knows!
await brain.import('https://api.example.com/data.json')
// ✨ Auto-detects URL, fetches, parses, processes!

// Works with any URL
await brain.import('https://data.gov/census.csv')
// ✨ Fetches CSV from web, parses, imports!
```

### 📖 Import Plain Text
```javascript
// Even unstructured text works
const article = `Artificial Intelligence is transforming industries.
Machine learning enables predictive analytics.
Natural language processing powers chatbots.`

await brain.import(article, { format: 'text' })
// ✨ Extracts concepts, creates semantic connections!
```

## The Magic Behind the Scenes

When you import data, Brainy:

1. **Auto-detects format** - JSON, CSV, YAML, text, or by file extension
2. **Identifies entity types** - Uses AI to classify as Person, Document, Product, etc. (31 types!)
3. **Finds relationships** - Detects connections like "belongsTo", "createdBy", "references" (40 types!)
4. **Creates embeddings** - Makes everything semantically searchable
5. **Indexes metadata** - Enables lightning-fast filtering

## Intelligent Type Detection

Brainy automatically detects what TYPE of data you're importing:

```javascript
// This becomes a Person entity
{ name: 'John', email: 'john@example.com' }

// This becomes an Organization
{ companyName: 'Acme', employees: 500 }  

// This becomes a Document
{ title: 'Report', content: '...', author: 'Jane' }

// This becomes a Location
{ latitude: 37.7, longitude: -122.4, city: 'SF' }
```

**31 noun types** and **40 verb types** cover EVERYTHING!

## Relationship Detection

Brainy finds connections in your data:

```javascript
const data = [
  { id: 'u1', name: 'Alice', managerId: 'u2' },
  { id: 'u2', name: 'Bob', departmentId: 'd1' },
  { id: 'd1', name: 'Engineering' }
]

await brain.import(data)
// ✨ Automatically creates:
// - Alice "reportsTo" Bob
// - Bob "memberOf" Engineering
```

## Query Your Imported Data

Once imported, use Triple Intelligence to query:

```javascript
// Vector search
const similar = await brain.search('engineers')

// Natural language
const results = await brain.find('people in engineering who joined this year')

// Graph traversal + filters
const connected = await brain.find({
  like: 'Alice',
  connected: { depth: 2 },
  where: { department: 'Engineering' }
})
```

## Import Options (Optional!)

Everything works with zero config, but you can customize:

```javascript
await brain.import(data, {
  format: 'auto',        // 'json' | 'csv' | 'yaml' | 'text' | 'auto'
  batchSize: 50,         // Process in batches
  relationships: true    // Extract relationships (default: true)
})
```

## Error Handling

Import continues even if some items fail:

```javascript
const results = await brain.import(problematicData)
// Returns IDs of successful imports
// Logs warnings for failures
// Never crashes your app!
```

## Performance

- **Parallel processing** - Fast imports
- **Batch operations** - Memory efficient
- **Lazy loading** - ImportManager loads only when needed
- **Smart caching** - Type detection results are cached

## Use Cases

### 🏢 Business Data
```javascript
// Import ANY source - ONE method!
await brain.import('customers.csv')           // File
await brain.import('https://api.co/orders')   // URL
await brain.import(productsArray)             // Data

// Now query across all of it!
await brain.find('customers who bought products in Q4')
```

### 🔬 Research Data
```javascript
// Import research papers
await brain.import(papers)

// Import citations
await brain.import(citations)

// Find connections
await brain.find('papers citing machine learning from 2024')
```

### 📱 Application Data
```javascript
// Import users
await brain.import(users)

// Import posts
await brain.import(posts)

// Import comments
await brain.import(comments)

// Query the social graph
await brain.find('posts by users following Alice with >10 comments')
```

## The Philosophy

**Zero Configuration**: Works perfectly out of the box
**Maximum Intelligence**: AI understands your data's meaning
**Universal Protocol**: 31 nouns × 40 verbs = ANY data model
**Delightful DX**: Simple, clean, modern API

## The ONE Method Philosophy

```javascript
// ONE method that understands EVERYTHING:
await brain.import(data)        // Objects, arrays, strings
await brain.import('file.csv')  // Files (auto-detected)
await brain.import('http://..') // URLs (auto-fetched)

// It ALWAYS knows what to do! ✨
```

**Why ONE method?**
- 🎯 **Simpler** - No need to remember different methods
- 🧠 **Smarter** - Auto-detects what you're importing
- ✨ **Magical** - It just works, every time

That's the power of the Universal Knowledge Protocol™ - infinite intelligence, zero complexity!