/**
 * S3-Compatible Storage Adapter
 * Uses the AWS S3 client to interact with S3-compatible storage services
 * including Amazon S3, Cloudflare R2, and Google Cloud Storage
 */
import { GraphVerb, HNSWNoun, HNSWVerb, StatisticsData } from '../../coreTypes.js';
import { BaseStorage } from '../baseStorage.js';
import { OperationConfig } from '../../utils/operationUtils.js';
type HNSWNode = HNSWNoun;
type Edge = HNSWVerb;
interface ChangeLogEntry {
    timestamp: number;
    operation: 'add' | 'update' | 'delete';
    entityType: 'noun' | 'verb' | 'metadata';
    entityId: string;
    data?: any;
    instanceId?: string;
}
export { S3CompatibleStorage as R2Storage };
/**
 * S3-compatible storage adapter for server environments
 * Uses the AWS S3 client to interact with S3-compatible storage services
 * including Amazon S3, Cloudflare R2, and Google Cloud Storage
 *
 * To use this adapter with Amazon S3, you need to provide:
 * - region: AWS region (e.g., 'us-east-1')
 * - credentials: AWS credentials (accessKeyId and secretAccessKey)
 * - bucketName: S3 bucket name
 *
 * To use this adapter with Cloudflare R2, you need to provide:
 * - accountId: Cloudflare account ID
 * - accessKeyId: R2 access key ID
 * - secretAccessKey: R2 secret access key
 * - bucketName: R2 bucket name
 *
 * To use this adapter with Google Cloud Storage, you need to provide:
 * - region: GCS region (e.g., 'us-central1')
 * - credentials: GCS credentials (accessKeyId and secretAccessKey)
 * - endpoint: GCS endpoint (e.g., 'https://storage.googleapis.com')
 * - bucketName: GCS bucket name
 */
export declare class S3CompatibleStorage extends BaseStorage {
    private s3Client;
    private bucketName;
    private serviceType;
    private region;
    private endpoint?;
    private accountId?;
    private accessKeyId;
    private secretAccessKey;
    private sessionToken?;
    private nounPrefix;
    private verbPrefix;
    private metadataPrefix;
    private verbMetadataPrefix;
    private indexPrefix;
    private systemPrefix;
    private useDualWrite;
    protected statisticsCache: StatisticsData | null;
    private lockPrefix;
    private activeLocks;
    private changeLogPrefix;
    private pendingOperations;
    private maxConcurrentOperations;
    private baseBatchSize;
    private currentBatchSize;
    private lastMemoryCheck;
    private memoryCheckInterval;
    private consecutiveErrors;
    private lastErrorReset;
    private socketManager;
    private backpressure;
    private nounWriteBuffer;
    private verbWriteBuffer;
    private requestCoalescer;
    private highVolumeMode;
    private lastVolumeCheck;
    private volumeCheckInterval;
    private forceHighVolumeMode;
    private operationExecutors;
    private nounCacheManager;
    private verbCacheManager;
    private logger;
    /**
     * Initialize the storage adapter
     * @param options Configuration options for the S3-compatible storage
     */
    constructor(options: {
        bucketName: string;
        region?: string;
        endpoint?: string;
        accountId?: string;
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        serviceType?: string;
        operationConfig?: OperationConfig;
        cacheConfig?: {
            hotCacheMaxSize?: number;
            hotCacheEvictionThreshold?: number;
            warmCacheTTL?: number;
        };
        readOnly?: boolean;
    });
    /**
     * Initialize the storage adapter
     */
    init(): Promise<void>;
    /**
     * Override base class method to detect S3-specific throttling errors
     */
    protected isThrottlingError(error: any): boolean;
    /**
     * Override to add S3-specific logging
     */
    handleThrottling(error: any, service?: string): Promise<void>;
    /**
     * Smart delay based on current throttling status
     */
    private smartDelay;
    /**
     * Auto-cleanup legacy /index folder during initialization
     * This removes old index data that has been migrated to _system
     */
    private cleanupLegacyIndexFolder;
    /**
     * Initialize write buffers for high-volume scenarios
     */
    private initializeBuffers;
    /**
     * Initialize request coalescer
     */
    private initializeCoalescer;
    /**
     * Check if we should enable high-volume mode
     */
    private checkVolumeMode;
    /**
     * Bulk write nouns to S3
     */
    private bulkWriteNouns;
    /**
     * Bulk write verbs to S3
     */
    private bulkWriteVerbs;
    /**
     * Process coalesced batch of operations
     */
    private processCoalescedBatch;
    /**
     * Process bulk deletes
     */
    private processBulkDeletes;
    /**
     * Process bulk writes
     */
    private processBulkWrites;
    /**
     * Process bulk reads
     */
    private processBulkReads;
    /**
     * Dynamically adjust batch size based on memory pressure and error rates
     */
    private adjustBatchSize;
    /**
     * Apply backpressure when system is under load
     */
    private applyBackpressure;
    /**
     * Release backpressure after operation completes
     */
    private releaseBackpressure;
    /**
     * Get current batch size for operations
     */
    private getBatchSize;
    /**
     * Save a noun to storage (internal implementation)
     */
    protected saveNoun_internal(noun: HNSWNoun): Promise<void>;
    /**
     * Save a node to storage
     */
    protected saveNode(node: HNSWNode): Promise<void>;
    /**
     * Get a noun from storage (internal implementation)
     */
    protected getNoun_internal(id: string): Promise<HNSWNoun | null>;
    /**
     * Get a node from storage
     */
    protected getNode(id: string): Promise<HNSWNode | null>;
    private nodeCache;
    /**
     * Get all nodes from storage
     * @deprecated This method is deprecated and will be removed in a future version.
     * It can cause memory issues with large datasets. Use getNodesWithPagination() instead.
     */
    protected getAllNodes(): Promise<HNSWNode[]>;
    /**
     * Get nodes with pagination
     * @param options Pagination options
     * @returns Promise that resolves to a paginated result of nodes
     */
    protected getNodesWithPagination(options?: {
        limit?: number;
        cursor?: string;
        useCache?: boolean;
    }): Promise<{
        nodes: HNSWNode[];
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Get nouns by noun type (internal implementation)
     * @param nounType The noun type to filter by
     * @returns Promise that resolves to an array of nouns of the specified noun type
     */
    protected getNounsByNounType_internal(nounType: string): Promise<HNSWNoun[]>;
    /**
     * Get nodes by noun type
     * @param nounType The noun type to filter by
     * @returns Promise that resolves to an array of nodes of the specified noun type
     */
    protected getNodesByNounType(nounType: string): Promise<HNSWNode[]>;
    /**
     * Delete a noun from storage (internal implementation)
     */
    protected deleteNoun_internal(id: string): Promise<void>;
    /**
     * Delete a node from storage
     */
    protected deleteNode(id: string): Promise<void>;
    /**
     * Save a verb to storage (internal implementation)
     */
    protected saveVerb_internal(verb: HNSWVerb): Promise<void>;
    /**
     * Save an edge to storage
     */
    protected saveEdge(edge: Edge): Promise<void>;
    /**
     * Get a verb from storage (internal implementation)
     */
    protected getVerb_internal(id: string): Promise<HNSWVerb | null>;
    /**
     * Get an edge from storage
     */
    protected getEdge(id: string): Promise<Edge | null>;
    /**
     * Get all edges from storage
     * @deprecated This method is deprecated and will be removed in a future version.
     * It can cause memory issues with large datasets. Use getEdgesWithPagination() instead.
     */
    protected getAllEdges(): Promise<Edge[]>;
    /**
     * Get edges with pagination
     * @param options Pagination options
     * @returns Promise that resolves to a paginated result of edges
     */
    protected getEdgesWithPagination(options?: {
        limit?: number;
        cursor?: string;
        useCache?: boolean;
        filter?: {
            sourceId?: string;
            targetId?: string;
            type?: string;
        };
    }): Promise<{
        edges: Edge[];
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Filter an edge based on filter criteria
     * @param edge The edge to filter
     * @param filter The filter criteria
     * @returns True if the edge matches the filter, false otherwise
     */
    private filterEdge;
    /**
     * Get verbs with pagination
     * @param options Pagination options
     * @returns Promise that resolves to a paginated result of verbs
     */
    getVerbsWithPagination(options?: {
        limit?: number;
        cursor?: string;
        filter?: {
            verbType?: string | string[];
            sourceId?: string | string[];
            targetId?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<{
        items: GraphVerb[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Get verbs by source (internal implementation)
     */
    protected getVerbsBySource_internal(sourceId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by target (internal implementation)
     */
    protected getVerbsByTarget_internal(targetId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by type (internal implementation)
     */
    protected getVerbsByType_internal(type: string): Promise<GraphVerb[]>;
    /**
     * Delete a verb from storage (internal implementation)
     */
    protected deleteVerb_internal(id: string): Promise<void>;
    /**
     * Delete an edge from storage
     */
    protected deleteEdge(id: string): Promise<void>;
    /**
     * Save metadata to storage
     */
    saveMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Save verb metadata to storage
     */
    saveVerbMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Get verb metadata from storage
     */
    getVerbMetadata(id: string): Promise<any | null>;
    /**
     * Save noun metadata to storage
     */
    saveNounMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Get multiple metadata objects in batches (CRITICAL: Prevents socket exhaustion)
     * This is the solution to the metadata reading socket exhaustion during initialization
     */
    getMetadataBatch(ids: string[]): Promise<Map<string, any>>;
    /**
     * Get multiple verb metadata objects in batches (prevents socket exhaustion)
     */
    getVerbMetadataBatch(ids: string[]): Promise<Map<string, any>>;
    /**
     * Get noun metadata from storage
     */
    getNounMetadata(id: string): Promise<any | null>;
    /**
     * Get metadata from storage
     */
    getMetadata(id: string): Promise<any | null>;
    /**
     * Clear all data from storage
     */
    clear(): Promise<void>;
    /**
     * Get information about storage usage and capacity
     * Optimized version that uses cached statistics instead of expensive full scans
     */
    getStorageStatus(): Promise<{
        type: string;
        used: number;
        quota: number | null;
        details?: Record<string, any>;
    }>;
    protected statisticsBatchUpdateTimerId: NodeJS.Timeout | null;
    protected statisticsModified: boolean;
    protected lastStatisticsFlushTime: number;
    protected readonly MIN_FLUSH_INTERVAL_MS = 5000;
    protected readonly MAX_FLUSH_DELAY_MS = 30000;
    /**
     * Get the statistics key for a specific date
     * @param date The date to get the key for
     * @returns The statistics key for the specified date
     */
    private getStatisticsKeyForDate;
    /**
     * Get the current statistics key
     * @returns The current statistics key
     */
    private getCurrentStatisticsKey;
    /**
     * Get the legacy statistics key (DEPRECATED - /index folder is auto-cleaned)
     * @returns The legacy statistics key
     * @deprecated Legacy /index folder is automatically cleaned on initialization
     */
    private getLegacyStatisticsKey;
    /**
     * Schedule a batch update of statistics
     */
    protected scheduleBatchUpdate(): void;
    /**
     * Flush statistics to storage with distributed locking
     */
    protected flushStatistics(): Promise<void>;
    /**
     * Merge statistics from storage with local statistics
     * @param storageStats Statistics from storage
     * @param localStats Local statistics to merge
     * @returns Merged statistics data
     */
    private mergeStatistics;
    /**
     * Save statistics data to storage
     * @param statistics The statistics data to save
     */
    protected saveStatisticsData(statistics: StatisticsData): Promise<void>;
    /**
     * Get statistics data from storage
     * @returns Promise that resolves to the statistics data or null if not found
     */
    protected getStatisticsData(): Promise<StatisticsData | null>;
    /**
     * Check if we should try yesterday's statistics file
     * Only try within 2 hours of midnight to avoid unnecessary calls
     */
    private shouldTryYesterday;
    /**
     * Get yesterday's date
     */
    private getYesterday;
    /**
     * Try to get statistics from a specific key
     * @param key The key to try to get statistics from
     * @returns The statistics data or null if not found
     */
    private tryGetStatisticsFromKey;
    /**
     * Append an entry to the change log for efficient synchronization
     * @param entry The change log entry to append
     */
    private appendToChangeLog;
    /**
     * Get changes from the change log since a specific timestamp
     * @param sinceTimestamp Timestamp to get changes since
     * @param maxEntries Maximum number of entries to return (default: 1000)
     * @returns Array of change log entries
     */
    getChangesSince(sinceTimestamp: number, maxEntries?: number): Promise<ChangeLogEntry[]>;
    /**
     * Clean up old change log entries to prevent unlimited growth
     * @param olderThanTimestamp Remove entries older than this timestamp
     */
    cleanupOldChangeLogs(olderThanTimestamp: number): Promise<void>;
    /**
     * Sample-based storage estimation as fallback when statistics unavailable
     * Much faster than full scans - samples first 50 objects per prefix
     */
    private getSampleBasedStorageEstimate;
    /**
     * Acquire a distributed lock for coordinating operations across multiple instances
     * @param lockKey The key to lock on
     * @param ttl Time to live for the lock in milliseconds (default: 30 seconds)
     * @returns Promise that resolves to true if lock was acquired, false otherwise
     */
    private acquireLock;
    /**
     * Release a distributed lock
     * @param lockKey The key to unlock
     * @param lockValue The value used when acquiring the lock (for verification)
     * @returns Promise that resolves when lock is released
     */
    private releaseLock;
    /**
     * Clean up expired locks to prevent lock leakage
     * This method should be called periodically
     */
    private cleanupExpiredLocks;
    /**
     * Get nouns with pagination support
     * @param options Pagination options
     * @returns Promise that resolves to a paginated result of nouns
     */
    getNounsWithPagination(options?: {
        limit?: number;
        cursor?: string;
        filter?: {
            nounType?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<{
        items: HNSWNoun[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
}
