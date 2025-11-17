/**
 * Historical Storage Adapter
 *
 * Provides lazy-loading read-only access to a historical commit state.
 * Uses LRU cache to bound memory usage and prevent eager-loading of entire history.
 *
 * Architecture:
 * - Extends BaseStorage to inherit all storage infrastructure
 * - Wraps an underlying storage adapter to access commit state
 * - Implements lazy-loading with LRU cache (bounded memory)
 * - All writes throw read-only errors
 * - All reads load from historical commit state on-demand
 *
 * Usage:
 *   const historical = new HistoricalStorageAdapter({
 *     underlyingStorage: brain.storage as BaseStorage,
 *     commitId: 'abc123...',
 *     cacheSize: 10000  // LRU cache size
 *   })
 *   await historical.init()
 *
 * Performance:
 * - O(1) cache lookups for frequently accessed entities
 * - Bounded memory: max cacheSize entities in memory
 * - Lazy loading: only loads entities when accessed
 * - No eager-loading of entire commit state
 *
 * v5.4.0: Production-ready, billion-scale historical queries
 */

import { BaseStorage } from '../baseStorage.js'
import { CommitLog } from '../cow/CommitLog.js'
import { TreeObject } from '../cow/TreeObject.js'
import { BlobStorage } from '../cow/BlobStorage.js'
import {
  HNSWNoun,
  HNSWVerb,
  NounMetadata,
  VerbMetadata,
  StatisticsData
} from '../../coreTypes.js'

/**
 * Simple LRU Cache implementation
 * Bounds memory usage by evicting least-recently-used items
 */
class LRUCache<T> {
  private cache = new Map<string, T>()
  private accessOrder: string[] = []
  private maxSize: number

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter(k => k !== key)
      this.accessOrder.push(key)
    }
    return value
  }

  set(key: string, value: T): void {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key)
    }

    // Add to cache
    this.cache.set(key, value)
    this.accessOrder.push(key)

    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const oldest = this.accessOrder.shift()
      if (oldest) {
        this.cache.delete(oldest)
      }
    }
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  get size(): number {
    return this.cache.size
  }
}

export interface HistoricalStorageAdapterOptions {
  /** Underlying storage to access commit state from */
  underlyingStorage: BaseStorage

  /** Commit ID to load historical state from */
  commitId: string

  /** Max number of entities to cache (default: 10000) */
  cacheSize?: number

  /** Branch containing the commit (default: 'main') */
  branch?: string
}

/**
 * Historical Storage Adapter
 *
 * Lazy-loading, read-only storage adapter for historical commit state.
 * Implements billion-scale time-travel queries with bounded memory.
 */
export class HistoricalStorageAdapter extends BaseStorage {
  private underlyingStorage: BaseStorage
  private commitId: string
  private branch: string
  private cacheSize: number

  // LRU caches for lazy-loaded entities
  private cache: LRUCache<any>

  // Historical commit state (loaded lazily) - must match BaseStorage visibility
  public commitLog?: CommitLog
  public treeObject?: TreeObject
  public blobStorage?: BlobStorage

  constructor(options: HistoricalStorageAdapterOptions) {
    super()
    this.underlyingStorage = options.underlyingStorage
    this.commitId = options.commitId
    this.branch = options.branch || 'main'
    this.cacheSize = options.cacheSize || 10000

    this.cache = new LRUCache(this.cacheSize)
  }

  /**
   * Initialize historical storage adapter
   * Loads commit metadata but NOT entity data (lazy loading)
   */
  public async init(): Promise<void> {
    // Get COW components from underlying storage
    this.commitLog = (this.underlyingStorage as any)._commitLog
    this.treeObject = (this.underlyingStorage as any)._treeObject
    this.blobStorage = (this.underlyingStorage as any)._blobStorage

    if (!this.commitLog || !this.treeObject || !this.blobStorage) {
      throw new Error(
        'Historical storage requires underlying storage to have COW enabled. ' +
        'Call brain.init() first to initialize COW.'
      )
    }

    // Verify commit exists
    const commit = await this.commitLog.getCommit(this.commitId)
    if (!commit) {
      throw new Error(`Commit not found: ${this.commitId}`)
    }

    // Mark as initialized
    this.isInitialized = true
  }

  // ============= Abstract Method Implementations =============

  /**
   * Read object from historical commit state
   * Uses LRU cache to avoid repeated blob reads
   */
  protected async readObjectFromPath(path: string): Promise<any | null> {
    // Check cache first
    if (this.cache.has(path)) {
      return this.cache.get(path) || null
    }

    try {
      // Import COW classes
      const { CommitObject } = await import('../cow/CommitObject.js')
      const { TreeObject } = await import('../cow/TreeObject.js')
      const { isNullHash } = await import('../cow/constants.js')

      // Read commit
      const commit = await CommitObject.read(this.blobStorage!, this.commitId)
      if (isNullHash(commit.tree)) {
        return null
      }

      // Read tree
      const tree = await TreeObject.read(this.blobStorage!, commit.tree)

      // Walk tree to find matching path
      for await (const entry of TreeObject.walk(this.blobStorage!, tree)) {
        if (entry.type === 'blob' && entry.name === path) {
          // Read blob data
          const blobData = await this.blobStorage!.read(entry.hash)
          const data = JSON.parse(blobData.toString())

          // Cache the result
          this.cache.set(path, data)

          return data
        }
      }

      return null
    } catch (error) {
      // Path doesn't exist in historical state
      return null
    }
  }

  /**
   * List objects under path in historical commit state
   */
  protected async listObjectsUnderPath(prefix: string): Promise<string[]> {
    try {
      // Import COW classes
      const { CommitObject } = await import('../cow/CommitObject.js')
      const { TreeObject } = await import('../cow/TreeObject.js')
      const { isNullHash } = await import('../cow/constants.js')

      // Read commit
      const commit = await CommitObject.read(this.blobStorage!, this.commitId)
      if (isNullHash(commit.tree)) {
        return []
      }

      // Read tree
      const tree = await TreeObject.read(this.blobStorage!, commit.tree)

      // Walk tree to find all paths matching prefix
      const paths: string[] = []
      for await (const entry of TreeObject.walk(this.blobStorage!, tree)) {
        if (entry.name.startsWith(prefix)) {
          paths.push(entry.name)
        }
      }

      return paths
    } catch (error) {
      return []
    }
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  protected async writeObjectToPath(path: string, data: any): Promise<void> {
    throw new Error(
      `Historical storage is read-only. Cannot write to path: ${path}`
    )
  }

  /**
   * DELETE BLOCKED: Historical storage is read-only
   */
  protected async deleteObjectFromPath(path: string): Promise<void> {
    throw new Error(
      `Historical storage is read-only. Cannot delete path: ${path}`
    )
  }

  /**
   * Get storage statistics from historical commit
   */
  protected async getStatisticsData(): Promise<StatisticsData | null> {
    return await this.readObjectFromPath('_system/statistics.json')
  }

  /**
   * WRITE BLOCKED: Cannot save statistics to historical storage
   */
  protected async saveStatisticsData(data: StatisticsData): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot save statistics.')
  }

  /**
   * Clear cache (does not affect historical data)
   */
  public async clear(): Promise<void> {
    this.cache.clear()
  }

  /**
   * Get storage status
   */
  public async getStorageStatus(): Promise<{
    type: string
    used: number
    quota: number | null
    details?: Record<string, any>
  }> {
    return {
      type: 'historical',
      used: this.cache.size,
      quota: this.cacheSize,
      details: {
        commitId: this.commitId,
        branch: this.branch,
        cached: this.cache.size,
        maxCache: this.cacheSize,
        readOnly: true
      }
    }
  }

  /**
   * Check if COW has been explicitly disabled via clear()
   * v5.10.4: No-op for HistoricalStorageAdapter (read-only, doesn't manage COW)
   * @returns Always false (read-only adapter doesn't manage COW state)
   * @protected
   */
  protected async checkClearMarker(): Promise<boolean> {
    return false // Read-only adapter - COW state managed by underlying storage
  }

  /**
   * Create marker indicating COW has been explicitly disabled
   * v5.10.4: No-op for HistoricalStorageAdapter (read-only)
   * @protected
   */
  protected async createClearMarker(): Promise<void> {
    // No-op: HistoricalStorageAdapter is read-only, doesn't create markers
  }

  // ============= Override Write Methods (Read-Only) =============

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async saveNoun(noun: HNSWNoun): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot save noun.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async saveNounMetadata(id: string, metadata: NounMetadata): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot save noun metadata.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async deleteNoun(id: string): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot delete noun.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async deleteNounMetadata(id: string): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot delete noun metadata.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async saveVerb(verb: HNSWVerb): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot save verb.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async saveVerbMetadata(id: string, metadata: VerbMetadata): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot save verb metadata.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async deleteVerb(id: string): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot delete verb.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async deleteVerbMetadata(id: string): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot delete verb metadata.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async saveMetadata(id: string, metadata: any): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot save metadata.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async saveHNSWData(nounId: string, hnswData: {
    level: number
    connections: Record<string, string[]>
  }): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot save HNSW data.')
  }

  /**
   * WRITE BLOCKED: Historical storage is read-only
   */
  public async saveHNSWSystem(systemData: {
    entryPointId: string | null
    maxLevel: number
  }): Promise<void> {
    throw new Error('Historical storage is read-only. Cannot save HNSW system data.')
  }

  // ============= Additional Abstract Methods =============

  /**
   * Get noun vector from historical state
   */
  public async getNounVector(id: string): Promise<number[] | null> {
    const noun = await this.getNoun(id)
    return noun?.vector || null
  }

  /**
   * Get HNSW data from historical state
   */
  public async getHNSWData(nounId: string): Promise<{
    level: number
    connections: Record<string, string[]>
  } | null> {
    const path = `_system/hnsw/nodes/${nounId}.json`
    return await this.readObjectFromPath(path)
  }

  /**
   * Get HNSW system data from historical state
   */
  public async getHNSWSystem(): Promise<{
    entryPointId: string | null
    maxLevel: number
  } | null> {
    return await this.readObjectFromPath('_system/hnsw/system.json')
  }

  /**
   * Initialize counts (no-op for historical storage)
   * Counts are loaded from historical state metadata
   */
  protected async initializeCounts(): Promise<void> {
    // No-op: Historical storage doesn't need to initialize counts
    // They're read from commit state metadata
  }

  /**
   * WRITE BLOCKED: Cannot persist counts to historical storage
   */
  protected async persistCounts(): Promise<void> {
    // No-op: Historical storage is read-only
  }
}
