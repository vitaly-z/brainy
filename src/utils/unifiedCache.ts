/**
 * UnifiedCache - Single cache for both HNSW and MetadataIndex
 * Prevents resource competition with cost-aware eviction
 *
 * Features (v3.36.0+):
 * - Adaptive sizing: Automatically scales from 2GB to 128GB+ based on available memory
 * - Container-aware: Detects Docker/K8s limits (cgroups v1/v2)
 * - Environment detection: Production vs development allocation strategies
 * - Memory pressure monitoring: Warns when approaching limits
 */

import { prodLog } from './logger.js'
import {
  getRecommendedCacheConfig,
  formatBytes,
  checkMemoryPressure,
  type MemoryInfo,
  type CacheAllocationStrategy
} from './memoryDetection.js'

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
  /** Maximum cache size in bytes (auto-detected if not specified) */
  maxSize?: number

  /** Minimum cache size in bytes (default 256MB) */
  minSize?: number

  /** Force development mode allocation (25% instead of 40-50%) */
  developmentMode?: boolean

  /** Enable request coalescing to prevent duplicate loads */
  enableRequestCoalescing?: boolean

  /** Enable fairness monitoring to prevent cache starvation */
  enableFairnessCheck?: boolean

  /** Fairness check interval in milliseconds */
  fairnessCheckInterval?: number

  /** Enable access pattern persistence for warm starts */
  persistPatterns?: boolean

  /** Enable memory pressure monitoring (default true) */
  enableMemoryMonitoring?: boolean

  /** Memory pressure check interval in milliseconds (default 30s) */
  memoryCheckInterval?: number
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

  // Memory management (v3.36.0+)
  private readonly memoryInfo: MemoryInfo
  private readonly allocationStrategy: CacheAllocationStrategy
  private memoryPressureCheckTimer: NodeJS.Timeout | null = null
  private lastMemoryWarning = 0

  constructor(config: UnifiedCacheConfig = {}) {
    // Adaptive cache sizing (v3.36.0+)
    const recommendation = getRecommendedCacheConfig({
      manualSize: config.maxSize,
      minSize: config.minSize,
      developmentMode: config.developmentMode
    })

    this.memoryInfo = recommendation.memoryInfo
    this.allocationStrategy = recommendation.allocation
    this.maxSize = recommendation.allocation.cacheSize

    // Log allocation decision (v3.36.0+: includes model memory)
    prodLog.info(
      `UnifiedCache initialized: ${formatBytes(this.maxSize)} ` +
      `(${this.allocationStrategy.environment} mode, ` +
      `${(this.allocationStrategy.ratio * 100).toFixed(0)}% of ${formatBytes(this.allocationStrategy.availableForCache)} ` +
      `after ${formatBytes(this.allocationStrategy.modelMemory)} ${this.allocationStrategy.modelPrecision.toUpperCase()} model)`
    )

    // Log memory detection details
    prodLog.debug(
      `Memory detection: source=${this.memoryInfo.source}, ` +
      `container=${this.memoryInfo.isContainer}, ` +
      `system=${formatBytes(this.memoryInfo.systemTotal)}, ` +
      `free=${formatBytes(this.memoryInfo.free)}, ` +
      `totalAvailable=${formatBytes(this.memoryInfo.available)}, ` +
      `modelReserved=${formatBytes(this.allocationStrategy.modelMemory)}, ` +
      `availableForCache=${formatBytes(this.allocationStrategy.availableForCache)}`
    )

    // Log warnings if any
    for (const warning of recommendation.warnings) {
      prodLog.warn(`UnifiedCache: ${warning}`)
    }

    // Finalize configuration
    this.config = {
      enableRequestCoalescing: true,
      enableFairnessCheck: true,
      fairnessCheckInterval: 30000,  // Check fairness every 30 seconds (v3.40.2: was 60s)
      persistPatterns: true,
      enableMemoryMonitoring: true,
      memoryCheckInterval: 30000,  // Check memory every 30s
      ...config
    }

    // Start monitoring
    if (this.config.enableFairnessCheck) {
      this.startFairnessMonitor()
    }

    if (this.config.enableMemoryMonitoring) {
      this.startMemoryPressureMonitor()
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
   * Synchronous cache lookup (v3.36.0+)
   * Returns cached data immediately or undefined if not cached
   * Use for sync fast path optimization - zero async overhead
   */
  getSync(key: string): any | undefined {
    // Check if in cache
    const item = this.cache.get(key)
    if (item) {
      // Update access tracking synchronously
      this.access.set(key, (this.access.get(key) || 0) + 1)
      this.totalAccessCount++
      item.lastAccess = Date.now()
      item.accessCount++
      this.typeAccessCounts[item.type]++
      return item.data
    }

    return undefined
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

    // Proactive fairness check (v3.40.2): Check immediately if adding to a dominant type
    // This prevents imbalance formation instead of reacting to it
    if (this.config.enableFairnessCheck && this.cache.size > 10) {
      this.checkProactiveFairness(type)
    }
  }

  /**
   * Evict item with lowest value (access count / rebuild cost)
   */
  private evictLowestValue(): void {
    let victim: string | null = null
    let lowestScore = Infinity

    for (const [key, item] of this.cache) {
      // Calculate value score: access frequency * rebuild cost (higher is better)
      const accessScore = (this.access.get(key) || 1)
      const score = accessScore * item.rebuildCost
      
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
      const score = (this.access.get(key) || 1) * item.rebuildCost
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

    // Check for starvation (v3.40.2: more aggressive - 70% cache with <15% accesses)
    // Previous: 90% cache, <10% access (too lenient, caused thrashing)
    for (const type of ['hnsw', 'metadata', 'embedding', 'other'] as const) {
      if (sizeRatios[type] > 0.7 && accessRatios[type] < 0.15) {
        prodLog.warn(`Type ${type} is hogging cache (${(sizeRatios[type] * 100).toFixed(1)}% size, ${(accessRatios[type] * 100).toFixed(1)}% access)`)
        this.evictType(type)
      }
    }
  }

  /**
   * Proactive fairness check (v3.40.2)
   * Called immediately when adding items to prevent imbalance formation
   * Uses same thresholds as periodic check but runs on-demand
   */
  private checkProactiveFairness(addedType: 'hnsw' | 'metadata' | 'embedding' | 'other'): void {
    // Quick check: only evaluate the type being added
    let typeSize = 0
    for (const item of this.cache.values()) {
      if (item.type === addedType) {
        typeSize += item.size
      }
    }

    const sizeRatio = typeSize / (this.currentSize || 1)
    const accessRatio = this.typeAccessCounts[addedType] / (this.totalAccessCount || 1)

    // Same threshold as periodic check: 70% size, <15% access
    if (sizeRatio > 0.7 && accessRatio < 0.15) {
      prodLog.debug(`Proactive fairness: ${addedType} reaching dominance (${(sizeRatio * 100).toFixed(1)}% size, ${(accessRatio * 100).toFixed(1)}% access)`)
      this.evictType(addedType)
    }
  }

  /**
   * Force evict items of a specific type
   */
  private evictType(type: 'hnsw' | 'metadata' | 'embedding' | 'other'): void {
    const candidates: Array<[string, number, CacheItem]> = []

    for (const [key, item] of this.cache) {
      if (item.type === type) {
        const score = (this.access.get(key) || 1) * item.rebuildCost
        candidates.push([key, score, item])
      }
    }

    // Sort by score (lower is worse)
    candidates.sort((a, b) => a[1] - b[1])

    // Evict bottom 50% of this type (v3.40.2: was 20%, too slow to prevent thrashing)
    const evictCount = Math.max(1, Math.floor(candidates.length * 0.5))

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
   * Delete all items with keys starting with the given prefix
   * v6.2.9: Added for VFS cache invalidation (fixes stale parent ID bug)
   * @param prefix - The key prefix to match
   * @returns Number of items deleted
   */
  deleteByPrefix(prefix: string): number {
    let deleted = 0
    for (const [key, item] of this.cache) {
      if (key.startsWith(prefix)) {
        this.currentSize -= item.size
        this.cache.delete(key)
        deleted++
      }
    }
    return deleted
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
   * Start memory pressure monitoring
   * Periodically checks if we're approaching memory limits
   */
  private startMemoryPressureMonitor(): void {
    const checkInterval = this.config.memoryCheckInterval || 30000

    this.memoryPressureCheckTimer = setInterval(() => {
      this.checkMemoryPressure()
    }, checkInterval)

    // Unref so it doesn't keep process alive
    if (this.memoryPressureCheckTimer.unref) {
      this.memoryPressureCheckTimer.unref()
    }
  }

  /**
   * Check current memory pressure and warn if needed
   */
  private checkMemoryPressure(): void {
    const pressure = checkMemoryPressure(this.currentSize, this.memoryInfo)

    // Only log warnings every 5 minutes to avoid spam
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    if (pressure.warnings.length > 0 && now - this.lastMemoryWarning > fiveMinutes) {
      for (const warning of pressure.warnings) {
        prodLog.warn(`UnifiedCache: ${warning}`)
      }
      this.lastMemoryWarning = now
    }

    // If critical, force aggressive eviction
    if (pressure.pressure === 'critical') {
      const targetSize = Math.floor(this.maxSize * 0.7)  // Evict to 70%
      const bytesToFree = this.currentSize - targetSize

      if (bytesToFree > 0) {
        prodLog.warn(
          `UnifiedCache: Critical memory pressure - forcing eviction of ${formatBytes(bytesToFree)}`
        )
        this.evictForSize(bytesToFree)
      }
    }
  }

  /**
   * Get cache statistics with memory information
   */
  getStats() {
    const typeSizes = { hnsw: 0, metadata: 0, embedding: 0, other: 0 }
    const typeCounts = { hnsw: 0, metadata: 0, embedding: 0, other: 0 }

    for (const item of this.cache.values()) {
      typeSizes[item.type] += item.size
      typeCounts[item.type]++
    }

    const hitRate = this.cache.size > 0 ?
      Array.from(this.cache.values()).reduce((sum, item) => sum + item.accessCount, 0) / this.totalAccessCount : 0

    return {
      // Cache statistics
      totalSize: this.currentSize,
      maxSize: this.maxSize,
      utilization: this.currentSize / this.maxSize,
      itemCount: this.cache.size,
      typeSizes,
      typeCounts,
      typeAccessCounts: this.typeAccessCounts,
      totalAccessCount: this.totalAccessCount,
      hitRate,

      // Memory management (v3.36.0+)
      memory: {
        available: this.memoryInfo.available,
        source: this.memoryInfo.source,
        isContainer: this.memoryInfo.isContainer,
        systemTotal: this.memoryInfo.systemTotal,
        allocationRatio: this.allocationStrategy.ratio,
        environment: this.allocationStrategy.environment
      }
    }
  }

  /**
   * Get detailed memory information
   */
  getMemoryInfo() {
    return {
      memoryInfo: { ...this.memoryInfo },
      allocationStrategy: { ...this.allocationStrategy },
      currentPressure: checkMemoryPressure(this.currentSize, this.memoryInfo)
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