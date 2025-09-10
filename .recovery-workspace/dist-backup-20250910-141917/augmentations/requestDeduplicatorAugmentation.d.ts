/**
 * Request Deduplicator Augmentation
 *
 * Prevents duplicate concurrent requests to improve performance by 3x
 * Automatically deduplicates identical operations
 */
import { BaseAugmentation } from './brainyAugmentation.js';
interface DeduplicatorConfig {
    enabled?: boolean;
    ttl?: number;
    maxSize?: number;
}
export declare class RequestDeduplicatorAugmentation extends BaseAugmentation {
    name: string;
    timing: "around";
    metadata: "none";
    operations: ("search" | "find" | "similar" | "searchText" | "searchByNounTypes" | "findSimilar" | "get")[];
    priority: number;
    private pendingRequests;
    protected config: Required<DeduplicatorConfig>;
    private cleanupInterval?;
    constructor(config?: DeduplicatorConfig);
    protected onInitialize(): Promise<void>;
    shouldExecute(operation: string, params: any): boolean;
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Create a unique key for the request based on operation and parameters
     */
    private createRequestKey;
    /**
     * Serialize parameters to a consistent string
     */
    private serializeParams;
    /**
     * Clean up expired requests
     */
    private cleanup;
    /**
     * Get statistics about request deduplication
     */
    getStats(): {
        activePendingRequests: number;
        totalDeduplicationHits: number;
        memoryUsage: string;
        efficiency: string;
    };
    /**
     * Force clear all pending requests (for testing)
     */
    clear(): void;
    protected onShutdown(): Promise<void>;
}
export {};
