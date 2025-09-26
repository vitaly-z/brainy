# VFS Troubleshooting Guide

## Common Issues and Solutions

### Issue: "VFSError: Not a directory: /"

**Symptoms:**
- `readdir('/')` throws "Not a directory" error
- Root directory exists but isn't recognized as directory
- Files can be written but not listed

**Root Cause:**
The root directory entity exists but doesn't have the proper metadata structure.

**Solution (v3.15.0+):**
This issue has been fixed in v3.15.0. The VFS now:
1. Ensures root directory has `vfsType: 'directory'` metadata
2. Adds compatibility layer for entities with malformed metadata
3. Automatically repairs metadata on entity retrieval

**Manual Fix (if needed):**
```javascript
// Force re-initialization of root directory
await vfs.init()  // Will repair root if needed

// Or manually update root entity
const rootId = vfs.rootEntityId
await brain.update({
  id: rootId,
  metadata: {
    path: '/',
    vfsType: 'directory',
    // ... other metadata
  }
})
```

---

### Issue: "readdir() returns empty array despite files existing"

**Symptoms:**
- Files are successfully written to VFS
- Files can be read individually
- `readdir()` returns `[]` for directories with files

**Root Cause:**
Contains relationships are missing between parent directories and files.

**Solution (v3.15.0+):**
This issue has been fixed. The VFS now:
1. Creates Contains relationships when writing new files
2. Ensures Contains relationships exist when updating files
3. Repairs missing relationships automatically

**Manual Fix (if needed):**
```javascript
// Repair missing Contains relationship
const parentId = await vfs.resolvePath('/directory')
const fileId = await vfs.resolvePath('/directory/file.txt')

await brain.relate({
  from: parentId,
  to: fileId,
  type: VerbType.Contains
})
```

---

### Issue: "VFS not initialized" error

**Symptoms:**
- Any VFS operation throws "VFS not initialized"
- Operations fail even after creating VFS instance

**Root Cause:**
The VFS `init()` method wasn't called after getting the VFS instance.

**Solution:**
```javascript
// ✅ CORRECT
const vfs = brain.vfs()  // Get instance
await vfs.init()         // Initialize (REQUIRED!)

// ❌ WRONG
const vfs = brain.vfs()
// Missing: await vfs.init()
```

---

### Issue: Files disappear after process restart

**Symptoms:**
- Files exist during session
- All files gone after restart
- Fresh VFS each time

**Root Cause:**
Using in-memory storage instead of persistent storage.

**Solution:**
```javascript
// ✅ Use persistent storage
const brain = new Brainy({
  storage: {
    type: 'filesystem',  // Persistent
    path: './brainy-data'
  }
})

// ❌ Don't use memory for production
const brain = new Brainy({
  storage: { type: 'memory' }  // Data lost on restart!
})
```

---

### Issue: Infinite recursion when listing directories

**Symptoms:**
- Directory appears as its own child
- Stack overflow errors
- UI freezes

**Root Cause:**
Using path-based filtering instead of graph relationships.

**Solution:**
```javascript
// ✅ CORRECT - Use graph relationships
const children = await vfs.getDirectChildren('/directory')

// ❌ WRONG - Path prefix matching causes recursion
const allNodes = await brain.find({})
const children = allNodes.filter(n =>
  n.metadata.path.startsWith('/directory/'))  // Directory matches itself!
```

---

### Issue: Can't find files by content

**Symptoms:**
- Semantic search returns no results
- Only exact filename matches work

**Root Cause:**
Files aren't being properly embedded or indexed.

**Solution:**
```javascript
// Ensure files have content for embedding
await vfs.writeFile('/doc.txt', 'Actual content here')  // Not empty!

// Use semantic search correctly
const results = await vfs.search('machine learning', {
  path: '/documents',  // Search within path
  limit: 10,
  type: 'file'
})
```

---

## Debugging Tips

### 1. Check VFS Initialization
```javascript
console.log('VFS initialized:', vfs.initialized)
console.log('Root entity ID:', vfs.rootEntityId)
```

### 2. Verify Entity Metadata
```javascript
const entity = await vfs.getEntity('/path/to/file')
console.log('Entity metadata:', entity.metadata)
console.log('VFS type:', entity.metadata.vfsType)
```

### 3. Check Relationships
```javascript
const parentId = await vfs.resolvePath('/directory')
const relations = await brain.getRelations({
  from: parentId,
  type: VerbType.Contains
})
console.log('Child count:', relations.length)
```

### 4. Enable Debug Logging
```javascript
const brain = new Brainy({
  storage: { type: 'filesystem' },
  logger: {
    level: 'debug',
    enabled: true
  }
})
```

---

## Performance Tips

### 1. Use Caching
```javascript
// Enable caching in VFS config
const vfs = brain.vfs({
  cache: {
    enabled: true,
    ttl: 300000,  // 5 minutes
    maxSize: 1000
  }
})
```

### 2. Batch Operations
```javascript
// Write multiple files efficiently
const files = [
  { path: '/file1.txt', content: 'content1' },
  { path: '/file2.txt', content: 'content2' }
]

await Promise.all(
  files.map(f => vfs.writeFile(f.path, f.content))
)
```

### 3. Limit Directory Depth
```javascript
// Don't traverse too deep
const tree = await vfs.getTreeStructure('/', {
  maxDepth: 3,  // Limit recursion
  includeHidden: false
})
```

---

## Getting Help

If you encounter issues not covered here:

1. Check the [VFS API Guide](./VFS_API_GUIDE.md)
2. Review [VFS Examples](./VFS_EXAMPLES_SCENARIOS.md)
3. Look at [test files](../../tests/vfs/) for working examples
4. Report issues at [GitHub Issues](https://github.com/soulcraftlabs/brainy/issues)

Remember: Most VFS issues are related to:
- Missing initialization (`await vfs.init()`)
- Using memory storage instead of filesystem
- Missing Contains relationships
- Incorrect path handling