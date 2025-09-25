# VFS + Knowledge Layer Integration

## Overview

The Knowledge Layer is an optional augmentation that transforms VFS from a filesystem into an intelligent knowledge management system. When enabled, it adds event recording, semantic versioning, persistent entities, universal concepts, and Git integration.

## Enabling Knowledge Layer

```javascript
const brain = new Brainy({
  storage: { type: 'memory' },
  silent: true
})
await brain.init()

const vfs = brain.vfs()
await vfs.init()

// Enable Knowledge Layer augmentation
await vfs.enableKnowledgeLayer()

// Now VFS has additional intelligent features
```

## Architecture

The Knowledge Layer consists of five integrated systems:

### 1. EventRecorder
Tracks all filesystem operations as searchable events with embeddings.

### 2. SemanticVersioning
Creates versions based on semantic meaning changes, not just byte differences.

### 3. PersistentEntitySystem
Tracks evolving entities (characters, concepts, systems) across files.

### 4. ConceptSystem
Manages universal concepts that span multiple files and projects.

### 5. GitBridge
Enables import/export between VFS and Git repositories.

## Event Recording

Every filesystem operation is recorded as an event:

```javascript
// All operations are automatically recorded
await vfs.writeFile('/doc.txt', 'Initial content')
await vfs.appendFile('/doc.txt', '\nMore content')
await vfs.rename('/doc.txt', '/document.txt')

// Query events
const history = await vfs.getHistory('/document.txt')
for (const event of history) {
  console.log(event.type, event.timestamp, event.user)
  // 'create' 2025-01-20T10:00:00Z 'alice'
  // 'write' 2025-01-20T10:01:00Z 'alice'
  // 'rename' 2025-01-20T10:02:00Z 'alice'
}

// Search events semantically
const events = await vfs.searchEvents('document changes')
```

### Event Types
- `create` - File/directory created
- `write` - Content written
- `append` - Content appended
- `delete` - File/directory deleted
- `rename` - Path changed
- `move` - File relocated
- `metadata` - Metadata updated
- `relationship` - Relationship added/removed

### Event Schema
```javascript
{
  id: 'uuid',
  type: 'write',
  path: '/document.txt',
  oldPath: null,              // For renames/moves
  timestamp: Date.now(),
  user: 'current-user',
  size: 1024,                 // Bytes affected
  contentHash: 'sha256...',   // Content fingerprint
  vector: [0.1, 0.2, ...],    // Semantic embedding
  metadata: {
    mimeType: 'text/plain',
    encoding: 'utf8'
  }
}
```

## Semantic Versioning

Versions are created when content *meaning* changes significantly:

```javascript
// Initial version
await vfs.writeFile('/story.txt', 'Once upon a time...')

// Minor change - no new version (typo fix)
await vfs.writeFile('/story.txt', 'Once upon a time...')

// Major change - creates new version (plot development)
await vfs.writeFile('/story.txt', 'Once upon a time, the kingdom fell...')

// Get versions
const versions = await vfs.getVersions('/story.txt')
for (const version of versions) {
  console.log(version.id, version.timestamp, version.semanticHash)
  // Compare semantic similarity between versions
  console.log(version.similarity) // 0.45 (significantly different)
}

// Restore version
await vfs.restoreVersion('/story.txt', versions[0].id)

// Diff versions semantically
const diff = await vfs.diffVersions('/story.txt', v1.id, v2.id)
console.log(diff.additions)    // New concepts added
console.log(diff.removals)     // Concepts removed
console.log(diff.modifications) // Concepts changed
```

### Version Triggers
- Semantic similarity < 0.7 threshold
- New concepts introduced
- Major structural changes
- Explicit version creation

## Persistent Entities

Track characters, systems, and entities across files:

```javascript
// Create persistent entity
const character = await vfs.createEntity({
  name: 'Alice',
  type: 'character',
  description: 'Main protagonist, a curious explorer',
  attributes: {
    age: 25,
    occupation: 'Archaeologist',
    traits: ['brave', 'intelligent', 'curious']
  }
})

// Entity appears across multiple files
await vfs.writeFile('/chapter1.txt', 'Alice entered the ancient tomb...')
await vfs.writeFile('/chapter2.txt', 'Alice decoded the hieroglyphs...')

// Track entity across files
const occurrences = await vfs.findEntityOccurrences('Alice')
// Returns all files mentioning Alice with context

// Update entity globally
await vfs.updateEntity(character.id, {
  attributes: {
    age: 26,  // Birthday happened in the story
    newTrait: 'experienced'
  }
})

// Entity types
const entities = await vfs.listEntities({ type: 'character' })
// Supports: character, location, object, system, concept, etc.
```

### Entity Relationships
```javascript
// Link entities
await vfs.linkEntities('Alice', 'Ancient Tomb', 'explores')
await vfs.linkEntities('Alice', 'Bob', 'mentored_by')

// Query entity graph
const graph = await vfs.getEntityGraph('Alice', { depth: 2 })
// Returns connected entities and their relationships
```

## Concept System

Universal concepts that transcend individual files:

```javascript
// Create concept
const authConcept = await vfs.createConcept({
  name: 'Authentication',
  type: 'technical',
  domain: 'security',
  description: 'User identity verification system',
  keywords: ['login', 'password', 'token', 'session'],
  relatedConcepts: ['Authorization', 'Security']
})

// Concepts are automatically detected in files
await vfs.writeFile('/auth.js', 'function authenticate(user, password) {...}')
await vfs.writeFile('/login.tsx', 'const LoginForm = () => {...}')

// Find files by concept
const authFiles = await vfs.findByConcept('Authentication')
// Returns all files related to authentication concept

// Get concept map
const conceptMap = await vfs.getConceptMap('/src')
// Returns hierarchy of concepts in directory

// Merge similar concepts
await vfs.mergeConcepts('User Auth', 'Authentication')

// Concept evolution tracking
const evolution = await vfs.trackConceptEvolution('Authentication')
// Shows how the concept has changed over time
```

### Concept Relationships
```javascript
// Define concept relationships
await vfs.relateConcepts('Authentication', 'Session Management', 'requires')
await vfs.relateConcepts('Authentication', 'User Database', 'uses')

// Query concept network
const network = await vfs.getConceptNetwork('Authentication')
// Returns graph of related concepts
```

## GitBridge Integration

Seamlessly work with Git repositories:

```javascript
// Import from Git repo
await vfs.importFromGit('/local/git/repo', '/vfs/project')

// Imports:
// - All files and directories
// - Git history as VFS events
// - Commit messages as event metadata
// - Branch structure as relationships

// Export to Git format
await vfs.exportToGit('/vfs/project', '/local/git/repo')

// Exports:
// - Files to working directory
// - VFS events as git commits
// - Relationships as .brainy/relationships.json
// - Entities as .brainy/entities.json
// - Concepts as .brainy/concepts.json

// Sync with remote
await vfs.syncWithGit('https://github.com/user/repo.git')
```

### Git Metadata Preservation
```javascript
// Git metadata is preserved
const gitMeta = await vfs.getGitMetadata('/vfs/project/file.js')
console.log(gitMeta.lastCommit)     // Hash of last commit
console.log(gitMeta.authors)        // List of contributors
console.log(gitMeta.created)        // First commit date
console.log(gitMeta.modified)       // Last commit date
```

## Knowledge Queries

Powerful queries across all Knowledge Layer data:

```javascript
// Timeline query
const timeline = await vfs.getTimeline({
  from: '2025-01-01',
  to: '2025-01-31',
  types: ['write', 'create']
})

// Impact analysis
const impact = await vfs.analyzeImpact('/core/auth.js')
// Returns files that would be affected by changes

// Dependency graph
const deps = await vfs.getDependencyGraph('/src')
// Returns import/export relationships

// Knowledge search
const results = await vfs.knowledgeSearch({
  query: 'authentication flow',
  includeEvents: true,
  includeVersions: true,
  includeEntities: true,
  includeConcepts: true
})

// Collaborative insights
const insights = await vfs.getInsights('/project')
// Returns:
// - Most active files
// - Key concepts
// - Entity relationships
// - Development patterns
// - Suggested improvements
```

## Background Processing

Knowledge Layer operations run in the background:

```javascript
// Operations are non-blocking
await vfs.writeFile('/large-doc.txt', hugeContent)
// Returns immediately

// Knowledge processing happens asynchronously:
// 1. Event recording (immediate)
// 2. Embedding generation (100ms)
// 3. Version checking (200ms)
// 4. Entity extraction (500ms)
// 5. Concept detection (1s)

// Check processing status
const status = await vfs.getProcessingStatus()
console.log(status.pending)    // Number of pending operations
console.log(status.processed)  // Number completed

// Wait for processing
await vfs.waitForProcessing()  // Blocks until all done
```

## Machine Learning Integration

The Knowledge Layer enables ML-powered features:

```javascript
// Auto-tagging
await vfs.enableAutoTagging()
await vfs.writeFile('/report.pdf', pdfContent)
const tags = await vfs.getTags('/report.pdf')
// ['financial', 'quarterly', 'revenue', 'analysis']

// Content suggestions
const suggestions = await vfs.getSuggestions('/story.txt')
// Returns potential next sentences based on context

// Duplicate detection
const duplicates = await vfs.findDuplicates({
  threshold: 0.95,  // Similarity threshold
  checkContent: true,
  checkStructure: true
})

// Anomaly detection
const anomalies = await vfs.detectAnomalies()
// Returns files that don't fit patterns

// Smart categorization
await vfs.enableSmartCategorization()
const category = await vfs.getCategory('/document.txt')
// Returns: 'technical/documentation/api'
```

## Collaboration Features

Knowledge Layer enables multi-user collaboration:

```javascript
// Track user actions
vfs.setUser('alice')
await vfs.writeFile('/shared.txt', 'Alice\'s content')

vfs.setUser('bob')
await vfs.appendFile('/shared.txt', 'Bob\'s addition')

// Get collaboration history
const collabHistory = await vfs.getCollaborationHistory('/shared.txt')
// Shows who did what when

// Conflict detection
const conflicts = await vfs.detectConflicts('/shared.txt')
// Returns semantic conflicts, not just line differences

// Merge intelligence
const mergeStrategy = await vfs.suggestMerge(
  '/alice/version.txt',
  '/bob/version.txt'
)
// Returns intelligent merge suggestions
```

## Performance Impact

Knowledge Layer overhead:
- **Write operations**: +50-200ms for event recording
- **Read operations**: No impact (cached)
- **Search operations**: 10x faster (pre-computed embeddings)
- **Storage**: ~20% additional for events and embeddings
- **Memory**: +100MB for caches and indexes

## Configuration

Fine-tune Knowledge Layer behavior:

```javascript
await vfs.enableKnowledgeLayer({
  eventRecording: true,        // Track all operations
  semanticVersioning: true,    // Smart versioning
  versionThreshold: 0.7,       // Similarity threshold
  persistentEntities: true,    // Track entities
  entityTypes: ['character', 'location', 'system'],
  concepts: true,              // Universal concepts
  conceptDomains: ['technical', 'narrative', 'business'],
  gitBridge: true,            // Git integration
  backgroundProcessing: true,  // Non-blocking
  processingDelay: 100,       // Ms before processing
  cacheSizes: {
    events: 10000,
    versions: 1000,
    entities: 5000,
    concepts: 2000
  }
})
```

## Complete Example

```javascript
import { Brainy } from '@soulcraft/brainy'

async function knowledgeExample() {
  // Initialize with Knowledge Layer
  const brain = new Brainy({
    storage: { type: 'memory' }
  })
  await brain.init()

  const vfs = brain.vfs()
  await vfs.init()
  await vfs.enableKnowledgeLayer()

  // Create a story with tracked entities
  const alice = await vfs.createEntity({
    name: 'Alice',
    type: 'character',
    description: 'Protagonist'
  })

  await vfs.writeFile('/chapter1.md', `
    # Chapter 1
    Alice discovered the ancient artifact...
  `)

  // File automatically:
  // - Records write event
  // - Generates embedding
  // - Links to Alice entity
  // - Detects "ancient artifact" concept

  // Create technical documentation
  await vfs.createConcept({
    name: 'API Design',
    type: 'technical',
    domain: 'software'
  })

  await vfs.writeFile('/api-guide.md', `
    # API Design Guide
    RESTful principles...
  `)

  // Check Knowledge Layer insights
  const insights = await vfs.getInsights('/')
  console.log('Entities:', insights.entities)
  console.log('Concepts:', insights.concepts)
  console.log('Relationships:', insights.relationships)

  // Query across knowledge
  const results = await vfs.knowledgeSearch({
    query: 'Alice artifact',
    includeEvents: true,
    includeEntities: true
  })

  await vfs.close()
  await brain.close()
}
```

The Knowledge Layer transforms VFS from a filesystem into an intelligent knowledge management system that understands content, tracks evolution, and enables semantic collaboration.