# Plugin Development Guide

Brainy has a plugin system that allows third-party packages to replace internal subsystems with custom implementations. This is how `@soulcraft/cortex` provides native Rust acceleration, and it's the same system available to any developer.

## Architecture Overview

Brainy's plugin system uses **named providers** — string keys mapped to implementations. During `init()`, brainy:

1. Imports each package listed in the `plugins` config array
2. Activates each plugin, passing a `BrainyPluginContext`
3. The plugin calls `context.registerProvider(key, implementation)` for each subsystem it provides
4. Brainy checks each provider key and wires the implementation into its internal pipeline

Plugins are **opt-in** — brainy never auto-imports packages. You must explicitly list plugins in the config:

```typescript
const brain = new Brainy({
  plugins: ['@soulcraft/cortex']  // explicitly load cortex
})
```

| `plugins` value | Behavior |
|---|---|
| `undefined` (default) | No plugins loaded |
| `false` | No plugins loaded |
| `[]` | No plugins loaded |
| `['@soulcraft/cortex']` | Load only the listed packages |

Plugins registered programmatically via `brain.use(plugin)` are always activated regardless of the `plugins` config.

If no plugin provides a given key, brainy uses its built-in JavaScript implementation. This means brainy works perfectly standalone — plugins only enhance performance or add capabilities.

## Creating a Plugin

### 1. Implement the `BrainyPlugin` interface

```typescript
import type { BrainyPlugin, BrainyPluginContext } from '@soulcraft/brainy/plugin'

const myPlugin: BrainyPlugin = {
  name: 'my-brainy-plugin',  // Must be unique (typically your npm package name)

  async activate(context: BrainyPluginContext): Promise<boolean> {
    // Register your providers here
    context.registerProvider('distance', myFastDistanceFunction)

    // Return true if activation succeeded, false to skip
    return true
  },

  async deactivate(): Promise<void> {
    // Optional cleanup when brainy.close() is called
  }
}

export default myPlugin
```

### 2. Package exports

Your package must export the plugin as the default export so brainy's auto-detection works:

```typescript
// index.ts
export { default } from './plugin.js'
```

### 3. Registration

**Config-based:** List your package name in the brainy config:

```typescript
const brain = new Brainy({
  plugins: ['my-brainy-plugin']
})
await brain.init()
```

**Programmatic registration:** For plugins not installed as npm packages, use `brain.use()`:

```typescript
import { Brainy } from '@soulcraft/brainy'
import myPlugin from './my-plugin.js'

const brain = new Brainy()
brain.use(myPlugin)
await brain.init()
```

## Provider Keys Reference

Each key has a specific expected signature. Brainy checks for these during `init()` and wires them into the appropriate code paths.

### Core Providers

#### `distance`
**Type:** `(a: number[], b: number[]) => number`

Replaces the default cosine distance function used in HNSW search and neural APIs. This is the highest-impact single provider — it's called for every vector comparison.

```typescript
context.registerProvider('distance', (a: number[], b: number[]): number => {
  // Your SIMD-accelerated or GPU distance calculation
  return myFastCosineDistance(a, b)
})
```

#### `embeddings`
**Type:** `(text: string | string[]) => Promise<number[] | number[][]>`

Replaces the built-in WASM embedding engine. Called for every `brain.add()`, `brain.update()`, and `brain.find()` operation that involves text.

```typescript
context.registerProvider('embeddings', async (text: string | string[]) => {
  if (Array.isArray(text)) {
    return myEngine.embedBatch(text)
  }
  return myEngine.embed(text)
})
```

#### `embedBatch`
**Type:** `(texts: string[]) => Promise<number[][]>`

Dedicated batch embedding provider. When registered, brainy uses this for bulk operations (import, reindex, batch add) instead of calling the `embeddings` provider N times. This enables true single-forward-pass batch processing.

Priority order for batch operations:
1. `embedBatch` provider (single forward pass — fastest)
2. `embeddings` provider with `Promise.all()` (N individual calls)
3. Built-in WASM batch API (fallback)

```typescript
context.registerProvider('embedBatch', async (texts: string[]) => {
  // Process all texts in a single forward pass
  return myEngine.batchEmbed(texts)
})
```

### Index Providers

#### `hnsw`
**Type:** `(config: object, distanceFunction: Function, options: object) => HNSWIndex-compatible`

Factory function that creates an HNSW index instance. The returned object must implement the `HNSWIndex` public API:

- `addItem(item: { id: string, vector: number[] }): Promise<string>`
- `search(queryVector: number[], k: number, filter?, options?): Promise<Array<[string, number]>>`
- `removeItem(id: string): Promise<boolean>`
- `size(): number`
- `clear(): void`
- `flush(): Promise<number>`
- `rebuild(options?): Promise<void>`
- `getDirtyNodeCount(): number`
- `getPersistMode(): 'immediate' | 'deferred'`
- `getEntryPointId(): string | null`
- `getMaxLevel(): number`
- `getDimension(): number | null`
- `getConfig(): object`
- `getDistanceFunction(): Function`
- `enableCOW(parent): void`
- `setUseParallelization(boolean): void`

For type-aware indexes (separate graph per noun type), also implement:
- `getIndexForType(type: string): HNSWIndex` (duck-typed detection)
- `search(queryVector, k, type?, filter?, options?): Promise<Array<[string, number]>>`

```typescript
context.registerProvider('hnsw', (config, distanceFn, options) => {
  return new MyNativeHNSWIndex(config, distanceFn, options)
})
```

#### `metadataIndex`
**Type:** `(storage: StorageAdapter) => MetadataIndexManager-compatible`

Factory function that creates a metadata index. The returned object must implement the `MetadataIndexManager` interface including `init()`, `addEntity()`, `removeEntity()`, `query()`, `flush()`, `clear()`, etc.

```typescript
context.registerProvider('metadataIndex', (storage) => {
  return new MyNativeMetadataIndex(storage)
})
```

#### `graphIndex`
**Type:** `(storage: StorageAdapter) => GraphAdjacencyIndex-compatible`

Factory function that creates a graph adjacency index for relationship tracking (verbs/triples). Must implement the `GraphAdjacencyIndex` interface including `addVerb()`, `getVerbsBySource()`, `getVerbsByTarget()`, `flush()`, etc.

```typescript
context.registerProvider('graphIndex', (storage) => {
  return new MyNativeGraphIndex(storage)
})
```

### Utility Providers

#### `cache`
**Type:** `UnifiedCache`

Replaces the global `UnifiedCache` singleton used for VFS path resolution, semantic caching, and HNSW vector caching. Must implement the `UnifiedCache` interface (available from `@soulcraft/brainy/internals`).

```typescript
import type { UnifiedCache } from '@soulcraft/brainy/internals'

context.registerProvider('cache', myNativeCache)
```

#### `entityIdMapper`
**Type:** `(storage: StorageAdapter) => EntityIdMapper-compatible`

Factory for bidirectional UUID ↔ integer mapping used by roaring bitmaps. Must implement `getOrAssign()`, `getUuid()`, `getInt()`, `has()`, `remove()`, `flush()`, `clear()`.

#### `roaring`
**Type:** `RoaringBitmap32 class`

Replacement for the roaring bitmap implementation. Used internally by the metadata index for set operations. Must be API-compatible with `roaring-wasm`.

#### `msgpack`
**Type:** `{ encode: (data: any) => Buffer, decode: (buffer: Buffer) => any }`

Native msgpack encode/decode for SSTable serialization.

## Storage Adapter Plugins

Plugins can register custom storage backends that users reference by name.

### Implementing a Storage Adapter

```typescript
import type { StorageAdapterFactory } from '@soulcraft/brainy/plugin'
import type { StorageAdapter } from '@soulcraft/brainy'

class MyStorageAdapter implements StorageAdapter {
  async init(): Promise<void> { /* ... */ }
  async saveNoun(noun: HNSWNoun): Promise<void> { /* ... */ }
  async getNoun(id: string): Promise<HNSWNounWithMetadata | null> { /* ... */ }
  async deleteNoun(id: string): Promise<void> { /* ... */ }
  // ... implement all StorageAdapter methods
}
```

### Registering a Storage Adapter

```typescript
context.registerProvider('storage:my-backend', {
  name: 'my-backend',
  create: (config: Record<string, unknown>) => {
    return new MyStorageAdapter(config)
  }
} satisfies StorageAdapterFactory)
```

Users can then use your storage:

```typescript
const brain = new Brainy({ storage: 'my-backend', myBackendOption: 'value' })
```

## Import Paths

Brainy provides three entry points for plugin developers:

| Import Path | Contents | Stability |
|-------------|----------|-----------|
| `@soulcraft/brainy` | Public API, types, StorageAdapter | Stable (semver) |
| `@soulcraft/brainy/plugin` | BrainyPlugin, BrainyPluginContext, StorageAdapterFactory | Stable (semver) |
| `@soulcraft/brainy/internals` | UnifiedCache, EntityIdMapper, logger utilities | Internal (may change between minor versions) |

## Diagnostics

Brainy provides a `diagnostics()` method to verify plugin wiring:

```typescript
const brain = new Brainy()
await brain.init()

const diag = brain.diagnostics()
console.log(diag)
// {
//   version: '7.14.0',
//   plugins: { active: ['my-plugin'], count: 1 },
//   providers: {
//     metadataIndex: { source: 'default' },
//     graphIndex: { source: 'default' },
//     embeddings: { source: 'plugin' },
//     embedBatch: { source: 'plugin' },
//     distance: { source: 'plugin' },
//     hnsw: { source: 'default' },
//     ...
//   },
//   indexes: {
//     hnsw: { size: 0, type: 'TypeAwareHNSWIndex' },
//     metadata: { type: 'MetadataIndexManager', initialized: true },
//     graph: { type: 'GraphAdjacencyIndex', initialized: true, wiredToStorage: true }
//   }
// }
```

The CLI also supports diagnostics:

```bash
brainy diagnostics
```

### Init-Time Summary

When a plugin is active, brainy automatically logs a provider summary after `init()`:

```
[brainy] Plugin activated: @soulcraft/cortex
[brainy] Providers: 8/10 native (@soulcraft/cortex) | default: hnsw, cache
```

This tells you at a glance how many subsystems are accelerated and which ones are falling back to JavaScript. The log respects `config.silent`.

### Fail-Fast for Production

Use `requireProviders()` after `init()` to guarantee specific providers are plugin-supplied. This prevents silent fallback to JavaScript in deployments where you expect native acceleration:

```typescript
const brain = new Brainy()
await brain.init()

// Throws immediately if any of these are using JS fallback
brain.requireProviders(['distance', 'embeddings', 'metadataIndex', 'graphIndex'])
```

If a required provider is missing, the error message tells you exactly what's wrong:

```
[brainy] Required providers using JS fallback: graphIndex.
Active plugins: @soulcraft/cortex.
These providers must be supplied by a plugin for this deployment.
Check plugin installation, license, and native module availability.
```

This is the recommended pattern for production deployments with paid plugins — fail at startup rather than silently degrading performance.

## Complete Example: Distance Acceleration Plugin

A minimal but useful plugin that provides SIMD-accelerated distance calculations:

```typescript
// simd-distance-plugin/src/plugin.ts
import type { BrainyPlugin, BrainyPluginContext } from '@soulcraft/brainy/plugin'

// Hypothetical native module
import { simdCosineDistance } from './native.js'

const simdDistancePlugin: BrainyPlugin = {
  name: 'brainy-simd-distance',

  async activate(context: BrainyPluginContext): Promise<boolean> {
    // Check if SIMD is available on this platform
    if (!checkSimdSupport()) {
      console.log('[simd-distance] SIMD not available, skipping')
      return false  // Don't activate — brainy uses JS fallback
    }

    context.registerProvider('distance', simdCosineDistance)
    return true
  }
}

export default simdDistancePlugin
```

```json
// simd-distance-plugin/package.json
{
  "name": "brainy-simd-distance",
  "main": "./dist/plugin.js",
  "types": "./dist/plugin.d.ts",
  "peerDependencies": {
    "@soulcraft/brainy": ">=7.0.0"
  }
}
```

Usage:

```typescript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy({ plugins: ['brainy-simd-distance'] })
await brain.init()

// Verify it's active
const diag = brain.diagnostics()
console.log(diag.providers.distance) // { source: 'plugin' }
```

## Design Principles

1. **Brainy works perfectly without plugins.** Every provider has a JavaScript fallback. Plugins only improve performance or add capabilities.

2. **Provider keys are string-based.** The plugin system is not coupled to any specific plugin. Any package can register any provider.

3. **Clean separation.** Plugins access brainy through the documented `BrainyPluginContext` interface. No direct access to internal classes is needed.

4. **Fail-safe activation.** If a plugin throws during `activate()`, brainy logs a warning and continues with defaults. A broken plugin never prevents brainy from working.

5. **Lifecycle management.** `deactivate()` is called during `brainy.close()` for resource cleanup. Native resources, connections, and file handles should be released here.
