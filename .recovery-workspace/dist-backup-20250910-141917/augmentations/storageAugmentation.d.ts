/**
 * Storage Augmentation Base Classes
 *
 * Unifies storage adapters and augmentations into a single system.
 * All storage backends are now augmentations for consistency and extensibility.
 */
import { BaseAugmentation, BrainyAugmentation, AugmentationContext } from './brainyAugmentation.js';
import { StorageAdapter } from '../coreTypes.js';
/**
 * Base class for all storage augmentations
 * Provides the storage adapter to the brain during initialization
 */
export declare abstract class StorageAugmentation extends BaseAugmentation implements BrainyAugmentation {
    readonly timing: "replace";
    readonly metadata: "none";
    operations: ("storage")[];
    readonly priority = 100;
    protected storageAdapter: StorageAdapter | null;
    constructor(config?: any);
    /**
     * Provide the storage adapter before full initialization
     * This is called during the storage resolution phase
     */
    abstract provideStorage(): Promise<StorageAdapter>;
    /**
     * Initialize the augmentation with context
     * Called after storage has been resolved
     */
    initialize(context: AugmentationContext): Promise<void>;
    /**
     * Execute storage operations
     * For storage augmentations, this replaces the default storage
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Shutdown and cleanup
     */
    shutdown(): Promise<void>;
}
/**
 * Dynamic storage augmentation that wraps any storage adapter
 * Used for backward compatibility and zero-config
 */
export declare class DynamicStorageAugmentation extends StorageAugmentation {
    private adapter;
    readonly name = "dynamic-storage";
    constructor(adapter: StorageAdapter);
    provideStorage(): Promise<StorageAdapter>;
    protected onInitialize(): Promise<void>;
}
/**
 * Create a storage augmentation from configuration
 * Maintains backward compatibility with existing storage config
 */
export declare function createStorageAugmentationFromConfig(config: any): Promise<StorageAugmentation | null>;
