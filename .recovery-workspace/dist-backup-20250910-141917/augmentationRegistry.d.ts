/**
 * Augmentation Registry (Compatibility Layer)
 *
 * @deprecated This module provides backward compatibility for old augmentation
 * loading code. All new code should use the AugmentationRegistry class directly
 * on Brainy instances.
 */
import { BrainyAugmentation } from './types/augmentations.js';
/**
 * Registry of all available augmentations (for compatibility)
 * @deprecated Use brain.augmentations instead
 */
export declare const availableAugmentations: any[];
/**
 * Compatibility wrapper for registerAugmentation
 * @deprecated Use brain.augmentations.register instead
 */
export declare function registerAugmentation<T extends BrainyAugmentation>(augmentation: T): T;
/**
 * Sets the default pipeline instance (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export declare function setDefaultPipeline(pipeline: any): void;
/**
 * Initializes the augmentation pipeline (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export declare function initializeAugmentationPipeline(pipelineInstance?: any): any;
/**
 * Enables or disables an augmentation by name (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export declare function setAugmentationEnabled(name: string, enabled: boolean): boolean;
/**
 * Gets all augmentations of a specific type (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export declare function getAugmentationsByType(type: any): any[];
