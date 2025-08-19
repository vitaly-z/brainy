/**
 * Apply TextEncoder/TextDecoder patches for Node.js compatibility
 * Simplified version for Transformers.js/ONNX Runtime
 */
export declare function applyTensorFlowPatch(): Promise<void>;
export declare function getTextEncoder(): TextEncoder;
export declare function getTextDecoder(): TextDecoder;
