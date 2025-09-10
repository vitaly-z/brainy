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
export var ExecutionMode;
(function (ExecutionMode) {
    ExecutionMode["SEQUENTIAL"] = "sequential";
    ExecutionMode["PARALLEL"] = "parallel";
    ExecutionMode["FIRST_SUCCESS"] = "firstSuccess";
    ExecutionMode["FIRST_RESULT"] = "firstResult";
    ExecutionMode["THREADED"] = "threaded";
})(ExecutionMode || (ExecutionMode = {}));
/**
 * Minimal Cortex class for backward compatibility
 * Redirects all operations to the new AugmentationRegistry system
 */
export class Cortex {
    constructor() {
        if (Cortex.instance) {
            return Cortex.instance;
        }
        Cortex.instance = this;
    }
}
// Create and export a default instance of the cortex
export const cortex = new Cortex();
// Backward compatibility exports
export const AugmentationPipeline = Cortex;
export const augmentationPipeline = cortex;
// Export types for compatibility (avoid duplicate export)
// PipelineOptions already exported above
//# sourceMappingURL=augmentationPipeline.js.map