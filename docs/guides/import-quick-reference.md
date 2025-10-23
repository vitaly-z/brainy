# 📥 Import Quick Reference

> **Quick guide to importing data into Brainy**

---

## Basic Import

```typescript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

// Import from file path
await brain.import('/path/to/data.xlsx')

// Import from buffer
const buffer = fs.readFileSync('data.csv')
await brain.import(buffer)

// Import from object
const jsonData = { items: [...] }
await brain.import(jsonData)
```

---

## Supported Formats

| Format | Extensions | Auto-Detect |
|--------|------------|-------------|
| **Excel** | `.xlsx`, `.xls` | ✅ Yes |
| **CSV** | `.csv` | ✅ Yes |
| **JSON** | `.json` | ✅ Yes |
| **Markdown** | `.md` | ✅ Yes |
| **PDF** | `.pdf` | ✅ Yes |
| **YAML** | `.yaml`, `.yml` | ✅ Yes |
| **DOCX** | `.docx` | ✅ Yes |

---

## Common Options

### Basic Options

```typescript
await brain.import(file, {
  // Specify format (optional - auto-detects by default)
  format: 'excel',

  // VFS destination path
  vfsPath: '/imports/products',

  // Enable/disable features
  createEntities: true,           // Create graph entities (default: true)
  createRelationships: true,      // Create relationships (default: true)
  preserveSource: true,           // Keep original file (default: true)

  // Progress tracking
  onProgress: (progress) => {
    console.log(`${progress.processed}/${progress.total}`)
  }
})
```

### Neural Intelligence

```typescript
await brain.import(file, {
  // Entity type classification
  enableNeuralExtraction: true,      // Auto-classify entity types (default: true)

  // Relationship type inference
  enableRelationshipInference: true, // Auto-infer relationship types (default: true)

  // Concept extraction
  enableConceptExtraction: true,     // Extract key concepts (default: true)

  // Confidence threshold
  confidenceThreshold: 0.6           // Min confidence for extraction (default: 0.6)
})
```

### Deduplication

```typescript
await brain.import(file, {
  enableDeduplication: true,         // Check for duplicates (default: false)
  deduplicationThreshold: 0.85       // Similarity threshold (default: 0.85)
})
```

### VFS Organization

```typescript
await brain.import(file, {
  vfsPath: '/imports/catalog',

  // Grouping strategy
  groupBy: 'type',  // Group by entity type (default)
  // OR
  groupBy: 'sheet', // Group by Excel sheet name
  // OR
  groupBy: 'flat',  // All entities in root directory
  // OR
  groupBy: 'custom',
  customGrouping: (entity) => {
    return `/by-category/${entity.category}`
  }
})
```

### Always-On Streaming (v4.2.0+)

All imports use streaming with adaptive flush intervals. Query data as it's imported:

```typescript
await brain.import(file, {
  onProgress: async (progress) => {
    // Query data during import
    if (progress.queryable) {
      const products = await brain.find({ type: 'product', limit: 10000 })
      console.log(`${products.length} products imported so far`)
    }
  }
})
```

**Progressive intervals** (automatic):
- 0-999 entities: Flush every 100 (frequent early updates)
- 1K-9.9K: Flush every 1000 (balanced)
- 10K+: Flush every 5000 (minimal overhead)
- Adjusts dynamically as import grows

---

## Complete Example

```typescript
import { Brainy } from '@soulcraft/brainy'
import * as fs from 'fs'

async function importCatalog() {
  const brain = new Brainy({
    storage: {
      type: 'gcs',
      bucket: 'my-bucket',
      prefix: 'brainy/'
    }
  })
  await brain.init()

  const buffer = fs.readFileSync('catalog.xlsx')

  const result = await brain.import(buffer, {
    format: 'excel',
    vfsPath: '/imports/product-catalog',
    groupBy: 'type',

    // Neural intelligence
    enableNeuralExtraction: true,
    enableRelationshipInference: true,
    confidenceThreshold: 0.7,

    // Deduplication
    enableDeduplication: true,
    deduplicationThreshold: 0.85,

    // Progress tracking (streaming always enabled)
    onProgress: async (progress) => {
      console.log(`Stage: ${progress.stage}`)
      console.log(`Progress: ${progress.processed}/${progress.total}`)

      // Query live data (available after each flush)
      if (progress.queryable) {
        const products = await brain.find({ type: 'product', limit: 100000 })
        const people = await brain.find({ type: 'person', limit: 100000 })
        const all = await brain.find({ limit: 100000 })

        const stats = {
          products: products.length,
          people: people.length,
          total: all.length
        }
        console.log('Current counts:', stats)
      }
    }
  })

  console.log('Import complete!')
  console.log(`Entities: ${result.entities.length}`)
  console.log(`Relationships: ${result.relationships.length}`)
  console.log(`VFS path: ${result.vfs.rootPath}`)
  console.log(`Processing time: ${result.stats.processingTime}ms`)

  return result
}

importCatalog()
```

---

## Import Result

```typescript
interface ImportResult {
  importId: string
  format: string
  formatConfidence: number

  vfs: {
    rootPath: string
    directories: string[]
    files: Array<{
      path: string
      entityId?: string
      type: 'entity' | 'metadata' | 'source' | 'relationships'
    }>
  }

  entities: Array<{
    id: string
    name: string
    type: NounType
    vfsPath?: string
  }>

  relationships: Array<{
    id: string
    from: string
    to: string
    type: VerbType
  }>

  stats: {
    entitiesExtracted: number
    relationshipsInferred: number
    vfsFilesCreated: number
    graphNodesCreated: number
    graphEdgesCreated: number
    entitiesMerged: number        // From deduplication
    entitiesNew: number           // Newly created
    processingTime: number        // In milliseconds
  }
}
```

---

## Progress Callback

```typescript
interface ImportProgress {
  stage: 'detecting' | 'extracting' | 'storing-vfs' | 'storing-graph' | 'complete'
  message: string
  processed?: number              // Current item number
  total?: number                  // Total items
  entities?: number               // Entities extracted
  relationships?: number          // Relationships inferred
  throughput?: number             // Rows per second
  eta?: number                    // Estimated time remaining (ms)
  queryable?: boolean             // Data queryable now (streaming mode)
}
```

---

## Tips & Best Practices

### Performance

```typescript
// Streaming is always on with adaptive intervals (zero config)
// - Small imports (<1K): Flush every 100 entities
// - Medium (1K-10K): Flush every 1000 entities
// - Large (>10K): Flush every 5000 entities

// Disable features you don't need for faster imports
await brain.import(file, {
  enableNeuralExtraction: false,      // 10x faster
  enableRelationshipInference: false, // 5x faster
  enableConceptExtraction: false      // 2x faster
})
```

### Error Handling

```typescript
try {
  const result = await brain.import(file, {
    vfsPath: '/imports/data',
    onProgress: (p) => console.log(p.message)
  })
  console.log('Success:', result.stats)
} catch (error) {
  console.error('Import failed:', error.message)

  // Check partial results in VFS
  const files = await brain.vfs().readdir('/imports')
  console.log('Partial files:', files)
}
```

### Querying Imported Data

```typescript
// After import completes
const result = await brain.import(file)

// Find entities by type
const products = await brain.find({ type: 'Product' })

// Get entity relationships
const relations = await brain.getRelations(products[0].id)

// Search VFS
const vfsFiles = await brain.vfs().find(result.vfs.rootPath + '/**/*.json')

// Read entity from VFS
const entity = await brain.vfs().readJSON(vfsFiles[0].path)
```

---

## Excel-Specific Tips

### Column Detection

Brainy auto-detects columns with flexible matching:

| Your Column | Matches Pattern |
|-------------|-----------------|
| `Name` | term\|name\|title\|concept |
| `Description` | definition\|description\|desc\|details |
| `Type` | type\|category\|kind\|class |
| `Related` | related\|see also\|links\|references |

### Multiple Sheets

All sheets are processed automatically:

```typescript
// catalog.xlsx with 3 sheets: Products, People, Places
const result = await brain.import('catalog.xlsx', {
  groupBy: 'sheet'  // Creates /Products/, /People/, /Places/
})
```

---

## CSV-Specific Tips

### Headers

First row is treated as headers. Ensure headers exist:

```csv
Term,Definition,Type
Product A,Description A,Product
Product B,Description B,Product
```

### Large CSVs

For large CSV files (>100K rows), streaming is automatic:

```typescript
await brain.import(largeCsv, {
  // Automatically flushes every 5000 entities (adaptive)
  enableNeuralExtraction: false  // Faster for large imports
})
```

---

## JSON-Specific Tips

### Supported Structures

```javascript
// Array of objects
[
  { name: "Item 1", type: "Product" },
  { name: "Item 2", type: "Product" }
]

// Nested objects (creates hierarchical relationships)
{
  "company": {
    "name": "Acme Corp",
    "products": [
      { "name": "Widget", "price": 9.99 }
    ]
  }
}
```

---

## Further Reading

- [Import Flow Guide](./import-flow.md) - Deep dive into how imports work
- [Streaming Imports](./streaming-imports.md) - Progressive imports for large files
- [VFS Guide](./vfs-guide.md) - Working with the virtual file system
- [Type Classification](./type-classification.md) - How entity types are inferred
- [Relationship Inference](./relationship-inference.md) - How relationships are classified

---

**Questions?** Check the [FAQ](../faq.md) or [open an issue](https://github.com/soulcraft/brainy/issues)!
