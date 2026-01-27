/**
 * VersioningAPI - Public API for Entity Versioning
 *
 * User-friendly wrapper around VersionManager with:
 * - Clean, simple API
 * - Smart defaults
 * - Error handling
 * - Type safety
 *
 * Usage:
 *   const version = await brain.versions.save('entity-123', { tag: 'v1.0' })
 *   const versions = await brain.versions.list('entity-123')
 *   await brain.versions.restore('entity-123', 5)
 *   const diff = await brain.versions.compare('entity-123', 2, 5)
 *
 * NO MOCKS - Production implementation
 */

import { VersionManager } from './VersionManager.js'
import type {
  EntityVersion,
  SaveVersionOptions,
  RestoreOptions,
  PruneOptions,
  VersionQuery
} from './VersionManager.js'
import type { VersionDiff, DiffOptions } from './VersionDiff.js'
import type { BaseStorage } from '../storage/baseStorage.js'

/**
 * VersioningAPI - User-friendly versioning interface
 */
export class VersioningAPI {
  private manager: VersionManager
  private brain: any // Brainy instance

  constructor(brain: any) {
    this.brain = brain
    this.manager = new VersionManager(brain as BaseStorage)
  }

  /**
   * Save current state of entity as a new version
   *
   * Creates a version snapshot of the current entity state.
   * Automatically handles deduplication - if content hasn't changed,
   * returns the last version instead of creating a duplicate.
   *
   * @param entityId Entity ID to version
   * @param options Save options
   * @returns Created (or existing) version metadata
   *
   * @example
   * ```typescript
   * // Simple save
   * const version = await brain.versions.save('user-123')
   *
   * // Save with tag and description
   * const version = await brain.versions.save('user-123', {
   *   tag: 'v1.0',
   *   description: 'Initial release',
   *   author: 'alice'
   * })
   *
   * // Save and create commit
   * const version = await brain.versions.save('user-123', {
   *   tag: 'milestone-1',
   *   createCommit: true,
   *   commitMessage: 'Milestone 1 complete'
   * })
   * ```
   */
  async save(
    entityId: string,
    options: SaveVersionOptions = {}
  ): Promise<EntityVersion> {
    return this.manager.save(entityId, options)
  }

  /**
   * List all versions of an entity
   *
   * Returns versions sorted by version number (newest first).
   * Supports filtering by tag, date range, and pagination.
   *
   * @param entityId Entity ID
   * @param options Query options
   * @returns List of versions (newest first)
   *
   * @example
   * ```typescript
   * // Get all versions
   * const versions = await brain.versions.list('user-123')
   *
   * // Get last 10 versions
   * const recent = await brain.versions.list('user-123', { limit: 10 })
   *
   * // Get tagged versions
   * const tagged = await brain.versions.list('user-123', { tag: 'v*' })
   *
   * // Get versions from last 30 days
   * const recent = await brain.versions.list('user-123', {
   *   startDate: Date.now() - 30 * 24 * 60 * 60 * 1000
   * })
   * ```
   */
  async list(
    entityId: string,
    options: Partial<VersionQuery> = {}
  ): Promise<EntityVersion[]> {
    return this.manager.list(entityId, options)
  }

  /**
   * Get specific version of an entity
   *
   * @param entityId Entity ID
   * @param version Version number (1-indexed)
   * @returns Version metadata or null if not found
   *
   * @example
   * ```typescript
   * const version = await brain.versions.getVersion('user-123', 5)
   * if (version) {
   *   console.log(`Version ${version.version} created at ${new Date(version.timestamp)}`)
   * }
   * ```
   */
  async getVersion(
    entityId: string,
    version: number
  ): Promise<EntityVersion | null> {
    return this.manager.getVersion(entityId, version)
  }

  /**
   * Get version by tag
   *
   * @param entityId Entity ID
   * @param tag Version tag
   * @returns Version metadata or null if not found
   *
   * @example
   * ```typescript
   * const version = await brain.versions.getVersionByTag('user-123', 'v1.0')
   * ```
   */
  async getVersionByTag(
    entityId: string,
    tag: string
  ): Promise<EntityVersion | null> {
    return this.manager.getVersionByTag(entityId, tag)
  }

  /**
   * Get latest version of an entity
   *
   * @param entityId Entity ID
   * @returns Latest version or null if no versions exist
   *
   * @example
   * ```typescript
   * const latest = await brain.versions.getLatest('user-123')
   * ```
   */
  async getLatest(entityId: string): Promise<EntityVersion | null> {
    return this.manager.getLatest(entityId)
  }

  /**
   * Get version content without restoring
   *
   * Allows you to preview version data without modifying the current entity.
   *
   * @param entityId Entity ID
   * @param version Version number or tag
   * @returns Version content
   *
   * @example
   * ```typescript
   * // Preview version 5 without restoring
   * const oldData = await brain.versions.getContent('user-123', 5)
   * console.log('Version 5 had name:', oldData.name)
   *
   * // Compare with current
   * const current = await brain.getNounMetadata('user-123')
   * console.log('Current name:', current.name)
   * ```
   */
  async getContent(
    entityId: string,
    version: number | string
  ): Promise<any> {
    // Get version metadata
    let versionMeta: EntityVersion | null
    if (typeof version === 'number') {
      versionMeta = await this.manager.getVersion(entityId, version)
    } else {
      versionMeta = await this.manager.getVersionByTag(entityId, version)
    }

    if (!versionMeta) {
      throw new Error(
        `Version ${version} not found for entity ${entityId}`
      )
    }

    // Load version content
    const versionStorage = (this.manager as any).versionStorage
    const content = await versionStorage.loadVersion(versionMeta)

    if (!content) {
      throw new Error(
        `Version content not found for entity ${entityId} version ${version}`
      )
    }

    return content
  }

  /**
   * Restore entity to a specific version
   *
   * Overwrites current entity state with the specified version.
   * Optionally creates a snapshot before restoring for undo capability.
   *
   * @param entityId Entity ID
   * @param version Version number or tag to restore to
   * @param options Restore options
   * @returns Restored version metadata
   *
   * @example
   * ```typescript
   * // Simple restore
   * await brain.versions.restore('user-123', 5)
   *
   * // Restore with safety snapshot
   * await brain.versions.restore('user-123', 5, {
   *   createSnapshot: true,
   *   snapshotTag: 'before-restore'
   * })
   *
   * // Restore by tag
   * await brain.versions.restore('user-123', 'v1.0')
   * ```
   */
  async restore(
    entityId: string,
    version: number | string,
    options: RestoreOptions = {}
  ): Promise<EntityVersion> {
    return this.manager.restore(entityId, version, options)
  }

  /**
   * Compare two versions of an entity
   *
   * Generates a deep diff showing added, removed, modified, and type-changed fields.
   *
   * @param entityId Entity ID
   * @param fromVersion Version number or tag (older)
   * @param toVersion Version number or tag (newer)
   * @returns Diff between versions
   *
   * @example
   * ```typescript
   * // Compare version 2 to version 5
   * const diff = await brain.versions.compare('user-123', 2, 5)
   *
   * console.log(`Added fields: ${diff.added.length}`)
   * console.log(`Removed fields: ${diff.removed.length}`)
   * console.log(`Modified fields: ${diff.modified.length}`)
   *
   * // Print human-readable diff
   * import { formatDiff } from './VersionDiff.js'
   * console.log(formatDiff(diff))
   * ```
   */
  async compare(
    entityId: string,
    fromVersion: number | string,
    toVersion: number | string
  ): Promise<VersionDiff> {
    return this.manager.compare(entityId, fromVersion, toVersion)
  }

  /**
   * Prune old versions based on retention policy
   *
   * Removes old versions while preserving recent and tagged versions.
   * Use dryRun to preview what would be deleted without actually deleting.
   *
   * @param entityId Entity ID (or '*' for all entities - NOT IMPLEMENTED YET)
   * @param options Prune options
   * @returns Count of deleted and kept versions
   *
   * @example
   * ```typescript
   * // Keep last 10 versions, delete rest
   * const result = await brain.versions.prune('user-123', {
   *   keepRecent: 10
   * })
   * console.log(`Deleted ${result.deleted} versions`)
   *
   * // Keep last 30 days, preserve tagged versions
   * const result = await brain.versions.prune('user-123', {
   *   keepAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
   *   keepTagged: true
   * })
   *
   * // Dry run - see what would be deleted
   * const result = await brain.versions.prune('user-123', {
   *   keepRecent: 5,
   *   dryRun: true
   * })
   * console.log(`Would delete ${result.deleted} versions`)
   * ```
   */
  async prune(
    entityId: string,
    options: PruneOptions
  ): Promise<{ deleted: number; kept: number }> {
    return this.manager.prune(entityId, options)
  }

  /**
   * Get version count for an entity
   *
   * @param entityId Entity ID
   * @returns Number of versions
   *
   * @example
   * ```typescript
   * const count = await brain.versions.count('user-123')
   * console.log(`Entity has ${count} versions`)
   * ```
   */
  async count(entityId: string): Promise<number> {
    return this.manager.getVersionCount(entityId)
  }

  /**
   * Check if entity has any versions
   *
   * @param entityId Entity ID
   * @returns True if entity has versions
   *
   * @example
   * ```typescript
   * if (await brain.versions.hasVersions('user-123')) {
   *   console.log('Entity is versioned')
   * }
   * ```
   */
  async hasVersions(entityId: string): Promise<boolean> {
    return this.manager.hasVersions(entityId)
  }

  /**
   * Clear all versions for an entity
   *
   * WARNING: This permanently deletes all version history!
   *
   * @param entityId Entity ID
   * @returns Number of versions deleted
   *
   * @example
   * ```typescript
   * const deleted = await brain.versions.clear('user-123')
   * console.log(`Deleted ${deleted} versions`)
   * ```
   */
  async clear(entityId: string): Promise<number> {
    return this.manager.clear(entityId)
  }

  // ===== CONVENIENCE METHODS =====

  /**
   * Quick save with auto-generated tag
   *
   * Generates tag in format: 'auto-{timestamp}'
   *
   * @param entityId Entity ID
   * @param description Optional description
   * @returns Created version
   */
  async quickSave(
    entityId: string,
    description?: string
  ): Promise<EntityVersion> {
    return this.save(entityId, {
      tag: `auto-${Date.now()}`,
      description
    })
  }

  /**
   * Undo last change (restore to previous version)
   *
   * Safely restores to previous version with automatic snapshot.
   *
   * @param entityId Entity ID
   * @returns Restored version metadata
   */
  async undo(entityId: string): Promise<EntityVersion | null> {
    const versions = await this.list(entityId, { limit: 2 })

    if (versions.length < 2) {
      // No previous version to restore to
      return null
    }

    const previousVersion = versions[1] // Second most recent

    return this.restore(entityId, previousVersion.version, {
      createSnapshot: true,
      snapshotTag: 'before-undo'
    })
  }

  /**
   * Get version history summary
   *
   * @param entityId Entity ID
   * @returns Summary statistics
   */
  async history(entityId: string): Promise<{
    total: number
    oldest?: EntityVersion
    newest?: EntityVersion
    tagged: number
    branches: string[]
  }> {
    const versions = await this.list(entityId)

    const tagged = versions.filter((v) => v.tag !== undefined).length
    const branches = [...new Set(versions.map((v) => v.branch))]

    return {
      total: versions.length,
      oldest: versions[versions.length - 1],
      newest: versions[0],
      tagged,
      branches
    }
  }

  /**
   * Revert to previous version (alias for undo with better semantics)
   *
   * Restores entity to the previous version with automatic safety snapshot.
   *
   * @param entityId Entity ID
   * @returns Restored version or null if not possible
   *
   * @example
   * ```typescript
   * // Made a mistake? Revert!
   * await brain.update('user-123', { name: 'Wrong Name' })
   * await brain.versions.revert('user-123')  // Back to previous state
   * ```
   */
  async revert(entityId: string): Promise<EntityVersion | null> {
    return this.undo(entityId)
  }

  /**
   * Tag an existing version
   *
   * Updates the tag of an existing version.
   * Note: This creates a new version with the tag, not modifying the existing one.
   *
   * @param entityId Entity ID
   * @param version Version number
   * @param tag New tag
   * @returns Updated version
   */
  async tag(
    entityId: string,
    version: number,
    tag: string
  ): Promise<EntityVersion> {
    // Get the version
    const existingVersion = await this.getVersion(entityId, version)
    if (!existingVersion) {
      throw new Error(`Version ${version} not found for entity ${entityId}`)
    }

    // Create new version with tag
    // Note: This is a limitation - we can't modify existing versions
    // because they're immutable. Instead, we create a new version.
    return this.save(entityId, {
      tag,
      description: `Tagged version ${version} as ${tag}`,
      metadata: { originalVersion: version }
    })
  }

  /**
   * Get diff between entity's current state and a version
   *
   * @param entityId Entity ID
   * @param version Version to compare against
   * @returns Diff showing changes
   */
  async diffWithCurrent(
    entityId: string,
    version: number | string
  ): Promise<VersionDiff> {
    // Save current state (will be deduplicated if unchanged)
    const currentVersion = await this.save(entityId, {
      tag: 'temp-compare',
      description: 'Temporary version for comparison'
    })

    // Compare
    return this.compare(entityId, version, currentVersion.version)
  }
}
