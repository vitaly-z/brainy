# Building File Explorers with Brainy VFS

## Overview

When building file explorers, tree views, or any UI that displays directory structures, it's critical to avoid common pitfalls that can lead to infinite recursion. This guide shows you how to safely build file explorers using Brainy VFS's tree-aware methods.

## ⚠️ The Self-Inclusion Problem

### What Goes Wrong

When building tree UIs, developers often make this mistake:

```typescript
// ❌ WRONG - Can cause infinite recursion!
function buildTree(allNodes, parentPath) {
  const children = allNodes.filter(node => {
    // This accidentally includes the parent itself!
    return node.path.startsWith(parentPath)
  })

  // If parentPath = '/dir', this includes '/dir' itself
  // Leading to: dir -> dir -> dir -> ... (infinite loop)
}
```

### Why It Happens

Directories are stored as nodes with paths like `/brainy-data`. When filtering for "children of `/brainy-data`", naive string matching will match the directory itself because:
- `/brainy-data` starts with `/brainy-data` ✓
- This causes the directory to appear as its own child
- UI frameworks then render infinitely nested directories

## ✅ The Solution: Use Tree-Aware Methods

Brainy VFS provides safe, tree-aware methods that prevent these issues:

### Method 1: Use `getDirectChildren()` (Recommended)

```typescript
import { Brainy, VirtualFileSystem } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()
const vfs = new VirtualFileSystem(brain)
await vfs.init()

// ✅ CORRECT - Returns only direct children, never the parent
const children = await vfs.getDirectChildren('/brainy-data')

// Build your UI with confidence
children.forEach(child => {
  console.log(child.metadata.name) // 'file.txt', 'subdir', etc.
  // child.metadata.path will NEVER be '/brainy-data' itself
})
```

### Method 2: Use `getTreeStructure()` for Complete Trees

```typescript
// ✅ Get a properly structured tree - no recursion possible
const tree = await vfs.getTreeStructure('/brainy-data', {
  maxDepth: 3,          // Limit depth for performance
  includeHidden: false, // Skip hidden files
  sort: 'name'          // Sort by name
})

// Tree is guaranteed to be valid:
// {
//   name: 'brainy-data',
//   path: '/brainy-data',
//   type: 'directory',
//   children: [
//     { name: 'file.txt', path: '/brainy-data/file.txt', type: 'file' },
//     { name: 'subdir', path: '/brainy-data/subdir', type: 'directory', children: [...] }
//   ]
// }
```

### Method 3: Use `inspect()` for Single-Level Details

```typescript
// ✅ Get comprehensive info about a path
const info = await vfs.inspect('/brainy-data/subdir')

// Returns:
// {
//   node: { ... },        // The directory itself
//   children: [ ... ],    // Direct children only
//   parent: { ... },      // Parent directory
//   stats: { ... }        // File statistics
// }
```

## Building a React File Explorer

Here's a complete example using React:

```tsx
import React, { useState, useEffect } from 'react'
import { VirtualFileSystem } from '@soulcraft/brainy'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

function FileExplorer({ vfs }: { vfs: VirtualFileSystem }) {
  const [tree, setTree] = useState<FileNode | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadTree()
  }, [])

  async function loadTree() {
    // ✅ Use getTreeStructure - guaranteed no recursion
    const treeData = await vfs.getTreeStructure('/', {
      maxDepth: 2,  // Initially load only 2 levels
      sort: 'name'
    })
    setTree(treeData)
  }

  async function toggleDirectory(path: string) {
    if (expanded.has(path)) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.delete(path)
        return next
      })
    } else {
      // Load children on demand
      const children = await vfs.getDirectChildren(path)

      // Update tree with new children
      // (Implementation depends on your state management)

      setExpanded(prev => new Set([...prev, path]))
    }
  }

  return <TreeView node={tree} onToggle={toggleDirectory} expanded={expanded} />
}

function TreeView({ node, onToggle, expanded }) {
  if (!node) return null

  const isExpanded = expanded.has(node.path)

  return (
    <div>
      <div onClick={() => node.type === 'directory' && onToggle(node.path)}>
        {node.type === 'directory' ? (isExpanded ? '📂' : '📁') : '📄'}
        {node.name}
      </div>
      {isExpanded && node.children && (
        <div style={{ paddingLeft: 20 }}>
          {node.children.map(child => (
            <TreeView
              key={child.path}
              node={child}
              onToggle={onToggle}
              expanded={expanded}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

## Manual Tree Building (If Needed)

If you must build trees manually from flat lists, use the `VFSTreeUtils`:

```typescript
import { VFSTreeUtils } from '@soulcraft/brainy/vfs'

// Get all entities somehow
const allEntities = await vfs.getDescendants('/root')

// ✅ Build safe tree structure - handles edge cases automatically
const tree = VFSTreeUtils.buildTree(allEntities, '/root', {
  maxDepth: 5,
  includeHidden: true,
  sort: 'modified'
})

// Validate the tree (optional but recommended)
const validation = VFSTreeUtils.validateTree(tree)
if (!validation.valid) {
  console.error('Tree has issues:', validation.errors)
}
```

## Common Patterns

### Pattern 1: Lazy Loading

```typescript
class LazyFileExplorer {
  private vfs: VirtualFileSystem
  private loadedPaths = new Set<string>()

  async getNode(path: string) {
    if (!this.loadedPaths.has(path)) {
      // Use inspect for single-node details
      const info = await this.vfs.inspect(path)
      this.loadedPaths.add(path)
      return info
    }
    // Return from cache...
  }

  async expandNode(path: string) {
    // Use getDirectChildren for lazy expansion
    const children = await this.vfs.getDirectChildren(path)
    return children
  }
}
```

### Pattern 2: Search Within Tree

```typescript
async function searchInDirectory(vfs: VirtualFileSystem, dirPath: string, query: string) {
  // Get all descendants efficiently
  const allFiles = await vfs.getDescendants(dirPath, {
    type: 'file'  // Only files, skip directories
  })

  // Filter by name
  return allFiles.filter(file =>
    file.metadata.name.toLowerCase().includes(query.toLowerCase())
  )
}
```

### Pattern 3: Calculate Directory Size

```typescript
async function getDirectorySize(vfs: VirtualFileSystem, dirPath: string) {
  const descendants = await vfs.getDescendants(dirPath, {
    type: 'file'  // Only count files
  })

  return descendants.reduce((total, file) =>
    total + (file.metadata.size || 0), 0
  )
}
```

## Testing Your File Explorer

Always test for the self-inclusion bug:

```typescript
import { expect } from 'vitest'

test('directory should not be its own child', async () => {
  const children = await vfs.getDirectChildren('/test-dir')

  // Critical assertion
  const selfIncluded = children.some(child =>
    child.metadata.path === '/test-dir'
  )
  expect(selfIncluded).toBe(false)
})

test('tree should have no cycles', async () => {
  const tree = await vfs.getTreeStructure('/test-dir')
  const validation = VFSTreeUtils.validateTree(tree)

  expect(validation.valid).toBe(true)
  expect(validation.errors).toHaveLength(0)
})
```

## Performance Tips

1. **Use `maxDepth`** - Don't load entire trees at once
2. **Implement virtual scrolling** for large directories
3. **Cache tree structures** when possible
4. **Use `getDirectChildren()` for on-demand loading**
5. **Batch VFS operations** when building initial views

## Migration Guide

If you have existing code with the recursion bug:

```typescript
// ❌ OLD CODE (buggy)
const children = allItems.filter(item => {
  const itemParent = getParentPath(item.path)
  return itemParent === dirPath  // Might include dirPath itself!
})

// ✅ NEW CODE (safe)
const children = await vfs.getDirectChildren(dirPath)
// That's it! No filtering needed, no edge cases to handle
```

## API Reference

### Tree-Safe Methods

- `getDirectChildren(path)` - Returns immediate children only
- `getTreeStructure(path, options)` - Returns complete tree object
- `getDescendants(path, options)` - Returns all descendants (flat)
- `inspect(path)` - Returns node with children, parent, and stats

### Utility Functions

- `VFSTreeUtils.buildTree(entities, root, options)` - Build tree from flat list
- `VFSTreeUtils.validateTree(tree)` - Check for cycles and errors
- `VFSTreeUtils.getTreeStats(tree)` - Calculate statistics
- `VFSTreeUtils.getDirectChildren(entities, parent)` - Filter safely

## Summary

- **Never** filter children by simple string matching on paths
- **Always** use VFS's tree-aware methods (`getDirectChildren`, `getTreeStructure`, etc.)
- **Test** for self-inclusion and cycles
- **Validate** trees when building manually

By following these guidelines, you'll build robust file explorers that never experience infinite recursion issues.