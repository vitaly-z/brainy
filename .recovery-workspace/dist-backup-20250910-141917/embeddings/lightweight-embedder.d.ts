/**
 * Lightweight Embedding Alternative
 *
 * Uses pre-computed embeddings for common terms
 * Falls back to ONNX for unknown terms
 *
 * This reduces memory usage by 90% for typical queries
 */
import { Vector } from '../coreTypes.js';
export declare class LightweightEmbedder {
    private stats;
    embed(text: string | string[]): Promise<Vector | Vector[]>;
    private embedSingle;
    getStats(): {
        totalEmbeddings: number;
        cacheHitRate: number;
        precomputedHits: number;
        simpleComputes: number;
        onnxComputes: number;
    };
    loadPrecomputed(filePath?: string): Promise<void>;
}
