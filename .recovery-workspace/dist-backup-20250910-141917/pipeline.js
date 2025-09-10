/**
 * Pipeline - Clean Re-export of Cortex
 *
 * After the Great Cleanup: Pipeline IS Cortex. No delegation, no complexity.
 * ONE way to do everything.
 */
// Export the ONE consolidated Cortex class as Pipeline for those who prefer the name
export { Cortex as Pipeline, cortex as pipeline, ExecutionMode } from './augmentationPipeline.js';
// Re-export for backward compatibility in imports
export { cortex as augmentationPipeline, Cortex } from './augmentationPipeline.js';
// Simple factory functions
export const createPipeline = async () => {
    const { Cortex } = await import('./augmentationPipeline.js');
    return new Cortex();
};
export const createStreamingPipeline = async () => {
    const { Cortex } = await import('./augmentationPipeline.js');
    return new Cortex();
};
// Execution mode alias
export var StreamlinedExecutionMode;
(function (StreamlinedExecutionMode) {
    StreamlinedExecutionMode["SEQUENTIAL"] = "sequential";
    StreamlinedExecutionMode["PARALLEL"] = "parallel";
    StreamlinedExecutionMode["FIRST_SUCCESS"] = "firstSuccess";
    StreamlinedExecutionMode["FIRST_RESULT"] = "firstResult";
    StreamlinedExecutionMode["THREADED"] = "threaded";
})(StreamlinedExecutionMode || (StreamlinedExecutionMode = {}));
//# sourceMappingURL=pipeline.js.map