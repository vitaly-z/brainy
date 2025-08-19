/**
 * Type-safe augmentation management system for Brainy
 * Provides a clean API for managing augmentations without string literals
 */
import { IAugmentation, AugmentationType } from './types/augmentations.js';
export interface AugmentationInfo {
    name: string;
    type: string;
    enabled: boolean;
    description: string;
}
/**
 * Type-safe augmentation manager
 * Accessed via brain.augmentations for all management operations
 */
export declare class AugmentationManager {
    private pipeline;
    /**
     * List all registered augmentations with their status
     * @returns Array of augmentation information
     */
    list(): AugmentationInfo[];
    /**
     * Get information about a specific augmentation
     * @param name The augmentation name
     * @returns Augmentation info or undefined if not found
     */
    get(name: string): AugmentationInfo | undefined;
    /**
     * Check if an augmentation is enabled
     * @param name The augmentation name
     * @returns True if enabled, false otherwise
     */
    isEnabled(name: string): boolean;
    /**
     * Enable a specific augmentation
     * @param name The augmentation name
     * @returns True if successfully enabled
     */
    enable(name: string): boolean;
    /**
     * Disable a specific augmentation
     * @param name The augmentation name
     * @returns True if successfully disabled
     */
    disable(name: string): boolean;
    /**
     * Remove an augmentation from the pipeline
     * @param name The augmentation name
     * @returns True if successfully removed
     */
    remove(name: string): boolean;
    /**
     * Enable all augmentations of a specific type
     * @param type The augmentation type
     * @returns Number of augmentations enabled
     */
    enableType(type: AugmentationType): number;
    /**
     * Disable all augmentations of a specific type
     * @param type The augmentation type
     * @returns Number of augmentations disabled
     */
    disableType(type: AugmentationType): number;
    /**
     * Get all augmentations of a specific type
     * @param type The augmentation type
     * @returns Array of augmentations of that type
     */
    listByType(type: AugmentationType): AugmentationInfo[];
    /**
     * Get all enabled augmentations
     * @returns Array of enabled augmentations
     */
    listEnabled(): AugmentationInfo[];
    /**
     * Get all disabled augmentations
     * @returns Array of disabled augmentations
     */
    listDisabled(): AugmentationInfo[];
    /**
     * Register a new augmentation (internal use)
     * @param augmentation The augmentation to register
     */
    register(augmentation: IAugmentation): void;
}
export { AugmentationType } from './types/augmentations.js';
