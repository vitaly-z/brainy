# Neural Extraction API - AI-Powered Concept and Entity Detection

## Overview

Brainy's Neural Extraction system uses embeddings and a sophisticated NounType taxonomy to extract meaningful entities and concepts from text. Unlike simple regex-based extraction, neural extraction understands semantic meaning and context.

## Architecture

```
┌─────────────────────────────────────┐
│     brain.extractConcepts()         │
│   (High-level concept wrapper)      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       brain.extract()               │
│   (Full entity extraction)          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│     NeuralEntityExtractor           │
│  (394-line production impl)         │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
  ┌─────────┐   ┌──────────┐
  │ Pattern │   │ Embeddings│
  │ Matching│   │ + NounType│
  │         │   │ Taxonomy  │
  └─────────┘   └──────────┘
```

## NounType Taxonomy

Brainy uses a 42-noun + 127-verb type taxonomy for entity classification:

### Core Types
- **Person** - Individual humans
- **Organization** - Companies, institutions, groups
- **Location** - Places, cities, countries
- **Event** - Occurrences, happenings
- **Product** - Goods, services, items
- **Concept** - Abstract ideas, theories
- **Topic** - Subject areas, domains

### Technical Types
- **API** - Application programming interfaces
- **Service** - Software services
- **Component** - System components
- **Function** - Code functions
- **Class** - Object-oriented classes
- **Module** - Software modules

### Creative Types
- **Character** - Fictional characters
- **Setting** - Story locations
- **Plot** - Story arcs
- **Theme** - Narrative themes

### Business Types
- **Customer** - Clients, users
- **Project** - Business projects
- **Process** - Business processes
- **KPI** - Key performance indicators

And more...

## API Reference

### brain.extract(text, options)

Extracts entities from text with full configuration options.

**Parameters:**
```typescript
brain.extract(
  text: string,
  options?: {
    types?: NounType[]        // Filter to specific types
    confidence?: number       // Min confidence (0-1, default: 0.6)
    includeVectors?: boolean  // Include embeddings
    neuralMatching?: boolean  // Use neural classification (default: true)
  }
): Promise<ExtractedEntity[]>
```

**Returns:**
```typescript
interface ExtractedEntity {
  text: string              // Extracted text
  type: NounType           // Classified type
  position: number         // Position in text
  confidence: number       // Confidence score (0-1)
  vector?: number[]        // Optional embedding
}
```

**Example:**
```typescript
const brain = new Brainy()
await brain.init()

const text = `
  The UserService API provides authentication and authorization.
  It integrates with the Database component for user storage.
`

// Extract all entities
const entities = await brain.extract(text)
console.log(entities)
// [
//   { text: 'UserService', type: 'Service', confidence: 0.87 },
//   { text: 'API', type: 'API', confidence: 0.92 },
//   { text: 'authentication', type: 'Concept', confidence: 0.79 },
//   { text: 'authorization', type: 'Concept', confidence: 0.81 },
//   { text: 'Database', type: 'Component', confidence: 0.85 }
// ]

// Extract only technical entities
const technical = await brain.extract(text, {
  types: [NounType.Service, NounType.API, NounType.Component],
  confidence: 0.8
})
console.log(technical)
// [
//   { text: 'UserService', type: 'Service', confidence: 0.87 },
//   { text: 'API', type: 'API', confidence: 0.92 },
//   { text: 'Database', type: 'Component', confidence: 0.85 }
// ]
```

### brain.extractConcepts(text, options)

Simplified API specifically for concept extraction.

**Parameters:**
```typescript
brain.extractConcepts(
  text: string,
  options?: {
    confidence?: number    // Min confidence (default: 0.7)
    limit?: number        // Max concepts to return
  }
): Promise<string[]>
```

**Returns:**
```typescript
string[]  // Array of concept names (deduplicated, lowercase)
```

**Example:**
```typescript
const text = `
  Our authentication system uses JWT tokens for security.
  The authorization layer checks user permissions and roles.
`

const concepts = await brain.extractConcepts(text, {
  confidence: 0.7,
  limit: 10
})
console.log(concepts)
// ['authentication', 'security', 'authorization', 'permissions']
```

## How It Works

### 1. Pattern-Based Candidate Detection

First, NeuralEntityExtractor scans text for potential entities using:
- Capitalized words and phrases
- Technical patterns (camelCase, PascalCase, UPPER_CASE)
- Quoted strings
- Common entity patterns

### 2. Embedding Generation

Each candidate is converted to a semantic embedding vector:
```typescript
const candidateVector = await brain.getEmbedding("UserService")
// [0.234, -0.123, 0.567, ...] (1536 dimensions)
```

### 3. NounType Classification

The embedding is compared against pre-computed embeddings for each NounType using cosine similarity:
```typescript
const serviceVector = typeEmbeddings.get(NounType.Service)
const similarity = cosineSimilarity(candidateVector, serviceVector)
// similarity = 0.87 (87% match)
```

### 4. Context-Based Boosting

Confidence is adjusted based on surrounding context:
```typescript
// "The UserService API" gets boosted for Service type
// "CEO of Company" gets boosted for Person type
// "located in Paris" gets boosted for Location type
```

### 5. Deduplication

Similar or overlapping entities are merged to avoid duplicates.

## VFS Integration

VFS automatically uses neural extraction when writing files:

```typescript
const vfs = brain.vfs()
await vfs.init()

// Automatic concept extraction (if enabled)
await vfs.writeFile('/docs/api.md', `
  # User Authentication API

  The UserService provides secure authentication using JWT tokens.
  Integrates with the Database for user storage.
`, {
  intelligence: {
    autoConcepts: true  // Enable concept extraction (default)
  }
})

// Concepts automatically extracted and indexed:
// ['authentication', 'security', 'database', 'user']

// Now searchable by concept
const authFiles = await vfs.readdir('/by-concept/authentication')
// Includes /docs/api.md
```

## Performance

- **Candidate extraction**: O(n) where n = text length
- **Embedding generation**: ~10-50ms per candidate (cached)
- **Type classification**: O(t) where t = number of types to check
- **Total time**: Typically 100-500ms for a document

**Caching:**
- Embeddings are cached (UnifiedCache, 2GB default)
- TypeEmbeddings precomputed once at initialization
- Results cached for identical text

## Configuration

### VFS Auto-Concept Extraction

```typescript
const vfs = brain.vfs()
await vfs.init({
  intelligence: {
    enabled: true,           // Enable AI features (default: true)
    autoConcepts: true,      // Auto-extract concepts (default: true)
    autoExtract: true,       // Auto-extract entities (default: true)
  }
})
```

### Custom Confidence Thresholds

```typescript
// Strict extraction (fewer, higher confidence)
const strict = await brain.extract(text, { confidence: 0.9 })

// Permissive extraction (more entities, lower confidence)
const permissive = await brain.extract(text, { confidence: 0.5 })
```

### Type-Specific Extraction

```typescript
// Extract only people and organizations
const entities = await brain.extract(text, {
  types: [NounType.Person, NounType.Organization]
})

// Extract only technical entities
const technical = await brain.extract(text, {
  types: [
    NounType.API,
    NounType.Service,
    NounType.Component,
    NounType.Function
  ]
})
```

## Examples

### Example 1: Technical Documentation

```typescript
const technicalDoc = `
  The PaymentService API integrates with Stripe for processing transactions.
  The OrderManager component coordinates between UserService and InventoryService.
`

const entities = await brain.extract(technicalDoc, {
  types: [NounType.Service, NounType.API, NounType.Component]
})

console.log(entities)
// [
//   { text: 'PaymentService', type: 'Service', confidence: 0.89 },
//   { text: 'API', type: 'API', confidence: 0.93 },
//   { text: 'Stripe', type: 'Service', confidence: 0.76 },
//   { text: 'OrderManager', type: 'Component', confidence: 0.84 },
//   { text: 'UserService', type: 'Service', confidence: 0.91 },
//   { text: 'InventoryService', type: 'Service', confidence: 0.88 }
// ]
```

### Example 2: Creative Writing

```typescript
const story = `
  Detective Sarah Chen arrived at the scene. The abandoned warehouse
  held secrets about the mysterious organization known as Shadow Corp.
`

const entities = await brain.extract(story, {
  types: [NounType.Person, NounType.Location, NounType.Organization]
})

console.log(entities)
// [
//   { text: 'Detective Sarah Chen', type: 'Person', confidence: 0.94 },
//   { text: 'warehouse', type: 'Location', confidence: 0.71 },
//   { text: 'Shadow Corp', type: 'Organization', confidence: 0.82 }
// ]
```

### Example 3: Business Documents

```typescript
const businessDoc = `
  Q3 revenue exceeded targets by 15%. The marketing team's new campaign
  generated 50,000 leads. Customer satisfaction remains our top KPI.
`

const concepts = await brain.extractConcepts(businessDoc, {
  confidence: 0.65
})

console.log(concepts)
// ['revenue', 'marketing', 'campaign', 'leads', 'customer', 'satisfaction']

const entities = await brain.extract(businessDoc, {
  types: [NounType.KPI, NounType.Process, NounType.Customer]
})
// [
//   { text: 'revenue', type: 'KPI', confidence: 0.81 },
//   { text: 'Customer satisfaction', type: 'KPI', confidence: 0.87 }
// ]
```

## Advanced Usage

### With Vector Embeddings

```typescript
const entities = await brain.extract(text, {
  includeVectors: true
})

// Use embeddings for custom similarity search
for (const entity of entities) {
  const similar = await brain.similar(entity.vector, { limit: 5 })
  console.log(`Similar to ${entity.text}:`, similar)
}
```

### Custom Entity Processing

```typescript
const entities = await brain.extract(text)

// Group by type
const byType = entities.reduce((acc, entity) => {
  if (!acc[entity.type]) acc[entity.type] = []
  acc[entity.type].push(entity)
  return acc
}, {})

console.log('Services:', byType[NounType.Service])
console.log('APIs:', byType[NounType.API])
console.log('Concepts:', byType[NounType.Concept])
```

### Batch Processing

```typescript
const documents = [doc1, doc2, doc3, /* ... */]

// Extract concepts from all documents
const allConcepts = await Promise.all(
  documents.map(doc => brain.extractConcepts(doc))
)

// Combine and deduplicate
const uniqueConcepts = [...new Set(allConcepts.flat())]
console.log('All concepts:', uniqueConcepts)
```

## Zero-Config Design

Neural extraction works out-of-the-box:
- ✅ No configuration required
- ✅ No training needed
- ✅ No API keys needed
- ✅ Works with all storage adapters
- ✅ Automatic caching and optimization
- ✅ Sensible defaults for all parameters

## See Also

- [VFS Core Documentation](./VFS_CORE.md) - Complete filesystem API
- [Semantic VFS](./SEMANTIC_VFS.md) - Multi-dimensional file access
- [Triple Intelligence™](../architecture/triple-intelligence.md) - Underlying architecture
- [NounType Taxonomy](../architecture/noun-verb-taxonomy.md) - Complete type reference