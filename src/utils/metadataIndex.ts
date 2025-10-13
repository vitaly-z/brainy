/**
 * Metadata Index System
 * Maintains inverted indexes for fast metadata filtering
 * Automatically updates indexes when data changes
 */

import { StorageAdapter } from '../coreTypes.js'
import { MetadataIndexCache, MetadataIndexCacheConfig } from './metadataIndexCache.js'
import { prodLog } from './logger.js'
import { getGlobalCache, UnifiedCache } from './unifiedCache.js'
import { NounType } from '../types/graphTypes.js'
import {
  SparseIndex,
  ChunkManager,
  AdaptiveChunkingStrategy,
  ChunkData,
  ChunkDescriptor,
  ZoneMap
} from './metadataIndexChunking.js'
import { EntityIdMapper } from './entityIdMapper.js'
import RoaringBitmap32 from 'roaring/RoaringBitmap32'

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
  indexType: 'hash' // v3.42.0: Only 'hash' since all fields use chunked sparse indices with zone maps
  normalizationStrategy?: 'none' | 'precision' | 'bucket'
}

export class MetadataIndexManager {
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
  
  // Unified cache for coordinated memory management
  private unifiedCache: UnifiedCache

  // File locking for concurrent write protection (prevents race conditions)
  private activeLocks = new Map<string, { expiresAt: number; lockValue: string }>()
  private lockPromises = new Map<string, Promise<boolean>>()
  private lockTimers = new Map<string, NodeJS.Timeout>() // Track timers for cleanup

  // Adaptive Chunked Sparse Indexing (v3.42.0)
  // Reduces file count from 560k → 89 files (630x reduction)
  // ALL fields now use chunking - no more flat files
  private sparseIndices = new Map<string, SparseIndex>() // field -> sparse index
  private chunkManager: ChunkManager
  private chunkingStrategy: AdaptiveChunkingStrategy

  // Roaring Bitmap Support (v3.43.0)
  // EntityIdMapper for UUID ↔ integer conversion
  private idMapper: EntityIdMapper

  constructor(storage: StorageAdapter, config: MetadataIndexConfig = {}) {
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

    // Initialize EntityIdMapper for roaring bitmap UUID ↔ integer mapping (v3.43.0)
    this.idMapper = new EntityIdMapper({
      storage,
      storageKey: 'brainy:entityIdMapper'
    })

    // Initialize chunking system (v3.42.0) with roaring bitmap support
    this.chunkManager = new ChunkManager(storage, this.idMapper)
    this.chunkingStrategy = new AdaptiveChunkingStrategy()

    // Lazy load counts from storage statistics on first access
    this.lazyLoadCounts()
  }

  /**
   * Initialize the metadata index manager
   * This must be called after construction and before any queries
   */
  async init(): Promise<void> {
    // Initialize EntityIdMapper (loads UUID ↔ integer mappings from storage)
    await this.idMapper.init()
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
   * Lazy load entity counts from storage statistics (O(1) operation)
   * This avoids rebuilding the entire index on startup
   */
  private async lazyLoadCounts(): Promise<void> {
    try {
      // Get statistics from storage (should be O(1) with our FileSystemStorage improvements)
      const stats = await this.storage.getStatistics()
      if (stats && stats.nounCount) {
        // Populate entity counts from storage statistics
        for (const [type, count] of Object.entries(stats.nounCount)) {
          if (typeof count === 'number' && count > 0) {
            this.totalEntitiesByType.set(type, count)
          }
        }
      }
    } catch (error) {
      // Silently fail - counts will be populated as entities are added
      // This maintains zero-configuration principle
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

    // Track unique values by checking fieldIndex counts (v3.42.0 - removed indexCache)
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

    // All fields use chunked sparse indexing with zone maps (v3.42.0)
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
  // Adaptive Chunked Sparse Indexing (v3.42.0)
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

  /**
   * Get IDs for a value using chunked sparse index with roaring bitmaps (v3.43.0)
   */
  private async getIdsFromChunks(field: string, value: any): Promise<string[]> {
    // Load sparse index
    let sparseIndex = this.sparseIndices.get(field)
    if (!sparseIndex) {
      sparseIndex = await this.loadSparseIndex(field)
      if (!sparseIndex) {
        return [] // No chunked index exists yet
      }
      this.sparseIndices.set(field, sparseIndex)
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
   * Get IDs for a range using chunked sparse index with zone maps and roaring bitmaps (v3.43.0)
   */
  private async getIdsFromChunksForRange(
    field: string,
    min?: any,
    max?: any,
    includeMin: boolean = true,
    includeMax: boolean = true
  ): Promise<string[]> {
    // Load sparse index
    let sparseIndex = this.sparseIndices.get(field)
    if (!sparseIndex) {
      sparseIndex = await this.loadSparseIndex(field)
      if (!sparseIndex) {
        return [] // No chunked index exists yet
      }
      this.sparseIndices.set(field, sparseIndex)
    }

    // Find candidate chunks using zone maps
    const candidateChunkIds = sparseIndex.findChunksForRange(min, max)

    if (candidateChunkIds.length === 0) {
      return []
    }

    // Load chunks and filter by range, collecting integer IDs from roaring bitmaps
    const allIntIds = new Set<number>()
    for (const chunkId of candidateChunkIds) {
      const chunk = await this.chunkManager.loadChunk(field, chunkId)
      if (chunk) {
        for (const [value, bitmap] of chunk.entries) {
          // Check if value is in range
          let inRange = true

          if (min !== undefined) {
            inRange = inRange && (includeMin ? value >= min : value > min)
          }

          if (max !== undefined) {
            inRange = inRange && (includeMax ? value <= max : value < max)
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
   * Get roaring bitmap for a field-value pair without converting to UUIDs (v3.43.0)
   * This is used for fast multi-field intersection queries using hardware-accelerated bitmap AND
   * @returns RoaringBitmap32 containing integer IDs, or null if no matches
   */
  private async getBitmapFromChunks(field: string, value: any): Promise<RoaringBitmap32 | null> {
    // Load sparse index
    let sparseIndex = this.sparseIndices.get(field)
    if (!sparseIndex) {
      sparseIndex = await this.loadSparseIndex(field)
      if (!sparseIndex) {
        return null // No chunked index exists yet
      }
      this.sparseIndices.set(field, sparseIndex)
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
    return RoaringBitmap32.or(...bitmaps)
  }

  /**
   * Get IDs for multiple field-value pairs using fast roaring bitmap intersection (v3.43.0)
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
  async getIdsForMultipleFields(fieldValuePairs: Array<{ field: string; value: any }>): Promise<string[]> {
    if (fieldValuePairs.length === 0) {
      return []
    }

    // Fast path: single field query
    if (fieldValuePairs.length === 1) {
      const { field, value } = fieldValuePairs[0]
      return await this.getIds(field, value)
    }

    // Collect roaring bitmaps for each field-value pair
    const bitmaps: RoaringBitmap32[] = []

    for (const { field, value } of fieldValuePairs) {
      const bitmap = await this.getBitmapFromChunks(field, value)
      if (!bitmap || bitmap.size === 0) {
        // Short circuit: if any field has no matches, intersection is empty
        return []
      }
      bitmaps.push(bitmap)
    }

    // Hardware-accelerated intersection using SIMD instructions (AVX2/SSE4.2)
    // This is 500-900x faster than JavaScript array filtering
    const intersectionBitmap = RoaringBitmap32.and(...bitmaps)

    // Check if empty before converting
    if (intersectionBitmap.size === 0) {
      return []
    }

    // Convert final bitmap to UUIDs (only once, not per-field)
    return this.idMapper.intsIterableToUuids(intersectionBitmap)
  }

  /**
   * Add value-ID mapping to chunked index
   */
  private async addToChunkedIndex(field: string, value: any, id: string): Promise<void> {
    // Load or create sparse index
    let sparseIndex = this.sparseIndices.get(field)
    if (!sparseIndex) {
      sparseIndex = await this.loadSparseIndex(field)
      if (!sparseIndex) {
        // Create new sparse index
        const stats = this.fieldStats.get(field)
        const chunkSize = stats
          ? this.chunkingStrategy.getOptimalChunkSize({
              uniqueValues: stats.cardinality.uniqueValues,
              distribution: stats.cardinality.distribution,
              avgIdsPerValue: stats.cardinality.totalValues / Math.max(1, stats.cardinality.uniqueValues)
            })
          : 50

        sparseIndex = new SparseIndex(field, chunkSize)
      }
      this.sparseIndices.set(field, sparseIndex)
    }

    const normalizedValue = this.normalizeValue(value, field)

    // Find existing chunk for this value (check zone maps)
    const candidateChunkIds = sparseIndex.findChunksForValue(normalizedValue)

    let targetChunk: ChunkData | null = null
    let targetChunkId: number | null = null

    // Try to find an existing chunk with this value
    for (const chunkId of candidateChunkIds) {
      const chunk = await this.chunkManager.loadChunk(field, chunkId)
      if (chunk && chunk.entries.has(normalizedValue)) {
        targetChunk = chunk
        targetChunkId = chunkId
        break
      }
    }

    // If no chunk has this value, find chunk with space or create new one
    if (!targetChunk) {
      // Find a chunk with available space
      for (const chunkId of sparseIndex.getAllChunkIds()) {
        const chunk = await this.chunkManager.loadChunk(field, chunkId)
        const descriptor = sparseIndex.getChunk(chunkId)
        if (chunk && descriptor && chunk.entries.size < descriptor.splitThreshold) {
          targetChunk = chunk
          targetChunkId = chunkId
          break
        }
      }
    }

    // Create new chunk if needed
    if (!targetChunk) {
      targetChunk = await this.chunkManager.createChunk(field)
      targetChunkId = targetChunk.chunkId

      // Register in sparse index
      const descriptor: ChunkDescriptor = {
        chunkId: targetChunk.chunkId,
        field,
        valueCount: 0,
        idCount: 0,
        zoneMap: { min: null, max: null, count: 0, hasNulls: false },
        lastUpdated: Date.now(),
        splitThreshold: 80,
        mergeThreshold: 20
      }
      sparseIndex.registerChunk(descriptor)
    }

    // Add to chunk
    await this.chunkManager.addToChunk(targetChunk, normalizedValue, id)
    await this.chunkManager.saveChunk(targetChunk)

    // Update chunk descriptor in sparse index
    const updatedZoneMap = this.chunkManager.calculateZoneMap(targetChunk)
    const updatedBloomFilter = this.chunkManager.createBloomFilter(targetChunk)

    sparseIndex.updateChunk(targetChunkId!, {
      valueCount: targetChunk.entries.size,
      idCount: Array.from(targetChunk.entries.values()).reduce((sum, bitmap) => sum + bitmap.size, 0),
      zoneMap: updatedZoneMap,
      lastUpdated: Date.now()
    })

    // Update bloom filter
    const descriptor = sparseIndex.getChunk(targetChunkId!)
    if (descriptor) {
      sparseIndex.registerChunk(descriptor, updatedBloomFilter)
    }

    // Check if chunk needs splitting
    if (targetChunk.entries.size > 80) {
      await this.chunkManager.splitChunk(targetChunk, sparseIndex)
    }

    // Save sparse index
    await this.saveSparseIndex(field, sparseIndex)
  }

  /**
   * Remove ID from chunked index
   */
  private async removeFromChunkedIndex(field: string, value: any, id: string): Promise<void> {
    const sparseIndex = this.sparseIndices.get(field) || await this.loadSparseIndex(field)
    if (!sparseIndex) {
      return // No chunked index exists
    }

    const normalizedValue = this.normalizeValue(value, field)
    const candidateChunkIds = sparseIndex.findChunksForValue(normalizedValue)

    for (const chunkId of candidateChunkIds) {
      const chunk = await this.chunkManager.loadChunk(field, chunkId)
      if (chunk && chunk.entries.has(normalizedValue)) {
        await this.chunkManager.removeFromChunk(chunk, normalizedValue, id)
        await this.chunkManager.saveChunk(chunk)

        // Update sparse index
        const updatedZoneMap = this.chunkManager.calculateZoneMap(chunk)
        sparseIndex.updateChunk(chunkId, {
          valueCount: chunk.entries.size,
          idCount: Array.from(chunk.entries.values()).reduce((sum, bitmap) => sum + bitmap.size, 0),
          zoneMap: updatedZoneMap,
          lastUpdated: Date.now()
        })

        await this.saveSparseIndex(field, sparseIndex)
        break
      }
    }
  }

  /**
   * Get IDs matching a range query using zone maps
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

    // All fields use chunked sparse index with zone map optimization (v3.42.0)
    return await this.getIdsFromChunksForRange(field, min, max, includeMin, includeMax)
  }

  /**
   * Generate field index filename for filter discovery
   */
  private getFieldIndexFilename(field: string): string {
    return `field_${field}`
  }

  /**
   * Generate value chunk filename for scalable storage
   */
  private getValueChunkFilename(field: string, value: any, chunkIndex: number = 0): string {
    const normalizedValue = this.normalizeValue(value, field)  // Pass field for bucketing!
    const safeValue = this.makeSafeFilename(normalizedValue)
    return `${field}_${safeValue}_chunk${chunkIndex}`
  }

  /**
   * Make a value safe for use in filenames
   */
  private makeSafeFilename(value: string): string {
    // Replace unsafe characters and limit length
    return value
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50)
      .toLowerCase()
  }

  /**
   * Normalize value for consistent indexing with smart optimization
   */
  private normalizeValue(value: any, field?: string): string {
    if (value === null || value === undefined) return '__NULL__'
    if (typeof value === 'boolean') return value ? '__TRUE__' : '__FALSE__'

    // ALWAYS apply bucketing to temporal fields (prevents pollution from the start!)
    // This is the key fix: don't wait for cardinality stats, just bucket immediately
    if (field && typeof value === 'number') {
      const fieldLower = field.toLowerCase()
      const isTemporal = fieldLower.includes('time') || fieldLower.includes('date') ||
                        fieldLower.includes('accessed') || fieldLower.includes('modified') ||
                        fieldLower.includes('created') || fieldLower.includes('updated')

      if (isTemporal) {
        // Apply time bucketing immediately (no need to wait for stats)
        const bucketSize = this.TIMESTAMP_PRECISION_MS  // 1 minute buckets
        const bucketed = Math.floor(value / bucketSize) * bucketSize
        return bucketed.toString()
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
   * Extract indexable field-value pairs from metadata
   */
  private extractIndexableFields(metadata: any): Array<{ field: string, value: any }> {
    const fields: Array<{ field: string, value: any }> = []
    
    const extract = (obj: any, prefix = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key
        
        if (!this.shouldIndexField(fullKey)) continue
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Recurse into nested objects
          extract(value, fullKey)
        } else {
          // Index this field
          fields.push({ field: fullKey, value })
          
          // If it's an array, also index each element
          if (Array.isArray(value)) {
            for (const item of value) {
              fields.push({ field: fullKey, value: item })
            }
          }
        }
      }
    }
    
    if (metadata && typeof metadata === 'object') {
      extract(metadata)
    }
    
    return fields
  }

  /**
   * Add item to metadata indexes
   */
  async addToIndex(id: string, metadata: any, skipFlush: boolean = false): Promise<void> {
    const fields = this.extractIndexableFields(metadata)
    
    // Sort fields to process 'noun' field first for type-field affinity tracking
    fields.sort((a, b) => {
      if (a.field === 'noun') return -1
      if (b.field === 'noun') return 1
      return 0
    })
    
    // Track which fields we're updating for incremental sorted index maintenance
    const updatedFields = new Set<string>()
    
    for (let i = 0; i < fields.length; i++) {
      const { field, value } = fields[i]

      // All fields use chunked sparse indexing (v3.42.0)
      await this.addToChunkedIndex(field, value, id)

      // Update statistics and tracking
      this.updateCardinalityStats(field, value, 'add')
      this.updateTypeFieldAffinity(id, field, value, 'add', metadata)
      await this.updateFieldIndex(field, value, 1)

      // Yield to event loop every 5 fields to prevent blocking
      if (i % 5 === 4) {
        await this.yieldToEventLoop()
      }
    }
    
    // Adaptive auto-flush based on usage patterns (v3.42.0 - flush field indexes only)
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
   */
  async removeFromIndex(id: string, metadata?: any): Promise<void> {
    if (metadata) {
      // Remove from specific field indexes
      const fields = this.extractIndexableFields(metadata)

      for (const { field, value } of fields) {
        // All fields use chunked sparse indexing (v3.42.0)
        await this.removeFromChunkedIndex(field, value, id)

        // Update statistics and tracking
        this.updateCardinalityStats(field, value, 'remove')
        this.updateTypeFieldAffinity(id, field, value, 'remove', metadata)
        await this.updateFieldIndex(field, value, -1)

        // Invalidate cache
        this.metadataCache.invalidatePattern(`field_values_${field}`)
      }
    } else {
      // Remove from all indexes (slower, requires scanning all chunks)
      // This should be rare - prefer providing metadata when removing
      prodLog.warn(`Removing ID ${id} without metadata requires scanning all sparse indices (slow)`)

      // Scan all sparse indices
      for (const [field, sparseIndex] of this.sparseIndices.entries()) {
        for (const chunkId of sparseIndex.getAllChunkIds()) {
          const chunk = await this.chunkManager.loadChunk(field, chunkId)
          if (chunk) {
            // Convert UUID to integer for bitmap checking
            const intId = this.idMapper.getInt(id)
            if (intId !== undefined) {
              // Check all values in this chunk
              for (const [value, bitmap] of chunk.entries) {
                if (bitmap.has(intId)) {
                  await this.removeFromChunkedIndex(field, value, id)
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Get all IDs in the index
   */
  async getAllIds(): Promise<string[]> {
    // Use storage as the source of truth (v3.42.0 - removed redundant indexCache scan)
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
  async getIds(field: string, value: any): Promise<string[]> {
    // Track exact query for field statistics
    if (this.fieldStats.has(field)) {
      const stats = this.fieldStats.get(field)!
      stats.exactQueryCount++
    }

    // All fields use chunked sparse indexing (v3.42.0)
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
    
    // Process field filters with range support
    const idSets: string[][] = []
    
    for (const [field, condition] of Object.entries(filter)) {
      // Skip logical operators
      if (field === 'allOf' || field === 'anyOf' || field === 'not') continue
      
      let fieldResults: string[] = []
      
      if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
        // Handle Brainy Field Operators
        for (const [op, operand] of Object.entries(condition)) {
          switch (op) {
            // Exact match operators
            case 'equals':
            case 'is':
            case 'eq':
              fieldResults = await this.getIds(field, operand)
              break
            
            // Multiple value operators
            case 'oneOf':
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
            
            // Range operators
            case 'greaterThan':
            case 'gt':
              fieldResults = await this.getIdsForRange(field, operand, undefined, false, true)
              break
            
            case 'greaterEqual':
            case 'gte':
            case 'greaterThanOrEqual':
              fieldResults = await this.getIdsForRange(field, operand, undefined, true, true)
              break
            
            case 'lessThan':
            case 'lt':
              fieldResults = await this.getIdsForRange(field, undefined, operand, true, false)
              break
            
            case 'lessEqual':
            case 'lte':
            case 'lessThanOrEqual':
              fieldResults = await this.getIdsForRange(field, undefined, operand, true, true)
              break
            
            case 'between':
              if (Array.isArray(operand) && operand.length === 2) {
                fieldResults = await this.getIdsForRange(field, operand[0], operand[1], true, true)
              }
              break
            
            // Array contains operator
            case 'contains':
              fieldResults = await this.getIds(field, operand)
              break
            
            // Existence operator
            case 'exists':
              if (operand) {
                // Get all IDs that have this field (any value) from chunked sparse index with roaring bitmaps (v3.43.0)
                const allIntIds = new Set<number>()

                // Load sparse index for this field
                const sparseIndex = this.sparseIndices.get(field) || await this.loadSparseIndex(field)
                if (sparseIndex) {
                  // Iterate through all chunks for this field
                  for (const chunkId of sparseIndex.getAllChunkIds()) {
                    const chunk = await this.chunkManager.loadChunk(field, chunkId)
                    if (chunk) {
                      // Collect all integer IDs from all roaring bitmaps in this chunk
                      for (const bitmap of chunk.entries.values()) {
                        for (const intId of bitmap) {
                          allIntIds.add(intId)
                        }
                      }
                    }
                  }
                }

                // Convert integer IDs back to UUIDs
                fieldResults = this.idMapper.intsIterableToUuids(allIntIds)
              }
              break
            
            // Negation operators
            case 'notEquals':
            case 'isNot':
            case 'ne':
              // For notEquals, we need all IDs EXCEPT those matching the value
              // This is especially important for soft delete: deleted !== true
              // should include items without a deleted field
              
              // First, get all IDs in the database
              const allItemIds = await this.getAllIds()
              
              // Then get IDs that match the value we want to exclude
              const excludeIds = await this.getIds(field, operand)
              const excludeSet = new Set(excludeIds)
              
              // Return all IDs except those to exclude
              fieldResults = allItemIds.filter(id => !excludeSet.has(id))
              break
          }
        }
      } else {
        // Direct value match (shorthand for equals)
        fieldResults = await this.getIds(field, condition)
      }
      
      if (fieldResults.length > 0) {
        idSets.push(fieldResults)
      } else {
        // If any field has no matches, intersection will be empty
        return []
      }
    }
    
    if (idSets.length === 0) return []
    if (idSets.length === 1) return idSets[0]
    
    // Intersection of all field criteria (implicit AND)
    return idSets.reduce((intersection, currentSet) => 
      intersection.filter(id => currentSet.includes(id))
    )
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
    
    for (const { field, values } of criteria) {
      const unionIds = new Set<string>()
      for (const value of values) {
        const ids = await this.getIds(field, value)
        ids.forEach(id => unionIds.add(id))
      }
      idSets.push(Array.from(unionIds))
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
   * NOTE (v3.42.0): Sparse indices are flushed immediately in add/remove operations
   */
  async flush(): Promise<void> {
    // Check if we have anything to flush
    if (this.dirtyFields.size === 0) {
      return // Nothing to flush
    }

    // Process in smaller batches to avoid blocking
    const BATCH_SIZE = 20
    const allPromises: Promise<void>[] = []

    // Flush field indexes in batches (v3.42.0 - removed flat file flushing)
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

    // Flush EntityIdMapper (UUID ↔ integer mappings) (v3.43.0)
    await this.idMapper.flush()

    this.dirtyFields.clear()
    this.lastFlushTime = Date.now()
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

      await this.storage.saveMetadata(indexId, {
        values: fieldIndex.values,
        lastUpdated: fieldIndex.lastUpdated
      })

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
   */
  getAllEntityCounts(): Map<string, number> {
    return new Map(this.totalEntitiesByType)
  }

  /**
   * Get count of entities matching field-value criteria - queries chunked sparse index
   */
  async getCountForCriteria(field: string, value: any): Promise<number> {
    // Use chunked sparse indexing (v3.42.0 - removed indexCache)
    const ids = await this.getIds(field, value)
    return ids.length
  }

  /**
   * Get index statistics with enhanced counting information
   */
  async getStats(): Promise<MetadataIndexStats> {
    const fields = new Set<string>()
    let totalEntries = 0
    let totalIds = 0

    // Collect stats from sparse indices (v3.42.0 - removed indexCache)
    for (const [field, sparseIndex] of this.sparseIndices.entries()) {
      fields.add(field)

      // Count entries and IDs from all chunks
      for (const chunkId of sparseIndex.getAllChunkIds()) {
        const chunk = await this.chunkManager.loadChunk(field, chunkId)
        if (chunk) {
          totalEntries += chunk.entries.size
          for (const ids of chunk.entries.values()) {
            totalIds += ids.size
          }
        }
      }
    }

    // Also include fields from fieldIndexes that might not have sparse indices yet
    for (const field of this.fieldIndexes.keys()) {
      fields.add(field)
    }

    return {
      totalEntries,
      totalIds,
      fieldsIndexed: Array.from(fields),
      lastRebuild: Date.now(),
      indexSize: totalEntries * 100 // rough estimate
    }
  }

  /**
   * Rebuild entire index from scratch using pagination
   * Non-blocking version that yields control back to event loop
   */
  async rebuild(): Promise<void> {
    if (this.isRebuilding) return
    
    this.isRebuilding = true
    try {
      prodLog.info('🔄 Starting non-blocking metadata index rebuild with batch processing to prevent socket exhaustion...')
    prodLog.info(`📊 Storage adapter: ${this.storage.constructor.name}`)
    prodLog.info(`🔧 Batch processing available: ${!!this.storage.getMetadataBatch}`)

      // Clear existing indexes (v3.42.0 - use sparse indices instead of flat files)
      this.sparseIndices.clear()
      this.fieldIndexes.clear()
      this.dirtyFields.clear()
      
      // Rebuild noun metadata indexes using pagination
      let nounOffset = 0
      const nounLimit = 25 // Even smaller batches during initialization to prevent socket exhaustion
      let hasMoreNouns = true
      let totalNounsProcessed = 0
      let consecutiveEmptyBatches = 0
      const MAX_ITERATIONS = 10000 // Safety limit to prevent infinite loops
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
            await this.addToIndex(noun.id, metadata, true)
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
      
      // Rebuild verb metadata indexes using pagination
      let verbOffset = 0
      const verbLimit = 25 // Even smaller batches during initialization to prevent socket exhaustion
      let hasMoreVerbs = true
      let totalVerbsProcessed = 0
      let consecutiveEmptyVerbBatches = 0
      let verbIterations = 0

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
            await this.addToIndex(verb.id, metadata, true)
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
      
      // Check if we hit iteration limits
      if (iterations >= MAX_ITERATIONS) {
        prodLog.error(`❌ Metadata noun rebuild hit maximum iteration limit (${MAX_ITERATIONS}). This indicates a bug in storage pagination.`)
      }
      if (verbIterations >= MAX_ITERATIONS) {
        prodLog.error(`❌ Metadata verb rebuild hit maximum iteration limit (${MAX_ITERATIONS}). This indicates a bug in storage pagination.`)
      }

      // Flush to storage with final yield
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
      // Extract entity type from metadata (v3.42.0 - removed indexCache scan)
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
        this.totalEntitiesByType.set(entityType, this.totalEntitiesByType.get(entityType)! + 1)
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
          this.totalEntitiesByType.set(entityType, total - 1)
        } else {
          this.totalEntitiesByType.delete(entityType)
          this.typeFieldAffinity.delete(entityType)
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