/**
 * Default Augmentations Registration
 *
 * Maintains zero-config philosophy by automatically registering
 * core augmentations that were previously hardcoded in Brainy.
 *
 * These augmentations are optional but enabled by default for
 * backward compatibility and optimal performance.
 */
import { Brainy } from '../brainy.js';
import { BaseAugmentation } from './brainyAugmentation.js';
import { CacheAugmentation } from './cacheAugmentation.js';
import { IndexAugmentation } from './indexAugmentation.js';
import { MetricsAugmentation } from './metricsAugmentation.js';
import { MonitoringAugmentation } from './monitoringAugmentation.js';
import { UniversalDisplayAugmentation } from './universalDisplayAugmentation.js';
/**
 * Create default augmentations for zero-config operation
 * Returns an array of augmentations to be registered
 *
 * @param config - Configuration options
 * @returns Array of augmentations to register
 */
export declare function createDefaultAugmentations(config?: {
    cache?: boolean | Record<string, any>;
    index?: boolean | Record<string, any>;
    metrics?: boolean | Record<string, any>;
    monitoring?: boolean | Record<string, any>;
    display?: boolean | Record<string, any>;
}): BaseAugmentation[];
/**
 * Get augmentation by name with type safety
 */
export declare function getAugmentation<T>(brain: Brainy, name: string): T | null;
/**
 * Compatibility helpers for migrating from hardcoded features
 */
export declare const AugmentationHelpers: {
    /**
     * Get cache augmentation
     */
    getCache(brain: Brainy): CacheAugmentation | null;
    /**
     * Get index augmentation
     */
    getIndex(brain: Brainy): IndexAugmentation | null;
    /**
     * Get metrics augmentation
     */
    getMetrics(brain: Brainy): MetricsAugmentation | null;
    /**
     * Get monitoring augmentation
     */
    getMonitoring(brain: Brainy): MonitoringAugmentation | null;
    /**
     * Get display augmentation
     */
    getDisplay(brain: Brainy): UniversalDisplayAugmentation | null;
};
