# 🎯 VFS Common Patterns: Do This, Not That

> Learn the correct patterns for using Brainy VFS. Avoid the mistakes that cause crashes, poor performance, and API confusion.

## 🚨 Critical Pattern: Safe Tree Operations

### ❌ **WRONG - Causes Infinite Recursion**

```typescript
// DON'T DO THIS - Directory appears as its own child!
function buildFileTree(allItems, parentPath) {
  return allItems.filter(item => {
    // This includes the parent directory itself!
    return item.path.startsWith(parentPath)
  })
}

// Result: /dir -> /dir -> /dir -> ∞ (crashes browser/server)
```

### ✅ **CORRECT - Tree-Aware Methods**

```typescript
// ✅ Pattern 1: Direct children for UI trees
async function loadDirectoryUI(path: string) {
  const children = await vfs.getDirectChildren(path)

  // Guaranteed: No self-inclusion, no recursion
  return children.map(child => ({
    name: child.metadata.name,
    path: child.metadata.path,
    type: child.metadata.vfsType,
    hasChildren: child.metadata.vfsType === 'directory'
  }))
}

// ✅ Pattern 2: Complete tree structure
async function buildCompleteTree(path: string) {
  return await vfs.getTreeStructure(path, {
    maxDepth: 5,           // Prevent deep recursion
    includeHidden: false,  // Skip .hidden files
    sort: 'name'          // Organized output
  })
}

// ✅ Pattern 3: Detailed inspection
async function inspectPath(path: string) {
  const info = await vfs.inspect(path)
  return {
    current: info.node,
    children: info.children,    // Direct children only
    parent: info.parent,        // Parent directory
    stats: info.stats          // Size, permissions, etc.
  }
}
```

## 🗃️ Storage Configuration Patterns

### ❌ **WRONG - Memory Storage for Files**

```typescript
// DON'T DO THIS - Data disappears when process exits!
const brain = new Brainy({
  storage: { type: 'memory' }  // ❌ Temporary only
})

// Files written here are lost forever on restart
await vfs.writeFile('/important.doc', content)
```

### ✅ **CORRECT - Persistent Storage**

```typescript
// ✅ Pattern 1: Filesystem storage (development)
const brain = new Brainy({
  storage: {
    type: 'filesystem',
    path: './brainy-data'    // Persisted to disk
  }
})

// ✅ Pattern 2: Cloud storage (production)
const brain = new Brainy({
  storage: {
    type: 's3',
    bucket: 'my-vfs-data',
    region: 'us-west-2'
  }
})

// ✅ Pattern 3: Auto-detection (recommended)
const brain = new Brainy()  // Automatically chooses best storage
```

## 🔍 Search Patterns

### ❌ **WRONG - Manual String Matching**

```typescript
// DON'T DO THIS - Missing semantic understanding
async function findFilesOldWay(query: string) {
  const allFiles = await vfs.readdir('/', { recursive: true })
  return allFiles.filter(file =>
    file.includes(query.toLowerCase())  // ❌ Basic string match
  )
}
```

### ✅ **CORRECT - Semantic Search**

```typescript
// ✅ Pattern 1: Content-aware search
async function findFilesByContent(query: string) {
  return await vfs.search(query, {
    type: 'file',           // Only search files
    limit: 50,             // Reasonable limit
    threshold: 0.7         // Minimum relevance
  })
}

// ✅ Pattern 2: Filtered search
async function findInDirectory(query: string, basePath: string) {
  return await vfs.search(query, {
    path: basePath,        // Limit to specific directory
    includeContent: true,  // Include file content in results
    sort: 'relevance'      // Best matches first
  })
}

// ✅ Pattern 3: Metadata-based search
async function findByAttributes(criteria: any) {
  return await vfs.find({
    where: criteria,       // MongoDB-style queries
    orderBy: 'modified',   // Sort by last modified
    limit: 100
  })
}
```

## 🏗️ Initialization Patterns

### ❌ **WRONG - Race Conditions**

```typescript
// DON'T DO THIS - Not waiting for initialization
const brain = new Brainy()
const vfs = brain.vfs()

// ❌ Using VFS before it's ready
await vfs.writeFile('/file.txt', 'content')  // May fail!
```

### ✅ **CORRECT - Proper Initialization**

```typescript
// ✅ Pattern 1: Sequential initialization
async function initializeVFS() {
  const brain = new Brainy({
    storage: { type: 'filesystem', path: './data' }
  })

  // Wait for brain to be ready
  await brain.init()

  // Then initialize VFS
  const vfs = brain.vfs()
  await vfs.init()

  // Now safe to use
  return vfs
}

// ✅ Pattern 2: With error handling
async function robustVFSInit() {
  try {
    const brain = new Brainy()
    await brain.init()

    const vfs = brain.vfs()
    await vfs.init()

    // Verify it's working
    await vfs.stat('/')  // Should not throw

    return vfs
  } catch (error) {
    console.error('VFS initialization failed:', error)
    throw new Error(`Cannot initialize VFS: ${error.message}`)
  }
}

// ✅ Pattern 3: Singleton pattern for apps
class VFSManager {
  private static instance: any = null

  static async getInstance() {
    if (!this.instance) {
      const brain = new Brainy()
      await brain.init()
      this.instance = brain.vfs()
      await this.instance.init()
    }
    return this.instance
  }
}
```

## 📝 File Operation Patterns

### ❌ **WRONG - Blocking Operations**

```typescript
// DON'T DO THIS - Blocking the main thread
async function badFileProcessing(files: string[]) {
  for (const file of files) {
    const content = await vfs.readFile(file)  // ❌ Sequential
    await processContent(content)              // ❌ Blocking
    await vfs.writeFile(file + '.processed', result)
  }
}
```

### ✅ **CORRECT - Efficient Operations**

```typescript
// ✅ Pattern 1: Parallel processing
async function efficientProcessing(files: string[]) {
  const operations = files.map(async (file) => {
    try {
      const content = await vfs.readFile(file)
      const result = await processContent(content)
      await vfs.writeFile(file + '.processed', result)
      return { file, success: true }
    } catch (error) {
      return { file, success: false, error: error.message }
    }
  })

  return await Promise.allSettled(operations)
}

// ✅ Pattern 2: Batch operations with limits
async function batchProcessFiles(files: string[], batchSize = 10) {
  const results = []

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(file => processFile(file))
    )
    results.push(...batchResults)

    // Optional: Add delay between batches
    if (i + batchSize < files.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

// ✅ Pattern 3: Streaming for large files
async function streamLargeFile(filePath: string) {
  const stream = await vfs.createReadStream(filePath, {
    highWaterMark: 64 * 1024  // 64KB chunks
  })

  return new Promise((resolve, reject) => {
    let content = ''

    stream.on('data', (chunk) => {
      content += chunk.toString()
    })

    stream.on('end', () => resolve(content))
    stream.on('error', reject)
  })
}
```

## 🔗 Relationship Patterns

### ❌ **WRONG - Manual Relationship Tracking**

```typescript
// DON'T DO THIS - Reinventing the graph
const fileRelationships = new Map()  // ❌ Manual tracking

function linkFiles(sourceFile: string, targetFile: string, relationship: string) {
  if (!fileRelationships.has(sourceFile)) {
    fileRelationships.set(sourceFile, [])
  }
  fileRelationships.get(sourceFile).push({ target: targetFile, type: relationship })
}
```

### ✅ **CORRECT - Use Built-in Relationships**

```typescript
// ✅ Pattern 1: Semantic relationships
async function createFileRelationships() {
  // Link test to source file
  await vfs.addRelationship(
    '/src/auth.ts',
    '/tests/auth.test.ts',
    'tested-by'
  )

  // Link documentation to implementation
  await vfs.addRelationship(
    '/docs/api.md',
    '/src/api.ts',
    'documents'
  )

  // Link dependency relationships
  await vfs.addRelationship(
    '/src/index.ts',
    '/src/utils.ts',
    'imports'
  )
}

// ✅ Pattern 2: Query relationships
async function findRelatedFiles(filePath: string) {
  // Find all files related to this one
  const related = await vfs.getRelated(filePath, {
    depth: 2,                    // Include relationships of relationships
    types: ['tests', 'documents', 'imports'],  // Filter relationship types
    direction: 'both'            // Both incoming and outgoing
  })

  return related
}

// ✅ Pattern 3: Relationship-based search
async function findTestFiles(sourceFile: string) {
  return await vfs.search('', {
    connected: {
      to: sourceFile,
      via: 'tested-by',
      direction: 'incoming'
    }
  })
}
```

## 🚀 Performance Patterns

### ❌ **WRONG - Loading Everything**

```typescript
// DON'T DO THIS - Loading massive directories
async function loadEntireProject() {
  const allFiles = await vfs.getTreeStructure('/', {
    // ❌ No limits, could be millions of files
  })

  return allFiles  // ❌ Crashes on large projects
}
```

### ✅ **CORRECT - Smart Loading**

```typescript
// ✅ Pattern 1: Paginated loading
async function loadDirectoryPage(path: string, page = 0, size = 50) {
  const children = await vfs.getDirectChildren(path, {
    limit: size,
    offset: page * size,
    sort: 'name'
  })

  const total = await vfs.getChildrenCount(path)

  return {
    items: children,
    page,
    size,
    total,
    hasMore: (page + 1) * size < total
  }
}

// ✅ Pattern 2: Lazy loading with caching
class FileTreeCache {
  private cache = new Map()

  async getDirectory(path: string) {
    if (this.cache.has(path)) {
      return this.cache.get(path)
    }

    const children = await vfs.getDirectChildren(path)
    this.cache.set(path, children)

    // Auto-expire cache after 5 minutes
    setTimeout(() => this.cache.delete(path), 5 * 60 * 1000)

    return children
  }
}

// ✅ Pattern 3: Progressive disclosure
async function buildLazyTree(rootPath: string) {
  const tree = await vfs.getTreeStructure(rootPath, {
    maxDepth: 1,  // Only immediate children
    lazy: true    // Enable lazy loading for subdirectories
  })

  // Expand directories on demand
  tree.expandDirectory = async (path: string) => {
    const subtree = await vfs.getTreeStructure(path, {
      maxDepth: 1
    })
    return subtree.children
  }

  return tree
}
```

## 🔧 Error Handling Patterns

### ❌ **WRONG - Silent Failures**

```typescript
// DON'T DO THIS - Ignoring errors
async function badErrorHandling(path: string) {
  try {
    return await vfs.readFile(path)
  } catch (error) {
    return null  // ❌ Silent failure
  }
}
```

### ✅ **CORRECT - Robust Error Handling**

```typescript
// ✅ Pattern 1: Specific error handling
async function robustFileRead(path: string) {
  try {
    return await vfs.readFile(path)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${path}`)
    } else if (error.code === 'EACCES') {
      throw new Error(`Permission denied: ${path}`)
    } else if (error.code === 'EISDIR') {
      throw new Error(`Path is a directory, not a file: ${path}`)
    } else {
      throw new Error(`Failed to read ${path}: ${error.message}`)
    }
  }
}

// ✅ Pattern 2: Retry with backoff
async function resilientOperation(operation: () => Promise<any>, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))

      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
    }
  }
}

// ✅ Pattern 3: Graceful degradation
async function gracefulFileExplorer(path: string) {
  try {
    // Try the optimal method first
    return await vfs.getDirectChildren(path)
  } catch (error) {
    console.warn('Direct children failed, trying basic readdir:', error.message)

    try {
      // Fallback to basic directory listing
      const entries = await vfs.readdir(path)
      return entries.map(name => ({
        metadata: { name, path: `${path}/${name}` },
        // Missing detailed metadata, but functional
      }))
    } catch (fallbackError) {
      console.error('All methods failed:', fallbackError.message)
      return []  // Empty result rather than crash
    }
  }
}
```

## 📚 Integration Patterns

### ✅ **React Hook Pattern**

```typescript
function useVFS() {
  const [vfs, setVFS] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function initVFS() {
      try {
        const brain = new Brainy({
          storage: { type: 'filesystem', path: './brainy-data' }
        })
        await brain.init()

        const vfsInstance = brain.vfs()
        await vfsInstance.init()

        setVFS(vfsInstance)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    initVFS()
  }, [])

  return { vfs, loading, error }
}
```

### ✅ **Express.js Middleware Pattern**

```typescript
function vfsMiddleware() {
  let vfsInstance: any = null

  return async (req: any, res: any, next: any) => {
    if (!vfsInstance) {
      try {
        const brain = new Brainy()
        await brain.init()
        vfsInstance = brain.vfs()
        await vfsInstance.init()
      } catch (error) {
        return res.status(500).json({ error: 'VFS initialization failed' })
      }
    }

    req.vfs = vfsInstance
    next()
  }
}
```

## 🎯 Summary: Do This, Not That

| ❌ **Avoid These Patterns** | ✅ **Use These Instead** |
|---------------------------|------------------------|
| Manual tree filtering | `vfs.getDirectChildren()` |
| Memory storage for files | Filesystem or cloud storage |
| Sequential file operations | Parallel processing with limits |
| Manual relationship tracking | Built-in `vfs.addRelationship()` |
| Loading entire directories | Paginated/lazy loading |
| Silent error handling | Specific error types and fallbacks |
| Blocking synchronous calls | Async/await with proper error handling |

---

**🎉 Following these patterns will give you:**
- 🚫 **Zero infinite recursion** in file explorers
- ⚡ **Fast performance** even with large directories
- 🔄 **Reliable error recovery** and graceful degradation
- 🧠 **Semantic intelligence** for powerful file search
- 📈 **Scalable architecture** that grows with your needs

**Next Steps:** Check out the [VFS API Guide](./VFS_API_GUIDE.md) for complete method documentation.