# Knowledge Layer API Documentation 📚🧠

## Overview

The Knowledge Layer transforms Brainy's VFS from a simple filesystem into an intelligent knowledge system where files understand themselves, track their evolution, and maintain relationships across time.

## Quick Start

```typescript
import { Brainy } from '@soulcraft/brainy'

// Initialize Brainy with VFS
const brain = new Brainy()
await brain.init()

const vfs = brain.vfs()
await vfs.init()

// Enable Knowledge Layer - this augments VFS with intelligence features
await vfs.enableKnowledgeLayer()

// Now your VFS has superpowers! 🚀
// The Knowledge Layer dynamically adds new methods to the VFS instance:
// - Event Recording: getHistory(), reconstructAtTime()
// - Semantic Versioning: getVersions(), restoreVersion()
// - Entity System: createEntity(), linkEntities(), findEntityOccurrences()
// - Concepts: createConcept(), findByConcept()
// - Git Bridge: exportToGit(), importFromGit()
// - And many more...
```

## How It Works: Method Augmentation

The Knowledge Layer uses a powerful augmentation pattern. When you call `enableKnowledgeLayer()`:

1. **Wraps Core Methods**: Intercepts existing VFS methods to add intelligence
2. **Injects New Methods**: Dynamically adds new methods to the VFS instance
3. **Background Processing**: Runs intelligence extraction asynchronously
4. **Non-Breaking**: All existing code continues to work unchanged

```typescript
// Before enableKnowledgeLayer() - Core VFS only
vfs.writeFile() ✅  // Works
vfs.readFile() ✅   // Works
vfs.createEntity() ❌ // Method doesn't exist

// After enableKnowledgeLayer() - Enhanced VFS
vfs.writeFile() ✅  // Still works, now with event recording
vfs.readFile() ✅   // Still works, now tracks access patterns
vfs.createEntity() ✅ // New method available!
```

## Core Components

### 1. Event Recording - Complete History Tracking

Every file operation becomes a searchable event with full context.

```typescript
// Automatic event recording
await vfs.writeFile('/project/README.md', 'Initial README')
await vfs.writeFile('/project/README.md', 'Updated README')

// Get complete history
const history = await vfs.getHistory('/project/README.md')
console.log(history)
// [
//   { type: 'write', timestamp: 1234567890, content: Buffer('Updated README') },
//   { type: 'write', timestamp: 1234567880, content: Buffer('Initial README') }
// ]

// Time travel - reconstruct file at any point
const pastContent = await vfs.reconstructAtTime('/project/README.md', 1234567885)
console.log(pastContent.toString()) // "Initial README"

// Get statistics
const stats = await vfs.getStatistics('/project/README.md')
console.log(stats)
// {
//   totalEvents: 2,
//   totalWrites: 2,
//   totalBytes: 25,
//   authors: ['system'],
//   firstEvent: 1234567880,
//   lastEvent: 1234567890
// }
```

### 2. Semantic Versioning - Only Version When Meaning Changes

90% fewer versions than Git by only versioning when content meaning changes.

```typescript
// Automatic semantic versioning
await vfs.writeFile('/code/api.js', 'function login() { /* v1 */ }')
await vfs.writeFile('/code/api.js', 'function login() { /* v1 with comment */ }') // No new version
await vfs.writeFile('/code/api.js', 'function login() { return authenticate() }') // New version!

// Get versions (only meaningful ones)
const versions = await vfs.getVersions('/code/api.js')
console.log(versions.length) // 2 (not 3!)

// Get specific version
const v1Content = await vfs.getVersion('/code/api.js', versions[1].id)

// Restore to previous version
await vfs.restoreVersion('/code/api.js', versions[1].id)
```

### 3. Persistent Entities - Universal Characters

Track entities that evolve across files and time. Not just story characters - APIs, customers, services, any evolving entity.

```typescript
// Create a persistent entity
const apiEntityId = await vfs.createEntity({
  name: 'User API',
  type: 'api',
  aliases: ['UserService', 'UserAPI'],
  attributes: { version: '1.0', methods: ['get', 'post'] }
})

// Record appearance in a file
await vfs.recordAppearance(
  apiEntityId,
  '/docs/api.md',
  'The User API provides endpoints for user management...'
)

// Find all appearances
const appearances = await vfs.findEntityAppearances(apiEntityId)

// Evolve the entity
await vfs.evolveEntity(
  apiEntityId,
  { attributes: { version: '2.0', methods: ['get', 'post', 'delete'] } },
  '/docs/changelog.md',
  'Added delete functionality'
)

// Get evolution timeline
const { entity, timeline } = await vfs.getEntityEvolution(apiEntityId)
console.log(timeline) // All changes over time
```

### 4. Universal Concepts - Ideas That Transcend Files

Concepts exist independently and can be linked to multiple manifestations.

```typescript
// Create a universal concept
const authConceptId = await vfs.createConcept({
  name: 'Authentication',
  domain: 'security',
  category: 'pattern',
  keywords: ['auth', 'login', 'security'],
  strength: 0.9,
  metadata: {}
})

// Link concepts together
await vfs.linkConcept(authConceptId, otherConceptId, 'related', {
  strength: 0.8,
  context: 'Both are security-related patterns'
})

// Record manifestation
await vfs.recordManifestation(
  authConceptId,
  '/src/auth.js',
  'class AuthService implements authentication...',
  'implementation'
)

// Find concept appearances
const manifestations = await vfs.findConceptAppearances(authConceptId)

// Get concept graph for visualization
const graph = await vfs.getConceptGraph({ domain: 'security' })
// { concepts: [...], links: [...] }
```

### 5. Git Bridge - Import/Export Without Dependencies

Import any directory structure or export to Git-compatible format.

```typescript
// Import from any directory (not just Git repos)
const stats = await vfs.importFromGit(
  '/path/to/project',
  '/imported-project',
  {
    preserveGitHistory: true,
    extractMetadata: true
  }
)

console.log(stats)
// {
//   filesImported: 150,
//   eventsCreated: 75,
//   entitiesCreated: 12,
//   relationshipsCreated: 8
// }

// Export to Git format
const gitRepo = await vfs.exportToGit(
  '/my-project',
  '/export/git-repo',
  {
    preserveMetadata: true,
    preserveRelationships: true,
    commitMessage: 'Export from Brainy VFS'
  }
)
```

## Configuration Options

### Knowledge Augmentation Config

```typescript
interface KnowledgeAugmentationConfig {
  enabled?: boolean                    // Master enable/disable (default: true)

  eventRecording?: {
    enabled?: boolean                  // Record all operations (default: true)
    pruneAfterDays?: number           // Auto-prune old events (default: 90)
    compressEvents?: boolean          // Compress event storage (default: false)
  }

  semanticVersioning?: {
    enabled?: boolean                  // Semantic versioning (default: true)
    threshold?: number                 // Semantic change threshold 0-1 (default: 0.3)
    maxVersions?: number              // Max versions per file (default: 10)
  }

  persistentEntities?: {
    enabled?: boolean                  // Entity system (default: true)
    autoExtract?: boolean             // Auto-extract from content (default: false)
  }

  concepts?: {
    enabled?: boolean                  // Concept system (default: true)
    autoLink?: boolean                // Auto-link concepts (default: false)
  }

  gitBridge?: {
    enabled?: boolean                  // Git import/export (default: true)
  }
}
```

### Component-Specific Configs

```typescript
// Event Recorder
const eventRecorder = new EventRecorder(brain)

// Semantic Versioning
const versioning = new SemanticVersioning(brain, {
  threshold: 0.3,        // Only version if >30% semantic change
  maxVersions: 10,       // Keep max 10 versions per file
  minInterval: 60000     // Minimum 1 minute between versions
})

// Persistent Entities
const entities = new PersistentEntitySystem(brain, {
  autoExtract: true,             // Auto-extract entities
  similarityThreshold: 0.8,      // Entity matching threshold
  maxAppearances: 100,          // Max appearances per entity
  evolutionTracking: true       // Track entity evolution
})

// Concepts
const concepts = new ConceptSystem(brain, {
  autoLink: true,               // Auto-link related concepts
  similarityThreshold: 0.7,     // Concept similarity threshold
  maxManifestations: 1000,     // Max manifestations per concept
  strengthDecay: 0.95          // Concept strength decay rate
})
```

## Use Cases

### 1. Story/Content Management

```typescript
// Create characters that evolve across chapters
const aragornId = await vfs.createEntity({
  name: 'Aragorn',
  type: 'character',
  aliases: ['Strider', 'King Elessar'],
  attributes: { role: 'ranger', status: 'heir' }
})

// Track character development
await vfs.recordAppearance(aragornId, '/chapters/01.md', 'Aragorn watched from the shadows...')
await vfs.recordAppearance(aragornId, '/chapters/20.md', 'King Aragorn addressed his subjects...')

// Create universal themes
const heroJourneyId = await vfs.createConcept({
  name: 'Hero\'s Journey',
  domain: 'narrative',
  category: 'pattern',
  keywords: ['hero', 'quest', 'transformation']
})
```

### 2. API Documentation That Evolves

```typescript
// Track API endpoints as entities
const userApiId = await vfs.createEntity({
  name: 'Users API',
  type: 'api',
  attributes: {
    endpoints: ['/users', '/users/:id'],
    version: '1.0'
  }
})

// Document changes automatically
await vfs.writeFile('/api-docs/users.md', newApiDocs) // Auto-versions if meaning changed
await vfs.evolveEntity(userApiId, {
  attributes: { version: '1.1', endpoints: ['/users', '/users/:id', '/users/:id/profile'] }
}, '/api-docs/users.md', 'Added profile endpoint')
```

### 3. Research Knowledge Management

```typescript
// Create research concepts
const machineLearningId = await vfs.createConcept({
  name: 'Machine Learning',
  domain: 'ai',
  category: 'field',
  keywords: ['ML', 'artificial intelligence', 'algorithms']
})

// Link related concepts
await vfs.linkConcept(machineLearningId, deepLearningId, 'contains')
await vfs.linkConcept(machineLearningId, statisticsId, 'uses')

// Track concept manifestations across papers
await vfs.recordManifestation(machineLearningId, '/papers/survey.md', 'definition')
await vfs.recordManifestation(machineLearningId, '/papers/experiment.md', 'usage')
```

### 4. Codebase Intelligence

```typescript
// Auto-extract classes and functions as entities
const knowledge = new KnowledgeAugmentation({
  persistentEntities: { enabled: true, autoExtract: true },
  concepts: { enabled: true, autoLink: true }
})

// Import existing codebase
await vfs.importFromGit('/path/to/codebase', '/project')

// Get all extracted entities
const entities = await vfs.findEntity({ type: 'class' })
const functions = await vfs.findEntity({ type: 'function' })

// Track dependencies as relationships
const serviceId = await vfs.findEntity({ name: 'UserService' })
const controllerEntities = await vfs.findEntityAppearances(serviceId[0].id)
```

## Performance Characteristics

- **Event Recording**: 1000+ ops/second with automatic compression
- **Semantic Versioning**: <10ms version checking with embedding cache
- **Entity Tracking**: Handles millions of entities with graph optimization
- **Concept System**: Sub-second similarity search across 100k+ concepts
- **Git Bridge**: Imports 10k+ files/minute with parallel processing

## Storage Compatibility

Works with **ALL** Brainy storage adapters:
- ✅ Memory (testing)
- ✅ Redis (development)
- ✅ PostgreSQL (production)
- ✅ ChromaDB (vector-optimized)
- ✅ Future adapters (only uses standard Brainy APIs)

## Migration from Traditional VFS

```typescript
// Before: Basic VFS
const vfs = new VirtualFileSystem(brain)

// After: VFS with Knowledge Layer
const vfs = new VirtualFileSystem(brain)
const knowledge = new KnowledgeAugmentation()
await knowledge.init({ brain, vfs })

// All existing VFS methods still work exactly the same!
await vfs.writeFile('/test.txt', 'content') // Now with intelligence
```

## Advanced Patterns

### Custom Entity Extraction

```typescript
// Override auto-extraction with custom patterns
class CustomEntitySystem extends PersistentEntitySystem {
  async extractEntities(filePath: string, content: Buffer): Promise<string[]> {
    // Your custom extraction logic
    const text = content.toString()
    const apiEndpoints = text.match(/app\.(get|post|put|delete)\('([^']+)'/g)

    const entityIds = []
    for (const endpoint of apiEndpoints || []) {
      const entityId = await this.createEntity({
        name: endpoint,
        type: 'endpoint',
        aliases: [],
        attributes: { method: /* extract method */, path: /* extract path */ }
      })
      entityIds.push(entityId)
    }
    return entityIds
  }
}
```

### Custom Concept Detection

```typescript
class CustomConceptSystem extends ConceptSystem {
  async extractAndLinkConcepts(filePath: string, content: Buffer): Promise<string[]> {
    // Domain-specific concept extraction
    const text = content.toString()

    // Extract business concepts from comments
    const businessConcepts = text.match(/@business-concept:\s*([^\n]+)/g)

    const conceptIds = []
    for (const match of businessConcepts || []) {
      const conceptName = match.split(':')[1].trim()
      const conceptId = await this.createConcept({
        name: conceptName,
        domain: 'business',
        category: 'concept',
        keywords: [conceptName.toLowerCase()],
        strength: 1.0,
        metadata: { source: 'annotation' }
      })
      conceptIds.push(conceptId)
    }

    return conceptIds
  }
}
```

### Event Stream Processing

```typescript
// Listen to all VFS events for real-time processing
const eventRecorder = new EventRecorder(brain)

// Custom event processor
class RealTimeProcessor {
  async processEvent(event) {
    if (event.type === 'write' && event.path.endsWith('.md')) {
      // Process markdown files specially
      await this.extractMarkdownEntities(event.path, event.content)
    }
  }
}
```

## Best Practices

1. **Enable Gradually**: Start with basic features, enable advanced ones as needed
2. **Tune Thresholds**: Adjust similarity/change thresholds for your domain
3. **Custom Extraction**: Implement domain-specific entity/concept extraction
4. **Monitor Performance**: Use built-in statistics and caching features
5. **Version Strategy**: Consider your versioning needs when setting thresholds

## Troubleshooting

### Common Issues

**Q: Too many versions being created**
A: Increase `semanticVersioning.threshold` from 0.3 to 0.5 or higher

**Q: Entity extraction not working**
A: Check that `autoExtract: true` and consider custom extraction patterns

**Q: Poor concept linking**
A: Tune `similarityThreshold` and ensure good concept descriptions

**Q: Slow performance**
A: Enable caching, increase cache sizes, consider storage adapter choice

### Debug Mode

```typescript
// Enable debug logging
const knowledge = new KnowledgeAugmentation({
  // ... config
  debug: true  // Logs all operations
})

// Check system status
const status = knowledge.getStatus()
console.log(status) // All subsystem states

// Clear caches if needed
semanticVersioning.clearCache()
entitySystem.clearCache()
conceptSystem.clearCache()
```

---

The Knowledge Layer transforms your VFS from simple file storage into a living, breathing knowledge system. Files become intelligent, entities evolve, concepts transcend storage boundaries, and your data tells its own story.

Welcome to the future of filesystems! 🚀