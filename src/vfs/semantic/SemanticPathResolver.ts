/**
 * Semantic Path Resolver
 *
 * Unified path resolver that handles BOTH:
 * - Traditional hierarchical paths (/src/auth/login.ts)
 * - Semantic projection paths (/by-concept/authentication/...)
 *
 * Uses EXISTING infrastructure:
 * - PathResolver for traditional paths
 * - ProjectionRegistry for semantic dimensions
 * - SemanticPathParser for path type detection
 */

import { Brainy } from '../../brainy.js'
import { VirtualFileSystem } from '../VirtualFileSystem.js'
import { PathResolver } from '../PathResolver.js'
import { VFSEntity, VFSError, VFSErrorCode } from '../types.js'
import { SemanticPathParser, ParsedSemanticPath } from './SemanticPathParser.js'
import { ProjectionRegistry } from './ProjectionRegistry.js'
import { UnifiedCache } from '../../utils/unifiedCache.js'

/**
 * Semantic Path Resolver
 * Handles both traditional and semantic paths transparently
 *
 * Uses Brainy's UnifiedCache for optimal memory management and performance
 */
export class SemanticPathResolver {
  private brain: Brainy
  private vfs: VirtualFileSystem
  private pathResolver: PathResolver
  private parser: SemanticPathParser
  private registry: ProjectionRegistry
  private cache: UnifiedCache

  constructor(
    brain: Brainy,
    vfs: VirtualFileSystem,
    rootEntityId: string,
    registry: ProjectionRegistry
  ) {
    this.brain = brain
    this.vfs = vfs
    this.registry = registry
    this.parser = new SemanticPathParser()

    // Use Brainy's UnifiedCache for semantic path caching
    // Zero-config: Uses 2GB default from UnifiedCache
    this.cache = new UnifiedCache({
      enableRequestCoalescing: true,
      enableFairnessCheck: true
    })

    // Create traditional path resolver (uses its own optimized cache with defaults)
    this.pathResolver = new PathResolver(brain, rootEntityId)
  }

  /**
   * Resolve a path to entity ID(s)
   * Handles BOTH traditional and semantic paths
   *
   * For traditional paths: Returns single entity ID
   * For semantic paths: Returns first matching entity ID
   *
   * Uses UnifiedCache with request coalescing to prevent stampede
   *
   * @param path - Path to resolve (traditional or semantic)
   * @param options - Resolution options
   * @returns Entity ID
   */
  async resolve(path: string, options?: {
    followSymlinks?: boolean
    cache?: boolean
  }): Promise<string> {
    // Parse the path to determine dimension
    const parsed = this.parser.parse(path)

    // Handle based on path dimension
    if (parsed.dimension === 'traditional') {
      // Use existing PathResolver for traditional paths
      return await this.pathResolver.resolve(path, options)
    }

    // Semantic path - use UnifiedCache with request coalescing
    const cacheKey = `semantic:${path}`

    if (options?.cache === false) {
      // Skip cache if requested
      const entityIds = await this.resolveSemanticPathInternal(parsed)
      if (entityIds.length === 0) {
        throw new VFSError(
          VFSErrorCode.ENOENT,
          `No entities found for semantic path: ${path}`,
          path,
          'resolve'
        )
      }
      return entityIds[0]
    }

    // Use UnifiedCache - automatically handles stampede prevention
    const entityIds = await this.cache.get(cacheKey, async () => {
      return await this.resolveSemanticPathInternal(parsed)
    })

    if (!entityIds || entityIds.length === 0) {
      throw new VFSError(
        VFSErrorCode.ENOENT,
        `No entities found for semantic path: ${path}`,
        path,
        'resolve'
      )
    }

    return entityIds[0]
  }

  /**
   * Resolve semantic path to multiple entity IDs
   * This is the polymorphic resolution that returns ALL matches
   *
   * Uses UnifiedCache for performance
   *
   * @param path - Semantic path
   * @param options - Resolution options
   * @returns Array of entity IDs
   */
  async resolveAll(path: string, options?: {
    cache?: boolean
    limit?: number
  }): Promise<string[]> {
    const parsed = this.parser.parse(path)

    if (parsed.dimension === 'traditional') {
      // Traditional paths resolve to single entity
      const id = await this.pathResolver.resolve(path, options)
      return [id]
    }

    // Use cache if enabled
    const cacheKey = `semantic:${path}`

    if (options?.cache === false) {
      return await this.resolveSemanticPathInternal(parsed, options?.limit)
    }

    // UnifiedCache with automatic stampede prevention
    return await this.cache.get(cacheKey, async () => {
      return await this.resolveSemanticPathInternal(parsed, options?.limit)
    })
  }

  /**
   * Internal semantic path resolution (called by cache)
   * Estimates cost and size for UnifiedCache optimization
   */
  private async resolveSemanticPathInternal(
    parsed: ParsedSemanticPath,
    limit?: number
  ): Promise<string[]> {

    // Resolve based on dimension
    let entityIds: string[] = []

    switch (parsed.dimension) {
      case 'concept':
        entityIds = await this.registry.resolve('concept', parsed.value, this.brain, this.vfs)
        break

      case 'author':
        entityIds = await this.registry.resolve('author', parsed.value, this.brain, this.vfs)
        break

      case 'time':
        entityIds = await this.registry.resolve('time', parsed.value, this.brain, this.vfs)
        break

      case 'relationship':
        entityIds = await this.registry.resolve('relationship', parsed.value, this.brain, this.vfs)
        break

      case 'similar':
        entityIds = await this.registry.resolve('similar', parsed.value, this.brain, this.vfs)
        break

      case 'tag':
        // Tags use metadata filtering (concept-like)
        entityIds = await this.registry.resolve('tag', parsed.value, this.brain, this.vfs)
        break

      case 'traditional':
        // Shouldn't reach here, but handle it gracefully
        return []

      default:
        throw new VFSError(
          VFSErrorCode.ENOTDIR,  // Use existing error code
          `Unsupported semantic path dimension: ${parsed.dimension}`,
          '',
          'resolve'
        )
    }

    // Apply subpath filter if specified
    if (parsed.subpath) {
      entityIds = await this.filterBySubpath(entityIds, parsed.subpath)
    }

    // Apply limit
    if (limit && limit > 0) {
      entityIds = entityIds.slice(0, limit)
    }

    // Result will be cached by UnifiedCache.get() automatically

    return entityIds
  }

  /**
   * Filter entity IDs by subpath (filename or partial path)
   */
  private async filterBySubpath(entityIds: string[], subpath: string): Promise<string[]> {
    const filtered: string[] = []

    for (const id of entityIds) {
      const entity = await this.brain.get(id)
      if (!entity) continue

      const name = entity.metadata?.name
      const path = entity.metadata?.path

      // Check if name or path matches subpath
      if (name === subpath || path?.endsWith(subpath)) {
        filtered.push(id)
      }
    }

    return filtered
  }

  /**
   * Get children of a directory
   * Delegates to PathResolver for traditional directories
   * For semantic paths, returns entities in that dimension
   */
  async getChildren(dirIdOrPath: string): Promise<VFSEntity[]> {
    // If it looks like a path, parse it
    if (dirIdOrPath.startsWith('/')) {
      const parsed = this.parser.parse(dirIdOrPath)

      if (parsed.dimension !== 'traditional') {
        // For semantic paths, list entities in that dimension
        return await this.listSemanticDimension(parsed)
      }
    }

    // Traditional directory - use PathResolver
    return await this.pathResolver.getChildren(dirIdOrPath)
  }

  /**
   * List entities in a semantic dimension
   */
  private async listSemanticDimension(parsed: ParsedSemanticPath): Promise<VFSEntity[]> {
    switch (parsed.dimension) {
      case 'concept':
        return await this.registry.list('concept', this.brain, this.vfs)

      case 'author':
        return await this.registry.list('author', this.brain, this.vfs)

      case 'time':
        return await this.registry.list('time', this.brain, this.vfs)

      case 'tag':
        return await this.registry.list('tag', this.brain, this.vfs)

      default:
        return []
    }
  }

  /**
   * Create a path mapping (cache a path resolution)
   * Only applies to traditional paths
   */
  async createPath(path: string, entityId: string): Promise<void> {
    const parsed = this.parser.parse(path)

    if (parsed.dimension === 'traditional') {
      await this.pathResolver.createPath(path, entityId)
    }
    // Semantic paths are not cached via createPath
  }

  /**
   * Invalidate path cache
   */
  invalidatePath(path: string, recursive = false): void {
    const parsed = this.parser.parse(path)

    if (parsed.dimension === 'traditional') {
      this.pathResolver.invalidatePath(path, recursive)
    } else {
      // Invalidate semantic cache via UnifiedCache
      const cacheKey = `semantic:${path}`
      this.cache.delete(cacheKey)
    }
  }

  /**
   * Clear all semantic caches
   * Uses UnifiedCache's clear method
   */
  invalidateSemanticCache(): void {
    this.cache.clear()
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.pathResolver.cleanup()
    this.cache.clear()
  }
}