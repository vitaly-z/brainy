/**
 * VersionManager - Entity-Level Versioning Engine (v5.3.0)
 *
 * Provides entity-level version control with:
 * - save() - Create entity version
 * - restore() - Restore entity to specific version
 * - list() - List all versions of an entity
 * - compare() - Deep diff between versions
 * - prune() - Remove old versions (retention policies)
 *
 * Architecture:
 * - Hybrid storage: COW commits for full snapshots + version index for fast queries
 * - Content-addressable: SHA-256 hashing for deduplication
 * - Space-efficient: Only stores changed data
 * - Branch-aware: Versions tied to current branch
 *
 * NO MOCKS - Production implementation
 */

import { BaseStorage } from '../storage/baseStorage.js'
import { VersionStorage } from './VersionStorage.js'
import { VersionIndex } from './VersionIndex.js'
import { VersionDiff, compareEntityVersions } from './VersionDiff.js'
import type { NounMetadata } from '../coreTypes.js'

export interface EntityVersion {
  /** Version number (1-indexed, sequential per entity) */
  version: number

  /** Entity ID */
  entityId: string

  /** Branch this version was created on */
  branch: string

  /** Commit hash containing this version */
  commitHash: string

  /** Timestamp of version creation */
  timestamp: number

  /** Optional user-provided tag (e.g., 'v1.0', 'before-refactor') */
  tag?: string

  /** Optional description */
  description?: string

  /** Content hash (SHA-256 of entity data) */
  contentHash: string

  /** Author of this version */
  author?: string

  /** Metadata about the version */
  metadata?: Record<string, any>
}

export interface VersionQuery {
  /** Entity ID to query versions for */
  entityId: string

  /** Optional: Filter by branch (default: current branch) */
  branch?: string

  /** Optional: Limit number of versions returned */
  limit?: number

  /** Optional: Skip first N versions */
  offset?: number

  /** Optional: Filter by tag */
  tag?: string

  /** Optional: Filter by date range */
  startDate?: number
  endDate?: number
}

export interface SaveVersionOptions {
  /** Optional tag for this version (e.g., 'v1.0', 'milestone-1') */
  tag?: string

  /** Optional description */
  description?: string

  /** Optional author name */
  author?: string

  /** Optional custom metadata */
  metadata?: Record<string, any>

  /** Optional: Create commit automatically (default: false) */
  createCommit?: boolean

  /** Optional: Commit message if createCommit is true */
  commitMessage?: string
}

export interface RestoreOptions {
  /** Optional: Create version before restoring (for undo) */
  createSnapshot?: boolean

  /** Optional: Tag for snapshot before restore */
  snapshotTag?: string
}

export interface PruneOptions {
  /** Keep N most recent versions (required if keepVersions not set) */
  keepRecent?: number

  /** Keep versions newer than timestamp (optional) */
  keepAfter?: number

  /** Keep tagged versions (default: true) */
  keepTagged?: boolean

  /** Dry run - don't actually delete (default: false) */
  dryRun?: boolean
}

/**
 * VersionManager - Core versioning engine
 */
export class VersionManager {
  private brain: any  // Brainy instance
  private versionStorage: VersionStorage
  private versionIndex: VersionIndex
  private initialized: boolean = false

  constructor(brain: any) {
    this.brain = brain
    this.versionStorage = new VersionStorage(brain)
    this.versionIndex = new VersionIndex(brain)
  }

  /**
   * Initialize versioning system (lazy)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.versionStorage.initialize()
    await this.versionIndex.initialize()

    this.initialized = true
  }

  /**
   * Save a version of an entity
   *
   * Creates a version snapshot of the current entity state.
   * If createCommit is true, also creates a commit containing this version.
   *
   * @param entityId Entity ID to version
   * @param options Save options
   * @returns Created version metadata
   */
  async save(
    entityId: string,
    options: SaveVersionOptions = {}
  ): Promise<EntityVersion> {
    await this.initialize()

    // Get current entity state
    const entity = await this.brain.getNounMetadata(entityId)
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`)
    }

    // Get current branch
    const currentBranch = this.brain.currentBranch

    // Get next version number
    const existingVersions = await this.versionIndex.getVersions({
      entityId,
      branch: currentBranch
    })
    const nextVersion = existingVersions.length + 1

    // Calculate content hash
    const contentHash = this.versionStorage.hashEntity(entity)

    // Check for duplicate (same content as last version)
    if (existingVersions.length > 0) {
      const lastVersion = existingVersions[existingVersions.length - 1]
      if (lastVersion.contentHash === contentHash) {
        // Content unchanged - return last version instead of creating duplicate
        return lastVersion
      }
    }

    // Create commit if requested
    let commitHash: string
    if (options.createCommit) {
      const commitMessage =
        options.commitMessage || `Version ${nextVersion} of entity ${entityId}`

      // Use brain's commit method (note: single options object)
      await this.brain.commit({
        message: commitMessage,
        author: options.author,
        metadata: {
          versionedEntity: entityId,
          version: nextVersion,
          ...options.metadata
        }
      })

      // Get the commit hash that was just created
      const refManager = this.brain.refManager
      const ref = await refManager.getRef(currentBranch)
      commitHash = ref.commitHash
    } else {
      // Use current HEAD commit
      const refManager = this.brain.refManager
      const ref = await refManager.getRef(currentBranch)
      if (!ref) {
        throw new Error(
          `No commit exists on branch ${currentBranch}. Create a commit first or use createCommit: true`
        )
      }
      commitHash = ref.commitHash
    }

    // Create version metadata
    const version: EntityVersion = {
      version: nextVersion,
      entityId,
      branch: currentBranch,
      commitHash,
      timestamp: Date.now(),
      contentHash,
      tag: options.tag,
      description: options.description,
      author: options.author,
      metadata: options.metadata
    }

    // Store version
    await this.versionStorage.saveVersion(version, entity)
    await this.versionIndex.addVersion(version)

    return version
  }

  /**
   * Get all versions of an entity
   *
   * @param entityId Entity ID
   * @param query Optional query filters
   * @returns List of versions (newest first)
   */
  async list(
    entityId: string,
    query: Partial<VersionQuery> = {}
  ): Promise<EntityVersion[]> {
    await this.initialize()

    const currentBranch = this.brain.currentBranch

    return this.versionIndex.getVersions({
      entityId,
      branch: query.branch || currentBranch,
      limit: query.limit,
      offset: query.offset,
      tag: query.tag,
      startDate: query.startDate,
      endDate: query.endDate
    })
  }

  /**
   * Get a specific version of an entity
   *
   * @param entityId Entity ID
   * @param version Version number (1-indexed)
   * @returns Version metadata
   */
  async getVersion(
    entityId: string,
    version: number
  ): Promise<EntityVersion | null> {
    await this.initialize()

    const currentBranch = this.brain.currentBranch
    return this.versionIndex.getVersion(entityId, version, currentBranch)
  }

  /**
   * Get version by tag
   *
   * @param entityId Entity ID
   * @param tag Version tag
   * @returns Version metadata
   */
  async getVersionByTag(
    entityId: string,
    tag: string
  ): Promise<EntityVersion | null> {
    await this.initialize()

    const currentBranch = this.brain.currentBranch
    return this.versionIndex.getVersionByTag(entityId, tag, currentBranch)
  }

  /**
   * Restore entity to a specific version
   *
   * Overwrites current entity state with the specified version.
   * Optionally creates a snapshot before restoring for undo capability.
   *
   * @param entityId Entity ID
   * @param version Version number or tag
   * @param options Restore options
   * @returns Restored version metadata
   */
  async restore(
    entityId: string,
    version: number | string,
    options: RestoreOptions = {}
  ): Promise<EntityVersion> {
    await this.initialize()

    // Create snapshot before restoring (for undo)
    if (options.createSnapshot) {
      await this.save(entityId, {
        tag: options.snapshotTag || 'before-restore',
        description: `Snapshot before restoring to version ${version}`,
        metadata: { restoringTo: version }
      })
    }

    // Get target version
    let targetVersion: EntityVersion | null
    if (typeof version === 'number') {
      targetVersion = await this.getVersion(entityId, version)
    } else {
      targetVersion = await this.getVersionByTag(entityId, version)
    }

    if (!targetVersion) {
      throw new Error(
        `Version ${version} not found for entity ${entityId}`
      )
    }

    // Load versioned entity data
    const versionedEntity = await this.versionStorage.loadVersion(targetVersion)
    if (!versionedEntity) {
      throw new Error(
        `Version data not found for entity ${entityId} version ${version}`
      )
    }

    // Restore entity in storage
    await this.brain.saveNounMetadata(entityId, versionedEntity)

    return targetVersion
  }

  /**
   * Compare two versions of an entity
   *
   * @param entityId Entity ID
   * @param fromVersion Version number or tag (older)
   * @param toVersion Version number or tag (newer)
   * @returns Diff between versions
   */
  async compare(
    entityId: string,
    fromVersion: number | string,
    toVersion: number | string
  ): Promise<VersionDiff> {
    await this.initialize()

    // Get versions
    const fromVer =
      typeof fromVersion === 'number'
        ? await this.getVersion(entityId, fromVersion)
        : await this.getVersionByTag(entityId, fromVersion)

    const toVer =
      typeof toVersion === 'number'
        ? await this.getVersion(entityId, toVersion)
        : await this.getVersionByTag(entityId, toVersion)

    if (!fromVer) {
      throw new Error(
        `Version ${fromVersion} not found for entity ${entityId}`
      )
    }
    if (!toVer) {
      throw new Error(
        `Version ${toVersion} not found for entity ${entityId}`
      )
    }

    // Load entity data
    const fromEntity = await this.versionStorage.loadVersion(fromVer)
    const toEntity = await this.versionStorage.loadVersion(toVer)

    if (!fromEntity || !toEntity) {
      throw new Error('Failed to load version data for comparison')
    }

    // Compare versions
    return compareEntityVersions(fromEntity, toEntity, {
      fromVersion: fromVer.version,
      toVersion: toVer.version,
      entityId
    })
  }

  /**
   * Prune old versions based on retention policy
   *
   * @param entityId Entity ID (or '*' for all entities)
   * @param options Prune options
   * @returns Number of versions deleted
   */
  async prune(
    entityId: string,
    options: PruneOptions
  ): Promise<{ deleted: number; kept: number }> {
    await this.initialize()

    if (!options.keepRecent && !options.keepAfter) {
      throw new Error(
        'Must specify either keepRecent or keepAfter in prune options'
      )
    }

    const currentBranch = this.brain.currentBranch

    // Get all versions
    const versions = await this.versionIndex.getVersions({
      entityId,
      branch: currentBranch
    })

    // Determine which versions to keep
    const toKeep = new Set<number>()
    const toDelete: EntityVersion[] = []

    // Keep recent versions
    if (options.keepRecent) {
      const recentVersions = versions.slice(0, options.keepRecent)
      recentVersions.forEach((v) => toKeep.add(v.version))
    }

    // Keep versions after timestamp
    if (options.keepAfter) {
      versions
        .filter((v) => v.timestamp >= options.keepAfter!)
        .forEach((v) => toKeep.add(v.version))
    }

    // Keep tagged versions
    if (options.keepTagged !== false) {
      versions
        .filter((v) => v.tag !== undefined)
        .forEach((v) => toKeep.add(v.version))
    }

    // Build delete list
    for (const version of versions) {
      if (!toKeep.has(version.version)) {
        toDelete.push(version)
      }
    }

    // Dry run - just return counts
    if (options.dryRun) {
      return {
        deleted: toDelete.length,
        kept: toKeep.size
      }
    }

    // Delete versions
    for (const version of toDelete) {
      await this.versionStorage.deleteVersion(version)
      await this.versionIndex.removeVersion(
        entityId,
        version.version,
        currentBranch
      )
    }

    return {
      deleted: toDelete.length,
      kept: toKeep.size
    }
  }

  /**
   * Get version count for an entity
   *
   * @param entityId Entity ID
   * @returns Number of versions
   */
  async getVersionCount(entityId: string): Promise<number> {
    await this.initialize()

    const currentBranch = this.brain.currentBranch
    return this.versionIndex.getVersionCount(entityId, currentBranch)
  }

  /**
   * Check if entity has versions
   *
   * @param entityId Entity ID
   * @returns True if entity has versions
   */
  async hasVersions(entityId: string): Promise<boolean> {
    const count = await this.getVersionCount(entityId)
    return count > 0
  }

  /**
   * Get latest version of an entity
   *
   * @param entityId Entity ID
   * @returns Latest version metadata or null
   */
  async getLatest(entityId: string): Promise<EntityVersion | null> {
    await this.initialize()

    const versions = await this.list(entityId, { limit: 1 })
    return versions[0] || null
  }

  /**
   * Clear all versions for an entity
   *
   * @param entityId Entity ID
   * @returns Number of versions deleted
   */
  async clear(entityId: string): Promise<number> {
    await this.initialize()

    const result = await this.prune(entityId, {
      keepRecent: 0,
      keepTagged: false
    })

    return result.deleted
  }
}
