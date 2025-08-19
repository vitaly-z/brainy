/**
 * Enhanced Batch S3 Operations for High-Performance Vector Retrieval
 * Implements optimized batch operations to reduce S3 API calls and latency
 */
import { HNSWNoun } from '../../coreTypes.js';
type S3Client = any;
export interface BatchRetrievalOptions {
    maxConcurrency?: number;
    prefetchSize?: number;
    useS3Select?: boolean;
    compressionEnabled?: boolean;
}
export interface BatchResult<T> {
    items: Map<string, T>;
    errors: Map<string, Error>;
    statistics: {
        totalRequested: number;
        totalRetrieved: number;
        totalErrors: number;
        duration: number;
        apiCalls: number;
    };
}
/**
 * High-performance batch operations for S3-compatible storage
 * Optimizes retrieval patterns for HNSW search operations
 */
export declare class BatchS3Operations {
    private s3Client;
    private bucketName;
    private options;
    constructor(s3Client: S3Client, bucketName: string, options?: BatchRetrievalOptions);
    /**
     * Batch retrieve HNSW nodes with intelligent prefetching
     */
    batchGetNodes(nodeIds: string[], prefix?: string): Promise<BatchResult<HNSWNoun>>;
    /**
     * Parallel GetObject operations for small batches
     */
    private parallelGetObjects;
    /**
     * Chunked parallel retrieval with intelligent batching
     */
    private chunkedParallelGet;
    /**
     * List-based batch retrieval for large datasets
     * Uses S3 ListObjects to reduce API calls
     */
    private listBasedBatchGet;
    /**
     * Intelligent prefetch based on HNSW graph connectivity
     */
    prefetchConnectedNodes(currentNodeIds: string[], connectionMap: Map<string, Set<string>>, prefix?: string): Promise<BatchResult<HNSWNoun>>;
    /**
     * S3 Select-based retrieval for filtered queries
     */
    selectiveRetrieve(prefix: string, filter: {
        vectorDimension?: number;
        metadataKey?: string;
        metadataValue?: any;
    }): Promise<BatchResult<HNSWNoun>>;
    /**
     * Parse stored object from JSON string
     */
    private parseStoredObject;
    /**
     * Utility function to chunk arrays
     */
    private chunkArray;
}
export {};
