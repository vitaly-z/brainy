/**
 * Request Deduplicator
 * Prevents duplicate concurrent requests from doing redundant work
 * Massive performance improvement for repeated queries
 */

import { createHash } from 'crypto'

export interface DeduplicationOptions {
  /**
   * Time to live for cache entries in milliseconds
   * Default: 0 (no TTL, only deduplicate concurrent requests)
   */
  ttl?: number
  
  /**
   * Maximum number of entries to keep in cache
   * Default: 1000
   */
  maxSize?: number
}

/**
 * Deduplicates concurrent requests to prevent redundant work
 * When multiple identical requests are made simultaneously,
 * only the first one executes and others wait for its result
 */
export class RequestDeduplicator {
  private inFlight = new Map<string, Promise<any>>()
  private cache = new Map<string, { value: any; expiry?: number }>()
  private options: Required<DeduplicationOptions>
  
  constructor(options: DeduplicationOptions = {}) {
    this.options = {
      ttl: options.ttl ?? 0,
      maxSize: options.maxSize ?? 1000
    }
  }
  
  /**
   * Deduplicate a request
   * @param key Unique key for the request
   * @param fn Function to execute if not already in flight
   * @returns Promise with the result
   */
  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Check cache first if TTL is enabled
    if (this.options.ttl > 0) {
      const cached = this.cache.get(key)
      if (cached) {
        if (!cached.expiry || cached.expiry > Date.now()) {
          return cached.value
        }
        // Remove expired entry
        this.cache.delete(key)
      }
    }
    
    // Return existing promise if same request is in flight
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)!
    }
    
    // Create new promise and track it
    const promise = fn()
      .then(result => {
        // Cache result if TTL is enabled
        if (this.options.ttl > 0) {
          this.addToCache(key, result)
        }
        return result
      })
      .finally(() => {
        // Remove from in-flight tracking
        this.inFlight.delete(key)
      })
    
    this.inFlight.set(key, promise)
    return promise
  }
  
  /**
   * Add a result to cache with TTL and size management
   */
  private addToCache(key: string, value: any): void {
    // Enforce max size
    if (this.cache.size >= this.options.maxSize) {
      // Remove oldest entry (first in map)
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(key, {
      value,
      expiry: this.options.ttl > 0 ? Date.now() + this.options.ttl : undefined
    })
  }
  
  /**
   * Clear all cached and in-flight requests
   */
  clear(): void {
    this.inFlight.clear()
    this.cache.clear()
  }
  
  /**
   * Get the number of requests currently in flight
   */
  getInFlightCount(): number {
    return this.inFlight.size
  }
  
  /**
   * Get the number of cached results
   */
  getCacheSize(): number {
    return this.cache.size
  }
  
  /**
   * Generate a cache key for search requests
   */
  static getSearchKey(query: string, k: number, filter?: any): string {
    const filterStr = filter ? JSON.stringify(filter) : ''
    return `search:${query}:${k}:${filterStr}`
  }
  
  /**
   * Generate a cache key for get requests
   */
  static getGetKey(id: string): string {
    return `get:${id}`
  }
  
  /**
   * Generate a cache key for similarity requests
   */
  static getSimilarKey(id: string, k: number, filter?: any): string {
    const filterStr = filter ? JSON.stringify(filter) : ''
    return `similar:${id}:${k}:${filterStr}`
  }
  
  /**
   * Generate a cache key for arbitrary data
   */
  static generateKey(data: any): string {
    const hash = createHash('sha256')
    hash.update(JSON.stringify(data))
    return hash.digest('hex').substring(0, 16)
  }
}

// Export singleton instance for global deduplication
export const globalDeduplicator = new RequestDeduplicator({
  ttl: 5000, // 5 second TTL for global cache
  maxSize: 500
})