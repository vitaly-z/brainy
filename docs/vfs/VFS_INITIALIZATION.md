# VFS Initialization Guide

## Quick Start

The Brainy VFS requires proper initialization before use. Here's the correct pattern:

```javascript
import { Brainy } from '@soulcraft/brainy'

// Step 1: Create and initialize Brainy
const brain = new Brainy({
  storage: { type: 'filesystem', path: './data' }
})
await brain.init()

// Step 2: Get VFS instance (it's a METHOD, not a property!)
const vfs = brain.vfs()  // ✅ Correct: method call with ()

// Step 3: Initialize VFS (THIS IS REQUIRED!)
await vfs.init()  // Creates the root directory

// Now you can use VFS
await vfs.writeFile('/test.txt', 'Hello World')
const files = await vfs.readdir('/')
```

## Common Mistakes

### ❌ Mistake 1: Accessing VFS as Property
```javascript
// WRONG - vfs is a method, not a property
const vfs = brain.vfs  // Missing parentheses!
```

### ❌ Mistake 2: Forgetting to Initialize VFS
```javascript
const vfs = brain.vfs()
// Missing: await vfs.init()
await vfs.writeFile('/test.txt', 'data')  // Error: VFS not initialized
```

### ❌ Mistake 3: Not Waiting for Initialization
```javascript
const vfs = brain.vfs()
vfs.init()  // Missing await!
await vfs.readdir('/')  // Error: VFS not initialized (init still running)
```

## Why Initialization is Required

The VFS `init()` method performs critical setup:

1. **Creates the root directory entity** in Brainy's graph database
2. **Initializes the PathResolver** for efficient path lookups
3. **Sets up caching layers** for performance
4. **Starts background tasks** for maintenance
5. **Configures storage adapters** based on your settings

Without initialization, the root directory (`/`) doesn't exist, which is why operations fail with "Not a directory: /" errors.

## Complete Example

```javascript
import { Brainy } from '@soulcraft/brainy'

async function setupVFS() {
  // Initialize Brainy
  const brain = new Brainy({
    storage: {
      type: 'filesystem',  // or 'memory', 's3', 'r2'
      path: './brainy-data'
    }
  })
  await brain.init()

  // Get and initialize VFS
  const vfs = brain.vfs()
  await vfs.init()

  // Verify initialization
  const rootExists = await vfs.exists('/')
  console.log('Root directory exists:', rootExists)  // true

  const stats = await vfs.stat('/')
  console.log('Root is directory:', stats.isDirectory())  // true

  // Now use VFS normally
  await vfs.writeFile('/readme.txt', 'Welcome to VFS!')
  await vfs.mkdir('/documents')

  const files = await vfs.readdir('/')
  console.log('Files in root:', files)  // ['readme.txt', 'documents']

  return vfs
}

setupVFS().catch(console.error)
```

## Error Messages

If you see this error:
```
VFS not initialized. You must call await vfs.init() after getting the VFS instance.
Example:
  const vfs = brain.vfs()  // Note: vfs() is a method, not a property
  await vfs.init()         // This creates the root directory
```

It means you forgot to initialize VFS. Follow the example in the error message.

## TypeScript Usage

```typescript
import { Brainy, VirtualFileSystem } from '@soulcraft/brainy'

class FileManager {
  private brain: Brainy
  private vfs: VirtualFileSystem | null = null

  async initialize(): Promise<void> {
    // Initialize Brainy
    this.brain = new Brainy({
      storage: { type: 'filesystem' }
    })
    await this.brain.init()

    // Initialize VFS
    this.vfs = this.brain.vfs()
    await this.vfs.init()
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.vfs) {
      throw new Error('FileManager not initialized. Call initialize() first.')
    }
    await this.vfs.writeFile(path, content)
  }
}
```

## Auto-Initialization Pattern (Optional)

If you want VFS to auto-initialize on first use:

```javascript
class AutoInitVFS {
  constructor(config) {
    this.brain = new Brainy(config)
    this.vfs = null
    this.initPromise = null
  }

  async ensureInit() {
    if (!this.initPromise) {
      this.initPromise = this._initialize()
    }
    await this.initPromise
  }

  async _initialize() {
    await this.brain.init()
    this.vfs = this.brain.vfs()
    await this.vfs.init()
  }

  // Wrap all VFS methods
  async writeFile(path, data) {
    await this.ensureInit()
    return this.vfs.writeFile(path, data)
  }

  async readdir(path) {
    await this.ensureInit()
    return this.vfs.readdir(path)
  }
}

// Usage - no explicit init needed
const vfs = new AutoInitVFS({ storage: { type: 'memory' } })
await vfs.writeFile('/test.txt', 'Auto-init works!')
```

## FAQ

### Q: Why doesn't VFS auto-initialize?
A: Explicit initialization gives you control over when the root directory is created and when background tasks start. This prevents unexpected side effects and makes the initialization cost visible.

### Q: Can I reinitialize VFS?
A: No, VFS can only be initialized once per instance. If you need to reset, create a new Brainy instance.

### Q: What happens if Brainy isn't initialized?
A: VFS initialization will fail. Always initialize Brainy first with `await brain.init()`.

### Q: Is the initialization pattern the same for all storage types?
A: Yes, whether using memory, filesystem, S3, or R2 storage, the initialization pattern is identical.

## Related Documentation

- [VFS Quick Start](./QUICK_START.md) - 5-minute setup guide
- [VFS API Guide](./VFS_API_GUIDE.md) - Complete API reference
- [Common Patterns](./COMMON_PATTERNS.md) - Best practices and patterns