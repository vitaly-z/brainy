/**
 * Versioning Augmentation (v5.3.0)
 *
 * Provides automatic entity versioning with configurable policies:
 * - Auto-save on update()
 * - Entity filtering
 * - Retention policies
 * - Event hooks
 *
 * NO MOCKS - Production implementation
 */

import { BaseAugmentation } from './brainyAugmentation.js'
import { AugmentationManifest } from './manifest.js'
import type { VersioningAPI } from '../versioning/VersioningAPI.js'
import type { SaveVersionOptions } from '../versioning/VersionManager.js'

export interface VersioningAugmentationConfig {
  /** Enable auto-versioning */
  enabled?: boolean

  /** Auto-save on update() operations */
  onUpdate?: boolean

  /** Auto-save on add() operations (rarely needed) */
  onAdd?: boolean

  /** Entity ID patterns to version (glob patterns) */
  entities?: string[]

  /** Entity ID patterns to exclude (glob patterns) */
  excludeEntities?: string[]

  /** Entity types to version */
  types?: string[]

  /** Entity types to exclude */
  excludeTypes?: string[]

  /** Retention policy: Keep N recent versions per entity */
  keepRecent?: number

  /** Retention policy: Keep versions newer than timestamp */
  keepAfter?: number

  /** Retention policy: Keep tagged versions (default: true) */
  keepTagged?: boolean

  /** Tag prefix for auto-generated versions (default: 'auto-') */
  tagPrefix?: string

  /** Auto-prune old versions after save */
  autoPrune?: boolean

  /** Prune interval in milliseconds (default: 1 hour) */
  pruneInterval?: number

  /** Event hooks */
  hooks?: {
    /** Called before saving version */
    beforeSave?: (entityId: string, options: SaveVersionOptions) => Promise<SaveVersionOptions | null>

    /** Called after saving version */
    afterSave?: (entityId: string, version: any) => Promise<void>

    /** Called before pruning */
    beforePrune?: (entityId: string) => Promise<boolean>

    /** Called after pruning */
    afterPrune?: (entityId: string, deleted: number) => Promise<void>
  }
}

/**
 * Versioning Augmentation
 *
 * Automatically versions entities based on configurable policies.
 */
export class VersioningAugmentation extends BaseAugmentation {
  readonly name = 'versioning'
  readonly timing = 'after' as const  // Run after operations complete
  readonly metadata = 'readonly' as const
  operations = ['update', 'add'] as any  // Version on update/add
  readonly priority = 50  // Medium priority

  // Augmentation metadata
  readonly category = 'core' as const
  readonly description = 'Automatic entity versioning with configurable retention policies'

  private versioningAPI?: VersioningAPI
  private brain?: any  // Brainy instance for entity fetching
  private pruneTimer?: NodeJS.Timeout
  private versionCount = 0

  constructor(config: VersioningAugmentationConfig = {}) {
    super(config)

    // Merge with defaults
    this.config = {
      enabled: config.enabled ?? true,
      onUpdate: config.onUpdate ?? true,
      onAdd: config.onAdd ?? false,
      entities: config.entities ?? ['*'],  // Version all entities by default
      excludeEntities: config.excludeEntities ?? ['_version:*'],  // Exclude version metadata entities
      types: config.types ?? [],  // Empty = all types
      excludeTypes: config.excludeTypes ?? [],  // No need to exclude types (versions use 'state' type)
      keepRecent: config.keepRecent ?? 10,
      keepTagged: config.keepTagged ?? true,
      tagPrefix: config.tagPrefix ?? 'auto-',
      autoPrune: config.autoPrune ?? true,
      pruneInterval: config.pruneInterval ?? 60 * 60 * 1000,  // 1 hour
      hooks: config.hooks ?? {}
    }
  }

  getManifest(): AugmentationManifest {
    return {
      id: 'versioning',
      name: 'Entity Versioning',
      version: '5.3.0',
      description: 'Automatic entity versioning with retention policies',
      longDescription: 'Provides automatic versioning of entities on update/add operations with configurable retention policies, entity filtering, and event hooks.',
      category: 'storage',
      configSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Enable automatic versioning'
          },
          onUpdate: {
            type: 'boolean',
            default: true,
            description: 'Auto-save version on update()'
          },
          onAdd: {
            type: 'boolean',
            default: false,
            description: 'Auto-save version on add()'
          },
          entities: {
            type: 'array',
            items: { type: 'string' },
            default: ['*'],
            description: 'Entity ID patterns to version (glob patterns)'
          },
          excludeEntities: {
            type: 'array',
            items: { type: 'string' },
            default: ['_version:*'],
            description: 'Entity ID patterns to exclude (version metadata IDs start with _version:)'
          },
          types: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description: 'Entity types to version (empty = all)'
          },
          excludeTypes: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description: 'Entity types to exclude (versions use standard state type)'
          },
          keepRecent: {
            type: 'number',
            default: 10,
            minimum: 1,
            description: 'Keep N recent versions per entity'
          },
          keepTagged: {
            type: 'boolean',
            default: true,
            description: 'Keep tagged versions during pruning'
          },
          tagPrefix: {
            type: 'string',
            default: 'auto-',
            description: 'Tag prefix for auto-generated versions'
          },
          autoPrune: {
            type: 'boolean',
            default: true,
            description: 'Automatically prune old versions'
          },
          pruneInterval: {
            type: 'number',
            default: 3600000,
            description: 'Prune interval in milliseconds (default: 1 hour)'
          }
        }
      },
      configDefaults: {
        enabled: true,
        onUpdate: true,
        onAdd: false,
        entities: ['*'],
        excludeEntities: ['_version:*'],
        types: [],
        excludeTypes: [],
        keepRecent: 10,
        keepTagged: true,
        tagPrefix: 'auto-',
        autoPrune: true,
        pruneInterval: 3600000
      },
      minBrainyVersion: '5.3.0',
      keywords: ['versioning', 'history', 'audit', 'backup'],
      documentation: 'https://docs.brainy.dev/versioning',
      status: 'stable',
      performance: {
        memoryUsage: 'low',
        cpuUsage: 'low',
        networkUsage: 'none'
      },
      features: [
        'auto-versioning',
        'retention-policies',
        'entity-filtering',
        'event-hooks'
      ],
      enhancedOperations: ['update', 'add'],
      metrics: [
        {
          name: 'versions_created',
          type: 'counter',
          description: 'Total versions created by augmentation'
        },
        {
          name: 'versions_pruned',
          type: 'counter',
          description: 'Total versions pruned by retention policies'
        }
      ]
    }
  }

  async onAttach(brain: any): Promise<void> {
    // Store brain instance for entity fetching
    this.brain = brain

    // Get VersioningAPI instance
    this.versioningAPI = brain.versions

    // Start auto-prune timer if enabled
    if (this.config.autoPrune && this.config.pruneInterval) {
      this.startAutoPrune()
    }
  }

  async onDetach(): Promise<void> {
    // Stop auto-prune timer
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer)
      this.pruneTimer = undefined
    }
  }

  /**
   * Execute method (required by BaseAugmentation)
   */
  async execute(operation: string, params: any[], context: any): Promise<any> {
    // Versioning augmentation only runs in 'after' mode
    // Actual logic is in after() method
    return context.originalResult
  }

  /**
   * After operation hook - auto-save versions
   */
  async after(operation: string, params: any[], result: any): Promise<any> {
    if (!this.config.enabled || !this.versioningAPI) {
      return result
    }

    // Check if we should version this operation
    if (operation === 'update' && !this.config.onUpdate) {
      return result
    }
    if (operation === 'add' && !this.config.onAdd) {
      return result
    }

    // Extract entity ID from params
    const entityId = this.extractEntityId(operation, params)
    if (!entityId) {
      return result
    }

    // Check if entity should be versioned
    if (!(await this.shouldVersionEntity(entityId))) {
      return result
    }

    try {
      // Prepare save options
      let saveOptions: SaveVersionOptions = {
        tag: `${this.config.tagPrefix}${Date.now()}`,
        description: `Auto-saved after ${operation}`,
        metadata: {
          augmentation: 'versioning',
          operation,
          timestamp: Date.now()
        }
      }

      // Call before-save hook
      if (this.config.hooks?.beforeSave) {
        const modifiedOptions = await this.config.hooks.beforeSave(entityId, saveOptions)
        if (modifiedOptions === null) {
          // Hook cancelled the save
          return result
        }
        saveOptions = modifiedOptions
      }

      // Save version
      const version = await this.versioningAPI.save(entityId, saveOptions)
      this.versionCount++

      // Call after-save hook
      if (this.config.hooks?.afterSave) {
        await this.config.hooks.afterSave(entityId, version)
      }

      // Auto-prune if enabled
      if (this.config.autoPrune) {
        await this.pruneEntity(entityId)
      }
    } catch (error) {
      // Don't fail the operation if versioning fails
      console.error(`Versioning augmentation error for ${entityId}:`, error)
    }

    return result
  }

  /**
   * Extract entity ID from operation params
   */
  private extractEntityId(operation: string, params: any[]): string | null {
    if (operation === 'update') {
      // update(id, data) or update({ id, ... })
      if (typeof params[0] === 'string') {
        return params[0]
      }
      if (params[0]?.id) {
        return params[0].id
      }
    }

    if (operation === 'add') {
      // add(data) - ID might be in data or result
      if (params[0]?.id) {
        return params[0].id
      }
    }

    return null
  }

  /**
   * Check if entity should be versioned based on filters
   */
  private async shouldVersionEntity(entityId: string): Promise<boolean> {
    // Check exclude patterns first (ID-based)
    if (this.config.excludeEntities) {
      for (const pattern of this.config.excludeEntities) {
        if (this.matchPattern(entityId, pattern)) {
          return false
        }
      }
    }

    // Check include patterns (ID-based)
    if (this.config.entities && this.config.entities.length > 0) {
      let matched = false
      for (const pattern of this.config.entities) {
        if (this.matchPattern(entityId, pattern)) {
          matched = true
          break
        }
      }
      if (!matched) return false
    }

    // Check entity type filters (requires fetching entity)
    if (
      (this.config.types && this.config.types.length > 0) ||
      (this.config.excludeTypes && this.config.excludeTypes.length > 0)
    ) {
      try {
        const entity = await this.brain?.getNounMetadata?.(entityId)
        if (!entity) return true // If can't fetch, allow versioning

        const entityType = entity.type

        // Check exclude types
        if (this.config.excludeTypes && this.config.excludeTypes.includes(entityType)) {
          return false
        }

        // Check include types
        if (this.config.types && this.config.types.length > 0) {
          if (!this.config.types.includes(entityType)) {
            return false
          }
        }
      } catch (error) {
        // If can't fetch entity, allow versioning (fail open)
        console.error(`Failed to fetch entity ${entityId} for type filtering:`, error)
        return true
      }
    }

    return true
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(value: string, pattern: string): boolean {
    if (pattern === '*') return true
    if (!pattern.includes('*')) return value === pattern

    // Convert glob to regex
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    )
    return regex.test(value)
  }

  /**
   * Prune old versions for an entity
   */
  private async pruneEntity(entityId: string): Promise<void> {
    if (!this.versioningAPI) return

    try {
      // Call before-prune hook
      if (this.config.hooks?.beforePrune) {
        const shouldPrune = await this.config.hooks.beforePrune(entityId)
        if (!shouldPrune) return
      }

      // Prune versions
      const result = await this.versioningAPI.prune(entityId, {
        keepRecent: this.config.keepRecent,
        keepAfter: this.config.keepAfter,
        keepTagged: this.config.keepTagged
      })

      // Call after-prune hook
      if (result.deleted > 0 && this.config.hooks?.afterPrune) {
        await this.config.hooks.afterPrune(entityId, result.deleted)
      }
    } catch (error) {
      console.error(`Failed to prune versions for ${entityId}:`, error)
    }
  }

  /**
   * Start auto-prune timer
   */
  private startAutoPrune(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer)
    }

    this.pruneTimer = setInterval(async () => {
      await this.pruneAllEntities()
    }, this.config.pruneInterval)
  }

  /**
   * Prune all versioned entities
   */
  private async pruneAllEntities(): Promise<void> {
    if (!this.versioningAPI) return

    try {
      // Get all versioned entities
      const versionIndex = (this.versioningAPI as any).manager.versionIndex
      const entities = await versionIndex.getVersionedEntities()

      // Prune each entity
      for (const entityId of entities) {
        if (await this.shouldVersionEntity(entityId)) {
          await this.pruneEntity(entityId)
        }
      }
    } catch (error) {
      console.error('Auto-prune failed:', error)
    }
  }

  /**
   * Get augmentation statistics
   */
  getStats(): {
    enabled: boolean
    versionsCreated: number
    entitiesPattern: string[]
    excludePattern: string[]
    retention: number
  } {
    return {
      enabled: this.config.enabled,
      versionsCreated: this.versionCount,
      entitiesPattern: this.config.entities || [],
      excludePattern: this.config.excludeEntities || [],
      retention: this.config.keepRecent || 10
    }
  }
}

/**
 * Factory function for easy augmentation creation
 */
export function createVersioningAugmentation(
  config: VersioningAugmentationConfig = {}
): VersioningAugmentation {
  return new VersioningAugmentation(config)
}
