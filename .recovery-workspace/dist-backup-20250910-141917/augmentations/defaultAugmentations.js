/**
 * Default Augmentations Registration
 *
 * Maintains zero-config philosophy by automatically registering
 * core augmentations that were previously hardcoded in Brainy.
 *
 * These augmentations are optional but enabled by default for
 * backward compatibility and optimal performance.
 */
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
export function createDefaultAugmentations(config = {}) {
    const augmentations = [];
    // Cache augmentation (was SearchCache)
    if (config.cache !== false) {
        const cacheConfig = typeof config.cache === 'object' ? config.cache : {};
        augmentations.push(new CacheAugmentation(cacheConfig));
    }
    // Index augmentation (was MetadataIndex)
    if (config.index !== false) {
        const indexConfig = typeof config.index === 'object' ? config.index : {};
        augmentations.push(new IndexAugmentation(indexConfig));
    }
    // Metrics augmentation (was StatisticsCollector)
    if (config.metrics !== false) {
        const metricsConfig = typeof config.metrics === 'object' ? config.metrics : {};
        augmentations.push(new MetricsAugmentation(metricsConfig));
    }
    // Display augmentation (AI-powered intelligent display fields)
    if (config.display !== false) {
        const displayConfig = typeof config.display === 'object' ? config.display : {};
        augmentations.push(new UniversalDisplayAugmentation(displayConfig));
    }
    // Monitoring augmentation (was HealthMonitor)
    // Only enable by default in distributed mode
    const isDistributed = process.env.BRAINY_MODE === 'distributed' ||
        process.env.BRAINY_DISTRIBUTED === 'true';
    if (config.monitoring !== false && (config.monitoring || isDistributed)) {
        const monitoringConfig = typeof config.monitoring === 'object' ? config.monitoring : {};
        augmentations.push(new MonitoringAugmentation(monitoringConfig));
    }
    return augmentations;
}
/**
 * Get augmentation by name with type safety
 */
export function getAugmentation(brain, name) {
    // Access augmentations through a public method or property
    const augmentations = brain.augmentations;
    if (!augmentations)
        return null;
    const aug = augmentations.get(name);
    return aug;
}
/**
 * Compatibility helpers for migrating from hardcoded features
 */
export const AugmentationHelpers = {
    /**
     * Get cache augmentation
     */
    getCache(brain) {
        return getAugmentation(brain, 'cache');
    },
    /**
     * Get index augmentation
     */
    getIndex(brain) {
        return getAugmentation(brain, 'index');
    },
    /**
     * Get metrics augmentation
     */
    getMetrics(brain) {
        return getAugmentation(brain, 'metrics');
    },
    /**
     * Get monitoring augmentation
     */
    getMonitoring(brain) {
        return getAugmentation(brain, 'monitoring');
    },
    /**
     * Get display augmentation
     */
    getDisplay(brain) {
        return getAugmentation(brain, 'display');
    }
};
//# sourceMappingURL=defaultAugmentations.js.map