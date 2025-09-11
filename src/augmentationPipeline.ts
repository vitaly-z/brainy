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

  // Deprecated methods have been removed.
  // Use brain.augmentations API instead for all augmentation operations.

  // Additional deprecated methods removed.
  // All augmentation management should use brain.augmentations API.

  // All remaining deprecated methods removed.

  // Final deprecated methods removed.
  // This class now serves as a minimal compatibility layer.
}

// Create and export a default instance of the cortex
export const cortex = new Cortex()

// Backward compatibility exports
export const AugmentationPipeline = Cortex
export const augmentationPipeline = cortex

// Export types for compatibility (avoid duplicate export)
// PipelineOptions already exported above