# Creating Custom Format Handlers

**Version:** 5.2.0+

Format handlers enable you to import ANY file type into Brainy as structured knowledge graph data. This guide shows how to create custom format handlers for your specific file formats.

---

## Quick Start

```typescript
import { BaseFormatHandler, globalHandlerRegistry } from '@soulcraft/brainy/augmentations/intelligentImport'
import type { FormatHandlerOptions, ProcessedData } from '@soulcraft/brainy/augmentations/intelligentImport'

class MyFormatHandler extends BaseFormatHandler {
  readonly format = 'myformat'

  canHandle(data: Buffer | string | { filename?: string; ext?: string }): boolean {
    // Option 1: Check by MIME type
    if (typeof data === 'object' && 'filename' in data) {
      const mimeType = this.getMimeType(data)
      return this.mimeTypeMatches(mimeType, ['application/x-myformat'])
    }

    // Option 2: Check by magic bytes
    if (Buffer.isBuffer(data)) {
      return data[0] === 0x4D && data[1] === 0x59 // "MY" magic bytes
    }

    return false
  }

  async process(
    data: Buffer | string,
    options: FormatHandlerOptions
  ): Promise<ProcessedData> {
    // Convert to Buffer
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

    // Parse your format
    const parsed = this.parseMyFormat(buffer)

    // Return structured data
    return {
      format: 'myformat',
      data: [
        {
          type: 'MyEntity',
          name: parsed.name,
          metadata: parsed.metadata
        }
      ],
      metadata: {
        rowCount: 1,
        fields: ['type', 'name', 'metadata'],
        processingTime: Date.now() - startTime
      }
    }
  }

  private parseMyFormat(buffer: Buffer): any {
    // Your parsing logic here
    return { name: 'example', metadata: {} }
  }
}

// Register globally
globalHandlerRegistry.registerHandler({
  name: 'myformat',
  mimeTypes: ['application/x-myformat'],
  extensions: ['.myf', '.myfmt'],
  loader: async () => new MyFormatHandler()
})
```

Now Brainy automatically handles your format:

```typescript
await brain.import({
  type: 'file',
  data: myFormatBuffer,
  filename: 'data.myf'
})
// Automatically routes to MyFormatHandler!
```

---

## BaseFormatHandler

All format handlers should extend `BaseFormatHandler`, which provides:

### MIME Type Detection

```typescript
protected getMimeType(data: Buffer | string | { filename?: string }): string
```

Detects MIME type from filename or buffer. Uses Brainy's comprehensive MIME detection (2000+ types).

**Example:**
```typescript
const mimeType = this.getMimeType({ filename: 'data.dwg' })
// Returns: 'image/vnd.dwg'
```

### MIME Type Matching

```typescript
protected mimeTypeMatches(mimeType: string, patterns: string[]): boolean
```

Checks if MIME type matches patterns. Supports wildcards (`image/*`).

**Example:**
```typescript
if (this.mimeTypeMatches(mimeType, ['image/*', 'video/*'])) {
  // Handle all images and videos
}
```

### Extension Detection

```typescript
protected detectExtension(data: string | Buffer | { filename?: string; ext?: string }): string | null
```

Extracts file extension for fallback detection.

---

## canHandle() Method

The `canHandle()` method determines if your handler can process the given data.

### Strategy 1: MIME Type Detection (Recommended)

```typescript
canHandle(data: Buffer | string | { filename?: string; ext?: string }): boolean {
  if (typeof data === 'object' && 'filename' in data) {
    const mimeType = this.getMimeType(data)
    return this.mimeTypeMatches(mimeType, [
      'application/x-myformat',
      'application/myformat'
    ])
  }
  return false
}
```

✅ **Pros:** Automatic, comprehensive, works with 2000+ types
❌ **Cons:** Requires filename

### Strategy 2: Magic Byte Detection

```typescript
canHandle(data: Buffer | string | { filename?: string; ext?: string }): boolean {
  if (Buffer.isBuffer(data)) {
    // Check magic bytes
    return (
      data[0] === 0x50 &&  // 'P'
      data[1] === 0x4B &&  // 'K'
      data[2] === 0x03 &&
      data[3] === 0x04     // ZIP signature
    )
  }
  return false
}
```

✅ **Pros:** Works without filename, robust
❌ **Cons:** Requires knowledge of format structure

### Strategy 3: Combined Approach

```typescript
canHandle(data: Buffer | string | { filename?: string; ext?: string }): boolean {
  // Try MIME type first
  if (typeof data === 'object' && 'filename' in data) {
    const mimeType = this.getMimeType(data)
    if (this.mimeTypeMatches(mimeType, ['application/x-myformat'])) {
      return true
    }
  }

  // Fallback to magic bytes
  if (Buffer.isBuffer(data)) {
    return this.checkMagicBytes(data)
  }

  return false
}
```

✅ **Pros:** Robust, works in all scenarios
❌ **Cons:** More complex

---

## process() Method

The `process()` method extracts structured data from the file.

### Return Format

```typescript
interface ProcessedData {
  /** Format identifier */
  format: string

  /** Array of extracted entities */
  data: Array<Record<string, any>>

  /** Metadata about processing */
  metadata: {
    rowCount: number
    fields: string[]
    processingTime: number
    [key: string]: any
  }

  /** Original filename (optional) */
  filename?: string
}
```

### Example: CAD File Handler

```typescript
async process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData> {
  const startTime = Date.now()
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

  // Parse CAD file
  const cad = await this.parseCAD(buffer)

  // Extract entities
  const entities = []

  // Main CAD document
  entities.push({
    type: 'CADDocument',
    filename: options.filename,
    units: cad.units,
    bounds: cad.bounds
  })

  // Layers
  for (const layer of cad.layers) {
    entities.push({
      type: 'CADLayer',
      name: layer.name,
      color: layer.color,
      visible: layer.visible,
      objectCount: layer.objects.length
    })
  }

  // Objects
  for (const obj of cad.objects) {
    entities.push({
      type: 'CADObject',
      objectType: obj.type,
      layer: obj.layer,
      geometry: obj.geometry,
      properties: obj.properties
    })
  }

  return {
    format: 'cad',
    data: entities,
    metadata: {
      rowCount: entities.length,
      fields: ['type', 'name', 'geometry', 'properties'],
      processingTime: Date.now() - startTime,
      layerCount: cad.layers.length,
      objectCount: cad.objects.length,
      units: cad.units
    },
    filename: options.filename
  }
}
```

### Best Practices

1. **Always track processing time:**
   ```typescript
   const startTime = Date.now()
   // ... processing ...
   metadata.processingTime = Date.now() - startTime
   ```

2. **Include rich metadata:**
   ```typescript
   metadata: {
     rowCount: entities.length,
     fields: ['type', 'name', ...],
     processingTime: 123,
     // Format-specific metadata
     layerCount: 5,
     objectCount: 150,
     version: '2.0'
   }
   ```

3. **Handle errors gracefully:**
   ```typescript
   try {
     const parsed = this.parse(buffer)
     return { format: 'myformat', data: parsed, ... }
   } catch (error) {
     throw new Error(
       `Failed to parse myformat: ${error instanceof Error ? error.message : String(error)}`
     )
   }
   ```

4. **Support progress reporting (optional):**
   ```typescript
   if (options.progressHooks?.onCurrentItem) {
     options.progressHooks.onCurrentItem(`Processing layer ${i}/${total}`)
   }
   ```

---

## FormatHandlerRegistry

### Global Registry

Use the global registry for application-wide handlers:

```typescript
import { globalHandlerRegistry } from '@soulcraft/brainy/augmentations/intelligentImport'

globalHandlerRegistry.registerHandler({
  name: 'myformat',
  mimeTypes: ['application/x-myformat'],
  extensions: ['.myf'],
  loader: async () => new MyFormatHandler()
})
```

### Local Registry

Create a local registry for scoped handlers:

```typescript
import { FormatHandlerRegistry } from '@soulcraft/brainy/augmentations/intelligentImport'

const registry = new FormatHandlerRegistry()
registry.registerHandler({ ... })
```

### Lazy Loading

Handlers are lazy-loaded for performance:

```typescript
globalHandlerRegistry.registerHandler({
  name: 'heavy',
  mimeTypes: ['application/x-heavy'],
  extensions: ['.heavy'],
  loader: async () => {
    // Only loaded when first needed
    const { HeavyHandler } = await import('./HeavyHandler.js')
    return new HeavyHandler()
  }
})
```

### Getting Handlers

```typescript
// By filename (automatic MIME detection)
const handler = await registry.getHandler('data.myf')

// By MIME type
const handler = await registry.getHandlerByMimeType('application/x-myformat')

// By extension
const handler = await registry.getHandlerByExtension('.myf')

// By name
const handler = await registry.getHandlerByName('myformat')
```

---

## Real-World Examples

### Example 1: Video Metadata Extractor

```typescript
import { BaseFormatHandler } from '@soulcraft/brainy/augmentations/intelligentImport'
import ffmpeg from 'fluent-ffmpeg'

class VideoHandler extends BaseFormatHandler {
  readonly format = 'video'

  canHandle(data) {
    const mimeType = this.getMimeType(data)
    return this.mimeTypeMatches(mimeType, ['video/*'])
  }

  async process(data, options) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

    // Extract video metadata with ffmpeg
    const metadata = await this.extractVideoMetadata(buffer)

    return {
      format: 'video',
      data: [{
        type: 'Video',
        duration: metadata.duration,
        codec: metadata.codec,
        resolution: metadata.resolution,
        frameRate: metadata.frameRate,
        bitrate: metadata.bitrate,
        audioTracks: metadata.audioTracks,
        subtitles: metadata.subtitles
      }],
      metadata: {
        rowCount: 1,
        fields: ['type', 'duration', 'codec', 'resolution'],
        processingTime: metadata.processingTime
      }
    }
  }

  private async extractVideoMetadata(buffer: Buffer) {
    // Use ffmpeg to extract metadata
    return new Promise((resolve, reject) => {
      ffmpeg(buffer)
        .ffprobe((err, data) => {
          if (err) reject(err)
          else resolve(this.parseFFmpegOutput(data))
        })
    })
  }
}
```

### Example 2: Git Repository Parser

```typescript
import { BaseFormatHandler } from '@soulcraft/brainy/augmentations/intelligentImport'
import { simpleGit } from 'simple-git'

class GitRepoHandler extends BaseFormatHandler {
  readonly format = 'git-repo'

  canHandle(data) {
    // Check for .git directory
    if (typeof data === 'object' && 'filename' in data) {
      return data.filename?.includes('.git') || false
    }
    return false
  }

  async process(data, options) {
    const repoPath = options.filename || ''
    const git = simpleGit(repoPath)

    // Extract commits
    const log = await git.log()
    const commits = log.all.map(commit => ({
      type: 'GitCommit',
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      date: commit.date
    }))

    // Extract branches
    const branchSummary = await git.branchLocal()
    const branches = Object.keys(branchSummary.branches).map(name => ({
      type: 'GitBranch',
      name,
      current: branchSummary.current === name
    }))

    return {
      format: 'git-repo',
      data: [...commits, ...branches],
      metadata: {
        rowCount: commits.length + branches.length,
        fields: ['type', 'hash', 'message', 'author'],
        processingTime: Date.now() - startTime,
        commitCount: commits.length,
        branchCount: branches.length
      }
    }
  }
}
```

### Example 3: Database Schema Importer

```typescript
import { BaseFormatHandler } from '@soulcraft/brainy/augmentations/intelligentImport'
import { Client } from 'pg'

class PostgreSQLSchemaHandler extends BaseFormatHandler {
  readonly format = 'postgres-schema'

  canHandle(data) {
    if (typeof data === 'object' && 'filename' in data) {
      return data.filename?.endsWith('.sql') || false
    }
    return false
  }

  async process(data, options) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
    const sql = buffer.toString('utf-8')

    // Parse SQL or connect to database
    const schema = await this.parseSchema(sql)

    const entities = []

    // Tables
    for (const table of schema.tables) {
      entities.push({
        type: 'Table',
        name: table.name,
        schema: table.schema,
        columnCount: table.columns.length
      })

      // Columns
      for (const column of table.columns) {
        entities.push({
          type: 'Column',
          name: column.name,
          table: table.name,
          dataType: column.dataType,
          nullable: column.nullable,
          primaryKey: column.primaryKey
        })
      }
    }

    // Foreign keys
    for (const fk of schema.foreignKeys) {
      entities.push({
        type: 'ForeignKey',
        from: `${fk.fromTable}.${fk.fromColumn}`,
        to: `${fk.toTable}.${fk.toColumn}`
      })
    }

    return {
      format: 'postgres-schema',
      data: entities,
      metadata: {
        rowCount: entities.length,
        fields: ['type', 'name', 'table', 'dataType'],
        processingTime: Date.now() - startTime,
        tableCount: schema.tables.length,
        columnCount: schema.tables.reduce((sum, t) => sum + t.columns.length, 0),
        foreignKeyCount: schema.foreignKeys.length
      }
    }
  }
}
```

---

## Creating Premium Augmentations

Package your handler as a premium augmentation:

```typescript
// @yourcompany/brainy-cad-importer

import { BaseAugmentation } from '@soulcraft/brainy'
import { CADHandler } from './CADHandler.js'

export class CADImportAugmentation extends BaseAugmentation {
  readonly name = 'cad-import'
  readonly timing = 'before'
  readonly operations = ['import', 'importFile']

  private handler: CADHandler

  constructor(config = {}) {
    super(config)
    this.handler = new CADHandler()
  }

  async execute(operation, params, next) {
    // Check if this is a CAD file
    if (this.isCADFile(params)) {
      const processed = await this.handler.process(params.data, params.options)
      params.data = processed.data
      params.metadata = { ...params.metadata, ...processed.metadata }
    }

    return next()
  }

  private isCADFile(params: any): boolean {
    return this.handler.canHandle(params.data || params)
  }
}

// Usage:
// npm install @yourcompany/brainy-cad-importer
// brain.addAugmentation(new CADImportAugmentation())
```

---

## Testing

```typescript
import { describe, it, expect } from 'vitest'
import { MyFormatHandler } from './MyFormatHandler.js'

describe('MyFormatHandler', () => {
  let handler: MyFormatHandler

  beforeEach(() => {
    handler = new MyFormatHandler()
  })

  describe('canHandle', () => {
    it('should handle .myf files', () => {
      expect(handler.canHandle({ filename: 'data.myf' })).toBe(true)
    })

    it('should handle by MIME type', () => {
      expect(handler.canHandle({ filename: 'data.myformat' })).toBe(true)
    })

    it('should reject non-myformat files', () => {
      expect(handler.canHandle({ filename: 'data.txt' })).toBe(false)
    })
  })

  describe('process', () => {
    it('should extract structured data', async () => {
      const testData = Buffer.from('MY format data')

      const result = await handler.process(testData)

      expect(result.format).toBe('myformat')
      expect(result.data).toHaveLength(1)
      expect(result.metadata.processingTime).toBeGreaterThan(0)
    })

    it('should handle errors gracefully', async () => {
      const invalidData = Buffer.from('invalid')

      await expect(handler.process(invalidData)).rejects.toThrow()
    })
  })
})
```

---

## Best Practices

1. **Always extend BaseFormatHandler** - provides MIME detection and utilities
2. **Use MIME types for routing** - automatic, comprehensive, maintainable
3. **Lazy load heavy dependencies** - better performance
4. **Extract rich metadata** - make data queryable in knowledge graph
5. **Handle errors gracefully** - fail fast with clear error messages
6. **Test thoroughly** - test canHandle() and process() with real data
7. **Document your format** - explain what data is extracted and how
8. **Follow ProcessedData format** - ensures compatibility with Brainy

---

## See Also

- [ImageHandler source](../../src/augmentations/intelligentImport/handlers/imageHandler.ts) - Reference implementation
- [BaseFormatHandler source](../../src/augmentations/intelligentImport/handlers/base.ts) - Base class
- [FormatHandlerRegistry source](../../src/augmentations/intelligentImport/FormatHandlerRegistry.ts) - Registry implementation
- [Augmentations Guide](./AUGMENTATIONS.md) - Creating augmentations
