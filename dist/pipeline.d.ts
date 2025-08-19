/**
 * Pipeline - Clean Re-export of Cortex
 *
 * After the Great Cleanup: Pipeline IS Cortex. No delegation, no complexity.
 * ONE way to do everything.
 */
export { Cortex as Pipeline, cortex as pipeline, ExecutionMode, PipelineOptions } from './augmentationPipeline.js';
export { cortex as augmentationPipeline, Cortex } from './augmentationPipeline.js';
export declare const createPipeline: () => Promise<import("./augmentationPipeline.js").Cortex>;
export declare const createStreamingPipeline: () => Promise<import("./augmentationPipeline.js").Cortex>;
export type { PipelineOptions as StreamlinedPipelineOptions } from './augmentationPipeline.js';
export type PipelineResult<T> = {
    success: boolean;
    data: T;
    error?: string;
};
export type StreamlinedPipelineResult<T> = PipelineResult<T>;
export declare enum StreamlinedExecutionMode {
    SEQUENTIAL = "sequential",
    PARALLEL = "parallel",
    FIRST_SUCCESS = "firstSuccess",
    FIRST_RESULT = "firstResult",
    THREADED = "threaded"
}
