# 🧠 Brainy API Reference

> **Complete API documentation for Brainy**
> Zero Configuration • Triple Intelligence • Git-Style Branching • Entity Versioning • Candle WASM Embeddings

**Updated:** 2026-01-06
**All APIs verified against actual code**

---

## Quick Start

```typescript
import { Brainy, NounType, VerbType } from '@soulcraft/brainy'

const brain = new Brainy() // Zero config!
await brain.init() // VFS auto-initialized!

// Add data (text auto-embeds!)
const id = await brain.add({
 data: 'The future of AI is here',
 type: NounType.Concept,
 metadata: { category: 'technology' }
})

// Search with Triple Intelligence
const results = await brain.find({
 query: 'artificial intelligence',
 where: { year: { greaterThan: 2020 } },
 connected: { from: id, depth: 2 }
})

// Fork for safe experimentation
const experiment = await brain.fork('test-feature')
await experiment.add({ data: 'test', type: NounType.Document })
await experiment.commit({ message: 'Add test data' })

// Entity versioning
await brain.versions.save(id, { tag: 'v1.0', description: 'Initial version' })
await brain.update(id, { category: 'AI' })
await brain.versions.save(id, { tag: 'v2.0' })
```

---

## Core Concepts

### 🧬 Entities (Nouns)
Semantic vectors with metadata and relationships - the fundamental data unit in Brainy.

### 🔗 Relationships (Verbs)
Typed connections between entities - building knowledge graphs.

### 🧠 Triple Intelligence
Vector search + Graph traversal + Metadata filtering in one unified query.

### 🌳 Git-Style Branching
Fork, experiment, and commit - Snowflake-style copy-on-write isolation.

### 📜 Entity Versioning
Time-travel and history tracking for individual entities - Git-like version control with content-addressable storage.

---

## Table of Contents

- [Core CRUD Operations](#core-crud-operations)
- [Search & Query](#search--query)
- [Relationships](#relationships)
- [Batch Operations](#batch-operations)
- [Branch Management](#branch-management)
- [Entity Versioning](#entity-versioning)
- [Virtual Filesystem (VFS)](#virtual-filesystem-vfs)
- [Neural API](#neural-api)
- [Import & Export](#import--export)
- [Configuration](#configuration)
- [Storage Adapters](#storage-adapters)
- [Utility Methods](#utility-methods)
- [Embedding & Analysis APIs](#embedding--analysis-apis)
- [Type System Reference](#type-system-reference)

---

## Core CRUD Operations

### `add(params)` → `Promise<string>`

Add a single entity to the database.

```typescript
const id = await brain.add({
 data: 'JavaScript is a programming language', // Text or pre-computed vector
 type: NounType.Concept, // Required: Entity type
 metadata: { // Optional metadata
 category: 'programming',
 year: 1995
 }
})
```

**Parameters:**
- `data`: `string | number[]` - Text (auto-embeds) or vector
- `type`: `NounType` - Entity type (required)
- `metadata?`: `object` - Additional metadata

**Returns:** `Promise<string>` - Entity ID

---

### `get(id)` → `Promise<Entity | null>`

Retrieve a single entity by ID.

```typescript
const entity = await brain.get(id)
console.log(entity?.data) // Original data
console.log(entity?.metadata) // Metadata
console.log(entity?.vector) // Embedding vector
```

**Parameters:**
- `id`: `string` - Entity ID

**Returns:** `Promise<Entity | null>` - Entity or null if not found

---

### `update(params)` → `Promise<void>`

Update an existing entity.

```typescript
await brain.update({
 id: entityId,
 data: 'Updated content', // Optional: new data
 metadata: { updated: true } // Optional: new metadata (merges)
})
```

**Parameters:**
- `id`: `string` - Entity ID
- `data?`: `string | number[]` - New data/vector
- `metadata?`: `object` - Metadata to merge

**Returns:** `Promise<void>`

---

### `delete(id)` → `Promise<void>`

Delete a single entity.

```typescript
await brain.delete(id)
```

**Parameters:**
- `id`: `string` - Entity ID

**Returns:** `Promise<void>`

---

## Search & Query

### `find(query)` → `Promise<Result[]>`

**Triple Intelligence** - Vector + Graph + Metadata in ONE query.

```typescript
// Simple text search
const results = await brain.find('machine learning')

// Advanced Triple Intelligence query
const results = await brain.find({
 query: 'artificial intelligence', // Vector similarity
 where: { // Metadata filtering
 year: { greaterThan: 2020 },
 category: { oneOf: ['AI', 'ML'] }
 },
 connected: { // Graph traversal
 to: conceptId,
 depth: 2,
 type: VerbType.RelatedTo
 },
 limit: 10
})
```

**Parameters:**
- `query`: `string | FindParams`
 - **Simple:** Just text for vector search
 - **Advanced:** Object with vector + graph + metadata filters

**FindParams:**
- `query?`: `string` - Text for vector similarity
- `where?`: `object` - Metadata filters (see [Query Operators](#query-operators))
- `connected?`: `object` - Graph traversal options
 - `to?`: `string` - Target entity ID
 - `from?`: `string` - Source entity ID
 - `type?`: `VerbType` - Relationship type
 - `depth?`: `number` - Traversal depth
- `limit?`: `number` - Max results (default: 10)
- `offset?`: `number` - Skip results
- `searchMode?`: `'auto' | 'text' | 'semantic' | 'hybrid'` - Search strategy:
 - `'auto'` (default): Zero-config hybrid combining text + semantic search
 - `'text'`: Pure keyword/text matching
 - `'semantic'`: Pure vector similarity
 - `'hybrid'`: Explicit hybrid mode
- `hybridAlpha?`: `number` - Balance between text (0.0) and semantic (1.0) search. Auto-detected by query length if not specified.

**Returns:** `Promise<Result[]>` - Matching entities with scores

---

### Hybrid Search

Brainy automatically combines text (keyword) and semantic (vector) search for optimal results. No configuration needed.

```typescript
// Zero-config hybrid search (just works)
const results = await brain.find({
 query: 'David Smith' // Finds both exact text matches AND semantically similar
})

// Force text-only search (exact keyword matching)
const textResults = await brain.find({
 query: 'exact keyword',
 searchMode: 'text'
})

// Force semantic-only search (vector similarity)
const semanticResults = await brain.find({
 query: 'artificial intelligence concepts',
 searchMode: 'semantic'
})

// Custom hybrid weighting (0 = text only, 1 = semantic only)
const customResults = await brain.find({
 query: 'David Smith',
 hybridAlpha: 0.3 // Favor text matching
})
```

**How it works:**
- Short queries (1-2 words) automatically favor text matching
- Long queries (5+ words) automatically favor semantic search
- Results are combined using Reciprocal Rank Fusion (RRF)

---

### Match Visibility

Search results include detailed match information:

```typescript
const results = await brain.find({ query: 'david the warrior' })

// Each result now includes:
results[0].textMatches // ["david", "warrior"] - exact query words found
results[0].textScore // 0.25 - text match quality (0-1)
results[0].semanticScore // 0.87 - semantic similarity (0-1)
results[0].matchSource // 'both' | 'text' | 'semantic'
```

**Use cases:**
- Highlight exact matches in UI (textMatches)
- Explain why a result ranked high (matchSource)
- Debug search behavior (separate scores)

---

### `highlight(params)` → `Promise<Highlight[]>` ✨

Zero-config highlighting for both exact matches AND semantic concepts.
Handles plain text, rich-text JSON (TipTap, Slate, Lexical, Draft.js, Quill), HTML, and Markdown automatically.

```typescript
// Plain text (works as before)
const highlights = await brain.highlight({
 query: "david the warrior",
 text: "David Smith is a brave fighter who battles dragons"
})
// [
// { text: "David", score: 1.0, position: [0, 5], matchType: 'text' },
// { text: "fighter", score: 0.78, position: [25, 32], matchType: 'semantic' },
// { text: "battles", score: 0.72, position: [37, 44], matchType: 'semantic' }
// ]

// Rich-text JSON (auto-detected)
const highlights = await brain.highlight({
 query: "david the warrior",
 text: JSON.stringify(tiptapDocument) // TipTap, Slate, Lexical, Draft.js, Quill
})
// Extracts text from nodes, annotates with contentCategory:
// [
// { text: "David", score: 1.0, matchType: 'text', contentCategory: 'title' },
// { text: "fighter", score: 0.78, matchType: 'semantic', contentCategory: 'content' }
// ]

// HTML input (auto-detected)
const highlights = await brain.highlight({
 query: "warrior",
 text: "<h1>David the Warrior</h1><p>A brave fighter.</p>"
})

// Custom extractor for proprietary formats
const highlights = await brain.highlight({
 query: "function",
 text: sourceCode,
 contentExtractor: (text) => treeSitterParse(text) // Your custom parser
})
```

**Parameters:**
- `query`: `string` - The search query
- `text`: `string` - Text to highlight (plain text, JSON, HTML, or Markdown)
- `granularity?`: `'word' | 'phrase' | 'sentence'` - Highlight unit (default: 'word')
- `threshold?`: `number` - Min similarity for semantic matches (default: 0.5)
- `contentType?`: `ContentType` - Optional hint: `'plaintext' | 'richtext-json' | 'html' | 'markdown'`. Skips auto-detection when provided.
- `contentExtractor?`: `(text: string) => ExtractedSegment[]` - Custom parser. Bypasses built-in detection entirely.

**Returns:** `Promise<Highlight[]>`
- `text` - The matched text
- `score` - Match score (1.0 for text matches, varies for semantic)
- `position` - [start, end] indices in extracted text
- `matchType` - `'text'` (exact) or `'semantic'` (concept)
- `contentCategory?` - `'title' | 'annotation' | 'content' | 'value' | 'code' | 'structural'` — Role of the source text. Built-in extractors produce `'title'`, `'content'`, `'code'`. All 6 categories are available for custom parsers.

**Supported Rich-Text Formats:**

| Format | Detection | Text nodes |
|--------|-----------|------------|
| TipTap / ProseMirror | `{ type: 'doc', content: [...] }` | `{ type: 'text', text }` |
| Slate.js | `[{ type, children }]` | `{ text }` |
| Lexical | `{ root: { children } }` | `{ type: 'text', text }` |
| Draft.js | `{ blocks: [{ text }] }` | `{ text }` in block |
| Quill Delta | `{ ops: [{ insert }] }` | `{ insert }` |
| HTML | Tags like `<h1>`, `<p>`, `<code>` | Visible text content |
| Markdown | `#` headings, ` ``` ` code blocks | Stripped markup |

**Timeout Protection:**
Semantic matching has a 10-second timeout. If embedding takes too long (e.g., WASM stall), `highlight()` returns text-only matches instead of hanging.

**UI Pattern:**
```typescript
// Style differently based on match type and content category
highlights.forEach(h => {
 const style = h.matchType === 'text' ? 'font-weight: bold' : 'background: yellow'
 if (h.contentCategory === 'title') { /* render as heading highlight */ }
 if (h.contentCategory === 'code') { /* render with code styling */ }
 if (h.contentCategory === 'annotation') { /* render as comment/caption */ }
 // Apply style from h.position[0] to h.position[1]
})
```

---

### Query Operators

Brainy uses clean, readable operators:

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `{age: {equals: 25}}` |
| `greaterThan` | Greater than | `{age: {greaterThan: 18}}` |
| `lessThan` | Less than | `{price: {lessThan: 100}}` |
| `greaterEqual` | Greater or equal | `{score: {greaterEqual: 90}}` |
| `lessEqual` | Less or equal | `{rating: {lessEqual: 3}}` |
| `oneOf` | In array | `{color: {oneOf: ['red', 'blue']}}` |
| `notOneOf` | Not in array | `{status: {notOneOf: ['deleted']}}` |
| `contains` | Contains value | `{tags: {contains: 'ai'}}` |
| `startsWith` | String prefix | `{name: {startsWith: 'John'}}` |
| `endsWith` | String suffix | `{email: {endsWith: '@gmail.com'}}` |
| `matches` | Pattern match | `{text: {matches: /^[A-Z]/}}` |
| `between` | Range | `{year: {between: [2020, 2024]}}` |

---

## Relationships

### `relate(params)` → `Promise<string>`

Create a typed relationship between entities.

```typescript
const relId = await brain.relate({
 from: sourceId,
 to: targetId,
 type: VerbType.RelatedTo,
 metadata: { // Optional
 strength: 0.9,
 confidence: 0.85
 }
})
```

**Parameters:**
- `from`: `string` - Source entity ID
- `to`: `string` - Target entity ID
- `type`: `VerbType` - Relationship type
- `metadata?`: `object` - Optional metadata

**Returns:** `Promise<string>` - Relationship ID

---

### `getRelations(params)` → `Promise<Relation[]>`

Get relationships for an entity.

```typescript
// Get all relationships FROM an entity
const outgoing = await brain.getRelations({ from: entityId })

// Get all relationships TO an entity
const incoming = await brain.getRelations({ to: entityId })

// Filter by type
const related = await brain.getRelations({
 from: entityId,
 type: VerbType.Contains
})
```

**Parameters:**
- `from?`: `string` - Source entity ID
- `to?`: `string` - Target entity ID
- `type?`: `VerbType` - Filter by relationship type

**Returns:** `Promise<Relation[]>` - Matching relationships

---

## Batch Operations

### `addMany(params)` → `Promise<BatchResult<string>>`

Add multiple entities in one operation.

```typescript
const result = await brain.addMany({
 items: [
 { data: 'Entity 1', type: NounType.Document },
 { data: 'Entity 2', type: NounType.Concept }
 ]
})

console.log(result.successful) // Array of IDs
console.log(result.failed) // Array of errors
```

**Returns:** `Promise<BatchResult<string>>` - Success/failure results

---

### `deleteMany(params)` → `Promise<BatchResult<string>>`

Delete multiple entities.

```typescript
const result = await brain.deleteMany({
 ids: [id1, id2, id3]
})
```

---

### `updateMany(params)` → `Promise<BatchResult<string>>`

Update multiple entities.

```typescript
const result = await brain.updateMany({
 updates: [
 { id: id1, metadata: { updated: true } },
 { id: id2, data: 'New content' }
 ]
})
```

---

### `relateMany(params)` → `Promise<string[]>`

Create multiple relationships.

```typescript
const ids = await brain.relateMany({
 relations: [
 { from: id1, to: id2, type: VerbType.RelatedTo },
 { from: id1, to: id3, type: VerbType.Contains }
 ]
})
```

---

## Branch Management

Git-style branching with Snowflake-style copy-on-write.

### `fork(branch?, options?)` → `Promise<Brainy>`

Create an instant fork (<100ms) with full isolation.

```typescript
// Create a fork
const experiment = await brain.fork('test-feature')

// Make changes safely in isolation
await experiment.add({ data: 'Test entity', type: NounType.Document })
await experiment.update({ id: someId, metadata: { modified: true } })

// Parent is unaffected!
const parentData = await brain.find({}) // Original data unchanged
```

**Parameters:**
- `branch?`: `string` - Branch name (auto-generated if omitted)
- `options?`: `object`
 - `description?`: `string` - Branch description

**Returns:** `Promise<Brainy>` - New Brainy instance on forked branch

**How it works:** Snowflake-style COW shares HNSW index, copies only modified nodes (10-20% memory overhead).

---

### `checkout(branch)` → `Promise<void>`

Switch to a different branch.

```typescript
await brain.checkout('main')
await brain.checkout('test-feature')
```

**Parameters:**
- `branch`: `string` - Branch name

---

### `listBranches()` → `Promise<string[]>`

List all branches.

```typescript
const branches = await brain.listBranches()
// ['main', 'test-feature', 'experiment-2']
```

---

### `getCurrentBranch()` → `Promise<string>`

Get current branch name.

```typescript
const current = await brain.getCurrentBranch()
// 'main'
```

---

### `commit(options?)` → `Promise<string>`

Create a commit snapshot.

```typescript
const commitId = await brain.commit({
 message: 'Add new features',
 author: 'dev@example.com',
 metadata: { ticket: 'PROJ-123' }
})
```

**Parameters:**
- `message?`: `string` - Commit message
- `author?`: `string` - Author email
- `metadata?`: `object` - Additional commit metadata

**Returns:** `Promise<string>` - Commit ID

---


### `deleteBranch(branch)` → `Promise<void>`

Delete a branch (cannot delete 'main').

```typescript
await brain.deleteBranch('old-experiment')
```

---

### `getHistory(options?)` → `Promise<Commit[]>`

Get commit history.

```typescript
const history = await brain.getHistory({
 branch: 'main',
 limit: 10
})
```

---

### `asOf(commitId, options?)` → `Promise<Brainy>`

Create a read-only snapshot at a specific commit for time-travel queries.

```typescript
// Get commit ID from history
const commits = await brain.getHistory({ limit: 1 })
const commitId = commits[0].id

// Create snapshot (lazy-loading, no eager data loading)
const snapshot = await brain.asOf(commitId, {
 cacheSize: 10000 // LRU cache size (default: 10000)
})

// Query historical state - full Triple Intelligence works!
const results = await snapshot.find({
 query: 'AI research',
 where: { category: 'technology' }
})

// Get historical relationships
const related = await snapshot.getRelated(entityId, { depth: 2 })

// MUST close when done to free memory
await snapshot.close()
```

**Parameters:**
- `commitId`: `string` - Commit hash to snapshot from
- `options?`: `object`
 - `cacheSize?`: `number` - LRU cache size for lazy-loading (default: 10000)

**Returns:** `Promise<Brainy>` - Read-only Brainy instance with historical state

**Features:**
- **Lazy-Loading** - Loads entities on-demand, not eagerly
- **Bounded Memory** - LRU cache prevents memory bloat
- **Full Query Support** - All find(), getRelated(), etc. work on historical data
- **Read-Only** - Prevents accidental modifications to history

**Important:** Always call `snapshot.close()` when done to release resources.

---

## Entity Versioning

Git-style versioning for individual entities with content-addressable storage.

### Overview

Entity Versioning provides time-travel and history tracking for individual entities:

- **Content-Addressable Storage** - Deduplication via SHA-256 hashing
- **Zero-Config** - Lazy initialization, uses existing indexes
- **Branch-Isolated** - Versions isolated per branch
- **Selective Auto-Versioning** - Optional augmentation for automatic version creation
- **Production-Scale** - Designed for billions of entities
- **VFS File Support** - Full versioning for VFS files with actual blob content

---

### `versions.save(entityId, options?)` → `Promise<EntityVersion>`

Save a new version of an entity.

```typescript
// Save version with tag
const version = await brain.versions.save('user-123', {
 tag: 'v1.0',
 description: 'Initial user profile',
 metadata: { author: 'dev@example.com' }
})

console.log(version.version) // 1
console.log(version.contentHash) // SHA-256 hash
console.log(version.createdAt) // Timestamp
```

**Parameters:**
- `entityId`: `string` - Entity ID to version
- `options?`: `object`
 - `tag?`: `string` - Version tag (e.g., 'v1.0', 'beta')
 - `description?`: `string` - Version description
 - `metadata?`: `object` - Additional version metadata

**Returns:** `Promise<EntityVersion>` - Created version

**Features:**
- Automatic deduplication (identical content = same version)
- Sequential version numbering (1, 2, 3, ...)
- Content-addressable storage (SHA-256)

---

### `versions.list(entityId, options?)` → `Promise<EntityVersion[]>`

List all versions of an entity.

```typescript
const versions = await brain.versions.list('user-123', {
 limit: 10,
 offset: 0
})

versions.forEach(v => {
 console.log(`Version ${v.version}: ${v.tag} - ${v.description}`)
})
```

**Parameters:**
- `entityId`: `string` - Entity ID
- `options?`: `object`
 - `limit?`: `number` - Max versions to return
 - `offset?`: `number` - Skip versions

**Returns:** `Promise<EntityVersion[]>` - Versions (newest first)

---

### `versions.restore(entityId, versionOrTag)` → `Promise<void>`

Restore entity to a previous version.

```typescript
// Restore by version number
await brain.versions.restore('user-123', 1)

// Restore by tag
await brain.versions.restore('user-123', 'beta')
```

**Parameters:**
- `entityId`: `string` - Entity ID
- `versionOrTag`: `number | string` - Version number or tag

---

### `versions.compare(entityId, version1, version2)` → `Promise<VersionDiff>`

Compare two versions.

```typescript
const diff = await brain.versions.compare('user-123', 1, 2)

console.log(diff.totalChanges) // Total changes
console.log(diff.modified) // Modified fields
console.log(diff.added) // Added fields
console.log(diff.removed) // Removed fields

// Check specific changes
const nameChange = diff.modified.find(c => c.path === 'metadata.name')
console.log(`${nameChange.oldValue} → ${nameChange.newValue}`)
```

**Returns:** `Promise<VersionDiff>` - Detailed diff with field-level changes

---

### `versions.getContent(entityId, versionOrTag)` → `Promise<EntitySnapshot>`

Get version content without restoring.

```typescript
// View old version without changing current state
const v1Content = await brain.versions.getContent('user-123', 1)
console.log(v1Content.metadata.name) // Old name

// Current state unchanged
const current = await brain.get('user-123')
console.log(current.metadata.name) // Current name
```

---

### `versions.undo(entityId)` → `Promise<void>`

Undo to previous version (shorthand for restore to latest-1).

```typescript
// Make a bad change
await brain.update('user-123', { status: 'deleted' })

// Undo immediately
await brain.versions.undo('user-123')
```

**Alias:** `versions.revert(entityId)`

---

### `versions.prune(entityId, options)` → `Promise<PruneResult>`

Clean up old versions.

```typescript
const result = await brain.versions.prune('user-123', {
 keepRecent: 10, // Keep 10 most recent
 keepTagged: true, // Always keep tagged versions
 olderThan: Date.now() - 30 * 24 * 60 * 60 * 1000 // Older than 30 days
})

console.log(`Deleted ${result.deleted}, kept ${result.kept}`)
```

**Parameters:**
- `keepRecent?`: `number` - Keep N most recent versions
- `keepTagged?`: `boolean` - Always keep tagged versions (default: true)
- `olderThan?`: `number` - Only prune versions older than timestamp

---

### `versions.getLatest(entityId)` → `Promise<EntityVersion | null>`

Get latest version.

```typescript
const latest = await brain.versions.getLatest('user-123')
if (latest) {
 console.log(`Latest: v${latest.version} (${latest.tag})`)
}
```

---

### `versions.getVersionByTag(entityId, tag)` → `Promise<EntityVersion | null>`

Get version by tag.

```typescript
const beta = await brain.versions.getVersionByTag('user-123', 'beta')
```

---

### `versions.count(entityId)` → `Promise<number>`

Count versions for an entity.

```typescript
const count = await brain.versions.count('user-123')
console.log(`${count} versions saved`)
```

---

### `versions.hasVersions(entityId)` → `Promise<boolean>`

Check if entity has versions.

```typescript
if (await brain.versions.hasVersions('user-123')) {
 console.log('Entity has version history')
}
```

---

### Auto-Versioning Augmentation

Automatically create versions on entity updates.

```typescript
import { VersioningAugmentation } from '@soulcraft/brainy'

// Configure auto-versioning
const versioning = new VersioningAugmentation({
 enabled: true,
 onUpdate: true, // Version on update()
 onDelete: false, // Don't version on delete
 entities: ['user-*'], // Only version users
 excludeEntities: ['temp-*'],
 excludeTypes: ['temporary'],
 keepRecent: 50, // Auto-prune old versions
 keepTagged: true
})

// Apply augmentation
brain.augment(versioning)

// Now updates auto-create versions
await brain.update('user-123', { name: 'New Name' })

// Version automatically created!
const versions = await brain.versions.list('user-123')
console.log(`Auto-created version: ${versions[0].version}`)
```

**Configuration:**
- `enabled`: `boolean` - Enable/disable augmentation
- `onUpdate`: `boolean` - Version on entity updates
- `onDelete`: `boolean` - Version before deletion
- `entities`: `string[]` - Entity ID patterns (glob-style)
- `excludeEntities`: `string[]` - Exclusion patterns
- `types`: `string[]` - Entity types to version
- `excludeTypes`: `string[]` - Types to exclude
- `keepRecent`: `number` - Auto-prune to keep N versions
- `keepTagged`: `boolean` - Always keep tagged versions

**Pattern Matching:**
- `['*']` - All entities
- `['user-*']` - All IDs starting with "user-"
- `['*-prod']` - All IDs ending with "-prod"
- `['user-*', 'account-*']` - Multiple patterns

---

### Branch Isolation

Versions are isolated per branch.

```typescript
// Save version on main
await brain.versions.save('doc-1', { tag: 'main-v1' })

// Fork and create version
const feature = await brain.fork('feature')
await feature.update('doc-1', { content: 'Feature update' })
await feature.versions.save('doc-1', { tag: 'feature-v1' })

// Versions are isolated
const mainVersions = await brain.versions.list('doc-1')
const featureVersions = await feature.versions.list('doc-1')

console.log(mainVersions.length !== featureVersions.length) // true
```

---

### Architecture

**Content-Addressable Storage:**
- SHA-256 hashing for deduplication
- Identical content = single storage blob
- Efficient for entities with few changes

**Metadata Indexing:**
- Leverages existing MetadataIndexManager
- Fast lookups by entity ID
- Version number indexing

**Storage Structure:**
```
_version:{entityId}:{versionNum}:{branch} // Version metadata
_version_blob:{contentHash} // Content blob (deduplicated)
```

**Performance:**
- Version save: O(1) if duplicate, O(log N) for index update
- Version list: O(K) where K = version count
- Version restore: O(log N) lookup + O(1) restore
- Pruning: O(K) where K = versions pruned

---

### Examples

#### Basic Versioning Workflow

```typescript
// Create entity
await brain.add({
 data: 'User profile',
 id: 'user-123',
 type: 'user',
 metadata: { name: 'Alice', email: 'alice@example.com' }
})

// Save v1
await brain.versions.save('user-123', { tag: 'v1.0' })

// Make changes
await brain.update('user-123', { name: 'Alice Smith' })

// Save v2
await brain.versions.save('user-123', { tag: 'v2.0' })

// Compare versions
const diff = await brain.versions.compare('user-123', 1, 2)

// Restore to v1 if needed
await brain.versions.restore('user-123', 'v1.0')
```

#### Release Management

```typescript
// Development workflow
await brain.update('app-config', { version: '1.0.0-alpha' })
await brain.versions.save('app-config', { tag: 'alpha' })

await brain.update('app-config', { version: '1.0.0-beta' })
await brain.versions.save('app-config', { tag: 'beta' })

await brain.update('app-config', { version: '1.0.0' })
await brain.versions.save('app-config', { tag: 'release' })

// Rollback to beta if issues found
await brain.versions.restore('app-config', 'beta')
```

#### Audit Trail

```typescript
// Track all changes
const versioning = new VersioningAugmentation({
 enabled: true,
 onUpdate: true,
 entities: ['audit-*'],
 keepRecent: 100 // Keep 100 versions for audit
})

brain.augment(versioning)

// All updates now tracked
await brain.update('audit-record-1', { status: 'modified' })
await brain.update('audit-record-1', { status: 'approved' })

// View complete history
const versions = await brain.versions.list('audit-record-1')
versions.forEach(v => {
 console.log(`${v.createdAt}: ${v.description}`)
})
```

#### VFS File Versioning

```typescript
// VFS files can be versioned with actual blob content
await brain.vfs.writeFile('/docs/readme.md', 'Version 1 content')

// Get the file's entity ID
const stat = await brain.vfs.stat('/docs/readme.md')

// Save version 1
await brain.versions.save(stat.entityId, { tag: 'v1', description: 'Initial draft' })

// Modify the file
await brain.vfs.writeFile('/docs/readme.md', 'Version 2 - updated content')

// Save version 2
await brain.versions.save(stat.entityId, { tag: 'v2', description: 'Updated docs' })

// Compare versions - content is DIFFERENT
const v1 = await brain.versions.getContent(stat.entityId, 1)
const v2 = await brain.versions.getContent(stat.entityId, 2)
console.log(v1.data !== v2.data) // true

// Restore to v1 - writes content back to blob storage
await brain.versions.restore(stat.entityId, 'v1')

// File is now back to v1
const content = await brain.vfs.readFile('/docs/readme.md')
console.log(content.toString()) // 'Version 1 content'
```

---

**[📖 Complete Versioning Guide →](../features/entity-versioning.md)**

---

## Virtual Filesystem (VFS)

Access via `brain.vfs` (property, not method). Auto-initialized during `brain.init()`.

### Filtering VFS Entities

All VFS entities (files/folders) have `metadata.isVFSEntity: true` set automatically.

Use this to filter VFS entities from semantic search results:

```typescript
// Exclude VFS entities from semantic search
const semanticOnly = await brain.find({
 query: 'artificial intelligence',
 where: {
 isVFSEntity: { notEquals: true } // Only semantic entities
 }
})

// Or filter to ONLY VFS entities
const vfsOnly = await brain.find({
 where: {
 isVFSEntity: { equals: true } // Only VFS files/folders
 }
})

// Check if an entity is a VFS entity
if (entity.metadata.isVFSEntity === true) {
 console.log('This is a VFS file or folder')
}
```

**Why this matters:** Without filtering, VFS files/folders can appear in concept explorers and semantic search results where they don't belong.

---

### Basic File Operations

#### `vfs.readFile(path, options?)` → `Promise<Buffer>`

Read file content.

```typescript
const content = await brain.vfs.readFile('/docs/README.md')
console.log(content.toString())
```

---

#### `vfs.writeFile(path, data, options?)` → `Promise<void>`

Write file content.

```typescript
await brain.vfs.writeFile('/docs/README.md', 'New content', {
 encoding: 'utf-8'
})
```

---

#### `vfs.unlink(path)` → `Promise<void>`

Delete a file.

```typescript
await brain.vfs.unlink('/docs/old-file.md')
```

---

### Directory Operations

#### `vfs.mkdir(path, options?)` → `Promise<void>`

Create directory.

```typescript
await brain.vfs.mkdir('/projects/new-app', { recursive: true })
```

---

#### `vfs.readdir(path, options?)` → `Promise<string[] | Dirent[]>`

List directory contents.

```typescript
const files = await brain.vfs.readdir('/projects')

// With file types
const entries = await brain.vfs.readdir('/projects', { withFileTypes: true })
entries.forEach(entry => {
 console.log(entry.name, entry.isDirectory() ? 'DIR' : 'FILE')
})
```

---

#### `vfs.rmdir(path, options?)` → `Promise<void>`

Remove directory.

```typescript
await brain.vfs.rmdir('/old-project', { recursive: true })
```

---

#### `vfs.stat(path)` → `Promise<Stats>`

Get file/directory stats.

```typescript
const stats = await brain.vfs.stat('/docs/README.md')
console.log(stats.size) // File size
console.log(stats.mtime) // Modified time
console.log(stats.isDirectory()) // Is directory?
```

---

### Semantic Operations

#### `vfs.search(query, options?)` → `Promise<SearchResult[]>`

Semantic file search.

```typescript
const results = await brain.vfs.search('React components with hooks', {
 path: '/src',
 limit: 10
})
```

---

#### `vfs.findSimilar(path, options?)` → `Promise<SearchResult[]>`

Find similar files.

```typescript
const similar = await brain.vfs.findSimilar('/src/App.tsx', {
 limit: 5,
 threshold: 0.7
})
```

---

### Tree Operations

#### `vfs.getTreeStructure(path, options?)` → `Promise<TreeNode>`

Get directory tree (prevents infinite recursion).

```typescript
const tree = await brain.vfs.getTreeStructure('/projects', {
 maxDepth: 3
})
```

---

#### `vfs.getDescendants(path, options?)` → `Promise<VFSEntity[]>`

Get all descendants with optional filtering.

```typescript
const files = await brain.vfs.getDescendants('/src', {
 filter: (entity) => entity.name.endsWith('.tsx')
})
```

---

### Metadata & Relationships

#### `vfs.getMetadata(path)` → `Promise<Metadata>`

Get file metadata.

```typescript
const meta = await brain.vfs.getMetadata('/src/App.tsx')
console.log(meta.todos) // Extracted TODOs
console.log(meta.tags) // Tags
```

---

#### `vfs.getRelationships(path)` → `Promise<Relation[]>`

Get file relationships.

```typescript
const rels = await brain.vfs.getRelationships('/src/App.tsx')
// Returns: imports, references, dependencies
```

---

#### `vfs.getTodos(path)` → `Promise<Todo[]>`

Get TODOs from a file.

```typescript
const todos = await brain.vfs.getTodos('/src/App.tsx')
```

---

#### `vfs.getAllTodos(path?)` → `Promise<Todo[]>`

Get all TODOs from directory tree.

```typescript
const allTodos = await brain.vfs.getAllTodos('/src')
```

---

### Project Analysis

#### `vfs.getProjectStats(path?)` → `Promise<Stats>`

Get project statistics.

```typescript
const stats = await brain.vfs.getProjectStats('/projects/my-app')
console.log(stats.fileCount)
console.log(stats.totalSize)
console.log(stats.fileTypes) // Breakdown by extension
```

---

#### `vfs.searchEntities(query)` → `Promise<VFSEntity[]>`

Search for VFS entities by metadata.

```typescript
const tsxFiles = await brain.vfs.searchEntities({
 type: 'file',
 extension: '.tsx'
})
```

---

**[📖 Complete VFS Documentation →](../vfs/QUICK_START.md)**

---

## Neural API

Access advanced AI features via `brain.neural()` (method that returns NeuralAPI instance).

### `neural().similar(a, b, options?)` → `Promise<number | SimilarityResult>`

Calculate semantic similarity.

```typescript
// Simple similarity score
const score = await brain.neural().similar(
 'renewable energy',
 'sustainable power'
) // 0.87

// Detailed result
const result = await brain.neural().similar('text1', 'text2', {
 detailed: true
})
console.log(result.score)
console.log(result.explanation)
```

---

### `neural().clusters(input?, options?)` → `Promise<Cluster[]>`

Automatic clustering.

```typescript
const clusters = await brain.neural().clusters({
 algorithm: 'kmeans',
 k: 5,
 minSize: 3
})

clusters.forEach(cluster => {
 console.log(cluster.label)
 console.log(cluster.items)
 console.log(cluster.centroid)
})
```

---

### `neural().neighbors(id, options?)` → `Promise<Neighbor[]>`

Find k-nearest neighbors.

```typescript
const neighbors = await brain.neural().neighbors(entityId, {
 k: 10,
 threshold: 0.7
})
```

---

### `neural().outliers(threshold?)` → `Promise<string[]>`

Detect outlier entities.

```typescript
const outliers = await brain.neural().outliers(0.3)
// Returns entity IDs that are outliers
```

---

### `neural().visualize(options?)` → `Promise<VizData>`

Generate visualization data.

```typescript
const vizData = await brain.neural().visualize({
 maxNodes: 100,
 dimensions: 3,
 algorithm: 'force',
 includeEdges: true
})
// Use with D3.js, Cytoscape, GraphML tools
```

---

### Performance Methods

#### `neural().clusterFast(options)` → `Promise<Cluster[]>`

Fast clustering for large datasets.

```typescript
const clusters = await brain.neural().clusterFast({
 k: 10,
 maxIterations: 50
})
```

---

#### `neural().clusterLarge(options)` → `Promise<Cluster[]>`

Streaming clustering for very large datasets.

```typescript
const clusters = await brain.neural().clusterLarge({
 k: 20,
 batchSize: 1000
})
```

---

## Import & Export

### `import(source, options?)` → `Promise<ImportResult>`

Smart import with auto-detection (CSV, Excel, PDF, JSON, URLs).

```typescript
// CSV import
await brain.import('data.csv', {
 format: 'csv',
 createEntities: true
})

// Excel import
await brain.import('sales.xlsx', {
 format: 'excel',
 sheets: ['Q1', 'Q2']
})

// PDF import
await brain.import('research.pdf', {
 format: 'pdf',
 extractTables: true
})

// URL import
await brain.import('https://api.example.com/data.json')
```

**Parameters:**
- `source`: `string | Buffer | object` - File path, URL, buffer, or object
- `options?`: Import configuration
 - `format?`: `'csv' | 'excel' | 'pdf' | 'json'` - Auto-detected if omitted
 - `createEntities?`: `boolean` - Create entities from rows
 - `sheets?`: `string[]` - Excel sheets to import
 - `extractTables?`: `boolean` - Extract tables from PDF

**Returns:** `Promise<ImportResult>` - Import statistics

**Note:** Import always uses the current branch.

**[📖 Complete Import Guide →](../guides/import-anything.md)**

---

### Export & Snapshots

```typescript
// Export to file
await brain.export('/path/to/backup.brainy')

// Create instant snapshot using COW fork
await brain.fork('backup-2025-01-19')

// Time-travel to specific commit
const snapshot = await brain.asOf(commitId)
const entities = await snapshot.find({ limit: 100 })
```

---

## Configuration

### Constructor Options

```typescript
const brain = new Brainy({
 // Storage configuration
 storage: {
 type: 'memory', // memory | opfs | filesystem | s3 | r2 | gcs | azure
 path: './brainy-data', // For filesystem storage
 compression: true, // Enable gzip compression (60-80% savings)

 // Cloud storage configs (see Storage Adapters section)
 s3Storage: { ... },
 r2Storage: { ... },
 gcsStorage: { ... },
 azureStorage: { ... }
 },

 // HNSW vector index config
 hnsw: {
 M: 16, // Connections per layer
 efConstruction: 200, // Construction quality
 efSearch: 100, // Search quality
 typeAware: true // Enable type-aware indexing
 },

 // Model configuration (embedded in WASM - zero config needed)
 // Model: all-MiniLM-L6-v2 (384 dimensions)
 // Device: CPU via WASM (works everywhere)

 // Cache configuration
 cache: {
 enabled: true,
 maxSize: 10000,
 ttl: 3600000 // 1 hour in ms
 }
})

await brain.init() // Required! VFS auto-initialized
```

---

## Storage Adapters

All 7 storage adapters support **copy-on-write branching**.

### Memory (Default)

```typescript
const brain = new Brainy({
 storage: { type: 'memory' }
})
```

**Use case:** Development, testing, prototyping

---

### OPFS (Browser)

```typescript
const brain = new Brainy({
 storage: { type: 'opfs' }
})
```

**Use case:** Browser applications with persistent storage

---

### Filesystem (Node.js)

```typescript
const brain = new Brainy({
 storage: {
 type: 'filesystem',
 path: './brainy-data',
 compression: true // 60-80% space savings
 }
})
```

**Use case:** Node.js applications, local persistence

---

### AWS S3

```typescript
const brain = new Brainy({
 storage: {
 type: 's3',
 s3Storage: {
 bucketName: 'my-brainy-data',
 region: 'us-east-1',
 accessKeyId: process.env.AWS_ACCESS_KEY_ID,
 secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
 }
 }
})

// Enable Intelligent-Tiering for 96% cost savings
await brain.storage.enableIntelligentTiering('entities/', 'auto-tier')
```

**Use case:** Production deployments, scalable storage

**[📖 AWS S3 Cost Optimization →](../operations/cost-optimization-aws-s3.md)**

---

### Cloudflare R2

```typescript
const brain = new Brainy({
 storage: {
 type: 'r2',
 r2Storage: {
 accountId: process.env.CF_ACCOUNT_ID,
 bucketName: 'my-brainy-data',
 accessKeyId: process.env.CF_ACCESS_KEY_ID,
 secretAccessKey: process.env.CF_SECRET_ACCESS_KEY
 }
 }
})
```

**Use case:** Zero egress fees, cost-effective storage

**[📖 R2 Cost Optimization →](../operations/cost-optimization-cloudflare-r2.md)**

---

### Google Cloud Storage (GCS)

```typescript
const brain = new Brainy({
 storage: {
 type: 'gcs',
 gcsStorage: {
 bucketName: 'my-brainy-data',
 projectId: process.env.GCP_PROJECT_ID,
 keyFilename: './gcp-key.json'
 }
 }
})

// Enable auto-tiering
await brain.storage.enableAutoclass({
 terminalStorageClass: 'ARCHIVE'
})
```

**Use case:** Google Cloud ecosystem, global distribution

**[📖 GCS Cost Optimization →](../operations/cost-optimization-gcs.md)**

---

### Azure Blob Storage

```typescript
const brain = new Brainy({
 storage: {
 type: 'azure',
 azureStorage: {
 accountName: process.env.AZURE_STORAGE_ACCOUNT,
 accountKey: process.env.AZURE_STORAGE_KEY,
 containerName: 'brainy-data'
 }
 }
})
```

**Use case:** Azure ecosystem, enterprise deployments

**[📖 Azure Cost Optimization →](../operations/cost-optimization-azure.md)**

---

## Utility Methods

### `clear()` → `Promise<void>`

Clear all data (entities and relationships).

```typescript
await brain.clear()
```

---

### `getNounCount()` → `Promise<number>`

Get total entity count.

```typescript
const count = await brain.getNounCount()
```

---

### `getVerbCount()` → `Promise<number>`

Get total relationship count.

```typescript
const count = await brain.getVerbCount()
```

---

### `embed(data)` → `Promise<number[]>` ✨

Generate embedding vector from text or data.

```typescript
const vector = await brain.embed('Hello world')
// 384-dimensional vector
console.log(vector.length) // 384
```

---

### `embedBatch(texts)` → `Promise<number[][]>` ✨

Batch embed multiple texts using native WASM batch API (single forward pass).

```typescript
const embeddings = await brain.embedBatch([
 'Machine learning is fascinating',
 'Deep neural networks',
 'Natural language processing'
])
console.log(embeddings.length) // 3
console.log(embeddings[0].length) // 384
```

> Uses the WASM engine's native `embed_batch()` for a single model forward pass instead of N individual calls. This is the same batch API used internally by `highlight()`.

---

### `similarity(textA, textB)` → `Promise<number>` ✨

Calculate semantic similarity between two texts.

```typescript
const score = await brain.similarity(
 'The cat sat on the mat',
 'A feline was resting on the rug'
)
console.log(score) // ~0.85 (high semantic similarity)
```

**Returns:** Score from 0 (different) to 1 (identical meaning)

---

### `neighbors(entityId, options?)` → `Promise<string[]>` ✨

Get graph neighbors of an entity.

```typescript
// Get all connected entities
const neighbors = await brain.neighbors(entityId)

// Get outgoing connections only
const outgoing = await brain.neighbors(entityId, {
 direction: 'outgoing',
 limit: 10
})

// Multi-hop traversal
const extended = await brain.neighbors(entityId, {
 depth: 2,
 direction: 'both'
})
```

**Options:**
- `direction`: `'outgoing' | 'incoming' | 'both'` (default: 'both')
- `depth`: `number` - Traversal depth (default: 1)
- `verbType`: `VerbType` - Filter by relationship type
- `limit`: `number` - Maximum neighbors to return

---

### `findDuplicates(options?)` → `Promise<DuplicateResult[]>` ✨

Find semantic duplicates in the database.

```typescript
// Find all duplicates
const duplicates = await brain.findDuplicates()

for (const group of duplicates) {
 console.log('Original:', group.entity.id)
 for (const dup of group.duplicates) {
 console.log(` Duplicate: ${dup.entity.id} (${dup.similarity.toFixed(2)})`)
 }
}

// Find person duplicates with higher threshold
const personDupes = await brain.findDuplicates({
 type: NounType.PERSON,
 threshold: 0.9,
 limit: 50
})
```

**Options:**
- `threshold`: `number` - Minimum similarity (default: 0.85)
- `type`: `NounType` - Filter by entity type
- `limit`: `number` - Maximum duplicate groups (default: 100)

---

### `indexStats()` → `Promise<IndexStats>` ✨

Get comprehensive index statistics.

```typescript
const stats = await brain.indexStats()
console.log(`Entities: ${stats.entities}`)
console.log(`Vectors: ${stats.vectors}`)
console.log(`Relationships: ${stats.relationships}`)
console.log(`Memory: ${(stats.memoryUsage.total / 1024 / 1024).toFixed(1)}MB`)
console.log(`Fields: ${stats.metadataFields.join(', ')}`)
```

**Returns:**
- `entities` - Total entity count
- `vectors` - Total vectors in HNSW index
- `relationships` - Total relationships in graph
- `metadataFields` - Indexed metadata fields
- `memoryUsage.vectors` - Vector memory (bytes)
- `memoryUsage.graph` - Graph memory (bytes)
- `memoryUsage.metadata` - Metadata index memory (bytes)
- `memoryUsage.total` - Total memory usage

---

### `cluster(options?)` → `Promise<ClusterResult[]>` ✨

Cluster entities by semantic similarity.

```typescript
// Find all clusters
const clusters = await brain.cluster()

for (const cluster of clusters) {
 console.log(`${cluster.clusterId}: ${cluster.entities.length} entities`)
}

// Find document clusters with centroids
const docClusters = await brain.cluster({
 type: NounType.Document,
 threshold: 0.85,
 minClusterSize: 3,
 includeCentroid: true
})
```

**Options:**
- `threshold`: `number` - Similarity threshold (default: 0.8)
- `type`: `NounType` - Filter by entity type
- `minClusterSize`: `number` - Minimum cluster size (default: 2)
- `limit`: `number` - Maximum clusters to return (default: 100)
- `includeCentroid`: `boolean` - Calculate cluster centroids (default: false)

**Returns:**
- `clusterId` - Unique cluster identifier
- `entities` - Array of entities in the cluster
- `centroid` - Average embedding vector (if includeCentroid is true)

---

### `getStats()` → `Statistics`

Get comprehensive statistics.

```typescript
const stats = brain.getStats()
console.log(stats.entityCount)
console.log(stats.relationshipCount)
console.log(stats.cacheHitRate)
```

---

## Lifecycle

### Initialization

```typescript
const brain = new Brainy(config)
await brain.init() // Required! VFS auto-initialized here
```

VFS is auto-initialized during `brain.init()` - no separate `vfs.init()` needed!

---

### Shutdown

```typescript
await brain.shutdown() // Graceful shutdown, flush caches
```

---

## Examples

### Basic CRUD

```typescript
// Create
const id = await brain.add({
 data: 'Quantum computing breakthrough',
 type: NounType.Concept,
 metadata: { category: 'tech', year: 2024 }
})

// Read
const entity = await brain.get(id)

// Update
await brain.update({
 id,
 metadata: { updated: true }
})

// Delete
await brain.delete(id)
```

---

### Knowledge Graphs

```typescript
// Create entities
const ai = await brain.add({
 data: 'Artificial Intelligence',
 type: NounType.Concept
})

const ml = await brain.add({
 data: 'Machine Learning',
 type: NounType.Concept
})

// Create relationship
await brain.relate({
 from: ml,
 to: ai,
 type: VerbType.IsA
})

// Traverse graph
const results = await brain.find({
 connected: { from: ai, depth: 2 }
})
```

---

### Triple Intelligence Query

```typescript
const results = await brain.find({
 query: 'modern frontend frameworks', // 🔍 Vector
 where: { // 📊 Document
 year: { greaterThan: 2020 },
 category: { oneOf: ['framework', 'library'] }
 },
 connected: { // 🕸️ Graph
 to: reactId,
 depth: 2,
 type: VerbType.BuiltOn
 },
 limit: 10
})
```

---

### Git-Style Workflow

```typescript
// Fork for experimentation
const experiment = await brain.fork('test-migration')

// Make changes in isolation
await experiment.add({
 data: 'New feature',
 type: NounType.Document
})

// Commit your work
await experiment.commit({
 message: 'Add new feature',
 author: 'dev@example.com'
})

// Switch to experimental branch to make it active
await brain.checkout('test-migration')
```

---

### VFS File Management

```typescript
// Write files
await brain.vfs.writeFile('/docs/README.md', 'Project documentation')
await brain.vfs.mkdir('/src/components', { recursive: true })

// Read files
const content = await brain.vfs.readFile('/docs/README.md')

// Semantic search
const reactFiles = await brain.vfs.search('React components with hooks', {
 path: '/src'
})

// Get tree structure (safe, prevents infinite recursion)
const tree = await brain.vfs.getTreeStructure('/projects', {
 maxDepth: 3
})
```

---

## Type System Reference

Stage 3 CANONICAL taxonomy with 169 types (42 nouns + 127 verbs)

### Noun Types (42)

Brainy uses a comprehensive noun type system covering 96-97% of human knowledge:

**Core Entity Types (7)**
- `NounType.Person` - Individual human entities
- `NounType.Organization` - Companies, institutions, collectives
- `NounType.Location` - Geographic and spatial entities
- `NounType.Thing` - Physical objects and artifacts
- `NounType.Concept` - Abstract ideas and principles
- `NounType.Event` - Temporal occurrences
- `NounType.Agent` - AI agents, bots, automated systems

**Digital/Content Types (4)**
- `NounType.Document` - Text-based files and written content
- `NounType.Media` - Audio, video, images
- `NounType.File` - Generic digital files
- `NounType.Message` - Communication content

**Business Types (4)**
- `NounType.Product` - Commercial products
- `NounType.Service` - Service offerings
- `NounType.Task` - Actions, todos, work items
- `NounType.Project` - Organized initiatives

**Scientific Types (2)**
- `NounType.Hypothesis` - Theories and propositions
- `NounType.Experiment` - Studies and investigations

**And 25 more types** including: `Organism`, `Substance`, `Quality`, `TimeInterval`, `Function`, `Proposition`, `Collection`, `Dataset`, `Process`, `State`, `Role`, `Language`, `Currency`, `Measurement`, `Contract`, `Regulation`, `Interface`, `Resource`, `Custom`, `SocialGroup`, `Institution`, `Norm`, `InformationContent`, `InformationBearer`, `Relationship`

### Verb Types (127)

Brainy supports 127 relationship types organized into categories:

**Foundational (7)**
- `VerbType.InstanceOf`, `VerbType.SubclassOf`, `VerbType.ParticipatesIn`
- `VerbType.RelatedTo`, `VerbType.Contains`, `VerbType.PartOf`, `VerbType.References`

**Spatial & Temporal (14)**
- Location: `LocatedAt`, `AdjacentTo`, `ContainsSpatially`, `OverlapsSpatially`, `Above`, `Below`, `Inside`, `Outside`, `Facing`
- Time: `Precedes`, `During`, `OccursAt`, `Overlaps`, `ImmediatelyAfter`, `SimultaneousWith`

**Causal & Dependency (11)**
- Direct: `Causes`, `Enables`, `Prevents`, `DependsOn`, `Requires`
- Modal: `CanCause`, `MustCause`, `WouldCauseIf`, `ProbablyCauses`
- Variations: `RigidlyDependsOn`, `FunctionallyDependsOn`, `HistoricallyDependsOn`

**Creation & Change (10)**
- Lifecycle: `Creates`, `Transforms`, `Becomes`, `Modifies`, `Consumes`, `Destroys`
- Properties: `GainsProperty`, `LosesProperty`, `RemainsSame`, `PersistsThrough`

**Social & Communication (8)**
- `MemberOf`, `WorksWith`, `FriendOf`, `Follows`, `Likes`, `ReportsTo`, `Mentors`, `Communicates`

**Epistemic & Modal (14)**
- Knowledge: `Knows`, `Doubts`, `Believes`, `Learns`
- Mental states: `Desires`, `Intends`, `Fears`, `Loves`, `Hates`, `Hopes`, `Perceives`
- Modality: `CouldBe`, `MustBe`, `Counterfactual`

**Measurement & Comparison (9)**
- `Measures`, `MeasuredIn`, `ConvertsTo`, `HasMagnitude`, `GreaterThan`
- `SimilarityDegree`, `ApproximatelyEquals`, `MoreXThan`, `HasDegree`

**And 54 more specialized verbs** including ownership, composition, uncertainty, deontic relationships (obligations/permissions), context-dependent truth, spatial/temporal variations, information theory, and meta-level relationships.

### Complete Reference

For the full taxonomy with all 169 types and their descriptions, see:
- **[Stage 3 CANONICAL Taxonomy](../STAGE3-CANONICAL-TAXONOMY.md)** - Complete list with categories
- **[Noun-Verb Taxonomy Architecture](../architecture/noun-verb-taxonomy.md)** - Design rationale

### Migration from
**Breaking Changes:**
- `NounType.Content` removed → Use `Document`, `Message`, or `InformationContent`
- `NounType.User` removed → Use `Person` or `Agent`
- `NounType.Topic` removed → Use `Concept` or `Category`

**New Types Added:**
- **+11 noun types**: Agent, Organism, Substance, Quality, TimeInterval, Function, Proposition, Custom, SocialGroup, Institution, Norm, InformationContent, InformationBearer, Relationship
- **+87 verb types**: Extensive additions across all categories

---

## Key Features

- ✅ **Entity Versioning** - Git-style versioning for individual entities
- ✅ **Content-Addressable Storage** - SHA-256 deduplication for versions
- ✅ **Auto-Versioning Augmentation** - Automatic version creation on updates
- ✅ **Branch-Isolated Versions** - Versions isolated per branch
- ✅ **VFS Entity Filtering** - All VFS entities now have `isVFSEntity: true` flag
- ✅ **VFS Auto-Initialization** - No more separate `vfs.init()` calls
- ✅ **VFS Property Access** - Use `brain.vfs.method()` instead of `brain.vfs().method()`
- ✅ **Complete COW Support** - All 20 TypeAware methods use COW helpers
- ✅ **Verified Import/Export** - Work correctly with current branch
- ✅ **Instant Fork** - Snowflake-style copy-on-write (<100ms fork time)
- ✅ **Git-Style Branching** - fork, commit, checkout, listBranches
- ✅ **Full Branch Isolation** - Parent and fork fully isolated
- ✅ **Read-Through Inheritance** - Forks see parent + own data
- ✅ **Universal Storage Support** - All 7 adapters support branching

**[📖 Complete Changes →](../../.strategy/v5.1.0-CHANGES.md)**

---

## Support & Resources

- **📖 Documentation:** [Full Documentation](../)
- **🐛 Issues:** [GitHub Issues](https://github.com/soulcraftlabs/brainy/issues)
- **💬 Discussions:** [GitHub Discussions](https://github.com/soulcraftlabs/brainy/discussions)
- **📦 NPM:** [@soulcraft/brainy](https://www.npmjs.com/package/@soulcraft/brainy)
- **⭐ GitHub:** [Star us](https://github.com/soulcraftlabs/brainy)

---

## See Also

- **[Triple Intelligence Architecture](../architecture/triple-intelligence.md)** - How vector + graph + document work together
- **[VFS Quick Start](../vfs/QUICK_START.md)** - Complete VFS documentation
- **[Import Anything Guide](../guides/import-anything.md)** - CSV, Excel, PDF, URL imports
- **[Cloud Deployment](../deployment/CLOUD_DEPLOYMENT_GUIDE.md)** - Production deployment
- **[Instant Fork](../features/instant-fork.md)** - Git-style branching guide

---

**License:** MIT © Brainy Contributors

---

*Brainy - The Knowledge Operating System*
*From prototype to planet-scale • Zero configuration • Triple Intelligence™ • Git-Style Branching*
