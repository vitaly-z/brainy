/**
 * Brainy Plugin System
 *
 * Simple plugin architecture for two use cases:
 * 1. Native acceleration (@soulcraft/cortex)
 * 2. Custom storage adapters (e.g., Redis, DynamoDB, custom backends)
 *
 * Plugins are auto-detected by package name or registered manually.
 */

import type { StorageAdapter } from './coreTypes.js'

/**
 * Plugin interface — all brainy plugins must implement this.
 */
export interface BrainyPlugin {
  /** Unique plugin name (typically the npm package name) */
  name: string

  /**
   * Called by brainy during init() to activate the plugin.
   * Return true if activation succeeded, false to skip.
   */
  activate(context: BrainyPluginContext): Promise<boolean>

  /**
   * Called when brainy.close() is invoked. Optional cleanup.
   */
  deactivate?(): Promise<void>
}

/**
 * Context passed to plugins during activation.
 */
export interface BrainyPluginContext {
  /**
   * Register a provider for a named subsystem.
   *
   * Well-known provider keys (used by cortex):
   * - 'metadataIndex'      — MetadataIndexManager replacement
   * - 'graphIndex'         — GraphAdjacencyIndex replacement
   * - 'entityIdMapper'     — EntityIdMapper replacement
   * - 'cache'              — UnifiedCache replacement
   * - 'hnsw'               — HNSWIndex replacement
   * - 'roaring'            — RoaringBitmap32 replacement
   * - 'embeddings'         — Embedding engine replacement
   * - 'distance'           — Distance function overrides
   * - 'msgpack'            — Msgpack encode/decode
   *
   * Storage adapter keys:
   * - 'storage:<name>'     — Custom storage adapter factory
   */
  registerProvider(key: string, implementation: unknown): void

  /** Brainy version for compatibility checks */
  readonly version: string
}

/**
 * Storage adapter factory — plugins register these to provide
 * new storage backends that users reference by name.
 *
 * Example: A Redis plugin registers 'storage:redis', then users
 * can use `new Brainy({ storage: 'redis', redis: { host: '...' } })`
 */
export interface StorageAdapterFactory {
  create(config: Record<string, unknown>): StorageAdapter | Promise<StorageAdapter>
  name: string
}

/**
 * Plugin registry — manages plugin lifecycle and provider resolution.
 */
export class PluginRegistry {
  private plugins: Map<string, BrainyPlugin> = new Map()
  private providers: Map<string, unknown> = new Map()
  private activated: Set<string> = new Set()

  /**
   * Register a plugin manually.
   */
  register(plugin: BrainyPlugin): void {
    this.plugins.set(plugin.name, plugin)
  }

  /**
   * Auto-detect known plugins by attempting dynamic import.
   * Additional package names can be passed for third-party plugins.
   */
  async autoDetect(additionalPackages: string[] = []): Promise<void> {
    const packages = [
      '@soulcraft/cortex',
      '@soulcraft/brainy-cortex',  // deprecated — backward compat
      ...additionalPackages
    ]

    for (const pkg of packages) {
      try {
        const mod = await import(pkg)
        const plugin: BrainyPlugin = mod.default || mod
        if (plugin && typeof plugin.activate === 'function' && plugin.name) {
          this.plugins.set(plugin.name, plugin)
        }
      } catch {
        // Package not installed — skip silently
      }
    }
  }

  /**
   * Activate all registered plugins.
   */
  async activateAll(context: BrainyPluginContext): Promise<string[]> {
    const activated: string[] = []

    for (const [name, plugin] of this.plugins) {
      if (this.activated.has(name)) continue

      try {
        const success = await plugin.activate(context)
        if (success) {
          this.activated.add(name)
          activated.push(name)
        }
      } catch (error) {
        console.warn(`[brainy] Plugin ${name} failed to activate:`, error)
      }
    }

    return activated
  }

  /**
   * Deactivate all plugins (called during close()).
   */
  async deactivateAll(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (!this.activated.has(name)) continue
      try {
        await plugin.deactivate?.()
        this.activated.delete(name)
      } catch {
        // Non-fatal
      }
    }
  }

  /**
   * Get a registered provider by key.
   */
  getProvider<T = unknown>(key: string): T | undefined {
    return this.providers.get(key) as T | undefined
  }

  /**
   * Check if a provider is registered.
   */
  hasProvider(key: string): boolean {
    return this.providers.has(key)
  }

  /**
   * Register a provider (called by plugins via BrainyPluginContext).
   */
  registerProvider(key: string, implementation: unknown): void {
    this.providers.set(key, implementation)
  }

  /**
   * Get a storage adapter factory by name.
   */
  getStorageFactory(name: string): StorageAdapterFactory | undefined {
    return this.providers.get(`storage:${name}`) as StorageAdapterFactory | undefined
  }

  /** Get active plugin names */
  getActivePlugins(): string[] {
    return [...this.activated]
  }

  /** Check if any plugins are active */
  hasActivePlugins(): boolean {
    return this.activated.size > 0
  }
}
