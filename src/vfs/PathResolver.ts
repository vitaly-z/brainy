/**
 * Path Resolution System with High-Performance Caching
 *
 * PRODUCTION-READY path resolution for VFS
 * Handles millions of paths efficiently with multi-layer caching
 */

import { Brainy } from '../brainy.js'
import { VerbType, NounType } from '../types/graphTypes.js'
import { VFSEntity, VFSError, VFSErrorCode } from './types.js'

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
   * Uses multi-layer caching for optimal performance
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

    // Check L1 cache (hot paths)
    if (options?.cache !== false && this.hotPaths.has(normalizedPath)) {
      const cached = this.pathCache.get(normalizedPath)
      if (cached && this.isCacheValid(cached)) {
        this.cacheHits++
        cached.hits++
        return cached.entityId
      }
    }

    // Check L2 cache (regular cache)
    if (options?.cache !== false && this.pathCache.has(normalizedPath)) {
      const cached = this.pathCache.get(normalizedPath)!
      if (this.isCacheValid(cached)) {
        this.cacheHits++
        cached.hits++

        // Promote to hot path if accessed frequently
        if (cached.hits >= this.hotPathThreshold) {
          this.hotPaths.add(normalizedPath)
        }

        return cached.entityId
      } else {
        // Remove stale entry
        this.pathCache.delete(normalizedPath)
      }
    }

    this.cacheMisses++

    // Try to resolve using parent cache
    const parentPath = this.getParentPath(normalizedPath)
    const name = this.getBasename(normalizedPath)

    if (parentPath && this.pathCache.has(parentPath)) {
      const parentCached = this.pathCache.get(parentPath)!
      if (this.isCacheValid(parentCached)) {
        // We have the parent, just need to find the child
        const entityId = await this.resolveChild(parentCached.entityId, name)
        if (entityId) {
          this.cachePathEntry(normalizedPath, entityId)
          return entityId
        }
      }
    }

    // Full resolution required
    const entityId = await this.fullResolve(normalizedPath, options)

    // Cache the result
    this.cachePathEntry(normalizedPath, entityId)

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
    // Get all relationships where parentId contains other entities
    const relations = await this.brain.getRelations({
      from: parentId,
      type: VerbType.Contains,
      includeVFS: true  // v4.5.1: Required to see VFS relationships
    })

    // Find the child with matching name
    for (const relation of relations) {
      const childEntity = await this.brain.get(relation.to)
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
    // Production-ready: Use graph relationships (VFS creates these in mkdir/writeFile)
    const relations = await this.brain.getRelations({
      from: dirId,
      type: VerbType.Contains,
      includeVFS: true  // v4.5.1: Required to see VFS relationships
    })

    const validChildren: VFSEntity[]= []
    const childNames = new Set<string>()

    // Fetch all child entities via relationships
    for (const relation of relations) {
      const entity = await this.brain.get(relation.to)
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
   * Invalidate cache entries for a path and its children
   */
  invalidatePath(path: string, recursive = false): void {
    const normalizedPath = this.normalizePath(path)

    // Remove from all caches
    this.pathCache.delete(normalizedPath)
    this.hotPaths.delete(normalizedPath)

    if (recursive) {
      // Remove all paths that start with this path
      const prefix = normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/'

      for (const [cachedPath] of this.pathCache) {
        if (cachedPath.startsWith(prefix)) {
          this.pathCache.delete(cachedPath)
          this.hotPaths.delete(cachedPath)
        }
      }
    }

    // Clear parent cache for the entity
    const cached = this.pathCache.get(normalizedPath)
    if (cached) {
      this.parentCache.delete(cached.entityId)
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
   */
  getStats(): {
    cacheSize: number
    hotPaths: number
    hitRate: number
    hits: number
    misses: number
  } {
    return {
      cacheSize: this.pathCache.size,
      hotPaths: this.hotPaths.size,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses),
      hits: this.cacheHits,
      misses: this.cacheMisses
    }
  }
}