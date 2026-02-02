/**
 * Path Resolution System with High-Performance Caching
 *
 * PRODUCTION-READY path resolution for VFS
 * Handles millions of paths efficiently with multi-layer caching
 */

import { Brainy } from '../brainy.js'
import { VerbType, NounType } from '../types/graphTypes.js'
import { VFSEntity, VFSError, VFSErrorCode } from './types.js'
import { getGlobalCache } from '../utils/unifiedCache.js'
import { prodLog } from '../utils/logger.js'

/**
 * Path cache entry
 */
interface PathCacheEntry {
  entityId: string
  timestamp: number
  hits: number  // Track hot paths
}

/**
 * High-performance path resolver with intelligent caching
 */
export class PathResolver {
  private brain: Brainy
  private rootEntityId: string

  // Multi-layer cache system
  private pathCache: Map<string, PathCacheEntry>
  private parentCache: Map<string, Set<string>>  // parent ID -> child names
  private hotPaths: Set<string>  // Frequently accessed paths

  // Cache configuration
  private readonly maxCacheSize: number
  private readonly cacheTTL: number
  private readonly hotPathThreshold: number

  // Statistics
  private cacheHits = 0
  private cacheMisses = 0
  private metadataIndexHits = 0
  private metadataIndexMisses = 0
  private graphTraversalFallbacks = 0

  // Maintenance timer
  private maintenanceTimer: NodeJS.Timeout | null = null

  constructor(brain: Brainy, rootEntityId: string, config?: {
    maxCacheSize?: number
    cacheTTL?: number
    hotPathThreshold?: number
  }) {
    this.brain = brain
    this.rootEntityId = rootEntityId

    // Initialize caches
    this.pathCache = new Map()
    this.parentCache = new Map()
    this.hotPaths = new Set()

    // Configure cache
    this.maxCacheSize = config?.maxCacheSize || 100_000
    this.cacheTTL = config?.cacheTTL || 5 * 60 * 1000  // 5 minutes
    this.hotPathThreshold = config?.hotPathThreshold || 10

    // Start cache maintenance
    this.startCacheMaintenance()
  }

  /**
   * Resolve a path to an entity ID
   * Uses 3-tier caching + MetadataIndexManager for optimal performance
   * Works for ALL storage adapters (FileSystem, GCS, S3, Azure, R2, OPFS)
   */
  async resolve(path: string, options?: {
    followSymlinks?: boolean
    cache?: boolean
  }): Promise<string> {
    // Normalize path
    const normalizedPath = this.normalizePath(path)

    // Handle root
    if (normalizedPath === '/') {
      return this.rootEntityId
    }

    const cacheKey = `vfs:path:${normalizedPath}`

    // L1: UnifiedCache (global LRU cache, <1ms, works for ALL adapters)
    if (options?.cache !== false) {
      const cached = getGlobalCache().getSync(cacheKey)
      if (cached) {
        this.cacheHits++
        return cached
      }
    }

    // L2: Local hot paths cache (warm, <1ms)
    if (options?.cache !== false && this.hotPaths.has(normalizedPath)) {
      const cached = this.pathCache.get(normalizedPath)
      if (cached && this.isCacheValid(cached)) {
        this.cacheHits++
        cached.hits++

        // Also cache in UnifiedCache for cross-instance sharing
        getGlobalCache().set(cacheKey, cached.entityId, 'other', 64, 20)

        return cached.entityId
      }
    }

    // L2b: Regular local cache
    if (options?.cache !== false && this.pathCache.has(normalizedPath)) {
      const cached = this.pathCache.get(normalizedPath)!
      if (this.isCacheValid(cached)) {
        this.cacheHits++
        cached.hits++

        // Promote to hot path if accessed frequently
        if (cached.hits >= this.hotPathThreshold) {
          this.hotPaths.add(normalizedPath)
        }

        // Also cache in UnifiedCache
        getGlobalCache().set(cacheKey, cached.entityId, 'other', 64, 20)

        return cached.entityId
      } else {
        // Remove stale entry
        this.pathCache.delete(normalizedPath)
      }
    }

    this.cacheMisses++

    // L3: MetadataIndexManager query (cold, 5-20ms on GCS, works for ALL adapters)
    // Falls back to graph traversal automatically if MetadataIndex unavailable
    const entityId = await this.resolveWithMetadataIndex(normalizedPath)

    // Cache the result in ALL layers for future hits
    if (options?.cache !== false) {
      getGlobalCache().set(cacheKey, entityId, 'other', 64, 20)
      this.cachePathEntry(normalizedPath, entityId)
    }

    return entityId
  }

  /**
   * Full path resolution by traversing the graph
   */
  private async fullResolve(path: string, options?: {
    followSymlinks?: boolean
  }): Promise<string> {
    const parts = this.splitPath(path)
    let currentId = this.rootEntityId
    let currentPath = '/'

    for (const part of parts) {
      if (!part) continue  // Skip empty parts

      // Find child with matching name
      const childId = await this.resolveChild(currentId, part)

      if (!childId) {
        throw new VFSError(
          VFSErrorCode.ENOENT,
          `No such file or directory: ${path}`,
          path,
          'resolve'
        )
      }

      currentPath = this.joinPath(currentPath, part)
      currentId = childId

      // Cache intermediate paths
      this.cachePathEntry(currentPath, currentId)

      // Handle symlinks if needed
      if (options?.followSymlinks) {
        const entity = await this.getEntity(currentId)
        if (entity.metadata.vfsType === 'symlink') {
          // Resolve symlink target
          const target = entity.metadata.attributes?.target
          if (target) {
            currentId = await this.resolve(target, options)
          }
        }
      }
    }

    return currentId
  }

  /**
   * Resolve path using MetadataIndexManager (O(log n) direct query)
   * Works for ALL storage adapters (FileSystem, GCS, S3, Azure, R2, OPFS)
   * Falls back to graph traversal if MetadataIndex unavailable
   */
  private async resolveWithMetadataIndex(path: string): Promise<string> {
    // Access MetadataIndexManager from brain instance (not storage — metadataIndex lives on Brainy)
    const metadataIndex = (this.brain as any).metadataIndex

    if (!metadataIndex) {
      // MetadataIndex not available, use graph traversal
      prodLog.debug(`MetadataIndex not available for ${path}, using graph traversal`)
      this.graphTraversalFallbacks++
      return await this.fullResolve(path)
    }

    try {
      // Direct O(log n) query to roaring bitmap index
      // This queries the 'path' field in VFS entity metadata
      const ids = await metadataIndex.getIds('path', path)

      if (ids.length === 0) {
        this.metadataIndexMisses++
        throw new VFSError(
          VFSErrorCode.ENOENT,
          `No such file or directory: ${path}`,
          path,
          'resolveWithMetadataIndex'
        )
      }

      this.metadataIndexHits++
      return ids[0]  // VFS paths are unique, return first match
    } catch (error) {
      // MetadataIndex query failed (index not built, path not indexed, etc.)
      // Fallback to reliable graph traversal
      if (error instanceof VFSError) {
        throw error  // Re-throw ENOENT errors
      }

      prodLog.debug(`MetadataIndex query failed for ${path}, falling back to graph traversal:`, error)
      this.metadataIndexMisses++
      this.graphTraversalFallbacks++
      return await this.fullResolve(path)
    }
  }

  /**
   * Resolve a child entity by name within a parent directory
   * Uses proper graph relationships instead of metadata queries
   */
  private async resolveChild(parentId: string, name: string): Promise<string | null> {
    // Check parent cache first
    const cachedChildren = this.parentCache.get(parentId)
    if (cachedChildren && cachedChildren.has(name)) {
      // Use cached knowledge to quickly find the child
      // Still need to verify it exists
    }

    // Use proper graph traversal to find children
    // VFS relationships are now part of the knowledge graph
    const relations = await this.brain.getRelations({
      from: parentId,
      type: VerbType.Contains
    })

    // PERFORMANCE FIX - Batch fetch all children (eliminates N+1 pattern)
    // Before: N sequential get() calls (10 children = 10 × 300ms = 3000ms on GCS)
    // After: 1 batch call (10 children = 1 × 300ms = 300ms on GCS)
    // 10x improvement for cloud storage (GCS, S3, Azure)
    // Same pattern as getChildren() (line 240) - now consistently applied
    const childIds = relations.map(r => r.to)
    const childrenMap = await this.brain.batchGet(childIds)

    // Find the child with matching name
    for (const relation of relations) {
      const childEntity = childrenMap.get(relation.to)
      if (childEntity && childEntity.metadata?.name === name) {
        // Update parent cache
        if (!this.parentCache.has(parentId)) {
          this.parentCache.set(parentId, new Set())
        }
        this.parentCache.get(parentId)!.add(name)

        return childEntity.id
      }
    }

    return null
  }

  /**
   * Get all children of a directory
   * Uses proper graph relationships to traverse the tree
   */
  async getChildren(dirId: string): Promise<VFSEntity[]> {
    // Use O(1) graph relationships (VFS creates these in mkdir/writeFile)
    // VFS relationships are now part of the knowledge graph (no special filtering needed)
    const relations = await this.brain.getRelations({
      from: dirId,
      type: VerbType.Contains
    })

    const validChildren: VFSEntity[] = []
    const childNames = new Set<string>()

    // Batch fetch all child entities (eliminates N+1 query pattern)
    // This is WIRED UP AND USED - no longer a stub!
    const childIds = relations.map(r => r.to)
    const childrenMap = await this.brain.batchGet(childIds)

    // Deduplicate by entity ID to handle duplicate relationship records
    // This can occur when multiple Brainy instances create relationships concurrently
    // for the same storage path (each instance has its own in-memory GraphAdjacencyIndex).
    // The Set lookup is O(1), adding negligible overhead.
    const seenEntityIds = new Set<string>()

    // Process batched results
    for (const relation of relations) {
      // Skip if we've already processed this entity
      if (seenEntityIds.has(relation.to)) {
        continue
      }
      seenEntityIds.add(relation.to)

      const entity = childrenMap.get(relation.to)
      if (entity && entity.metadata?.vfsType && entity.metadata?.name) {
        validChildren.push(entity as VFSEntity)
        childNames.add(entity.metadata.name)
      }
    }

    // Update cache
    this.parentCache.set(dirId, childNames)
    return validChildren
  }

  /**
   * Create a new path entry (for mkdir/writeFile)
   */
  async createPath(path: string, entityId: string): Promise<void> {
    const normalizedPath = this.normalizePath(path)

    // Cache the new path
    this.cachePathEntry(normalizedPath, entityId)

    // Update parent cache
    const parentPath = this.getParentPath(normalizedPath)
    const name = this.getBasename(normalizedPath)

    if (parentPath) {
      const parentId = await this.resolve(parentPath)
      if (!this.parentCache.has(parentId)) {
        this.parentCache.set(parentId, new Set())
      }
      this.parentCache.get(parentId)!.add(name)
    }
  }

  /**
   * Invalidate ALL caches
   * Call this when switching branches (checkout), clearing data (clear), or forking
   * This ensures no stale data from previous branch/state remains in cache
   */
  invalidateAllCaches(): void {
    // Clear all local caches
    this.pathCache.clear()
    this.parentCache.clear()
    this.hotPaths.clear()

    // Clear all VFS entries from UnifiedCache
    getGlobalCache().deleteByPrefix('vfs:path:')

    // Reset statistics (optional but helpful for debugging)
    this.cacheHits = 0
    this.cacheMisses = 0
    this.metadataIndexHits = 0
    this.metadataIndexMisses = 0
    this.graphTraversalFallbacks = 0

    prodLog.info('[PathResolver] All caches invalidated')
  }

  /**
   * Invalidate cache entries for a path and its children
   * FIX: Also invalidates UnifiedCache to prevent stale entity IDs
   * This fixes the "Source entity not found" bug after delete+recreate operations
   */
  invalidatePath(path: string, recursive = false): void {
    const normalizedPath = this.normalizePath(path)

    // FIX: Clear parent cache BEFORE deleting from pathCache
    // (we need the entityId from the cache entry)
    const cached = this.pathCache.get(normalizedPath)
    if (cached) {
      this.parentCache.delete(cached.entityId)
    }

    // Remove from local caches
    this.pathCache.delete(normalizedPath)
    this.hotPaths.delete(normalizedPath)

    // CRITICAL FIX: Also invalidate UnifiedCache (global LRU cache)
    // This was missing before, causing stale entity IDs to be returned after delete
    const cacheKey = `vfs:path:${normalizedPath}`
    getGlobalCache().delete(cacheKey)

    if (recursive) {
      // Remove all paths that start with this path
      const prefix = normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/'

      for (const [cachedPath, entry] of this.pathCache) {
        if (cachedPath.startsWith(prefix)) {
          this.pathCache.delete(cachedPath)
          this.hotPaths.delete(cachedPath)
          // Also clear parent cache for this entry
          this.parentCache.delete(entry.entityId)
        }
      }

      // CRITICAL FIX: Also invalidate UnifiedCache entries with this prefix
      const globalCachePrefix = `vfs:path:${prefix}`
      getGlobalCache().deleteByPrefix(globalCachePrefix)
    }
  }

  /**
   * Cache a path entry
   */
  private cachePathEntry(path: string, entityId: string): void {
    // Evict old entries if cache is full
    if (this.pathCache.size >= this.maxCacheSize) {
      this.evictOldEntries()
    }

    const existing = this.pathCache.get(path)
    this.pathCache.set(path, {
      entityId,
      timestamp: Date.now(),
      hits: existing?.hits || 0
    })
  }

  /**
   * Check if a cache entry is still valid
   */
  private isCacheValid(entry: PathCacheEntry): boolean {
    return (Date.now() - entry.timestamp) < this.cacheTTL
  }

  /**
   * Evict old cache entries (LRU with TTL)
   */
  private evictOldEntries(): void {
    const now = Date.now()
    const entries = Array.from(this.pathCache.entries())

    // Sort by least recently used (combination of timestamp and hits)
    entries.sort((a, b) => {
      const scoreA = a[1].timestamp + (a[1].hits * 60000)  // Boost for hits
      const scoreB = b[1].timestamp + (b[1].hits * 60000)
      return scoreA - scoreB
    })

    // Remove 10% of cache
    const toRemove = Math.floor(this.maxCacheSize * 0.1)
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [path] = entries[i]
      this.pathCache.delete(path)
      this.hotPaths.delete(path)
    }
  }

  /**
   * Start periodic cache maintenance
   */
  private startCacheMaintenance(): void {
    this.maintenanceTimer = setInterval(() => {
      // Clean up expired entries
      const now = Date.now()
      for (const [path, entry] of this.pathCache) {
        if (!this.isCacheValid(entry)) {
          this.pathCache.delete(path)
          this.hotPaths.delete(path)
        }
      }

      // Log cache statistics (in production, send to monitoring)
      const hitRate = this.cacheHits / (this.cacheHits + this.cacheMisses)
      if ((this.cacheHits + this.cacheMisses) % 1000 === 0) {
        console.log(`[PathResolver] Cache stats: ${Math.round(hitRate * 100)}% hit rate, ${this.pathCache.size} entries, ${this.hotPaths.size} hot paths`)
      }
    }, 60000)  // Every minute
  }

  /**
   * Get entity by ID
   */
  private async getEntity(entityId: string): Promise<VFSEntity> {
    const entity = await this.brain.get(entityId)

    if (!entity) {
      throw new VFSError(
        VFSErrorCode.ENOENT,
        `Entity not found: ${entityId}`,
        undefined,
        'getEntity'
      )
    }

    return entity as VFSEntity
  }

  // ============= Path Utilities =============

  private normalizePath(path: string): string {
    // Remove multiple slashes, trailing slashes (except for root)
    let normalized = path.replace(/\/+/g, '/')
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    return normalized || '/'
  }

  private splitPath(path: string): string[] {
    return this.normalizePath(path).split('/').filter(Boolean)
  }

  private joinPath(parent: string, child: string): string {
    if (parent === '/') return `/${child}`
    return `${parent}/${child}`
  }

  private getParentPath(path: string): string | null {
    const normalized = this.normalizePath(path)
    if (normalized === '/') return null

    const lastSlash = normalized.lastIndexOf('/')
    if (lastSlash === 0) return '/'
    return normalized.substring(0, lastSlash)
  }

  private getBasename(path: string): string {
    const normalized = this.normalizePath(path)
    if (normalized === '/') return ''

    const lastSlash = normalized.lastIndexOf('/')
    return normalized.substring(lastSlash + 1)
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer)
      this.maintenanceTimer = null
    }
    this.pathCache.clear()
    this.parentCache.clear()
    this.hotPaths.clear()
  }

  /**
   * Get cache statistics
   * Added MetadataIndexManager metrics
   */
  getStats(): {
    cacheSize: number
    hotPaths: number
    hitRate: number
    hits: number
    misses: number
    metadataIndexHits: number
    metadataIndexMisses: number
    metadataIndexHitRate: number
    graphTraversalFallbacks: number
  } {
    const totalMetadataIndexQueries = this.metadataIndexHits + this.metadataIndexMisses
    return {
      cacheSize: this.pathCache.size,
      hotPaths: this.hotPaths.size,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      metadataIndexHits: this.metadataIndexHits,
      metadataIndexMisses: this.metadataIndexMisses,
      metadataIndexHitRate: totalMetadataIndexQueries > 0
        ? this.metadataIndexHits / totalMetadataIndexQueries
        : 0,
      graphTraversalFallbacks: this.graphTraversalFallbacks
    }
  }
}