/**
 * VersionIndex - Pure Key-Value Version Storage (v6.3.0)
 *
 * Stores version metadata using simple key-value storage:
 * - Version list per entity: __version_meta_{entityId}_{branch}
 * - Content stored separately by VersionStorage
 *
 * Key Design Decisions:
 * - Versions are NOT entities (no brain.add())
 * - Versions do NOT pollute find() results
 * - Simple O(1) lookups per entity
 * - Versions per entity is typically small (10-1000)
 *
 * NO MOCKS - Production implementation
 */

import type { EntityVersion, VersionQuery } from './VersionManager.js'

/**
 * Internal storage structure for version metadata
 */
interface VersionMetadataStore {
  entityId: string
  branch: string
  versions: VersionEntry[]
}

/**
 * Individual version entry in the store
 */
interface VersionEntry {
  version: number
  timestamp: number
  contentHash: string
  commitHash?: string
  tag?: string
  description?: string
  author?: string
}

/**
 * VersionIndex - Pure key-value version metadata storage
 *
 * Uses simple JSON storage instead of creating entities.
 * This ensures versions never appear in find() results.
 */
export class VersionIndex {
  private brain: any  // Brainy instance
  private initialized: boolean = false

  constructor(brain: any) {
    this.brain = brain
  }

  /**
   * Initialize version index
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
  }

  /**
   * Add version to index
   *
   * Stores version entry in key-value storage.
   * Handles deduplication by content hash.
   *
   * @param version Version metadata to store
   */
  async addVersion(version: EntityVersion): Promise<void> {
    await this.initialize()

    const key = this.getMetaKey(version.entityId, version.branch)
    const store = await this.loadStore(key) || {
      entityId: version.entityId,
      branch: version.branch,
      versions: []
    }

    // Check for duplicate content hash (deduplication)
    const existing = store.versions.find(v => v.contentHash === version.contentHash)
    if (existing) {
      // Update tag/description if provided on duplicate save
      let updated = false
      if (version.tag && version.tag !== existing.tag) {
        existing.tag = version.tag
        updated = true
      }
      if (version.description && version.description !== existing.description) {
        existing.description = version.description
        updated = true
      }
      if (updated) {
        await this.saveStore(key, store)
      }
      return
    }

    // Add new version entry
    store.versions.push({
      version: version.version,
      timestamp: version.timestamp,
      contentHash: version.contentHash,
      commitHash: version.commitHash,
      tag: version.tag,
      description: version.description,
      author: version.author
    })

    await this.saveStore(key, store)
  }

  /**
   * Get versions for an entity
   *
   * @param query Version query with filters
   * @returns List of versions (newest first)
   */
  async getVersions(query: VersionQuery): Promise<EntityVersion[]> {
    await this.initialize()

    const branch = query.branch || this.brain.currentBranch
    const key = this.getMetaKey(query.entityId, branch)
    const store = await this.loadStore(key)
    if (!store) return []

    // Convert entries to EntityVersion format
    let versions: EntityVersion[] = store.versions.map(entry => ({
      version: entry.version,
      entityId: store.entityId,
      branch: store.branch,
      timestamp: entry.timestamp,
      contentHash: entry.contentHash,
      commitHash: entry.commitHash || '',
      tag: entry.tag,
      description: entry.description,
      author: entry.author
    }))

    // Apply filters
    if (query.tag) {
      versions = versions.filter(v => v.tag === query.tag)
    }
    if (query.startDate) {
      versions = versions.filter(v => v.timestamp >= query.startDate!)
    }
    if (query.endDate) {
      versions = versions.filter(v => v.timestamp <= query.endDate!)
    }

    // Sort newest first (highest version number first)
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
    const versions = await this.getVersions({ entityId, branch })
    return versions.find(v => v.version === version) || null
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
    const versions = await this.getVersions({ entityId, branch, tag })
    return versions[0] || null
  }

  /**
   * Get version count for entity
   *
   * @param entityId Entity ID
   * @param branch Branch name
   * @returns Number of versions
   */
  async getVersionCount(entityId: string, branch: string): Promise<number> {
    const key = this.getMetaKey(entityId, branch)
    const store = await this.loadStore(key)
    return store?.versions.length || 0
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

    const key = this.getMetaKey(entityId, branch)
    const store = await this.loadStore(key)
    if (!store) return

    const initialLength = store.versions.length
    store.versions = store.versions.filter(v => v.version !== version)

    // Only save if something was removed
    if (store.versions.length < initialLength) {
      await this.saveStore(key, store)
    }
  }

  /**
   * Clear all versions for an entity
   *
   * @param entityId Entity ID
   * @param branch Branch name
   * @returns Number of versions deleted
   */
  async clearVersions(entityId: string, branch: string): Promise<number> {
    const key = this.getMetaKey(entityId, branch)
    const store = await this.loadStore(key)
    if (!store) return 0

    const count = store.versions.length

    // Delete the store by saving null/empty
    await this.saveStore(key, { entityId, branch, versions: [] })

    return count
  }

  /**
   * Get all versioned entities (for cleanup/debugging)
   *
   * Note: This is an expensive operation that requires scanning.
   * In the simple key-value approach, we don't maintain a global index.
   * This method returns an empty array - use storage-level scanning if needed.
   *
   * @returns Empty array (not supported in simple approach)
   */
  async getVersionedEntities(): Promise<string[]> {
    // In the simple key-value approach, we don't maintain a global index
    // of all versioned entities. This would require scanning storage.
    // For most use cases, you know which entities you've versioned.
    return []
  }

  // ============= Private Helpers =============

  /**
   * Generate storage key for version metadata
   *
   * @param entityId Entity ID
   * @param branch Branch name
   * @returns Storage key
   */
  private getMetaKey(entityId: string, branch: string): string {
    return `__version_meta_${entityId}_${branch}`
  }

  /**
   * Load version store from storage
   *
   * @param key Storage key
   * @returns Version store or null
   */
  private async loadStore(key: string): Promise<VersionMetadataStore | null> {
    try {
      const store = await this.brain.storageAdapter.getMetadata(key)
      // Handle empty store
      if (!store || !store.versions) return null
      return store as VersionMetadataStore
    } catch {
      return null
    }
  }

  /**
   * Save version store to storage
   *
   * @param key Storage key
   * @param store Version store
   */
  private async saveStore(key: string, store: VersionMetadataStore): Promise<void> {
    await this.brain.storageAdapter.saveMetadata(key, store)
  }
}
