# VFS Core Documentation

## Architecture

The Virtual File System (VFS) is a complete filesystem abstraction built entirely on Brainy's entity-relation graph. This isn't a mock filesystem or a wrapper around Node's fs module - it's a real, working filesystem where every file and directory exists as a Brainy entity.

## Core Components

### 1. VirtualFileSystem Class

The main VFS class (`src/vfs/VirtualFileSystem.ts`) provides all filesystem operations. It's initialized through a Brainy instance:

```javascript
const brain = new Brainy({ storage: { type: 'memory' } })
await brain.init()
const vfs = brain.vfs()
await vfs.init()
```

### 2. Entity-Based Storage

Every file and directory is a Brainy entity with:
- **Unique ID**: Entity UUID in the graph
- **Vector embedding**: Semantic representation for search
- **Metadata**: VFS-specific attributes (path, permissions, timestamps)
- **Relationships**: Links to other files/directories
- **Content**: Actual file data (inline, chunked, or compressed)

### 3. PathResolver

High-performance path resolution with 4-layer caching:
1. **Path-to-ID cache**: Direct path → entity ID mapping
2. **ID-to-metadata cache**: Entity ID → VFS metadata
3. **Parent cache**: Directory → children mapping
4. **Symlink cache**: Symlink resolution cache

```javascript
// Internally uses PathResolver for all path operations
const entity = await vfs.getEntity('/path/to/file.txt')
// PathResolver handles:
// - Absolute path resolution
// - Parent directory traversal
// - Symlink following
// - Cache management
```

### 4. Storage Strategies

VFS intelligently chooses storage based on file size:

#### Inline Storage (< 100KB)
```javascript
// Small files stored directly in entity data
await vfs.writeFile('/small.txt', 'Hello World')
// Stored as: entity.data = Buffer.from('Hello World')
```

#### Chunked Storage (> 5MB)
```javascript
// Large files split into chunks
const largeBuffer = Buffer.alloc(10 * 1024 * 1024)
await vfs.writeFile('/large.bin', largeBuffer)
// Stored as multiple entities linked together
```

#### Compressed Storage (> 10KB)
```javascript
// Automatic compression for medium files
await vfs.writeFile('/document.json', JSON.stringify(bigObject))
// Compressed with gzip, marked in metadata
```

## File Operations

### Core POSIX Operations

All standard filesystem operations are fully implemented:

```javascript
// File I/O
await vfs.writeFile(path, data, options)
const buffer = await vfs.readFile(path, options)
await vfs.appendFile(path, data, options)
await vfs.unlink(path)

// Directory operations
await vfs.mkdir(path, options)
await vfs.rmdir(path, { recursive: true })
const entries = await vfs.readdir(path, options)

// Metadata
const stats = await vfs.stat(path)
const exists = await vfs.exists(path)
await vfs.chmod(path, mode)
await vfs.chown(path, uid, gid)

// Path operations
await vfs.rename(oldPath, newPath)
await vfs.copy(src, dest, options)
await vfs.move(src, dest)

// Symlinks
await vfs.symlink(target, path)
const target = await vfs.readlink(path)
const resolved = await vfs.realpath(path)
```

### VFS Stats Object

Compatible with Node.js fs.Stats:

```javascript
const stats = await vfs.stat('/file.txt')

// Standard properties
stats.size          // File size in bytes
stats.mode          // Permissions (e.g., 0o644)
stats.uid           // User ID
stats.gid           // Group ID
stats.atime         // Access time
stats.mtime         // Modification time
stats.ctime         // Change time
stats.birthtime     // Creation time

// Type checks
stats.isFile()      // true for files
stats.isDirectory() // true for directories
stats.isSymbolicLink() // true for symlinks

// VFS-specific
stats.entityId      // Underlying Brainy entity ID
stats.vector        // Semantic embedding vector
stats.connections   // Number of relationships
```

## Relationships

Track semantic relationships between files:

```javascript
// Add typed relationships
await vfs.addRelationship('/index.js', '/utils.js', 'imports')
await vfs.addRelationship('/README.md', '/docs/', 'references')
await vfs.addRelationship('/test.js', '/src/main.js', 'tests')

// Query relationships
const related = await vfs.getRelated('/index.js')
// Returns: [{ to: '/utils.js', relationship: 'imports', direction: 'from' }]

// Remove specific relationship
await vfs.removeRelationship('/index.js', '/utils.js', 'imports')
```

Relationship types use Brainy's VerbType enum but accept strings too.

## Semantic Search

Every file has a vector embedding for intelligent search:

```javascript
// Search by meaning
const results = await vfs.search('user authentication', {
  path: '/src',        // Search scope
  type: 'file',       // File type filter
  limit: 10,          // Result limit
  recursive: true     // Include subdirs
})

// Results include relevance scores
for (const result of results) {
  console.log(result.path, result.score)
  // /src/auth.js 0.92
  // /src/login.js 0.87
  // /src/security.js 0.81
}

// Find similar files
const similar = await vfs.findSimilar('/src/auth.js', {
  limit: 5,
  threshold: 0.7  // Minimum similarity
})
```

## Metadata System

Attach custom metadata to any file:

```javascript
// Set metadata
await vfs.setMetadata('/package.json', {
  importance: 'critical',
  lastReview: '2025-01-15',
  owner: 'devteam',
  tags: ['config', 'npm', 'dependencies']
})

// Get metadata
const meta = await vfs.getMetadata('/package.json')
// Includes both custom and system metadata:
// {
//   importance: 'critical',
//   path: '/package.json',
//   size: 1024,
//   mimeType: 'application/json',
//   ...
// }
```

## Todo System

Track tasks associated with files:

```javascript
// Add todo
await vfs.addTodo('/src/api.js', {
  task: 'Add rate limiting',
  priority: 'high',
  status: 'pending',
  assignee: 'alice',
  due: '2025-02-01'
})

// Get todos
const todos = await vfs.getTodos('/src/api.js')

// Update todos
await vfs.setTodos('/src/api.js', [
  { id: '1', task: 'Add validation', status: 'completed', priority: 'high' },
  { id: '2', task: 'Add tests', status: 'pending', priority: 'medium' }
])
```

## Streaming

Full streaming support for large files:

```javascript
// Write stream
const writeStream = vfs.createWriteStream('/upload.zip')
request.pipe(writeStream)

writeStream.on('finish', () => {
  console.log('Upload complete')
})

// Read stream
const readStream = vfs.createReadStream('/download.pdf')
readStream.pipe(response)

// Stream with options
const partialStream = vfs.createReadStream('/video.mp4', {
  start: 1024,      // Start byte
  end: 10240,       // End byte
  highWaterMark: 64 * 1024  // Buffer size
})
```

## Import/Export

### Import from Filesystem

```javascript
// Import single file
await vfs.importFile('/local/path/document.pdf', '/vfs/document.pdf')

// Import directory recursively
await vfs.importDirectory('/local/project', { targetPath: '/vfs/project' })

// Import creates:
// - Brainy entities for each file/directory
// - Vector embeddings for searchability
// - Proper parent-child relationships
// - Preserved metadata (timestamps, permissions)
```

### GitBridge Export

```javascript
// Enable GitBridge
const gitBridge = vfs.gitBridge

// Export relationships as .brainy/relationships.json
const rels = await gitBridge.exportRelationships('/project')

// Export events as .brainy/events.json
const events = await gitBridge.exportEvents('/project')

// Export entities as .brainy/entities.json
const entities = await gitBridge.exportEntities()

// Export concepts as .brainy/concepts.json
const concepts = await gitBridge.exportConcepts()
```

## Performance Optimizations

### Caching
- Path resolution cached at 4 levels
- Content caching for frequently accessed files
- Metadata caching to reduce entity lookups
- Symlink resolution caching

### Chunking
- Files > 5MB automatically chunked
- Parallel chunk operations
- Chunk deduplication for identical blocks

### Compression
- Automatic gzip for files > 10KB
- Transparent decompression on read
- Compression ratio tracked in metadata

### Background Processing
- Non-blocking Knowledge Layer processing
- Asynchronous embedding generation
- Deferred relationship indexing

## Error Handling

VFS uses Node.js-compatible error codes:

```javascript
try {
  await vfs.readFile('/nonexistent')
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('File not found')
  }
}

// Error codes:
// ENOENT - No such file or directory
// EEXIST - File exists
// ENOTDIR - Not a directory
// EISDIR - Is a directory
// ENOTEMPTY - Directory not empty
// EACCES - Permission denied
// EINVAL - Invalid argument
```

## Thread Safety

VFS operations are thread-safe:
- Atomic file operations
- Transaction support for multi-step operations
- Consistent parent-child relationships
- Safe concurrent access

## Scalability

VFS scales to millions of files:
- O(1) path lookup with caching
- Efficient graph traversal for directories
- Chunked storage for large files
- Distributed storage backend support
- Vector search scales with HNSW index

## Complete Example

```javascript
import { Brainy } from '@soulcraft/brainy'

async function vfsExample() {
  // Initialize
  const brain = new Brainy({
    storage: { type: 'memory' },
    silent: true
  })
  await brain.init()

  const vfs = brain.vfs()
  await vfs.init()

  // Create project structure
  await vfs.mkdir('/project')
  await vfs.mkdir('/project/src')
  await vfs.mkdir('/project/tests')

  // Write files
  await vfs.writeFile('/project/package.json', JSON.stringify({
    name: 'my-app',
    version: '1.0.0'
  }, null, 2))

  await vfs.writeFile('/project/src/index.js', `
    import { utils } from './utils.js'

    export function main() {
      console.log('Hello from VFS!')
    }
  `)

  // Add relationships
  await vfs.addRelationship(
    '/project/src/index.js',
    '/project/src/utils.js',
    'imports'
  )

  // Search files
  const results = await vfs.search('import export function')

  // Add metadata
  await vfs.setMetadata('/project/src/index.js', {
    author: 'Alice',
    reviewed: true
  })

  // Add todos
  await vfs.addTodo('/project/src/index.js', {
    task: 'Add error handling',
    priority: 'high',
    status: 'pending'
  })

  // List directory
  const files = await vfs.readdir('/project/src')
  console.log('Source files:', files)

  // Get file info
  const stats = await vfs.stat('/project/package.json')
  console.log(`Package.json size: ${stats.size} bytes`)

  // Clean up
  await vfs.close()
  await brain.close()
}
```

This is a real, production-ready virtual filesystem with no mocks, stubs, or fake implementations.