/**
 * Memory Storage Adapter
 * In-memory storage adapter for environments where persistent storage is not available or needed
 */

import {
  GraphVerb,
  HNSWNoun,
  HNSWVerb,
  NounMetadata,
  VerbMetadata,
  HNSWNounWithMetadata,
  HNSWVerbWithMetadata,
  StatisticsData,
  NounType
} from '../../coreTypes.js'
import { BaseStorage, StorageBatchConfig, STATISTICS_KEY } from '../baseStorage.js'
import { PaginatedResult } from '../../types/paginationTypes.js'

// No type aliases needed - using the original types directly

/**
 * In-memory storage adapter
 * Uses Maps to store data in memory
 */
export class MemoryStorage extends BaseStorage {
  // v5.4.0: Removed redundant Maps (nouns, verbs) - objectStore handles all storage via type-first paths
  private statistics: StatisticsData | null = null

  // Unified object store for primitive operations (replaces metadata, nounMetadata, verbMetadata)
  private objectStore: Map<string, any> = new Map()

  // Backward compatibility aliases
  private get metadata(): Map<string, any> {
    return this.objectStore
  }
  private get nounMetadata(): Map<string, any> {
    return this.objectStore
  }
  private get verbMetadata(): Map<string, any> {
    return this.objectStore
  }

  constructor() {
    super()
  }

  /**
   * Get Memory-optimized batch configuration
   *
   * Memory storage has no rate limits and can handle very high throughput:
   * - Large batch sizes (1000 items)
   * - No delays needed (0ms)
   * - High concurrency (1000 operations)
   * - Parallel processing maximizes throughput
   *
   * @returns Memory-optimized batch configuration
   * @since v4.11.0
   */
  public getBatchConfig(): StorageBatchConfig {
    return {
      maxBatchSize: 1000,
      batchDelayMs: 0,
      maxConcurrent: 1000,
      supportsParallelWrites: true,  // Memory loves parallel operations
      rateLimit: {
        operationsPerSecond: 100000,  // Virtually unlimited
        burstCapacity: 100000
      }
    }
  }

  /**
   * Initialize the storage adapter
   * Nothing to initialize for in-memory storage
   */
  public async init(): Promise<void> {
    this.isInitialized = true
  }

  // v5.4.0: Removed saveNoun_internal and getNoun_internal - using BaseStorage's type-first implementation

  /**
   * Get nouns with pagination and filtering
   * v4.0.0: Returns HNSWNounWithMetadata[] (includes metadata field)
   * @param options Pagination and filtering options
   * @returns Promise that resolves to a paginated result of nouns with metadata
   */
  // v5.4.0: Removed public method overrides (getNouns, getNounsWithPagination, getVerbs) - using BaseStorage's type-first implementation

  // v5.4.0: Removed getNounsByNounType_internal and deleteNoun_internal - using BaseStorage's type-first implementation

  // v5.4.0: Removed saveVerb_internal and getVerb_internal - using BaseStorage's type-first implementation

  // v5.4.0: Removed verb *_internal method overrides - using BaseStorage's type-first implementation

  /**
   * Primitive operation: Write object to path
   * All metadata operations use this internally via base class routing
   */
  protected async writeObjectToPath(path: string, data: any): Promise<void> {
    // Store in unified object store using path as key
    this.objectStore.set(path, JSON.parse(JSON.stringify(data)))
  }

  /**
   * Primitive operation: Read object from path
   * All metadata operations use this internally via base class routing
   */
  protected async readObjectFromPath(path: string): Promise<any | null> {
    const data = this.objectStore.get(path)
    if (!data) {
      return null
    }
    return JSON.parse(JSON.stringify(data))
  }

  /**
   * Primitive operation: Delete object from path
   * All metadata operations use this internally via base class routing
   */
  protected async deleteObjectFromPath(path: string): Promise<void> {
    this.objectStore.delete(path)
  }

  /**
   * Primitive operation: List objects under path prefix
   * All metadata operations use this internally via base class routing
   */
  protected async listObjectsUnderPath(prefix: string): Promise<string[]> {
    const paths: string[] = []
    for (const key of this.objectStore.keys()) {
      if (key.startsWith(prefix)) {
        paths.push(key)
      }
    }
    return paths.sort()
  }

  /**
   * Get multiple metadata objects in batches (CRITICAL: Prevents socket exhaustion)
   * Memory storage implementation is simple since all data is already in memory
   */
  public async getMetadataBatch(ids: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>()

    // Memory storage can handle all IDs at once since it's in-memory
    for (const id of ids) {
      // CRITICAL: Use getNounMetadata() instead of deprecated getMetadata()
      // This ensures we fetch from the correct noun metadata store (2-file system)
      const metadata = await this.getNounMetadata(id)
      if (metadata) {
        results.set(id, metadata)
      }
    }

    return results
  }

  /**
   * Clear all data from storage
   * v5.4.0: Clears objectStore (type-first paths)
   */
  public async clear(): Promise<void> {
    this.objectStore.clear()
    this.statistics = null
    this.totalNounCount = 0
    this.totalVerbCount = 0
    this.entityCounts.clear()
    this.verbCounts.clear()

    // Clear the statistics cache
    this.statisticsCache = null
    this.statisticsModified = false
  }

  /**
   * Get information about storage usage and capacity
   * v5.4.0: Uses BaseStorage counts
   */
  public async getStorageStatus(): Promise<{
    type: string
    used: number
    quota: number | null
    details?: Record<string, any>
  }> {
    return {
      type: 'memory',
      used: 0, // In-memory storage doesn't have a meaningful size
      quota: null, // In-memory storage doesn't have a quota
      details: {
        nodeCount: this.totalNounCount,
        edgeCount: this.totalVerbCount,
        objectStoreSize: this.objectStore.size
      }
    }
  }

  /**
   * Save statistics data to storage
   * @param statistics The statistics data to save
   */
  protected async saveStatisticsData(statistics: StatisticsData): Promise<void> {
    // For memory storage, we just need to store the statistics in memory
    // Create a deep copy to avoid reference issues
    this.statistics = {
      nounCount: {...statistics.nounCount},
      verbCount: {...statistics.verbCount},
      metadataCount: {...statistics.metadataCount},
      hnswIndexSize: statistics.hnswIndexSize,
      lastUpdated: statistics.lastUpdated,
      // Include serviceActivity if present
      ...(statistics.serviceActivity && {
        serviceActivity: Object.fromEntries(
          Object.entries(statistics.serviceActivity).map(([k, v]) => [k, {...v}])
        )
      }),
      // Include services if present
      ...(statistics.services && {
        services: statistics.services.map(s => ({...s}))
      }),
      // Include distributedConfig if present
      ...(statistics.distributedConfig && { 
        distributedConfig: JSON.parse(JSON.stringify(statistics.distributedConfig)) 
      })
    }
    
    // Since this is in-memory, there's no need for time-based partitioning
    // or legacy file handling
  }

  /**
   * Get statistics data from storage
   * @returns Promise that resolves to the statistics data or null if not found
   */
  protected async getStatisticsData(): Promise<StatisticsData | null> {
    if (!this.statistics) {
      // CRITICAL FIX (v3.37.4): Statistics don't exist yet (first init)
      // Return minimal stats with counts instead of null
      // This prevents HNSW from seeing entityCount=0 during index rebuild
      return {
        nounCount: {},
        verbCount: {},
        metadataCount: {},
        hnswIndexSize: 0,
        totalNodes: this.totalNounCount,
        totalEdges: this.totalVerbCount,
        totalMetadata: 0,
        lastUpdated: new Date().toISOString()
      }
    }

    // Return a deep copy to avoid reference issues
    return {
      nounCount: {...this.statistics.nounCount},
      verbCount: {...this.statistics.verbCount},
      metadataCount: {...this.statistics.metadataCount},
      hnswIndexSize: this.statistics.hnswIndexSize,
      // CRITICAL FIX: Populate totalNodes and totalEdges from in-memory counts
      // HNSW rebuild depends on these fields to determine entity count
      totalNodes: this.totalNounCount,
      totalEdges: this.totalVerbCount,
      lastUpdated: this.statistics.lastUpdated,
      // Include serviceActivity if present
      ...(this.statistics.serviceActivity && {
        serviceActivity: Object.fromEntries(
          Object.entries(this.statistics.serviceActivity).map(([k, v]) => [k, {...v}])
        )
      }),
      // Include services if present
      ...(this.statistics.services && {
        services: this.statistics.services.map(s => ({...s}))
      }),
      // Include distributedConfig if present
      ...(this.statistics.distributedConfig && {
        distributedConfig: JSON.parse(JSON.stringify(this.statistics.distributedConfig))
      })
    }

    // Since this is in-memory, there's no need for fallback mechanisms
    // to check multiple storage locations
  }

  /**
   * Initialize counts from in-memory storage - O(1) operation (v4.0.0)
   */
  protected async initializeCounts(): Promise<void> {
    // v5.4.0: Scan objectStore paths (type-first structure) to count entities
    this.entityCounts.clear()
    this.verbCounts.clear()

    let totalNouns = 0
    let totalVerbs = 0

    // Scan all paths in objectStore
    for (const path of this.objectStore.keys()) {
      // Count nouns by type (entities/nouns/{type}/vectors/{shard}/{id}.json)
      const nounMatch = path.match(/^entities\/nouns\/([^/]+)\/vectors\//)
      if (nounMatch) {
        const type = nounMatch[1]
        this.entityCounts.set(type, (this.entityCounts.get(type) || 0) + 1)
        totalNouns++
      }

      // Count verbs by type (entities/verbs/{type}/vectors/{shard}/{id}.json)
      const verbMatch = path.match(/^entities\/verbs\/([^/]+)\/vectors\//)
      if (verbMatch) {
        const type = verbMatch[1]
        this.verbCounts.set(type, (this.verbCounts.get(type) || 0) + 1)
        totalVerbs++
      }
    }

    this.totalNounCount = totalNouns
    this.totalVerbCount = totalVerbs
  }

  /**
   * Persist counts to storage - no-op for memory storage
   */
  protected async persistCounts(): Promise<void> {
    // No persistence needed for in-memory storage
    // Counts are always accurate from the live data structures
  }

  // =============================================
  // HNSW Index Persistence (v3.35.0+)
  // =============================================

  /**
   * Get vector for a noun
   * v5.4.0: Uses BaseStorage's type-first implementation
   */
  public async getNounVector(id: string): Promise<number[] | null> {
    const noun = await this.getNoun(id)
    return noun ? [...noun.vector] : null
  }

  // CRITICAL FIX (v4.10.1): Mutex locks for HNSW concurrency control
  // Even in-memory operations need serialization to prevent async race conditions
  private hnswLocks = new Map<string, Promise<void>>()

  /**
   * Save HNSW graph data for a noun
   *
   * CRITICAL FIX (v4.10.1): Mutex locking to prevent race conditions during concurrent HNSW updates
   * Even in-memory operations can race due to async/await interleaving
   * Prevents data corruption when multiple entities connect to same neighbor simultaneously
   */
  public async saveHNSWData(nounId: string, hnswData: {
    level: number
    connections: Record<string, string[]>
  }): Promise<void> {
    const path = `hnsw/${nounId}.json`

    // MUTEX LOCK: Wait for any pending operations on this entity
    while (this.hnswLocks.has(path)) {
      await this.hnswLocks.get(path)
    }

    // Acquire lock by creating a promise that we'll resolve when done
    let releaseLock!: () => void
    const lockPromise = new Promise<void>(resolve => { releaseLock = resolve })
    this.hnswLocks.set(path, lockPromise)

    try {
      // Read existing data (if exists)
      let existingNode: any = {}
      const existing = this.objectStore.get(path)
      if (existing) {
        existingNode = existing
      }

      // Preserve id and vector, update only HNSW graph metadata
      const updatedNode = {
        ...existingNode,  // Preserve all existing fields
        level: hnswData.level,
        connections: hnswData.connections
      }

      // Write atomically (in-memory, but now serialized by mutex)
      this.objectStore.set(path, JSON.parse(JSON.stringify(updatedNode)))
    } finally {
      // Release lock
      this.hnswLocks.delete(path)
      releaseLock()
    }
  }

  /**
   * Get HNSW graph data for a noun
   */
  public async getHNSWData(nounId: string): Promise<{
    level: number
    connections: Record<string, string[]>
  } | null> {
    const path = `hnsw/${nounId}.json`
    const data = await this.readObjectFromPath(path)
    return data || null
  }

  /**
   * Save HNSW system data (entry point, max level)
   *
   * CRITICAL FIX (v4.10.1): Mutex locking to prevent race conditions
   */
  public async saveHNSWSystem(systemData: {
    entryPointId: string | null
    maxLevel: number
  }): Promise<void> {
    const path = 'system/hnsw-system.json'

    // MUTEX LOCK: Wait for any pending operations
    while (this.hnswLocks.has(path)) {
      await this.hnswLocks.get(path)
    }

    // Acquire lock
    let releaseLock!: () => void
    const lockPromise = new Promise<void>(resolve => { releaseLock = resolve })
    this.hnswLocks.set(path, lockPromise)

    try {
      // Write atomically (serialized by mutex)
      this.objectStore.set(path, JSON.parse(JSON.stringify(systemData)))
    } finally {
      // Release lock
      this.hnswLocks.delete(path)
      releaseLock()
    }
  }

  /**
   * Get HNSW system data
   */
  public async getHNSWSystem(): Promise<{
    entryPointId: string | null
    maxLevel: number
  } | null> {
    const path = 'system/hnsw-system.json'
    const data = await this.readObjectFromPath(path)
    return data || null
  }
}
