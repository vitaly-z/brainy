/**
 * Augmentation Pipeline (Compatibility Layer)
 *
 * @deprecated This file provides backward compatibility for code that imports
 * from augmentationPipeline. All new code should use AugmentationRegistry directly.
 *
 * This minimal implementation redirects to the new AugmentationRegistry system.
 */
/**
 * Execution mode for pipeline operations
 */
export declare enum ExecutionMode {
    SEQUENTIAL = "sequential",
    PARALLEL = "parallel",
    FIRST_SUCCESS = "firstSuccess",
    FIRST_RESULT = "firstResult",
    THREADED = "threaded"
}
/**
 * Options for pipeline execution
 */
export interface PipelineOptions {
    mode?: ExecutionMode;
    timeout?: number;
    retries?: number;
    throwOnError?: boolean;
}
/**
 * Minimal Cortex class for backward compatibility
 * Redirects all operations to the new AugmentationRegistry system
 */
export declare class Cortex {
    private static instance?;
    constructor();
}
export declare const cortex: Cortex;
export declare const AugmentationPipeline: typeof Cortex;
export declare const augmentationPipeline: Cortex;
