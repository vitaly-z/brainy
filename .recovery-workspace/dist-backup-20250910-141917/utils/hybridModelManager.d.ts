/**
 * Hybrid Model Manager - BEST OF BOTH WORLDS
 *
 * NOW A WRAPPER AROUND SingletonModelManager
 * Maintained for backward compatibility
 *
 * Previously combined:
 * 1. Multi-source downloading strategy (GitHub → CDN → Hugging Face)
 * 2. Singleton pattern preventing multiple ONNX model loads
 * 3. Environment-specific optimizations
 * 4. Graceful fallbacks and error handling
 *
 * Now delegates all operations to SingletonModelManager for true unification
 */
import { EmbeddingFunction } from '../coreTypes.js';
/**
 * HybridModelManager - Now a wrapper around SingletonModelManager
 * Maintained for backward compatibility
 */
declare class HybridModelManager {
    private static instance;
    private constructor();
    static getInstance(): HybridModelManager;
    /**
     * Get the primary embedding model - delegates to SingletonModelManager
     */
    getPrimaryModel(): Promise<any>;
    /**
     * Get embedding function - delegates to SingletonModelManager
     */
    getEmbeddingFunction(): Promise<EmbeddingFunction>;
    /**
     * Check if model is ready - delegates to SingletonModelManager
     */
    isModelReady(): boolean;
    /**
     * Force model reload - not supported with SingletonModelManager
     */
    reloadModel(): Promise<void>;
    /**
     * Get model status - delegates to SingletonModelManager
     */
    getModelStatus(): {
        loaded: boolean;
        ready: boolean;
        modelType: string;
    };
}
export declare const hybridModelManager: HybridModelManager;
/**
 * Get the hybrid singleton embedding function - Now delegates to SingletonModelManager
 * Maintained for backward compatibility
 */
export declare function getHybridEmbeddingFunction(): Promise<EmbeddingFunction>;
/**
 * Hybrid embedding function - Now delegates to SingletonModelManager
 * Maintained for backward compatibility
 */
export declare const hybridEmbeddingFunction: EmbeddingFunction;
/**
 * Preload model for tests or production - Now delegates to SingletonModelManager
 */
export declare function preloadHybridModel(): Promise<void>;
export {};
