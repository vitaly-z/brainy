/**
 * Worker Manager for Memory-Safe Embeddings
 *
 * Manages worker lifecycle to prevent transformers.js memory leaks
 * Workers are automatically restarted when memory usage grows too high
 */
import { Vector, EmbeddingFunction } from '../coreTypes.js';
export declare class WorkerEmbeddingManager {
    private worker;
    private requestId;
    private pendingRequests;
    private isRestarting;
    private totalRequests;
    getEmbeddingFunction(): Promise<EmbeddingFunction>;
    embed(data: string | string[]): Promise<Vector>;
    private ensureWorker;
    private createWorker;
    dispose(): Promise<void>;
    forceRestart(): Promise<void>;
    getStats(): {
        totalRequests: number;
        pendingRequests: number;
        workerActive: boolean;
        isRestarting: boolean;
    };
}
export declare const workerEmbeddingManager: WorkerEmbeddingManager;
export declare function getWorkerEmbeddingFunction(): Promise<EmbeddingFunction>;
