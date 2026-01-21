/**
 * Integration Hub - Integration Base Class
 *
 * Base class for all integration augmentations. Provides common functionality
 * for event subscriptions, tabular export, and lifecycle management.
 */

import {
  BaseAugmentation,
  AugmentationContext
} from '../../augmentations/brainyAugmentation.js'
import { AugmentationManifest } from '../../augmentations/manifest.js'
import { EventBus } from './EventBus.js'
import { TabularExporter } from './TabularExporter.js'
import {
  EventFilter,
  EventHandler,
  EventSubscription,
  IntegrationConfig,
  IntegrationHealthStatus,
  TabularExporterConfig
} from './types.js'
import { Entity, Relation, FindParams } from '../../types/brainy.types.js'

/**
 * Base class for all integration augmentations
 *
 * Provides:
 * - Shared EventBus for real-time updates
 * - TabularExporter for entity-to-row conversion
 * - Common lifecycle methods (start/stop)
 * - Health monitoring
 * - Standard configuration patterns
 *
 * @example
 * ```typescript
 * class MySQLIntegration extends IntegrationBase {
 *   readonly name = 'sql'
 *   readonly category = 'integration'
 *
 *   protected async onStart(): Promise<void> {
 *     // Start SQL server
 *   }
 *
 *   protected async onStop(): Promise<void> {
 *     // Stop SQL server
 *   }
 * }
 * ```
 */
export abstract class IntegrationBase extends BaseAugmentation {
  // Augmentation interface implementation
  readonly timing = 'after' as const
  readonly metadata = 'readonly' as const
  readonly operations: ('all')[] = ['all']
  readonly priority = 5 // Low priority - runs after main operations
  category: 'internal' | 'core' | 'premium' | 'community' | 'external' = 'core'

  // Shared infrastructure
  protected eventBus: EventBus
  protected exporter: TabularExporter

  // Integration state
  protected isRunning = false
  protected startedAt?: number
  protected requestCount = 0
  protected errorCount = 0
  protected lastError?: string

  // Event subscriptions managed by this integration
  private managedSubscriptions: EventSubscription[] = []

  /**
   * Create a new integration
   *
   * @param config Integration configuration
   * @param exporterConfig Optional TabularExporter configuration
   */
  constructor(
    config?: IntegrationConfig,
    exporterConfig?: TabularExporterConfig
  ) {
    super(config)
    this.eventBus = new EventBus()
    this.exporter = new TabularExporter(exporterConfig)
  }

  /**
   * Integration name (must be unique)
   */
  abstract readonly name: string

  /**
   * Start the integration (implement in subclass)
   */
  protected abstract onStart(): Promise<void>

  /**
   * Stop the integration (implement in subclass)
   */
  protected abstract onStop(): Promise<void>

  // BaseAugmentation lifecycle integration

  protected async onInitialize(): Promise<void> {
    // Auto-start if enabled
    if (this.config.enabled !== false) {
      await this.start()
    }
  }

  protected async onShutdown(): Promise<void> {
    await this.stop()
  }

  /**
   * Execute augmentation (intercept operations to emit events)
   */
  async execute<T>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Execute main operation first
    const result = await next()

    // Emit events for data-changing operations
    if (this.isRunning) {
      this.emitOperationEvent(operation, params, result)
    }

    return result
  }

  // Public API

  /**
   * Start the integration
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    this.log(`Starting ${this.name} integration...`)

    try {
      await this.onStart()
      this.isRunning = true
      this.startedAt = Date.now()
      this.log(`${this.name} integration started`)
    } catch (error: any) {
      this.lastError = error.message
      this.log(`Failed to start ${this.name}: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * Stop the integration
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.log(`Stopping ${this.name} integration...`)

    try {
      // Unsubscribe all managed subscriptions
      for (const sub of this.managedSubscriptions) {
        sub.unsubscribe()
      }
      this.managedSubscriptions = []

      await this.onStop()
      this.isRunning = false
      this.log(`${this.name} integration stopped`)
    } catch (error: any) {
      this.lastError = error.message
      this.log(`Error stopping ${this.name}: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * Check if integration is running
   */
  running(): boolean {
    return this.isRunning
  }

  /**
   * Get health status
   */
  health(): IntegrationHealthStatus {
    return {
      name: this.name,
      status: this.isRunning
        ? this.errorCount > 10
          ? 'degraded'
          : 'healthy'
        : 'stopped',
      message: this.isRunning ? 'Running' : 'Stopped',
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : undefined,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      lastError: this.lastError,
      checkedAt: Date.now()
    }
  }

  /**
   * Get the shared EventBus
   */
  getEventBus(): EventBus {
    return this.eventBus
  }

  /**
   * Get the TabularExporter
   */
  getExporter(): TabularExporter {
    return this.exporter
  }

  // Protected helpers for subclasses

  /**
   * Subscribe to Brainy events (auto-unsubscribed on stop)
   */
  protected subscribeToChanges(
    filter: EventFilter,
    handler: EventHandler
  ): EventSubscription {
    const subscription = this.eventBus.subscribe(filter, handler)
    this.managedSubscriptions.push(subscription)
    return subscription
  }

  /**
   * Query entities using Brainy find()
   */
  protected async queryEntities(params: FindParams): Promise<Entity[]> {
    if (!this.context) {
      throw new Error('Integration not initialized')
    }

    const results = await this.context.brain.find(params)
    return results.map((r: any) => r.entity)
  }

  /**
   * Query relations using Brainy getRelations()
   */
  protected async queryRelations(params?: {
    from?: string
    to?: string
    type?: any
    limit?: number
    offset?: number
  }): Promise<Relation[]> {
    if (!this.context) {
      throw new Error('Integration not initialized')
    }

    return this.context.brain.getRelations(params)
  }

  /**
   * Get a single entity by ID
   */
  protected async getEntity(id: string): Promise<Entity | null> {
    if (!this.context) {
      throw new Error('Integration not initialized')
    }

    return this.context.brain.get(id)
  }

  /**
   * Export entities to tabular format
   */
  protected exportEntities(entities: Entity[]): any[] {
    return this.exporter.entitiesToRows(entities)
  }

  /**
   * Export relations to tabular format
   */
  protected exportRelations(relations: Relation[]): any[] {
    return this.exporter.relationsToRows(relations)
  }

  /**
   * Record a successful request
   */
  protected recordRequest(): void {
    this.requestCount++
  }

  /**
   * Record an error
   */
  protected recordError(error: Error | string): void {
    this.errorCount++
    this.lastError = typeof error === 'string' ? error : error.message
  }

  /**
   * Get manifest for this integration
   * Subclasses should override this
   */
  getManifest(): AugmentationManifest {
    return {
      id: this.name,
      name: this.name,
      version: '1.0.0',
      description: `${this.name} integration`,
      category: 'integration',
      status: 'stable',
      configSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Whether the integration is enabled'
          }
        }
      },
      configDefaults: {
        enabled: true
      }
    }
  }

  // Private helpers

  /**
   * Emit events based on operation type
   */
  private emitOperationEvent(operation: string, params: any, result: any): void {
    // Map operations to event types
    const opMap: Record<
      string,
      { entityType: 'noun' | 'verb' | 'vfs'; op: 'create' | 'update' | 'delete' }
    > = {
      add: { entityType: 'noun', op: 'create' },
      addNoun: { entityType: 'noun', op: 'create' },
      update: { entityType: 'noun', op: 'update' },
      delete: { entityType: 'noun', op: 'delete' },
      relate: { entityType: 'verb', op: 'create' },
      addVerb: { entityType: 'verb', op: 'create' },
      unrelate: { entityType: 'verb', op: 'delete' },
      deleteVerb: { entityType: 'verb', op: 'delete' }
    }

    const mapping = opMap[operation]
    if (!mapping) {
      return
    }

    // Extract entity ID from result or params
    let entityId = result?.id || params?.id
    if (!entityId && Array.isArray(result)) {
      // Batch operation - emit for each
      for (const item of result) {
        if (item?.id) {
          this.eventBus.emit({
            entityType: mapping.entityType,
            operation: mapping.op,
            entityId: item.id,
            nounType: params?.type || item?.type,
            verbType: params?.type || item?.type,
            service: params?.service || item?.service,
            data: item
          })
        }
      }
      return
    }

    if (entityId) {
      this.eventBus.emit({
        entityType: mapping.entityType,
        operation: mapping.op,
        entityId,
        nounType: params?.type,
        verbType: params?.type,
        service: params?.service,
        data: result
      })
    }
  }
}

/**
 * Interface for integrations that expose HTTP endpoints
 */
export interface HTTPIntegration {
  /** Port the server is listening on */
  port: number

  /** Base path for routes */
  basePath: string

  /** Get registered routes */
  getRoutes(): Array<{
    method: string
    path: string
    description: string
  }>
}

/**
 * Interface for integrations that support streaming
 */
export interface StreamingIntegration {
  /** Subscribe to real-time events via callback */
  stream(
    filter: EventFilter,
    callback: (event: any) => void
  ): { close: () => void }
}
