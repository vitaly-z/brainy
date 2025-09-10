/**
 * Singleton Model Manager - THE ONLY SOURCE OF EMBEDDING MODELS
 *
 * This is the SINGLE, UNIFIED model initialization system that ensures:
 * - Only ONE model instance exists across the entire system
 * - Precision is configured once and locked
 * - All components share the same model
 * - No possibility of mixed precisions
 *
 * CRITICAL: This manager is used by EVERYTHING:
 * - Storage operations (add, update)
 * - Search operations (search, find)
 * - Public API (embed, cluster)
 * - Neural API (all neural.* methods)
 * - Internal operations (deduplication, indexing)
 */
import { TransformerEmbedding } from '../utils/embedding.js';
import { EmbeddingFunction, Vector } from '../coreTypes.js';
/**
 * Statistics for monitoring
 */
interface ModelStats {
    initialized: boolean;
    precision: string;
    initCount: number;
    embedCount: number;
    lastUsed: Date | null;
    memoryFootprint?: number;
}
/**
 * The ONE TRUE model manager
 */
export declare class SingletonModelManager {
    private static instance;
    private stats;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): SingletonModelManager;
    /**
     * Get the model instance - creates if needed, reuses if exists
     * This is THE ONLY way to get a model in the entire system
     */
    getModel(): Promise<TransformerEmbedding>;
    /**
     * Initialize the model - happens exactly once
     */
    private initializeModel;
    /**
     * Get embedding function that uses the singleton model
     */
    getEmbeddingFunction(): Promise<EmbeddingFunction>;
    /**
     * Direct embed method for convenience
     */
    embed(data: string | string[]): Promise<Vector>;
    /**
     * Check if model is initialized
     */
    isInitialized(): boolean;
    /**
     * Get current statistics
     */
    getStats(): ModelStats;
    /**
     * Validate precision consistency
     * Throws error if attempting to use different precision
     */
    validatePrecision(requestedPrecision?: string): void;
    /**
     * Force cleanup (for testing only)
     * WARNING: This will break consistency - use only in tests
     */
    _testOnlyCleanup(): Promise<void>;
}
export declare const singletonModelManager: SingletonModelManager;
/**
 * THE ONLY embedding function that should be used anywhere
 * This ensures all operations use the same model instance
 */
export declare function getUnifiedEmbeddingFunction(): Promise<EmbeddingFunction>;
/**
 * Direct embed function for convenience
 */
export declare function unifiedEmbed(data: string | string[]): Promise<Vector>;
/**
 * Check if model is ready
 */
export declare function isModelReady(): boolean;
/**
 * Get model statistics
 */
export declare function getModelStats(): ModelStats;
export {};
