/**
 * Request Coalescer
 * Batches and deduplicates operations to reduce S3 API calls
 * Automatically flushes based on size, time, or pressure
 */
interface CoalescedOperation {
    type: 'write' | 'read' | 'delete';
    key: string;
    data?: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
}
interface BatchStats {
    totalOperations: number;
    coalescedOperations: number;
    deduplicated: number;
    batchesProcessed: number;
    averageBatchSize: number;
}
/**
 * Coalesces multiple operations into efficient batches
 */
export declare class RequestCoalescer {
    private logger;
    private writeQueue;
    private readQueue;
    private deleteQueue;
    private maxBatchSize;
    private maxBatchAge;
    private minBatchSize;
    private flushTimer;
    private lastFlush;
    private stats;
    private processor;
    constructor(processor: (batch: CoalescedOperation[]) => Promise<void>, options?: {
        maxBatchSize?: number;
        maxBatchAge?: number;
        minBatchSize?: number;
    });
    /**
     * Add a write operation to be coalesced
     */
    write(key: string, data: any): Promise<void>;
    /**
     * Add a read operation to be coalesced
     */
    read(key: string): Promise<any>;
    /**
     * Add a delete operation to be coalesced
     */
    delete(key: string): Promise<void>;
    /**
     * Check if we should flush the queues
     */
    private checkFlush;
    /**
     * Flush all queued operations
     */
    flush(reason?: string): Promise<void>;
    /**
     * Get current statistics
     */
    getStats(): BatchStats;
    /**
     * Get current queue sizes
     */
    getQueueSizes(): {
        writes: number;
        reads: number;
        deletes: number;
        total: number;
    };
    /**
     * Adjust batch parameters based on load
     */
    adjustParameters(pending: number): void;
    /**
     * Force immediate flush of all operations
     */
    forceFlush(): Promise<void>;
}
/**
 * Get or create a coalescer for a storage instance
 */
export declare function getCoalescer(storageId: string, processor: (batch: any[]) => Promise<void>): RequestCoalescer;
/**
 * Clear all coalescers
 */
export declare function clearCoalescers(): void;
export {};
