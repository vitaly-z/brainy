/**
 * HNSW (Hierarchical Navigable Small World) Index implementation
 * Based on the paper: "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs"
 */

import {
  DistanceFunction,
  HNSWConfig,
  HNSWNoun,
  Vector,
  VectorDocument
} from '../coreTypes.js'
import { euclideanDistance, calculateDistancesBatch } from '../utils/index.js'
import { executeInThread } from '../utils/workerUtils.js'
import type { BaseStorage } from '../storage/baseStorage.js'
import { getGlobalCache, UnifiedCache } from '../utils/unifiedCache.js'
import { prodLog } from '../utils/logger.js'
import { quantizeSQ8, distanceSQ8 } from '../utils/vectorQuantization.js'
import type { SQ8QuantizedVector } from '../utils/vectorQuantization.js'

// Default HNSW parameters
const DEFAULT_CONFIG: HNSWConfig = {
  M: 16, // Max number of connections per noun
  efConstruction: 200, // Size of a dynamic candidate list during construction
  efSearch: 50, // Size of a dynamic candidate list during search
  ml: 16 // Max level
}

export class HNSWIndex {
  private nouns: Map<string, HNSWNoun> = new Map()
  private entryPointId: string | null = null
  private maxLevel = 0
  // Track high-level nodes for O(1) entry point selection
  private highLevelNodes = new Map<number, Set<string>>() // level -> node IDs
  private readonly MAX_TRACKED_LEVELS = 10 // Only track top levels for memory efficiency
  private config: HNSWConfig
  private distanceFunction: DistanceFunction
  private dimension: number | null = null
  private useParallelization: boolean = true // Whether to use parallelization for performance-critical operations
  private storage: BaseStorage | null = null // Storage adapter for HNSW persistence

  // Universal memory management
  private unifiedCache: UnifiedCache // Shared cache with Graph and Metadata indexes
  // Always-adaptive caching - no "mode" concept, system adapts automatically

  // COW (Copy-on-Write) support
  private cowEnabled: boolean = false
  private cowModifiedNodes: Set<string> = new Set()
  private cowParent: HNSWIndex | null = null

  // Deferred HNSW persistence for cloud storage performance
  // In deferred mode, HNSW connections are only persisted on flush/close
  // This reduces GCS operations from 70 to 2-3 per add() (30-50× faster)
  private persistMode: 'immediate' | 'deferred' = 'immediate'
  private dirtyNodes: Set<string> = new Set() // Nodes with unpersisted HNSW data
  private dirtySystem: boolean = false // Whether system data (entryPoint, maxLevel) needs persist

  // SQ8 quantization support (B1 optimization)
  private quantizationEnabled: boolean = false
  private rerankMultiplier: number = 3
  // Lazy vector storage (B2 optimization)
  private vectorStorageMode: 'memory' | 'lazy' = 'memory'

  constructor(
    config: Partial<HNSWConfig> = {},
    distanceFunction: DistanceFunction = euclideanDistance,
    options: { useParallelization?: boolean; storage?: BaseStorage; persistMode?: 'immediate' | 'deferred' } = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.distanceFunction = distanceFunction
    this.useParallelization =
      options.useParallelization !== undefined
        ? options.useParallelization
        : true
    this.storage = options.storage || null
    this.persistMode = options.persistMode || 'immediate'

    // SQ8 quantization config (default: disabled, preserves current behavior)
    if (config.quantization?.enabled) {
      this.quantizationEnabled = true
      this.rerankMultiplier = config.quantization.rerankMultiplier ?? 3
    }

    // Vector storage mode (default: 'memory', preserves current behavior)
    this.vectorStorageMode = config.vectorStorage || 'memory'

    // Use SAME UnifiedCache as Graph and Metadata for fair memory competition
    this.unifiedCache = getGlobalCache()
  }

  /**
   * Set whether to use parallelization for performance-critical operations
   */
  public setUseParallelization(useParallelization: boolean): void {
    this.useParallelization = useParallelization
  }

  /**
   * Get whether parallelization is enabled
   */
  public getUseParallelization(): boolean {
    return this.useParallelization
  }

  /**
   * Flush dirty HNSW data to storage
   *
   * In deferred persistence mode, HNSW connections are tracked as dirty but not
   * immediately persisted. Call flush() to persist all pending changes.
   *
   * This is automatically called by:
   * - brain.close()
   * - brain.flush()
   * - Process shutdown (SIGTERM/SIGINT)
   *
   * @returns Number of nodes flushed
   */
  public async flush(): Promise<number> {
    if (!this.storage) {
      return 0
    }

    if (this.dirtyNodes.size === 0 && !this.dirtySystem) {
      return 0
    }

    const startTime = Date.now()
    const nodeCount = this.dirtyNodes.size

    // Batch persist all dirty nodes concurrently
    if (this.dirtyNodes.size > 0) {
      const batchSize = 50 // Reasonable batch size for cloud storage
      const nodeIds = Array.from(this.dirtyNodes)

      for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batch = nodeIds.slice(i, i + batchSize)
        const promises = batch.map(nodeId => {
          const noun = this.nouns.get(nodeId)
          if (!noun) return Promise.resolve() // Node was deleted

          const connectionsObj: Record<string, string[]> = {}
          for (const [level, nounIds] of noun.connections.entries()) {
            connectionsObj[level.toString()] = Array.from(nounIds)
          }

          return this.storage!.saveHNSWData(nodeId, {
            level: noun.level,
            connections: connectionsObj
          }).catch(error => {
            console.error(`[HNSW flush] Failed to persist node ${nodeId}:`, error)
          })
        })

        await Promise.allSettled(promises)
      }

      this.dirtyNodes.clear()
    }

    // Persist system data if dirty
    if (this.dirtySystem) {
      await this.storage.saveHNSWSystem({
        entryPointId: this.entryPointId,
        maxLevel: this.maxLevel
      }).catch(error => {
        console.error('[HNSW flush] Failed to persist system data:', error)
      })

      this.dirtySystem = false
    }

    const duration = Date.now() - startTime
    if (nodeCount > 0) {
      prodLog.info(`[HNSW] Flushed ${nodeCount} dirty nodes in ${duration}ms`)
    }

    return nodeCount
  }

  /**
   * Get the number of dirty (unpersisted) nodes
   * Useful for monitoring and debugging
   */
  public getDirtyNodeCount(): number {
    return this.dirtyNodes.size
  }

  /**
   * Get the current persist mode
   */
  public getPersistMode(): 'immediate' | 'deferred' {
    return this.persistMode
  }

  /**
   * Enable COW (Copy-on-Write) mode - Instant fork via shallow copy
   *
   * Snowflake-style instant fork: O(1) shallow copy of Maps, lazy deep copy on write.
   *
   * @param parent - Parent HNSW index to copy from
   *
   * Performance:
   * - Fork time: <10ms for 1M+ nodes (just copies Map references)
   * - Memory: Shared reads, only modified nodes duplicated (~10-20% overhead)
   * - Reads: Same speed as parent (shared data structures)
   *
   * @example
   * ```typescript
   * const parent = new HNSWIndex(config)
   * // ... parent has 1M nodes ...
   *
   * const fork = new HNSWIndex(config)
   * fork.enableCOW(parent) // <10ms - instant!
   *
   * // Reads share data
   * await fork.search(query) // Fast, uses parent's data
   *
   * // Writes trigger COW
   * await fork.addItem(newItem) // Deep copies only modified nodes
   * ```
   */
  public enableCOW(parent: HNSWIndex): void {
    this.cowEnabled = true
    this.cowParent = parent

    // Shallow copy Maps - O(1) per Map, just copies references
    // All nodes/connections are shared until first write
    this.nouns = new Map(parent.nouns)
    this.highLevelNodes = new Map()
    for (const [level, nodeSet] of parent.highLevelNodes.entries()) {
      this.highLevelNodes.set(level, new Set(nodeSet))
    }

    // Copy scalar values
    this.entryPointId = parent.entryPointId
    this.maxLevel = parent.maxLevel
    this.dimension = parent.dimension

    // Share cache (COW at cache level)
    this.unifiedCache = parent.unifiedCache

    // Share config and distance function
    this.config = parent.config
    this.distanceFunction = parent.distanceFunction
    this.useParallelization = parent.useParallelization

    prodLog.info(`HNSW COW enabled: ${parent.nouns.size} nodes shallow copied`)
  }

  /**
   * Ensure node is copied before modification (lazy COW)
   *
   * Deep copies a node only when first modified. Subsequent modifications
   * use the already-copied node.
   *
   * @param nodeId - Node ID to ensure is copied
   * @private
   */
  private ensureCOW(nodeId: string): void {
    if (!this.cowEnabled) return
    if (this.cowModifiedNodes.has(nodeId)) return // Already copied

    const original = this.nouns.get(nodeId)
    if (!original) return

    // Deep copy connections Map (separate Map + Sets for each level)
    const connectionsCopy = new Map<number, Set<string>>()
    for (const [level, ids] of original.connections.entries()) {
      connectionsCopy.set(level, new Set(ids))
    }

    // Deep copy node
    const nodeCopy: HNSWNoun = {
      id: original.id,
      vector: [...original.vector], // Deep copy vector array
      connections: connectionsCopy,
      level: original.level,
      // Copy SQ8 quantized data if present
      quantizedVector: original.quantizedVector ? new Uint8Array(original.quantizedVector) : undefined,
      codebookMin: original.codebookMin,
      codebookMax: original.codebookMax
    }

    this.nouns.set(nodeId, nodeCopy)
    this.cowModifiedNodes.add(nodeId)
  }

  /**
   * Calculate distances between a query vector and multiple vectors in parallel
   * This is used to optimize performance for search operations
   * Uses optimized batch processing for optimal performance
   *
   * @param queryVector The query vector
   * @param vectors Array of vectors to compare against
   * @returns Array of distances
   */
  private async calculateDistancesInParallel(
    queryVector: Vector,
    vectors: Array<{ id: string; vector: Vector }>
  ): Promise<Array<{ id: string; distance: number }>> {
    // If parallelization is disabled or there are very few vectors, use sequential processing
    if (!this.useParallelization || vectors.length < 10) {
      return vectors.map((item) => ({
        id: item.id,
        distance: this.distanceFunction(queryVector, item.vector)
      }))
    }

    try {
      // Extract just the vectors from the input array
      const vectorsOnly = vectors.map((item) => item.vector)

      // Use optimized batch distance calculation
      const distances = await calculateDistancesBatch(
        queryVector,
        vectorsOnly,
        this.distanceFunction
      )

      // Map the distances back to their IDs
      return vectors.map((item, index) => ({
        id: item.id,
        distance: distances[index]
      }))
    } catch (error) {
      console.error(
        'Error in batch distance calculation, falling back to sequential processing:',
        error
      )

      // Fall back to sequential processing if batch calculation fails
      return vectors.map((item) => ({
        id: item.id,
        distance: this.distanceFunction(queryVector, item.vector)
      }))
    }
  }

  /**
   * Add a vector to the index
   */
  public async addItem(item: VectorDocument): Promise<string> {
    // Check if item is defined
    if (!item) {
      throw new Error('Item is undefined or null')
    }

    const { id, vector } = item

    // Check if vector is defined
    if (!vector) {
      throw new Error('Vector is undefined or null')
    }

    // Set dimension on first insert
    if (this.dimension === null) {
      this.dimension = vector.length
    } else if (vector.length !== this.dimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`
      )
    }

    // Generate random level for this noun
    const nounLevel = this.getRandomLevel()

    // Create new noun with optional SQ8 quantization
    const noun: HNSWNoun = {
      id,
      vector,
      connections: new Map(),
      level: nounLevel
    }

    // Quantize vector if enabled (B1: 4x storage reduction)
    if (this.quantizationEnabled) {
      const sq8 = quantizeSQ8(vector)
      noun.quantizedVector = sq8.quantized
      noun.codebookMin = sq8.min
      noun.codebookMax = sq8.max
    }

    // Initialize empty connection sets for each level
    for (let level = 0; level <= nounLevel; level++) {
      noun.connections.set(level, new Set<string>())
    }

    // If this is the first noun, make it the entry point
    if (this.nouns.size === 0) {
      this.entryPointId = id
      this.maxLevel = nounLevel
      this.nouns.set(id, noun)

      // Persist system data for first noun (previously skipped)
      if (this.storage && this.persistMode === 'immediate') {
        await this.storage.saveHNSWSystem({
          entryPointId: this.entryPointId,
          maxLevel: this.maxLevel
        }).catch(error => {
          console.error('Failed to persist initial HNSW system data:', error)
        })
      } else if (this.persistMode === 'deferred') {
        this.dirtySystem = true
      }

      return id
    }

    // Find entry point
    if (!this.entryPointId) {
      // No entry point but nouns exist - corrupted state, recover by using this item
      // This shouldn't normally happen as first item sets entry point above
      this.entryPointId = id
      this.maxLevel = nounLevel
      this.nouns.set(id, noun)
      return id
    }

    const entryPoint = this.nouns.get(this.entryPointId)
    if (!entryPoint) {
      // Entry point was deleted but ID not updated - recover by using new item
      // If the entry point doesn't exist, treat this as the first noun
      this.entryPointId = id
      this.maxLevel = nounLevel
      this.nouns.set(id, noun)
      return id
    }

    let currObj = entryPoint

    // Calculate distance to entry point (handles lazy loading + sync fast path)
    let currDist = await Promise.resolve(this.distanceSafe(vector, entryPoint))

    // Traverse the graph from top to bottom to find the closest noun
    for (let level = this.maxLevel; level > nounLevel; level--) {
      let changed = true
      while (changed) {
        changed = false

        // Check all neighbors at current level
        const connections = currObj.connections.get(level) || new Set<string>()

        // OPTIMIZATION: Preload neighbor vectors for parallel loading
        if (connections.size > 0) {
          await this.preloadVectors(Array.from(connections))
        }

        for (const neighborId of connections) {
          const neighbor = this.nouns.get(neighborId)
          if (!neighbor) {
            // Skip neighbors that don't exist (expected during rapid additions/deletions)
            continue
          }
          const distToNeighbor = await Promise.resolve(this.distanceSafe(vector, neighbor))

          if (distToNeighbor < currDist) {
            currDist = distToNeighbor
            currObj = neighbor
            changed = true
          }
        }
      }
    }

    // For each level from nounLevel down to 0
    for (let level = Math.min(nounLevel, this.maxLevel); level >= 0; level--) {
      // Find ef nearest elements using greedy search
      const nearestNouns = await this.searchLayer(
        vector,
        currObj,
        this.config.efConstruction,
        level
      )

      // Select M nearest neighbors
      const neighbors = this.selectNeighbors(
        vector,
        nearestNouns,
        this.config.M
      )

      // Add bidirectional connections
      // PERFORMANCE OPTIMIZATION: Collect all neighbor updates for concurrent execution
      const neighborUpdates: Array<{
        neighborId: string
        promise: Promise<void>
      }> = []

      for (const [neighborId, _] of neighbors) {
        const neighbor = this.nouns.get(neighborId)
        if (!neighbor) {
          // Skip neighbors that don't exist (expected during rapid additions/deletions)
          continue
        }

        // COW: Ensure neighbor is copied before modification
        this.ensureCOW(neighborId)

        noun.connections.get(level)!.add(neighborId)

        // Add reverse connection
        if (!neighbor.connections.has(level)) {
          neighbor.connections.set(level, new Set<string>())
        }
        neighbor.connections.get(level)!.add(id)

        // Ensure neighbor doesn't have too many connections
        if (neighbor.connections.get(level)!.size > this.config.M) {
          await this.pruneConnections(neighbor, level)
        }

        // Persist updated neighbor HNSW data
        //
        // Deferred persistence mode for cloud storage performance
        // In deferred mode, we track dirty nodes instead of persisting immediately
        // This reduces GCS operations from 70 to 2-3 per add() (30-50× faster)
        if (this.storage && this.persistMode === 'immediate') {
          // IMMEDIATE MODE: Original behavior - persist each neighbor update
          const neighborConnectionsObj: Record<string, string[]> = {}
          for (const [lvl, nounIds] of neighbor.connections.entries()) {
            neighborConnectionsObj[lvl.toString()] = Array.from(nounIds)
          }

          neighborUpdates.push({
            neighborId,
            promise: this.storage.saveHNSWData(neighborId, {
              level: neighbor.level,
              connections: neighborConnectionsObj
            })
          })
        } else if (this.persistMode === 'deferred') {
          // DEFERRED MODE: Track dirty nodes for later batch persistence
          this.dirtyNodes.add(neighborId)
        }
      }

      // Execute all neighbor updates concurrently (only in immediate mode)
      if (neighborUpdates.length > 0 && this.persistMode === 'immediate') {
        const batchSize = this.config.maxConcurrentNeighborWrites || neighborUpdates.length
        const allFailures: Array<{ result: PromiseRejectedResult; neighborId: string }> = []

        // Process in chunks if batch size specified
        for (let i = 0; i < neighborUpdates.length; i += batchSize) {
          const batch = neighborUpdates.slice(i, i + batchSize)
          const results = await Promise.allSettled(batch.map(u => u.promise))

          // Track failures for monitoring (storage adapters already retried 5× each)
          const batchFailures = results
            .map((result, idx) => ({ result, neighborId: batch[idx].neighborId }))
            .filter(({ result }) => result.status === 'rejected')
            .map(({ result, neighborId }) => ({
              result: result as PromiseRejectedResult,
              neighborId
            }))

          allFailures.push(...batchFailures)
        }

        if (allFailures.length > 0) {
          console.warn(
            `[HNSW] ${allFailures.length}/${neighborUpdates.length} neighbor updates failed after retries (entity: ${id}, level: ${level})`
          )
          // Log first failure for debugging
          console.error(
            `[HNSW] First failure (neighbor: ${allFailures[0].neighborId}):`,
            allFailures[0].result.reason
          )
        }
      }

      // Update entry point for the next level
      if (nearestNouns.size > 0) {
        const [nearestId, nearestDist] = [...nearestNouns][0]
        if (nearestDist < currDist) {
          currDist = nearestDist
          const nearestNoun = this.nouns.get(nearestId)
          if (!nearestNoun) {
            console.error(
              `Nearest noun with ID ${nearestId} not found in addItem`
            )
            // Keep the current object as is
          } else {
            currObj = nearestNoun
          }
        }
      }
    }

    // Update max level and entry point if needed
    if (nounLevel > this.maxLevel) {
      this.maxLevel = nounLevel
      this.entryPointId = id
    }

    // Add noun to the index
    this.nouns.set(id, noun)

    // Track high-level nodes for O(1) entry point selection
    if (nounLevel >= 2 && nounLevel <= this.MAX_TRACKED_LEVELS) {
      if (!this.highLevelNodes.has(nounLevel)) {
        this.highLevelNodes.set(nounLevel, new Set())
      }
      this.highLevelNodes.get(nounLevel)!.add(id)
    }

    // Lazy vector eviction (B2: graph-only memory after insert)
    // After graph construction completes, evict the full vector from memory.
    // Future searches will load vectors on-demand via getVectorSafe() + UnifiedCache.
    if (this.vectorStorageMode === 'lazy' && this.storage) {
      noun.vector = [] // Release float32 vector from memory
    }

    // Persist HNSW graph data to storage
    // Respect persistMode setting
    if (this.storage && this.persistMode === 'immediate') {
      // IMMEDIATE MODE: Original behavior - persist new entity and system data
      const connectionsObj: Record<string, string[]> = {}
      for (const [level, nounIds] of noun.connections.entries()) {
        connectionsObj[level.toString()] = Array.from(nounIds)
      }

      await this.storage.saveHNSWData(id, {
        level: nounLevel,
        connections: connectionsObj
      }).catch((error) => {
        console.error(`Failed to persist HNSW data for ${id}:`, error)
      })

      // Persist system data (entry point and max level)
      await this.storage.saveHNSWSystem({
        entryPointId: this.entryPointId,
        maxLevel: this.maxLevel
      }).catch((error) => {
        console.error('Failed to persist HNSW system data:', error)
      })
    } else if (this.persistMode === 'deferred') {
      // DEFERRED MODE: Track dirty nodes for later batch persistence
      this.dirtyNodes.add(id)
      this.dirtySystem = true
    }

    return id
  }

  /**
   * O(1) entry point recovery using highLevelNodes index.
   * At any reasonable scale (1000+ nodes), level 2+ nodes are guaranteed to exist.
   * For tiny indexes with only level 0-1 nodes, any node works as entry point.
   */
  private recoverEntryPointO1(): { id: string | null; level: number } {
    // O(1) recovery: check highLevelNodes from highest to lowest level
    for (let level = this.MAX_TRACKED_LEVELS; level >= 2; level--) {
      const nodesAtLevel = this.highLevelNodes.get(level)
      if (nodesAtLevel && nodesAtLevel.size > 0) {
        for (const nodeId of nodesAtLevel) {
          if (this.nouns.has(nodeId)) {
            return { id: nodeId, level }
          }
        }
      }
    }

    // No high-level nodes - use any available node (works fine for HNSW)
    const firstNode = this.nouns.keys().next().value
    return { id: firstNode ?? null, level: 0 }
  }

  /**
   * Search for nearest neighbors
   *
   * When SQ8 quantization is enabled and reranking is active:
   * - Phase 1: Over-retrieve k*rerankMultiplier candidates using SQ8 approximate distances
   * - Phase 2: Load full float32 vectors for candidates, compute exact distances, return top k
   *
   * @param queryVector Query vector
   * @param k Number of results to return
   * @param filter Optional filter function
   * @param options Additional search options
   */
  public async search(
    queryVector: Vector,
    k: number = 10,
    filter?: (id: string) => Promise<boolean>,
    options?: { rerank?: { multiplier: number }; candidateIds?: string[] }
  ): Promise<Array<[string, number]>> {
    if (this.nouns.size === 0) {
      return []
    }

    // Metadata-first: convert candidateIds to filter function if no explicit filter
    if (!filter && options?.candidateIds && options.candidateIds.length > 0) {
      const candidateSet = new Set(options.candidateIds)
      filter = async (id: string) => candidateSet.has(id)
    }

    // Check if query vector is defined
    if (!queryVector) {
      throw new Error('Query vector is undefined or null')
    }

    if (this.dimension !== null && queryVector.length !== this.dimension) {
      throw new Error(
        `Query vector dimension mismatch: expected ${this.dimension}, got ${queryVector.length}`
      )
    }

    // Start from the entry point
    // If entry point is null but nouns exist, attempt O(1) recovery
    if (!this.entryPointId && this.nouns.size > 0) {
      const { id: recoveredId, level: recoveredLevel } = this.recoverEntryPointO1()
      if (recoveredId) {
        this.entryPointId = recoveredId
        this.maxLevel = recoveredLevel
      }
    }

    if (!this.entryPointId) {
      // Truly empty index - return empty results silently
      return []
    }

    let entryPoint = this.nouns.get(this.entryPointId)
    if (!entryPoint) {
      // Entry point ID exists but noun was deleted - O(1) recovery
      if (this.nouns.size > 0) {
        const { id: recoveredId, level: recoveredLevel } = this.recoverEntryPointO1()
        if (recoveredId) {
          this.entryPointId = recoveredId
          this.maxLevel = recoveredLevel
          entryPoint = this.nouns.get(recoveredId)
        }
      }

      // If still no entry point, return empty
      if (!entryPoint) {
        return []
      }
    }

    let currObj = entryPoint

    // SQ8: Pre-quantize query vector for fast approximate distances during traversal
    if (this.quantizationEnabled) {
      this._querySQ8 = quantizeSQ8(queryVector)
    }

    // OPTIMIZATION: Preload entry point vector
    await this.preloadVectors([entryPoint.id])

    let currDist = await Promise.resolve(this.distanceSafe(queryVector, currObj))

    // Traverse the graph from top to bottom to find the closest noun
    for (let level = this.maxLevel; level > 0; level--) {
      let changed = true
      while (changed) {
        changed = false

        // Check all neighbors at current level
        const connections = currObj.connections.get(level) || new Set<string>()

        // OPTIMIZATION: Preload all neighbor vectors in parallel before distance calculations
        if (connections.size > 0) {
          await this.preloadVectors(Array.from(connections))
        }

        // If we have enough connections, use parallel distance calculation
        if (this.useParallelization && connections.size >= 10) {
          // Prepare vectors for parallel calculation
          const vectors: Array<{ id: string; vector: Vector }> = []
          for (const neighborId of connections) {
            const neighbor = this.nouns.get(neighborId)
            if (!neighbor) continue
            const neighborVector = await this.getVectorSafe(neighbor)
            vectors.push({ id: neighborId, vector: neighborVector })
          }

          // Calculate distances in parallel
          const distances = await this.calculateDistancesInParallel(
            queryVector,
            vectors
          )

          // Find the closest neighbor
          for (const { id, distance } of distances) {
            if (distance < currDist) {
              currDist = distance
              const neighbor = this.nouns.get(id)
              if (neighbor) {
                currObj = neighbor
                changed = true
              }
            }
          }
        } else {
          // Use sequential processing for small number of connections
          for (const neighborId of connections) {
            const neighbor = this.nouns.get(neighborId)
            if (!neighbor) {
              // Skip neighbors that don't exist (expected during rapid additions/deletions)
              continue
            }
            const distToNeighbor = await Promise.resolve(this.distanceSafe(queryVector, neighbor))

            if (distToNeighbor < currDist) {
              currDist = distToNeighbor
              currObj = neighbor
              changed = true
            }
          }
        }
      }
    }

    // Determine effective rerank multiplier
    const rerankActive = this.quantizationEnabled && (options?.rerank || this.rerankMultiplier > 1)
    const multiplier = options?.rerank?.multiplier ?? this.rerankMultiplier
    const effectiveK = rerankActive ? k * multiplier : k

    // Search at level 0 with ef = effectiveK
    // If we have a filter, increase ef to compensate for filtered results
    const ef = filter ? Math.max(this.config.efSearch * 3, effectiveK * 3) : Math.max(this.config.efSearch, effectiveK)
    const nearestNouns = await this.searchLayer(
      queryVector,
      currObj,
      ef,
      0,
      filter
    )

    // Phase 2: Rerank with exact float32 distances if quantization is active (B3)
    if (rerankActive && nearestNouns.size > 0) {
      // Clear SQ8 cache before reranking (we need exact distances now)
      this._querySQ8 = null

      const candidates = [...nearestNouns].slice(0, effectiveK)

      // Load full float32 vectors for the candidate set
      const candidateIds = candidates.map(([id]) => id)
      await this.preloadVectors(candidateIds)

      // Recompute exact distances
      const reranked: Array<[string, number]> = []
      for (const [id] of candidates) {
        const noun = this.nouns.get(id)
        if (!noun) continue
        const exactVector = await this.getVectorSafe(noun)
        const exactDist = this.distanceFunction(queryVector, exactVector)
        reranked.push([id, exactDist])
      }

      // Sort by exact distance and return top k
      reranked.sort((a, b) => a[1] - b[1])
      return reranked.slice(0, k)
    }

    // Clear SQ8 cache
    this._querySQ8 = null

    // Convert to array and sort by distance
    return [...nearestNouns].slice(0, k)
  }

  /**
   * Remove an item from the index
   */
  public async removeItem(id: string): Promise<boolean> {
    if (!this.nouns.has(id)) {
      return false
    }

    // COW: Ensure node is copied before modification
    this.ensureCOW(id)

    const noun = this.nouns.get(id)!

    // Remove connections to this noun from all neighbors
    for (const [level, connections] of noun.connections.entries()) {
      for (const neighborId of connections) {
        // COW: Ensure neighbor is copied before modification
        this.ensureCOW(neighborId)

        const neighbor = this.nouns.get(neighborId)
        if (!neighbor) {
          // Skip neighbors that don't exist (expected during rapid additions/deletions)
          continue
        }
        if (neighbor.connections.has(level)) {
          neighbor.connections.get(level)!.delete(id)

          // Prune connections after removing this noun to ensure consistency
          await this.pruneConnections(neighbor, level)
        }
      }
    }

    // Also check all other nouns for references to this noun and remove them
    for (const [nounId, otherNoun] of this.nouns.entries()) {
      if (nounId === id) continue // Skip the noun being removed

      // COW: Ensure noun is copied before modification
      this.ensureCOW(nounId)

      for (const [level, connections] of otherNoun.connections.entries()) {
        if (connections.has(id)) {
          connections.delete(id)

          // Prune connections after removing this reference
          await this.pruneConnections(otherNoun, level)
        }
      }
    }

    // Remove the noun
    this.nouns.delete(id)

    // If we removed the entry point, find a new one
    if (this.entryPointId === id) {
      if (this.nouns.size === 0) {
        this.entryPointId = null
        this.maxLevel = 0
      } else {
        // Find the noun with the highest level
        let maxLevel = 0
        let newEntryPointId = null

        for (const [nounId, noun] of this.nouns.entries()) {
          if (noun.connections.size === 0) continue // Skip nouns with no connections

          const nounLevel = Math.max(...noun.connections.keys())
          if (nounLevel >= maxLevel) {
            maxLevel = nounLevel
            newEntryPointId = nounId
          }
        }

        this.entryPointId = newEntryPointId
        this.maxLevel = maxLevel
      }
    }

    return true
  }

  /**
   * Get all nouns in the index
   * @deprecated Use getNounsPaginated() instead for better scalability
   */
  public getNouns(): Map<string, HNSWNoun> {
    return new Map(this.nouns)
  }

  /**
   * Get nouns with pagination
   * @param options Pagination options
   * @returns Object containing paginated nouns and pagination info
   */
  public getNounsPaginated(
    options: {
      offset?: number
      limit?: number
      filter?: (noun: HNSWNoun) => boolean
    } = {}
  ): {
    items: Map<string, HNSWNoun>
    totalCount: number
    hasMore: boolean
  } {
    const offset = options.offset || 0
    const limit = options.limit || 100
    const filter = options.filter || (() => true)

    // Get all noun entries
    const entries = [...this.nouns.entries()]

    // Apply filter if provided
    const filteredEntries = entries.filter(([_, noun]) => filter(noun))

    // Get total count after filtering
    const totalCount = filteredEntries.length

    // Apply pagination
    const paginatedEntries = filteredEntries.slice(offset, offset + limit)

    // Check if there are more items
    const hasMore = offset + limit < totalCount

    // Create a new map with the paginated entries
    const items = new Map(paginatedEntries)

    return {
      items,
      totalCount,
      hasMore
    }
  }

  /**
   * Clear the index
   */
  public clear(): void {
    this.nouns.clear()
    this.entryPointId = null
    this.maxLevel = 0
  }

  /**
   * Get the size of the index
   */
  public size(): number {
    return this.nouns.size
  }

  /**
   * Get the distance function used by the index
   */
  public getDistanceFunction(): DistanceFunction {
    return this.distanceFunction
  }

  /**
   * Get the entry point ID
   */
  public getEntryPointId(): string | null {
    return this.entryPointId
  }

  /**
   * Get the maximum level
   */
  public getMaxLevel(): number {
    return this.maxLevel
  }

  /**
   * Get the dimension
   */
  public getDimension(): number | null {
    return this.dimension
  }

  /**
   * Get the configuration
   */
  public getConfig(): HNSWConfig {
    return { ...this.config }
  }

  /**
   * Get vector safely (always uses adaptive caching via UnifiedCache)
   *
   * Production-grade adaptive caching:
   * - Vector already loaded: Returns immediately (O(1))
   * - Vector in cache: Loads from UnifiedCache (O(1) hash lookup)
   * - Vector on disk: Loads from storage → UnifiedCache (O(disk))
   * - Cost-aware caching: UnifiedCache manages memory competition
   *
   * @param noun The HNSW noun (may have empty vector if not yet loaded)
   * @returns Promise<Vector> The vector (loaded on-demand if needed)
   */
  private async getVectorSafe(noun: HNSWNoun): Promise<Vector> {
    // Vector already in memory
    if (noun.vector.length > 0) {
      return noun.vector
    }

    // Load from UnifiedCache with storage fallback
    const cacheKey = `hnsw:vector:${noun.id}`

    const vector = await this.unifiedCache.get(cacheKey, async () => {
      // Cache miss - load from storage
      if (!this.storage) {
        throw new Error('Storage not available for vector loading')
      }

      const loaded = await this.storage.getNounVector(noun.id)
      if (!loaded) {
        throw new Error(`Vector not found for noun ${noun.id}`)
      }

      // Add to UnifiedCache with cost-aware eviction
      // This competes fairly with Graph and Metadata indexes
      this.unifiedCache.set(
        cacheKey,
        loaded,
        'hnsw',              // Type for fairness monitoring
        loaded.length * 4,   // Size in bytes (float32)
        50                   // Rebuild cost in ms (moderate priority)
      )

      return loaded
    })

    return vector
  }

  /**
   * Get vector synchronously if available in memory
   *
   * Sync fast path optimization:
   * - Vector in memory: Returns immediately (zero overhead)
   * - Vector in cache: Returns from UnifiedCache synchronously
   * - Returns null if vector not available (caller must handle async path)
   *
   * Use for sync fast path in distance calculations - eliminates async overhead
   * when vectors are already cached.
   *
   * @param noun The HNSW noun
   * @returns Vector | null - vector if in memory/cache, null if needs async load
   */
  private getVectorSync(noun: HNSWNoun): Vector | null {
    // Vector already in memory
    if (noun.vector.length > 0) {
      return noun.vector
    }

    // Try sync cache lookup
    const cacheKey = `hnsw:vector:${noun.id}`
    const vector = this.unifiedCache.getSync(cacheKey)

    return vector || null
  }

  /**
   * Preload multiple vectors in parallel via UnifiedCache
   *
   * Optimization for search operations:
   * - Loads all candidate vectors before distance calculations
   * - Reduces serial disk I/O (parallel loads are faster)
   * - Uses UnifiedCache's request coalescing to prevent stampede
   * - Always active (no "mode" check) for optimal performance
   *
   * @param nodeIds Array of node IDs to preload
   */
  private async preloadVectors(nodeIds: string[]): Promise<void> {
    if (nodeIds.length === 0) return

    // Use UnifiedCache's request coalescing to prevent duplicate loads
    const promises = nodeIds.map(async (id) => {
      const cacheKey = `hnsw:vector:${id}`
      return this.unifiedCache.get(cacheKey, async () => {
        if (!this.storage) return null

        const vector = await this.storage.getNounVector(id)
        if (vector) {
          this.unifiedCache.set(cacheKey, vector, 'hnsw', vector.length * 4, 50)
        }
        return vector
      })
    })

    await Promise.all(promises)
  }

  /**
   * Calculate distance with sync fast path
   *
   * Eliminates async overhead when vectors are in memory:
   * - Sync path: Vector in memory → returns number (zero overhead)
   * - Async path: Vector needs loading → returns Promise<number>
   *
   * Callers must handle union type: `const dist = await Promise.resolve(distance)`
   *
   * @param queryVector The query vector
   * @param noun The target noun (may have empty vector in lazy mode)
   * @returns number | Promise<number> - sync when cached, async when needs load
   */
  private distanceSafe(queryVector: Vector, noun: HNSWNoun): number | Promise<number> {
    // SQ8 fast path: use quantized distance when available (B1 optimization)
    // This avoids loading full float32 vectors during graph traversal
    if (this.quantizationEnabled &&
        noun.quantizedVector &&
        noun.codebookMin !== undefined &&
        noun.codebookMax !== undefined &&
        this._querySQ8) {
      return distanceSQ8(
        this._querySQ8.quantized, this._querySQ8.min, this._querySQ8.max,
        noun.quantizedVector, noun.codebookMin, noun.codebookMax
      )
    }

    // Try sync fast path
    const nounVector = this.getVectorSync(noun)

    if (nounVector !== null) {
      // SYNC PATH: Vector in memory - zero async overhead
      return this.distanceFunction(queryVector, nounVector)
    }

    // ASYNC PATH: Vector needs loading from storage
    return this.getVectorSafe(noun).then(loadedVector =>
      this.distanceFunction(queryVector, loadedVector)
    )
  }

  // Cached SQ8 quantization of the current query vector for distanceSafe fast path
  private _querySQ8: SQ8QuantizedVector | null = null

  /**
   * Get all nodes at a specific level for clustering
   * This enables O(n) clustering using HNSW's natural hierarchy
   */
  public getNodesAtLevel(level: number): HNSWNoun[] {
    const nodesAtLevel: HNSWNoun[] = []
    
    for (const noun of this.nouns.values()) {
      // A noun exists at level L if it has connections at that level or higher
      if (noun.level >= level) {
        nodesAtLevel.push(noun)
      }
    }
    
    return nodesAtLevel
  }

  /**
   * Rebuild HNSW index from persisted graph data
   *
   * This is a production-grade O(N) rebuild that restores the pre-computed graph structure
   * from storage. Much faster than re-building which is O(N log N).
   *
   * Designed for millions of entities with:
   * - Cursor-based pagination (no memory overflow)
   * - Batch processing (configurable batch size)
   * - Progress reporting (optional callback)
   * - Error recovery (continues on partial failures)
   * - Lazy mode support (memory-efficient for constrained environments)
   *
   * @param options Rebuild options
   * @returns Promise that resolves when rebuild is complete
   */
  public async rebuild(options: {
    lazy?: boolean  // DEPRECATED: Auto-detected based on memory. Override only for testing.
    batchSize?: number  // Entities per batch (default 1000, tune for your environment)
    onProgress?: (loaded: number, total: number) => void  // Progress callback
  } = {}): Promise<void> {
    if (!this.storage) {
      prodLog.warn('HNSW rebuild skipped: no storage adapter configured')
      return
    }

    const batchSize = options.batchSize || 1000

    try {
      // Step 1: Clear existing in-memory index
      this.clear()

      // Step 2: Load system data (entry point, max level)
      const systemData = await (this.storage as any).getHNSWSystem()
      if (systemData) {
        this.entryPointId = systemData.entryPointId
        this.maxLevel = systemData.maxLevel
      }

      // Step 3: Determine preloading strategy (adaptive caching)
      // Check if vectors should be preloaded at init or loaded on-demand
      const stats = await this.storage.getStatistics()
      const entityCount = stats?.totalNodes || 0

      // Estimate memory needed for all vectors (384 dims × 4 bytes = 1536 bytes/vector)
      const vectorMemory = entityCount * 1536

      // Get available cache size (80% threshold - preload only if fits comfortably)
      const cacheStats = this.unifiedCache.getStats()
      const availableCache = cacheStats.maxSize * 0.80

      const shouldPreload = vectorMemory < availableCache

      if (shouldPreload) {
        prodLog.info(
          `HNSW: Preloading ${entityCount.toLocaleString()} vectors at init ` +
          `(${(vectorMemory / 1024 / 1024).toFixed(1)}MB < ${(availableCache / 1024 / 1024).toFixed(1)}MB cache)`
        )
      } else {
        prodLog.info(
          `HNSW: Adaptive caching for ${entityCount.toLocaleString()} vectors ` +
          `(${(vectorMemory / 1024 / 1024).toFixed(1)}MB > ${(availableCache / 1024 / 1024).toFixed(1)}MB cache) - loading on-demand`
        )
      }

      // Step 4: Adaptive loading strategy based on storage type
      // FileSystem/Memory/OPFS: Load all at once (avoids repeated getAllShardedFiles() calls)
      // Cloud (GCS/S3/R2): Use pagination (efficient native cloud APIs)
      const storageType = this.storage?.constructor.name || ''
      const isLocalStorage = storageType === 'FileSystemStorage' ||
                            storageType === 'MemoryStorage' ||
                            storageType === 'OPFSStorage'

      let loadedCount = 0
      let totalCount: number | undefined = undefined

      if (isLocalStorage) {
        // Local storage: Load all nouns at once
        prodLog.info(`HNSW: Using optimized strategy - load all nodes at once (${storageType})`)

        const result: {
          items: HNSWNoun[]
          totalCount?: number
          hasMore: boolean
          nextCursor?: string
        } = await (this.storage as any).getNounsWithPagination({
          limit: 10000000  // Effectively unlimited for local development
        })

        totalCount = result.totalCount || result.items.length

        // Process all nouns at once
        for (const nounData of result.items) {
          try {
            // Load HNSW graph data for this entity
            const hnswData = await (this.storage as any).getHNSWData(nounData.id)

            if (!hnswData) {
              // No HNSW data - skip (might be entity added before persistence)
              continue
            }

            // Determine if vector should be kept in memory
            const keepVector = shouldPreload && this.vectorStorageMode !== 'lazy'

            // Create noun object with restored connections
            const noun: HNSWNoun = {
              id: nounData.id,
              vector: keepVector ? nounData.vector : [],  // Preload if dataset is small and not lazy
              connections: new Map(),
              level: hnswData.level
            }

            // Restore SQ8 quantized data if quantization is enabled
            if (this.quantizationEnabled && nounData.vector.length > 0) {
              const sq8 = quantizeSQ8(nounData.vector)
              noun.quantizedVector = sq8.quantized
              noun.codebookMin = sq8.min
              noun.codebookMax = sq8.max
            }

            // Restore connections from persisted data
            for (const [levelStr, nounIds] of Object.entries(hnswData.connections)) {
              const level = parseInt(levelStr, 10)
              noun.connections.set(level, new Set<string>(nounIds as string[]))
            }

            // Add to in-memory index
            this.nouns.set(nounData.id, noun)

            // Track high-level nodes for O(1) entry point selection
            if (noun.level >= 2 && noun.level <= this.MAX_TRACKED_LEVELS) {
              if (!this.highLevelNodes.has(noun.level)) {
                this.highLevelNodes.set(noun.level, new Set())
              }
              this.highLevelNodes.get(noun.level)!.add(nounData.id)
            }

            loadedCount++
          } catch (error) {
            // Log error but continue (robust error recovery)
            console.error(`Failed to rebuild HNSW data for ${nounData.id}:`, error)
          }
        }

        // Report final progress
        if (options.onProgress && totalCount !== undefined) {
          options.onProgress(loadedCount, totalCount)
        }

        prodLog.info(`HNSW: Loaded ${loadedCount.toLocaleString()} nodes at once (local storage)`)

      } else {
        // Cloud storage: Use pagination with native cloud APIs
        prodLog.info(`HNSW: Using cloud pagination strategy (${storageType})`)

        let hasMore = true
        let offset = 0  // Use offset-based pagination instead of cursor (bug fix for infinite loop)

        while (hasMore) {
          // Fetch batch of nouns from storage (cast needed as method is not in base interface)
          const result: {
            items: HNSWNoun[]
            totalCount?: number
            hasMore: boolean
            nextCursor?: string
          } = await (this.storage as any).getNounsWithPagination({
            limit: batchSize,
            offset  // Pass offset for proper pagination (previously passed cursor which was ignored)
          })

          // Set total count on first batch
          if (totalCount === undefined && result.totalCount !== undefined) {
            totalCount = result.totalCount
          }

          // Process each noun in the batch
          for (const nounData of result.items) {
            try {
              // Load HNSW graph data for this entity
              const hnswData = await (this.storage as any).getHNSWData(nounData.id)

              if (!hnswData) {
                // No HNSW data - skip (might be entity added before persistence)
                continue
              }

              // Determine if vector should be kept in memory
              const keepVector = shouldPreload && this.vectorStorageMode !== 'lazy'

              // Create noun object with restored connections
              const noun: HNSWNoun = {
                id: nounData.id,
                vector: keepVector ? nounData.vector : [],  // Preload if dataset is small and not lazy
                connections: new Map(),
                level: hnswData.level
              }

              // Restore SQ8 quantized data if quantization is enabled
              if (this.quantizationEnabled && nounData.vector.length > 0) {
                const sq8 = quantizeSQ8(nounData.vector)
                noun.quantizedVector = sq8.quantized
                noun.codebookMin = sq8.min
                noun.codebookMax = sq8.max
              }

              // Restore connections from persisted data
              for (const [levelStr, nounIds] of Object.entries(hnswData.connections)) {
                const level = parseInt(levelStr, 10)
                noun.connections.set(level, new Set<string>(nounIds as string[]))
              }

              // Add to in-memory index
              this.nouns.set(nounData.id, noun)

              // Track high-level nodes for O(1) entry point selection
              if (noun.level >= 2 && noun.level <= this.MAX_TRACKED_LEVELS) {
                if (!this.highLevelNodes.has(noun.level)) {
                  this.highLevelNodes.set(noun.level, new Set())
                }
                this.highLevelNodes.get(noun.level)!.add(nounData.id)
              }

              loadedCount++
            } catch (error) {
              // Log error but continue (robust error recovery)
              console.error(`Failed to rebuild HNSW data for ${nounData.id}:`, error)
            }
          }

          // Report progress
          if (options.onProgress && totalCount !== undefined) {
            options.onProgress(loadedCount, totalCount)
          }

          // Check for more data
          hasMore = result.hasMore
          offset += batchSize  // Increment offset for next page
        }
      }

      // Step 5: CRITICAL - Recover entry point if missing)
      // This ensures consistency even if getHNSWSystem() returned null
      if (this.nouns.size > 0 && this.entryPointId === null) {
        prodLog.warn('HNSW rebuild: Entry point was null after loading nouns - recovering with O(1) lookup')

        const { id: recoveredId, level: recoveredLevel } = this.recoverEntryPointO1()

        this.entryPointId = recoveredId
        this.maxLevel = recoveredLevel

        prodLog.info(`HNSW entry point recovered: ${recoveredId} at level ${recoveredLevel}`)

        // Persist recovered state to prevent future recovery
        if (this.storage && recoveredId) {
          await this.storage.saveHNSWSystem({
            entryPointId: this.entryPointId,
            maxLevel: this.maxLevel
          }).catch((error) => {
            prodLog.error('Failed to persist recovered HNSW system data:', error)
          })
        }
      }

      // Step 6: Validate entry point exists if set (handles stale/deleted entry point)
      if (this.entryPointId && !this.nouns.has(this.entryPointId)) {
        prodLog.warn(`HNSW: Entry point ${this.entryPointId} not found in loaded nouns - recovering with O(1) lookup`)

        const { id: recoveredId, level: recoveredLevel } = this.recoverEntryPointO1()
        this.entryPointId = recoveredId
        this.maxLevel = recoveredLevel

        // Persist corrected state
        if (this.storage && recoveredId) {
          await this.storage.saveHNSWSystem({
            entryPointId: this.entryPointId,
            maxLevel: this.maxLevel
          }).catch((error) => {
            prodLog.error('Failed to persist corrected HNSW system data:', error)
          })
        }
      }

      const cacheInfo = shouldPreload
        ? ` (vectors preloaded)`
        : ` (adaptive caching - vectors loaded on-demand)`

      prodLog.info(
        `✅ HNSW index rebuilt: ${loadedCount.toLocaleString()} entities, ` +
        `${this.maxLevel + 1} levels, entry point: ${this.entryPointId || 'none'}${cacheInfo}`
      )

    } catch (error) {
      prodLog.error('HNSW rebuild failed:', error)
      throw new Error(`Failed to rebuild HNSW index: ${error}`)
    }
  }

  /**
   * Get level statistics for understanding the hierarchy
   */
  public getLevelStats(): Array<{ level: number; nodeCount: number; avgConnections: number }> {
    const levelStats = new Map<number, { count: number; totalConnections: number }>()
    
    for (const noun of this.nouns.values()) {
      for (let level = 0; level <= noun.level; level++) {
        if (!levelStats.has(level)) {
          levelStats.set(level, { count: 0, totalConnections: 0 })
        }
        
        const stats = levelStats.get(level)!
        stats.count++
        stats.totalConnections += noun.connections.get(level)?.size || 0
      }
    }
    
    return Array.from(levelStats.entries()).map(([level, stats]) => ({
      level,
      nodeCount: stats.count,
      avgConnections: stats.count > 0 ? stats.totalConnections / stats.count : 0
    })).sort((a, b) => a.level - b.level)
  }

  /**
   * Get index health metrics
   */
  public getIndexHealth(): {
    averageConnections: number
    layerDistribution: number[]
    maxLayer: number
    totalNodes: number
  } {
    let totalConnections = 0
    const layerCounts = new Array(this.maxLevel + 1).fill(0)

    // Count connections and layer distribution
    this.nouns.forEach(noun => {
      // Count connections at each layer
      for (let level = 0; level <= noun.level; level++) {
        totalConnections += noun.connections.get(level)?.size || 0
        layerCounts[level]++
      }
    })

    const totalNodes = this.nouns.size
    const averageConnections = totalNodes > 0 ? totalConnections / totalNodes : 0

    return {
      averageConnections,
      layerDistribution: layerCounts,
      maxLayer: this.maxLevel,
      totalNodes
    }
  }

  /**
   * Get cache performance statistics for monitoring and diagnostics
   *
   * Production-grade monitoring:
   * - Adaptive caching strategy (preloading vs on-demand)
   * - UnifiedCache performance (hits, misses, evictions)
   * - HNSW-specific cache statistics
   * - Fair competition metrics across all indexes
   * - Actionable recommendations for tuning
   *
   * Use this to:
   * - Diagnose performance issues (low hit rate = increase cache)
   * - Monitor memory competition (fairness violations = adjust costs)
   * - Verify adaptive caching decisions (memory estimates vs actual)
   * - Track cache efficiency over time
   *
   * @returns Comprehensive caching and performance statistics
   */
  public getCacheStats(): {
    cachingStrategy: 'preloaded' | 'on-demand'
    autoDetection: {
      entityCount: number
      estimatedVectorMemoryMB: number
      availableCacheMB: number
      threshold: number
      rationale: string
    }
    unifiedCache: {
      totalSize: number
      maxSize: number
      utilizationPercent: number
      itemCount: number
      hitRatePercent: number
      totalAccessCount: number
    }
    hnswCache: {
      vectorsInCache: number
      cacheKeyPrefix: string
      estimatedMemoryMB: number
    }
    fairness: {
      hnswAccessCount: number
      hnswAccessPercent: number
      totalAccessCount: number
      fairnessViolation: boolean
    }
    recommendations: string[]
  } {
    // Get UnifiedCache stats
    const cacheStats = this.unifiedCache.getStats()

    // Calculate entity and memory estimates
    const entityCount = this.nouns.size
    const vectorDimension = this.dimension || 384
    const bytesPerVector = vectorDimension * 4 // float32
    const estimatedVectorMemoryMB = (entityCount * bytesPerVector) / (1024 * 1024)
    const availableCacheMB = (cacheStats.maxSize * 0.8) / (1024 * 1024) // 80% threshold

    // Calculate HNSW-specific cache stats
    const vectorsInCache = cacheStats.typeCounts.hnsw || 0
    const hnswMemoryBytes = cacheStats.typeSizes.hnsw || 0

    // Calculate fairness metrics
    const hnswAccessCount = cacheStats.typeAccessCounts.hnsw || 0
    const totalAccessCount = cacheStats.totalAccessCount
    const hnswAccessPercent = totalAccessCount > 0 ? (hnswAccessCount / totalAccessCount) * 100 : 0

    // Detect fairness violation (>90% cache with <10% access)
    const hnswCachePercent = cacheStats.maxSize > 0 ? (hnswMemoryBytes / cacheStats.maxSize) * 100 : 0
    const fairnessViolation = hnswCachePercent > 90 && hnswAccessPercent < 10

    // Calculate hit rate from cache
    const hitRatePercent = (cacheStats.hitRate * 100) || 0

    // Determine caching strategy (same logic as rebuild())
    const cachingStrategy: 'preloaded' | 'on-demand' =
      estimatedVectorMemoryMB < availableCacheMB ? 'preloaded' : 'on-demand'

    // Generate actionable recommendations
    const recommendations: string[] = []

    if (cachingStrategy === 'on-demand' && hitRatePercent < 50) {
      recommendations.push(
        `Low cache hit rate (${hitRatePercent.toFixed(1)}%). Consider increasing UnifiedCache size for better performance`
      )
    }

    if (cachingStrategy === 'preloaded' && estimatedVectorMemoryMB > availableCacheMB * 0.5) {
      recommendations.push(
        `Dataset growing (${estimatedVectorMemoryMB.toFixed(1)}MB). May switch to on-demand caching as entities increase`
      )
    }

    if (fairnessViolation) {
      recommendations.push(
        `Fairness violation: HNSW using ${hnswCachePercent.toFixed(1)}% cache with only ${hnswAccessPercent.toFixed(1)}% access`
      )
    }

    if (cacheStats.utilization > 0.95) {
      recommendations.push(
        `Cache utilization high (${(cacheStats.utilization * 100).toFixed(1)}%). Consider increasing cache size`
      )
    }

    if (recommendations.length === 0) {
      recommendations.push('All metrics healthy - no action needed')
    }

    return {
      cachingStrategy,
      autoDetection: {
        entityCount,
        estimatedVectorMemoryMB: parseFloat(estimatedVectorMemoryMB.toFixed(2)),
        availableCacheMB: parseFloat(availableCacheMB.toFixed(2)),
        threshold: 0.8, // 80% of UnifiedCache
        rationale: cachingStrategy === 'preloaded'
          ? `Vectors preloaded at init (${estimatedVectorMemoryMB.toFixed(1)}MB < ${availableCacheMB.toFixed(1)}MB threshold)`
          : `Adaptive on-demand loading (${estimatedVectorMemoryMB.toFixed(1)}MB > ${availableCacheMB.toFixed(1)}MB threshold)`
      },
      unifiedCache: {
        totalSize: cacheStats.totalSize,
        maxSize: cacheStats.maxSize,
        utilizationPercent: parseFloat((cacheStats.utilization * 100).toFixed(2)),
        itemCount: cacheStats.itemCount,
        hitRatePercent: parseFloat(hitRatePercent.toFixed(2)),
        totalAccessCount: cacheStats.totalAccessCount
      },
      hnswCache: {
        vectorsInCache,
        cacheKeyPrefix: 'hnsw:vector:',
        estimatedMemoryMB: parseFloat((hnswMemoryBytes / (1024 * 1024)).toFixed(2))
      },
      fairness: {
        hnswAccessCount,
        hnswAccessPercent: parseFloat(hnswAccessPercent.toFixed(2)),
        totalAccessCount,
        fairnessViolation
      },
      recommendations
    }
  }

  /**
   * Search within a specific layer
   * Returns a map of noun IDs to distances, sorted by distance
   */
  private async searchLayer(
    queryVector: Vector,
    entryPoint: HNSWNoun,
    ef: number,
    level: number,
    filter?: (id: string) => Promise<boolean>
  ): Promise<Map<string, number>> {
    // Set of visited nouns
    const visited = new Set<string>([entryPoint.id])

    // OPTIMIZATION: Preload entry point vector
    await this.preloadVectors([entryPoint.id])

    // Check if entry point passes filter (with sync fast path)
    const entryPointDistance = await Promise.resolve(this.distanceSafe(queryVector, entryPoint))
    const entryPointPasses = filter ? await filter(entryPoint.id) : true
    
    // Priority queue of candidates (closest first)
    const candidates = new Map<string, number>()
    candidates.set(entryPoint.id, entryPointDistance)

    // Priority queue of nearest neighbors found so far (closest first)
    const nearest = new Map<string, number>()
    if (entryPointPasses) {
      nearest.set(entryPoint.id, entryPointDistance)
    }

    // While there are candidates to explore
    while (candidates.size > 0) {
      // Get closest candidate
      const [closestId, closestDist] = [...candidates][0]
      candidates.delete(closestId)

      // If this candidate is farther than the farthest in our result set, we're done
      const farthestInNearest = [...nearest][nearest.size - 1]
      if (nearest.size >= ef && closestDist > farthestInNearest[1]) {
        break
      }

      // Explore neighbors of the closest candidate
      const noun = this.nouns.get(closestId)
      if (!noun) {
        prodLog.error(`Noun with ID ${closestId} not found in searchLayer`)
        continue
      }
      const connections = noun.connections.get(level) || new Set<string>()

      // OPTIMIZATION: Preload unvisited neighbor vectors in parallel
      if (connections.size > 0) {
        const unvisitedIds = Array.from(connections).filter(id => !visited.has(id))
        if (unvisitedIds.length > 0) {
          await this.preloadVectors(unvisitedIds)
        }
      }

      // If we have enough connections and parallelization is enabled, use parallel distance calculation
      if (this.useParallelization && connections.size >= 10) {
        // Collect unvisited neighbors
        const unvisitedNeighbors: Array<{ id: string; vector: Vector }> = []
        for (const neighborId of connections) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId)
            const neighbor = this.nouns.get(neighborId)
            if (!neighbor) continue
            const neighborVector = await this.getVectorSafe(neighbor)
            unvisitedNeighbors.push({ id: neighborId, vector: neighborVector })
          }
        }

        if (unvisitedNeighbors.length > 0) {
          // Calculate distances in parallel
          const distances = await this.calculateDistancesInParallel(
            queryVector,
            unvisitedNeighbors
          )

          // Process the results
          for (const { id, distance } of distances) {
            // Apply filter if provided
            const passes = filter ? await filter(id) : true
            
            // Always add to candidates for graph traversal
            candidates.set(id, distance)
            
            // Only add to nearest if it passes the filter
            if (passes) {
              // If we haven't found ef nearest neighbors yet, or this neighbor is closer than the farthest one we've found
              if (nearest.size < ef || distance < farthestInNearest[1]) {
                nearest.set(id, distance)

                // If we have more than ef neighbors, remove the farthest one
                if (nearest.size > ef) {
                  const sortedNearest = [...nearest].sort((a, b) => a[1] - b[1])
                  nearest.clear()
                  for (let i = 0; i < ef; i++) {
                    nearest.set(sortedNearest[i][0], sortedNearest[i][1])
                  }
                }
              }
            }
          }
        }
      } else {
        // Use sequential processing for small number of connections
        for (const neighborId of connections) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId)

            const neighbor = this.nouns.get(neighborId)
            if (!neighbor) {
              // Skip neighbors that don't exist (expected during rapid additions/deletions)
              continue
            }
            const distToNeighbor = await Promise.resolve(this.distanceSafe(queryVector, neighbor))

            // Apply filter if provided
            const passes = filter ? await filter(neighborId) : true
            
            // Always add to candidates for graph traversal
            candidates.set(neighborId, distToNeighbor)
            
            // Only add to nearest if it passes the filter
            if (passes) {
              // If we haven't found ef nearest neighbors yet, or this neighbor is closer than the farthest one we've found
              if (nearest.size < ef || distToNeighbor < farthestInNearest[1]) {
                nearest.set(neighborId, distToNeighbor)

                // If we have more than ef neighbors, remove the farthest one
                if (nearest.size > ef) {
                  const sortedNearest = [...nearest].sort((a, b) => a[1] - b[1])
                  nearest.clear()
                  for (let i = 0; i < ef; i++) {
                    nearest.set(sortedNearest[i][0], sortedNearest[i][1])
                  }
                }
              }
            }
          }
        }
      }
    }

    // Sort nearest by distance
    return new Map([...nearest].sort((a, b) => a[1] - b[1]))
  }

  /**
   * Select M nearest neighbors from the candidate set
   */
  private selectNeighbors(
    queryVector: Vector,
    candidates: Map<string, number>,
    M: number
  ): Map<string, number> {
    if (candidates.size <= M) {
      return candidates
    }

    // Simple heuristic: just take the M closest
    const sortedCandidates = [...candidates].sort((a, b) => a[1] - b[1])
    const result = new Map<string, number>()

    for (let i = 0; i < Math.min(M, sortedCandidates.length); i++) {
      result.set(sortedCandidates[i][0], sortedCandidates[i][1])
    }

    return result
  }

  /**
   * Ensure a noun doesn't have too many connections at a given level
   */
  private async pruneConnections(noun: HNSWNoun, level: number): Promise<void> {
    // COW: Ensure noun is copied before modification
    this.ensureCOW(noun.id)

    const connections = noun.connections.get(level)!
    if (connections.size <= this.config.M) {
      return
    }

    // Calculate distances to all neighbors
    const distances = new Map<string, number>()
    const validNeighborIds = new Set<string>()

    // OPTIMIZATION: Preload all neighbor vectors
    if (connections.size > 0) {
      await this.preloadVectors(Array.from(connections))
    }

    for (const neighborId of connections) {
      const neighbor = this.nouns.get(neighborId)
      if (!neighbor) {
        // Skip neighbors that don't exist (expected during rapid additions/deletions)
        continue
      }

      // Only add valid neighbors to the distances map (handles lazy loading + sync fast path)
      const nounVector = await this.getVectorSafe(noun)
      const distance = await Promise.resolve(this.distanceSafe(nounVector, neighbor))
      distances.set(neighborId, distance)
      validNeighborIds.add(neighborId)
    }

    // Only proceed if we have valid neighbors
    if (distances.size === 0) {
      // If no valid neighbors, clear connections at this level
      noun.connections.set(level, new Set())
      return
    }

    // Select M closest neighbors from valid ones
    const selectedNeighbors = this.selectNeighbors(
      noun.vector,
      distances,
      this.config.M
    )

    // Update connections with only valid neighbors
    noun.connections.set(level, new Set(selectedNeighbors.keys()))
  }

  /**
   * Generate a random level for a new noun
   * Uses the same distribution as in the original HNSW paper
   */
  private getRandomLevel(): number {
    const r = Math.random()
    return Math.floor(-Math.log(r) * (1.0 / Math.log(this.config.M)))
  }
}
