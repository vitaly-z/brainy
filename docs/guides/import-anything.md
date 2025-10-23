# Import Anything - ONE Method, Infinite Intelligence 🚀

Brainy's import is **ONE magical method** that understands EVERYTHING:
- 📊 Data (objects, arrays, strings)
- 📁 Files (auto-detects by path)
- 🌐 URLs (auto-fetches with authentication support)
- 📄 Formats (JSON, CSV, Excel, PDF, YAML, DOCX, Markdown - all auto-detected)

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
// ✨ Auto-detects encoding, delimiter, types - creates entities!

// Or pass CSV content directly
const csv = `name,age,city
John,30,NYC
Jane,25,SF`

await brain.import(csv, { format: 'csv' })
// ✨ Smart CSV parsing handles quotes, escapes, everything!
```

### 📊 Import Excel - Multi-Sheet Support
```javascript
// Import entire Excel workbook
await brain.import('sales-report.xlsx')
// ✨ Processes all sheets, preserves structure, infers types!

// Or specific sheets only
await brain.import('data.xlsx', {
  excelSheets: ['Customers', 'Orders']
})
// ✨ Multi-sheet data becomes interconnected entities!
```

### 📑 Import PDF - Text & Tables
```javascript
// Import PDF documents
await brain.import('research-paper.pdf')
// ✨ Extracts text, detects tables, preserves metadata!

// With table extraction
await brain.import('report.pdf', {
  pdfExtractTables: true
})
// ✨ Converts PDF tables to structured data automatically!
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

### 📄 Import Word Documents (DOCX) - v4.2.0
```javascript
// From file path
await brain.import('research-paper.docx')
// ✨ Extracts text, headings, tables, and metadata!

// Or from buffer
const buffer = fs.readFileSync('document.docx')
await brain.import(buffer, { format: 'docx' })
// ✨ Uses heading hierarchy for entity organization!

// With neural extraction
await brain.import('report.docx', {
  enableNeuralExtraction: true,
  enableHierarchicalRelationships: true
})
// ✨ Extracts entities from paragraphs and creates relationships within sections!
```

### 🌐 Import from URLs - Auto-Detected!
```javascript
// Just pass the URL - it knows!
await brain.import('https://api.example.com/data.json')
// ✨ Auto-detects URL, fetches, parses, processes!

// Works with any URL
await brain.import('https://data.gov/census.csv')
// ✨ Fetches CSV from web, parses, imports!

// With authentication (v4.2.0)
await brain.import({
  type: 'url',
  data: 'https://api.example.com/private/data.xlsx',
  auth: {
    username: 'user',
    password: 'pass'
  }
})
// ✨ Supports basic authentication for protected resources!

// With custom headers (v4.2.0)
await brain.import({
  type: 'url',
  data: 'https://api.example.com/data.json',
  headers: {
    'Authorization': 'Bearer TOKEN',
    'X-API-Key': 'your-key'
  }
})
// ✨ Full HTTP header customization support!
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

1. **Auto-detects format** - CSV, Excel, PDF, JSON, YAML, DOCX, Markdown, or by file extension
2. **Intelligent parsing** - CSV (encoding/delimiter), Excel (multi-sheet), PDF (text/tables), DOCX (headings/paragraphs)
3. **Identifies entity types** - Uses AI to classify as Person, Document, Product, etc. (31 types!)
4. **Finds relationships** - Detects connections like "belongsTo", "createdBy", "references" (40 types!)
5. **Scores confidence & weight** - Every entity and relationship gets quality metrics (v4.2.0)
6. **Creates embeddings** - Makes everything semantically searchable
7. **Indexes metadata** - Enables lightning-fast filtering with range queries (v4.2.0)

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

## Confidence & Weight Scoring - v4.2.0

Every entity and relationship gets confidence and weight scores:

```javascript
// Import with confidence threshold
await brain.import(data, {
  confidenceThreshold: 0.8  // Only extract entities with >80% confidence
})

// Query high-confidence entities using range queries
const highConfidence = await brain.find({
  where: {
    confidence: { gte: 0.8 }  // Get entities with confidence >= 0.8
  }
})

// Range query operators: gt, gte, lt, lte, between
const mediumConfidence = await brain.find({
  where: {
    confidence: { between: [0.6, 0.8] }
  }
})
```

**What do confidence scores mean?**
- **High (>0.8)**: Very confident entity classification
- **Medium (0.6-0.8)**: Reasonable confidence
- **Low (<0.6)**: Uncertain classification (filtered by default)

**Weights** indicate importance/relevance within the document context.

## Per-Sheet Excel Extraction - v4.2.0

Excel files with multiple sheets can be organized by sheet:

```javascript
// Group entities by sheet in VFS
await brain.import('multi-sheet-data.xlsx', {
  groupBy: 'sheet'  // Creates separate directories for each sheet
})

// Result VFS structure:
// /imports/data/
//   ├── Sheet1/
//   │   ├── entity1.json
//   │   └── entity2.json
//   └── Sheet2/
//       ├── entity3.json
//       └── entity4.json

// Other groupBy options:
// - 'type': Group by entity type (Person, Place, etc.)
// - 'flat': All entities in one directory
// - 'custom': Use custom grouping function
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
  // Format detection
  format: 'excel',                     // Force specific format (auto-detected if not specified)

  // VFS & Organization
  vfsPath: '/imports/my-data',         // Where to store in VFS (auto-generated if not specified)
  groupBy: 'type',                     // Group entities by: 'type' | 'sheet' | 'flat' | 'custom'
  preserveSource: true,                // Keep original source file in VFS (default: true)

  // Entity & Relationship Creation
  createEntities: true,                // Create entities in knowledge graph (default: true)
  createRelationships: true,           // Create relationships in knowledge graph (default: true)

  // Neural Intelligence
  enableNeuralExtraction: true,        // Use AI to extract entities (default: true)
  enableRelationshipInference: true,   // Use AI to infer relationships (default: true)
  enableConceptExtraction: true,       // Extract concepts from text (default: true)
  confidenceThreshold: 0.6,            // Minimum confidence for entities (0-1, default: 0.6)

  // Deduplication
  enableDeduplication: true,           // Check for duplicate entities (default: true)
  deduplicationThreshold: 0.85,        // Similarity threshold for duplicates (0-1, default: 0.85)
                                       // Note: Auto-disabled for imports >100 entities

  // Performance
  chunkSize: 100,                      // Batch size for processing (default: varies by operation)

  // History & Progress
  enableHistory: true,                 // Track import history (default: true)
  onProgress: (progress) => {          // Progress callback
    console.log(progress.stage, progress.message)
  }
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

- **Parallel processing** - Fast imports with concurrent operations
- **Batch operations** - Memory efficient chunk processing
- **Lazy loading** - Import system loads only when needed
- **Smart caching** - Type detection and format parsing results cached

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