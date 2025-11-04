/**
 * VersionStorage - Hybrid Storage for Entity Versions (v5.3.0)
 *
 * Implements content-addressable storage for entity versions:
 * - SHA-256 content hashing for deduplication
 * - Stores versions in .brainy/versions/ directory
 * - Integrates with COW commit system
 * - Space-efficient: Only stores unique content
 *
 * Storage structure:
 * .brainy/versions/
 *   ├── entities/
 *   │   └── {entityId}/
 *   │       └── {contentHash}.json  # Entity version data
 *   └── index/
 *       └── {entityId}.json         # Version index (managed by VersionIndex)
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
   * Get version storage path
   *
   * @param entityId Entity ID
   * @param contentHash Content hash
   * @returns Storage path
   */
  private getVersionPath(entityId: string, contentHash: string): string {
    return `versions/entities/${entityId}/${contentHash}.json`
  }

  /**
   * Check if content exists in storage
   *
   * @param path Storage path
   * @returns True if exists
   */
  private async contentExists(path: string): Promise<boolean> {
    try {
      // Use storage adapter's exists check if available
      const adapter = this.brain.storageAdapter
      if (adapter && typeof adapter.exists === 'function') {
        return await adapter.exists(path)
      }

      // Fallback: Try to read and catch error
      await this.readVersionData(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * Write version data to storage
   *
   * @param path Storage path
   * @param entity Entity data
   */
  private async writeVersionData(
    path: string,
    entity: NounMetadata
  ): Promise<void> {
    const adapter = this.brain.storageAdapter

    if (!adapter) {
      throw new Error('Storage adapter not available')
    }

    // Serialize entity data
    const data = JSON.stringify(entity, null, 2)

    // Write to storage using adapter
    if (typeof adapter.writeFile === 'function') {
      await adapter.writeFile(path, data)
    } else if (typeof adapter.set === 'function') {
      await adapter.set(path, data)
    } else {
      throw new Error('Storage adapter does not support write operations')
    }
  }

  /**
   * Read version data from storage
   *
   * @param path Storage path
   * @returns Entity data
   */
  private async readVersionData(path: string): Promise<NounMetadata> {
    const adapter = this.brain.storageAdapter

    if (!adapter) {
      throw new Error('Storage adapter not available')
    }

    // Read from storage using adapter
    let data: string

    if (typeof adapter.readFile === 'function') {
      data = await adapter.readFile(path)
    } else if (typeof adapter.get === 'function') {
      data = await adapter.get(path)
    } else {
      throw new Error('Storage adapter does not support read operations')
    }

    // Parse entity data
    return JSON.parse(data)
  }

  /**
   * Delete version data from storage
   *
   * @param path Storage path
   */
  private async deleteVersionData(path: string): Promise<void> {
    const adapter = this.brain.storageAdapter

    if (!adapter) {
      throw new Error('Storage adapter not available')
    }

    // Delete from storage using adapter
    if (typeof adapter.deleteFile === 'function') {
      await adapter.deleteFile(path)
    } else if (typeof adapter.delete === 'function') {
      await adapter.delete(path)
    } else {
      throw new Error('Storage adapter does not support delete operations')
    }
  }

}
