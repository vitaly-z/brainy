/**
 * Brainy Plugin System
 *
 * Simple plugin architecture for two use cases:
 * 1. Native acceleration (@soulcraft/cortex)
 * 2. Custom storage adapters (e.g., Redis, DynamoDB, custom backends)
 *
 * Plugins are auto-detected by package name or registered manually.
 */

import type {
  StorageAdapter,
  Vector,
  VectorDocument,
  GraphVerb,
} from './coreTypes.js'
import type { NounType, VerbType } from './types/graphTypes.js'
import type { MetadataIndexStats } from './utils/metadataIndex.js'
import type { GraphIndexStats } from './graph/graphAdjacencyIndex.js'

// Re-export the provider contracts that already live closer to their
// implementations so a plugin author (Cortex) can import the *entire*
// provider surface from one stable entrypoint: `@soulcraft/brainy/plugin`.
export type { ColumnStoreProvider } from './indexes/columnStore/types.js'
export type {
  AggregationProvider,
  AggregateDefinition,
  AggregateGroupState,
  AggregateResult,
  AggregateQueryParams,
  GroupByDimension,
} from './types/brainy.types.js'

/**
 * Plugin interface — all brainy plugins must implement this.
 */
export interface BrainyPlugin {
  /** Unique plugin name (typically the npm package name) */
  name: string

  /**
   * Called by brainy during init() to activate the plugin.
   * Return true if activation succeeded, false to skip.
   */
  activate(context: BrainyPluginContext): Promise<boolean>

  /**
   * Called when brainy.close() is invoked. Optional cleanup.
   */
  deactivate?(): Promise<void>
}

/**
 * Context passed to plugins during activation.
 */
export interface BrainyPluginContext {
  /**
   * Register a provider for a named subsystem.
   *
   * Well-known provider keys (used by cortex):
   * - 'metadataIndex'      — MetadataIndexManager replacement
   * - 'graphIndex'         — GraphAdjacencyIndex replacement
   * - 'entityIdMapper'     — EntityIdMapper replacement
   * - 'cache'              — UnifiedCache replacement
   * - 'hnsw'               — HNSWIndex replacement
   * - 'roaring'            — RoaringBitmap32 replacement
   * - 'embeddings'         — Embedding engine replacement (single text)
   * - 'embedBatch'         — Batch embedding engine (texts[] → vectors[])
   * - 'distance'           — Distance function overrides
   * - 'msgpack'            — Msgpack encode/decode
   * - 'aggregation'        — AggregationIndex replacement (incremental aggregates)
   *
   * Storage adapter keys:
   * - 'storage:<name>'     — Custom storage adapter factory
   */
  registerProvider(key: string, implementation: unknown): void

  /** Brainy version for compatibility checks */
  readonly version: string
}

// ===========================================================================
// Provider contracts — the EXACT surface Brainy calls on each registered
// provider.
//
// These interfaces are the type-level half of the provider-parity guarantee.
// They capture only what Brainy actually invokes, so a native accelerator
// (Cortex) that declares `implements MetadataIndexProvider` gets a compile
// error the moment a method Brainy depends on is dropped or its signature
// drifts. Brainy's own baseline classes (`MetadataIndexManager`,
// `GraphAdjacencyIndex`, `HNSWIndex`, `EntityIdMapper`, `UnifiedCache`)
// implement them too, so the contract can never silently diverge from the
// thing Brainy ships.
//
// Keep these in lockstep with the call sites in `brainy.ts` and the index
// classes. When Brainy starts calling a new member, add it here — every
// implementation then fails to compile until it provides the member.
// ===========================================================================

/**
 * The `'metadataIndex'` provider — a drop-in for `MetadataIndexManager`.
 * Brainy calls this surface via `this.metadataIndex.*` (see `brainy.ts`) and
 * the transactional add/remove operations.
 */
export interface MetadataIndexProvider {
  init(): Promise<void>
  flush(): Promise<void>
  rebuild(): Promise<void>

  addToIndex(id: string, entityOrMetadata: any, skipFlush?: boolean, deferWrites?: boolean): Promise<void>
  removeFromIndex(id: string, metadata?: any): Promise<void>

  getIds(field: string, value: any): Promise<string[]>
  getIdsForFilter(filter: any): Promise<string[]>
  getIdsForTextQuery(query: string): Promise<Array<{ id: string; matchCount: number }>>
  getSortedIdsForFilter(filter: any, orderBy: string, order?: 'asc' | 'desc'): Promise<string[]>
  getFilterValues(field: string): Promise<string[]>
  getFilterFields(): Promise<string[]>
  getFieldValueForEntity(entityId: string, field: string): Promise<any>
  getFieldsForType(nounType: NounType): Promise<Array<{ field: string; affinity: number; occurrences: number; totalEntities: number }>>
  getFieldStatistics(): Promise<Map<string, unknown>>
  getFieldsWithCardinality(): Promise<Array<{ field: string; cardinality: number; distribution: string }>>
  getOptimalQueryPlan(filters: Record<string, any>): Promise<unknown>

  /** Report which index path a `where` clause on `field` will hit (drives `brain.explain()`). */
  explainField(field: string): Promise<{ path: 'column-store' | 'sparse-chunked' | 'none'; notes?: string }>

  getCountForCriteria(field: string, value: any): Promise<number>
  getEntityCountByType(type: string): number
  getEntityCountByTypeEnum(type: NounType): number
  getTotalEntityCount(): number
  getAllEntityCounts(): Map<string, number>
  getTopNounTypes(n: number): NounType[]
  getTopVerbTypes(n: number): VerbType[]
  getAllNounTypeCounts(): Map<NounType, number>
  getAllVerbTypeCounts(): Map<VerbType, number>
  getAllVFSEntityCounts(): Promise<Map<string, number>>

  detectAndRepairCorruption(): Promise<void>
  validateConsistency(): Promise<{
    healthy: boolean
    avgEntriesPerEntity: number
    entityCount: number
    indexEntryCount: number
    recommendation: string | null
  }>

  tokenize(text: string): string[]
  extractTextContent(data: any): string

  getStats(): Promise<MetadataIndexStats>

  /** The shared UUID ↔ int mapper. Brainy reads `.getUuid(intId)` off the result. */
  getIdMapper(): { getUuid(intId: number): string | undefined }

  /** The column store the coordinator delegates `where`/`orderBy` to. */
  readonly columnStore: import('./indexes/columnStore/types.js').ColumnStoreProvider
}

/**
 * The `'graphIndex'` provider — a drop-in for `GraphAdjacencyIndex`.
 * Brainy calls this surface via `this.graphIndex.*` (some optional-chained).
 */
export interface GraphIndexProvider {
  /** `false` until the index has loaded; Brainy probes this before fast paths. */
  readonly isInitialized: boolean

  getNeighbors(
    id: string,
    optionsOrDirection?: { direction?: 'in' | 'out' | 'both'; limit?: number; offset?: number } | 'in' | 'out' | 'both'
  ): Promise<string[]>
  getVerbIdsBySource(sourceId: string, options?: { limit?: number; offset?: number }): Promise<string[]>
  getVerbIdsByTarget(targetId: string, options?: { limit?: number; offset?: number }): Promise<string[]>
  getVerbsBatchCached(verbIds: string[]): Promise<Map<string, GraphVerb>>

  rebuild(): Promise<void>
  flush(): Promise<void>
  close(): Promise<void>
  size(): number

  getStats(): GraphIndexStats
  getRelationshipStats(): {
    totalRelationships: number
    relationshipsByType: Record<string, number>
    uniqueSourceNodes: number
    uniqueTargetNodes: number
    totalNodes: number
  }
  getRelationshipCountByType(type: string): number
  getTotalRelationshipCount(): number
  getAllRelationshipCounts(): Map<string, number>
}

/**
 * The object returned by the `'hnsw'` provider factory — a drop-in for
 * `HNSWIndex`. Brainy calls this surface via `this.index.*` plus the
 * transactional add/remove operations. `enableCOW`, `getItem`, and
 * `setPersistMode` are intentionally absent: Brainy guards each with
 * feature-detection (`typeof x === 'function'`), so they are optional and not
 * part of the required contract (Brainy's own `HNSWIndex` omits
 * `setPersistMode`, for instance).
 */
export interface HnswProvider {
  addItem(item: VectorDocument): Promise<string>
  removeItem(id: string): Promise<boolean>
  search(
    queryVector: Vector,
    k?: number,
    filter?: (id: string) => Promise<boolean>,
    options?: { rerank?: { multiplier: number }; candidateIds?: string[] }
  ): Promise<Array<[string, number]>>
  size(): number
  clear(): void
  rebuild(options?: any): Promise<void>
  flush(): Promise<number>
  getPersistMode(): 'immediate' | 'deferred'
}

/**
 * The `'diskann'` provider — a billion-scale alternative to HNSW backed
 * by cortex's pure-Rust Vamana + Product Quantization implementation
 * (see ADR-002 in the cortex repo).
 *
 * Structurally a drop-in for [`HnswProvider`]: brainy calls the same
 * `addItem` / `search` / `rebuild` surface and never needs to know
 * which index is underneath. The differences are operational:
 *
 * - **Memory footprint**: ~16 GB RAM at 1 B vectors (PQ codes only).
 *   HNSW would need ~1.5 TB to keep the full vectors resident.
 * - **Build model**: build-once, query-many. Dynamic insertions buffer
 *   to an in-memory delta brute-forced alongside the main index;
 *   `rebuild()` folds them in.
 * - **Storage**: requires a local filesystem path (NVMe SSD for the
 *   published latency numbers). Cloud-storage adapters continue using
 *   HNSW.
 *
 * Engagement is automatic when the cortex provider is registered, the
 * storage adapter exposes `getBinaryBlobPath`, and the metadata index
 * has a stable `idMapper`. Users force the legacy index via
 * `config.index.type = 'hnsw'`.
 */
export type DiskAnnProvider = HnswProvider

/**
 * The `'entityIdMapper'` provider — a drop-in for `EntityIdMapper`. Injected
 * into the TypeScript `MetadataIndexManager` when a native metadata index is
 * not also registered; that coordinator calls this full surface (incl.
 * `getAllIntIds`, the all-ids universe for negation / `exists:false` filters).
 */
export interface EntityIdMapperProvider {
  init(): Promise<void>
  getOrAssign(uuid: string): number
  getUuid(intId: number): string | undefined
  getInt(uuid: string): number | undefined
  remove(uuid: string): boolean
  flush(): Promise<void>
  clear(): Promise<void>
  getAllIntIds(): number[]
  intsIterableToUuids(ints: Iterable<number>): string[]
  readonly size: number
}

/**
 * The `'cache'` provider — a drop-in for `UnifiedCache`. Brainy installs it as
 * the global cache (`setGlobalCache`) and calls this surface via
 * `getGlobalCache()`.
 */
export interface CacheProvider {
  getSync(key: string): any | undefined
  set(key: string, data: any, type: 'hnsw' | 'metadata' | 'embedding' | 'other', size: number, rebuildCost?: number): void
  delete(key: string): boolean
  deleteByPrefix(prefix: string): number
  clear(type?: 'hnsw' | 'metadata' | 'embedding' | 'other'): void
}

// The `'embeddings'` / `'embedBatch'` providers are function-shaped and already
// typed by the existing `EmbeddingFunction` (see `coreTypes.ts`), which Brainy
// uses at the `getProvider('embeddings')` call site. No separate interface is
// added here to avoid a duplicate, unwired contract.

/**
 * The `'graph:compression'` provider — pure-function encode/decode for HNSW
 * connection lists as compact delta-varint byte sequences (cortex's
 * `encodeConnections` / `decodeConnections`).
 *
 * Brainy's `HNSWIndex` consumes this via a `ConnectionsCodec` that translates
 * UUIDs to stable int slots via the `EntityIdMapper`, encodes, and persists
 * the compressed bytes through the binary-blob primitive. On load, the blob
 * is fetched + decoded back into UUID sets — `setConnectionsCodec()` on
 * `HNSWIndex` is the injection point. Read path is dual-format: when no blob
 * exists for a node, the connections fall back to the legacy JSON-array path
 * embedded in `saveHNSWData`, so pre-2.4.0 indexes keep loading unchanged
 * and convergence to the compressed form happens lazily on next save.
 *
 * Activated only when the storage adapter exposes the binary-blob primitive
 * AND the metadata index resolves a stable idMapper. Cloud adapters that
 * lack a real local-path resolution still benefit, since the blob primitive
 * itself works across every adapter as of brainy 7.25.0.
 */
export interface GraphCompressionProvider {
  /** Encode a list of u32 ints to compact delta-varint bytes. Sorts internally. */
  encode(ids: number[]): Buffer
  /** Decode delta-varint bytes back to a u32 list. */
  decode(data: Buffer): number[]
}

/**
 * The `'vectorStore:mmap'` provider — a static factory class for an mmap-backed
 * vector file. Brainy's HNSWIndex uses the static `.create()` / `.open()`
 * factories to open a single-file store at a derived path on disk-resident
 * storage adapters; non-FS adapters with no local-path support skip the mmap
 * layer and fall back to per-entity vector reads.
 *
 * Cortex registers `NativeMmapVectorStore` as this provider — a Rust mmap'd
 * f32 array with a header, batch read/write APIs, and madvise prefetch. Slot
 * indices are the stable ints from `EntityIdMapper`; lazy migration on read
 * miss writes back from per-entity storage into the slot, converging an
 * upgraded install to the fast path without a big-bang step.
 */
export interface VectorStoreMmapProvider {
  /** Create a new vector file with pre-allocated slot capacity. */
  create(path: string, dim: number, capacity: number): VectorStoreMmapInstance
  /** Open an existing vector file for read + write. */
  open(path: string): VectorStoreMmapInstance
  /** Open an existing vector file for read-only access. */
  openReadOnly(path: string): VectorStoreMmapInstance
}

/**
 * An open mmap-vector-store instance — the surface brainy's HNSWIndex consumes
 * for batch vector reads + lazy migration from per-entity storage on miss.
 */
export interface VectorStoreMmapInstance {
  /** Number of vectors written (highest written index + 1). */
  readonly count: number
  /** Maximum slot capacity before resize is needed. */
  readonly capacity: number
  /** Vector dimensionality. */
  readonly dim: number
  /** Write a single vector at `index`. Vector is f64 in JS, stored as f32. */
  writeVector(index: number, vector: number[]): void
  /** Write a flat batch starting at `startIndex`. Returns vectors written. */
  writeVectorsBatch(startIndex: number, vectorsFlat: number[]): number
  /** Read a single vector at `index`. Returns f64[]. */
  readVector(index: number): number[]
  /** Read multiple vectors by index. Returns flat f64[] of length n × dim. */
  readVectorsBatch(indices: number[]): number[]
  /** Prefetch via madvise(WILLNEED); no-op on unsupported platforms. */
  prefetch(indices: number[]): void
  /** Grow the vector file to a larger slot capacity. Re-maps the file. */
  resize(newCapacity: number): void
  /** msync — flush pending writes to disk. */
  flush(): void
}

/**
 * Storage adapter factory — plugins register these to provide
 * new storage backends that users reference by name.
 *
 * Example: A Redis plugin registers 'storage:redis', then users
 * can use `new Brainy({ storage: 'redis', redis: { host: '...' } })`
 */
export interface StorageAdapterFactory {
  create(config: Record<string, unknown>): StorageAdapter | Promise<StorageAdapter>
  name: string
}

/**
 * Plugin registry — manages plugin lifecycle and provider resolution.
 */
export class PluginRegistry {
  private plugins: Map<string, BrainyPlugin> = new Map()
  private providers: Map<string, unknown> = new Map()
  private activated: Set<string> = new Set()

  /**
   * Register a plugin manually.
   */
  register(plugin: BrainyPlugin): void {
    this.plugins.set(plugin.name, plugin)
  }


  /**
   * Activate all registered plugins.
   */
  async activateAll(context: BrainyPluginContext): Promise<string[]> {
    const activated: string[] = []

    for (const [name, plugin] of this.plugins) {
      if (this.activated.has(name)) continue

      try {
        const success = await plugin.activate(context)
        if (success) {
          this.activated.add(name)
          activated.push(name)
        }
      } catch (error) {
        console.warn(`[brainy] Plugin ${name} failed to activate:`, error)
      }
    }

    return activated
  }

  /**
   * Deactivate all plugins (called during close()).
   */
  async deactivateAll(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (!this.activated.has(name)) continue
      try {
        await plugin.deactivate?.()
        this.activated.delete(name)
      } catch {
        // Non-fatal
      }
    }
  }

  /**
   * Get a registered provider by key.
   */
  getProvider<T = unknown>(key: string): T | undefined {
    return this.providers.get(key) as T | undefined
  }

  /**
   * Check if a provider is registered.
   */
  hasProvider(key: string): boolean {
    return this.providers.has(key)
  }

  /**
   * Register a provider (called by plugins via BrainyPluginContext).
   */
  registerProvider(key: string, implementation: unknown): void {
    this.providers.set(key, implementation)
  }

  /**
   * Get a storage adapter factory by name.
   */
  getStorageFactory(name: string): StorageAdapterFactory | undefined {
    return this.providers.get(`storage:${name}`) as StorageAdapterFactory | undefined
  }

  /** Get active plugin names */
  getActivePlugins(): string[] {
    return [...this.activated]
  }

  /** Check if any plugins are active */
  hasActivePlugins(): boolean {
    return this.activated.size > 0
  }
}
