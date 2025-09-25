# Virtual Filesystem API Developer Guide 📁🚀

## Overview

Brainy's Virtual Filesystem (VFS) provides a POSIX-like filesystem interface that stores files as intelligent entities in Brainy's knowledge graph. Unlike traditional filesystems, every file has semantic understanding, relationships, and rich metadata.

## Quick Start

```typescript
import { Brainy, VirtualFileSystem } from '@soulcraft/brainy'

// Initialize Brainy
const brain = new Brainy({
  storage: { type: 'memory' } // or 'redis', 'postgresql', etc.
})
await brain.init()

// Create VFS instance
const vfs = new VirtualFileSystem(brain)
await vfs.init()

// Use like any filesystem
await vfs.writeFile('/hello.txt', 'Hello, World!')
const content = await vfs.readFile('/hello.txt')
console.log(content.toString()) // "Hello, World!"
```

## Core Concepts

### Files as Intelligent Entities

Every file in VFS is stored as a Brainy entity with:
- **Vector embedding** for semantic similarity
- **Rich metadata** (size, type, permissions, custom attributes)
- **Graph relationships** to other files and entities
- **Version history** and change tracking
- **Content understanding** via Triple Intelligence

### Triple Intelligence Integration

VFS leverages Brainy's Triple Intelligence for powerful operations:
- **Vector Intelligence:** Semantic similarity search
- **Field Intelligence:** Metadata-based queries
- **Graph Intelligence:** Relationship traversal

### Hierarchical + Graph Structure

- Traditional **hierarchical** paths (`/path/to/file.txt`)
- **Graph relationships** between any entities
- **Collections** as directories that can contain any entities
- **Flexible organization** beyond strict hierarchy

## API Reference

### Basic Operations

#### File Operations

```typescript
// Write file (creates if doesn't exist, updates if exists)
await vfs.writeFile(path: string, data: Buffer | string, options?: WriteOptions): Promise<void>

// Read file content
await vfs.readFile(path: string, options?: ReadOptions): Promise<Buffer>

// Append to existing file
await vfs.appendFile(path: string, data: Buffer | string): Promise<void>

// Delete file
await vfs.unlink(path: string): Promise<void>

// Check if file exists
await vfs.exists(path: string): Promise<boolean>

// Get file metadata
await vfs.stat(path: string): Promise<VFSStats>
```

**Example:**
```typescript
// Create a text file
await vfs.writeFile('/documents/notes.txt', 'My important notes')

// Read it back
const content = await vfs.readFile('/documents/notes.txt')
console.log(content.toString())

// Append more content
await vfs.appendFile('/documents/notes.txt', '\nMore notes...')

// Check file info
const stats = await vfs.stat('/documents/notes.txt')
console.log(stats.size, stats.mtime, stats.metadata)

// Delete when done
await vfs.unlink('/documents/notes.txt')
```

#### Directory Operations

```typescript
// Create directory (recursive by default)
await vfs.mkdir(path: string, options?: MkdirOptions): Promise<void>

// Remove directory
await vfs.rmdir(path: string, options?: RmdirOptions): Promise<void>

// List directory contents
await vfs.readdir(path: string, options?: ReaddirOptions): Promise<string[] | Dirent[]>
```

**Example:**
```typescript
// Create nested directories
await vfs.mkdir('/projects/my-app/src', { recursive: true })

// Create files in directories
await vfs.writeFile('/projects/my-app/src/index.js', 'console.log("Hello")')
await vfs.writeFile('/projects/my-app/README.md', '# My App')

// List directory contents
const files = await vfs.readdir('/projects/my-app')
console.log(files) // ['src', 'README.md']

// Get detailed file information
const detailed = await vfs.readdir('/projects/my-app', { withFileTypes: true })
for (const entry of detailed) {
  console.log(entry.name, entry.isDirectory() ? 'DIR' : 'FILE')
}

// Remove directory (recursive)
await vfs.rmdir('/projects/my-app', { recursive: true })
```

### Advanced Operations

#### File Movement and Copying

```typescript
// Rename/move file or directory
await vfs.rename(oldPath: string, newPath: string): Promise<void>

// Copy file (Note: Implementation needed)
// await vfs.copy(src: string, dest: string, options?: CopyOptions): Promise<void>
```

**Example:**
```typescript
await vfs.writeFile('/temp/draft.txt', 'Draft content')

// Move to final location
await vfs.rename('/temp/draft.txt', '/documents/final.txt')

// Rename directory
await vfs.rename('/old-project', '/new-project')
```

#### Metadata and Attributes

```typescript
// Write file with metadata
await vfs.writeFile('/project/config.json', jsonData, {
  metadata: {
    author: 'john@example.com',
    version: '1.0',
    tags: ['config', 'production'],
    lastReviewed: Date.now()
  }
})

// Read metadata from stats
const stats = await vfs.stat('/project/config.json')
console.log(stats.metadata) // { author: 'john@example.com', ... }
```

### Intelligent Search

#### Natural Language Search

```typescript
// Search using natural language
const results = await vfs.search(query: string, options?: SearchOptions): Promise<SearchResult[]>
```

**Example:**
```typescript
// Semantic search
const results = await vfs.search('JavaScript configuration files', {
  limit: 10,
  type: ['file']
})

for (const result of results) {
  console.log(`${result.path} (score: ${result.score})`)
  console.log(`  Vector: ${result.breakdown.vector}`)
  console.log(`  Field: ${result.breakdown.field}`)
  console.log(`  Graph: ${result.breakdown.graph}`)
}
```

#### Similarity Search

```typescript
// Find files similar to a specific file
const similar = await vfs.findSimilar(path: string, options?: SimilarOptions): Promise<SimilarFile[]>
```

**Example:**
```typescript
await vfs.writeFile('/docs/api-guide.md', 'API documentation...')
await vfs.writeFile('/docs/user-manual.md', 'User guide...')
await vfs.writeFile('/src/config.js', 'module.exports = {...}')

// Find files similar to API guide
const similar = await vfs.findSimilar('/docs/api-guide.md', {
  limit: 5,
  minSimilarity: 0.7
})

console.log('Similar files:', similar.map(f => f.path))
```

#### Metadata-Based Queries

```typescript
// Complex metadata queries
const results = await vfs.search('*', {
  where: {
    'metadata.author': 'john@example.com',
    'metadata.tags': { $in: ['important', 'urgent'] },
    size: { $gt: 1000 },
    mtime: { $gte: Date.now() - 86400000 } // Last 24 hours
  }
})
```

### Configuration Options

#### VFS Initialization

```typescript
const vfs = new VirtualFileSystem(brain, {
  cacheSize: 1000,        // Path resolution cache size
  defaultPermissions: 0o644,  // Default file permissions
  enableMimeDetection: true,   // Auto-detect MIME types
  enableCache: true,          // Enable performance caching
  maxFileSize: 100 * 1024 * 1024, // 100MB max file size
})
```

#### Write Options

```typescript
interface WriteOptions {
  encoding?: BufferEncoding    // Text encoding (default: 'utf8')
  mode?: number               // File permissions
  flag?: string               // Write flag ('w', 'a', etc.)
  metadata?: Record<string, any>  // Custom metadata
  mimeType?: string          // Override MIME type detection
}

// Example with options
await vfs.writeFile('/data/users.json', jsonData, {
  metadata: {
    schema: 'users-v2',
    encrypted: false,
    retention: '7years'
  },
  mimeType: 'application/json',
  mode: 0o600 // Read/write for owner only
})
```

#### Read Options

```typescript
interface ReadOptions {
  encoding?: BufferEncoding   // Text encoding
  flag?: string              // Read flag
  maxSize?: number          // Maximum bytes to read
}

// Read with encoding
const textContent = await vfs.readFile('/docs/readme.txt', {
  encoding: 'utf8',
  maxSize: 10000
})
```

#### Search Options

```typescript
interface SearchOptions {
  limit?: number                    // Max results (default: 100)
  offset?: number                  // Pagination offset
  type?: ('file' | 'directory')[]  // Filter by type
  where?: Record<string, any>      // Metadata filters
  sortBy?: string                  // Sort field
  sortOrder?: 'asc' | 'desc'      // Sort direction
  includeContent?: boolean         // Include file content in results
  minScore?: number               // Minimum relevance score
}
```

### Performance Optimization

#### Caching

VFS uses a sophisticated 4-layer cache hierarchy:

1. **L1 Hot Paths** (<1ms) - Most frequently accessed paths
2. **L2 Path Cache** (<5ms) - Recently resolved paths
3. **L3 Parent Cache** (<10ms) - Parent directory relationships
4. **L4 Graph Traversal** (<50ms) - Full graph database query

```typescript
// Monitor cache performance
const pathResolver = vfs.pathResolver
console.log(pathResolver.getCacheStats())
// {
//   hotPathHits: 1250,
//   pathCacheHits: 890,
//   parentCacheHits: 445,
//   totalQueries: 2750,
//   avgResponseTime: 2.3
// }

// Clear cache if needed
pathResolver.clearCache() // Clear all caches
pathResolver.clearCache('/specific/path') // Clear specific path
```

#### Batch Operations

```typescript
// More efficient than individual operations
const files = [
  { path: '/batch/file1.txt', content: 'Content 1' },
  { path: '/batch/file2.txt', content: 'Content 2' },
  { path: '/batch/file3.txt', content: 'Content 3' }
]

// Write multiple files
await Promise.all(
  files.map(f => vfs.writeFile(f.path, f.content))
)

// Read multiple files
const contents = await Promise.all(
  files.map(f => vfs.readFile(f.path))
)
```

#### Large File Handling

```typescript
// For files > 10MB, consider chunking
const largeFile = Buffer.alloc(50 * 1024 * 1024) // 50MB

// Write in chunks
const chunkSize = 1024 * 1024 // 1MB chunks
for (let i = 0; i < largeFile.length; i += chunkSize) {
  const chunk = largeFile.slice(i, i + chunkSize)
  if (i === 0) {
    await vfs.writeFile('/large/file.bin', chunk)
  } else {
    await vfs.appendFile('/large/file.bin', chunk)
  }
}
```

### Integration Patterns

#### With Node.js fs API

```typescript
import * as fs from 'fs/promises'

// Drop-in replacement patterns
class FSAdapter {
  constructor(private vfs: VirtualFileSystem) {}

  async readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer> {
    const content = await this.vfs.readFile(path)
    return encoding ? content.toString(encoding) : content
  }

  async writeFile(path: string, data: string | Buffer): Promise<void> {
    return this.vfs.writeFile(path, data)
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.vfs.mkdir(path, options)
  }

  async readdir(path: string): Promise<string[]> {
    return this.vfs.readdir(path)
  }

  async stat(path: string): Promise<fs.Stats> {
    const vfsStats = await this.vfs.stat(path)
    // Convert VFSStats to fs.Stats format
    return vfsStats as any
  }

  async unlink(path: string): Promise<void> {
    return this.vfs.unlink(path)
  }

  async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.vfs.rmdir(path, options)
  }
}

const fsAdapter = new FSAdapter(vfs)
// Now use fsAdapter like normal fs
```

#### With Express.js

```typescript
import express from 'express'

const app = express()

// Serve files from VFS
app.get('/files/*', async (req, res) => {
  const filePath = '/' + req.params[0]

  try {
    const exists = await vfs.exists(filePath)
    if (!exists) {
      return res.status(404).send('File not found')
    }

    const content = await vfs.readFile(filePath)
    const stats = await vfs.stat(filePath)

    res.set({
      'Content-Type': stats.metadata?.mimeType || 'application/octet-stream',
      'Content-Length': stats.size.toString(),
      'Last-Modified': stats.mtime?.toUTCString()
    })

    res.send(content)
  } catch (error) {
    res.status(500).send('Error reading file')
  }
})

// Upload files to VFS
app.post('/upload', express.raw({ limit: '10mb' }), async (req, res) => {
  const filename = req.headers['x-filename'] as string
  const filepath = `/uploads/${filename}`

  await vfs.writeFile(filepath, req.body, {
    metadata: {
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.headers['x-user-id'],
      originalName: filename
    }
  })

  res.json({ success: true, path: filepath })
})
```

#### Database-Like Queries

```typescript
// Use VFS like a document database
class DocumentStore {
  constructor(private vfs: VirtualFileSystem) {}

  async save(collection: string, id: string, document: any): Promise<void> {
    const path = `/${collection}/${id}.json`
    await this.vfs.writeFile(path, JSON.stringify(document), {
      metadata: {
        collection,
        documentId: id,
        savedAt: Date.now(),
        type: 'document'
      }
    })
  }

  async find(collection: string, query?: any): Promise<any[]> {
    const results = await this.vfs.search('*', {
      where: {
        'metadata.collection': collection,
        'metadata.type': 'document',
        ...query
      }
    })

    const documents = []
    for (const result of results) {
      const content = await this.vfs.readFile(result.path)
      documents.push(JSON.parse(content.toString()))
    }

    return documents
  }

  async findById(collection: string, id: string): Promise<any> {
    const path = `/${collection}/${id}.json`
    try {
      const content = await this.vfs.readFile(path)
      return JSON.parse(content.toString())
    } catch {
      return null
    }
  }

  async update(collection: string, id: string, updates: any): Promise<void> {
    const document = await this.findById(collection, id)
    if (document) {
      await this.save(collection, id, { ...document, ...updates })
    }
  }

  async delete(collection: string, id: string): Promise<void> {
    const path = `/${collection}/${id}.json`
    await this.vfs.unlink(path)
  }
}

// Usage
const store = new DocumentStore(vfs)

await store.save('users', 'user123', {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'admin'
})

const users = await store.find('users', { role: 'admin' })
const user = await store.findById('users', 'user123')
```

### Error Handling

VFS uses standard POSIX-style errors:

```typescript
import { VFSError, VFSErrorCode } from '@soulcraft/brainy'

try {
  await vfs.readFile('/nonexistent.txt')
} catch (error) {
  if (error instanceof VFSError) {
    switch (error.code) {
      case VFSErrorCode.ENOENT:
        console.log('File not found')
        break
      case VFSErrorCode.EACCES:
        console.log('Permission denied')
        break
      case VFSErrorCode.EISDIR:
        console.log('Is a directory')
        break
      case VFSErrorCode.ENOTDIR:
        console.log('Not a directory')
        break
      default:
        console.log('Unknown error:', error.message)
    }
  }
}
```

### Storage Compatibility

VFS works with **all** Brainy storage adapters:

```typescript
// Memory (testing)
const brain = new Brainy({ storage: { type: 'memory' } })

// Redis (development)
const brain = new Brainy({
  storage: {
    type: 'redis',
    url: 'redis://localhost:6379'
  }
})

// PostgreSQL (production)
const brain = new Brainy({
  storage: {
    type: 'postgresql',
    connectionString: 'postgresql://user:pass@localhost/db'
  }
})

// ChromaDB (vector-optimized)
const brain = new Brainy({
  storage: {
    type: 'chroma',
    url: 'http://localhost:8000'
  }
})

// All work identically with VFS
const vfs = new VirtualFileSystem(brain)
```

### Best Practices

#### File Organization

```typescript
// Use consistent naming conventions
await vfs.writeFile('/projects/my-app/src/components/Button.tsx', buttonComponent)
await vfs.writeFile('/projects/my-app/docs/api/authentication.md', authDocs)
await vfs.writeFile('/projects/my-app/tests/unit/button.test.js', buttonTests)

// Use metadata for better organization
await vfs.writeFile('/assets/logo.png', logoData, {
  metadata: {
    type: 'asset',
    category: 'branding',
    format: 'png',
    dimensions: '512x512',
    usage: ['website', 'mobile-app']
  }
})
```

#### Search Optimization

```typescript
// Use specific queries for better performance
const results = await vfs.search('React components', {
  where: {
    'metadata.type': 'component',
    'metadata.framework': 'react'
  },
  type: ['file'],
  limit: 20
})

// Cache frequently used searches
const searchCache = new Map()
const cachedSearch = async (query: string) => {
  if (searchCache.has(query)) {
    return searchCache.get(query)
  }
  const results = await vfs.search(query)
  searchCache.set(query, results)
  return results
}
```

#### Metadata Strategy

```typescript
// Consistent metadata schema
interface FileMetadata {
  type: 'source' | 'doc' | 'asset' | 'config'
  language?: string
  author: string
  created: number
  tags: string[]
  project: string
}

await vfs.writeFile('/src/utils.ts', utilsCode, {
  metadata: {
    type: 'source',
    language: 'typescript',
    author: 'john@company.com',
    created: Date.now(),
    tags: ['utility', 'helper'],
    project: 'main-app'
  } as FileMetadata
})
```

### Migration from Regular Filesystem

```typescript
import * as fs from 'fs/promises'
import * as path from 'path'

async function migrateFromFS(fsPath: string, vfsPath: string) {
  const stats = await fs.stat(fsPath)

  if (stats.isDirectory()) {
    await vfs.mkdir(vfsPath, { recursive: true })

    const entries = await fs.readdir(fsPath)
    for (const entry of entries) {
      await migrateFromFS(
        path.join(fsPath, entry),
        vfsPath + '/' + entry
      )
    }
  } else {
    const content = await fs.readFile(fsPath)
    await vfs.writeFile(vfsPath, content, {
      metadata: {
        migratedFrom: fsPath,
        migratedAt: Date.now(),
        originalSize: stats.size,
        originalMtime: stats.mtime.getTime()
      }
    })
  }
}

// Migrate entire project
await migrateFromFS('./my-project', '/migrated/my-project')
```

### Debugging and Monitoring

```typescript
// Enable debug mode
const vfs = new VirtualFileSystem(brain, { debug: true })

// Monitor operations
let operationCount = 0
const originalWriteFile = vfs.writeFile.bind(vfs)
vfs.writeFile = async (path: string, data: any, options?: any) => {
  operationCount++
  console.log(`Operation ${operationCount}: writeFile(${path})`)
  return originalWriteFile(path, data, options)
}

// Get VFS statistics
const stats = {
  totalFiles: (await vfs.search('*', { type: ['file'] })).length,
  totalDirs: (await vfs.search('*', { type: ['directory'] })).length,
  cacheStats: vfs.pathResolver.getCacheStats()
}
console.log('VFS Stats:', stats)
```

---

The Virtual Filesystem API provides a powerful, intelligent alternative to traditional filesystems. With semantic search, rich metadata, and graph relationships, your files become living entities in a connected knowledge system.

For advanced features like event recording, semantic versioning, and persistent entities, see the [Knowledge Layer API Documentation](./KNOWLEDGE_LAYER_API.md).

Ready to make your filesystem intelligent? 🚀