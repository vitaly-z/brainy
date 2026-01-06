# 🎯 The Complete Import Flow Guide

> **What happens when you import data into Brainy?**
> Follow the journey of a single Excel row as it transforms into intelligent, queryable knowledge.

---

## 📋 Table of Contents

1. [The Big Picture](#the-big-picture)
2. [The Journey Begins: Your Data](#the-journey-begins-your-data)
3. [Phase 1: Entry Point](#phase-1-entry-point)
4. [Phase 2: Orchestration](#phase-2-orchestration)
5. [Phase 3: Neural Extraction](#phase-3-neural-extraction-the-magic)
6. [Phase 4: VFS Structure](#phase-4-vfs-structure-creation)
7. [Phase 5: Knowledge Graph](#phase-5-knowledge-graph-creation)
8. [Phase 6: Persistence](#phase-6-persistence-and-finalization)
9. [What Gets Created](#what-gets-created-in-brainy)
10. [Performance & Scale](#performance--scale)

---

## The Big Picture

When you call `brain.import()`, your data goes through a **6-phase transformation pipeline**:

```
Excel File → Format Detection → Neural Extraction → VFS Structure → Knowledge Graph → Persistence
```

Each phase adds intelligence and structure to your raw data, transforming it into a queryable knowledge graph with:
- ✅ **Intelligent entity classification** (Person, Product, Concept, etc.)
- ✅ **Smart relationship inference** (CreatedBy, LocatedAt, PartOf, etc.)
- ✅ **Dual storage** (human-readable VFS + high-performance graph)
- ✅ **Vector embeddings** for semantic search
- ✅ **Automatic deduplication** across imports

**Processing Time**: ~600ms for 10 entities, ~1.8s for 100 entities (with all features enabled)

---

## 🌊 Always-On Streaming Architecture (v4.2.0+)

All imports use streaming with **progressive flush intervals**:

### How It Works
- Periodic index flushes during import (automatic)
- Data queryable progressively as import proceeds
- Progressive intervals adjust as import grows
- Works for known and unknown totals
- Minimal overhead (~0.3%)

### Progressive Flush Intervals

| Current Count | Flush Interval | Reason |
|---------------|----------------|--------|
| 0-999 entities | Every 100 | Frequent early updates for UX |
| 1K-9.9K | Every 1000 | Balanced performance |
| 10K+ | Every 5000 | Minimal overhead |

**Key Difference**: Intervals adjust based on **current** entity count (not total), so it works for streaming APIs where total is unknown.

**Example Usage:**
```typescript
await brain.import(file, {
  onProgress: async (progress) => {
    // Query data as it's imported
    if (progress.queryable) {
      const products = await brain.find({ type: 'product', limit: 10000 })
      console.log(`${products.length} products imported so far...`)
    }
  }
})
```

**Full details**: See [Streaming Imports Guide](./streaming-imports.md)

---

## The Journey Begins: Your Data

Let's follow a **single Excel row** through the entire pipeline.

**Input File**: `glossary.xlsx`

| Term          | Definition                                    | Type        | Related Terms      |
|---------------|-----------------------------------------------|-------------|--------------------|
| Mona Lisa     | Famous painting created by Leonardo da Vinci | Product     | Leonardo, Louvre   |

**Our Goal**: Transform this into:
1. A `Product` entity with semantic embedding
2. `CreatedBy` relationship to Leonardo da Vinci
3. `RelatedTo` relationships to Leonardo and Louvre
4. Organized VFS structure
5. Queryable knowledge graph

Let's watch it happen! 🚀

---

## Phase 1: Entry Point

**Location**: `src/brainy.ts:1952`

### What You Write

```typescript
const result = await brain.import(excelBuffer, {
  format: 'excel',
  vfsPath: '/imports/glossary',
  enableNeuralExtraction: true,
  enableRelationshipInference: true,
  createEntities: true,
  createRelationships: true
})
```

### What Happens

```typescript
// 1. Lazy load ImportCoordinator (not loaded until first import!)
const { ImportCoordinator } = await import('./import/ImportCoordinator.js')

// 2. Create coordinator and initialize all 7 Smart importers
const coordinator = new ImportCoordinator(this)
await coordinator.init()  // Loads: Excel, PDF, CSV, JSON, Markdown, YAML, DOCX importers

// 3. Delegate to coordinator
return await coordinator.import(source, options)
```

**Why Lazy Load?** If you never import files, the entire import subsystem stays unloaded, saving ~2MB of memory and ~100ms startup time.

**Progress Callback**: First event fires!
```typescript
{ stage: 'detecting', message: 'Detecting format...' }
```

---

## Phase 2: Orchestration

**Location**: `src/import/ImportCoordinator.ts:273`

The ImportCoordinator is the **traffic controller** for all imports. It handles:
- Format detection
- Routing to the right importer
- VFS structure generation
- Knowledge graph creation
- Progress tracking

### Step 2.1: Source Normalization

```typescript
const normalizedSource = await this.normalizeSource(source, options.format)
```

**Output**:
```typescript
{
  type: 'buffer',
  data: Buffer<89 50 4e 47 0d 0a 1a 0a...>,  // Raw Excel bytes
  filename: undefined
}
```

The normalizer handles **5 source types**:
- `Buffer` → Direct binary data
- `string` → Could be URL, file path, or content
- `object` → JSON data
- `path` → File system path (reads file)
- `url` → HTTP(S) URL (fetches content)

### Step 2.2: Format Detection

```typescript
const detection = this.detectFormat(normalizedSource)
```

**How Detection Works**:
1. Checks magic bytes: `50 4b 03 04` = ZIP (Excel is ZIP-based)
2. Inspects file structure
3. Falls back to content analysis

**Output**:
```typescript
{
  format: 'excel',
  confidence: 1.0,
  evidence: ['Explicitly specified', 'Magic bytes: ZIP container', 'Contains xl/workbook.xml']
}
```

### Step 2.3: Route to Smart Importer

```typescript
const extractionResult = await this.extract(normalizedSource, 'excel', options)
```

This calls `SmartExcelImporter.extract()` - where the **real magic happens**! ✨

---

## Phase 3: Neural Extraction (The Magic!)

**Location**: `src/importers/SmartExcelImporter.ts:154`

This is where your raw data becomes **intelligent knowledge**. Let's trace our "Mona Lisa" row through each step.

### Step 3.1: Parse Excel File

```typescript
const processedData = await this.excelHandler.process(buffer, options)
```

**Input**: Binary Excel file
**Output**: Array of row objects

```typescript
const rows = [
  {
    'Term': 'Mona Lisa',
    'Definition': 'Famous painting created by Leonardo da Vinci',
    'Type': 'Product',
    'Related Terms': 'Leonardo, Louvre'
  }
  // ... more rows
]
```

### Step 3.2: Detect Column Structure

```typescript
const columns = this.detectColumns(rows[0], opts)
```

The importer is **smart about column names**. It matches patterns:

| Column Header  | Matches Pattern                      | Maps To          |
|----------------|--------------------------------------|------------------|
| `Term`         | `term\|name\|title\|concept\|entity` | `columns.term`   |
| `Definition`   | `definition\|description\|desc`      | `columns.definition` |
| `Type`         | `type\|category\|kind\|class`        | `columns.type`   |
| `Related Terms`| `related\|see also\|links`           | `columns.related`|

**Output**:
```typescript
{
  term: 'Term',
  definition: 'Definition',
  type: 'Type',
  related: 'Related Terms'
}
```

### Step 3.3: Batched Parallel Processing

**The Bottleneck**: Processing 1000 rows sequentially would take ~200 seconds.

**The Solution**: Process 10 rows at a time in parallel!

```typescript
const CHUNK_SIZE = 10  // Process 10 rows simultaneously

for (let chunkStart = 0; chunkStart < rows.length; chunkStart += CHUNK_SIZE) {
  const chunk = rows.slice(chunkStart, chunkStart + CHUNK_SIZE)

  // Process entire chunk in parallel
  const chunkResults = await Promise.all(
    chunk.map(row => this.processRow(row))
  )
}
```

**Performance Improvement**: 1000 rows now takes ~20-50 seconds instead of ~200 seconds!

Let's zoom into processing our "Mona Lisa" row...

---

### 🔍 Processing "Mona Lisa" Row

#### Step 3.3a: Extract Row Data

```typescript
const term = 'Mona Lisa'
const definition = 'Famous painting created by Leonardo da Vinci'
const type = 'Product'
const relatedTerms = 'Leonardo, Louvre'
```

#### Step 3.3b: Parallel Neural Extraction

Here's where it gets **really cool**. Two expensive operations run **simultaneously**:

```typescript
const [relatedEntities, concepts] = await Promise.all([
  // 1. Neural Entity Extraction (finds entities in the definition)
  this.extractor.extract(definition, {
    confidence: 0.48,
    neuralMatching: true,
    cache: { enabled: true }
  }),

  // 2. Concept Extraction (extracts key concepts/tags)
  this.brain.extractConcepts(definition, { limit: 10 })
])
```

##### 🧠 Neural Entity Extraction Deep Dive

**Input**: `"Famous painting created by Leonardo da Vinci"`
**System**: `SmartExtractor` (entity type classifier)

The SmartExtractor runs **4 signals in parallel**:

```
┌─────────────────────────────────────────────────┐
│          SmartExtractor Ensemble                │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. ExactMatchSignal (40%)                     │
│     → Searches 334 noun keywords                │
│     → Finds "painting" → Product                │
│     → Confidence: 0.90                          │
│                                                 │
│  2. EmbeddingSignal (35%)                      │
│     → Embeds: "Leonardo da Vinci"               │
│     → Compares to 31 type embeddings            │
│     → Closest: Person (similarity: 0.92)        │
│     → Confidence: 0.92                          │
│                                                 │
│  3. PatternSignal (20%)                        │
│     → Tests regex patterns                      │
│     → Matches: /^[A-Z][a-z]+ [A-Z][a-z]+$/     │
│     → Suggests: Person                          │
│     → Confidence: 0.85                          │
│                                                 │
│  4. ContextSignal (5%)                         │
│     → Checks format hints                       │
│     → No prior context yet                      │
│     → Confidence: 0.00                          │
│                                                 │
│  Ensemble Vote:                                 │
│  → Person: 0.92×0.35 + 0.85×0.20 = 0.49        │
│  → Product: 0.90×0.40 = 0.36                   │
│  → Agreement boost: +0.05 (2 signals agree)     │
│                                                 │
│  Winner: Person (0.54 confidence)               │
└─────────────────────────────────────────────────┘
```

**Output**:
```typescript
relatedEntities = [
  {
    text: 'Leonardo da Vinci',
    type: NounType.Person,
    confidence: 0.92,
    position: { start: 31, end: 48 }
  },
  {
    text: 'painting',
    type: NounType.Product,
    confidence: 0.85,
    position: { start: 7, end: 15 }
  }
]

concepts = ['art', 'renaissance', 'painting', 'leonardo', 'italian', 'masterpiece']
```

**Cache Hit Rate**: ~60% on subsequent rows with similar definitions!

#### Step 3.3c: Determine Main Entity Type

We have two sources of type information:
1. **Explicit type column**: `"Product"`
2. **Inferred from extraction**: `NounType.Person`

**Priority**: Explicit type column wins!

```typescript
const mainEntityType = type
  ? this.mapTypeString('Product')  // NounType.Product
  : (relatedEntities[0].type)      // Fallback to first extracted entity

// Result: NounType.Product
```

**Type Mapping**:
```typescript
const mapping = {
  'product': NounType.Product,
  'person': NounType.Person,
  'place': NounType.Location,
  'organization': NounType.Organization,
  'concept': NounType.Concept,
  'event': NounType.Event,
  // ... 31 total types
}
```

#### Step 3.3d: Generate Entity ID

```typescript
const entityId = this.generateEntityId('Mona Lisa')

// Algorithm:
// 1. Normalize: 'Mona Lisa' → 'mona_lisa'
// 2. Add prefix: 'ent_'
// 3. Add timestamp: Date.now()
// Result: 'ent_mona_lisa_1730000000000'
```

**Why timestamps?** Ensures globally unique IDs even with identical names.

#### Step 3.3e: Create Main Entity Object

```typescript
const mainEntity = {
  id: 'ent_mona_lisa_1730000000000',
  name: 'Mona Lisa',
  type: NounType.Product,
  description: 'Famous painting created by Leonardo da Vinci',
  confidence: 0.95,  // High confidence from explicit type
  metadata: {
    source: 'excel',
    row: 3,
    originalData: {
      Term: 'Mona Lisa',
      Definition: 'Famous painting created by Leonardo da Vinci',
      Type: 'Product',
      'Related Terms': 'Leonardo, Louvre'
    },
    concepts: ['art', 'renaissance', 'painting', 'leonardo', 'italian', 'masterpiece'],
    extractedAt: 1730000000000
  }
}
```

#### Step 3.3f: Smart Relationship Inference ✨

**The Old Way** (before SmartRelationshipExtractor):
```typescript
// 😢 Everything was just "RelatedTo"
relationships.push({
  from: 'Mona Lisa',
  to: 'Leonardo da Vinci',
  type: VerbType.RelatedTo,  // Generic!
  confidence: 0.8
})
```

**The New Way** (with SmartRelationshipExtractor):

For each entity found in the definition:

```typescript
const verbType = await this.inferRelationship(
  'Mona Lisa',              // subject
  'Leonardo da Vinci',      // object
  definition,               // full context
  NounType.Product,         // subject type hint
  NounType.Person           // object type hint
)
```

##### 🎯 SmartRelationshipExtractor in Action

**Location**: `src/neural/SmartRelationshipExtractor.ts:100`

The SmartRelationshipExtractor runs **3 signals in parallel**:

```
┌──────────────────────────────────────────────────────────┐
│       SmartRelationshipExtractor Ensemble                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Input Context:                                          │
│  "Famous painting created by Leonardo da Vinci"          │
│                                                          │
│  1. VerbEmbeddingSignal (55%)                           │
│     → Embeds context: [0.23, -0.45, 0.78, ...]          │
│     → Compares to 40 verb embeddings                     │
│     → Closest match: CreatedBy (similarity: 0.89)        │
│     → Confidence: 0.89                                   │
│                                                          │
│  2. VerbPatternSignal (30%)                             │
│     → Tests 48+ regex patterns                           │
│     → Matches: /\bcreated?\s+by\b/i                     │
│     → Maps to: VerbType.CreatedBy                        │
│     → Confidence: 0.90                                   │
│                                                          │
│  3. VerbContextSignal (15%)                             │
│     → Type pair: (Product, Person)                       │
│     → Hint suggests: CreatedBy                           │
│     → Confidence: 0.80                                   │
│                                                          │
│  Ensemble Vote:                                          │
│  CreatedBy: 0.89×0.55 + 0.90×0.30 + 0.80×0.15           │
│           = 0.49 + 0.27 + 0.12                          │
│           = 0.88                                         │
│                                                          │
│  Agreement Boost:                                        │
│  → 3 signals agree on CreatedBy!                         │
│  → Boost: +0.05 × (3-1) = +0.10                         │
│  → Final: 0.88 + 0.10 = 0.98                            │
│                                                          │
│  Winner: CreatedBy (0.98 confidence) 🎯                 │
└──────────────────────────────────────────────────────────┘
```

**Result**:
```typescript
relationships.push({
  from: 'ent_mona_lisa_1730000000000',
  to: 'Leonardo da Vinci',  // Will be resolved to entity ID later
  type: VerbType.CreatedBy,  // 🎉 Intelligent classification!
  confidence: 0.92,
  evidence: 'Extracted from: "Famous painting created by Leonardo da Vinci..."'
})
```

**Also processes "Related Terms" column**:
```typescript
const terms = 'Leonardo, Louvre'.split(',')
for (const relTerm of terms.map(t => t.trim())) {
  relationships.push({
    from: 'ent_mona_lisa_1730000000000',
    to: relTerm,
    type: VerbType.RelatedTo,  // Explicit relationships from column
    confidence: 0.9,
    evidence: 'Explicitly listed in "Related Terms" column'
  })
}
```

#### Step 3.3g: Progress Tracking

Every chunk completion triggers progress:

```typescript
opts.onProgress({
  processed: 3,
  total: 10,
  entities: 6,          // 3 main + 3 related
  relationships: 5,
  throughput: 15.2,     // rows per second
  eta: 458,             // milliseconds remaining
  phase: 'extracting'
})
```

**Progress Bar Example**:
```
Extracting entities from excel (15.2 rows/sec, ETA: 0s)... [████████░░] 30%
```

---

### Step 3.4: Final Extraction Result

After processing all rows, SmartExcelImporter returns:

```typescript
{
  rowsProcessed: 3,
  entitiesExtracted: 9,        // 3 main + 6 related
  relationshipsInferred: 8,
  rows: [
    {
      entity: {
        id: 'ent_neural_net_1730000000001',
        name: 'Neural Net',
        type: NounType.Concept,
        description: 'Machine learning model inspired by the brain',
        confidence: 0.95,
        metadata: { ... }
      },
      relatedEntities: [
        { name: 'machine learning', type: NounType.Concept, confidence: 0.88 },
        { name: 'brain', type: NounType.Thing, confidence: 0.82 }
      ],
      relationships: [
        { from: 'ent_neural_net_...', to: 'AI', type: VerbType.RelatedTo, confidence: 0.9 },
        { from: 'ent_neural_net_...', to: 'Deep Learning', type: VerbType.RelatedTo, confidence: 0.9 }
      ],
      concepts: ['ml', 'ai', 'neural', 'learning', 'computation']
    },
    {
      entity: {
        id: 'ent_leonardo_1730000000002',
        name: 'Leonardo',
        type: NounType.Person,
        description: 'Renaissance artist who painted Mona Lisa',
        confidence: 0.95,
        metadata: { ... }
      },
      relatedEntities: [
        { name: 'Mona Lisa', type: NounType.Product, confidence: 0.90 },
        { name: 'Renaissance', type: NounType.Event, confidence: 0.85 }
      ],
      relationships: [
        { from: 'ent_leonardo_...', to: 'Mona Lisa', type: VerbType.Creates, confidence: 0.91 },
        { from: 'ent_leonardo_...', to: 'Art', type: VerbType.RelatedTo, confidence: 0.9 }
      ],
      concepts: ['art', 'renaissance', 'painter', 'artist', 'italian']
    },
    {
      entity: {
        id: 'ent_mona_lisa_1730000000000',
        name: 'Mona Lisa',
        type: NounType.Product,
        description: 'Famous painting created by Leonardo da Vinci',
        confidence: 0.95,
        metadata: { ... }
      },
      relatedEntities: [
        { name: 'Leonardo da Vinci', type: NounType.Person, confidence: 0.92 },
        { name: 'painting', type: NounType.Product, confidence: 0.85 }
      ],
      relationships: [
        { from: 'ent_mona_lisa_...', to: 'Leonardo da Vinci', type: VerbType.CreatedBy, confidence: 0.92 },
        { from: 'ent_mona_lisa_...', to: 'Leonardo', type: VerbType.RelatedTo, confidence: 0.9 },
        { from: 'ent_mona_lisa_...', to: 'Louvre', type: VerbType.RelatedTo, confidence: 0.9 }
      ],
      concepts: ['art', 'renaissance', 'painting', 'leonardo', 'italian', 'masterpiece']
    }
  ],
  entityMap: Map {
    'neural net' => 'ent_neural_net_1730000000001',
    'leonardo' => 'ent_leonardo_1730000000002',
    'mona lisa' => 'ent_mona_lisa_1730000000000'
  },
  processingTime: 1243,
  stats: {
    byType: {
      'Concept': 1,
      'Person': 1,
      'Product': 1
    },
    byConfidence: {
      high: 3,    // > 0.8
      medium: 0,  // 0.6-0.8
      low: 0      // < 0.6
    }
  }
}
```

**Performance**: 3 rows processed in **1.2 seconds** (with neural extraction + relationship inference)

---

## Phase 4: VFS Structure Creation

**Location**: `src/importers/VFSStructureGenerator.ts:93`

**Progress Callback**:
```typescript
{ stage: 'storing-vfs', message: 'Creating VFS structure...' }
```

The VFS (Virtual File System) provides a **human-readable, organized view** of imported data.

### Step 4.1: Normalize Result

```typescript
const normalizedResult = this.normalizeExtractionResult(extractionResult, 'excel')
```

This converts format-specific results into a common structure that VFSStructureGenerator can process.

### Step 4.2: Generate VFS Hierarchy

```typescript
await this.vfsGenerator.generate(normalizedResult, {
  rootPath: '/imports/glossary',
  groupBy: 'type',                    // Group by NounType
  preserveSource: true,               // Keep original Excel file
  createRelationshipFile: true,       // Create _relationships.json
  createMetadataFile: true            // Create _metadata.json
})
```

**Grouping Strategies**:
- `'type'` → Group by NounType (Person/, Product/, Concept/)
- `'sheet'` → Group by Excel sheet name
- `'flat'` → All entities in root directory
- `'custom'` → Provide custom grouping function

**VFS Structure Created**:

```
/imports/glossary/
├── source.xlsx                              # ← Original file preserved
├── _metadata.json                           # ← Import metadata
├── _relationships.json                      # ← All relationships (human-readable)
├── Concept/                                 # ← NounType.Concept entities
│   └── neural_net.json
├── Person/                                  # ← NounType.Person entities
│   └── leonardo.json
└── Product/                                 # ← NounType.Product entities
    └── mona_lisa.json
```

### Step 4.3: File Contents

**`/imports/glossary/Product/mona_lisa.json`**:
```json
{
  "id": "ent_mona_lisa_1730000000000",
  "name": "Mona Lisa",
  "type": "Product",
  "description": "Famous painting created by Leonardo da Vinci",
  "confidence": 0.95,
  "metadata": {
    "source": "excel",
    "row": 3,
    "originalData": {
      "Term": "Mona Lisa",
      "Definition": "Famous painting created by Leonardo da Vinci",
      "Type": "Product",
      "Related Terms": "Leonardo, Louvre"
    },
    "concepts": ["art", "renaissance", "painting", "leonardo", "italian", "masterpiece"],
    "extractedAt": 1730000000000,
    "vfsPath": "/imports/glossary/Product/mona_lisa.json"
  }
}
```

**`/imports/glossary/_relationships.json`**:
```json
{
  "importId": "import_xyz789",
  "createdAt": 1730000000000,
  "totalRelationships": 8,
  "relationships": [
    {
      "from": "ent_mona_lisa_1730000000000",
      "fromName": "Mona Lisa",
      "to": "ent_leonardo_1730000000002",
      "toName": "Leonardo da Vinci",
      "type": "CreatedBy",
      "confidence": 0.92,
      "evidence": "Extracted from: \"Famous painting created by Leonardo da Vinci...\""
    },
    {
      "from": "ent_mona_lisa_1730000000000",
      "fromName": "Mona Lisa",
      "to": "ent_leonardo_1730000000002",
      "toName": "Leonardo",
      "type": "RelatedTo",
      "confidence": 0.9,
      "evidence": "Explicitly listed in \"Related Terms\" column"
    }
    // ... more relationships
  ]
}
```

**`/imports/glossary/_metadata.json`**:
```json
{
  "importId": "import_xyz789",
  "format": "excel",
  "formatConfidence": 1.0,
  "sourceFilename": "glossary.xlsx",
  "importedAt": 1730000000000,
  "options": {
    "enableNeuralExtraction": true,
    "enableRelationshipInference": true,
    "enableConceptExtraction": true,
    "confidenceThreshold": 0.6
  },
  "stats": {
    "rowsProcessed": 3,
    "entitiesExtracted": 9,
    "relationshipsInferred": 8,
    "processingTime": 1243
  }
}
```

### Step 4.4: VFS Benefits

**Why VFS?**
1. ✅ **Human-readable** - Browse imported data like files
2. ✅ **Organized** - Automatic grouping by type/sheet/custom
3. ✅ **Traceable** - Preserves original source and metadata
4. ✅ **Exportable** - Easy to extract data back out
5. ✅ **Debuggable** - Inspect exactly what was imported

**VFS Operations**:
```typescript
// Read entity file
const entity = await brain.vfs().readJSON('/imports/glossary/Product/mona_lisa.json')

// List all products
const products = await brain.vfs().readdir('/imports/glossary/Product')

// Search VFS
const matches = await brain.vfs().find('/imports/**/*.json', {
  type: 'Product'
})
```

---

## Phase 5: Knowledge Graph Creation

**Location**: `src/import/ImportCoordinator.ts:676`

**Progress Callback**:
```typescript
{ stage: 'storing-graph', message: 'Creating knowledge graph...' }
```

This is where your data becomes **queryable knowledge** with vector embeddings and graph relationships.

### Step 5.1: Smart Deduplication

Before creating entities, check for duplicates:

```typescript
const DEDUPLICATION_AUTO_DISABLE_THRESHOLD = 100

if (enableDeduplication && rows.length <= 100) {
  const mergeResult = await this.deduplicator.createOrMerge(entity, '/imports/glossary', {
    threshold: 0.85  // Cosine similarity threshold
  })
}
```

**How Deduplication Works**:

1. **Embed entity name**: `"Mona Lisa"` → `[0.12, -0.45, 0.78, ...]`
2. **Search similar entities**: `brain.similar(embedding, { limit: 10 })`
3. **Check similarity threshold**: If any result > 0.85, it's a match
4. **Merge or create**:
   - **Match found**: Merge metadata, update VFS path, return existing ID
   - **No match**: Create new entity

**Why Auto-Disable?**
- Deduplication requires O(n²) vector searches
- For 1000 entities: 1000 searches × ~10ms = **10 seconds** of overhead
- Auto-disabled for imports > 100 entities

**Override**:
```typescript
await brain.import(buffer, {
  enableDeduplication: true,  // Force enable even for large imports
  deduplicationThreshold: 0.9  // Higher threshold = stricter matching
})
```

### Step 5.2: Create Entity in Knowledge Graph

For each entity (e.g., "Mona Lisa"):

```typescript
const entityId = await this.brain.add({
  id: 'ent_mona_lisa_1730000000000',
  data: {
    name: 'Mona Lisa',
    type: NounType.Product,
    description: 'Famous painting created by Leonardo da Vinci',
    vfsPath: '/imports/glossary/Product/mona_lisa.json'
  },
  type: NounType.Product,
  metadata: {
    source: 'excel',
    row: 3,
    concepts: ['art', 'renaissance', 'painting', 'leonardo'],
    importedFrom: '/imports/glossary',
    extractedAt: 1730000000000
  }
})
```

**What Happens Inside `brain.add()`**:

**Location**: `src/brainy.ts:342`

#### 5.2a: Generate Embedding

```typescript
const vector = await this.embed('Mona Lisa')
```

**Embedding Service**:
- Uses Candle WASM (local, no API calls, no downloads!)
- Model: `all-MiniLM-L6-v2` embedded in WASM (384 dimensions)
- Performance: ~5-15ms per embedding

**Output**:
```typescript
vector = [
  0.123456, -0.456789, 0.789012, -0.234567, 0.567890, ...
  // ... 384 total dimensions
]
```

**Why Embeddings?**
- Enables **semantic search**: Find similar concepts, not just exact matches
- Powers **neural queries**: "Find paintings like the Mona Lisa"
- Supports **relationship inference**: Similar entities often share relationships

#### 5.2b: Add to HNSW Index

```typescript
await this.index.addItem(
  { id: 'ent_mona_lisa_...', vector },
  NounType.Product  // Type-aware indexing
)
```

**HNSW (Hierarchical Navigable Small World) Index**:

```
           Layer 2 (entry point)
                 [Neural Net]
                     |
           Layer 1   |
              [Leonardo]---[Mona Lisa]
                /    |          |
           Layer 0   |          |
         [AI]--[DL]--+--[Art]--[Louvre]
```

**Benefits**:
- **Fast search**: O(log n) instead of O(n)
- **Approximate nearest neighbors**: 95%+ recall at 10x speed
- **Type-aware**: Can search within a specific NounType

**Structure**:
```typescript
{
  items: Map {
    'ent_mona_lisa_...' => {
      vector: [0.123, -0.456, ...],
      connections: Map {
        0 => Set(['ent_leonardo_...', 'ent_louvre_...']),  // Layer 0 neighbors
        1 => Set(['ent_leonardo_...'])                      // Layer 1 neighbors
      },
      level: 1  // Max layer this node appears in
    }
  },
  entryPoint: 'ent_neural_net_...',  // Top layer entry point
  typeMap: Map {
    NounType.Product => Set(['ent_mona_lisa_...']),
    NounType.Person => Set(['ent_leonardo_...']),
    NounType.Concept => Set(['ent_neural_net_...'])
  }
}
```

#### 5.2c: Save to Storage (Dual Write)

**Vector Storage** (optimized for retrieval):
```typescript
await this.storage.saveNoun({
  id: 'ent_mona_lisa_...',
  vector: [0.123, -0.456, ...],
  connections: Map { /* HNSW connections */ },
  level: 1
})
```

**Metadata Storage** (optimized for filtering):
```typescript
await this.storage.saveNounMetadata('ent_mona_lisa_...', {
  name: 'Mona Lisa',
  type: NounType.Product,
  description: 'Famous painting created by Leonardo da Vinci',
  _data: { name: 'Mona Lisa', type: NounType.Product, ... },
  noun: NounType.Product,
  service: undefined,
  createdAt: 1730000000000,
  vfsPath: '/imports/glossary/Product/mona_lisa.json',
  source: 'excel',
  row: 3,
  concepts: ['art', 'renaissance', 'painting', 'leonardo'],
  importedFrom: '/imports/glossary'
})
```

**Why Separate Storage?**
- Vectors are large (384 × 4 bytes = 1.5KB each)
- Metadata queries don't need vectors
- Faster metadata filtering without loading vectors
- Better compression (metadata is JSON, vectors are binary)

#### 5.2d: Update Metadata Index

```typescript
await this.metadataIndex.addDocument('ent_mona_lisa_...', {
  name: 'Mona Lisa',
  type: 'Product',
  source: 'excel',
  vfsPath: '/imports/glossary/Product/mona_lisa.json'
})
```

**Inverted Index Structure**:
```typescript
{
  documents: Map {
    'ent_mona_lisa_...' => { name: 'Mona Lisa', type: 'Product', source: 'excel', ... }
  },
  invertedIndex: Map {
    'type:Product' => Set(['ent_mona_lisa_...']),
    'source:excel' => Set(['ent_neural_net_...', 'ent_leonardo_...', 'ent_mona_lisa_...']),
    'name:Mona Lisa' => Set(['ent_mona_lisa_...'])
  },
  fieldStats: Map {
    'type' => { cardinality: 3, values: Map { 'Product' => 1, 'Person' => 1, 'Concept' => 1 } },
    'source' => { cardinality: 1, values: Map { 'excel' => 3 } }
  }
}
```

**Benefits**:
- **Fast filtering**: `brain.find({ type: 'Product' })` → O(1) lookup
- **Combined queries**: Filter + vector search in one query
- **Field discovery**: List all available fields for dynamic UIs

---

### Step 5.3: Create Relationships in Graph

For each relationship (e.g., "Mona Lisa" → "Leonardo da Vinci"):

```typescript
await this.brain.relate({
  from: 'ent_mona_lisa_1730000000000',
  to: 'ent_leonardo_1730000000002',
  type: VerbType.CreatedBy,
  weight: 1.0,
  metadata: {
    confidence: 0.92,
    evidence: 'Extracted from: "Famous painting created by Leonardo da Vinci..."',
    importedFrom: '/imports/glossary'
  }
})
```

**What Happens Inside `brain.relate()`**:

**Location**: `src/brainy.ts:744`

#### 5.3a: Verify Entities Exist

```typescript
const fromEntity = await this.get('ent_mona_lisa_...')
const toEntity = await this.get('ent_leonardo_...')

if (!fromEntity || !toEntity) {
  throw new Error('Entity not found')
}
```

#### 5.3b: Check for Duplicates (v3.43.2 Critical Fix)

**The Bug**: Without duplicate checking, re-importing would create:
```
Mona Lisa --CreatedBy--> Leonardo
Mona Lisa --CreatedBy--> Leonardo  // Duplicate!
Mona Lisa --CreatedBy--> Leonardo  // Another duplicate!
```

**The Fix**:
```typescript
const existingVerbs = await this.storage.getVerbsBySource('ent_mona_lisa_...')
const duplicate = existingVerbs.find(v =>
  v.targetId === 'ent_leonardo_...' &&
  v.verb === VerbType.CreatedBy
)

if (duplicate) {
  console.log('[DEBUG] Skipping duplicate relationship')
  return duplicate.id  // Return existing relationship ID
}
```

#### 5.3c: Compute Relationship Vector

```typescript
const relationVector = fromEntity.vector.map((v, i) =>
  (v + toEntity.vector[i]) / 2
)
```

**Why?** The relationship embedding lives "between" the two entities in vector space.

**Example**:
```
Mona Lisa vector:  [0.8, 0.2, 0.5, ...]
Leonardo vector:   [0.6, 0.4, 0.3, ...]
Relation vector:   [0.7, 0.3, 0.4, ...]  ← Average
```

**Use Cases**:
- Find similar relationships
- Cluster relationship types
- Recommend new connections

#### 5.3d: Save to Storage

```typescript
const verb: GraphVerb = {
  id: 'verb_abc123',
  vector: [0.7, 0.3, 0.4, ...],
  sourceId: 'ent_mona_lisa_...',
  targetId: 'ent_leonardo_...',
  source: NounType.Product,
  target: NounType.Person,
  verb: VerbType.CreatedBy,
  type: VerbType.CreatedBy,
  weight: 1.0,
  metadata: { confidence: 0.92, ... }
}

await this.storage.saveVerb(verb)
await this.storage.saveVerbMetadata('verb_abc123', {
  verb: VerbType.CreatedBy,  // ← Critical for count tracking
  weight: 1.0,
  confidence: 0.92,
  evidence: '...',
  createdAt: 1730000000000
})
```

#### 5.3e: Update Graph Adjacency Index

```typescript
await this.graphIndex.addEdge(
  'ent_mona_lisa_...',
  'ent_leonardo_...',
  VerbType.CreatedBy,
  1.0  // weight
)
```

**Graph Adjacency Index Structure**:

```typescript
{
  // Forward edges (source → target)
  forward: Map {
    'ent_mona_lisa_...' => Map {
      'CreatedBy' => Set(['verb_abc123']),
      'RelatedTo' => Set(['verb_def456', 'verb_ghi789'])
    }
  },

  // Reverse edges (target → source)
  reverse: Map {
    'ent_leonardo_...' => Map {
      'CreatedBy' => Set(['verb_abc123']),  // Mona Lisa was CreatedBy Leonardo
      'RelatedTo' => Set(['verb_def456'])
    }
  },

  // Global verb counts
  verbCounts: Map {
    'CreatedBy' => 1,
    'RelatedTo' => 4
  }
}
```

**Benefits**:
- **O(1) relationship lookups**: `getRelations(entityId)` is instant
- **Bidirectional traversal**: Find incoming and outgoing edges
- **Type filtering**: Get only `CreatedBy` relationships
- **Global statistics**: Count relationships by type

**Query Examples**:
```typescript
// What did Mona Lisa create?
const outgoing = await brain.getRelations('ent_mona_lisa_...', { direction: 'outgoing' })

// What created Mona Lisa?
const incoming = await brain.getRelations('ent_mona_lisa_...', { direction: 'incoming' })

// Get only CreatedBy relationships
const createdBy = await brain.getRelations('ent_mona_lisa_...', {
  type: VerbType.CreatedBy
})
```

---

## Phase 6: Persistence and Finalization

**Location**: `src/import/ImportCoordinator.ts:396`

### Step 6.1: Flush Indexes to Disk

**Always-On Streaming with Adaptive Flush Intervals:**

Periodic flushes happen automatically during import:

```typescript
// During entity loop (ImportCoordinator.ts:914-933):
entitiesSinceFlush++

if (entitiesSinceFlush >= flushInterval) {  // Adaptive: 100, 1000, or 5000
  await this.brain.flush()
  entitiesSinceFlush = 0

  // Notify that data is queryable
  await onProgress?.({
    queryable: true,  // ← Indexes are up-to-date!
    stage: 'storing-graph',
    message: `Flushed indexes (${entities.length}/${rows.length} entities)`,
    processed: entities.length,
    total: rows.length,
    entities: entities.length
  })
}
```

**Progress Callback**:
```typescript
{
  stage: 'storing-graph',
  message: 'Flushed indexes (3000/10000 entities, 45ms)',
  processed: 3000,
  total: 10000,
  queryable: true  // ← Data is now queryable!
}
```

**What Gets Flushed**:

1. **Metadata Index** → `metadata-index.json`
   - Inverted index (field → entity mappings)
   - Field statistics
   - EntityIdMapper (UUID ↔ integer mappings)

2. **Graph Adjacency Index** → `graph-adjacency.json`
   - Forward edges (source → targets)
   - Reverse edges (target → sources)
   - Verb counts (relationship statistics)

3. **Storage Counts** → Type statistics
   - Noun counts by type
   - Verb counts by type

**What Doesn't Get Flushed** (Already Persisted):
- ✅ Entity vectors (written immediately on `brain.add()`)
- ✅ Entity metadata (written immediately)
- ✅ Relationship vectors (written immediately on `brain.relate()`)
- ✅ Relationship metadata (written immediately)

**Key Insight**: Flush writes *indexes*, not entities!

**Without Flushing**:
- ❌ Entities exist but queries are slow (full table scans)
- ❌ Index-accelerated queries won't work
- ❌ In-memory indexes lost on crash

**With Periodic Flushing** (streaming mode):
- ✅ Queries are fast (index lookups)
- ✅ Data queryable during import
- ✅ Crash resilient (partial imports survive)

### Step 6.2: Record in Import History

```typescript
await this.history.recordImport(
  'import_xyz789',  // Import ID
  {
    type: 'buffer',
    filename: 'glossary.xlsx',
    format: 'excel'
  },
  result  // Full import result
)
```

**History Storage**: `.brainy/import-history.json`

```json
{
  "imports": [
    {
      "id": "import_xyz789",
      "timestamp": 1730000000000,
      "source": {
        "type": "buffer",
        "filename": "glossary.xlsx",
        "format": "excel"
      },
      "stats": {
        "entitiesExtracted": 9,
        "relationshipsInferred": 8,
        "processingTime": 1843
      },
      "vfsPath": "/imports/glossary"
    }
  ]
}
```

**Use Cases**:
- List all imports: `brain.data().listImports()`
- Reimport with same settings
- Audit trail for compliance
- Rollback imports

### Step 6.3: Return Complete Result

```typescript
return {
  importId: 'import_xyz789',
  format: 'excel',
  formatConfidence: 1.0,

  vfs: {
    rootPath: '/imports/glossary',
    directories: [
      '/imports/glossary/Concept',
      '/imports/glossary/Person',
      '/imports/glossary/Product'
    ],
    files: [
      { path: '/imports/glossary/source.xlsx', type: 'source' },
      { path: '/imports/glossary/_metadata.json', type: 'metadata' },
      { path: '/imports/glossary/_relationships.json', type: 'relationships' },
      { path: '/imports/glossary/Concept/neural_net.json', entityId: 'ent_...', type: 'entity' },
      { path: '/imports/glossary/Person/leonardo.json', entityId: 'ent_...', type: 'entity' },
      { path: '/imports/glossary/Product/mona_lisa.json', entityId: 'ent_...', type: 'entity' }
    ]
  },

  entities: [
    { id: 'ent_neural_net_...', name: 'Neural Net', type: NounType.Concept, vfsPath: '...' },
    { id: 'ent_leonardo_...', name: 'Leonardo', type: NounType.Person, vfsPath: '...' },
    { id: 'ent_mona_lisa_...', name: 'Mona Lisa', type: NounType.Product, vfsPath: '...' }
  ],

  relationships: [
    { id: 'verb_1', from: 'ent_mona_lisa_...', to: 'ent_leonardo_...', type: VerbType.CreatedBy },
    { id: 'verb_2', from: 'ent_mona_lisa_...', to: 'ent_leonardo_...', type: VerbType.RelatedTo },
    { id: 'verb_3', from: 'ent_mona_lisa_...', to: 'ent_louvre_...', type: VerbType.RelatedTo },
    // ... more relationships
  ],

  stats: {
    entitiesExtracted: 9,
    relationshipsInferred: 8,
    vfsFilesCreated: 6,
    graphNodesCreated: 3,
    graphEdgesCreated: 8,
    entitiesMerged: 0,        // Deduplication found 0 duplicates
    entitiesNew: 3,           // Created 3 new entities
    processingTime: 1843      // Total time: 1.8 seconds
  }
}
```

**Progress Callback** (final):
```typescript
{
  stage: 'complete',
  message: 'Import complete',
  entities: 3,
  relationships: 8
}
```

---

## What Gets Created in Brainy

After importing `glossary.xlsx`, here's **everything** that gets created:

### 1. VFS (Virtual File System)

**Location**: In-memory + flushed to `.brainy/.vfs/`

```
/imports/glossary/
├── source.xlsx                              # Original Excel file (preserved)
├── _metadata.json                           # Import metadata
├── _relationships.json                      # All relationships (human-readable)
├── Concept/
│   └── neural_net.json                      # Entity: Neural Net
├── Person/
│   └── leonardo.json                        # Entity: Leonardo
└── Product/
    └── mona_lisa.json                       # Entity: Mona Lisa
```

**Access**:
```typescript
// Read entity
const entity = await brain.vfs().readJSON('/imports/glossary/Product/mona_lisa.json')

// List directory
const files = await brain.vfs().readdir('/imports/glossary/Product')

// Search
const results = await brain.vfs().find('/imports/**/*.json', { type: 'Product' })
```

---

### 2. Storage Layer (File System Adapter)

**Location**: `.brainy/` directory

```
.brainy/
├── nouns/                                   # Entity vectors
│   ├── ent_neural_net_1730000000001.json
│   ├── ent_leonardo_1730000000002.json
│   └── ent_mona_lisa_1730000000000.json
│
├── nouns-metadata/                          # Entity metadata
│   ├── ent_neural_net_1730000000001.json
│   ├── ent_leonardo_1730000000002.json
│   └── ent_mona_lisa_1730000000000.json
│
├── verbs/                                   # Relationship vectors
│   ├── verb_abc123.json                     # Mona Lisa --CreatedBy--> Leonardo
│   ├── verb_def456.json                     # Mona Lisa --RelatedTo--> Leonardo
│   ├── verb_ghi789.json                     # Mona Lisa --RelatedTo--> Louvre
│   └── ...
│
├── verbs-metadata/                          # Relationship metadata
│   ├── verb_abc123.json
│   ├── verb_def456.json
│   └── ...
│
├── index.json                               # HNSW index structure
├── metadata-index.json                      # Inverted index for filtering
├── graph-adjacency.json                     # Graph structure for fast traversal
└── import-history.json                      # Import audit trail
```

---

### 3. Entity Storage Detail

**`nouns/ent_mona_lisa_1730000000000.json`**:
```json
{
  "id": "ent_mona_lisa_1730000000000",
  "vector": [
    0.123456, -0.456789, 0.789012, -0.234567, 0.567890,
    // ... 384 dimensions total
  ],
  "connections": {
    "0": ["ent_leonardo_1730000000002", "ent_louvre_..."],
    "1": ["ent_leonardo_1730000000002"]
  },
  "level": 1
}
```

**`nouns-metadata/ent_mona_lisa_1730000000000.json`**:
```json
{
  "name": "Mona Lisa",
  "type": "Product",
  "description": "Famous painting created by Leonardo da Vinci",
  "_data": {
    "name": "Mona Lisa",
    "type": "Product",
    "description": "Famous painting created by Leonardo da Vinci",
    "vfsPath": "/imports/glossary/Product/mona_lisa.json"
  },
  "noun": "Product",
  "service": null,
  "createdAt": 1730000000000,
  "vfsPath": "/imports/glossary/Product/mona_lisa.json",
  "source": "excel",
  "row": 3,
  "concepts": ["art", "renaissance", "painting", "leonardo", "italian", "masterpiece"],
  "importedFrom": "/imports/glossary",
  "extractedAt": 1730000000000
}
```

---

### 4. Relationship Storage Detail

**`verbs/verb_abc123.json`**:
```json
{
  "id": "verb_abc123",
  "vector": [
    0.723456, -0.256789, 0.489012,
    // ... 384 dimensions (average of source + target vectors)
  ],
  "sourceId": "ent_mona_lisa_1730000000000",
  "targetId": "ent_leonardo_1730000000002",
  "source": "Product",
  "target": "Person",
  "verb": "CreatedBy",
  "type": "CreatedBy",
  "weight": 1.0
}
```

**`verbs-metadata/verb_abc123.json`**:
```json
{
  "verb": "CreatedBy",
  "weight": 1.0,
  "confidence": 0.92,
  "evidence": "Extracted from: \"Famous painting created by Leonardo da Vinci...\"",
  "importedFrom": "/imports/glossary",
  "createdAt": 1730000000000
}
```

---

### 5. HNSW Index Structure

**`index.json`**:
```json
{
  "dimensions": 384,
  "M": 16,
  "efConstruction": 200,
  "entryPoint": "ent_neural_net_1730000000001",
  "items": [
    {
      "id": "ent_mona_lisa_1730000000000",
      "level": 1,
      "connections": {
        "0": ["ent_leonardo_1730000000002", "ent_louvre_..."],
        "1": ["ent_leonardo_1730000000002"]
      }
    },
    {
      "id": "ent_leonardo_1730000000002",
      "level": 1,
      "connections": {
        "0": ["ent_mona_lisa_1730000000000", "ent_neural_net_..."],
        "1": ["ent_neural_net_1730000000001"]
      }
    },
    {
      "id": "ent_neural_net_1730000000001",
      "level": 2,
      "connections": {
        "0": ["ent_leonardo_1730000000002"],
        "1": ["ent_leonardo_1730000000002"],
        "2": []
      }
    }
  ],
  "typeMap": {
    "Product": ["ent_mona_lisa_1730000000000"],
    "Person": ["ent_leonardo_1730000000002"],
    "Concept": ["ent_neural_net_1730000000001"]
  }
}
```

**Visual Representation**:
```
Layer 2:  [Neural Net] ← Entry point
            |
Layer 1:  [Leonardo]---[Mona Lisa]
            |  |          |
Layer 0:  [AI]-+-[DL]    [Louvre]
```

---

### 6. Metadata Index Structure

**`metadata-index.json`**:
```json
{
  "documents": {
    "ent_mona_lisa_1730000000000": {
      "name": "Mona Lisa",
      "type": "Product",
      "source": "excel",
      "vfsPath": "/imports/glossary/Product/mona_lisa.json"
    },
    "ent_leonardo_1730000000002": {
      "name": "Leonardo",
      "type": "Person",
      "source": "excel",
      "vfsPath": "/imports/glossary/Person/leonardo.json"
    },
    "ent_neural_net_1730000000001": {
      "name": "Neural Net",
      "type": "Concept",
      "source": "excel",
      "vfsPath": "/imports/glossary/Concept/neural_net.json"
    }
  },
  "invertedIndex": {
    "type:Product": ["ent_mona_lisa_1730000000000"],
    "type:Person": ["ent_leonardo_1730000000002"],
    "type:Concept": ["ent_neural_net_1730000000001"],
    "source:excel": [
      "ent_neural_net_1730000000001",
      "ent_leonardo_1730000000002",
      "ent_mona_lisa_1730000000000"
    ],
    "name:Mona Lisa": ["ent_mona_lisa_1730000000000"],
    "name:Leonardo": ["ent_leonardo_1730000000002"],
    "name:Neural Net": ["ent_neural_net_1730000000001"]
  },
  "fieldStats": {
    "type": {
      "cardinality": 3,
      "values": {
        "Product": 1,
        "Person": 1,
        "Concept": 1
      }
    },
    "source": {
      "cardinality": 1,
      "values": {
        "excel": 3
      }
    }
  }
}
```

---

### 7. Graph Adjacency Index Structure

**`graph-adjacency.json`**:
```json
{
  "forward": {
    "ent_mona_lisa_1730000000000": {
      "CreatedBy": ["verb_abc123"],
      "RelatedTo": ["verb_def456", "verb_ghi789"]
    },
    "ent_leonardo_1730000000002": {
      "Creates": ["verb_jkl012"],
      "RelatedTo": ["verb_mno345"]
    }
  },
  "reverse": {
    "ent_leonardo_1730000000002": {
      "CreatedBy": ["verb_abc123"],
      "RelatedTo": ["verb_def456"]
    },
    "ent_louvre_...": {
      "RelatedTo": ["verb_ghi789"]
    }
  },
  "verbCounts": {
    "CreatedBy": 1,
    "RelatedTo": 4,
    "Creates": 1
  }
}
```

**Query Examples**:
```typescript
// What relationships does Mona Lisa have?
forward['ent_mona_lisa_...']
// → { CreatedBy: [...], RelatedTo: [...] }

// What created Mona Lisa?
reverse['ent_mona_lisa_...']['CreatedBy']
// → ['verb_abc123'] → Leonardo da Vinci

// How many CreatedBy relationships exist?
verbCounts['CreatedBy']
// → 1
```

---

### 8. Storage by Cloud Provider

Brainy supports multiple storage adapters:

#### File System (Local)
```
.brainy/
├── nouns/
├── nouns-metadata/
├── verbs/
├── verbs-metadata/
└── index.json
```

#### Google Cloud Storage (GCS)
```
gs://my-bucket/brainy/
├── nouns/
│   └── ent_mona_lisa_1730000000000.json
├── nouns-metadata/
│   └── ent_mona_lisa_1730000000000.json
└── ...
```

#### Amazon S3
```
s3://my-bucket/brainy/
├── nouns/
│   └── ent_mona_lisa_1730000000000.json
└── ...
```

#### Cloudflare R2
```
r2://my-bucket/brainy/
├── nouns/
│   └── ent_mona_lisa_1730000000000.json
└── ...
```

**Configuration**:
```typescript
const brain = await Brainy.create({
  storage: {
    type: 'gcs',
    bucket: 'my-bucket',
    prefix: 'brainy/'
  }
})
```

---

## Performance & Scale

### Benchmarks

**Small Import** (10 entities):
- Extraction: ~400ms
- VFS creation: ~50ms
- Graph creation: ~150ms
- **Total**: ~600ms

**Medium Import** (100 entities):
- Extraction: ~1200ms (batched parallel)
- VFS creation: ~200ms
- Graph creation: ~400ms
- **Total**: ~1800ms

**Large Import** (1000 entities):
- Extraction: ~12000ms (batched parallel)
- VFS creation: ~800ms
- Graph creation: ~2000ms
- Deduplication: Auto-disabled (too slow)
- **Total**: ~15 seconds

**Billion-Scale Performance**:
- HNSW Index: O(log n) search (1B entities = ~30 hops)
- Metadata Index: O(1) filtering
- Graph Adjacency: O(1) relationship lookups
- Storage: Unlimited (cloud buckets)

### Optimization Tips

#### 1. Disable Features for Large Imports

```typescript
await brain.import(buffer, {
  enableNeuralExtraction: false,      // Skip entity extraction (10x faster)
  enableRelationshipInference: false, // Skip relationship inference (5x faster)
  enableConceptExtraction: false,     // Skip concept extraction (2x faster)
  enableDeduplication: false          // Skip deduplication (prevents O(n²))
})
```

**Speedup**: 1000 entities in ~2 seconds instead of ~15 seconds!

#### 2. Use Explicit Type Column

```typescript
// ✅ Fast: Uses explicit type, skips neural classification
{ Term: 'Mona Lisa', Type: 'Product', ... }

// ❌ Slow: Runs 4 neural signals to infer type
{ Term: 'Mona Lisa', ... }
```

#### 3. Batch Multiple Imports

```typescript
// ❌ Slow: 10 separate imports
for (const file of files) {
  await brain.import(file)  // Flushes after each import
}

// ✅ Fast: Combine into one import, flush once
const combined = mergeFiles(files)
await brain.import(combined)
```

#### 4. Use Streaming for Huge Files

```typescript
const { createPipeline } = await brain.streaming()

await createPipeline()
  .source(hugeExcelFile)
  .transform(extractEntities)
  .transform(createRelationships)
  .sink(brain.add.bind(brain))
  .run({ chunkSize: 100 })
```

#### 5. Choose Right Grouping Strategy

```typescript
// ✅ Fast: Flat structure (no nested directories)
groupBy: 'flat'

// ❌ Slow: Type-based grouping (creates many directories)
groupBy: 'type'
```

---

## Summary: The Complete Picture

```
┌──────────────────────────────────────────────────────────────┐
│                    brain.import()                            │
└──────────────────────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────────┐
    │  Phase 1: Entry Point (brainy.ts:1952)        │
    │  - Lazy load ImportCoordinator                │
    │  - Initialize 7 Smart importers               │
    └───────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────────┐
    │  Phase 2: Orchestration (ImportCoordinator)   │
    │  - Normalize source (Buffer/URL/path)         │
    │  - Detect format (excel/pdf/csv/json/...)     │
    │  - Route to SmartExcelImporter                │
    └───────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────────┐
    │  Phase 3: Neural Extraction 🧠                │
    │                                               │
    │  SmartExtractor (Entity Types):               │
    │  ├─ ExactMatchSignal (40%)                    │
    │  ├─ EmbeddingSignal (35%)                     │
    │  ├─ PatternSignal (20%)                       │
    │  └─ ContextSignal (5%)                        │
    │                                               │
    │  SmartRelationshipExtractor (Verb Types):     │
    │  ├─ VerbEmbeddingSignal (55%)                 │
    │  ├─ VerbPatternSignal (30%)                   │
    │  └─ VerbContextSignal (15%)                   │
    │                                               │
    │  Result: Intelligent entities + relationships │
    └───────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────────┐
    │  Phase 4: VFS Structure                       │
    │  - Group by type/sheet/flat                   │
    │  - Create directory hierarchy                 │
    │  - Write entity JSON files                    │
    │  - Preserve source file                       │
    └───────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────────┐
    │  Phase 5: Knowledge Graph                     │
    │  - Smart deduplication (optional)             │
    │  - Generate embeddings (384D vectors)         │
    │  - Add to HNSW index                          │
    │  - Save to storage (dual write)               │
    │  - Update metadata index                      │
    │  - Create relationships                       │
    │  - Update graph adjacency index               │
    └───────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────────┐
    │  Phase 6: Persistence                         │
    │  - Flush HNSW index → index.json              │
    │  - Flush metadata index → metadata-index.json │
    │  - Flush graph → graph-adjacency.json         │
    │  - Flush VFS → .vfs/state.json                │
    │  - Record in import history                   │
    └───────────────────────────────────────────────┘
                            ↓
              ┌─────────────────────────────┐
              │   Result: Queryable         │
              │   Knowledge Graph! 🎉       │
              └─────────────────────────────┘
```

**What You Get**:
- ✅ Intelligent entity classification (31 types)
- ✅ Smart relationship inference (40 types)
- ✅ Semantic vector embeddings (384D)
- ✅ Fast O(log n) similarity search
- ✅ O(1) metadata filtering
- ✅ O(1) relationship traversal
- ✅ Human-readable VFS structure
- ✅ Cloud storage support (GCS/S3/R2)
- ✅ Billion-scale performance
- ✅ Zero mocks, production-ready!

---

## Further Reading

- [SmartExtractor Architecture](./smart-extractor.md)
- [SmartRelationshipExtractor Architecture](./smart-relationship-extractor.md)
- [VFS Guide](./vfs-guide.md)
- [Storage Adapters](./storage-adapters.md)
- [Query Optimization](./query-optimization.md)
- [Migration to v4.x](./migrating-to-v4.md)

---

**Questions?** Check the [FAQ](../faq.md) or [open an issue](https://github.com/soulcraft/brainy/issues)! 🚀
