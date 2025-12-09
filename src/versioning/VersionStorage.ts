/**
 * VersionStorage - Hybrid Storage for Entity Versions (v5.3.0, v6.3.0 fix)
 *
 * Implements content-addressable storage for entity versions:
 * - SHA-256 content hashing for deduplication
 * - Uses BaseStorage.saveMetadata/getMetadata for storage (v6.3.0)
 * - Integrates with COW commit system
 * - Space-efficient: Only stores unique content
 *
 * Storage structure (v6.3.0):
 * Version content is stored using system metadata keys:
 *   __system_version_{entityId}_{contentHash}
 *
 * This integrates with BaseStorage's routing which places system keys
 * in the _system/ directory, keeping version data separate from entities.
 *
 * NO MOCKS - Production implementation
 */

import { createHash } from 'crypto'
import { BaseStorage } from '../storage/baseStorage.js'
import type { NounMetadata } from '../coreTypes.js'
import type { EntityVersion } from './VersionManager.js'

/**
 * VersionStorage - Content-addressable version storage
 */
export class VersionStorage {
  private brain: any  // Brainy instance
  private initialized: boolean = false

  constructor(brain: any) {
    this.brain = brain
  }

  /**
   * Initialize version storage directories
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Version storage uses the same storage adapter as the main database
    // Directories are created automatically by the storage adapter

    this.initialized = true
  }

  /**
   * Calculate SHA-256 hash of entity content
   *
   * Used for content-addressable storage and deduplication
   *
   * @param entity Entity to hash
   * @returns SHA-256 hash (hex string)
   */
  hashEntity(entity: NounMetadata): string {
    // Create stable JSON representation (sorted keys)
    const stableJson = this.toStableJson(entity)
    return createHash('sha256').update(stableJson).digest('hex')
  }

  /**
   * Convert entity to stable JSON (sorted keys for consistent hashing)
   */
  private toStableJson(obj: any): string {
    if (obj === null) return 'null'
    if (obj === undefined) return 'undefined'
    if (typeof obj !== 'object') return JSON.stringify(obj)

    if (Array.isArray(obj)) {
      const items = obj.map((item) => this.toStableJson(item))
      return `[${items.join(',') }]`
    }

    // Sort object keys for stable hashing
    const sortedKeys = Object.keys(obj).sort()
    const pairs = sortedKeys.map((key) => {
      const value = this.toStableJson(obj[key])
      return `"${key}":${value}`
    })

    return `{${pairs.join(',')}}`
  }

  /**
   * Save entity version to content-addressable storage
   *
   * @param version Version metadata
   * @param entity Entity data
   */
  async saveVersion(
    version: EntityVersion,
    entity: NounMetadata
  ): Promise<void> {
    await this.initialize()

    // Content-addressable path: .brainy/versions/entities/{entityId}/{contentHash}.json
    const versionPath = this.getVersionPath(
      version.entityId,
      version.contentHash
    )

    // Check if content already exists (deduplication)
    const exists = await this.contentExists(versionPath)
    if (exists) {
      // Content already stored - no need to write again
      return
    }

    // Store entity data
    await this.writeVersionData(versionPath, entity)
  }

  /**
   * Load entity version from storage
   *
   * @param version Version metadata
   * @returns Entity data or null if not found
   */
  async loadVersion(version: EntityVersion): Promise<NounMetadata | null> {
    await this.initialize()

    const versionPath = this.getVersionPath(
      version.entityId,
      version.contentHash
    )

    try {
      return await this.readVersionData(versionPath)
    } catch (error) {
      console.error(`Failed to load version ${version.version}:`, error)
      return null
    }
  }

  /**
   * Delete entity version from storage
   *
   * @param version Version to delete
   */
  async deleteVersion(version: EntityVersion): Promise<void> {
    await this.initialize()

    const versionPath = this.getVersionPath(
      version.entityId,
      version.contentHash
    )

    await this.deleteVersionData(versionPath)
  }

  /**
   * Get version storage key
   *
   * Uses __system_ prefix so BaseStorage routes to system storage (_system/ directory)
   * This keeps version data separate from entity data.
   *
   * @param entityId Entity ID
   * @param contentHash Content hash
   * @returns Storage key for version content
   */
  private getVersionPath(entityId: string, contentHash: string): string {
    // v6.3.0: Use system-prefixed key for BaseStorage.saveMetadata/getMetadata
    // BaseStorage recognizes __system_ prefix and routes to _system/ directory
    return `__system_version_${entityId}_${contentHash}`
  }

  /**
   * Check if content exists in storage
   *
   * @param key Storage key
   * @returns True if exists
   */
  private async contentExists(key: string): Promise<boolean> {
    try {
      // v6.3.0: Use getMetadata to check existence
      const adapter = this.brain.storageAdapter
      if (!adapter) return false

      const data = await adapter.getMetadata(key)
      return data !== null
    } catch {
      return false
    }
  }

  /**
   * Write version data to storage
   *
   * @param key Storage key
   * @param entity Entity data
   */
  private async writeVersionData(
    key: string,
    entity: NounMetadata
  ): Promise<void> {
    const adapter = this.brain.storageAdapter

    if (!adapter) {
      throw new Error('Storage adapter not available')
    }

    // v6.3.0: Use saveMetadata for storing version content
    // The key is system-prefixed so it routes to _system/ directory
    await adapter.saveMetadata(key, entity)
  }

  /**
   * Read version data from storage
   *
   * @param key Storage key
   * @returns Entity data
   */
  private async readVersionData(key: string): Promise<NounMetadata> {
    const adapter = this.brain.storageAdapter

    if (!adapter) {
      throw new Error('Storage adapter not available')
    }

    // v6.3.0: Use getMetadata for reading version content
    const entity = await adapter.getMetadata(key)
    if (!entity) {
      throw new Error(`Version data not found: ${key}`)
    }

    return entity
  }

  /**
   * Delete version data from storage
   *
   * Note: Version content is content-addressed and immutable.
   * Deleting the version index entry (via VersionIndex.removeVersion) is sufficient.
   * The content may be shared with other versions (same contentHash).
   *
   * v6.3.0: We don't actually delete version content to avoid breaking
   * other versions that may reference the same content hash.
   * A separate garbage collection process could clean up unreferenced content.
   *
   * @param key Storage key (unused - kept for API compatibility)
   */
  private async deleteVersionData(_key: string): Promise<void> {
    // v6.3.0: Version content is content-addressed and may be shared.
    // We don't delete it here to prevent breaking other versions.
    // The version INDEX is deleted via VersionIndex.removeVersion().
    // A GC process could clean up unreferenced content in the future.
  }

}
