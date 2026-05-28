/**
 * Metadata Index System
 * Maintains inverted indexes for fast metadata filtering
 * Automatically updates indexes when data changes
 */

import { StorageAdapter, resolveEntityField } from '../coreTypes.js'
import { ColumnStore } from '../indexes/columnStore/ColumnStore.js'
import type { MetadataIndexProvider } from '../plugin.js'
import { MetadataIndexCache, MetadataIndexCacheConfig } from './metadataIndexCache.js'
import { compareCodePoints } from './collation.js'
import { prodLog } from './logger.js'
import { getGlobalCache, UnifiedCache } from './unifiedCache.js'
import {
  NounType,
  VerbType,
  TypeUtils,
  NOUN_TYPE_COUNT,
  VERB_TYPE_COUNT
} from '../types/graphTypes.js'
import {
  SparseIndex,
  ChunkManager,
  AdaptiveChunkingStrategy,
  ChunkData,
  ChunkDescriptor,
  ZoneMap,
  compareNormalizedValues
} from './metadataIndexChunking.js'
import { EntityIdMapper } from './entityIdMapper.js'
import { RoaringBitmap32, roaringLibraryInitialize } from './roaring/index.js'
import { FieldTypeInference, FieldType } from './fieldTypeInference.js'
import { BrainyError } from '../errors/brainyError.js'

/**
 * Fields whose values are stored in the sparse index as BUCKETED values
 * (rounded to a coarser granularity to keep the index compact). Sorting
 * and any precision-sensitive comparison on these fields must bypass the
 * index and read the actual value directly from entity storage.
 *
 * Currently only timestamps are bucketed — they round to 1-minute windows
 * via `Math.floor(ts / 60000) * 60000` in the chunking layer. If any new
 * bucketed field is added (e.g. a compressed float), add it here too.
 */
const BUCKETED_INDEX_FIELDS: ReadonlySet<string> = new Set([
  'createdAt',
  'updatedAt'
])

export interface MetadataIndexEntry {
  field: string
  value: string | number | boolean
  ids: Set<string>
  lastUpdated: number
}

export interface FieldIndexData {
  // Maps value -> count for quick filter discovery
  values: Record<string, number>
  lastUpdated: number
}

export interface MetadataIndexStats {
  totalEntries: number
  totalIds: number
  fieldsIndexed: string[]
  lastRebuild: number
  indexSize: number // in bytes
}

export interface MetadataIndexConfig {
  maxIndexSize?: number // Max number of entries per field value (default: 10000)
  rebuildThreshold?: number // Rebuild if index is this % stale (default: 0.1)
  autoOptimize?: boolean // Auto-cleanup unused entries (default: true)
  indexedFields?: string[] // Only index these fields (default: all)
  excludeFields?: string[] // Never index these fields
}

export interface MetadataIndexOptions {
  entityIdMapper?: EntityIdMapper // Optional pre-configured EntityIdMapper (e.g., native from cortex)
}

/**
 * Manages metadata indexes for fast filtering
 * Maintains inverted indexes: field+value -> list of IDs
 */
// Cardinality tracking for optimization decisions
interface CardinalityInfo {
  uniqueValues: number
  totalValues: number
  distribution: 'uniform' | 'skewed' | 'sparse'
  updateFrequency: number
  lastAnalyzed: number
}

// Field statistics for smart optimization
interface FieldStats {
  cardinality: CardinalityInfo
  queryCount: number
  rangeQueryCount: number
  exactQueryCount: number
  avgQueryTime: number
  indexType: 'hash' // Only 'hash' since all fields use chunked sparse indices with zone maps
  normalizationStrategy?: 'none' | 'precision' | 'bucket'
}

/**
 * Implements {@link MetadataIndexProvider}: the metadata-index surface Brainy
 * calls on whatever the `'metadataIndex'` provider resolves to (its own
 * manager, or Cortex's native Rust engine).
 */
export class MetadataIndexManager implements MetadataIndexProvider {
  private storage: StorageAdapter
  private config: Required<MetadataIndexConfig>
  private isRebuilding = false
  private metadataCache: MetadataIndexCache
  private fieldIndexes = new Map<string, FieldIndexData>()
  private dirtyFields = new Set<string>()
  private lastFlushTime = Date.now()
  private autoFlushThreshold = 10 // Start with 10 for more frequent non-blocking flushes

  // Cardinality and field statistics tracking
  private fieldStats = new Map<string, FieldStats>()
  private cardinalityUpdateInterval = 100 // Update cardinality every N operations
  private operationCount = 0
  
  // Smart normalization thresholds
  private readonly HIGH_CARDINALITY_THRESHOLD = 1000
  private readonly TIMESTAMP_PRECISION_MS = 60000 // 1 minute buckets
  private readonly FLOAT_PRECISION = 2 // decimal places
  
  // Type-Field Affinity Tracking for intelligent NLP
  private typeFieldAffinity = new Map<string, Map<string, number>>() // nounType -> field -> count
  private totalEntitiesByType = new Map<string, number>() // nounType -> total count


  // Phase 1b: Fixed-size type tracking (Stage 3 CANONICAL: 99.2% memory reduction vs Maps)
  // Uint32Array provides O(1) access via type enum index
  // 42 noun types × 4 bytes = 168 bytes (vs ~20KB with Map overhead)
  // 127 verb types × 4 bytes = 508 bytes (vs ~62KB with Map overhead)
  // Total: 676 bytes (vs ~85KB) = 99.2% memory reduction
  private entityCountsByTypeFixed = new Uint32Array(NOUN_TYPE_COUNT) // 168 bytes (Stage 3 CANONICAL: 42 types)
  private verbCountsByTypeFixed = new Uint32Array(VERB_TYPE_COUNT)   // 508 bytes (Stage 3 CANONICAL: 127 types)

  // Unified cache for coordinated memory management
  private unifiedCache: UnifiedCache

  // File locking for concurrent write protection (prevents race conditions)
  private activeLocks = new Map<string, { expiresAt: number; lockValue: string }>()
  private lockPromises = new Map<string, Promise<boolean>>()
  private lockTimers = new Map<string, NodeJS.Timeout>() // Track timers for cleanup

  // Adaptive Chunked Sparse Indexing
  // Reduces file count from 560k → 89 files (630x reduction)
  // ALL fields now use chunking - no more flat files
  // Removed sparseIndices Map - now lazy-loaded via UnifiedCache only
  // PROJECTED: Reduces metadata memory from 35GB → 5GB @ 1B scale (86% reduction from chunking strategy, not yet benchmarked)
  private chunkManager: ChunkManager
  private chunkingStrategy: AdaptiveChunkingStrategy

  // (Removed in 7.22.0) `dirtyChunks` and `dirtySparseIndices` Maps —
  // never populated since the sparse-index write path was deleted in 7.20.0
  // (commit 11be039). The associated `flushDirtyMetadata()` no-op was also
  // removed. Column store is the single source of truth for indexed writes.

  // Roaring Bitmap Support
  // EntityIdMapper for UUID ↔ integer conversion
  private idMapper: EntityIdMapper

  // Field Type Inference (Production-ready value-based type detection)
  // Replaces unreliable pattern matching with DuckDB-inspired value analysis
  private fieldTypeInference: FieldTypeInference

  /**
   * Unified Column Store — replaces sparse index internals for filtering + sorting.
   * Created in the constructor (no storage needed for writes), storage discovery
   * happens in init(). Public so brainy.ts can call sortTopK directly for
   * unfiltered sort.
   */
  public columnStore: ColumnStore

  constructor(storage: StorageAdapter, config: MetadataIndexConfig = {}, options: MetadataIndexOptions = {}) {
    this.storage = storage
    this.config = {
      maxIndexSize: config.maxIndexSize ?? 10000,
      rebuildThreshold: config.rebuildThreshold ?? 0.1,
      autoOptimize: config.autoOptimize ?? true,
      indexedFields: config.indexedFields ?? [],
      excludeFields: config.excludeFields ?? [
        // ONLY exclude truly un-indexable fields (binary data, large content)
        // Timestamps are NOW indexed with automatic bucketing (prevents pollution)

        // Vectors and embeddings (binary data, already have HNSW indexes)
        'embedding',
        'vector',
        'embeddings',
        'vectors',

        // Large content fields (too large for metadata indexing)
        'content',
        'data',
        'originalData',
        '_data',

        // Primary keys (use direct lookups instead)
        'id'

        // NOTE: 'accessed', 'modified', 'createdAt', etc. are NO LONGER excluded!
        // They are now indexed with automatic 1-minute bucketing to prevent file pollution
        // This enables range queries like: modified > yesterday
      ]
    }

    // Initialize metadata cache with similar config to search cache
    this.metadataCache = new MetadataIndexCache({
      maxAge: 5 * 60 * 1000, // 5 minutes
      maxSize: 500,          // 500 entries (field indexes + value chunks)
      enabled: true
    })

    // Get global unified cache for coordinated memory management
    this.unifiedCache = getGlobalCache()

    // Use injected EntityIdMapper (e.g., native from cortex) or create JS fallback
    this.idMapper = options.entityIdMapper ?? new EntityIdMapper({
      storage,
      storageKey: 'brainy:entityIdMapper'
    })

    // Initialize chunking system with roaring bitmap support
    this.chunkManager = new ChunkManager(storage, this.idMapper)
    this.chunkingStrategy = new AdaptiveChunkingStrategy()

    // Initialize Field Type Inference
    this.fieldTypeInference = new FieldTypeInference(storage)

    // Create column store — works immediately for writes (in-memory tail buffers).
    // Storage discovery (loading existing segments) happens in init().
    this.columnStore = new ColumnStore()

    // Removed lazyLoadCounts() call from constructor
    // It was a race condition (not awaited) and read from wrong source.
    // Now properly called in init() after warmCache() loads the sparse index.
  }

  /**
   * Get the shared EntityIdMapper instance. Used by the ColumnStore and
   * other subsystems that need UUID ↔ u32 mapping without creating a
   * second mapper that could diverge.
   */
  getIdMapper(): EntityIdMapper {
    return this.idMapper
  }

  /**
   * Initialize the metadata index manager
   * This must be called after construction and before any queries
   */
  async init(): Promise<void> {
    // Initialize roaring-wasm library (browser bundle requires async init)
    await roaringLibraryInitialize()

    // Load field registry to discover persisted indices
    // Must run first to populate fieldIndexes directory before warming cache
    await this.loadFieldRegistry()

    // Initialize EntityIdMapper (loads UUID ↔ integer mappings from storage)
    await this.idMapper.init()

    // Initialize column store storage discovery (load existing segment manifests).
    // The column store was created in the constructor for immediate writes;
    // this step loads persisted segments so queries can find existing data.
    try {
      await this.columnStore.init(this.storage, this.idMapper)
    } catch (err) {
      prodLog.warn('[MetadataIndex] Column store storage discovery failed:', err)
    }

    // Check if field registry was loaded successfully
    const hasFields = this.fieldIndexes.size > 0

    if (!hasFields) {
      // Don't trust "empty" — field registry may be missing due to interrupted flush.
      // Probe storage for actual entities before concluding the workspace is empty.
      try {
        const probe = await this.storage.getNouns({ pagination: { limit: 1, offset: 0 } })
        const hasEntities = (probe.totalCount ?? 0) > 0 || probe.items.length > 0

        if (hasEntities) {
          console.warn(
            `[MetadataIndex] Field registry missing but ${probe.totalCount ?? 'unknown'} entities exist on disk — rebuilding index`
          )
          await this.rebuild()
          return // rebuild handles warmCache + lazyLoadCounts internally
        }
      } catch {
        // Storage probe failed — genuinely empty or storage not ready
      }
      return // Truly empty workspace — nothing to warm
    }

    // Warm the cache with common fields (lazy loading optimization)
    // This loads the 'noun' sparse index which is needed for type counts
    await this.warmCache()

    // Load type counts AFTER warmCache (sparse index is now cached)
    await this.lazyLoadCounts()

    // Phase 1b: Sync loaded counts to fixed-size arrays
    this.syncTypeCountsToFixed()
  }

  /**
   * Detect index corruption and automatically repair via rebuild
   * This catches the update() field asymmetry bug that causes 7 fields to accumulate per update
   * Corruption threshold: 100 avg metadata entries/entity, excluding __words__ (expected ~30)
   *
   * Removed from init() hot path for performance. Call explicitly via:
   * - brain.checkHealth() — returns health status
   * - brain.repairIndex() — runs detection + auto-repair
   */
  async detectAndRepairCorruption(): Promise<void> {
    const validation = await this.validateConsistency()

    if (!validation.healthy) {
      prodLog.warn(`⚠️ Index corruption detected (${validation.avgEntriesPerEntity.toFixed(1)} avg entries/entity)`)
      prodLog.warn('🔄 Auto-rebuilding index to repair...')

      // Clear and rebuild
      await this.clearAllIndexData()
      await this.rebuild()

      // Re-validate after rebuild
      const postRebuild = await this.validateConsistency()
      if (postRebuild.healthy) {
        prodLog.info(`✅ Index rebuilt successfully (${postRebuild.avgEntriesPerEntity.toFixed(1)} avg entries/entity)`)
      } else {
        prodLog.error(
          `❌ Index still appears corrupted after rebuild (${postRebuild.avgEntriesPerEntity.toFixed(1)} avg entries/entity). ` +
          `This may indicate a different issue.`
        )
      }
    }
  }

  /**
   * Warm the cache by preloading common field sparse indices
   * This improves cache hit rates by loading frequently-accessed fields at startup
   * Target: >80% cache hit rate for typical workloads
   */
  async warmCache(): Promise<void> {
    // Common fields used in most queries
    const commonFields = ['noun', 'type', 'service', 'createdAt']

    prodLog.debug(`🔥 Warming metadata cache with common fields: ${commonFields.join(', ')}`)

    // Preload in parallel for speed
    await Promise.all(
      commonFields.map(async field => {
        try {
          await this.loadSparseIndex(field)
        } catch (error) {
          // Silently ignore if field doesn't exist yet
          // This maintains zero-configuration principle
          prodLog.debug(`Cache warming: field '${field}' not yet indexed`)
        }
      })
    )

    prodLog.debug('✅ Metadata cache warmed successfully')

    // Phase 1b: Also warm cache for top types (type-aware optimization)
    await this.warmCacheForTopTypes(3)
  }

  /**
   * Phase 1b: Warm cache for top types (type-aware optimization)
   * Preloads metadata indices for the most common entity types and their top fields
   * This significantly improves query performance for the most frequently accessed data
   *
   * @param topN Number of top types to warm (default: 3)
   */
  async warmCacheForTopTypes(topN: number = 3): Promise<void> {
    // Get top noun types by entity count
    const topTypes = this.getTopNounTypes(topN)

    if (topTypes.length === 0) {
      prodLog.debug('⏭️  Skipping type-aware cache warming: no types found yet')
      return
    }

    prodLog.debug(`🔥 Warming cache for top ${topTypes.length} types: ${topTypes.join(', ')}`)

    // For each top type, warm cache for its top fields
    for (const type of topTypes) {
      // Get fields with high affinity to this type
      const typeFields = this.typeFieldAffinity.get(type)
      if (!typeFields) continue

      // Sort fields by count (most common first)
      const topFields = Array.from(typeFields.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // Top 5 fields per type
        .map(([field]) => field)

      if (topFields.length === 0) continue

      prodLog.debug(`  📊 Type '${type}' - warming fields: ${topFields.join(', ')}`)

      // Preload sparse indices for these fields in parallel
      await Promise.all(
        topFields.map(async field => {
          try {
            await this.loadSparseIndex(field)
          } catch (error) {
            // Silently ignore if field doesn't exist yet
            prodLog.debug(`  ⏭️  Field '${field}' not yet indexed for type '${type}'`)
          }
        })
      )
    }

    prodLog.debug('✅ Type-aware cache warming completed')
  }

  /**
   * Acquire an in-memory lock for coordinating concurrent metadata index writes
   * Uses in-memory locks since MetadataIndexManager doesn't have direct file system access
   * @param lockKey The key to lock on (e.g., 'field_noun', 'sorted_timestamp')
   * @param ttl Time to live for the lock in milliseconds (default: 10 seconds)
   * @returns Promise that resolves to true if lock was acquired, false otherwise
   */
  private async acquireLock(
    lockKey: string,
    ttl: number = 10000
  ): Promise<boolean> {
    const lockValue = `${Date.now()}_${Math.random()}`
    const expiresAt = Date.now() + ttl

    // Check if lock already exists and is still valid
    const existingLock = this.activeLocks.get(lockKey)
    if (existingLock && existingLock.expiresAt > Date.now()) {
      // Lock exists and is still valid - wait briefly and retry once
      await new Promise(resolve => setTimeout(resolve, 50))

      // Check again after wait
      const recheckLock = this.activeLocks.get(lockKey)
      if (recheckLock && recheckLock.expiresAt > Date.now()) {
        return false // Lock still held
      }
    }

    // Acquire the lock
    this.activeLocks.set(lockKey, { expiresAt, lockValue })

    // Schedule automatic cleanup when lock expires
    const timer = setTimeout(() => {
      this.releaseLock(lockKey, lockValue).catch((error) => {
        prodLog.debug(`Failed to auto-release expired lock ${lockKey}:`, error)
      })
    }, ttl)

    this.lockTimers.set(lockKey, timer)

    return true
  }

  /**
   * Release an in-memory lock
   * @param lockKey The key to unlock
   * @param lockValue The value used when acquiring the lock (for verification)
   * @returns Promise that resolves when lock is released
   */
  private async releaseLock(
    lockKey: string,
    lockValue?: string
  ): Promise<void> {
    // If lockValue is provided, verify it matches before releasing
    if (lockValue) {
      const existingLock = this.activeLocks.get(lockKey)
      if (existingLock && existingLock.lockValue !== lockValue) {
        // Lock was acquired by someone else, don't release it
        return
      }
    }

    // Clear the timeout timer if it exists
    const timer = this.lockTimers.get(lockKey)
    if (timer) {
      clearTimeout(timer)
      this.lockTimers.delete(lockKey)
    }

    // Remove the lock
    this.activeLocks.delete(lockKey)
  }

  /**
   * Lazy load entity counts from the 'noun' field sparse index (O(n) where n = number of types)
   * FIX: Previously read from stats.nounCount which was SERVICE-keyed, not TYPE-keyed
   * Now computes counts from the sparse index which has the correct type information
   */
  private async lazyLoadCounts(): Promise<void> {
    try {
      // CRITICAL FIX - Clear counts before loading to prevent accumulation
      // Previously, counts accumulated across restarts causing 100x inflation
      this.totalEntitiesByType.clear()
      this.entityCountsByTypeFixed.fill(0)
      this.verbCountsByTypeFixed.fill(0)

      // Load counts from sparse index (correct source)
      const nounSparseIndex = await this.loadSparseIndex('noun')
      if (!nounSparseIndex) {
        // No sparse index yet - counts will be populated as entities are added
        return
      }

      // Iterate through all chunks and sum up bitmap sizes by type
      for (const chunkId of nounSparseIndex.getAllChunkIds()) {
        const chunk = await this.chunkManager.loadChunk('noun', chunkId)
        if (chunk) {
          for (const [type, bitmap] of chunk.entries) {
            const currentCount = this.totalEntitiesByType.get(type) || 0
            this.totalEntitiesByType.set(type, currentCount + bitmap.size)
          }
        }
      }

      prodLog.debug(`✅ Loaded type counts from sparse index: ${this.totalEntitiesByType.size} types`)
    } catch (error) {
      // Silently fail - counts will be populated as entities are added
      // This maintains zero-configuration principle
      prodLog.debug('Could not load type counts from sparse index:', error)
    }
  }

  /**
   * Phase 1b: Sync Map-based counts to fixed-size Uint32Arrays
   * This enables gradual migration from Maps to arrays while maintaining backward compatibility
   * Called periodically and on demand to keep both representations in sync
   */
  private syncTypeCountsToFixed(): void {
    // Sync noun counts from totalEntitiesByType Map to entityCountsByTypeFixed array
    for (let i = 0; i < NOUN_TYPE_COUNT; i++) {
      const type = TypeUtils.getNounFromIndex(i)
      const count = this.totalEntitiesByType.get(type) || 0
      this.entityCountsByTypeFixed[i] = count
    }

    // Sync verb counts from totalEntitiesByType Map to verbCountsByTypeFixed array
    // Note: Verb counts are currently tracked alongside noun counts in totalEntitiesByType
    // In the future, we may want a separate Map for verb counts
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const type = TypeUtils.getVerbFromIndex(i)
      const count = this.totalEntitiesByType.get(type) || 0
      this.verbCountsByTypeFixed[i] = count
    }
  }

  /**
   * Phase 1b: Sync from fixed-size arrays back to Maps (reverse direction)
   * Used when Uint32Arrays are the source of truth and need to update Maps
   */
  private syncTypeCountsFromFixed(): void {
    // Sync noun counts from array to Map
    for (let i = 0; i < NOUN_TYPE_COUNT; i++) {
      const count = this.entityCountsByTypeFixed[i]
      if (count > 0) {
        const type = TypeUtils.getNounFromIndex(i)
        this.totalEntitiesByType.set(type, count)
      }
    }

    // Sync verb counts from array to Map
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const count = this.verbCountsByTypeFixed[i]
      if (count > 0) {
        const type = TypeUtils.getVerbFromIndex(i)
        this.totalEntitiesByType.set(type, count)
      }
    }
  }

  /**
   * Update cardinality statistics for a field
   */
  private updateCardinalityStats(field: string, value: any, operation: 'add' | 'remove'): void {
    // Initialize field stats if needed
    if (!this.fieldStats.has(field)) {
      this.fieldStats.set(field, {
        cardinality: {
          uniqueValues: 0,
          totalValues: 0,
          distribution: 'uniform',
          updateFrequency: 0,
          lastAnalyzed: Date.now()
        },
        queryCount: 0,
        rangeQueryCount: 0,
        exactQueryCount: 0,
        avgQueryTime: 0,
        indexType: 'hash'
      })
    }

    const stats = this.fieldStats.get(field)!
    const cardinality = stats.cardinality

    // Track unique values by checking fieldIndex counts
    const fieldIndex = this.fieldIndexes.get(field)
    const normalizedValue = this.normalizeValue(value, field)
    const currentCount = fieldIndex?.values[normalizedValue] || 0

    if (operation === 'add') {
      // If this is a new value (count is 0), increment unique values
      if (currentCount === 0) {
        cardinality.uniqueValues++
      }
      cardinality.totalValues++
    } else if (operation === 'remove') {
      // If count will become 0, decrement unique values
      if (currentCount === 1) {
        cardinality.uniqueValues = Math.max(0, cardinality.uniqueValues - 1)
      }
      cardinality.totalValues = Math.max(0, cardinality.totalValues - 1)
    }

    // Update frequency tracking
    cardinality.updateFrequency++

    // Periodically analyze distribution
    if (++this.operationCount % this.cardinalityUpdateInterval === 0) {
      this.analyzeFieldDistribution(field)
    }

    // Determine optimal index type based on cardinality
    this.updateIndexStrategy(field, stats)
  }

  /**
   * Analyze field distribution for optimization
   */
  private analyzeFieldDistribution(field: string): void {
    const stats = this.fieldStats.get(field)
    if (!stats) return

    const cardinality = stats.cardinality
    const ratio = cardinality.uniqueValues / Math.max(1, cardinality.totalValues)

    // Determine distribution type
    if (ratio > 0.9) {
      cardinality.distribution = 'sparse' // High uniqueness (like IDs, timestamps)
    } else if (ratio < 0.1) {
      cardinality.distribution = 'skewed' // Low uniqueness (like status, type)
    } else {
      cardinality.distribution = 'uniform' // Balanced distribution
    }

    cardinality.lastAnalyzed = Date.now()
  }

  /**
   * Update index strategy based on field statistics
   */
  private updateIndexStrategy(field: string, stats: FieldStats): void {
    const hasHighCardinality = stats.cardinality.uniqueValues > this.HIGH_CARDINALITY_THRESHOLD

    // All fields use chunked sparse indexing with zone maps
    stats.indexType = 'hash'

    // Determine normalization strategy for high cardinality NON-temporal fields
    // (Temporal fields are already bucketed in normalizeValue from the start!)
    if (hasHighCardinality) {
      // Check if field looks numeric (for float precision reduction)
      const fieldLower = field.toLowerCase()
      const looksNumeric = fieldLower.includes('count') || fieldLower.includes('score') ||
                          fieldLower.includes('value') || fieldLower.includes('amount')

      if (looksNumeric) {
        stats.normalizationStrategy = 'precision' // Reduce float precision
      } else {
        stats.normalizationStrategy = 'none' // Keep as-is for strings
      }
    } else {
      stats.normalizationStrategy = 'none'
    }
  }

  // ============================================================================
  // Adaptive Chunked Sparse Indexing
  // All fields use chunking - simplified implementation
  // ============================================================================

  /**
   * Load sparse index from storage
   */
  private async loadSparseIndex(field: string): Promise<SparseIndex | undefined> {
    const indexPath = `__sparse_index__${field}`
    const unifiedKey = `metadata:sparse:${field}`

    return await this.unifiedCache.get(unifiedKey, async () => {
      try {
        const data = await this.storage.getMetadata(indexPath)
        if (data) {
          const sparseIndex = SparseIndex.fromJSON(data)

          // CRITICAL: Initialize chunk ID counter from existing chunks to prevent ID conflicts
          this.chunkManager.initializeNextChunkId(field, sparseIndex)

          // Add to unified cache (sparse indices are expensive to rebuild)
          const size = JSON.stringify(data).length
          this.unifiedCache.set(unifiedKey, sparseIndex, 'metadata', size, 200)

          return sparseIndex
        }
      } catch (error) {
        prodLog.debug(`Failed to load sparse index for field '${field}':`, error)
      }
      return undefined
    })
  }

  /**
   * Save sparse index to storage
   */
  private async saveSparseIndex(field: string, sparseIndex: SparseIndex): Promise<void> {
    const indexPath = `__sparse_index__${field}`
    const unifiedKey = `metadata:sparse:${field}`

    const data = sparseIndex.toJSON()
    await this.storage.saveMetadata(indexPath, data)

    // Update unified cache
    const size = JSON.stringify(data).length
    this.unifiedCache.set(unifiedKey, sparseIndex, 'metadata', size, 200)
  }

  // flushDirtyMetadata — DELETED in 7.22.0. The dirtyChunks / dirtySparseIndices
  // accumulators it drained were never populated after the 7.20.0 column-store
  // refactor (commit 11be039). Column store flush happens in flush() directly.

  /**
   * Get IDs for a value using the legacy chunked sparse index.
   *
   * **This path is only for pre-7.20.0 workspaces** still being migrated to
   * the column store. The write path for sparse indices was removed in
   * commit `11be039` — new workspaces never get them.
   *
   * If neither the column store nor a sparse index covers the field, the
   * function throws `BrainyError(FIELD_NOT_INDEXED)`. Returning `[]` for a
   * genuinely unindexed field was the bug class `BR-FIND-WHERE-ZERO`
   * tracked — a silent empty result indistinguishable from "the data
   * really isn't there."
   */
  private async getIdsFromChunks(field: string, value: any): Promise<string[]> {
    // Load sparse index via UnifiedCache (lazy loading)
    const sparseIndex = await this.loadSparseIndex(field)
    if (!sparseIndex) {
      // No column store match (we'd have returned in getIds()) AND no legacy
      // sparse index for this field — the field is genuinely not indexed.
      // Throw so find()-evaluation can log and translate to [].
      throw BrainyError.fieldNotIndexed(field)
    }

    // Find candidate chunks using zone maps and bloom filters
    const normalizedValue = this.normalizeValue(value, field)
    const candidateChunkIds = sparseIndex.findChunksForValue(normalizedValue)

    if (candidateChunkIds.length === 0) {
      return [] // No chunks contain this value
    }

    // Load chunks and collect integer IDs from roaring bitmaps
    const allIntIds = new Set<number>()
    for (const chunkId of candidateChunkIds) {
      const chunk = await this.chunkManager.loadChunk(field, chunkId)
      if (chunk) {
        const bitmap = chunk.entries.get(normalizedValue)
        if (bitmap) {
          // Iterate through roaring bitmap integers
          for (const intId of bitmap) {
            allIntIds.add(intId)
          }
        }
      }
    }

    // Convert integer IDs back to UUIDs
    return this.idMapper.intsIterableToUuids(allIntIds)
  }

  /**
   * Get IDs for a range using chunked sparse index with zone maps and roaring bitmaps
   * Now fully lazy-loaded via UnifiedCache (no local sparseIndices Map)
   * Normalize min/max for timestamp bucketing before comparison
   */
  private async getIdsFromChunksForRange(
    field: string,
    min?: any,
    max?: any,
    includeMin: boolean = true,
    includeMax: boolean = true
  ): Promise<string[]> {
    // Load sparse index via UnifiedCache (lazy loading)
    const sparseIndex = await this.loadSparseIndex(field)
    if (!sparseIndex) {
      return [] // No chunked index exists yet
    }

    // Normalize min/max for consistent comparison with indexed values
    // (indexed values are bucketed for timestamps, so we must bucket the query bounds too)
    const normalizedMin = min !== undefined ? this.normalizeValue(min, field) : undefined
    const normalizedMax = max !== undefined ? this.normalizeValue(max, field) : undefined

    // Find candidate chunks using zone maps
    const candidateChunkIds = sparseIndex.findChunksForRange(normalizedMin, normalizedMax)

    if (candidateChunkIds.length === 0) {
      return []
    }

    // Load chunks and filter by range, collecting integer IDs from roaring bitmaps
    const allIntIds = new Set<number>()
    for (const chunkId of candidateChunkIds) {
      const chunk = await this.chunkManager.loadChunk(field, chunkId)
      if (chunk) {
        for (const [value, bitmap] of chunk.entries) {
          // Check if value is in range using numeric-aware comparison
          // (normalizeValue converts numbers to strings, so we must compare numerically)
          let inRange = true

          if (normalizedMin !== undefined) {
            const cmp = compareNormalizedValues(value, normalizedMin)
            inRange = inRange && (includeMin ? cmp >= 0 : cmp > 0)
          }

          if (normalizedMax !== undefined) {
            const cmp = compareNormalizedValues(value, normalizedMax)
            inRange = inRange && (includeMax ? cmp <= 0 : cmp < 0)
          }

          if (inRange) {
            // Iterate through roaring bitmap integers
            for (const intId of bitmap) {
              allIntIds.add(intId)
            }
          }
        }
      }
    }

    // Convert integer IDs back to UUIDs
    return this.idMapper.intsIterableToUuids(allIntIds)
  }

  /**
   * Get roaring bitmap for a field-value pair without converting to UUIDs
   * This is used for fast multi-field intersection queries using hardware-accelerated bitmap AND
   * Now fully lazy-loaded via UnifiedCache (no local sparseIndices Map)
   * @returns RoaringBitmap32 containing integer IDs, or null if no matches
   */
  private async getBitmapFromChunks(field: string, value: any): Promise<RoaringBitmap32 | null> {
    // Load sparse index via UnifiedCache (lazy loading)
    const sparseIndex = await this.loadSparseIndex(field)
    if (!sparseIndex) {
      return null // No chunked index exists yet
    }

    // Find candidate chunks using zone maps and bloom filters
    const normalizedValue = this.normalizeValue(value, field)
    const candidateChunkIds = sparseIndex.findChunksForValue(normalizedValue)

    if (candidateChunkIds.length === 0) {
      return null // No chunks contain this value
    }

    // If only one chunk, return its bitmap directly
    if (candidateChunkIds.length === 1) {
      const chunk = await this.chunkManager.loadChunk(field, candidateChunkIds[0])
      if (chunk) {
        const bitmap = chunk.entries.get(normalizedValue)
        return bitmap || null
      }
      return null
    }

    // Multiple chunks: collect all bitmaps and combine with OR
    const bitmaps: RoaringBitmap32[] = []
    for (const chunkId of candidateChunkIds) {
      const chunk = await this.chunkManager.loadChunk(field, chunkId)
      if (chunk) {
        const bitmap = chunk.entries.get(normalizedValue)
        if (bitmap && bitmap.size > 0) {
          bitmaps.push(bitmap)
        }
      }
    }

    if (bitmaps.length === 0) {
      return null
    }

    if (bitmaps.length === 1) {
      return bitmaps[0]
    }

    // Combine multiple bitmaps with OR operation
    return RoaringBitmap32.orMany(bitmaps)
  }

  /**
   * Get IDs for multiple field-value pairs using fast roaring bitmap intersection
   *
   * This method provides 500-900x faster multi-field queries by:
   * - Using hardware-accelerated bitmap AND operations (SIMD: AVX2/SSE4.2)
   * - Avoiding intermediate UUID array allocations
   * - Converting integers to UUIDs only once at the end
   *
   * Example: { status: 'active', role: 'admin', verified: true }
   * Instead of: fetch 3 UUID arrays → convert to Sets → filter intersection
   * We do: fetch 3 bitmaps → hardware AND → convert final bitmap to UUIDs
   *
   * @param fieldValuePairs Array of field-value pairs to intersect
   * @returns Array of UUID strings matching ALL criteria
   */
  /**
   * Multi-field intersection query: find entities matching ALL field-value pairs.
   *
   * Collects roaring bitmaps for each pair via the column store, then
   * intersects them using hardware-accelerated AND operations.
   *
   * @param fieldValuePairs - Array of { field, value } to intersect
   * @returns Array of entity UUID strings matching ALL pairs
   */
  async getIdsForMultipleFields(fieldValuePairs: Array<{ field: string; value: any }>): Promise<string[]> {
    if (fieldValuePairs.length === 0) return []
    if (fieldValuePairs.length === 1) {
      return await this.getIds(fieldValuePairs[0].field, fieldValuePairs[0].value)
    }

    // Collect roaring bitmaps for each field-value pair via column store
    const bitmaps: RoaringBitmap32[] = []
    for (const { field, value } of fieldValuePairs) {
      const bitmap = this.columnStore.hasField(field)
        ? await this.columnStore.filter(field, value)
        : await this.getBitmapFromChunks(field, value) ?? new RoaringBitmap32()

      if (bitmap.size === 0) return [] // Short circuit: empty intersection
      bitmaps.push(bitmap)
    }

    // Intersect all bitmaps (SIMD-accelerated roaring AND)
    let result = bitmaps[0]
    for (let i = 1; i < bitmaps.length; i++) {
      result = RoaringBitmap32.and(result, bitmaps[i])
    }

    return result.size > 0 ? this.idMapper.intsIterableToUuids(result) : []
  }

  // addToChunkedIndex — DELETED. Column store handles all writes.

  // removeFromChunkedIndex — DELETED. Column store handles removes via global deleted bitmap.

  /**
   * Get IDs matching a range query using zone maps
   */
  /**
   * Range query: find all entity IDs where a field's value falls within a range.
   *
   * Routes through the column store for O(log n) binary search when available,
   * falls back to sparse index zone-map scan for fields not yet in the column store.
   *
   * @param field - Field name to query
   * @param min - Lower bound (undefined = no lower bound)
   * @param max - Upper bound (undefined = no upper bound)
   * @param includeMin - Whether to include the lower bound (default: true)
   * @param includeMax - Whether to include the upper bound (default: true)
   * @returns Array of matching entity UUID strings
   */
  private async getIdsForRange(
    field: string,
    min?: any,
    max?: any,
    includeMin: boolean = true,
    includeMax: boolean = true
  ): Promise<string[]> {
    // Track range query for field statistics
    if (this.fieldStats.has(field)) {
      const stats = this.fieldStats.get(field)!
      stats.rangeQueryCount++
    }

    // Column store path: O(log n) binary search on sorted column.
    // Use raw values (no normalization) — column store stores exact values.
    if (this.columnStore && this.columnStore.hasField(field)) {
      const bitmap = await this.columnStore.rangeQuery(field, min, max)
      return this.idMapper.intsIterableToUuids(bitmap)
    }

    // Fallback: sparse index zone-map scan (legacy path)
    return await this.getIdsFromChunksForRange(field, min, max, includeMin, includeMax)
  }

  /**
   * Generate field index filename for filter discovery
   */
  private getFieldIndexFilename(field: string): string {
    return `field_${field}`
  }

  // getValueChunkFilename, makeSafeFilename — DELETED. Sparse index file naming no longer needed.

  /**
   * Normalize value for consistent indexing with VALUE-BASED temporal detection
   *
   * Replaced unreliable field name pattern matching with production-ready
   * value-based detection (DuckDB-inspired). Analyzes actual data values, not names.
   *
   * NO FALLBACKS - Pure value-based detection only.
   */
  private normalizeValue(value: any, field?: string): string {
    if (value === null || value === undefined) return '__NULL__'
    if (typeof value === 'boolean') return value ? '__TRUE__' : '__FALSE__'

    // VALUE-BASED temporal detection (no pattern matching!)
    // Analyze the VALUE itself to determine if it's a timestamp
    if (typeof value === 'number') {
      // Check if value looks like a Unix timestamp (2000-01-01 to 2100-01-01)
      const MIN_TIMESTAMP_S = 946684800      // 2000-01-01 in seconds
      const MAX_TIMESTAMP_S = 4102444800     // 2100-01-01 in seconds
      const MIN_TIMESTAMP_MS = MIN_TIMESTAMP_S * 1000
      const MAX_TIMESTAMP_MS = MAX_TIMESTAMP_S * 1000

      const isTimestampSeconds = value >= MIN_TIMESTAMP_S && value <= MAX_TIMESTAMP_S
      const isTimestampMilliseconds = value >= MIN_TIMESTAMP_MS && value <= MAX_TIMESTAMP_MS

      if (isTimestampSeconds || isTimestampMilliseconds) {
        // VALUE is a timestamp! Apply 1-minute bucketing
        const bucketSize = this.TIMESTAMP_PRECISION_MS  // 60000ms = 1 minute
        const bucketed = Math.floor(value / bucketSize) * bucketSize
        return bucketed.toString()
      }
    }

    // Check if string value is ISO 8601 datetime
    if (typeof value === 'string') {
      // ISO 8601 pattern: YYYY-MM-DDTHH:MM:SS...
      const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      if (iso8601Pattern.test(value)) {
        // VALUE is an ISO 8601 datetime! Convert to timestamp and bucket
        try {
          const timestamp = new Date(value).getTime()
          if (!isNaN(timestamp)) {
            const bucketSize = this.TIMESTAMP_PRECISION_MS
            const bucketed = Math.floor(timestamp / bucketSize) * bucketSize
            return bucketed.toString()
          }
        } catch {
          // Not a valid date, treat as string
        }
      }
    }

    // Apply smart normalization based on field statistics (for non-temporal fields)
    if (field && this.fieldStats.has(field)) {
      const stats = this.fieldStats.get(field)!
      const strategy = stats.normalizationStrategy

      if (strategy === 'precision' && typeof value === 'number') {
        // Reduce float precision for high cardinality numeric fields
        const rounded = Math.round(value * Math.pow(10, this.FLOAT_PRECISION)) / Math.pow(10, this.FLOAT_PRECISION)
        return rounded.toString()
      }
    }

    // Default normalization
    if (typeof value === 'number') return value.toString()
    if (Array.isArray(value)) {
      const joined = value.map(v => this.normalizeValue(v, field)).join(',')
      // Hash very long array values to avoid filesystem limits
      if (joined.length > 100) {
        return this.hashValue(joined)
      }
      return joined
    }
    const stringValue = String(value).toLowerCase().trim()
    // Hash very long string values to avoid filesystem limits
    if (stringValue.length > 100) {
      return this.hashValue(stringValue)
    }
    return stringValue
  }

  /**
   * Create a short hash for long values to avoid filesystem filename limits
   */
  private hashValue(value: string): string {
    // Simple hash function to create shorter keys
    let hash = 0
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `__HASH_${Math.abs(hash).toString(36)}`
  }

  /**
   * Check if field should be indexed
   */
  private shouldIndexField(field: string): boolean {
    if (this.config.excludeFields.includes(field)) return false
    if (this.config.indexedFields.length > 0) {
      return this.config.indexedFields.includes(field)
    }
    return true
  }

  /**
   * Extract indexable field-value pairs from entity or metadata
   *
   * Now handles BOTH entity structure (with top-level fields) AND plain metadata
   * - Extracts from top-level fields (confidence, weight, timestamps, type, service, etc.)
   * - Also extracts from nested metadata field (custom user fields)
   * - Skips HNSW-specific fields (vector, connections, level, id)
   * - Maps 'type' → 'noun' for backward compatibility with existing indexes
   *
   * BUG FIX: Exclude vector embeddings and large arrays from indexing
   * BUG FIX: Also exclude purely numeric field names (array indices)
   * - Vector fields (384+ dimensions) were creating 825K chunk files for 1,144 entities
   * - Arrays converted to objects with numeric keys were still being indexed
   */
  private extractIndexableFields(data: any): Array<{ field: string, value: any }> {
    const fields: Array<{ field: string, value: any }> = []

    // Fields that should NEVER be indexed (vectors, embeddings, large arrays, HNSW internals)
    const NEVER_INDEX = new Set(['vector', 'embedding', 'embeddings', 'connections', 'level', 'id'])

    const extract = (obj: any, prefix = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key

        // Skip fields in never-index list (CRITICAL: prevents vector indexing bug + HNSW fields)
        if (!prefix && NEVER_INDEX.has(key)) continue

        // Skip purely numeric field names (array indices converted to object keys)
        // Legitimate field names should never be purely numeric
        // This catches vectors stored as objects: {0: 0.1, 1: 0.2, ...}
        if (/^\d+$/.test(key)) continue

        // Skip fields based on user configuration
        if (!this.shouldIndexField(fullKey)) continue

        // Special handling for metadata field at top level
        // Flatten metadata fields to top-level (no prefix) for cleaner queries
        // Standard fields are already at top-level, custom fields go in metadata
        // By flattening here, queries can use { category: 'B' } instead of { 'metadata.category': 'B' }
        if (key === 'metadata' && !prefix && typeof value === 'object' && !Array.isArray(value)) {
          extract(value, '')  // Flatten to top-level, no prefix
          continue
        }

        // Skip large arrays (> 10 elements) - likely vectors or bulk data
        if (Array.isArray(value) && value.length > 10) continue

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Recurse into nested objects (but not arrays)
          extract(value, fullKey)
        } else if (Array.isArray(value) && value.length <= 10) {
          // Small arrays: index as multi-value field (all with same field name)
          // Example: tags: ["javascript", "node"] → field="tags", value="javascript" + field="tags", value="node"
          for (const item of value) {
            // Only index primitive values (not nested objects/arrays)
            if (item !== null && typeof item !== 'object') {
              fields.push({ field: fullKey, value: item })
            }
          }
        } else {
          // Primitive value: index it
          // Map 'type' → 'noun' for backward compatibility
          const indexField = (!prefix && key === 'type') ? 'noun' : fullKey
          fields.push({ field: indexField, value })
        }
      }
    }

    if (data && typeof data === 'object') {
      extract(data)
    }

    // Extract words for hybrid text search
    // Production-scale word limit (5000 words)
    // - Handles articles, chapters, and large documents
    // - Roaring Bitmaps + Chunked Sparse Index + LRU caching
    // - Int32 hashes store words as 4-byte values, not strings
    //
    // Memory managed by existing optimizations:
    // - Roaring Bitmaps: 90%+ compression for sparse data
    // - Chunked Sparse Index: ~50 values per chunk, lazy-loaded
    // - UnifiedCache LRU: Only hot chunks in memory
    //
    // Future: Bloom filter hybrid for unlimited words (see .strategy/BILLION-SCALE-PLAN.md)
    const textContent = this.extractTextContent(data)
    if (textContent) {
      const MAX_WORDS_PER_ENTITY = 5000  // Handles articles/chapters, memory-safe at scale
      const allWords = this.tokenize(textContent)
      const words = allWords.slice(0, MAX_WORDS_PER_ENTITY)

      if (allWords.length > MAX_WORDS_PER_ENTITY) {
        // Log once per entity, not per word - avoids log spam
        prodLog.debug(
          `Entity text has ${allWords.length} words, indexing first ${MAX_WORDS_PER_ENTITY} for hybrid search`
        )
      }

      for (const word of words) {
        // Hash word to int32 for memory efficiency (saves ~10GB at 1B scale)
        const wordHash = this.hashWord(word)
        fields.push({ field: '__words__', value: wordHash })
      }
    }

    return fields
  }

  /**
   * Extract text content from entity data for word indexing
   *
   * Recursively extracts string values from data, excluding:
   * - vector, embedding, connections, level, id (internal fields)
   * - Arrays with more than 10 elements (likely vectors/bulk data)
   * - Numeric-only keys (array indices)
   *
   * @param data - Entity data or metadata
   * @returns Concatenated text content
   */
  extractTextContent(data: any): string {
    if (data === null || data === undefined) return ''
    if (typeof data === 'string') return data
    if (typeof data === 'number' || typeof data === 'boolean') return String(data)
    if (Array.isArray(data)) {
      // Skip numeric arrays (vectors/embeddings), allow object/string arrays
      if (data.length > 0 && typeof data[0] === 'number') return ''
      return data.map(d => this.extractTextContent(d)).filter(Boolean).join(' ')
    }
    if (typeof data === 'object') {
      const skipKeys = new Set(['vector', 'embedding', 'embeddings', 'connections', 'level', 'id'])
      const texts: string[] = []
      for (const [key, value] of Object.entries(data)) {
        // Skip internal fields and numeric keys (array indices)
        if (skipKeys.has(key) || /^\d+$/.test(key)) continue
        const text = this.extractTextContent(value)
        if (text) texts.push(text)
      }
      return texts.join(' ')
    }
    return ''
  }

  /**
   * Tokenize text into words for indexing
   *
   * - Converts to lowercase
   * - Removes punctuation
   * - Splits on whitespace
   * - Filters by length (2-50 chars)
   * - Deduplicates per entity
   *
   * @param text - Text content to tokenize
   * @returns Array of unique words
   */
  tokenize(text: string): string[] {
    if (!text) return []
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove punctuation
      .split(/\s+/)               // Split on whitespace
      .filter(w => w.length >= 2 && w.length <= 50)  // Length filter
      .filter((w, i, arr) => arr.indexOf(w) === i)   // Dedupe per entity
  }

  /**
   * Hash word to int32 using FNV-1a
   *
   * FNV-1a is fast with low collision rate, suitable for word hashing.
   * Saves ~10GB at billion scale by avoiding string storage.
   *
   * @param word - Word to hash
   * @returns Int32 hash value
   */
  hashWord(word: string): number {
    let hash = 2166136261  // FNV offset basis
    for (let i = 0; i < word.length; i++) {
      hash ^= word.charCodeAt(i)
      hash = Math.imul(hash, 16777619)  // FNV prime
    }
    return hash | 0  // Convert to signed int32
  }

  /**
   * Get entity IDs matching a text query
   *
   * Performs word-based text search using the __words__ index.
   * Returns IDs ranked by match count (entities with more matching words first).
   *
   * @param query - Text query to search for
   * @returns Array of { id, matchCount } sorted by matchCount descending
   */
  async getIdsForTextQuery(query: string): Promise<Array<{ id: string; matchCount: number }>> {
    const queryWords = this.tokenize(query)
    if (queryWords.length === 0) return []

    // Get IDs for each word hash
    const wordIdSets: Map<string, number>[] = []
    for (const word of queryWords) {
      const wordHash = this.hashWord(word)
      let ids: string[]
      try {
        ids = await this.getIds('__words__', wordHash)
      } catch (err) {
        // `__words__` is not yet indexed (e.g. no text content has been
        // added). Treat as no matches and continue — text search against
        // an empty workspace should return [], not throw.
        if (err instanceof BrainyError && err.type === 'FIELD_NOT_INDEXED') {
          ids = []
        } else {
          throw err
        }
      }
      const idSet = new Map<string, number>()
      for (const id of ids) {
        idSet.set(id, 1)
      }
      wordIdSets.push(idSet)
    }

    if (wordIdSets.length === 0) return []

    // Count matches per entity
    const matchCounts = new Map<string, number>()
    for (const idSet of wordIdSets) {
      for (const [id] of idSet) {
        matchCounts.set(id, (matchCounts.get(id) || 0) + 1)
      }
    }

    // Sort by match count descending
    return Array.from(matchCounts.entries())
      .map(([id, matchCount]) => ({ id, matchCount }))
      .sort((a, b) => b.matchCount - a.matchCount)
  }

  /**
   * Add item to metadata indexes
   *
   * Now accepts either entity structure or plain metadata
   * - Entity structure: { id, type, confidence, weight, createdAt, metadata: {...} }
   * - Plain metadata: { noun, confidence, weight, createdAt, ... }
   *
   * @param id - Entity ID
   * @param entityOrMetadata - Either full entity structure or plain metadata (backward compat)
   * @param skipFlush - Skip automatic flush (used during batch operations)
   */
  async addToIndex(id: string, entityOrMetadata: any, skipFlush: boolean = false, deferWrites: boolean = false): Promise<void> {
    const fields = this.extractIndexableFields(entityOrMetadata)

    // Sanity check for excessive indexed fields (indicates possible data issue)
    // Separate threshold for metadata fields vs word fields
    // - Metadata fields: warn if > 100 (indicates deeply nested metadata)
    // - Word fields: expected to be many for large documents, warn only for extreme cases
    const metadataFields = fields.filter(f => f.field !== '__words__')
    const wordFields = fields.filter(f => f.field === '__words__')

    if (metadataFields.length > 100) {
      prodLog.warn(
        `Entity ${id} has ${metadataFields.length} metadata fields (expected ~30). ` +
        `Possible deeply nested metadata. First 10 fields: ${metadataFields.slice(0, 10).map(f => f.field).join(', ')}`
      )
    }

    // Words are expected to be many for large documents - only log for extreme cases
    if (wordFields.length > 5000) {
      prodLog.debug(`Entity ${id} has ${wordFields.length} indexed words (large document)`)
    }

    // Sort fields to process 'noun' field first for type-field affinity tracking
    fields.sort((a, b) => {
      if (a.field === 'noun') return -1
      if (b.field === 'noun') return 1
      return 0
    })

    // Update statistics and tracking for each field
    for (let i = 0; i < fields.length; i++) {
      const { field, value } = fields[i]
      this.updateCardinalityStats(field, value, 'add')
      this.updateTypeFieldAffinity(id, field, value, 'add', entityOrMetadata)
      await this.updateFieldIndex(field, value, 1)
    }

    // Write to column store — the single write path for all indexed data.
    // Converts extracted fields into a map and feeds the column store.
    if (this.columnStore) {
      const entityIntId = this.idMapper.getOrAssign(id)
      const fieldsMap: Record<string, unknown> = {}
      for (const { field, value } of fields) {
        if (field === '__words__') {
          if (!fieldsMap.__words__) fieldsMap.__words__ = []
          ;(fieldsMap.__words__ as number[]).push(value)
        } else {
          fieldsMap[field] = value
        }
      }
      this.columnStore.addEntity(entityIntId, fieldsMap)
    }

    // Adaptive auto-flush based on usage patterns
    if (!skipFlush) {
      const timeSinceLastFlush = Date.now() - this.lastFlushTime
      const shouldAutoFlush =
        this.dirtyFields.size >= this.autoFlushThreshold || // Size threshold
        (this.dirtyFields.size > 10 && timeSinceLastFlush > 5000) // Time threshold (5 seconds)

      if (shouldAutoFlush) {
        const startTime = Date.now()
        await this.flush()
        const flushTime = Date.now() - startTime

        // Adapt threshold based on flush performance
        if (flushTime < 50) {
          // Fast flush, can handle more entries
          this.autoFlushThreshold = Math.min(200, this.autoFlushThreshold * 1.2)
        } else if (flushTime > 200) {
          // Slow flush, reduce batch size
          this.autoFlushThreshold = Math.max(20, this.autoFlushThreshold * 0.8)
        }

        // Yield to event loop after flush to prevent blocking
        await this.yieldToEventLoop()
      }
    }
    
    // Invalidate cache for these fields
    for (const { field } of fields) {
      this.metadataCache.invalidatePattern(`field_values_${field}`)
    }
  }

  /**
   * Update field index with value count
   */
  private async updateFieldIndex(field: string, value: any, delta: number): Promise<void> {
    let fieldIndex = this.fieldIndexes.get(field)
    
    if (!fieldIndex) {
      // Load from storage if not in memory
      fieldIndex = await this.loadFieldIndex(field) ?? {
        values: {},
        lastUpdated: Date.now()
      }
      this.fieldIndexes.set(field, fieldIndex)
    }

    const normalizedValue = this.normalizeValue(value, field)  // Pass field for bucketing!
    fieldIndex.values[normalizedValue] = (fieldIndex.values[normalizedValue] || 0) + delta
    
    // Remove if count drops to 0
    if (fieldIndex.values[normalizedValue] <= 0) {
      delete fieldIndex.values[normalizedValue]
    }
    
    fieldIndex.lastUpdated = Date.now()
    this.dirtyFields.add(field)
  }

  /**
   * Remove item from metadata indexes
   *
   * Now accepts either entity structure or plain metadata (same as addToIndex)
   * - Entity structure: { id, type, confidence, weight, createdAt, metadata: {...} }
   * - Plain metadata: { noun, confidence, weight, createdAt, ... }
   *
   * @param id - Entity ID to remove
   * @param metadata - Optional entity or metadata structure (if not provided, requires scanning all fields - slow!)
   */
  async removeFromIndex(id: string, metadata?: any): Promise<void> {
    if (metadata) {
      const fields = this.extractIndexableFields(metadata)

      // Update statistics and tracking
      for (const { field, value } of fields) {
        this.updateCardinalityStats(field, value, 'remove')
        this.updateTypeFieldAffinity(id, field, value, 'remove', metadata)
        await this.updateFieldIndex(field, value, -1)
        this.metadataCache.invalidatePattern(`field_values_${field}`)
      }
    }

    // Remove from column store (global deleted bitmap)
    if (this.columnStore) {
      const intId = this.idMapper.getInt(id)
      if (intId !== undefined) {
        this.columnStore.removeEntity(intId)
      }
    }

    // Clean up ID mapper — must happen AFTER column store removal since it uses
    // idMapper.getInt(id). Prevents deleted IDs from persisting in the mapper
    // universe, which would cause ne/exists:false queries to return deleted entities.
    this.idMapper.remove(id)
    await this.idMapper.flush()
  }

  /**
   * Get all IDs in the index
   */
  async getAllIds(): Promise<string[]> {
    // Use storage as the source of truth
    const allIds = new Set<string>()

    // Storage.getNouns() is the definitive source of all entity IDs
    if (this.storage && typeof (this.storage as any).getNouns === 'function') {
      try {
        const result = await (this.storage as any).getNouns({
          pagination: { limit: 100000 }
        })
        if (result && result.items) {
          result.items.forEach((item: any) => {
            if (item.id) allIds.add(item.id)
          })
        }
      } catch (e) {
        // If storage method fails, return empty array
        prodLog.warn('Failed to get all IDs from storage:', e)
        return []
      }
    }

    return Array.from(allIds)
  }

  /**
   * Get IDs for a specific field-value combination using chunked sparse index
   */
  /**
   * Point query: find all entity IDs where a field has a specific value.
   *
   * Routes through the column store for O(log n) binary search when available,
   * falls back to sparse index scan for fields not yet in the column store.
   *
   * @param field - Field name to query
   * @param value - Exact value to match
   * @returns Array of matching entity UUID strings
   */
  /**
   * Report which index path a `where` clause on `field` will hit. Used by
   * `brain.explain()` so an operator can see *before* running a query whether
   * the field has any index entries at all. A `find({ where: { someField: ... } })`
   * against a field with no index entries returns `[]` silently — `explainField`
   * surfaces that as `path: 'none'` so the empty result has an explanation.
   */
  async explainField(field: string): Promise<{
    path: 'column-store' | 'sparse-chunked' | 'none'
    notes?: string
  }> {
    if (this.columnStore && this.columnStore.hasField(field)) {
      return {
        path: 'column-store',
        notes: 'O(log n) binary search + roaring bitmap. Best path.'
      }
    }
    const sparse = await this.loadSparseIndex(field)
    if (sparse) {
      return {
        path: 'sparse-chunked',
        notes: 'Chunked sparse index with zone maps and bloom filters.'
      }
    }
    return {
      path: 'none',
      notes:
        `No index entries for field "${field}". A find({ where: { ${field}: ... } }) ` +
        `will return an empty result regardless of whether matching entities exist on disk. ` +
        `Likely causes: (1) the writer registered the field in memory but has not flushed; ` +
        `(2) the field name does not match what was written (typo or casing); ` +
        `(3) the field is genuinely absent from all entities. Call requestFlush() on the ` +
        `writer or call brain.flush() before relying on the result.`
    }
  }

  /**
   * Resolve a `where: { field: value }` clause to entity UUIDs.
   *
   * Lookup order:
   *   1. **Column store** — the post-7.20.0 single source of truth. Fast.
   *   2. **Legacy sparse index** — only consulted for pre-7.20.0 workspaces
   *      that haven't been migrated. Returns `[]` if no sparse data either.
   *
   * Throws `BrainyError(FIELD_NOT_INDEXED)` if the field has no entries in
   * either store. Callers in find()-evaluation catch this and translate to
   * an empty result with a logged warning. The throw aligns the production
   * `find()` path with the `brain.explain()` diagnostic, so the silent-
   * empty bug class (BR-FIND-WHERE-ZERO) is no longer possible.
   */
  async getIds(field: string, value: any): Promise<string[]> {
    // Track exact query for field statistics
    if (this.fieldStats.has(field)) {
      const stats = this.fieldStats.get(field)!
      stats.exactQueryCount++
    }

    // Column store path: O(log n) binary search + roaring bitmap.
    // Use raw value (no normalization) — the column store stores exact values,
    // not the bucketed/stringified format the sparse index uses.
    if (this.columnStore && this.columnStore.hasField(field)) {
      const bitmap = await this.columnStore.filter(field, value)
      return this.idMapper.intsIterableToUuids(bitmap)
    }

    // Fallback: sparse index scan (legacy path during migration). If neither
    // store has the field, throw FIELD_NOT_INDEXED so the caller knows it's a
    // genuine "no such index" rather than "the value isn't there".
    return await this.getIdsFromChunks(field, value)
  }

  /**
   * Get all available values for a field (for filter discovery)
   */
  async getFilterValues(field: string): Promise<string[]> {
    // Check cache first
    const cacheKey = `field_values_${field}`
    const cachedValues = this.metadataCache.get(cacheKey)
    if (cachedValues) {
      return cachedValues
    }
    
    // Check in-memory field indexes first
    let fieldIndex = this.fieldIndexes.get(field)
    
    // If not in memory, load from storage
    if (!fieldIndex) {
      const loaded = await this.loadFieldIndex(field)
      if (loaded) {
        fieldIndex = loaded
        this.fieldIndexes.set(field, loaded)
      }
    }
    
    if (!fieldIndex) {
      return []
    }
    
    const values = Object.keys(fieldIndex.values)
    
    // Cache the result
    this.metadataCache.set(cacheKey, values)
    
    return values
  }

  /**
   * Get all indexed fields (for filter discovery)
   */
  async getFilterFields(): Promise<string[]> {
    // Check cache first
    const cacheKey = 'all_filter_fields'
    const cachedFields = this.metadataCache.get(cacheKey)
    if (cachedFields) {
      return cachedFields
    }
    
    // Get fields from in-memory indexes and storage
    const fields = new Set<string>(this.fieldIndexes.keys())
    
    // Also scan storage for persisted field indexes (in case not loaded)
    // This would require a new storage method to list field indexes
    // For now, just use in-memory fields
    
    const fieldsArray = Array.from(fields)
    
    // Cache the result
    this.metadataCache.set(cacheKey, fieldsArray)
    
    return fieldsArray
  }

  /**
   * Convert Brainy Field Operator filter to simple field-value criteria for indexing
   */
  private convertFilterToCriteria(filter: any): Array<{ field: string, values: any[] }> {
    const criteria: Array<{ field: string, values: any[] }> = []
    
    if (!filter || typeof filter !== 'object') {
      return criteria
    }
    
    for (const [key, value] of Object.entries(filter)) {
      // Skip logical operators for now - handle them separately
      if (key === 'allOf' || key === 'anyOf' || key === 'not') continue
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Handle Brainy Field Operators
        for (const [op, operand] of Object.entries(value)) {
          switch (op) {
            case 'oneOf':
              if (Array.isArray(operand)) {
                criteria.push({ field: key, values: operand })
              }
              break
            case 'equals':
            case 'is':
            case 'eq':
              criteria.push({ field: key, values: [operand] })
              break
            case 'contains':
              // For contains, the operand is the value we're looking for in an array field
              criteria.push({ field: key, values: [operand] })
              break
            case 'greaterThan':
            case 'lessThan':
            case 'greaterEqual':
            case 'lessEqual':
            case 'between':
              // Range queries will be handled separately
              // Sorted index will be created/loaded when needed in getIdsForRange
              break
            default:
              break
          }
        }
      } else {
        // Direct value or array
        const values = Array.isArray(value) ? value : [value]
        criteria.push({ field: key, values })
      }
    }
    
    return criteria
  }

  /**
   * Get IDs matching Brainy Field Operator metadata filter using indexes where possible
   */
  async getIdsForFilter(filter: any): Promise<string[]> {
    if (!filter || Object.keys(filter).length === 0) {
      return []
    }
    
    // Handle logical operators
    if (filter.allOf && Array.isArray(filter.allOf)) {
      // For allOf, we need intersection of all sub-filters
      const allIds: string[][] = []
      for (const subFilter of filter.allOf) {
        const subIds = await this.getIdsForFilter(subFilter)
        allIds.push(subIds)
      }
      
      if (allIds.length === 0) return []
      if (allIds.length === 1) return allIds[0]

      // Set-based intersection O(n) — start with smallest set for optimal perf
      const sorted = allIds.sort((a, b) => a.length - b.length)
      let result = new Set(sorted[0])
      for (let i = 1; i < sorted.length; i++) {
        const current = new Set(sorted[i])
        result = new Set([...result].filter(id => current.has(id)))
      }
      return Array.from(result)
    }

    if (filter.anyOf && Array.isArray(filter.anyOf)) {
      // For anyOf, we need union of all sub-filters
      const unionIds = new Set<string>()
      for (const subFilter of filter.anyOf) {
        const subIds = await this.getIdsForFilter(subFilter)
        subIds.forEach(id => unionIds.add(id))
      }

      // Fix - Check for outer-level field conditions that need AND application
      // This handles cases like { anyOf: [...], vfsType: { exists: false } }
      // where the anyOf results must be intersected with other field conditions
      const outerFields = Object.keys(filter).filter(
        (k) => k !== 'anyOf' && k !== 'allOf' && k !== 'not'
      )
      if (outerFields.length > 0) {
        // Build filter with just outer fields and get matching IDs
        const outerFilter: any = {}
        for (const field of outerFields) {
          outerFilter[field] = filter[field]
        }
        const outerIds = await this.getIdsForFilter(outerFilter)
        const outerIdSet = new Set(outerIds)
        // Intersect: anyOf union AND outer field conditions
        return Array.from(unionIds).filter((id) => outerIdSet.has(id))
      }

      return Array.from(unionIds)
    }

    // Process field filters with range support
    const idSets: string[][] = []
    // Capture field-not-indexed warnings so we log once per find() call,
    // not once per AND-clause inside it.
    const unindexedFields: string[] = []

    for (const [field, condition] of Object.entries(filter)) {
      // Skip logical operators
      if (field === 'allOf' || field === 'anyOf' || field === 'not') continue

      let fieldResults: string[] = []

      try {
        // The block below evaluates one field clause. If `getIds()` throws
        // FIELD_NOT_INDEXED (no column-store and no legacy sparse index for
        // this field), we treat the clause as matching zero entities. This
        // makes the production `find()` path consistent with the
        // `brain.explain()` diagnostic: an unindexed field returns no
        // results AND logs a warning, instead of silently returning [].
      if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
        // Handle Brainy Field Operators (canonical operators defined)
        // See docs/api/README.md for complete operator reference
        for (const [op, operand] of Object.entries(condition)) {
          switch (op) {
            // ===== EQUALITY OPERATORS =====
            // Canonical: 'eq' | Alias: 'equals' | Deprecated: 'is'
            case 'is':  // DEPRECATED: Use 'eq' instead
            case 'equals':  // Alias for 'eq'
            case 'eq':
              fieldResults = await this.getIds(field, operand)
              break

            // ===== NEGATION OPERATORS =====
            // Canonical: 'ne' | Alias: 'notEquals' | Deprecated: 'isNot'
            case 'isNot':  // DEPRECATED: Use 'ne' instead
            case 'notEquals':  // Alias for 'ne'
            case 'ne': {
              // For notEquals, we need all IDs EXCEPT those matching the value
              // This is especially important for soft delete: deleted !== true
              // should include items without a deleted field

              // Use EntityIdMapper universe (in-memory) instead of getAllIds() storage scan
              const allKnownIds = this.idMapper.intsIterableToUuids(this.idMapper.getAllIntIds())

              // Then get IDs that match the value we want to exclude
              const excludeIds = await this.getIds(field, operand)
              const excludeSet = new Set(excludeIds)

              // Return all IDs except those to exclude
              fieldResults = allKnownIds.filter(id => !excludeSet.has(id))
              break
            }

            // ===== MULTI-VALUE OPERATORS =====
            // Canonical: 'in' | Alias: 'oneOf'
            case 'oneOf':  // Alias for 'in'
            case 'in':
              if (Array.isArray(operand)) {
                const unionIds = new Set<string>()
                for (const value of operand) {
                  const ids = await this.getIds(field, value)
                  ids.forEach(id => unionIds.add(id))
                }
                fieldResults = Array.from(unionIds)
              }
              break

            // ===== GREATER THAN OPERATORS =====
            // Canonical: 'gt' | Alias: 'greaterThan'
            case 'greaterThan':  // Alias for 'gt'
            case 'gt':
              fieldResults = await this.getIdsForRange(field, operand, undefined, false, true)
              break

            // ===== GREATER THAN OR EQUAL OPERATORS =====
            // Canonical: 'gte' | Alias: 'greaterThanOrEqual' | Deprecated: 'greaterEqual'
            case 'greaterEqual':  // DEPRECATED: Use 'gte' instead
            case 'greaterThanOrEqual':  // Alias for 'gte'
            case 'gte':
              fieldResults = await this.getIdsForRange(field, operand, undefined, true, true)
              break

            // ===== LESS THAN OPERATORS =====
            // Canonical: 'lt' | Alias: 'lessThan'
            case 'lessThan':  // Alias for 'lt'
            case 'lt':
              fieldResults = await this.getIdsForRange(field, undefined, operand, true, false)
              break

            // ===== LESS THAN OR EQUAL OPERATORS =====
            // Canonical: 'lte' | Alias: 'lessThanOrEqual' | Deprecated: 'lessEqual'
            case 'lessEqual':  // DEPRECATED: Use 'lte' instead
            case 'lessThanOrEqual':  // Alias for 'lte'
            case 'lte':
              fieldResults = await this.getIdsForRange(field, undefined, operand, true, true)
              break

            // ===== RANGE OPERATOR =====
            // between: [min, max] - inclusive range query
            case 'between':
              if (Array.isArray(operand) && operand.length === 2) {
                fieldResults = await this.getIdsForRange(field, operand[0], operand[1], true, true)
              }
              break

            // ===== ARRAY CONTAINS OPERATOR =====
            // contains: value - check if array field contains value
            case 'contains':
              fieldResults = await this.getIds(field, operand)
              break

            // ===== EXISTENCE OPERATOR =====
            // exists: boolean - check if field exists (any value)
            case 'exists': {
              // Column store path: rangeQuery with no bounds returns all IDs for the field
              const existsBitmap = (this.columnStore && this.columnStore.hasField(field))
                ? await this.columnStore.rangeQuery(field)
                : await this.getExistsBitmapLegacy(field)

              if (operand) {
                // exists: true — entities that HAVE this field
                fieldResults = this.idMapper.intsIterableToUuids(existsBitmap)
              } else {
                // exists: false — entities that DON'T have this field
                const allKnownIds = this.idMapper.intsIterableToUuids(this.idMapper.getAllIntIds())
                const existsUuids = this.idMapper.intsIterableToUuids(existsBitmap)
                const existsSet = new Set(existsUuids)
                fieldResults = allKnownIds.filter(id => !existsSet.has(id))
              }
              break
            }

            // ===== MISSING OPERATOR =====
            // missing: boolean - equivalent to exists: !boolean
            case 'missing': {
              const missingBitmap = (this.columnStore && this.columnStore.hasField(field))
                ? await this.columnStore.rangeQuery(field)
                : await this.getExistsBitmapLegacy(field)

              if (operand) {
                // missing: true — entities that DON'T have this field (same as exists: false)
                const allKnownIds = this.idMapper.intsIterableToUuids(this.idMapper.getAllIntIds())
                const existsUuids = this.idMapper.intsIterableToUuids(missingBitmap)
                const existsSet = new Set(existsUuids)
                fieldResults = allKnownIds.filter(id => !existsSet.has(id))
              } else {
                // missing: false — entities that HAVE this field (same as exists: true)
                fieldResults = this.idMapper.intsIterableToUuids(missingBitmap)
              }
              break
            }
          }
        }
      } else {
        // Direct value match (shorthand for 'eq' operator)
        fieldResults = await this.getIds(field, condition)
      }
      } catch (err) {
        if (err instanceof BrainyError && err.type === 'FIELD_NOT_INDEXED') {
          unindexedFields.push(field)
          fieldResults = []
        } else {
          throw err
        }
      }

      if (fieldResults.length > 0) {
        idSets.push(fieldResults)
      } else {
        // If any field has no matches, intersection will be empty
        if (unindexedFields.length > 0) {
          prodLog.warn(
            `[brainy] find() where-clause referenced unindexed field(s): ` +
            `${unindexedFields.join(', ')}. Returning []. Use ` +
            `brain.explain({ where: {...} }) for diagnostics.`
          )
        }
        return []
      }
    }

    if (idSets.length === 0) return []
    if (unindexedFields.length > 0) {
      prodLog.warn(
        `[brainy] find() where-clause referenced unindexed field(s) ` +
        `${unindexedFields.join(', ')}; their clauses contributed no rows. ` +
        `Use brain.explain({ where: {...} }) for diagnostics.`
      )
    }
    if (idSets.length === 1) return idSets[0]

    // Set-based intersection O(n) — start with smallest set for optimal perf
    const sortedSets = idSets.sort((a, b) => a.length - b.length)
    let resultSet = new Set(sortedSets[0])
    for (let i = 1; i < sortedSets.length; i++) {
      const current = new Set(sortedSets[i])
      resultSet = new Set([...resultSet].filter(id => current.has(id)))
    }
    return Array.from(resultSet)
  }

  /**
   * Legacy helper: get all entity int IDs that have any value for a field,
   * using the sparse index. Used by exists/missing operators when the
   * column store doesn't have data for the field.
   *
   * @param field - Field name
   * @returns Roaring bitmap of entity int IDs (or iterable for compatibility)
   * @private
   */
  private async getExistsBitmapLegacy(field: string): Promise<Iterable<number>> {
    const allIntIds = new Set<number>()
    const sparseIndex = await this.loadSparseIndex(field)
    if (sparseIndex) {
      for (const chunkId of sparseIndex.getAllChunkIds()) {
        const chunk = await this.chunkManager.loadChunk(field, chunkId)
        if (chunk) {
          for (const bitmap of chunk.entries.values()) {
            for (const intId of bitmap) {
              allIntIds.add(intId)
            }
          }
        }
      }
    }
    return allIntIds
  }

  /**
   * Get filtered IDs sorted by a field (production-scale sorting)
   *
   * **Performance Characteristics** (designed for billions of entities):
   * - **Filtering**: O(log n) using roaring bitmaps with SIMD acceleration
   * - **Field Loading**: O(k) where k = filtered result count (NOT O(n))
   * - **Sorting**: O(k log k) in-memory (IDs + sort values only, NOT full entities)
   * - **Memory**: O(k) for k filtered results, independent of total entity count
   *
   * **Scalability**:
   * - Total entities: Billions (memory usage unaffected)
   * - Filtered set: Up to 10M (reasonable for in-memory sort of ID+value pairs)
   * - Pagination: Happens AFTER sorting, so only page entities are loaded
   *
   * **Example**:
   * ```typescript
   * // Production-scale: 1B entities, 100K match filter, sort by createdAt
   * const sortedIds = await metadataIndex.getSortedIdsForFilter(
   *   { status: 'published', category: 'AI' },
   *   'createdAt',
   *   'desc'
   * )
   * // Returns: 100K sorted IDs
   * // Memory: ~5MB (100K IDs + 100K timestamps)
   * // Then caller paginates: sortedIds.slice(0, 20) and loads only 20 entities
   * ```
   *
   * @param filter - Metadata filter criteria (uses roaring bitmaps)
   * @param orderBy - Field name to sort by (e.g., 'createdAt', 'title')
   * @param order - Sort direction: 'asc' (default) or 'desc'
   * @returns Promise<string[]> - Entity IDs sorted by specified field
   *
   */
  async getSortedIdsForFilter(
    filter: any,
    orderBy: string,
    order: 'asc' | 'desc' = 'asc'
  ): Promise<string[]> {
    // Column store path: O(K log S) sort via k-way merge across segments.
    // No per-entity storage reads, no precision loss from bucketing.
    if (this.columnStore && this.columnStore.hasField(orderBy)) {
      // Get filtered IDs from existing roaring bitmap path
      const hasFilter = filter && Object.keys(filter).length > 0
      const filteredIds = hasFilter ? await this.getIdsForFilter(filter) : []

      if (hasFilter && filteredIds.length === 0) return []

      let sortedIntIds: number[]
      if (hasFilter) {
        // Build filter bitmap for the column store
        const filterBitmap = new RoaringBitmap32()
        for (const id of filteredIds) {
          const intId = this.idMapper.getInt(id)
          if (intId !== undefined) filterBitmap.add(intId)
        }
        sortedIntIds = await this.columnStore.filteredSortTopK(
          filterBitmap, orderBy, order, filteredIds.length
        )
      } else {
        // Unfiltered sort — column store handles the full entity set efficiently
        sortedIntIds = await this.columnStore.sortTopK(
          orderBy, order, this.idMapper.size
        )
      }

      // Convert int IDs back to UUIDs
      return sortedIntIds
        .map(intId => this.idMapper.getUuid(intId))
        .filter((uuid): uuid is string => uuid !== undefined)
    }

    // Fallback: sparse index path (for fields not yet in column store).
    // Requires a non-empty filter because it reads O(k) entity values from storage.
    const filteredIds = await this.getIdsForFilter(filter)

    if (filteredIds.length === 0) {
      return []
    }

    const idValuePairs: Array<{ id: string, value: any }> = []
    for (const id of filteredIds) {
      const value = await this.getFieldValueForEntity(id, orderBy)
      idValuePairs.push({ id, value })
    }

    idValuePairs.sort((a, b) => {
      if (a.value == null && b.value == null) return 0
      if (a.value == null) return order === 'asc' ? 1 : -1
      if (b.value == null) return order === 'asc' ? -1 : 1
      if (a.value === b.value) return 0
      // Numbers compare numerically; everything else by code-point (UTF-8 byte) order.
      // This makes the JS fallback sort match cortex's native column store exactly
      // (numeric i64/f64 vs code-point strings) and stay deterministic across
      // environments, unlike the `<` operator's UTF-16 ordering for strings.
      let comparison: number
      if (typeof a.value === 'number' && typeof b.value === 'number') {
        comparison = a.value < b.value ? -1 : 1
      } else {
        comparison = compareCodePoints(String(a.value), String(b.value))
      }
      return order === 'asc' ? comparison : -comparison
    })

    return idValuePairs.map(p => p.id)
  }

  /**
   * Get field value for a specific entity (helper for sorted queries)
   *
   * Three-path lookup:
   *
   * 1. **Bucketed fields** (timestamps) — the sparse index stores values
   *    rounded to 1-minute buckets to keep the index compact for range
   *    queries. That bucketing loses precision, so sorting must read the
   *    actual value directly from entity storage.
   *
   * 2. **Custom fields with no sparse index** — VFS fields like `modified`
   *    and `accessed`, plus any user custom field whose sparse index was
   *    never built. Resolved from entity storage via `resolveEntityField`,
   *    which knows the top-level-vs-metadata shape contract.
   *
   * 3. **Indexed fields** — strings, enums, and low-cardinality ints live
   *    in the sparse roaring index. O(chunks) lookup, typically 1-10 chunks.
   *
   * **Performance**:
   * - Paths 1 & 2: O(1) entity load from storage (cached)
   * - Path 3: O(chunks) roaring bitmap lookup
   *
   * @param entityId - Entity UUID to get field value for
   * @param field - Field name to retrieve (e.g., 'createdAt', 'title')
   * @returns Promise<any> - Field value or undefined if not found
   *
   * @public (called from brainy.ts for sorted queries)
   */
  async getFieldValueForEntity(entityId: string, field: string): Promise<any> {
    // Path 1: Bucketed fields need the actual value from storage.
    if (BUCKETED_INDEX_FIELDS.has(field)) {
      const noun = await this.storage.getNoun(entityId)
      return noun ? resolveEntityField(noun, field) : undefined
    }

    // Path 3 precondition: entity must be in the id mapper for bitmap lookup.
    const intId = this.idMapper.getInt(entityId)
    if (intId === undefined) {
      return undefined
    }

    // Load sparse index for this field (cached via UnifiedCache).
    const sparseIndex = await this.loadSparseIndex(field)

    // Path 2: No sparse index exists — fall back to entity storage.
    // Covers VFS custom fields (modified, accessed) and user fields not
    // yet indexed. resolveEntityField handles the shape contract.
    if (!sparseIndex) {
      const noun = await this.storage.getNoun(entityId)
      return noun ? resolveEntityField(noun, field) : undefined
    }

    // Path 3: Search sparse index chunks for this entity's value.
    // Typically 1-10 chunks per field, so this is fast.
    for (const chunkId of sparseIndex.getAllChunkIds()) {
      const chunk = await this.chunkManager.loadChunk(field, chunkId)
      if (!chunk) continue

      // Check each value's roaring bitmap for our entity ID.
      // Roaring bitmap .has() is O(1) with SIMD optimization.
      for (const [value, bitmap] of chunk.entries) {
        if (bitmap.has(intId)) {
          return this.denormalizeValue(value, field)
        }
      }
    }

    return undefined
  }

  /**
   * Denormalize a value (reverse of normalizeValue)
   *
   * Converts normalized/stringified values back to their original type.
   * For most fields, this just parses numbers or returns strings as-is.
   *
   * **NOTE**: This is NOT used for timestamp sorting! Timestamp fields
   * (createdAt, updatedAt) are loaded directly from entity metadata by
   * getFieldValueForEntity() to avoid precision loss from bucketing.
   *
   * **Timestamp Bucketing (for range queries only)**:
   * - Indexed as: Math.floor(timestamp / 60000) * 60000
   * - Used for: Range queries (gte, lte) where 1-minute precision is acceptable
   * - NOT used for: Sorting (requires exact millisecond precision)
   *
   * @param normalized - Normalized value string from index
   * @param field - Field name (used for type inference)
   * @returns Denormalized value in original type
   *
   * @private
   */
  private denormalizeValue(normalized: string, field: string): any {
    // Try parsing as number (timestamps, integers, floats)
    const asNumber = Number(normalized)
    if (!isNaN(asNumber)) {
      return asNumber
    }

    // For strings, return as-is (already denormalized)
    return normalized
  }

  /**
   * DEPRECATED - Old implementation for backward compatibility
   */
  private async getIdsForFilterOld(filter: any): Promise<string[]> {
    if (!filter || Object.keys(filter).length === 0) {
      return []
    }
    
    // Handle logical operators
    if (filter.allOf && Array.isArray(filter.allOf)) {
      // For allOf, we need intersection of all sub-filters
      const allIds: string[][] = []
      for (const subFilter of filter.allOf) {
        const subIds = await this.getIdsForFilter(subFilter)
        allIds.push(subIds)
      }
      
      if (allIds.length === 0) return []
      if (allIds.length === 1) return allIds[0]
      
      // Intersection of all sets
      return allIds.reduce((intersection, currentSet) => 
        intersection.filter(id => currentSet.includes(id))
      )
    }
    
    if (filter.anyOf && Array.isArray(filter.anyOf)) {
      // For anyOf, we need union of all sub-filters
      const unionIds = new Set<string>()
      for (const subFilter of filter.anyOf) {
        const subIds = await this.getIdsForFilter(subFilter)
        subIds.forEach(id => unionIds.add(id))
      }
      return Array.from(unionIds)
    }
    
    // Handle regular field filters
    const criteria = this.convertFilterToCriteria(filter)
    const idSets: string[][] = []
    const unindexedFields: string[] = []

    for (const { field, values } of criteria) {
      const unionIds = new Set<string>()
      try {
        for (const value of values) {
          const ids = await this.getIds(field, value)
          ids.forEach(id => unionIds.add(id))
        }
      } catch (err) {
        if (err instanceof BrainyError && err.type === 'FIELD_NOT_INDEXED') {
          unindexedFields.push(field)
          // Treat as no matches and continue — same semantics as the main
          // getIdsForFilter() path.
        } else {
          throw err
        }
      }
      idSets.push(Array.from(unionIds))
    }

    if (unindexedFields.length > 0) {
      prodLog.warn(
        `[brainy] find() where-clause referenced unindexed field(s) ` +
        `${unindexedFields.join(', ')}; their clauses contributed no rows.`
      )
    }
    if (idSets.length === 0) return []
    if (idSets.length === 1) return idSets[0]

    // Intersection of all field criteria (implicit $and)
    return idSets.reduce((intersection, currentSet) =>
      intersection.filter(id => currentSet.includes(id))
    )
  }

  /**
   * Get IDs matching multiple criteria (intersection) - LEGACY METHOD
   * @deprecated Use getIdsForFilter instead
   */
  async getIdsForCriteria(criteria: Record<string, any>): Promise<string[]> {
    return this.getIdsForFilter(criteria)
  }

  /**
   * Flush dirty entries to storage (non-blocking version)
   * NOTE: Sparse indices are flushed immediately in add/remove operations
   */
  async flush(): Promise<void> {
    // Always save field registry — even with no dirty fields. This tiny file
    // (list of field names) is the critical link that init() needs to discover
    // persisted indices. Without it, the index appears empty after restart.
    if (this.fieldIndexes.size > 0) {
      await this.saveFieldRegistry()
    }

    // Also always flush the EntityIdMapper — prevents ID collisions on restart
    await this.idMapper.flush()

    // Check if we have anything else to flush
    if (this.dirtyFields.size === 0) {
      return // No dirty field indexes to flush
    }

    // Process in smaller batches to avoid blocking
    const BATCH_SIZE = 20
    const allPromises: Promise<void>[] = []

    // Flush field indexes in batches
    const dirtyFieldsArray = Array.from(this.dirtyFields)
    for (let i = 0; i < dirtyFieldsArray.length; i += BATCH_SIZE) {
      const batch = dirtyFieldsArray.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map(field => {
        const fieldIndex = this.fieldIndexes.get(field)
        return fieldIndex ? this.saveFieldIndex(field, fieldIndex) : Promise.resolve()
      })
      allPromises.push(...batchPromises)

      // Yield to event loop between batches
      if (i + BATCH_SIZE < dirtyFieldsArray.length) {
        await this.yieldToEventLoop()
      }
    }

    // Wait for all operations to complete
    await Promise.all(allPromises)

    // Flush EntityIdMapper (UUID ↔ integer mappings)
    await this.idMapper.flush()

    // Save field registry for fast cold-start discovery
    await this.saveFieldRegistry()

    this.dirtyFields.clear()
    this.lastFlushTime = Date.now()

    // Flush column store tail buffers to L0 segments
    if (this.columnStore) {
      await this.columnStore.flush()
    }
  }
  
  /**
   * Yield control back to the Node.js event loop
   * Prevents blocking during long-running operations
   */
  private async yieldToEventLoop(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve))
  }

  /**
   * Load field index from storage
   */
  private async loadFieldIndex(field: string): Promise<FieldIndexData | null> {
    const filename = this.getFieldIndexFilename(field)
    const unifiedKey = `metadata:field:${filename}`
    
    // Check unified cache first with loader function
    return await this.unifiedCache.get(unifiedKey, async () => {
      try {
        const cacheKey = `field_index_${filename}`
        
        // Check old cache for migration
        const cached = this.metadataCache.get(cacheKey)
        if (cached) {
          // Add to unified cache
          const size = JSON.stringify(cached).length
          this.unifiedCache.set(unifiedKey, cached, 'metadata', size, 1) // Low rebuild cost
          return cached
        }
        
        // Load from storage
        const indexId = `__metadata_field_index__${filename}`
        const data = await this.storage.getMetadata(indexId)
        
        if (data) {
          const fieldIndex = {
            values: data.values || {},
            lastUpdated: data.lastUpdated || Date.now()
          }
          
          // Add to unified cache
          const size = JSON.stringify(fieldIndex).length
          this.unifiedCache.set(unifiedKey, fieldIndex, 'metadata', size, 1)
          
          // Also keep in old cache for now (transition period)
          this.metadataCache.set(cacheKey, fieldIndex)
          
          return fieldIndex
        }
      } catch (error) {
        // Field index doesn't exist yet
      }
      return null
    })
  }

  /**
   * Save field index to storage with file locking
   */
  private async saveFieldIndex(field: string, fieldIndex: FieldIndexData): Promise<void> {
    const filename = this.getFieldIndexFilename(field)
    const lockKey = `field_index_${field}`
    const lockAcquired = await this.acquireLock(lockKey, 5000) // 5 second timeout

    if (!lockAcquired) {
      prodLog.warn(
        `Failed to acquire lock for field index '${field}', proceeding without lock`
      )
    }

    try {
      const indexId = `__metadata_field_index__${filename}`
      const unifiedKey = `metadata:field:${filename}`

      // Add required 'noun' property for NounMetadata
      await this.storage.saveMetadata(indexId, {
        noun: 'MetadataFieldIndex',
        values: fieldIndex.values,
        lastUpdated: fieldIndex.lastUpdated
      } as any)

      // Update unified cache
      const size = JSON.stringify(fieldIndex).length
      this.unifiedCache.set(unifiedKey, fieldIndex, 'metadata', size, 1)

      // Invalidate old cache
      this.metadataCache.invalidatePattern(`field_index_${filename}`)
    } finally {
      if (lockAcquired) {
        await this.releaseLock(lockKey)
      }
    }
  }

  /**
   * Save field registry to storage for fast cold-start discovery
   * Solves 100x performance regression by persisting field directory
   *
   * This enables instant cold starts by discovering which fields have persisted indices
   * without needing to rebuild from scratch. Similar to how HNSW persists system metadata.
   *
   * Registry size: ~4-8KB for typical deployments (50-200 fields)
   * Scales: O(log N) - field count grows logarithmically with entity count
   */
  private async saveFieldRegistry(): Promise<void> {
    // Nothing to save if no fields indexed yet
    if (this.fieldIndexes.size === 0) {
      return
    }

    try {
      const registry = {
        noun: 'FieldRegistry',
        fields: Array.from(this.fieldIndexes.keys()),
        version: 1,
        lastUpdated: Date.now(),
        totalFields: this.fieldIndexes.size
      }

      await this.storage.saveMetadata('__metadata_field_registry__', registry)

      prodLog.debug(`📝 Saved field registry: ${registry.totalFields} fields`)
    } catch (error) {
      // Non-critical: Log warning but don't throw
      // System will rebuild registry on next cold start if needed
      prodLog.warn('Failed to save field registry:', error)
    }
  }

  /**
   * Load field registry from storage to populate fieldIndexes directory
   * Enables O(1) discovery of persisted sparse indices
   *
   * Called during init() to discover which fields have persisted indices.
   * Populates fieldIndexes Map with skeleton entries - actual sparse indices
   * are lazy-loaded via UnifiedCache when first accessed.
   *
   * Gracefully handles missing registry (first run or corrupted data).
   */
  private async loadFieldRegistry(): Promise<void> {
    try {
      const registry = await this.storage.getMetadata('__metadata_field_registry__')

      if (!registry?.fields || !Array.isArray(registry.fields)) {
        // Registry doesn't exist or is invalid - not an error, just first run
        prodLog.debug('📂 No field registry found - will build on first flush')
        return
      }

      // Populate fieldIndexes Map from discovered fields
      // Skeleton entries with empty values - sparse indices loaded lazily
      const lastUpdated = typeof registry.lastUpdated === 'number'
        ? registry.lastUpdated
        : Date.now()

      for (const field of registry.fields) {
        if (typeof field === 'string' && field.length > 0) {
          this.fieldIndexes.set(field, {
            values: {},
            lastUpdated
          })
        }
      }

      prodLog.info(
        `✅ Loaded field registry: ${registry.fields.length} persisted fields discovered\n` +
        `   Fields: ${registry.fields.slice(0, 5).join(', ')}${registry.fields.length > 5 ? '...' : ''}`
      )
    } catch (error) {
      // Silent failure - registry not critical, will rebuild if needed
      prodLog.debug('Could not load field registry:', error)
    }
  }

  /**
   * Get list of persisted fields from storage (not in-memory)
   * Used during rebuild to discover which chunk files need deletion
   *
   * @returns Array of field names that have persisted sparse indices
   */
  private async getPersistedFieldList(): Promise<string[]> {
    try {
      const registry = await this.storage.getMetadata('__metadata_field_registry__')

      if (!registry?.fields || !Array.isArray(registry.fields)) {
        return []
      }

      return registry.fields.filter((f: unknown) => typeof f === 'string' && f.length > 0)
    } catch (error) {
      prodLog.debug('Could not load persisted field list:', error)
      return []
    }
  }

  /**
   * Delete all chunk files for a specific field
   * Used during rebuild to ensure clean slate
   *
   * @param field Field name whose chunks should be deleted
   */
  private async deleteFieldChunks(field: string): Promise<void> {
    try {
      // Load sparse index to get chunk IDs
      const indexPath = `__sparse_index__${field}`
      const sparseData = await this.storage.getMetadata(indexPath)

      if (sparseData) {
        const sparseIndex = SparseIndex.fromJSON(sparseData)

        // Delete all chunk files for this field
        for (const chunkId of sparseIndex.getAllChunkIds()) {
          await this.chunkManager.deleteChunk(field, chunkId)
        }

        // Delete the sparse index file itself
        await this.storage.saveMetadata(indexPath, null as any)
      }
    } catch (error) {
      // Silent failure - if we can't delete old chunks, rebuild will still work
      // (new chunks will be created, old ones become orphaned)
      prodLog.debug(`Could not clear chunks for field '${field}':`, error)
    }
  }

  /**
   * Clear ALL metadata index data from storage (for recovery)
   * Nuclear option for recovering from corrupted index state
   *
   * WARNING: This deletes all indexed data - requires full rebuild after!
   * Use when index is corrupted beyond normal rebuild repair.
   */
  public async clearAllIndexData(): Promise<void> {
    prodLog.warn('🗑️ Clearing ALL metadata index data from storage...')

    // Get all persisted fields
    const fields = await this.getPersistedFieldList()

    // Delete chunks and sparse indices for each field
    let deletedCount = 0
    for (const field of fields) {
      await this.deleteFieldChunks(field)
      deletedCount++
    }

    // Delete field registry
    try {
      await this.storage.saveMetadata('__metadata_field_registry__', null as any)
    } catch (error) {
      prodLog.debug('Could not delete field registry:', error)
    }

    // Clear in-memory state
    this.fieldIndexes.clear()
    this.dirtyFields.clear()
    this.unifiedCache.clear('metadata')
    this.totalEntitiesByType.clear()
    this.entityCountsByTypeFixed.fill(0)
    this.verbCountsByTypeFixed.fill(0)
    this.typeFieldAffinity.clear()

    // Clear EntityIdMapper. This is the explicit destructive path: the caller
    // asked for nuclear recovery of a corrupted index, so renumbering UUIDs is
    // intentional. Persisted int-keyed data (vector-mmap slots, graph
    // link-compression encodings) is invalidated by this op — the warning
    // below makes that explicit. Rebuild on its own does NOT clear the mapper.
    await this.idMapper.clear()

    // Clear chunk manager cache
    this.chunkManager.clearCache()

    prodLog.info(`✅ Cleared ${deletedCount} field indexes and all in-memory state`)
    prodLog.warn('⚠️ EntityIdMapper was cleared — any persisted int-keyed data ' +
      '(vector mmap slots, graph link-compression encodings, etc.) is now stale ' +
      'and must be rebuilt from canonical sources.')
    prodLog.info('⚠️ Run brain.index.rebuild() to recreate the index from entity data')
  }

  /**
   * Get count of entities by type - O(1) operation using existing tracking
   * This exposes the production-ready counting that's already maintained
   */
  getEntityCountByType(type: string): number {
    return this.totalEntitiesByType.get(type) || 0
  }

  /**
   * Get total count of all entities - O(1) operation
   */
  getTotalEntityCount(): number {
    let total = 0
    for (const count of this.totalEntitiesByType.values()) {
      total += count
    }
    return total
  }

  /**
   * Get all entity types and their counts - O(1) operation
   * Fixed - totalEntitiesByType is correctly populated by updateTypeFieldAffinity
   * during add operations. lazyLoadCounts was reading wrong data but that doesn't
   * affect freshly-added entities within the same session.
   */
  getAllEntityCounts(): Map<string, number> {
    return new Map(this.totalEntitiesByType)
  }

  // ============================================================================
  // VFS Statistics Methods (uses existing Roaring bitmap infrastructure)
  // ============================================================================

  /**
   * Get VFS entity count for a specific type using Roaring bitmap intersection
   * Uses hardware-accelerated SIMD operations (AVX2/SSE4.2)
   * @param type The noun type to query
   * @returns Count of VFS entities of this type
   */
  async getVFSEntityCountByType(type: string): Promise<number> {
    const vfsBitmap = await this.getBitmapFromChunks('isVFSEntity', true)
    const typeBitmap = await this.getBitmapFromChunks('noun', type)

    if (!vfsBitmap || !typeBitmap) return 0

    // Hardware-accelerated intersection + O(1) cardinality
    const intersection = RoaringBitmap32.and(vfsBitmap, typeBitmap)
    return intersection.size
  }

  /**
   * Get all VFS entity counts by type using Roaring bitmap operations
   * @returns Map of type -> VFS entity count
   */
  async getAllVFSEntityCounts(): Promise<Map<string, number>> {
    const vfsBitmap = await this.getBitmapFromChunks('isVFSEntity', true)
    if (!vfsBitmap || vfsBitmap.size === 0) {
      return new Map()
    }

    const result = new Map<string, number>()

    // Iterate through all known types and compute VFS count via intersection
    for (const type of this.totalEntitiesByType.keys()) {
      const typeBitmap = await this.getBitmapFromChunks('noun', type)
      if (typeBitmap) {
        const intersection = RoaringBitmap32.and(vfsBitmap, typeBitmap)
        if (intersection.size > 0) {
          result.set(type, intersection.size)
        }
      }
    }

    return result
  }

  /**
   * Get total count of VFS entities - O(1) using Roaring bitmap cardinality
   * @returns Total VFS entity count
   */
  async getTotalVFSEntityCount(): Promise<number> {
    const vfsBitmap = await this.getBitmapFromChunks('isVFSEntity', true)
    return vfsBitmap?.size ?? 0
  }

  // ============================================================================
  // Phase 1b: Type Enum Methods (O(1) access via Uint32Arrays)
  // ============================================================================

  /**
   * Get entity count for a noun type using type enum (O(1) array access)
   * More efficient than Map-based getEntityCountByType
   * @param type Noun type from NounTypeEnum
   * @returns Count of entities of this type
   */
  getEntityCountByTypeEnum(type: NounType): number {
    const index = TypeUtils.getNounIndex(type)
    return this.entityCountsByTypeFixed[index]
  }

  /**
   * Get verb count for a verb type using type enum (O(1) array access)
   * @param type Verb type from VerbTypeEnum
   * @returns Count of verbs of this type
   */
  getVerbCountByTypeEnum(type: VerbType): number {
    const index = TypeUtils.getVerbIndex(type)
    return this.verbCountsByTypeFixed[index]
  }

  /**
   * Get top N noun types by entity count (using fixed-size arrays)
   * Useful for type-aware cache warming and query optimization
   * @param n Number of top types to return
   * @returns Array of noun types sorted by count (highest first)
   */
  getTopNounTypes(n: number): NounType[] {
    const types: Array<{ type: NounType; count: number }> = []

    // Iterate through all noun types
    for (let i = 0; i < NOUN_TYPE_COUNT; i++) {
      const count = this.entityCountsByTypeFixed[i]
      if (count > 0) {
        const type = TypeUtils.getNounFromIndex(i)
        types.push({ type, count })
      }
    }

    // Sort by count (descending) and return top N
    return types
      .sort((a, b) => b.count - a.count)
      .slice(0, n)
      .map(t => t.type)
  }

  /**
   * Get top N verb types by count (using fixed-size arrays)
   * @param n Number of top types to return
   * @returns Array of verb types sorted by count (highest first)
   */
  getTopVerbTypes(n: number): VerbType[] {
    const types: Array<{ type: VerbType; count: number }> = []

    // Iterate through all verb types
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const count = this.verbCountsByTypeFixed[i]
      if (count > 0) {
        const type = TypeUtils.getVerbFromIndex(i)
        types.push({ type, count })
      }
    }

    // Sort by count (descending) and return top N
    return types
      .sort((a, b) => b.count - a.count)
      .slice(0, n)
      .map(t => t.type)
  }

  /**
   * Get all noun type counts as a Map (using fixed-size arrays)
   * More efficient than getAllEntityCounts for type-aware queries
   * @returns Map of noun type to count
   */
  getAllNounTypeCounts(): Map<NounType, number> {
    const counts = new Map<NounType, number>()

    for (let i = 0; i < NOUN_TYPE_COUNT; i++) {
      const count = this.entityCountsByTypeFixed[i]
      if (count > 0) {
        const type = TypeUtils.getNounFromIndex(i)
        counts.set(type, count)
      }
    }

    return counts
  }

  /**
   * Get all verb type counts as a Map (using fixed-size arrays)
   * @returns Map of verb type to count
   */
  getAllVerbTypeCounts(): Map<VerbType, number> {
    const counts = new Map<VerbType, number>()

    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const count = this.verbCountsByTypeFixed[i]
      if (count > 0) {
        const type = TypeUtils.getVerbFromIndex(i)
        counts.set(type, count)
      }
    }

    return counts
  }

  /**
   * Get count of entities matching field-value criteria - queries chunked sparse index
   */
  async getCountForCriteria(field: string, value: any): Promise<number> {
    // Use chunked sparse indexing
    const ids = await this.getIds(field, value)
    return ids.length
  }

  /**
   * Get index statistics.
   *
   * Source-of-truth precedence (post-7.20.0 column-store-first architecture):
   *   1. **EntityIdMapper** — `idMapper.size` is the canonical entity count.
   *      Every indexed entity gets a UUID→int mapping; nothing else is
   *      consistent across instances.
   *   2. **ColumnStore** — `getIndexedFields()` is the canonical list of
   *      indexed fields. `getFieldSizeSummary()` provides segment / tail
   *      bookkeeping per field.
   *   3. **Legacy sparse-index registry** — only for pre-7.20.0 workspaces
   *      whose data hasn't been migrated. `getPersistedFieldList()` may know
   *      fields the column store doesn't yet, so we union them in.
   *
   * Prior implementation read from `this.fieldIndexes` + lazy-loaded sparse
   * indices, which silently returned `0` entries for any workspace written
   * after sparse-index writes were deleted in commit `11be039`. That defect
   * is what `BR-FIND-WHERE-ZERO` tracked.
   */
  async getStats(): Promise<MetadataIndexStats> {
    const entityCount = this.idMapper.size

    // Field set: union of column-store fields and any legacy sparse-index
    // fields registered on disk. Exclude the `__words__` text index by
    // convention (it's not a metadata field in the public sense).
    const fields = new Set<string>()
    if (this.columnStore) {
      for (const f of this.columnStore.getIndexedFields()) {
        if (f !== '__words__') fields.add(f)
      }
    }
    // Legacy fallback: pre-7.20.0 workspaces may have sparse-index registry
    // entries the column store doesn't know about yet. Surfacing them in the
    // field list lets the rest of the system migrate them on read.
    try {
      const legacyFields = await this.getPersistedFieldList()
      for (const f of legacyFields) {
        if (f !== '__words__') fields.add(f)
      }
    } catch {
      // Registry missing — nothing to add.
    }

    // `totalEntries` semantically means "distinct entities tracked by this
    // index". That's `idMapper.size`. `totalIds` is the sum of all
    // (field, value) → entityId postings — proxied by the segment/tail size
    // summary so we don't have to scan every bitmap.
    let totalIds = 0
    if (this.columnStore) {
      for (const summary of this.columnStore.getFieldSizeSummary()) {
        if (summary.field === '__words__') continue
        totalIds += summary.tailSize
        // Segment count is a proxy; for a coarser-grained number we'd open
        // each segment cursor. Avoided here because stats() is on the hot
        // path for `brain.stats()` / health checks.
        totalIds += summary.segmentCount * 1 // segments contribute at least 1 posting
      }
    }

    return {
      totalEntries: entityCount,
      totalIds,
      fieldsIndexed: Array.from(fields).sort(),
      lastRebuild: Date.now(),
      indexSize: entityCount * 100 // rough estimate
    }
  }

  /**
   * Validate index consistency and detect corruption
   * Returns health status and recommendations for repair
   *
   * Counts metadata field entries only (excludes __words__ keyword index).
   * Corruption typically manifests as high avg entries/entity (expected ~30, corrupted can be 100+)
   * caused by the update() field asymmetry bug
   */
  async validateConsistency(): Promise<{
    healthy: boolean
    avgEntriesPerEntity: number
    entityCount: number
    indexEntryCount: number
    recommendation: string | null
  }> {
    const entityCount = this.idMapper.size

    // If no entities, index is trivially healthy
    if (entityCount === 0) {
      return {
        healthy: true,
        avgEntriesPerEntity: 0,
        entityCount: 0,
        indexEntryCount: 0,
        recommendation: null
      }
    }

    // Count total index entries across all fields (excluding keyword index)
    let indexEntryCount = 0
    for (const field of this.fieldIndexes.keys()) {
      if (field === '__words__') continue  // Keyword entries are expected to be high-volume
      const sparseIndex = await this.loadSparseIndex(field)
      if (sparseIndex) {
        for (const chunkId of sparseIndex.getAllChunkIds()) {
          const chunk = await this.chunkManager.loadChunk(field, chunkId)
          if (chunk) {
            for (const ids of chunk.entries.values()) {
              indexEntryCount += ids.size
            }
          }
        }
      }
    }

    const avgEntriesPerEntity = indexEntryCount / entityCount

    // Threshold: 100 metadata entries/entity is clearly corrupted (expected ~30)
    // __words__ keyword entries are excluded from this count since they can be 50-5000 per entity
    // This catches the update() asymmetry bug which causes 7 fields to accumulate per update
    const CORRUPTION_THRESHOLD = 100
    const healthy = avgEntriesPerEntity <= CORRUPTION_THRESHOLD

    let recommendation: string | null = null
    if (!healthy) {
      recommendation = `Index corruption detected (${avgEntriesPerEntity.toFixed(1)} avg entries/entity, expected ~30). ` +
        `Run brain.index.clearAllIndexData() followed by brain.index.rebuild() to repair.`
    }

    return {
      healthy,
      avgEntriesPerEntity,
      entityCount,
      indexEntryCount,
      recommendation
    }
  }

  /**
   * Rebuild entire index from scratch using pagination
   * Non-blocking version that yields control back to event loop
   * Sparse indices now lazy-loaded via UnifiedCache (no need to clear Map)
   */
  async rebuild(): Promise<void> {
    if (this.isRebuilding) return

    this.isRebuilding = true
    try {
      prodLog.info('🔄 Starting non-blocking metadata index rebuild with batch processing...')
    prodLog.info(`📊 Storage adapter: ${this.storage.constructor.name}`)
    prodLog.info(`🔧 Batch processing available: ${!!this.storage.getMetadataBatch}`)

      // Clear existing indexes
      // No sparseIndices Map to clear - UnifiedCache handles eviction
      this.fieldIndexes.clear()
      this.dirtyFields.clear()

      // CRITICAL FIX - Clear type counts to prevent accumulation
      // Previously, counts accumulated across rebuilds causing incorrect values
      this.totalEntitiesByType.clear()
      this.entityCountsByTypeFixed.fill(0)
      this.verbCountsByTypeFixed.fill(0)
      this.typeFieldAffinity.clear()

      // Clear all cached sparse indices in UnifiedCache
      // This ensures rebuild starts fresh
      this.unifiedCache.clear('metadata')

      // Clear existing chunk files from storage to prevent overcounting.
      // Chunks are deleted first, then rebuilt. The field registry is NOT deleted
      // here — it's always saved at the end of rebuild via flush(). This ensures
      // that if rebuild fails partway, the next init() can still discover fields
      // and trigger another rebuild attempt.
      prodLog.info('Clearing existing metadata index chunks from storage...')
      const existingFields = await this.getPersistedFieldList()

      if (existingFields.length > 0) {
        for (const field of existingFields) {
          await this.deleteFieldChunks(field)
        }

        prodLog.info(`Cleared ${existingFields.length} field indexes from storage`)
      }

      // EntityIdMapper is intentionally NOT cleared here. Rebuild re-iterates
      // every entity in storage and calls idMapper.getOrAssign(uuid), which
      // returns the existing int for known UUIDs (no renumbering). This is the
      // foundational stability guarantee — vector-mmap slot indices, graph
      // link-compression encodings, and any other persisted int-keyed data
      // remain valid across a rebuild. Previously this line reset nextId to 1
      // and renumbered every UUID by re-insertion order, silently breaking
      // any consumer that had persisted int-keyed data against the old map.
      // Stale entries for UUIDs no longer in storage persist (harmless memory
      // overhead); a dedicated prune step can be added if it ever matters.
      // The destructive wipe is still available via clearAllIndexData() →
      // idMapper.clear(), which is the explicit "recovery" path with the
      // appropriate warning about invalidating persisted int-keyed data.

      // Clear chunk manager cache
      this.chunkManager.clearCache()

      // Adaptive rebuild strategy based on storage adapter
      // FileSystem/Memory/OPFS: Load all at once (avoids getAllShardedFiles() overhead on every batch)
      // Cloud (GCS/S3/R2): Use pagination with small batches (prevent socket exhaustion)
      const storageType = this.storage.constructor.name
      const isLocalStorage = storageType === 'FileSystemStorage' ||
                            storageType === 'MemoryStorage' ||
                            storageType === 'OPFSStorage'

      let nounLimit: number
      let totalNounsProcessed = 0

      if (isLocalStorage) {
        // Load all nouns at once for local storage
        // Avoids repeated directory scans in getAllShardedFiles()
        prodLog.info(`⚡ Using optimized strategy: load all nouns at once (local storage)`)
        const result = await this.storage.getNouns({
          pagination: { offset: 0, limit: 1000000 } // Effectively unlimited
        })

        prodLog.info(`📦 Loading ${result.items.length} nouns with metadata...`)

        // Get all metadata in one batch if available
        const nounIds = result.items.map(noun => noun.id)
        let metadataBatch: Map<string, any>

        if (this.storage.getMetadataBatch) {
          metadataBatch = await this.storage.getMetadataBatch(nounIds)
          prodLog.info(`✅ Loaded ${metadataBatch.size}/${nounIds.length} metadata objects`)
        } else {
          // Fallback to individual calls
          metadataBatch = new Map()
          for (const id of nounIds) {
            try {
              const metadata = await this.storage.getNounMetadata(id)
              if (metadata) metadataBatch.set(id, metadata)
            } catch (error) {
              prodLog.debug(`Failed to read metadata for ${id}:`, error)
            }
          }
        }

        // Process all nouns
        let localCount = 0
        for (const noun of result.items) {
          const metadata = metadataBatch.get(noun.id)
          if (metadata) {
            await this.addToIndex(noun.id, metadata, true, true)
            localCount++
            // Periodic safety flush every 5000 entities to cap memory during rebuild
            // (Periodic safety flush removed in 7.22.0 — the underlying
            // flushDirtyMetadata was a no-op since the 7.20.0 column-store
            // refactor. Column store handles its own flushing.)
          }
        }

        totalNounsProcessed = result.items.length
        prodLog.info(`✅ Indexed ${totalNounsProcessed} nouns`)

      } else {
        // Cloud storage: use conservative batching
        nounLimit = 25
        prodLog.info(`⚡ Using conservative batch size: ${nounLimit} items/batch (cloud storage)`)

        let nounOffset = 0
        let hasMoreNouns = true
        let consecutiveEmptyBatches = 0
        const MAX_ITERATIONS = 10000
        let iterations = 0

        while (hasMoreNouns && iterations < MAX_ITERATIONS) {
          iterations++
          const result = await this.storage.getNouns({
            pagination: { offset: nounOffset, limit: nounLimit }
          })

        // CRITICAL SAFETY CHECK: Prevent infinite loop on empty results
        if (result.items.length === 0) {
          consecutiveEmptyBatches++
          if (consecutiveEmptyBatches >= 3) {
            prodLog.warn('⚠️ Breaking metadata rebuild loop: received 3 consecutive empty batches')
            break
          }
          // If hasMore is true but items are empty, it's likely a bug
          if (result.hasMore) {
            prodLog.warn(`⚠️ Storage returned empty items but hasMore=true at offset ${nounOffset}`)
            hasMoreNouns = false // Force exit
            break
          }
        } else {
          consecutiveEmptyBatches = 0 // Reset counter on non-empty batch
        }

        // CRITICAL FIX: Use batch metadata reading to prevent socket exhaustion
        const nounIds = result.items.map(noun => noun.id)
        
        let metadataBatch: Map<string, any>
        if (this.storage.getMetadataBatch) {
          // Use batch reading if available (prevents socket exhaustion)
          prodLog.info(`📦 Processing metadata batch ${Math.floor(totalNounsProcessed / nounLimit) + 1} (${nounIds.length} items)...`)
          metadataBatch = await this.storage.getMetadataBatch(nounIds)
          const successRate = ((metadataBatch.size / nounIds.length) * 100).toFixed(1)
          prodLog.info(`✅ Batch loaded ${metadataBatch.size}/${nounIds.length} metadata objects (${successRate}% success)`)
        } else {
          // Fallback to individual calls with strict concurrency control
          prodLog.warn(`⚠️  FALLBACK: Storage adapter missing getMetadataBatch - using individual calls with concurrency limit`)
          metadataBatch = new Map()
          const CONCURRENCY_LIMIT = 3 // Very conservative limit

          for (let i = 0; i < nounIds.length; i += CONCURRENCY_LIMIT) {
            const batch = nounIds.slice(i, i + CONCURRENCY_LIMIT)
            const batchPromises = batch.map(async (id) => {
              try {
                const metadata = await this.storage.getNounMetadata(id)
                return { id, metadata }
              } catch (error) {
                prodLog.debug(`Failed to read metadata for ${id}:`, error)
                return { id, metadata: null }
              }
            })

            const batchResults = await Promise.all(batchPromises)
            for (const { id, metadata } of batchResults) {
              if (metadata) {
                metadataBatch.set(id, metadata)
              }
            }

            // Yield between batches to prevent socket exhaustion
            await this.yieldToEventLoop()
          }
        }
        
        // Process the metadata batch
        for (const noun of result.items) {
          const metadata = metadataBatch.get(noun.id)
          if (metadata) {
            // Skip flush during rebuild for performance
            await this.addToIndex(noun.id, metadata, true, true)
          }
        }

        // Yield after processing the entire batch
        await this.yieldToEventLoop()

        totalNounsProcessed += result.items.length
        hasMoreNouns = result.hasMore
        nounOffset += nounLimit
        
        // Progress logging and event loop yield after each batch
        if (totalNounsProcessed % 100 === 0 || !hasMoreNouns) {
          prodLog.debug(`📊 Indexed ${totalNounsProcessed} nouns...`)
        }
        await this.yieldToEventLoop()
        }

        // Check iteration limits for cloud storage
        if (iterations >= MAX_ITERATIONS) {
          prodLog.error(`❌ Metadata noun rebuild hit maximum iteration limit (${MAX_ITERATIONS}). This indicates a bug in storage pagination.`)
        }
      }

      // Rebuild verb metadata indexes - same strategy as nouns
      let totalVerbsProcessed = 0

      if (isLocalStorage) {
        // Load all verbs at once for local storage
        prodLog.info(`⚡ Loading all verbs at once (local storage)`)
        const result = await this.storage.getVerbs({
          pagination: { offset: 0, limit: 1000000 } // Effectively unlimited
        })

        prodLog.info(`📦 Loading ${result.items.length} verbs with metadata...`)

        // Get all verb metadata at once
        const verbIds = result.items.map(verb => verb.id)
        let verbMetadataBatch: Map<string, any>

        if ((this.storage as any).getVerbMetadataBatch) {
          verbMetadataBatch = await (this.storage as any).getVerbMetadataBatch(verbIds)
          prodLog.info(`✅ Loaded ${verbMetadataBatch.size}/${verbIds.length} verb metadata objects`)
        } else {
          verbMetadataBatch = new Map()
          for (const id of verbIds) {
            try {
              const metadata = await this.storage.getVerbMetadata(id)
              if (metadata) verbMetadataBatch.set(id, metadata)
            } catch (error) {
              prodLog.debug(`Failed to read verb metadata for ${id}:`, error)
            }
          }
        }

        // Process all verbs
        let verbLocalCount = 0
        for (const verb of result.items) {
          const metadata = verbMetadataBatch.get(verb.id)
          if (metadata) {
            await this.addToIndex(verb.id, metadata, true, true)
            verbLocalCount++
            // (Periodic safety flush removed in 7.22.0 — see noun loop above.)
          }
        }

        totalVerbsProcessed = result.items.length
        prodLog.info(`✅ Indexed ${totalVerbsProcessed} verbs`)

      } else {
        // Cloud storage: use conservative batching
        let verbOffset = 0
        const verbLimit = 25
        let hasMoreVerbs = true
        let consecutiveEmptyVerbBatches = 0
        let verbIterations = 0
        const MAX_ITERATIONS = 10000

        while (hasMoreVerbs && verbIterations < MAX_ITERATIONS) {
          verbIterations++
          const result = await this.storage.getVerbs({
            pagination: { offset: verbOffset, limit: verbLimit }
          })

        // CRITICAL SAFETY CHECK: Prevent infinite loop on empty results
        if (result.items.length === 0) {
          consecutiveEmptyVerbBatches++
          if (consecutiveEmptyVerbBatches >= 3) {
            prodLog.warn('⚠️ Breaking verb metadata rebuild loop: received 3 consecutive empty batches')
            break
          }
          // If hasMore is true but items are empty, it's likely a bug
          if (result.hasMore) {
            prodLog.warn(`⚠️ Storage returned empty verb items but hasMore=true at offset ${verbOffset}`)
            hasMoreVerbs = false // Force exit
            break
          }
        } else {
          consecutiveEmptyVerbBatches = 0 // Reset counter on non-empty batch
        }

        // CRITICAL FIX: Use batch verb metadata reading to prevent socket exhaustion
        const verbIds = result.items.map(verb => verb.id)
        
        let verbMetadataBatch: Map<string, any>
        if ((this.storage as any).getVerbMetadataBatch) {
          // Use batch reading if available (prevents socket exhaustion)
          verbMetadataBatch = await (this.storage as any).getVerbMetadataBatch(verbIds)
          prodLog.debug(`📦 Batch loaded ${verbMetadataBatch.size}/${verbIds.length} verb metadata objects`)
        } else {
          // Fallback to individual calls with strict concurrency control
          verbMetadataBatch = new Map()
          const CONCURRENCY_LIMIT = 3 // Very conservative limit to prevent socket exhaustion
          
          for (let i = 0; i < verbIds.length; i += CONCURRENCY_LIMIT) {
            const batch = verbIds.slice(i, i + CONCURRENCY_LIMIT)
            const batchPromises = batch.map(async (id) => {
              try {
                const metadata = await this.storage.getVerbMetadata(id)
                return { id, metadata }
              } catch (error) {
                prodLog.debug(`Failed to read verb metadata for ${id}:`, error)
                return { id, metadata: null }
              }
            })
            
            const batchResults = await Promise.all(batchPromises)
            for (const { id, metadata } of batchResults) {
              if (metadata) {
                verbMetadataBatch.set(id, metadata)
              }
            }
            
            // Yield between batches to prevent socket exhaustion
            await this.yieldToEventLoop()
          }
        }
        
        // Process the verb metadata batch
        for (const verb of result.items) {
          const metadata = verbMetadataBatch.get(verb.id)
          if (metadata) {
            // Skip flush during rebuild for performance
            await this.addToIndex(verb.id, metadata, true, true)
          }
        }

        // Yield after processing the entire batch
        await this.yieldToEventLoop()

        totalVerbsProcessed += result.items.length
        hasMoreVerbs = result.hasMore
        verbOffset += verbLimit
        
        // Progress logging and event loop yield after each batch
        if (totalVerbsProcessed % 100 === 0 || !hasMoreVerbs) {
          prodLog.debug(`🔗 Indexed ${totalVerbsProcessed} verbs...`)
        }
        await this.yieldToEventLoop()
        }

        // Check iteration limits for cloud storage
        if (verbIterations >= MAX_ITERATIONS) {
          prodLog.error(`❌ Metadata verb rebuild hit maximum iteration limit (${MAX_ITERATIONS}). This indicates a bug in storage pagination.`)
        }
      }

      // Flush to storage with final yield. The column store's flush() handles
      // tail-buffer-to-segment promotion + manifest persistence.
      prodLog.debug('💾 Flushing metadata index to storage...')
      await this.flush()
      await this.yieldToEventLoop()

      prodLog.info(`✅ Metadata index rebuild completed! Processed ${totalNounsProcessed} nouns and ${totalVerbsProcessed} verbs`)
      prodLog.info(`🎯 Initial indexing may show minor socket timeouts - this is expected and doesn't affect data processing`)
      
    } finally {
      this.isRebuilding = false
    }
  }

  /**
   * Get field statistics for optimization and discovery
   */
  async getFieldStatistics(): Promise<Map<string, FieldStats>> {
    // Initialize stats for fields we haven't seen yet
    for (const field of this.fieldIndexes.keys()) {
      if (!this.fieldStats.has(field)) {
        this.fieldStats.set(field, {
          cardinality: {
            uniqueValues: 0,
            totalValues: 0,
            distribution: 'uniform',
            updateFrequency: 0,
            lastAnalyzed: Date.now()
          },
          queryCount: 0,
          rangeQueryCount: 0,
          exactQueryCount: 0,
          avgQueryTime: 0,
          indexType: 'hash'
        })
      }
    }
    
    return new Map(this.fieldStats)
  }

  /**
   * Get field cardinality information
   */
  async getFieldCardinality(field: string): Promise<CardinalityInfo | null> {
    const stats = this.fieldStats.get(field)
    return stats ? stats.cardinality : null
  }

  /**
   * Get all field names with their cardinality (for query optimization)
   */
  async getFieldsWithCardinality(): Promise<Array<{ field: string; cardinality: number; distribution: string }>> {
    const fields: Array<{ field: string; cardinality: number; distribution: string }> = []
    
    for (const [field, stats] of this.fieldStats) {
      fields.push({
        field,
        cardinality: stats.cardinality.uniqueValues,
        distribution: stats.cardinality.distribution
      })
    }
    
    // Sort by cardinality (low cardinality fields are better for filtering)
    fields.sort((a, b) => a.cardinality - b.cardinality)
    
    return fields
  }

  /**
   * Get optimal query plan based on field statistics
   */
  async getOptimalQueryPlan(filters: Record<string, any>): Promise<{
    strategy: 'exact' | 'range' | 'hybrid'
    fieldOrder: string[]
    estimatedCost: number
  }> {
    const fieldOrder: string[] = []
    let hasRangeQueries = false
    let totalEstimatedCost = 0
    
    // Analyze each filter
    for (const [field, value] of Object.entries(filters)) {
      const stats = this.fieldStats.get(field)
      if (!stats) continue
      
      // Check if this is a range query
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        hasRangeQueries = true
      }
      
      // Estimate cost based on cardinality
      const cardinality = stats.cardinality.uniqueValues
      const estimatedCost = Math.log2(Math.max(1, cardinality))
      totalEstimatedCost += estimatedCost
      
      fieldOrder.push(field)
    }
    
    // Sort fields by cardinality (process low cardinality first)
    fieldOrder.sort((a, b) => {
      const statsA = this.fieldStats.get(a)
      const statsB = this.fieldStats.get(b)
      if (!statsA || !statsB) return 0
      return statsA.cardinality.uniqueValues - statsB.cardinality.uniqueValues
    })
    
    return {
      strategy: hasRangeQueries ? 'hybrid' : 'exact',
      fieldOrder,
      estimatedCost: totalEstimatedCost
    }
  }

  /**
   * Export field statistics for analysis
   */
  async exportFieldStats(): Promise<any> {
    const stats: any = {
      fields: {},
      summary: {
        totalFields: this.fieldStats.size,
        highCardinalityFields: 0,
        sparseFields: 0,
        skewedFields: 0,
        uniformFields: 0
      }
    }
    
    for (const [field, fieldStats] of this.fieldStats) {
      stats.fields[field] = {
        cardinality: fieldStats.cardinality,
        queryStats: {
          total: fieldStats.queryCount,
          exact: fieldStats.exactQueryCount,
          range: fieldStats.rangeQueryCount,
          avgTime: fieldStats.avgQueryTime
        },
        indexType: fieldStats.indexType,
        normalization: fieldStats.normalizationStrategy
      }
      
      // Update summary
      if (fieldStats.cardinality.uniqueValues > this.HIGH_CARDINALITY_THRESHOLD) {
        stats.summary.highCardinalityFields++
      }
      
      switch (fieldStats.cardinality.distribution) {
        case 'sparse':
          stats.summary.sparseFields++
          break
        case 'skewed':
          stats.summary.skewedFields++
          break
        case 'uniform':
          stats.summary.uniformFields++
          break
      }
    }
    
    return stats
  }
  
  /**
   * Update type-field affinity tracking for intelligent NLP
   * Tracks which fields commonly appear with which entity types
   */
  private updateTypeFieldAffinity(entityId: string, field: string, value: any, operation: 'add' | 'remove', metadata?: any): void {
    // Only track affinity for non-system fields (but allow 'noun' for type detection)
    if (this.config.excludeFields.includes(field) && field !== 'noun') return

    // For the 'noun' field, the value IS the entity type
    let entityType: string | null = null

    if (field === 'noun') {
      // This is the type definition itself
      entityType = this.normalizeValue(value, field)  // Pass field for bucketing!
    } else if (metadata && metadata.noun) {
      // Extract entity type from metadata
      entityType = this.normalizeValue(metadata.noun, 'noun')
    } else {
      // No type information available, skip affinity tracking
      return
    }

    if (!entityType) return // No type found, skip affinity tracking
    
    // Initialize affinity tracking for this type
    if (!this.typeFieldAffinity.has(entityType)) {
      this.typeFieldAffinity.set(entityType, new Map())
    }
    if (!this.totalEntitiesByType.has(entityType)) {
      this.totalEntitiesByType.set(entityType, 0)
    }
    
    const typeFields = this.typeFieldAffinity.get(entityType)!
    
    if (operation === 'add') {
      // Increment field count for this type
      const currentCount = typeFields.get(field) || 0
      typeFields.set(field, currentCount + 1)

      // Update total entities of this type (only count once per entity)
      if (field === 'noun') {
        const newCount = this.totalEntitiesByType.get(entityType)! + 1
        this.totalEntitiesByType.set(entityType, newCount)

        // Phase 1b: Also update fixed-size array
        // Try to parse as noun type - if it matches a known type, update the array
        try {
          const nounTypeIndex = TypeUtils.getNounIndex(entityType as NounType)
          this.entityCountsByTypeFixed[nounTypeIndex] = newCount
        } catch {
          // Not a recognized noun type, skip fixed-size array update
        }
      }
    } else if (operation === 'remove') {
      // Decrement field count for this type
      const currentCount = typeFields.get(field) || 0
      if (currentCount > 1) {
        typeFields.set(field, currentCount - 1)
      } else {
        typeFields.delete(field)
      }

      // Update total entities of this type
      if (field === 'noun') {
        const total = this.totalEntitiesByType.get(entityType)!
        if (total > 1) {
          const newCount = total - 1
          this.totalEntitiesByType.set(entityType, newCount)

          // Phase 1b: Also update fixed-size array
          try {
            const nounTypeIndex = TypeUtils.getNounIndex(entityType as NounType)
            this.entityCountsByTypeFixed[nounTypeIndex] = newCount
          } catch {
            // Not a recognized noun type, skip fixed-size array update
          }
        } else {
          this.totalEntitiesByType.delete(entityType)
          this.typeFieldAffinity.delete(entityType)

          // Phase 1b: Also zero out fixed-size array
          try {
            const nounTypeIndex = TypeUtils.getNounIndex(entityType as NounType)
            this.entityCountsByTypeFixed[nounTypeIndex] = 0
          } catch {
            // Not a recognized noun type, skip fixed-size array update
          }
        }
      }
    }
  }
  
  /**
   * Get fields that commonly appear with a specific entity type
   * Returns fields with their affinity scores (0-1)
   */
  async getFieldsForType(nounType: NounType): Promise<Array<{
    field: string
    affinity: number
    occurrences: number
    totalEntities: number
  }>> {
    const typeFields = this.typeFieldAffinity.get(nounType)
    const totalEntities = this.totalEntitiesByType.get(nounType)
    
    if (!typeFields || !totalEntities) {
      return []
    }
    
    const fieldsWithAffinity: Array<{
      field: string
      affinity: number
      occurrences: number
      totalEntities: number
    }> = []
    
    for (const [field, count] of typeFields.entries()) {
      const affinity = count / totalEntities // 0-1 score
      fieldsWithAffinity.push({
        field,
        affinity,
        occurrences: count,
        totalEntities
      })
    }
    
    // Sort by affinity (most common fields first)
    fieldsWithAffinity.sort((a, b) => b.affinity - a.affinity)
    
    return fieldsWithAffinity
  }
  
  /**
   * Get type-field affinity statistics for analysis
   */
  async getTypeFieldAffinityStats(): Promise<{
    totalTypes: number
    averageFieldsPerType: number
    typeBreakdown: Record<string, {
      totalEntities: number
      uniqueFields: number
      topFields: Array<{field: string; affinity: number}>
    }>
  }> {
    const typeBreakdown: Record<string, any> = {}
    let totalFields = 0

    for (const [nounType, fieldsMap] of this.typeFieldAffinity.entries()) {
      const totalEntities = this.totalEntitiesByType.get(nounType) || 0
      const fields = Array.from(fieldsMap.entries())

      // Get top 5 fields for this type
      const topFields = fields
        .map(([field, count]) => ({ field, affinity: count / totalEntities }))
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 5)

      typeBreakdown[nounType] = {
        totalEntities,
        uniqueFields: fieldsMap.size,
        topFields
      }

      totalFields += fieldsMap.size
    }

    return {
      totalTypes: this.typeFieldAffinity.size,
      averageFieldsPerType: totalFields / Math.max(1, this.typeFieldAffinity.size),
      typeBreakdown
    }
  }
}