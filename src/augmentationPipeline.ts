/**
 * Augmentation Pipeline (Compatibility Layer)
 * 
 * @deprecated This file provides backward compatibility for code that imports
 * from augmentationPipeline. All new code should use AugmentationRegistry directly.
 * 
 * This minimal implementation redirects to the new AugmentationRegistry system.
 */

import { BrainyAugmentation } from './types/augmentations.js'

/**
 * Execution mode for pipeline operations
 */
export enum ExecutionMode {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  FIRST_SUCCESS = 'firstSuccess',
  FIRST_RESULT = 'firstResult',
  THREADED = 'threaded'
}

/**
 * Options for pipeline execution
 */
export interface PipelineOptions {
  mode?: ExecutionMode
  timeout?: number
  retries?: number
  throwOnError?: boolean
}

/**
 * Minimal Cortex class for backward compatibility
 * Redirects all operations to the new AugmentationRegistry system
 */
export class Cortex {
  private static instance?: Cortex

  constructor() {
    if (Cortex.instance) {
      return Cortex.instance
    }
    Cortex.instance = this
  }

  /**
   * Get all available augmentation types (returns empty for compatibility)
   * @deprecated Use brain.augmentations instead
   */
  public getAvailableAugmentationTypes(): string[] {
    console.warn('getAvailableAugmentationTypes is deprecated. Use brain.augmentations instead.')
    return []
  }

  /**
   * Get augmentations by type (returns empty for compatibility)
   * @deprecated Use brain.augmentations instead
   */
  public getAugmentationsByType(type: string): BrainyAugmentation[] {
    console.warn('getAugmentationsByType is deprecated. Use brain.augmentations instead.')
    return []
  }

  /**
   * Check if augmentation is enabled (returns false for compatibility)
   * @deprecated Use brain.augmentations instead
   */
  public isAugmentationEnabled(name: string): boolean {
    console.warn('isAugmentationEnabled is deprecated. Use brain.augmentations instead.')
    return false
  }

  /**
   * List augmentations with status (returns empty for compatibility)
   * @deprecated Use brain.augmentations instead
   */
  public listAugmentationsWithStatus(): Array<{
    name: string
    type: string
    enabled: boolean
    description: string
  }> {
    console.warn('listAugmentationsWithStatus is deprecated. Use brain.augmentations instead.')
    return []
  }

  /**
   * Execute augmentations (compatibility method)
   * @deprecated Use brain.augmentations.execute instead
   */
  public async executeAugmentations<T>(
    operation: string,
    data: any,
    options?: PipelineOptions
  ): Promise<T> {
    console.warn('executeAugmentations is deprecated. Use brain.augmentations.execute instead.')
    return data as T
  }

  /**
   * Enable augmentation (compatibility method)
   * @deprecated Use brain.augmentations instead
   */
  public enableAugmentation(name: string): boolean {
    console.warn('enableAugmentation is deprecated. Use brain.augmentations instead.')
    return false
  }

  /**
   * Disable augmentation (compatibility method)
   * @deprecated Use brain.augmentations instead
   */
  public disableAugmentation(name: string): boolean {
    console.warn('disableAugmentation is deprecated. Use brain.augmentations instead.')
    return false
  }

  /**
   * Register augmentation (compatibility method)
   * @deprecated Use brain.augmentations.register instead
   */
  public register(augmentation: BrainyAugmentation): void {
    console.warn('register is deprecated. Use brain.augmentations.register instead.')
  }

  /**
   * Unregister augmentation (compatibility method)
   * @deprecated Use brain.augmentations instead
   */
  public unregister(name: string): boolean {
    console.warn('unregister is deprecated. Use brain.augmentations instead.')
    return false
  }

  /**
   * Enable augmentation type (compatibility method)
   * @deprecated Use brain.augmentations instead
   */
  public enableAugmentationType(type: string): number {
    console.warn('enableAugmentationType is deprecated. Use brain.augmentations instead.')
    return 0
  }

  /**
   * Disable augmentation type (compatibility method)
   * @deprecated Use brain.augmentations instead
   */
  public disableAugmentationType(type: string): number {
    console.warn('disableAugmentationType is deprecated. Use brain.augmentations instead.')
    return 0
  }
}

// Create and export a default instance of the cortex
export const cortex = new Cortex()

// Backward compatibility exports
export const AugmentationPipeline = Cortex
export const augmentationPipeline = cortex

// Export types for compatibility (avoid duplicate export)
// PipelineOptions already exported above