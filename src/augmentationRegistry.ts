/**
 * Augmentation Registry (Compatibility Layer)
 *
 * @deprecated This module provides backward compatibility for old augmentation
 * loading code. All new code should use the AugmentationRegistry class directly
 * on Brainy instances.
 */

import { BrainyAugmentation } from './types/augmentations.js'

/**
 * Registry of all available augmentations (for compatibility)
 * @deprecated Use brain.augmentations instead
 */
export const availableAugmentations: any[] = []

/**
 * Compatibility wrapper for registerAugmentation
 * @deprecated Use brain.augmentations.register instead
 */
export function registerAugmentation<T extends BrainyAugmentation>(augmentation: T): T {
  console.warn('registerAugmentation is deprecated. Use brain.augmentations.register instead.')
  
  // For compatibility, just add to the list (but it won't actually do anything)
  availableAugmentations.push(augmentation)

  return augmentation
}

/**
 * Sets the default pipeline instance (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export function setDefaultPipeline(pipeline: any): void {
  console.warn('setDefaultPipeline is deprecated. Use brain.augmentations instead.')
}

/**
 * Initializes the augmentation pipeline (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export function initializeAugmentationPipeline(pipelineInstance?: any): any {
  console.warn('initializeAugmentationPipeline is deprecated. Use brain.augmentations instead.')
  return pipelineInstance || {}
}

/**
 * Enables or disables an augmentation by name (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export function setAugmentationEnabled(name: string, enabled: boolean): boolean {
  console.warn('setAugmentationEnabled is deprecated. Use brain.augmentations instead.')
  return false
}

/**
 * Gets all augmentations of a specific type (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export function getAugmentationsByType(type: any): any[] {
  console.warn('getAugmentationsByType is deprecated. Use brain.augmentations instead.')
  return []
}
