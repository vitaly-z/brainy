/**
 * UnifiedCache - Single cache for both HNSW and MetadataIndex
 * Prevents resource competition with cost-aware eviction
 */

import { prodLog } from './logger.js'

export interface CacheItem {
  key: string
  type: 'hnsw' | 'metadata' | 'embedding' | 'other'
  data: any
  size: number
  rebuildCost: number  // milliseconds to rebuild
  lastAccess: number
  accessCount: number
}

export interface UnifiedCacheConfig {
  maxSize?: number  // bytes
  enableRequestCoalescing?: boolean
  enableFairnessCheck?: boolean
  fairnessCheckInterval?: number  // ms
  persistPatterns?: boolean
}

export class UnifiedCache {
  private cache = new Map<string, CacheItem>()
  private access = new Map<string, number>()  // Access counts
  private loadingPromises = new Map<string, Promise<any>>()
  private typeAccessCounts = { hnsw: 0, metadata: 0, embedding: 0, other: 0 }
  private totalAccessCount = 0
  private currentSize = 0
  private readonly maxSize: number
  private readonly config: UnifiedCacheConfig

  constructor(config: UnifiedCacheConfig = {}) {
    this.maxSize = config.maxSize || 2 * 1024 * 1024 * 1024  // 2GB default
    this.config = {
      enableRequestCoalescing: true,
      enableFairnessCheck: true,
      fairnessCheckInterval: 60000,  // Check fairness every minute
      persistPatterns: true,
      ...config
    }

    if (this.config.enableFairnessCheck) {
      this.startFairnessMonitor()
    }
  }

  /**
   * Get item from cache with request coalescing
   */
  async get(key: string, loadFn?: () => Promise<any>): Promise<any> {
    // Update access tracking
    this.access.set(key, (this.access.get(key) || 0) + 1)
    this.totalAccessCount++

    // Check if in cache
    const item = this.cache.get(key)
    if (item) {
      item.lastAccess = Date.now()
      item.accessCount++
      this.typeAccessCounts[item.type]++
      return item.data
    }

    // If no load function, return undefined
    if (!loadFn) {
      return undefined
    }

    // Request coalescing - prevent stampede
    if (this.config.enableRequestCoalescing && this.loadingPromises.has(key)) {
      prodLog.debug('Request coalescing for key:', key)
      return this.loadingPromises.get(key)
    }

    // Load data
    const loadPromise = loadFn()
    if (this.config.enableRequestCoalescing) {
      this.loadingPromises.set(key, loadPromise)
    }

    try {
      const data = await loadPromise
      return data
    } finally {
      if (this.config.enableRequestCoalescing) {
        this.loadingPromises.delete(key)
      }
    }
  }

  /**
   * Set item in cache with cost-aware eviction
   */
  set(
    key: string,
    data: any,
    type: 'hnsw' | 'metadata' | 'embedding' | 'other',
    size: number,
    rebuildCost: number = 1
  ): void {
    // Make room if needed
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLowestValue()
    }

    // Add to cache
    const item: CacheItem = {
      key,
      type,
      data,
      size,
      rebuildCost,
      lastAccess: Date.now(),
      accessCount: 1
    }

    // Update or add
    const existing = this.cache.get(key)
    if (existing) {
      this.currentSize -= existing.size
    }

    this.cache.set(key, item)
    this.currentSize += size
    this.typeAccessCounts[type]++
    this.totalAccessCount++
  }

  /**
   * Evict item with lowest value (access count / rebuild cost)
   */
  private evictLowestValue(): void {
    let victim: string | null = null
    let lowestScore = Infinity

    for (const [key, item] of this.cache) {
      // Calculate value score: access frequency / rebuild cost
      const accessScore = (this.access.get(key) || 1)
      const score = accessScore / Math.max(item.rebuildCost, 1)
      
      if (score < lowestScore) {
        lowestScore = score
        victim = key
      }
    }

    if (victim) {
      const item = this.cache.get(victim)!
      prodLog.debug(`Evicting ${victim} (type: ${item.type}, score: ${lowestScore})`)
      
      this.currentSize -= item.size
      this.cache.delete(victim)
      // Keep access count for a while to prevent re-caching cold items
      // this.access.delete(victim)  // Don't delete immediately
    }
  }

  /**
   * Size-aware eviction - try to match needed size
   */
  evictForSize(bytesNeeded: number): boolean {
    const candidates: Array<[string, number, CacheItem]> = []
    
    for (const [key, item] of this.cache) {
      const score = (this.access.get(key) || 1) / item.rebuildCost
      candidates.push([key, score, item])
    }

    // Sort by score (lower is worse)
    candidates.sort((a, b) => a[1] - b[1])

    let freedBytes = 0
    const toEvict: string[] = []

    // Try to free exactly what we need
    for (const [key, , item] of candidates) {
      toEvict.push(key)
      freedBytes += item.size
      if (freedBytes >= bytesNeeded) {
        break
      }
    }

    // Evict selected items
    for (const key of toEvict) {
      const item = this.cache.get(key)!
      this.currentSize -= item.size
      this.cache.delete(key)
    }

    return freedBytes >= bytesNeeded
  }

  /**
   * Fairness monitoring - prevent one type from hogging cache
   */
  private startFairnessMonitor(): void {
    setInterval(() => {
      this.checkFairness()
    }, this.config.fairnessCheckInterval!)
  }

  private checkFairness(): void {
    // Calculate type ratios in cache
    const typeSizes = { hnsw: 0, metadata: 0, embedding: 0, other: 0 }
    const typeCounts = { hnsw: 0, metadata: 0, embedding: 0, other: 0 }

    for (const item of this.cache.values()) {
      typeSizes[item.type] += item.size
      typeCounts[item.type]++
    }

    // Calculate access ratios
    const totalAccess = this.totalAccessCount || 1
    const accessRatios = {
      hnsw: this.typeAccessCounts.hnsw / totalAccess,
      metadata: this.typeAccessCounts.metadata / totalAccess,
      embedding: this.typeAccessCounts.embedding / totalAccess,
      other: this.typeAccessCounts.other / totalAccess
    }

    // Calculate size ratios
    const totalSize = this.currentSize || 1
    const sizeRatios = {
      hnsw: typeSizes.hnsw / totalSize,
      metadata: typeSizes.metadata / totalSize,
      embedding: typeSizes.embedding / totalSize,
      other: typeSizes.other / totalSize
    }

    // Check for starvation (90% cache but <10% accesses)
    for (const type of ['hnsw', 'metadata', 'embedding', 'other'] as const) {
      if (sizeRatios[type] > 0.9 && accessRatios[type] < 0.1) {
        prodLog.warn(`Type ${type} is hogging cache (${(sizeRatios[type] * 100).toFixed(1)}% size, ${(accessRatios[type] * 100).toFixed(1)}% access)`)
        this.evictType(type)
      }
    }
  }

  /**
   * Force evict items of a specific type
   */
  private evictType(type: 'hnsw' | 'metadata' | 'embedding' | 'other'): void {
    const candidates: Array<[string, number, CacheItem]> = []
    
    for (const [key, item] of this.cache) {
      if (item.type === type) {
        const score = (this.access.get(key) || 1) / item.rebuildCost
        candidates.push([key, score, item])
      }
    }

    // Sort by score (lower is worse)
    candidates.sort((a, b) => a[1] - b[1])

    // Evict bottom 20% of this type
    const evictCount = Math.max(1, Math.floor(candidates.length * 0.2))
    
    for (let i = 0; i < evictCount && i < candidates.length; i++) {
      const [key, , item] = candidates[i]
      this.currentSize -= item.size
      this.cache.delete(key)
      prodLog.debug(`Fairness eviction: ${key} (type: ${type})`)
    }
  }

  /**
   * Delete specific item from cache
   */
  delete(key: string): boolean {
    const item = this.cache.get(key)
    if (item) {
      this.currentSize -= item.size
      this.cache.delete(key)
      return true
    }
    return false
  }

  /**
   * Clear cache or specific type
   */
  clear(type?: 'hnsw' | 'metadata' | 'embedding' | 'other'): void {
    if (!type) {
      this.cache.clear()
      this.currentSize = 0
      return
    }

    for (const [key, item] of this.cache) {
      if (item.type === type) {
        this.currentSize -= item.size
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const typeSizes = { hnsw: 0, metadata: 0, embedding: 0, other: 0 }
    const typeCounts = { hnsw: 0, metadata: 0, embedding: 0, other: 0 }

    for (const item of this.cache.values()) {
      typeSizes[item.type] += item.size
      typeCounts[item.type]++
    }

    return {
      totalSize: this.currentSize,
      maxSize: this.maxSize,
      utilization: this.currentSize / this.maxSize,
      itemCount: this.cache.size,
      typeSizes,
      typeCounts,
      typeAccessCounts: this.typeAccessCounts,
      totalAccessCount: this.totalAccessCount,
      hitRate: this.cache.size > 0 ? 
        Array.from(this.cache.values()).reduce((sum, item) => sum + item.accessCount, 0) / this.totalAccessCount : 0
    }
  }

  /**
   * Save access patterns for cold start optimization
   */
  async saveAccessPatterns(): Promise<any> {
    if (!this.config.persistPatterns) return

    const patterns = Array.from(this.cache.entries())
      .map(([key, item]) => ({
        key,
        type: item.type,
        accessCount: this.access.get(key) || 0,
        size: item.size,
        rebuildCost: item.rebuildCost
      }))
      .sort((a, b) => b.accessCount - a.accessCount)

    return {
      patterns,
      typeAccessCounts: this.typeAccessCounts,
      timestamp: Date.now()
    }
  }

  /**
   * Load access patterns for warm start
   */
  async loadAccessPatterns(patterns: any): Promise<void> {
    if (!patterns?.patterns) return

    // Pre-populate access counts
    for (const pattern of patterns.patterns) {
      this.access.set(pattern.key, pattern.accessCount)
    }

    // Restore type access counts
    if (patterns.typeAccessCounts) {
      this.typeAccessCounts = patterns.typeAccessCounts
    }

    prodLog.debug('Loaded access patterns:', patterns.patterns.length, 'items')
  }
}

// Export singleton for global coordination
let globalCache: UnifiedCache | null = null

export function getGlobalCache(config?: UnifiedCacheConfig): UnifiedCache {
  if (!globalCache) {
    globalCache = new UnifiedCache(config)
  }
  return globalCache
}

export function clearGlobalCache(): void {
  if (globalCache) {
    globalCache.clear()
    globalCache = null
  }
}