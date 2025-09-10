/**
 * Unified Embedding Manager
 *
 * THE single source of truth for all embedding operations in Brainy.
 * Combines model management, precision configuration, and embedding generation
 * into one clean, maintainable class.
 *
 * Features:
 * - Singleton pattern ensures ONE model instance
 * - Automatic Q8 (default) or FP32 precision
 * - Model downloading and caching
 * - Thread-safe initialization
 * - Memory monitoring
 *
 * This replaces: SingletonModelManager, TransformerEmbedding, ModelPrecisionManager,
 * hybridModelManager, universalMemoryManager, and more.
 */
import { Vector, EmbeddingFunction } from '../coreTypes.js';
export type ModelPrecision = 'q8' | 'fp32';
interface EmbeddingStats {
    initialized: boolean;
    precision: ModelPrecision;
    modelName: string;
    embedCount: number;
    initTime: number | null;
    memoryMB: number | null;
}
/**
 * Unified Embedding Manager - Clean, simple, reliable
 */
export declare class EmbeddingManager {
    private model;
    private precision;
    private modelName;
    private initialized;
    private initTime;
    private embedCount;
    private locked;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): EmbeddingManager;
    /**
     * Initialize the model (happens once)
     */
    init(): Promise<void>;
    /**
     * Perform actual initialization
     */
    private performInit;
    /**
     * Generate embeddings
     */
    embed(text: string | string[]): Promise<Vector>;
    /**
     * Generate mock embeddings for unit tests
     */
    private getMockEmbedding;
    /**
     * Get embedding function for compatibility
     */
    getEmbeddingFunction(): EmbeddingFunction;
    /**
     * Determine model precision
     */
    private determinePrecision;
    /**
     * Get models directory path
     */
    private getModelsPath;
    /**
     * Get memory usage in MB
     */
    private getMemoryUsage;
    /**
     * Get current statistics
     */
    getStats(): EmbeddingStats;
    /**
     * Check if initialized
     */
    isInitialized(): boolean;
    /**
     * Get current precision
     */
    getPrecision(): ModelPrecision;
    /**
     * Validate precision matches expected
     */
    validatePrecision(expected: ModelPrecision): void;
}
export declare const embeddingManager: EmbeddingManager;
/**
 * Direct embed function
 */
export declare function embed(text: string | string[]): Promise<Vector>;
/**
 * Get embedding function for compatibility
 */
export declare function getEmbeddingFunction(): EmbeddingFunction;
/**
 * Get statistics
 */
export declare function getEmbeddingStats(): EmbeddingStats;
export {};
