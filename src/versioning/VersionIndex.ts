/**
 * VersionIndex - Fast Version Lookup Using Existing Index Infrastructure (v5.3.0)
 *
 * Integrates with Brainy's existing index system:
 * - Uses MetadataIndexManager for field indexing
 * - Leverages UnifiedCache for memory management
 * - Uses EntityIdMapper for efficient ID handling
 * - Uses ChunkManager for adaptive chunking
 * - Leverages Roaring Bitmaps for fast set operations
 *
 * Version metadata is stored as regular entities with type='_version'
 * This allows us to use existing index infrastructure without modification!
 *
 * Fields indexed:
 * - versionEntityId: Entity being versioned
 * - versionBranch: Branch version was created on
 * - versionNumber: Version number
 * - versionTag: Optional user tag
 * - versionTimestamp: Creation timestamp
 * - versionCommitHash: Commit hash
 *
 * NO MOCKS - Production implementation
 */

import { BaseStorage } from '../storage/baseStorage.js'
import type { EntityVersion } from './VersionManager.js'
import type { VersionQuery } from './VersionManager.js'

/**
 * VersionIndex - Version lookup and querying using existing indexes
 *
 * Strategy: Store version metadata as special entities with type='_version'
 * This leverages ALL existing index infrastructure automatically!
 */
export class VersionIndex {
  private brain: any  // Brainy instance
  private initialized: boolean = false

  constructor(brain: any) {
    this.brain = brain
  }

  /**
   * Initialize version index
   *
   * No special setup needed - we use existing entity storage and indexes!
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
  }

  /**
   * Add version to index
   *
   * Stores version metadata as a special entity with type='_version'
   * This automatically indexes it using existing MetadataIndexManager!
   *
   * @param version Version metadata
   */
  async addVersion(version: EntityVersion): Promise<void> {
    await this.initialize()

    // Generate unique ID for version entity
    const versionEntityId = this.getVersionEntityId(
      version.entityId,
      version.version,
      version.branch
    )

    // Store as special entity with type='state' (version is a snapshot/state)
    // This automatically gets indexed by MetadataIndexManager!
    await this.brain.saveNounMetadata(versionEntityId, {
      id: versionEntityId,
      type: 'state', // Use standard 'state' type (version = snapshot state)
      name: `Version ${version.version} of ${version.entityId}`,
      metadata: {
        // Flag to identify as version metadata
        _isVersion: true,

        // These fields are automatically indexed by MetadataIndexManager
        versionEntityId: version.entityId, // Entity being versioned
        versionBranch: version.branch, // Branch
        versionNumber: version.version, // Version number
        versionTag: version.tag, // Optional tag
        versionTimestamp: version.timestamp, // Timestamp (indexed with bucketing)
        versionCommitHash: version.commitHash, // Commit hash
        versionContentHash: version.contentHash, // Content hash
        versionAuthor: version.author, // Author
        versionDescription: version.description, // Description
        versionMetadata: version.metadata // Additional metadata
      }
    })
  }

  /**
   * Get versions for an entity
   *
   * Uses existing MetadataIndexManager to query efficiently!
   *
   * @param query Version query
   * @returns List of versions (newest first)
   */
  async getVersions(query: VersionQuery): Promise<EntityVersion[]> {
    await this.initialize()

    // Build metadata filter using existing query system
    const filters: Record<string, any> = {
      type: 'state',
      _isVersion: true,
      versionEntityId: query.entityId,
      versionBranch: query.branch
    }

    // Add optional filters
    if (query.tag) {
      filters.versionTag = query.tag
    }

    // Query using existing search infrastructure
    const results = await this.brain.searchByMetadata(filters)

    // Convert entities back to EntityVersion format
    const versions: EntityVersion[] = []
    for (const entity of results) {
      const version = this.entityToVersion(entity)
      if (version) {
        // Filter by date range if specified
        if (query.startDate && version.timestamp < query.startDate) continue
        if (query.endDate && version.timestamp > query.endDate) continue

        versions.push(version)
      }
    }

    // Sort by version number (newest first)
    versions.sort((a, b) => b.version - a.version)

    // Apply pagination
    const start = query.offset || 0
    const end = query.limit ? start + query.limit : undefined

    return versions.slice(start, end)
  }

  /**
   * Get specific version
   *
   * @param entityId Entity ID
   * @param version Version number
   * @param branch Branch name
   * @returns Version metadata or null
   */
  async getVersion(
    entityId: string,
    version: number,
    branch: string
  ): Promise<EntityVersion | null> {
    await this.initialize()

    const versionEntityId = this.getVersionEntityId(entityId, version, branch)

    const entity = await this.brain.getNounMetadata(versionEntityId)
    if (!entity) return null

    return this.entityToVersion(entity)
  }

  /**
   * Get version by tag
   *
   * @param entityId Entity ID
   * @param tag Version tag
   * @param branch Branch name
   * @returns Version metadata or null
   */
  async getVersionByTag(
    entityId: string,
    tag: string,
    branch: string
  ): Promise<EntityVersion | null> {
    await this.initialize()

    // Query using existing metadata index
    const results = await this.brain.searchByMetadata({
      type: 'state',
      _isVersion: true,
      versionEntityId: entityId,
      versionBranch: branch,
      versionTag: tag
    })

    if (results.length === 0) return null

    // Return first match (tags should be unique per entity/branch)
    return this.entityToVersion(results[0])
  }

  /**
   * Get version count for entity
   *
   * @param entityId Entity ID
   * @param branch Branch name
   * @returns Number of versions
   */
  async getVersionCount(entityId: string, branch: string): Promise<number> {
    await this.initialize()

    // Use existing search infrastructure
    const results = await this.brain.searchByMetadata({
      type: 'state',
      _isVersion: true,
      versionEntityId: entityId,
      versionBranch: branch
    })

    return results.length
  }

  /**
   * Remove version from index
   *
   * @param entityId Entity ID
   * @param version Version number
   * @param branch Branch name
   */
  async removeVersion(
    entityId: string,
    version: number,
    branch: string
  ): Promise<void> {
    await this.initialize()

    const versionEntityId = this.getVersionEntityId(entityId, version, branch)

    // Delete version entity (automatically removed from indexes)
    await this.brain.deleteNounMetadata(versionEntityId)
  }

  /**
   * Convert entity to EntityVersion format
   *
   * @param entity Entity from storage
   * @returns EntityVersion or null if invalid
   */
  private entityToVersion(entity: any): EntityVersion | null {
    if (!entity || !entity.metadata) return null

    const m = entity.metadata

    if (
      !m.versionEntityId ||
      !m.versionBranch ||
      m.versionNumber === undefined ||
      !m.versionCommitHash ||
      !m.versionContentHash ||
      !m.versionTimestamp
    ) {
      return null
    }

    return {
      version: m.versionNumber,
      entityId: m.versionEntityId,
      branch: m.versionBranch,
      commitHash: m.versionCommitHash,
      timestamp: m.versionTimestamp,
      contentHash: m.versionContentHash,
      tag: m.versionTag,
      description: m.versionDescription,
      author: m.versionAuthor,
      metadata: m.versionMetadata
    }
  }

  /**
   * Generate unique ID for version entity
   *
   * Format: _version:{entityId}:{version}:{branch}
   *
   * @param entityId Entity ID
   * @param version Version number
   * @param branch Branch name
   * @returns Version entity ID
   */
  private getVersionEntityId(
    entityId: string,
    version: number,
    branch: string
  ): string {
    return `_version:${entityId}:${version}:${branch}`
  }

  /**
   * Get all versioned entities (for cleanup/debugging)
   *
   * @returns List of entity IDs that have versions
   */
  async getVersionedEntities(): Promise<string[]> {
    await this.initialize()

    // Query all version entities
    const results = await this.brain.searchByMetadata({
      type: 'state',
      _isVersion: true
    })

    // Extract unique entity IDs
    const entityIds = new Set<string>()
    for (const entity of results) {
      const version = this.entityToVersion(entity)
      if (version) {
        entityIds.add(version.entityId)
      }
    }

    return Array.from(entityIds)
  }

  /**
   * Clear all versions for an entity
   *
   * @param entityId Entity ID
   * @param branch Branch name
   * @returns Number of versions deleted
   */
  async clearVersions(entityId: string, branch: string): Promise<number> {
    await this.initialize()

    const versions = await this.getVersions({ entityId, branch })

    for (const version of versions) {
      await this.removeVersion(entityId, version.version, branch)
    }

    return versions.length
  }
}
