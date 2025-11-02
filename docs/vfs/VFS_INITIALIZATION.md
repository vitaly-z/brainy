# VFS Initialization Guide (v5.1.0+)

## Quick Start

The Brainy VFS is automatically initialized during `brain.init()`. No separate initialization needed!

```javascript
import { Brainy } from '@soulcraft/brainy'

// Create and initialize Brainy
const brain = new Brainy({
  storage: { type: 'filesystem', path: './data' }
})
await brain.init()  // VFS is auto-initialized here!

// Use VFS immediately - it's a property, not a method!
await brain.vfs.writeFile('/test.txt', 'Hello World')
const files = await brain.vfs.readdir('/')
```

## What Changed in v5.1.0?

### Before (v4.x and early v5.0.0):
```javascript
const brain = new Brainy(...)
await brain.init()

const vfs = brain.vfs()     // ❌ Method call
await vfs.init()             // ❌ Separate initialization
await vfs.writeFile(...)
```

### After (v5.1.0+):
```javascript
const brain = new Brainy(...)
await brain.init()           // VFS auto-initialized!

await brain.vfs.writeFile(...)  // ✅ Property access, just works!
```

### Key Changes:
1. **`vfs()` → `vfs`**: Method call becomes property access
2. **Auto-initialization**: VFS initialized during `brain.init()`
3. **Zero complexity**: No separate `vfs.init()` call needed
4. **Consistent pattern**: VFS treated like any other brain API

## Migration from v4.x/v5.0.0

### Old Pattern (DEPRECATED):
```javascript
const vfs = brain.vfs()
await vfs.init()
await vfs.writeFile('/test.txt', 'data')
```

### New Pattern (v5.1.0+):
```javascript
// Just remove the () and init() call
await brain.vfs.writeFile('/test.txt', 'data')
```

## Why Auto-Initialization?

VFS stores files as entities and relationships in the same graph as everything else. There's no reason to treat it differently! Auto-initialization:

- ✅ **Simpler API**: One less step to remember
- ✅ **Fewer errors**: Can't forget to initialize
- ✅ **More intuitive**: Property access feels natural
- ✅ **Consistent**: Matches how other brain APIs work

## Complete Example

```javascript
import { Brainy } from '@soulcraft/brainy'

async function useVFS() {
  // Initialize Brainy
  const brain = new Brainy({
    storage: {
      type: 'filesystem',  // or 'memory', 's3', 'r2'
      path: './brainy-data'
    }
  })
  await brain.init()  // VFS ready after this!

  // Use VFS immediately
  await brain.vfs.writeFile('/readme.txt', 'Welcome to VFS!')
  await brain.vfs.mkdir('/documents')

  const files = await brain.vfs.readdir('/')
  console.log('Files in root:', files.map(f => f.name))

  const content = await brain.vfs.readFile('/readme.txt')
  console.log('File content:', content.toString())
}

useVFS().catch(console.error)
```

## TypeScript Usage

```typescript
import { Brainy, VirtualFileSystem } from '@soulcraft/brainy'

class FileManager {
  private brain: Brainy

  async initialize(): Promise<void> {
    this.brain = new Brainy({
      storage: { type: 'filesystem' }
    })
    await this.brain.init()
    // VFS is ready! No separate initialization needed
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.brain) {
      throw new Error('FileManager not initialized. Call initialize() first.')
    }
    // Use VFS as property
    await this.brain.vfs.writeFile(path, content)
  }

  async listFiles(path: string): Promise<string[]> {
    const entries = await this.brain.vfs.readdir(path)
    return entries.map(e => e.name)
  }
}
```

## Error Messages

If you see this error:
```
Brainy not initialized. Call init() first.
```

It means you tried to use VFS before calling `brain.init()`. Always initialize Brainy first:

```javascript
await brain.init()  // Required!
await brain.vfs.writeFile(...)  // Now this works
```

## Fork Support (v5.0.0+)

VFS works seamlessly with Brainy's Copy-on-Write (COW) fork feature:

```javascript
const brain = new Brainy({ storage: { type: 'memory' } })
await brain.init()

// Create files in parent
await brain.vfs.writeFile('/config.json', '{"version": 1}')

// Fork inherits parent's files
const fork = await brain.fork('experiment')
const files = await fork.vfs.readdir('/')  // Sees parent's config.json!

// Fork modifications are isolated
await fork.vfs.writeFile('/test.txt', 'Fork only')
await brain.vfs.readdir('/')  // Parent doesn't see test.txt
```

## FAQ

### Q: Do I need to call `vfs.init()` anymore?
**A:** No! VFS is automatically initialized during `brain.init()` in v5.1.0+.

### Q: Why did the API change from `vfs()` to `vfs`?
**A:** VFS uses the same entity/relationship graph as everything else. There's no reason to treat it differently from other brain APIs.

### Q: Will my old code break?
**A:** If you're using `brain.vfs()` or `await vfs.init()`, you'll need to update to the new pattern. The migration is simple - just remove the `()` and `init()` calls.

### Q: Can I still configure VFS?
**A:** Yes, VFS configuration is passed through `brain.init()` config. The VFS-specific options are applied during auto-initialization.

### Q: Does this work with all storage adapters?
**A:** Yes! VFS auto-initialization works with all storage adapters: Memory, FileSystem, OPFS, S3, R2, Azure Blob, and Google Cloud Storage.

### Q: What if I need multiple VFS instances?
**A:** Each Brainy instance has its own VFS. Create multiple Brainy instances if you need multiple VFS instances.

## Related Documentation

- [VFS Quick Start](./QUICK_START.md) - 5-minute setup guide
- [VFS API Guide](./VFS_API_GUIDE.md) - Complete API reference
- [Common Patterns](./COMMON_PATTERNS.md) - Best practices and patterns
- [Instant Fork](../features/instant-fork.md) - VFS + Copy-on-Write
