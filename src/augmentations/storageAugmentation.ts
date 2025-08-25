/**
 * Storage Augmentation Base Classes
 * 
 * Unifies storage adapters and augmentations into a single system.
 * All storage backends are now augmentations for consistency and extensibility.
 */

import { BaseAugmentation, BrainyAugmentation, AugmentationContext } from './brainyAugmentation.js'
import { StorageAdapter } from '../coreTypes.js'

/**
 * Base class for all storage augmentations
 * Provides the storage adapter to the brain during initialization
 */
export abstract class StorageAugmentation extends BaseAugmentation implements BrainyAugmentation {
  readonly timing = 'replace' as const
  operations = ['storage'] as ('storage')[]  // Make mutable for TypeScript compatibility
  readonly priority = 100 // High priority for storage
  
  protected storageAdapter: StorageAdapter | null = null
  
  // Initialize name in constructor
  constructor(name: string) {
    super()
    this.name = name
  }
  
  /**
   * Provide the storage adapter before full initialization
   * This is called during the storage resolution phase
   */
  abstract provideStorage(): Promise<StorageAdapter>
  
  /**
   * Initialize the augmentation with context
   * Called after storage has been resolved
   */
  async initialize(context: AugmentationContext): Promise<void> {
    await super.initialize(context)
    // Storage adapter should already be provided
    if (!this.storageAdapter) {
      this.storageAdapter = await this.provideStorage()
    }
  }
  
  /**
   * Execute storage operations
   * For storage augmentations, this replaces the default storage
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    if (operation === 'storage') {
      // Return our storage adapter
      return this.storageAdapter as any as T
    }
    
    // Pass through all other operations
    return next()
  }
  
  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    // Cleanup storage adapter if needed
    if (this.storageAdapter && typeof (this.storageAdapter as any).close === 'function') {
      await (this.storageAdapter as any).close()
    }
    await super.shutdown()
  }
}

/**
 * Dynamic storage augmentation that wraps any storage adapter
 * Used for backward compatibility and zero-config
 */
export class DynamicStorageAugmentation extends StorageAugmentation {
  constructor(
    private adapter: StorageAdapter,
    name?: string
  ) {
    super(name || `${adapter.constructor.name}Augmentation`)
    this.storageAdapter = adapter
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    return this.adapter
  }
  
  protected async onInitialize(): Promise<void> {
    // Adapter is already provided in constructor
    await this.adapter.init()
    this.log(`${this.name} initialized`)
  }
}

/**
 * Create a storage augmentation from configuration
 * Maintains backward compatibility with existing storage config
 */
export async function createStorageAugmentationFromConfig(
  config: any
): Promise<StorageAugmentation | null> {
  // Import storage factory dynamically to avoid circular deps
  const { createStorage } = await import('../storage/storageFactory.js')
  
  try {
    // Create storage adapter from config
    const adapter = await createStorage(config)
    
    // Wrap in augmentation
    return new DynamicStorageAugmentation(adapter, 'auto-storage')
  } catch (error) {
    console.warn('Failed to create storage augmentation from config:', error)
    return null
  }
}