/**
 * Unified Index Interface (v3.35.0+)
 *
 * Standardizes index lifecycle across all index types in Brainy.
 * All indexes (HNSW Vector, Graph Adjacency, Metadata Field) implement this interface
 * for consistent rebuild, clear, and stats operations.
 *
 * This enables:
 * - Parallel index rebuilds during initialization
 * - Consistent index management across the system
 * - Easy addition of new index types
 * - Unified monitoring and health checks
 */

/**
 * Index statistics returned by getStats()
 */
export interface IndexStats {
  /**
   * Total number of items in the index
   */
  totalItems: number

  /**
   * Estimated memory usage in bytes (optional)
   */
  memoryUsage?: number

  /**
   * Timestamp of last rebuild (optional)
   */
  lastRebuilt?: number

  /**
   * Index-specific statistics (optional)
   * - HNSW: { maxLevel, entryPointId, levels, avgDegree }
   * - Graph: { totalRelationships, verbTypes }
   * - Metadata: { totalFields, totalEntries }
   */
  specifics?: Record<string, any>
}

/**
 * Progress callback for rebuild operations
 * Reports current progress and total count
 */
export type RebuildProgressCallback = (loaded: number, total: number) => void

/**
 * Rebuild options for index rebuilding
 */
export interface RebuildOptions {
  /**
   * @deprecated Lazy mode is now auto-detected based on available memory.
   * System automatically chooses between:
   * - Preloading: Small datasets that fit comfortably in cache (< 80% threshold)
   * - On-demand: Large datasets loaded adaptively via UnifiedCache
   *
   * This option is kept for backwards compatibility but is ignored.
   * The system always uses adaptive caching (v3.36.0+).
   */
  lazy?: boolean

  /**
   * Batch size for pagination during rebuild
   * Default: 1000 (tune based on available memory)
   */
  batchSize?: number

  /**
   * Progress callback for monitoring rebuild progress
   * Called periodically with (loaded, total) counts
   */
  onProgress?: RebuildProgressCallback

  /**
   * Force rebuild even if index appears populated
   * Useful for repairing corrupted indexes
   */
  force?: boolean
}

/**
 * Unified Index Interface
 *
 * All indexes in Brainy implement this interface for consistent lifecycle management.
 * This enables parallel rebuilds, unified monitoring, and standardized operations.
 */
export interface IIndex {
  /**
   * Rebuild index from persisted storage
   *
   * Called during Brainy initialization when:
   * - Container restarts and in-memory indexes are empty
   * - Storage has persisted data but indexes need rebuilding
   * - Force rebuild is requested
   *
   * Implementation must:
   * - Clear existing in-memory state
   * - Load data from storage using pagination
   * - Restore index structure efficiently (O(N) preferred over O(N log N))
   * - Handle millions of entities via batching
   * - Auto-detect caching strategy based on dataset size vs available memory
   * - Provide progress reporting for large datasets
   * - Recover gracefully from partial failures
   *
   * Adaptive Caching (v3.36.0+):
   * System automatically chooses optimal strategy:
   * - Small datasets: Preload all data at init for zero-latency access
   * - Large datasets: Load on-demand via UnifiedCache for memory efficiency
   *
   * @param options Rebuild options (batch size, progress callback, force)
   * @returns Promise that resolves when rebuild is complete
   * @throws Error if rebuild fails critically (should log warnings for partial failures)
   */
  rebuild(options?: RebuildOptions): Promise<void>

  /**
   * Clear all in-memory index data
   *
   * Called when:
   * - User explicitly calls brain.clear()
   * - System needs to reset without rebuilding
   * - Tests need clean state
   *
   * Implementation must:
   * - Clear all in-memory data structures
   * - Reset counters and statistics
   * - NOT delete persisted storage data
   * - Be idempotent (safe to call multiple times)
   *
   * Note: This is a memory-only operation. To delete persisted data,
   * use storage.clear() instead.
   */
  clear(): void

  /**
   * Get current index statistics
   *
   * Returns real-time statistics about the index state:
   * - Total items indexed
   * - Memory usage (if available)
   * - Last rebuild timestamp
   * - Index-specific metrics
   *
   * Used for:
   * - Health monitoring
   * - Determining if rebuild is needed
   * - Performance analysis
   * - Debugging
   *
   * @returns Promise that resolves to index statistics
   */
  getStats(): Promise<IndexStats>

  /**
   * Get the current size of the index
   *
   * Fast O(1) operation returning the number of items in the index.
   * Used for quick health checks and deciding rebuild strategy.
   *
   * @returns Number of items in the index
   */
  size(): number
}

/**
 * Extended index interface with cache support (optional)
 *
 * Indexes can optionally implement cache integration for:
 * - Hot/warm/cold tier management
 * - Memory-efficient lazy loading
 * - Adaptive caching based on access patterns
 */
export interface ICachedIndex extends IIndex {
  /**
   * Set cache for resource management
   *
   * Enables the index to use UnifiedCache for:
   * - Lazy loading of vectors/data
   * - Hot/warm/cold tier management
   * - Memory pressure handling
   *
   * @param cache UnifiedCache instance
   */
  setCache?(cache: any): void
}

/**
 * Extended index interface with persistence support (optional)
 *
 * Indexes can optionally implement explicit persistence:
 * - Manual triggering of data saves
 * - Batch write optimization
 * - Checkpoint creation
 */
export interface IPersistentIndex extends IIndex {
  /**
   * Manually persist current index state to storage
   *
   * Most indexes auto-persist during operations (e.g., HNSW persists on addItem).
   * This method allows explicit persistence for:
   * - Checkpointing before risky operations
   * - Forced flush before shutdown
   * - Manual backup creation
   *
   * @returns Promise that resolves when persistence is complete
   */
  persist?(): Promise<void>
}
