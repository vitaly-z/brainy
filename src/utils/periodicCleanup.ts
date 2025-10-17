/**
 * Periodic Cleanup for Soft-Deleted Items
 * 
 * SAFETY-FIRST APPROACH:
 * - Maintains durability guarantees (storage-first)
 * - Coordinates HNSW and metadata index consistency
 * - Isolated from live operations
 * - Graceful failure handling
 */

import { prodLog } from './logger.js'
import { DELETED_FIELD, isDeleted } from './metadataNamespace.js'
import type { StorageAdapter } from '../coreTypes.js'
import type { HNSWIndex } from '../hnsw/hnswIndex.js'
import type { MetadataIndexManager } from './metadataIndex.js'

export interface CleanupConfig {
  /** Age in milliseconds after which soft-deleted items are eligible for cleanup */
  maxAge: number
  /** Maximum number of items to clean up in one batch */
  batchSize: number
  /** Interval between cleanup runs (milliseconds) */
  cleanupInterval: number
  /** Whether to run cleanup automatically */
  enabled: boolean
}

export interface CleanupStats {
  itemsProcessed: number
  itemsDeleted: number
  errors: number
  lastRun: number
  nextRun: number
}

/**
 * Coordinates safe cleanup of old soft-deleted items across all indexes
 * 
 * CRITICAL SAFETY FEATURES:
 * 1. Storage-first deletion (durability)
 * 2. Index consistency coordination
 * 3. Batch processing with limits
 * 4. Error isolation and recovery
 */
export class PeriodicCleanup {
  private storage: StorageAdapter
  private hnswIndex: HNSWIndex
  private metadataIndex: MetadataIndexManager | null
  private config: CleanupConfig
  private stats: CleanupStats
  private cleanupTimer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    storage: StorageAdapter,
    hnswIndex: HNSWIndex,
    metadataIndex: MetadataIndexManager | null,
    config: Partial<CleanupConfig> = {}
  ) {
    this.storage = storage
    this.hnswIndex = hnswIndex
    this.metadataIndex = metadataIndex
    
    // Default: clean up items deleted more than 1 hour ago
    this.config = {
      maxAge: config.maxAge ?? 60 * 60 * 1000, // 1 hour
      batchSize: config.batchSize ?? 100,       // 100 items max per batch
      cleanupInterval: config.cleanupInterval ?? 15 * 60 * 1000, // Every 15 minutes
      enabled: config.enabled ?? true
    }
    
    this.stats = {
      itemsProcessed: 0,
      itemsDeleted: 0,
      errors: 0,
      lastRun: 0,
      nextRun: 0
    }
  }

  /**
   * Start periodic cleanup
   */
  start(): void {
    if (!this.config.enabled || this.cleanupTimer) {
      return
    }

    prodLog.info(`Starting periodic cleanup: maxAge=${this.config.maxAge}, batchSize=${this.config.batchSize}, interval=${this.config.cleanupInterval}`)

    this.scheduleNext()
  }

  /**
   * Stop periodic cleanup
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer)
      this.cleanupTimer = null
    }

    prodLog.info('Stopped periodic cleanup')
  }

  /**
   * Run cleanup manually
   */
  async runNow(): Promise<CleanupStats> {
    if (this.running) {
      throw new Error('Cleanup already running')
    }

    return this.performCleanup()
  }

  /**
   * Get current cleanup statistics
   */
  getStats(): CleanupStats {
    return { ...this.stats }
  }

  private scheduleNext(): void {
    const nextRun = Date.now() + this.config.cleanupInterval
    this.stats.nextRun = nextRun

    this.cleanupTimer = setTimeout(async () => {
      await this.performCleanup()
      this.scheduleNext()
    }, this.config.cleanupInterval)
  }

  /**
   * CRITICAL: Coordinated cleanup across all indexes
   * 
   * SAFETY PROTOCOL:
   * 1. Find eligible items (old + soft-deleted)
   * 2. Remove from storage FIRST (durability)
   * 3. Remove from HNSW (graph consistency) 
   * 4. Remove from metadata index (search consistency)
   * 5. Track stats and errors
   */
  private async performCleanup(): Promise<CleanupStats> {
    if (this.running) {
      prodLog.warn('Cleanup already running, skipping')
      return this.stats
    }

    this.running = true
    const startTime = Date.now()
    this.stats.lastRun = startTime

    try {
      prodLog.debug(`Starting cleanup run: maxAge=${this.config.maxAge}, cutoffTime=${startTime - this.config.maxAge}`)

      // Step 1: Find eligible items for cleanup
      const eligibleItems = await this.findEligibleItems(startTime)
      
      if (eligibleItems.length === 0) {
        prodLog.debug('No items eligible for cleanup')
        return this.stats
      }

      prodLog.info(`Found ${eligibleItems.length} items eligible for cleanup`)

      // Step 2: Process in batches for safety
      let processed = 0
      let deleted = 0
      let errors = 0

      for (let i = 0; i < eligibleItems.length; i += this.config.batchSize) {
        const batch = eligibleItems.slice(i, i + this.config.batchSize)
        
        const batchResult = await this.processBatch(batch)
        processed += batchResult.processed
        deleted += batchResult.deleted
        errors += batchResult.errors

        // Small delay between batches to avoid overwhelming the system
        if (i + this.config.batchSize < eligibleItems.length) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      // Update stats
      this.stats.itemsProcessed += processed
      this.stats.itemsDeleted += deleted
      this.stats.errors += errors

      prodLog.info(`Cleanup run completed: processed=${processed}, deleted=${deleted}, errors=${errors}, duration=${Date.now() - startTime}ms`)

    } catch (error) {
      prodLog.error(`Cleanup run failed: ${error}`)
      this.stats.errors++
    } finally {
      this.running = false
    }

    return this.stats
  }

  /**
   * Find items eligible for cleanup (old + soft-deleted)
   */
  private async findEligibleItems(currentTime: number): Promise<string[]> {
    const cutoffTime = currentTime - this.config.maxAge
    const eligibleItems: string[] = []

    try {
      // Get all nouns from storage (using pagination to avoid memory issues)
      const nounsResult = await this.storage.getNouns({
        pagination: { limit: 1000 } // Process in chunks
      })
      
      for (const noun of nounsResult.items) {
        try {
          // v4.0.0: Cast NounMetadata to NamespacedMetadata for isDeleted check
          if (!noun.metadata || !isDeleted(noun.metadata as any)) {
            continue // Not deleted, skip
          }

          // Check if old enough for cleanup
          const deletedTime = (noun.metadata as any)._brainy?.updated || 0
          if (deletedTime && (currentTime - deletedTime) > this.config.maxAge) {
            eligibleItems.push(noun.id)
          }

        } catch (error) {
          prodLog.warn(`Failed to check item ${noun.id} for cleanup eligibility: ${error}`)
        }
      }

    } catch (error) {
      prodLog.error(`Failed to find eligible items: ${error}`)
      throw error
    }

    return eligibleItems
  }

  /**
   * Process a batch of items for cleanup
   * 
   * CRITICAL: This maintains the durability-first approach:
   * Storage → HNSW → Metadata Index
   */
  private async processBatch(itemIds: string[]): Promise<{
    processed: number
    deleted: number  
    errors: number
  }> {
    let processed = 0
    let deleted = 0
    let errors = 0

    for (const id of itemIds) {
      processed++

      try {
        // STEP 1: Remove from storage FIRST (durability guarantee)
        try {
          await this.storage.deleteNoun(id)
        } catch (storageError) {
          prodLog.warn(`Failed to delete ${id} from storage: ${storageError}`)
          errors++
          continue
        }

        // STEP 2: Remove from HNSW index (vector search consistency)
        const hnswResult = this.hnswIndex.removeItem(id)
        if (!hnswResult) {
          prodLog.warn(`Failed to remove ${id} from HNSW index (may not have been indexed)`)
          // Not a critical error - item might not have been in vector index
        }

        // STEP 3: Remove from metadata index (faceted search consistency)  
        if (this.metadataIndex) {
          await this.metadataIndex.removeFromIndex(id)
        }

        deleted++
        prodLog.debug(`Successfully cleaned up item ${id}`)

      } catch (error) {
        errors++
        prodLog.error(`Failed to cleanup item ${id}: ${error}`)
      }
    }

    return { processed, deleted, errors }
  }
}