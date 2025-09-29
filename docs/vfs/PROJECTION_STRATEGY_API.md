# Projection Strategy API

## Creating Custom Semantic Dimensions

Projection strategies allow you to create custom ways to organize and access files in Semantic VFS. This guide shows you how to build your own.

---

## What is a Projection Strategy?

A **projection strategy** maps a semantic dimension (like "priority" or "language") to actual file entities using Brainy queries.

**Example:**
```typescript
/by-priority/high → Files with metadata.priority = 'high'
/by-language/typescript → Files with .ts extension
```

---

## Interface Definition

Every projection must implement the `ProjectionStrategy` interface:

```typescript
export interface ProjectionStrategy {
  /**
   * Unique name for this dimension
   * Used in paths like: /by-{name}/...
   */
  readonly name: string

  /**
   * Convert dimension value to Brainy FindParams
   * This is for documentation/debugging (not always used)
   *
   * @param value - The dimension value (e.g., 'high' for priority)
   * @param subpath - Optional file filter within dimension
   */
  toQuery(value: any, subpath?: string): FindParams

  /**
   * Resolve dimension value to entity IDs
   * This is the MAIN method that does the work
   *
   * @param brain - Brainy instance (use brain.find, brain.similar, etc.)
   * @param vfs - VirtualFileSystem instance
   * @param value - The dimension value to resolve
   * @returns Array of entity IDs matching this dimension
   */
  resolve(brain: Brainy, vfs: VirtualFileSystem, value: any): Promise<string[]>

  /**
   * OPTIONAL: List all items in this dimension
   * Used for directory listings like: readdir('/by-priority')
   *
   * @param brain - Brainy instance
   * @param vfs - VirtualFileSystem instance
   * @param limit - Max results to return
   */
  list?(brain: Brainy, vfs: VirtualFileSystem, limit?: number): Promise<VFSEntity[]>
}
```

---

## Quick Start: Priority Projection

Let's build a projection that organizes files by priority (high, medium, low):

### Step 1: Create the Strategy Class

```typescript
import { BaseProjectionStrategy } from '@soulcraft/brainy/vfs/semantic'
import { Brainy } from '@soulcraft/brainy'
import { VirtualFileSystem, VFSEntity } from '@soulcraft/brainy/vfs'

export class PriorityProjection extends BaseProjectionStrategy {
  readonly name = 'priority'

  /**
   * Convert priority value to FindParams
   */
  toQuery(priority: string, subpath?: string) {
    const query = {
      where: {
        vfsType: 'file',
        priority: priority  // Match metadata.priority field
      },
      limit: 1000
    }

    // Filter by filename if subpath provided
    if (subpath) {
      query.where = {
        ...query.where,
        anyOf: [
          { name: subpath },
          { path: { endsWith: subpath } }
        ]
      }
    }

    return query
  }

  /**
   * Resolve priority to entity IDs
   */
  async resolve(brain: Brainy, vfs: VirtualFileSystem, priority: string): Promise<string[]> {
    // Query Brainy for files with this priority
    const results = await brain.find({
      where: {
        vfsType: 'file',
        priority: priority
      },
      limit: 1000
    })

    // Extract entity IDs using helper from base class
    return this.extractIds(results)
  }

  /**
   * List all files that have priority metadata
   */
  async list(brain: Brainy, vfs: VirtualFileSystem, limit = 100): Promise<VFSEntity[]> {
    const results = await brain.find({
      where: {
        vfsType: 'file',
        priority: { exists: true }
      },
      limit
    })

    return results.map(r => r.entity as VFSEntity)
  }
}
```

### Step 2: Register the Strategy

```typescript
import { Brainy } from '@soulcraft/brainy'
import { PriorityProjection } from './PriorityProjection'

const brain = new Brainy()
await brain.init()

const vfs = brain.vfs()
await vfs.init()

// Register custom projection
// TODO: This will be exposed as public API
// For now, access via internal property
vfs['projectionRegistry'].register(new PriorityProjection())
```

### Step 3: Use It!

```typescript
// Write files with priority metadata
await vfs.writeFile('/src/critical-fix.ts', code, {
  metadata: { priority: 'high' }
})

await vfs.writeFile('/src/nice-to-have.ts', code, {
  metadata: { priority: 'low' }
})

// Access by priority
const highPriority = await vfs.readdir('/by-priority/high')
console.log(highPriority)  // ['critical-fix.ts']

const lowPriority = await vfs.readdir('/by-priority/low')
console.log(lowPriority)   // ['nice-to-have.ts']
```

---

## Base Class Helpers

`BaseProjectionStrategy` provides utility methods:

### `extractIds(results: Result[]): string[]`
Extracts entity IDs from Brainy query results:

```typescript
const results = await brain.find({ where: { ... } })
return this.extractIds(results)  // ['id1', 'id2', ...]
```

### `filterFiles(brain: Brainy, ids: string[]): Promise<string[]>`
Filters to only file entities (removes directories):

```typescript
const allIds = await this.traverseGraph(...)
return await this.filterFiles(brain, allIds)  // Only files
```

---

## Advanced Examples

### Example 1: Language Projection

Organize files by programming language:

```typescript
export class LanguageProjection extends BaseProjectionStrategy {
  readonly name = 'language'

  // Map extensions to languages
  private languageMap = {
    ts: 'typescript',
    js: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust'
  }

  toQuery(language: string, subpath?: string) {
    // Find extension for this language
    const ext = Object.entries(this.languageMap)
      .find(([_, lang]) => lang === language)?.[0]

    return {
      where: {
        vfsType: 'file',
        extension: ext
      },
      limit: 1000
    }
  }

  async resolve(brain: Brainy, vfs: VirtualFileSystem, language: string): Promise<string[]> {
    const ext = Object.entries(this.languageMap)
      .find(([_, lang]) => lang === language)?.[0]

    if (!ext) return []

    const results = await brain.find({
      where: {
        vfsType: 'file',
        extension: ext
      },
      limit: 5000
    })

    return this.extractIds(results)
  }

  async list(brain: Brainy, vfs: VirtualFileSystem, limit = 100): Promise<VFSEntity[]> {
    // Return sample files from each language
    const results = await brain.find({
      where: { vfsType: 'file' },
      limit
    })

    return results.map(r => r.entity as VFSEntity)
  }
}

// Usage:
// /by-language/typescript  → All .ts files
// /by-language/python      → All .py files
```

### Example 2: Size Projection

Organize files by size category:

```typescript
export class SizeProjection extends BaseProjectionStrategy {
  readonly name = 'size'

  // Size categories in bytes
  private readonly categories = {
    tiny: [0, 1024],              // < 1 KB
    small: [1024, 102400],        // 1-100 KB
    medium: [102400, 1048576],    // 100 KB - 1 MB
    large: [1048576, Infinity]    // > 1 MB
  }

  toQuery(category: string, subpath?: string) {
    const [min, max] = this.categories[category] || [0, Infinity]

    return {
      where: {
        vfsType: 'file',
        size: {
          greaterEqual: min,
          lessThan: max
        }
      },
      limit: 1000
    }
  }

  async resolve(brain: Brainy, vfs: VirtualFileSystem, category: string): Promise<string[]> {
    const [min, max] = this.categories[category]
    if (!min && min !== 0) return []

    const results = await brain.find({
      where: {
        vfsType: 'file',
        size: {
          greaterEqual: min,
          lessThan: max
        }
      },
      limit: 1000
    })

    return this.extractIds(results)
  }

  async list(brain: Brainy, vfs: VirtualFileSystem, limit = 100): Promise<VFSEntity[]> {
    // Return files sorted by size
    const results = await brain.find({
      where: { vfsType: 'file' },
      limit
    })

    return results
      .map(r => r.entity as VFSEntity)
      .sort((a, b) => (b.metadata.size || 0) - (a.metadata.size || 0))
  }
}

// Usage:
// /by-size/tiny    → Files < 1 KB
// /by-size/large   → Files > 1 MB
```

### Example 3: Status Projection (Custom Logic)

Organize files by review status with custom logic:

```typescript
export class StatusProjection extends BaseProjectionStrategy {
  readonly name = 'status'

  toQuery(status: string, subpath?: string) {
    return {
      where: {
        vfsType: 'file',
        reviewStatus: status
      },
      limit: 1000
    }
  }

  async resolve(brain: Brainy, vfs: VirtualFileSystem, status: string): Promise<string[]> {
    // Custom logic: "needs-review" means modified in last 24h without review
    if (status === 'needs-review') {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)

      const results = await brain.find({
        where: {
          vfsType: 'file',
          modified: { greaterEqual: oneDayAgo },
          reviewStatus: { missing: true }  // No review status set
        },
        limit: 1000
      })

      return this.extractIds(results)
    }

    // Standard status query
    const results = await brain.find({
      where: {
        vfsType: 'file',
        reviewStatus: status
      },
      limit: 1000
    })

    return this.extractIds(results)
  }

  async list(brain: Brainy, vfs: VirtualFileSystem, limit = 100): Promise<VFSEntity[]> {
    // Return files with any review status
    const results = await brain.find({
      where: {
        vfsType: 'file',
        anyOf: [
          { reviewStatus: { exists: true } },
          { modified: { greaterEqual: Date.now() - 86400000 } }
        ]
      },
      limit
    })

    return results.map(r => r.entity as VFSEntity)
  }
}

// Usage:
// /by-status/needs-review  → Files modified in last 24h without review
// /by-status/approved      → Approved files
// /by-status/rejected      → Rejected files
```

---

## Using Brainy Field Operators (BFO)

Projection strategies use **Brainy Field Operators** (BFO), not MongoDB-style operators:

### Comparison Operators
```typescript
// ❌ MongoDB style (WRONG)
{ size: { $gte: 1000, $lte: 5000 } }

// ✅ BFO style (CORRECT)
{ size: { greaterEqual: 1000, lessEqual: 5000 } }
```

### Logical Operators
```typescript
// ❌ MongoDB style (WRONG)
{ $or: [{ name: 'foo' }, { name: 'bar' }] }

// ✅ BFO style (CORRECT)
{ anyOf: [{ name: 'foo' }, { name: 'bar' }] }
```

### Existence Operators
```typescript
// ❌ MongoDB style (WRONG)
{ tags: { $exists: true } }

// ✅ BFO style (CORRECT)
{ tags: { exists: true } }
```

### String Operators
```typescript
// ❌ MongoDB style (WRONG)
{ path: { $regex: /\.ts$/ } }

// ✅ BFO style (CORRECT)
{ path: { endsWith: '.ts' } }
```

### Full BFO Operator Reference

```typescript
// Comparison
{ field: value }                          // Exact match
{ field: { greaterThan: 10 } }           // >
{ field: { greaterEqual: 10 } }          // >=
{ field: { lessThan: 10 } }              // <
{ field: { lessEqual: 10 } }             // <=
{ field: { not: value } }                // !=

// Logical
{ anyOf: [{ a: 1 }, { b: 2 }] }          // OR
{ allOf: [{ a: 1 }, { b: 2 }] }          // AND

// Existence
{ field: { exists: true } }              // Field exists
{ field: { missing: true } }             // Field doesn't exist

// String
{ field: { startsWith: 'prefix' } }      // Starts with
{ field: { endsWith: 'suffix' } }        // Ends with
{ field: { matches: 'pattern' } }        // Regex match

// Array
{ array: { contains: 'item' } }          // Array contains item
{ array: { hasAll: ['a', 'b'] } }        // Has all items
{ array: { oneOf: ['a', 'b', 'c'] } }    // Value in list
```

---

## Performance Guidelines

### 1. Use Indexes
All metadata fields are automatically indexed. Use direct equality or range queries for best performance:

```typescript
// ✅ Fast: Direct index lookup (O(log n))
{ priority: 'high' }
{ size: { greaterEqual: 1000 } }

// ⚠️ Slower: Must scan results
{ path: { matches: /complex-regex/ } }
```

### 2. Limit Results
Always set reasonable limits:

```typescript
async resolve(brain, vfs, value) {
  const results = await brain.find({
    where: { ... },
    limit: 1000  // Prevent unbounded queries
  })
  return this.extractIds(results)
}
```

### 3. Avoid Post-Filtering When Possible
If you need post-filtering, consider flattening data:

```typescript
// ❌ Slow: Fetch 5000, filter in memory
const all = await brain.find({ where: { type: 'file' }, limit: 5000 })
return all.filter(item => item.metadata.nested.value === target)

// ✅ Fast: Flatten during write, query directly
// Store: metadata.nested_value = target
const results = await brain.find({
  where: { nested_value: target },
  limit: 1000
})
```

### 4. Cache Expensive Operations
Use the projection's resolve cache:

```typescript
// Automatic caching in SemanticPathResolver
// Results cached for 5 minutes by default
// No manual caching needed!
```

---

## Testing Projections

### Unit Test Example

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { Brainy } from '@soulcraft/brainy'
import { PriorityProjection } from './PriorityProjection'

describe('PriorityProjection', () => {
  let brain: Brainy
  let vfs: any
  let projection: PriorityProjection

  beforeAll(async () => {
    brain = new Brainy()
    await brain.init()
    vfs = brain.vfs()
    await vfs.init()
    projection = new PriorityProjection()
  })

  it('should resolve high priority files', async () => {
    // Create test files
    await vfs.writeFile('/test1.ts', 'code', {
      metadata: { priority: 'high' }
    })
    await vfs.writeFile('/test2.ts', 'code', {
      metadata: { priority: 'low' }
    })

    // Resolve high priority
    const ids = await projection.resolve(brain, vfs, 'high')

    expect(ids).toHaveLength(1)

    const entity = await brain.get(ids[0])
    expect(entity.metadata.priority).toBe('high')
  })

  it('should list all files with priority', async () => {
    const entities = await projection.list(brain, vfs, 100)

    expect(entities.length).toBeGreaterThan(0)
    expect(entities.every(e => e.metadata.priority)).toBe(true)
  })
})
```

---

## Best Practices

### 1. ✅ Name projections clearly
```typescript
// ✅ Good
readonly name = 'priority'      // /by-priority/high
readonly name = 'language'      // /by-language/typescript

// ❌ Bad
readonly name = 'proj1'         // /by-proj1/??? unclear
```

### 2. ✅ Document expected metadata
```typescript
/**
 * Priority Projection
 *
 * Requires metadata fields:
 * - priority: string ('high' | 'medium' | 'low')
 *
 * Usage:
 *   /by-priority/high
 */
export class PriorityProjection extends BaseProjectionStrategy {
  // ...
}
```

### 3. ✅ Handle missing data gracefully
```typescript
async resolve(brain, vfs, value) {
  const results = await brain.find({
    where: { priority: value },
    limit: 1000
  })

  // Return empty array if no results, don't throw
  return this.extractIds(results)  // [] if empty
}
```

### 4. ✅ Validate input
```typescript
async resolve(brain, vfs, priority: string) {
  // Validate priority value
  const valid = ['high', 'medium', 'low']
  if (!valid.includes(priority)) {
    return []  // Or throw error
  }

  // Continue with query...
}
```

---

## Common Patterns

### Pattern 1: Enum-Based Projection
For fixed sets of values (status, priority, type):

```typescript
private readonly validValues = ['draft', 'review', 'approved']

async resolve(brain, vfs, status: string) {
  if (!this.validValues.includes(status)) return []
  // ... query
}
```

### Pattern 2: Range-Based Projection
For numeric or time ranges:

```typescript
private readonly ranges = {
  recent: Date.now() - 86400000,      // Last 24h
  week: Date.now() - 7 * 86400000,    // Last week
  month: Date.now() - 30 * 86400000   // Last month
}

async resolve(brain, vfs, period: string) {
  const since = this.ranges[period]
  if (!since) return []

  const results = await brain.find({
    where: {
      modified: { greaterEqual: since }
    }
  })
  return this.extractIds(results)
}
```

### Pattern 3: Computed Projection
Combine multiple criteria:

```typescript
async resolve(brain, vfs, value: string) {
  // "stale" = not modified in 30 days AND no recent access
  if (value === 'stale') {
    const thirtyDaysAgo = Date.now() - 30 * 86400000

    const results = await brain.find({
      where: {
        allOf: [
          { modified: { lessThan: thirtyDaysAgo } },
          { accessed: { lessThan: thirtyDaysAgo } }
        ]
      }
    })
    return this.extractIds(results)
  }

  // Regular query for other values...
}
```

---

## Troubleshooting

### Projection returns empty results
1. Check metadata exists: `console.log(entity.metadata)`
2. Verify query syntax: Use BFO operators, not MongoDB
3. Check limits: Increase limit if needed

### Slow performance
1. Check if field is indexed: All metadata fields are auto-indexed
2. Avoid post-filtering: Flatten complex structures
3. Use appropriate limits: Don't fetch more than needed

### Type errors
1. Import correct types: `import { Brainy, VirtualFileSystem } from '@soulcraft/brainy'`
2. Use `as VFSEntity` when mapping results
3. Check BaseProjectionStrategy import

---

## See Also

- [Semantic VFS Guide](./SEMANTIC_VFS.md) - Using semantic paths
- [Performance Tuning](./PERFORMANCE_TUNING.md) - Optimization guide
- [VFS Core API](./VFS_CORE.md) - Base VFS operations