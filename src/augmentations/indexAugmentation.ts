/**
 * Index Augmentation - Optional Metadata Indexing
 * 
 * Replaces the hardcoded MetadataIndex in BrainyData with an optional augmentation.
 * Provides O(1) metadata filtering and field lookups.
 * 
 * Zero-config: Automatically enabled for better search performance
 * Can be disabled or customized via augmentation registry
 */

import { BaseAugmentation, AugmentationContext } from './brainyAugmentation.js'
import { MetadataIndexManager } from '../utils/metadataIndex.js'
import type { BaseStorageAdapter as StorageAdapter } from '../storage/adapters/baseStorageAdapter.js'

export interface IndexConfig {
  enabled?: boolean
  maxFieldValues?: number
  maxIndexSize?: number // Max number of entries per field value
  autoRebuild?: boolean
  rebuildThreshold?: number
  flushInterval?: number
}

/**
 * IndexAugmentation - Makes metadata indexing optional and pluggable
 * 
 * Features:
 * - O(1) metadata field lookups
 * - Fast pre-filtering for searches
 * - Automatic index maintenance
 * - Zero-config with smart defaults
 */
export class IndexAugmentation extends BaseAugmentation {
  readonly metadata = 'readonly' as const  // Reads metadata to build indexes
  readonly name = 'index'
  readonly timing = 'after' as const
  operations = ['add', 'updateMetadata', 'delete', 'clear', 'all'] as ('add' | 'updateMetadata' | 'delete' | 'clear' | 'all')[]
  readonly priority = 60 // Run after data operations

  private metadataIndex: MetadataIndexManager | null = null
  private config: IndexConfig
  private flushTimer: NodeJS.Timeout | null = null

  constructor(config: IndexConfig = {}) {
    super()
    this.config = {
      enabled: true,
      maxFieldValues: 1000,
      autoRebuild: true,
      rebuildThreshold: 0.3, // Rebuild if 30% inconsistent
      flushInterval: 30000, // Flush every 30 seconds
      ...config
    }
  }

  protected async onInitialize(): Promise<void> {
    if (!this.config.enabled) {
      this.log('Index augmentation disabled by configuration')
      return
    }

    // Get storage from context
    const storage = this.context?.storage
    if (!storage) {
      this.log('No storage available, index augmentation inactive', 'warn')
      return
    }

    // Initialize metadata index
    this.metadataIndex = new MetadataIndexManager(
      storage as StorageAdapter,
      {
        maxIndexSize: this.config.maxIndexSize || 10000
      }
    )

    // Check if we need to rebuild
    if (this.config.autoRebuild) {
      const stats = await this.metadataIndex.getStats()
      if (stats.totalEntries === 0) {
        // Check if storage has data but index is empty
        try {
          const storageStats = await storage.getStatistics?.()
          if (storageStats && storageStats.totalNouns > 0) {
            this.log('Rebuilding metadata index for existing data...')
            await this.metadataIndex.rebuild()
            const newStats = await this.metadataIndex.getStats()
            this.log(`Index rebuilt: ${newStats.totalEntries} entries, ${newStats.fieldsIndexed.length} fields`)
          }
        } catch (e) {
          this.log('Could not check storage statistics', 'info')
        }
      }
    }

    // Start flush timer
    if (this.config.flushInterval && this.config.flushInterval > 0) {
      this.startFlushTimer()
    }

    this.log('Index augmentation initialized')
  }

  protected async onShutdown(): Promise<void> {
    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    // Flush index one last time
    if (this.metadataIndex) {
      try {
        await this.metadataIndex.flush()
      } catch (error) {
        this.log('Error flushing index during shutdown', 'warn')
      }
      this.metadataIndex = null
    }

    this.log('Index augmentation shut down')
  }

  /**
   * Execute augmentation - maintain index on data operations
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Execute the operation first
    const result = await next()

    // If index is disabled, just return
    if (!this.metadataIndex || !this.config.enabled) {
      return result
    }

    // Handle index updates after operation completes
    switch (operation) {
      case 'add':
        await this.handleAdd(params)
        break
      
      case 'updateMetadata':
        await this.handleUpdate(params)
        break
      
      case 'delete':
        await this.handleDelete(params)
        break
      
      case 'clear':
        await this.handleClear()
        break
    }

    return result
  }

  /**
   * Handle add operation - index new metadata
   */
  private async handleAdd(params: any): Promise<void> {
    if (!this.metadataIndex) return

    const { id, metadata } = params
    if (id && metadata) {
      await this.metadataIndex.addToIndex(id, metadata)
      this.log(`Indexed metadata for ${id}`, 'info')
    }
  }

  /**
   * Handle update operation - reindex metadata
   */
  private async handleUpdate(params: any): Promise<void> {
    if (!this.metadataIndex) return

    const { id, oldMetadata, newMetadata } = params
    
    // Remove old metadata
    if (id && oldMetadata) {
      await this.metadataIndex.removeFromIndex(id, oldMetadata)
    }
    
    // Add new metadata
    if (id && newMetadata) {
      await this.metadataIndex.addToIndex(id, newMetadata)
      this.log(`Reindexed metadata for ${id}`, 'info')
    }
  }

  /**
   * Handle delete operation - remove from index
   */
  private async handleDelete(params: any): Promise<void> {
    if (!this.metadataIndex) return

    const { id, metadata } = params
    if (id && metadata) {
      await this.metadataIndex.removeFromIndex(id, metadata)
      this.log(`Removed ${id} from index`, 'info')
    }
  }

  /**
   * Handle clear operation - clear index
   */
  private async handleClear(): Promise<void> {
    if (!this.metadataIndex) return

    // Clear the index when all data is cleared (rebuild effectively clears it)
    await this.metadataIndex.rebuild()
    this.log('Index cleared due to clear operation')
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return

    this.flushTimer = setInterval(async () => {
      if (this.metadataIndex) {
        try {
          await this.metadataIndex.flush()
        } catch (error) {
          this.log('Error during periodic index flush', 'warn')
        }
      }
    }, this.config.flushInterval!)
  }

  /**
   * Get IDs that match metadata filter (for pre-filtering)
   */
  async getIdsForFilter(filter: Record<string, any>): Promise<string[]> {
    if (!this.metadataIndex) return []
    return this.metadataIndex.getIdsForFilter(filter)
  }

  /**
   * Get available values for a field
   */
  async getFilterValues(field: string): Promise<any[]> {
    if (!this.metadataIndex) return []
    return this.metadataIndex.getFilterValues(field)
  }

  /**
   * Get all indexed fields
   */
  async getFilterFields(): Promise<string[]> {
    if (!this.metadataIndex) return []
    return this.metadataIndex.getFilterFields()
  }

  /**
   * Get index statistics
   */
  async getStats() {
    if (!this.metadataIndex) {
      return {
        enabled: false,
        totalEntries: 0,
        fieldsIndexed: [],
        memoryUsage: 0
      }
    }

    const stats = await this.metadataIndex.getStats()
    return {
      enabled: true,
      ...stats
    }
  }

  /**
   * Rebuild the index from storage
   */
  async rebuild(): Promise<void> {
    if (!this.metadataIndex) {
      throw new Error('Index augmentation is not initialized')
    }

    this.log('Rebuilding metadata index...')
    await this.metadataIndex.rebuild()
    const stats = await this.metadataIndex.getStats()
    this.log(`Index rebuilt: ${stats.totalEntries} entries, ${stats.fieldsIndexed.length} fields`)
  }

  /**
   * Flush index to storage
   */
  async flush(): Promise<void> {
    if (this.metadataIndex) {
      await this.metadataIndex.flush()
      this.log('Index flushed to storage', 'info')
    }
  }
  
  /**
   * Add entry to index (public method for direct access)
   */
  async addToIndex(id: string, metadata: Record<string, any>): Promise<void> {
    if (!this.metadataIndex) return
    await this.metadataIndex.addToIndex(id, metadata)
  }
  
  /**
   * Remove entry from index (public method for direct access)
   */
  async removeFromIndex(id: string, metadata: Record<string, any>): Promise<void> {
    if (!this.metadataIndex) return
    await this.metadataIndex.removeFromIndex(id, metadata)
  }
  
  /**
   * Get the underlying MetadataIndexManager instance
   */
  getMetadataIndex() {
    return this.metadataIndex
  }
}

/**
 * Factory function for zero-config index augmentation
 */
export function createIndexAugmentation(config?: IndexConfig): IndexAugmentation {
  return new IndexAugmentation(config)
}