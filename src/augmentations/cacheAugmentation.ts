/**
 * Cache Augmentation - Optional Search Result Caching
 * 
 * Replaces the hardcoded SearchCache in BrainyData with an optional augmentation.
 * This reduces core size and allows custom cache implementations.
 * 
 * Zero-config: Automatically enabled with sensible defaults
 * Can be disabled or customized via augmentation registry
 */

import { BaseAugmentation, AugmentationContext } from './brainyAugmentation.js'
import { SearchCache } from '../utils/searchCache.js'
import type { GraphNoun } from '../types/graphTypes.js'

export interface CacheConfig {
  maxSize?: number
  ttl?: number
  enabled?: boolean
  invalidateOnWrite?: boolean
}

/**
 * CacheAugmentation - Makes search caching optional and pluggable
 * 
 * Features:
 * - Transparent search result caching
 * - Automatic invalidation on data changes
 * - Memory-aware cache management
 * - Zero-config with smart defaults
 */
export class CacheAugmentation extends BaseAugmentation {
  readonly name = 'cache'
  readonly timing = 'around' as const
  operations = ['search', 'add', 'delete', 'clear', 'all'] as ('search' | 'add' | 'delete' | 'clear' | 'all')[]
  readonly priority = 50 // Mid-priority, runs after data operations

  private searchCache: SearchCache<GraphNoun> | null = null
  private config: CacheConfig

  constructor(config: CacheConfig = {}) {
    super()
    this.config = {
      maxSize: 1000,
      ttl: 300000, // 5 minutes default
      enabled: true,
      invalidateOnWrite: true,
      ...config
    }
  }

  protected async onInitialize(): Promise<void> {
    if (!this.config.enabled) {
      this.log('Cache augmentation disabled by configuration')
      return
    }

    // Initialize search cache with config
    this.searchCache = new SearchCache<GraphNoun>({
      maxSize: this.config.maxSize!,
      maxAge: this.config.ttl!,  // SearchCache uses maxAge, not ttl
      enabled: true
    })

    this.log(`Cache augmentation initialized (maxSize: ${this.config.maxSize}, ttl: ${this.config.ttl}ms)`)
  }

  protected async onShutdown(): Promise<void> {
    if (this.searchCache) {
      this.searchCache.clear()
      this.searchCache = null
    }
    this.log('Cache augmentation shut down')
  }

  /**
   * Execute augmentation - wrap operations with caching logic
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // If cache is disabled, just pass through
    if (!this.searchCache || !this.config.enabled) {
      return next()
    }

    switch (operation) {
      case 'search':
        return this.handleSearch(params, next)
      
      case 'add':
      case 'update':
      case 'delete':
        // Invalidate cache on data changes
        if (this.config.invalidateOnWrite) {
          const result = await next()
          this.searchCache.invalidateOnDataChange(operation as any)
          this.log(`Cache invalidated due to ${operation} operation`)
          return result
        }
        return next()
      
      case 'clear':
        // Clear cache when all data is cleared
        const result = await next()
        this.searchCache.clear()
        this.log('Cache cleared due to clear operation')
        return result
      
      default:
        return next()
    }
  }

  /**
   * Handle search operation with caching
   */
  private async handleSearch<T>(params: any, next: () => Promise<T>): Promise<T> {
    if (!this.searchCache) return next()

    // Extract search parameters
    const { query, k, options = {} } = params

    // Skip cache if explicitly disabled or has complex filters
    if (options.skipCache || options.metadata) {
      return next()
    }

    // Generate cache key
    const cacheKey = this.searchCache.getCacheKey(query, k, options)

    // Check cache
    const cachedResult = this.searchCache.get(cacheKey)
    if (cachedResult) {
      this.log('Cache hit for search query')
      // Update metrics if available
      if (this.context?.brain) {
        const metrics = this.context.brain.augmentations?.get('metrics')
        if (metrics) {
          metrics.recordCacheHit?.()
        }
      }
      return cachedResult as T
    }

    // Execute search
    const result = await next()

    // Cache the result
    this.searchCache.set(cacheKey, result as any)
    this.log('Search result cached')

    // Update metrics if available
    if (this.context?.brain) {
      const metrics = this.context.brain.augmentations?.get('metrics')
      if (metrics) {
        metrics.recordCacheMiss?.()
      }
    }

    return result
  }

  /**
   * Get cache statistics
   */
  getStats() {
    if (!this.searchCache) {
      return {
        enabled: false,
        hits: 0,
        misses: 0,
        size: 0,
        memoryUsage: 0
      }
    }

    const stats = this.searchCache.getStats()
    return {
      ...stats,
      memoryUsage: this.searchCache.getMemoryUsage()
    }
  }

  /**
   * Clear the cache manually
   */
  clear() {
    if (this.searchCache) {
      this.searchCache.clear()
      this.log('Cache manually cleared')
    }
  }

  /**
   * Update cache configuration
   */
  updateConfig(config: Partial<CacheConfig>) {
    this.config = { ...this.config, ...config }
    
    if (this.searchCache && this.config.enabled) {
      this.searchCache.updateConfig({
        maxSize: this.config.maxSize!,
        maxAge: this.config.ttl!,  // SearchCache uses maxAge
        enabled: this.config.enabled
      })
      this.log('Cache configuration updated')
    }
  }

  /**
   * Clean up expired entries
   */
  cleanupExpiredEntries(): number {
    if (!this.searchCache) return 0
    
    const cleaned = this.searchCache.cleanupExpiredEntries()
    if (cleaned > 0) {
      this.log(`Cleaned ${cleaned} expired cache entries`)
    }
    return cleaned
  }
  
  /**
   * Invalidate cache when data changes
   */
  invalidateOnDataChange(operation: 'add' | 'update' | 'delete') {
    if (!this.searchCache) return
    
    this.searchCache.invalidateOnDataChange(operation)
    this.log(`Cache invalidated due to ${operation} operation`)
  }
  
  /**
   * Get cache key for a query
   */
  getCacheKey(query: any, options?: any): string {
    if (!this.searchCache) return ''
    return this.searchCache.getCacheKey(query, options)
  }
  
  /**
   * Direct cache get
   */
  get(key: string): any {
    if (!this.searchCache) return null
    return this.searchCache.get(key)
  }
  
  /**
   * Direct cache set
   */
  set(key: string, value: any): void {
    if (!this.searchCache) return
    this.searchCache.set(key, value)
  }
  
  /**
   * Get the underlying SearchCache instance (for compatibility)
   */
  getSearchCache() {
    return this.searchCache
  }
  
  /**
   * Get memory usage
   */
  getMemoryUsage(): number {
    if (!this.searchCache) return 0
    return this.searchCache.getMemoryUsage()
  }
}

/**
 * Factory function for zero-config cache augmentation
 */
export function createCacheAugmentation(config?: CacheConfig): CacheAugmentation {
  return new CacheAugmentation(config)
}