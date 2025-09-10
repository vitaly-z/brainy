/**
 * Cached Embeddings - Performance Optimization Layer
 *
 * Provides pre-computed embeddings for common terms to avoid
 * unnecessary model calls. Falls back to EmbeddingManager for
 * unknown terms.
 *
 * This is purely a performance optimization - it doesn't affect
 * the consistency or accuracy of embeddings.
 */
import { Vector } from '../coreTypes.js';
/**
 * Cached Embeddings with fallback to EmbeddingManager
 */
export declare class CachedEmbeddings {
    private stats;
    /**
     * Generate embedding with caching
     */
    embed(text: string | string[]): Promise<Vector | Vector[]>;
    /**
     * Embed single text with cache lookup
     */
    private embedSingle;
    /**
     * Get cache statistics
     */
    getStats(): {
        totalEmbeddings: number;
        cacheHitRate: number;
        cacheHits: number;
        simpleComputes: number;
        modelCalls: number;
    };
    /**
     * Add custom pre-computed embeddings
     */
    addPrecomputed(term: string, embedding: Vector): void;
}
export declare const cachedEmbeddings: CachedEmbeddings;
