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
