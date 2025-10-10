# 🚀 VFS Quick Start: 5-Minute File Explorer Setup

> Get a working, production-ready file explorer with Brainy VFS in 5 minutes. Avoid common pitfalls and use the correct APIs.

## 📋 What You'll Build

A file explorer that:
- ✅ **Never crashes** from infinite recursion
- ✅ **Uses filesystem storage** correctly
- ✅ **Leverages semantic search** to find files by content
- ✅ **Handles large directories** efficiently
- ✅ **Follows modern Brainy v3.x APIs**

## ⚡ Step 1: Basic Setup (1 minute)

```bash
npm install @soulcraft/brainy
```

```typescript
import { Brainy } from '@soulcraft/brainy'

// ✅ CORRECT: Use filesystem storage for production
const brain = new Brainy({
  storage: {
    type: 'filesystem',
    path: './brainy-data'  // Your data directory
  }
})

await brain.init()

// ✅ CORRECT: Initialize VFS
const vfs = brain.vfs()
await vfs.init()

console.log('🎉 VFS ready!')
```

> **💡 Pro Tip**: Always use persistent storage (`filesystem`, `s3`, or `opfs`) for file explorers - your data persists across process restarts!

## 📁 Step 2: Safe Directory Listing (2 minutes)

**❌ WRONG - This causes infinite recursion:**
```typescript
// DON'T DO THIS - Causes directory to appear as its own child!
const badItems = allNodes.filter(node => node.path.startsWith(dirPath))
```

**✅ CORRECT - Use tree-aware methods:**
```typescript
// ✅ Method 1: Get direct children (recommended for UI)
async function loadDirectoryContents(path: string) {
  try {
    const children = await vfs.getDirectChildren(path)

    // Sort directories first, then files
    return children.sort((a, b) => {
      if (a.metadata.vfsType === 'directory' && b.metadata.vfsType === 'file') return -1
      if (a.metadata.vfsType === 'file' && b.metadata.vfsType === 'directory') return 1
      return a.metadata.name.localeCompare(b.metadata.name)
    })
  } catch (error) {
    console.error(`Failed to load ${path}:`, error.message)
    return []
  }
}

// ✅ Method 2: Get complete tree structure (for full trees)
async function loadFullTree(path: string) {
  const tree = await vfs.getTreeStructure(path, {
    maxDepth: 3,          // Prevent deep recursion
    includeHidden: false, // Skip hidden files
    sort: 'name'
  })
  return tree
}

// ✅ Method 3: Get detailed path info
async function inspectPath(path: string) {
  const info = await vfs.inspect(path)
  return {
    isDirectory: info.node.metadata.vfsType === 'directory',
    children: info.children,
    parent: info.parent,
    stats: info.stats
  }
}
```

## 🔍 Step 3: Add Semantic Search (1 minute)

```typescript
// ✅ Find files by content, not just filename
async function searchFiles(query: string, basePath: string = '/') {
  const results = await vfs.search(query, {
    path: basePath,     // Limit search to specific directory
    limit: 50,         // Reasonable limit
    type: 'file'       // Only search files, not directories
  })

  return results.map(result => ({
    path: result.path,
    score: result.score,
    type: result.type,
    size: result.size,
    modified: result.modified
  }))
}

// Example usage
const reactFiles = await searchFiles('React components with hooks', '/src')
const docs = await searchFiles('API documentation', '/docs')
```

## 🖥️ Step 4: Complete File Explorer Component (1 minute)

Here's a complete React component using the correct patterns:

```tsx
import React, { useState, useEffect } from 'react'
import { Brainy } from '@soulcraft/brainy'

export function FileExplorer() {
  const [vfs, setVfs] = useState(null)
  const [currentPath, setCurrentPath] = useState('/')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Initialize VFS
  useEffect(() => {
    async function initVFS() {
      const brain = new Brainy({
        storage: { type: 'filesystem', path: './brainy-data' }
      })
      await brain.init()

      const vfsInstance = brain.vfs()
      await vfsInstance.init()

      setVfs(vfsInstance)
      setLoading(false)
    }
    initVFS()
  }, [])

  // Load directory contents
  const loadDirectory = async (path: string) => {
    if (!vfs) return

    setLoading(true)
    try {
      // ✅ CORRECT: Use getDirectChildren to prevent recursion
      const children = await vfs.getDirectChildren(path)

      // Sort directories first
      const sorted = children.sort((a, b) => {
        if (a.metadata.vfsType === 'directory' && b.metadata.vfsType === 'file') return -1
        if (a.metadata.vfsType === 'file' && b.metadata.vfsType === 'directory') return 1
        return a.metadata.name.localeCompare(b.metadata.name)
      })

      setItems(sorted)
      setCurrentPath(path)
    } catch (error) {
      console.error('Failed to load directory:', error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  // Search files
  const handleSearch = async () => {
    if (!vfs || !searchQuery.trim()) {
      loadDirectory(currentPath)
      return
    }

    setLoading(true)
    try {
      const results = await vfs.search(searchQuery, {
        path: currentPath,
        limit: 100
      })
      setItems(results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (vfs) {
      loadDirectory('/')
    }
  }, [vfs])

  if (loading && !vfs) {
    return <div>Initializing VFS...</div>
  }

  return (
    <div className="file-explorer">
      {/* Search bar */}
      <div className="search-bar">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files by content..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch}>Search</button>
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); loadDirectory(currentPath) }}>
            Clear
          </button>
        )}
      </div>

      {/* Current path */}
      <div className="current-path">
        📁 {currentPath}
        {currentPath !== '/' && (
          <button onClick={() => loadDirectory(currentPath.split('/').slice(0, -1).join('/') || '/')}>
            ⬆️ Up
          </button>
        )}
      </div>

      {/* File list */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="file-list">
          {items.map((item) => (
            <div
              key={item.id}
              className={`file-item ${item.metadata.vfsType}`}
              onClick={() => {
                if (item.metadata.vfsType === 'directory') {
                  loadDirectory(item.metadata.path)
                } else {
                  console.log('Open file:', item.metadata.path)
                  // Add your file opening logic here
                }
              }}
            >
              <span className="icon">
                {item.metadata.vfsType === 'directory' ? '📁' : '📄'}
              </span>
              <span className="name">{item.metadata.name}</span>
              <span className="size">
                {item.metadata.size ? `${Math.round(item.metadata.size / 1024)}KB` : ''}
              </span>
            </div>
          ))}
          {items.length === 0 && (
            <div className="empty">
              {searchQuery ? 'No results found' : 'Empty directory'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

## 🎯 What We Just Avoided

By using this quick start, you avoided these common mistakes:

❌ **Infinite Recursion**: Using naive filtering that includes directories as their own children
❌ **Memory Storage**: Losing data when process restarts
❌ **Old APIs**: Using deprecated `addNoun`, `getNouns`, `addVerb` methods
❌ **Complex Fallbacks**: Implementing unnecessary fallback patterns when proper methods exist
❌ **Poor Performance**: Not using tree-aware methods designed for file explorers

## 🚀 Next Steps

Your file explorer is now working! Here's what to explore next:

1. **[File Operations](./VFS_API_GUIDE.md#file-operations)** - Read, write, and manipulate files
2. **[Semantic Features](./SEMANTIC_VFS.md)** - Multi-dimensional file access and neural extraction
3. **[Performance Optimization](./building-file-explorers.md#performance)** - Handle large directories efficiently
4. **[Advanced Search](./VFS_API_GUIDE.md#search-operations)** - Complex queries and filters

## 🆘 Common Issues & Solutions

### "Module not found" errors
```bash
# Make sure you're using the right import
npm ls @soulcraft/brainy  # Check version
npm install @soulcraft/brainy@latest  # Update if needed
```

### "VFS not initialized" errors
```typescript
// Always await both init() calls
await brain.init()
const vfs = brain.vfs()
await vfs.init()  // Don't forget this!
```

### Slow directory loading
```typescript
// Add pagination for large directories
const children = await vfs.getDirectChildren(path, {
  limit: 100,      // Load only first 100 items
  offset: 0        // Start from beginning
})
```

### Search not finding files
```typescript
// Make sure files are imported into VFS first
await vfs.importDirectory('./my-files', {
  recursive: true,
  extractMetadata: true  // Enable content understanding
})
```

---

**🎉 Congratulations!** You now have a working file explorer that uses modern Brainy APIs correctly. No more infinite recursion, no more deprecated methods, no more confusion.

**Need help?** Check out our [Complete VFS Guide](./VFS_API_GUIDE.md) or [Common Patterns](./COMMON_PATTERNS.md).