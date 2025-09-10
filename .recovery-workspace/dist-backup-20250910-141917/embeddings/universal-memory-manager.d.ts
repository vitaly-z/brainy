/**
 * Universal Memory Manager for Embeddings
 *
 * Works in ALL environments: Node.js, browsers, serverless, workers
 * Solves transformers.js memory leak with environment-specific strategies
 */
import { Vector, EmbeddingFunction } from '../coreTypes.js';
interface MemoryStats {
    embeddings: number;
    memoryUsage: string;
    restarts: number;
    strategy: string;
}
export declare class UniversalMemoryManager {
    private embeddingFunction;
    private embedCount;
    private restartCount;
    private lastRestart;
    private strategy;
    private maxEmbeddings;
    constructor();
    getEmbeddingFunction(): Promise<EmbeddingFunction>;
    embed(data: string | string[]): Promise<Vector>;
    private checkMemoryLimits;
    private ensureEmbeddingFunction;
    private initNodeDirect;
    private initServerless;
    private initBrowser;
    private initFallback;
    private initDirect;
    private cleanup;
    getMemoryStats(): MemoryStats;
    dispose(): Promise<void>;
}
export declare const universalMemoryManager: UniversalMemoryManager;
export declare function getUniversalEmbeddingFunction(): Promise<EmbeddingFunction>;
export declare function getEmbeddingMemoryStats(): MemoryStats;
export {};
