/**
 * Storage Augmentation Base Classes
 *
 * Unifies storage adapters and augmentations into a single system.
 * All storage backends are now augmentations for consistency and extensibility.
 */
import { BaseAugmentation } from './brainyAugmentation.js';
/**
 * Base class for all storage augmentations
 * Provides the storage adapter to the brain during initialization
 */
export class StorageAugmentation extends BaseAugmentation {
    // Storage augmentations must provide their name via readonly property
    constructor(config) {
        super(config);
        this.timing = 'replace';
        this.metadata = 'none'; // Storage doesn't directly access metadata
        this.operations = ['storage']; // Make mutable for TypeScript compatibility
        this.priority = 100; // High priority for storage
        this.storageAdapter = null;
    }
    /**
     * Initialize the augmentation with context
     * Called after storage has been resolved
     */
    async initialize(context) {
        await super.initialize(context);
        // Storage adapter should already be provided
        if (!this.storageAdapter) {
            this.storageAdapter = await this.provideStorage();
        }
    }
    /**
     * Execute storage operations
     * For storage augmentations, this replaces the default storage
     */
    async execute(operation, params, next) {
        if (operation === 'storage') {
            // Return our storage adapter
            return this.storageAdapter;
        }
        // Pass through all other operations
        return next();
    }
    /**
     * Shutdown and cleanup
     */
    async shutdown() {
        // Cleanup storage adapter if needed
        if (this.storageAdapter && typeof this.storageAdapter.close === 'function') {
            await this.storageAdapter.close();
        }
        await super.shutdown();
    }
}
/**
 * Dynamic storage augmentation that wraps any storage adapter
 * Used for backward compatibility and zero-config
 */
export class DynamicStorageAugmentation extends StorageAugmentation {
    constructor(adapter) {
        super();
        this.adapter = adapter;
        this.name = 'dynamic-storage';
        this.storageAdapter = adapter;
    }
    async provideStorage() {
        return this.adapter;
    }
    async onInitialize() {
        // Adapter is already provided in constructor
        await this.adapter.init();
        this.log(`${this.name} initialized`);
    }
}
/**
 * Create a storage augmentation from configuration
 * Maintains backward compatibility with existing storage config
 */
export async function createStorageAugmentationFromConfig(config) {
    // Import storage factory dynamically to avoid circular deps
    const { createStorage } = await import('../storage/storageFactory.js');
    try {
        // Create storage adapter from config
        const adapter = await createStorage(config);
        // Wrap in augmentation
        return new DynamicStorageAugmentation(adapter);
    }
    catch (error) {
        console.warn('Failed to create storage augmentation from config:', error);
        return null;
    }
}
//# sourceMappingURL=storageAugmentation.js.map