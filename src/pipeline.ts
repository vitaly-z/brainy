/**
 * Pipeline - Augmentation execution pipeline
 *
 * Provides Pipeline class, execution modes, and factory functions.
 * All augmentation management should use brain.augmentations API.
 */

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
 * Minimal Pipeline class for backward compatibility.
 * All augmentation management should use brain.augmentations API.
 */
export class Pipeline {
  private static instance?: Pipeline

  constructor() {
    if (Pipeline.instance) {
      return Pipeline.instance
    }
    Pipeline.instance = this
  }
}

// Default singleton instance
export const pipeline = new Pipeline()

// Backward compatibility aliases
export const AugmentationPipeline = Pipeline
export const augmentationPipeline = pipeline

// Factory functions
export const createPipeline = async () => new Pipeline()
export const createStreamingPipeline = async () => new Pipeline()

// Type aliases
export type StreamlinedPipelineOptions = PipelineOptions
export type PipelineResult<T> = { success: boolean; data: T; error?: string }
export type StreamlinedPipelineResult<T> = PipelineResult<T>

// Execution mode alias
export enum StreamlinedExecutionMode {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  FIRST_SUCCESS = 'firstSuccess',
  FIRST_RESULT = 'firstResult',
  THREADED = 'threaded'
}
