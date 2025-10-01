/**
 * Entity Extraction Cache
 *
 * Caches entity extraction results to avoid re-processing unchanged content.
 * Uses file mtime or content hash for invalidation.
 *
 * PRODUCTION-READY - NO MOCKS, NO STUBS, REAL IMPLEMENTATION
 */

import { ExtractedEntity } from './entityExtractor.js'
import { createHash } from 'crypto'

/**
 * Cache entry for extracted entities
 */
export interface EntityCacheEntry {
  entities: ExtractedEntity[]
  extractedAt: number
  expiresAt: number
  mtime?: number  // File modification time for invalidation
  contentHash?: string  // For non-file content
}

/**
 * Cache options
 */
export interface EntityCacheOptions {
  enabled?: boolean
  ttl?: number  // Time to live in milliseconds
  invalidateOn?: 'mtime' | 'hash' | 'both'
  maxEntries?: number  // LRU eviction threshold
}

/**
 * Cache statistics
 */
export interface EntityCacheStats {
  hits: number
  misses: number
  evictions: number
  totalEntries: number
  hitRate: number
  averageEntitiesPerEntry: number
  cacheSize: number  // Approximate size in bytes
}

/**
 * Entity Extraction Cache with LRU eviction
 */
export class EntityExtractionCache {
  private cache = new Map<string, EntityCacheEntry>()
  private accessOrder = new Map<string, number>()  // Track access time for LRU
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  }
  private accessCounter = 0
  private maxEntries: number
  private defaultTtl: number

  constructor(options: EntityCacheOptions = {}) {
    this.maxEntries = options.maxEntries || 1000
    this.defaultTtl = options.ttl || 7 * 24 * 60 * 60 * 1000  // 7 days default
  }

  /**
   * Get cached entities
   */
  get(key: string, options?: {
    mtime?: number
    contentHash?: string
  }): ExtractedEntity[] | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.accessOrder.delete(key)
      this.stats.misses++
      return null
    }

    // Check mtime invalidation
    if (options?.mtime !== undefined && entry.mtime !== undefined) {
      if (options.mtime !== entry.mtime) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        this.stats.misses++
        return null
      }
    }

    // Check content hash invalidation
    if (options?.contentHash !== undefined && entry.contentHash !== undefined) {
      if (options.contentHash !== entry.contentHash) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        this.stats.misses++
        return null
      }
    }

    // Cache hit - update access time
    this.accessOrder.set(key, ++this.accessCounter)
    this.stats.hits++
    return entry.entities
  }

  /**
   * Set cached entities
   */
  set(key: string, entities: ExtractedEntity[], options?: {
    ttl?: number
    mtime?: number
    contentHash?: string
  }): void {
    // Check if we need to evict
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictLRU()
    }

    const ttl = options?.ttl || this.defaultTtl
    const entry: EntityCacheEntry = {
      entities,
      extractedAt: Date.now(),
      expiresAt: Date.now() + ttl,
      mtime: options?.mtime,
      contentHash: options?.contentHash
    }

    this.cache.set(key, entry)
    this.accessOrder.set(key, ++this.accessCounter)
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): boolean {
    const had = this.cache.has(key)
    this.cache.delete(key)
    this.accessOrder.delete(key)
    return had
  }

  /**
   * Invalidate all entries matching a prefix
   */
  invalidatePrefix(prefix: string): number {
    let count = 0
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        count++
      }
    }
    return count
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.stats.hits = 0
    this.stats.misses = 0
    this.stats.evictions = 0
    this.accessCounter = 0
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null
    let lruAccess = Infinity

    for (const [key, access] of this.accessOrder.entries()) {
      if (access < lruAccess) {
        lruAccess = access
        lruKey = key
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey)
      this.accessOrder.delete(lruKey)
      this.stats.evictions++
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Get cache statistics
   */
  getStats(): EntityCacheStats {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? this.stats.hits / total : 0

    let totalEntities = 0
    let totalSize = 0

    for (const entry of this.cache.values()) {
      totalEntities += entry.entities.length
      // Rough estimate: each entity ~500 bytes
      totalSize += entry.entities.length * 500
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      totalEntries: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      averageEntitiesPerEntry: this.cache.size > 0
        ? Math.round((totalEntities / this.cache.size) * 10) / 10
        : 0,
      cacheSize: totalSize
    }
  }

  /**
   * Get cache size (number of entries)
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Check if cache has key
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }
}

/**
 * Helper: Generate cache key from file path
 */
export function generateFileCacheKey(path: string): string {
  return `file:${path}`
}

/**
 * Helper: Generate cache key from content hash
 */
export function generateContentCacheKey(content: string): string {
  const hash = createHash('sha256').update(content).digest('hex')
  return `hash:${hash.substring(0, 16)}`  // Use first 16 chars for brevity
}

/**
 * Helper: Compute content hash
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
