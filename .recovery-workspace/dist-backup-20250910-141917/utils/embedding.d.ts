/**
 * Embedding functions for converting data to vectors using Transformers.js
 * Complete rewrite to eliminate TensorFlow.js and use ONNX-based models
 */
import { EmbeddingFunction, EmbeddingModel, Vector } from '../coreTypes.js';
/**
 * Detect the best available GPU device for the current environment
 */
export declare function detectBestDevice(): Promise<'cpu' | 'webgpu' | 'cuda'>;
/**
 * Resolve device string to actual device configuration
 */
export declare function resolveDevice(device?: string): Promise<string>;
/**
 * Transformers.js Sentence Encoder embedding model
 * Uses ONNX Runtime for fast, offline embeddings with smaller models
 * Default model: all-MiniLM-L6-v2 (384 dimensions, ~90MB)
 */
export interface TransformerEmbeddingOptions {
    /** Model name/path to use - defaults to all-MiniLM-L6-v2 */
    model?: string;
    /** Whether to enable verbose logging */
    verbose?: boolean;
    /** Custom cache directory for models */
    cacheDir?: string;
    /** Force local files only (no downloads) */
    localFilesOnly?: boolean;
    /** Model precision: 'q8' = 75% smaller quantized model, 'fp32' = full precision (default) */
    precision?: 'fp32' | 'q8';
    /** Device to run inference on - 'auto' detects best available */
    device?: 'auto' | 'cpu' | 'webgpu' | 'cuda' | 'gpu';
}
export declare class TransformerEmbedding implements EmbeddingModel {
    private extractor;
    private initialized;
    private verbose;
    private options;
    /**
     * Create a new TransformerEmbedding instance
     */
    constructor(options?: TransformerEmbeddingOptions);
    /**
     * Get the default cache directory for models
     */
    private getDefaultCacheDir;
    /**
     * Check if we're running in a test environment
     */
    private isTestEnvironment;
    /**
     * Log message only if verbose mode is enabled
     */
    private logger;
    /**
     * Generate mock embeddings for unit tests
     */
    private getMockEmbedding;
    /**
     * Initialize the embedding model
     */
    init(): Promise<void>;
    /**
     * Generate embeddings for text data
     */
    embed(data: string | string[]): Promise<Vector>;
    /**
     * Dispose of the model and free resources
     */
    dispose(): Promise<void>;
    /**
     * Get the dimension of embeddings produced by this model
     */
    getDimension(): number;
    /**
     * Check if the model is initialized
     */
    isInitialized(): boolean;
}
export declare const UniversalSentenceEncoder: typeof TransformerEmbedding;
/**
 * Create a new embedding model instance
 */
export declare function createEmbeddingModel(options?: TransformerEmbeddingOptions): EmbeddingModel;
/**
 * Default embedding function using the unified EmbeddingManager
 * Simple, clean, reliable - no more layers of indirection
 */
export declare const defaultEmbeddingFunction: EmbeddingFunction;
/**
 * Create an embedding function with custom options
 * NOTE: Options are validated but the singleton EmbeddingManager is always used
 */
export declare function createEmbeddingFunction(options?: TransformerEmbeddingOptions): EmbeddingFunction;
/**
 * Batch embedding function for processing multiple texts efficiently
 */
export declare function batchEmbed(texts: string[], options?: TransformerEmbeddingOptions): Promise<Vector[]>;
/**
 * Embedding functions for specific model types
 */
export declare const embeddingFunctions: {
    /** Default lightweight model (all-MiniLM-L6-v2, 384 dimensions) */
    default: EmbeddingFunction;
    /** Create custom embedding function */
    create: typeof createEmbeddingFunction;
    /** Batch processing */
    batch: typeof batchEmbed;
};
