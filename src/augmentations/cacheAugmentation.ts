/**
 * Cache Augmentation - Optional Search Result Caching
 * 
 * Replaces the hardcoded SearchCache in Brainy with an optional augmentation.
 * This reduces core size and allows custom cache implementations.
 * 
 * Zero-config: Automatically enabled with sensible defaults
 * Can be disabled or customized via augmentation registry
 */

import { BaseAugmentation, AugmentationContext } from './brainyAugmentation.js'
import { AugmentationManifest } from './manifest.js'
import { SearchCache } from '../utils/searchCache.js'
import type { GraphNoun } from '../types/graphTypes.js'

export interface CacheConfig {
  maxSize?: number
  ttl?: number
  enabled?: boolean
  invalidateOnWrite?: boolean
  silent?: boolean  // Silent mode support
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
  readonly metadata = 'none' as const  // Cache doesn't access metadata
  operations = ['search', 'find', 'similar', 'add', 'update', 'delete', 'clear', 'all'] as ('search' | 'find' | 'similar' | 'add' | 'update' | 'delete' | 'clear' | 'all')[]
  readonly priority = 50 // Mid-priority, runs after data operations

  // Augmentation metadata
  readonly category = 'core' as const
  readonly description = 'Transparent search result caching with automatic invalidation'

  private searchCache: SearchCache<GraphNoun> | null = null

  constructor(config?: CacheConfig) {
    super(config)
  }
  
  getManifest(): AugmentationManifest {
    return {
      id: 'cache',
      name: 'Cache',
      version: '2.0.0',
      description: 'Intelligent caching for search and query operations',
      longDescription: 'Provides transparent caching for search results with automatic invalidation on data changes. Significantly improves performance for repeated queries while maintaining data consistency.',
      category: 'performance',
      configSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Enable or disable caching'
          },
          maxSize: {
            type: 'number',
            default: 1000,
            minimum: 10,
            maximum: 100000,
            description: 'Maximum number of cached entries'
          },
          ttl: {
            type: 'number',
            default: 300000, // 5 minutes
            minimum: 1000,    // 1 second
            maximum: 3600000, // 1 hour
            description: 'Time to live for cache entries in milliseconds'
          },
          invalidateOnWrite: {
            type: 'boolean',
            default: true,
            description: 'Automatically invalidate cache on data modifications'
          },
          silent: {
            type: 'boolean',
            default: false,
            description: 'Suppress all console output'
          }
        },
        additionalProperties: false
      },
      configDefaults: {
        enabled: true,
        maxSize: 1000,
        ttl: 300000,
        invalidateOnWrite: true
      },
      configExamples: [
        {
          name: 'High Performance',
          description: 'Large cache with longer TTL for read-heavy workloads',
          config: {
            enabled: true,
            maxSize: 10000,
            ttl: 1800000, // 30 minutes
            invalidateOnWrite: true
          }
        },
        {
          name: 'Conservative',
          description: 'Small cache with short TTL for frequently changing data',
          config: {
            enabled: true,
            maxSize: 100,
            ttl: 60000, // 1 minute
            invalidateOnWrite: true
          }
        }
      ],
      minBrainyVersion: '2.0.0',
      keywords: ['cache', 'performance', 'search', 'optimization'],
      documentation: 'https://docs.brainy.dev/augmentations/cache',
      status: 'stable',
      performance: {
        memoryUsage: 'medium',
        cpuUsage: 'low',
        networkUsage: 'none'
      },
      features: ['search-caching', 'auto-invalidation', 'ttl-support', 'memory-management'],
      enhancedOperations: ['search', 'searchText', 'findSimilar'],
      metrics: [
        {
          name: 'cache_hits',
          type: 'counter',
          description: 'Number of cache hits'
        },
        {
          name: 'cache_misses',
          type: 'counter',
          description: 'Number of cache misses'
        },
        {
          name: 'cache_size',
          type: 'gauge',
          description: 'Current cache size'
        }
      ],
      ui: {
        icon: '⚡',
        color: '#FFC107'
      }
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
        // Cache the reference to avoid race condition during async operation
        const cache = this.searchCache
        if (this.config.invalidateOnWrite && cache) {
          const result = await next()
          // Use cached reference - searchCache might have been nulled during await
          cache.invalidateOnDataChange(operation as any)
          this.log(`Cache invalidated due to ${operation} operation`)
          return result
        }
        return next()
      
      case 'clear':
        // Clear cache when all data is cleared
        const result = await next()
        if (this.searchCache) {
          this.searchCache.clear()
          this.log('Cache cleared due to clear operation')
        }
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
   * Handle runtime configuration changes
   */
  protected async onConfigChange(newConfig: CacheConfig, oldConfig: CacheConfig): Promise<void> {
    if (this.searchCache && newConfig.enabled) {
      this.searchCache.updateConfig({
        maxSize: newConfig.maxSize!,
        maxAge: newConfig.ttl!,  // SearchCache uses maxAge
        enabled: newConfig.enabled
      })
      this.log('Cache configuration updated')
    } else if (!newConfig.enabled && this.searchCache) {
      this.searchCache.clear()
      this.log('Cache disabled and cleared')
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