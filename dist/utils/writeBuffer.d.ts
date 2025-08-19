/**
 * Write Buffer
 * Accumulates writes and flushes them in bulk to reduce S3 operations
 * Implements intelligent deduplication and compression
 */
interface FlushResult {
    successful: number;
    failed: number;
    duration: number;
}
/**
 * High-performance write buffer for bulk operations
 */
export declare class WriteBuffer<T> {
    private logger;
    private buffer;
    private maxBufferSize;
    private flushInterval;
    private minFlushSize;
    private maxRetries;
    private flushTimer;
    private isFlushing;
    private lastFlush;
    private pendingFlush;
    private totalWrites;
    private totalFlushes;
    private failedWrites;
    private duplicatesRemoved;
    private writeFunction;
    private type;
    private backpressure;
    constructor(type: 'noun' | 'verb' | 'metadata', writeFunction: (items: Map<string, T>) => Promise<void>, options?: {
        maxBufferSize?: number;
        flushInterval?: number;
        minFlushSize?: number;
    });
    /**
     * Add item to buffer
     */
    add(id: string, data: T): Promise<void>;
    /**
     * Check if we should flush
     */
    private checkFlush;
    /**
     * Flush buffer to storage
     */
    flush(reason?: string): Promise<FlushResult>;
    /**
     * Perform the actual flush
     */
    private doFlush;
    /**
     * Start periodic flush timer
     */
    private startPeriodicFlush;
    /**
     * Stop periodic flush timer
     */
    stop(): void;
    /**
     * Force flush all pending writes
     */
    forceFlush(): Promise<FlushResult>;
    /**
     * Get buffer statistics
     */
    getStats(): {
        bufferSize: number;
        totalWrites: number;
        totalFlushes: number;
        failedWrites: number;
        duplicatesRemoved: number;
        avgFlushSize: number;
    };
    /**
     * Adjust parameters based on load
     */
    adjustForLoad(pendingRequests: number): void;
}
/**
 * Get or create a write buffer
 */
export declare function getWriteBuffer<T>(id: string, type: 'noun' | 'verb' | 'metadata', writeFunction: (items: Map<string, T>) => Promise<void>): WriteBuffer<T>;
/**
 * Flush all write buffers
 */
export declare function flushAllBuffers(): Promise<void>;
/**
 * Clear all write buffers
 */
export declare function clearWriteBuffers(): void;
export {};
