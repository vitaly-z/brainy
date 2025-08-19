/**
 * Type-safe augmentation management system for Brainy
 * Provides a clean API for managing augmentations without string literals
 */
import { augmentationPipeline } from './augmentationPipeline.js';
/**
 * Type-safe augmentation manager
 * Accessed via brain.augmentations for all management operations
 */
export class AugmentationManager {
    constructor() {
        this.pipeline = augmentationPipeline;
    }
    /**
     * List all registered augmentations with their status
     * @returns Array of augmentation information
     */
    list() {
        return this.pipeline.listAugmentationsWithStatus();
    }
    /**
     * Get information about a specific augmentation
     * @param name The augmentation name
     * @returns Augmentation info or undefined if not found
     */
    get(name) {
        const all = this.list();
        return all.find(a => a.name === name);
    }
    /**
     * Check if an augmentation is enabled
     * @param name The augmentation name
     * @returns True if enabled, false otherwise
     */
    isEnabled(name) {
        const aug = this.get(name);
        return aug?.enabled ?? false;
    }
    /**
     * Enable a specific augmentation
     * @param name The augmentation name
     * @returns True if successfully enabled
     */
    enable(name) {
        return this.pipeline.enableAugmentation(name);
    }
    /**
     * Disable a specific augmentation
     * @param name The augmentation name
     * @returns True if successfully disabled
     */
    disable(name) {
        return this.pipeline.disableAugmentation(name);
    }
    /**
     * Remove an augmentation from the pipeline
     * @param name The augmentation name
     * @returns True if successfully removed
     */
    remove(name) {
        this.pipeline.unregister(name);
        return true;
    }
    /**
     * Enable all augmentations of a specific type
     * @param type The augmentation type
     * @returns Number of augmentations enabled
     */
    enableType(type) {
        return this.pipeline.enableAugmentationType(type);
    }
    /**
     * Disable all augmentations of a specific type
     * @param type The augmentation type
     * @returns Number of augmentations disabled
     */
    disableType(type) {
        return this.pipeline.disableAugmentationType(type);
    }
    /**
     * Get all augmentations of a specific type
     * @param type The augmentation type
     * @returns Array of augmentations of that type
     */
    listByType(type) {
        return this.list().filter(a => a.type === type);
    }
    /**
     * Get all enabled augmentations
     * @returns Array of enabled augmentations
     */
    listEnabled() {
        return this.list().filter(a => a.enabled);
    }
    /**
     * Get all disabled augmentations
     * @returns Array of disabled augmentations
     */
    listDisabled() {
        return this.list().filter(a => !a.enabled);
    }
    /**
     * Register a new augmentation (internal use)
     * @param augmentation The augmentation to register
     */
    register(augmentation) {
        this.pipeline.register(augmentation);
    }
}
// Export types for external use
export { AugmentationType } from './types/augmentations.js';
//# sourceMappingURL=augmentationManager.js.map