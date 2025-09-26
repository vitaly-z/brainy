# VFS Graph Type Usage Guide

## Standard Type System

The Brainy VFS uses Brainy's standard graph type system for all entities and relationships. This ensures compatibility with the broader Brainy ecosystem and enables powerful cross-domain queries.

## Entity Types (NounType)

### Directory Entities
- **Type:** `NounType.Collection`
- **Purpose:** Represents directories/folders that contain other entities
- **Metadata:** Includes `vfsType: 'directory'` for VFS-specific operations

```javascript
// Directories are created as Collections
await brain.add({
  type: NounType.Collection,
  metadata: {
    path: '/documents',
    vfsType: 'directory',
    // ... other metadata
  }
})
```

### File Entities

The VFS intelligently selects the appropriate NounType based on file content:

- **`NounType.Document`** - Text files, JSON, source code, markdown
- **`NounType.Media`** - Images, videos, audio files
- **`NounType.File`** - Generic/binary files

```javascript
// Automatic type selection based on MIME type
function getFileNounType(mimeType) {
  if (mimeType.startsWith('text/') || mimeType.includes('json')) {
    return NounType.Document
  }
  if (mimeType.startsWith('image/') ||
      mimeType.startsWith('video/') ||
      mimeType.startsWith('audio/')) {
    return NounType.Media
  }
  return NounType.File
}
```

## Relationship Types (VerbType)

### Core VFS Relationships

#### Parent-Child Structure
- **Type:** `VerbType.Contains`
- **Direction:** Parent → Child
- **Purpose:** Represents the hierarchical file system structure

```javascript
// Creating directory structure
await brain.relate({
  from: parentDirectoryId,
  to: childFileOrDirectoryId,
  type: VerbType.Contains
})
```

#### Custom File Relationships

You can add custom relationships between files using any VerbType:

```javascript
// Document references another
await vfs.addRelationship('/doc1.md', '/doc2.md', VerbType.References)

// Code file depends on library
await vfs.addRelationship('/app.js', '/lib/utils.js', VerbType.DependsOn)

// Image derived from original
await vfs.addRelationship('/edited.jpg', '/original.jpg', VerbType.DerivedFrom)
```

## VFS-Specific Metadata

While using standard graph types, VFS adds domain-specific metadata for efficient file operations:

```javascript
{
  // Standard Brainy fields
  type: NounType.Document,  // Standard noun type

  // VFS-specific metadata
  metadata: {
    path: '/documents/report.pdf',
    name: 'report.pdf',
    vfsType: 'file',  // VFS-specific: 'file' or 'directory'
    size: 1024000,
    mimeType: 'application/pdf',
    permissions: 0o644,
    owner: 'user',
    group: 'users',
    accessed: Date.now(),
    modified: Date.now(),
    // ... custom metadata
  }
}
```

## Benefits of Standard Types

### 1. Cross-Domain Queries
```javascript
// Find all documents (including VFS files) about "machine learning"
const results = await brain.search('machine learning', {
  where: { type: NounType.Document }
})
```

### 2. Graph Traversal
```javascript
// Find all entities contained in a directory
const contained = await brain.getRelations({
  from: directoryId,
  type: VerbType.Contains
})

// Find what contains a file (parent directories)
const parents = await brain.getRelations({
  to: fileId,
  type: VerbType.Contains
})
```

### 3. Semantic Understanding
```javascript
// Files are automatically embedded based on their content type
// Documents get text embeddings
// Media files get metadata embeddings
// This enables semantic search across all file types
```

## Best Practices

### DO:
✅ Use `NounType.Collection` for directories
✅ Use appropriate file NounTypes based on content
✅ Use `VerbType.Contains` for parent-child relationships
✅ Add custom relationships with standard VerbTypes
✅ Include `vfsType` metadata for VFS operations

### DON'T:
❌ Use string literals for types (use enums)
❌ Create custom noun/verb types for VFS
❌ Mix graph relationships with metadata-only queries
❌ Forget to create Contains relationships

## Example: Complete File Creation

```javascript
// Creating a file with proper types
const fileEntity = await brain.add({
  type: NounType.Document,  // Standard noun type
  data: 'File content for embeddings',
  metadata: {
    path: '/docs/guide.md',
    vfsType: 'file',  // VFS-specific metadata
    mimeType: 'text/markdown',
    size: Buffer.byteLength('File content for embeddings')
  }
})

// Create Contains relationship with parent
await brain.relate({
  from: parentDirectoryId,
  to: fileEntity.id,
  type: VerbType.Contains  // Standard verb type
})
```

## Migration from Legacy Code

If you have legacy code using strings for types:

```javascript
// ❌ OLD (strings)
await brain.relate({
  type: 'contains'  // Wrong!
})

// ✅ NEW (enums)
await brain.relate({
  type: VerbType.Contains  // Correct!
})
```

Always import and use the type enums:

```javascript
import { NounType, VerbType } from '@soulcraft/brainy'
```