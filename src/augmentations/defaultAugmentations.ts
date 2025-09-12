/**
 * Default Augmentations Registration
 * 
 * Maintains zero-config philosophy by automatically registering
 * core augmentations that were previously hardcoded in Brainy.
 * 
 * These augmentations are optional but enabled by default for
 * backward compatibility and optimal performance.
 */

import { Brainy } from '../brainy.js'
import { BaseAugmentation } from './brainyAugmentation.js'
import { CacheAugmentation } from './cacheAugmentation.js'
import { MetricsAugmentation } from './metricsAugmentation.js'
import { MonitoringAugmentation } from './monitoringAugmentation.js'
import { UniversalDisplayAugmentation } from './universalDisplayAugmentation.js'

/**
 * Create default augmentations for zero-config operation
 * Returns an array of augmentations to be registered
 * 
 * @param config - Configuration options
 * @returns Array of augmentations to register
 */
export function createDefaultAugmentations(
  config: {
    cache?: boolean | Record<string, any>
    metrics?: boolean | Record<string, any>
    monitoring?: boolean | Record<string, any>
    display?: boolean | Record<string, any>
  } = {}
): BaseAugmentation[] {
  const augmentations: BaseAugmentation[] = []

  // Cache augmentation (was SearchCache)
  if (config.cache !== false) {
    const cacheConfig = typeof config.cache === 'object' ? config.cache : {}
    augmentations.push(new CacheAugmentation(cacheConfig))
  }

  // Note: Index augmentation removed - metadata indexing is now core functionality

  // Metrics augmentation (was StatisticsCollector)
  if (config.metrics !== false) {
    const metricsConfig = typeof config.metrics === 'object' ? config.metrics : {}
    augmentations.push(new MetricsAugmentation(metricsConfig))
  }

  // Display augmentation (AI-powered intelligent display fields)
  if (config.display !== false) {
    const displayConfig = typeof config.display === 'object' ? config.display : {}
    augmentations.push(new UniversalDisplayAugmentation(displayConfig))
  }

  // Monitoring augmentation (was HealthMonitor)
  // Only enable by default in distributed mode
  const isDistributed = process.env.BRAINY_MODE === 'distributed' || 
                        process.env.BRAINY_DISTRIBUTED === 'true'
  
  if (config.monitoring !== false && (config.monitoring || isDistributed)) {
    const monitoringConfig = typeof config.monitoring === 'object' ? config.monitoring : {}
    augmentations.push(new MonitoringAugmentation(monitoringConfig))
  }

  return augmentations
}

/**
 * Get augmentation by name with type safety
 */
export function getAugmentation<T>(brain: Brainy, name: string): T | null {
  // Access augmentations through a public method or property
  const augmentations = (brain as any).augmentations
  if (!augmentations) return null
  const aug = augmentations.get(name)
  return aug as T | null
}

/**
 * Compatibility helpers for migrating from hardcoded features
 */
export const AugmentationHelpers = {
  /**
   * Get cache augmentation
   */
  getCache(brain: Brainy): CacheAugmentation | null {
    return getAugmentation<CacheAugmentation>(brain, 'cache')
  },

  /**
   * Note: Index augmentation removed - metadata indexing is now core functionality
   * Use brain.metadataIndex directly instead
   */

  /**
   * Get metrics augmentation
   */
  getMetrics(brain: Brainy): MetricsAugmentation | null {
    return getAugmentation<MetricsAugmentation>(brain, 'metrics')
  },

  /**
   * Get monitoring augmentation
   */
  getMonitoring(brain: Brainy): MonitoringAugmentation | null {
    return getAugmentation<MonitoringAugmentation>(brain, 'monitoring')
  },

  /**
   * Get display augmentation
   */
  getDisplay(brain: Brainy): UniversalDisplayAugmentation | null {
    return getAugmentation<UniversalDisplayAugmentation>(brain, 'display')
  }
}