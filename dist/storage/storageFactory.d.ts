/**
 * Storage Factory
 * Creates the appropriate storage adapter based on the environment and configuration
 */
import { StorageAdapter } from '../coreTypes.js';
import { MemoryStorage } from './adapters/memoryStorage.js';
import { OPFSStorage } from './adapters/opfsStorage.js';
import { S3CompatibleStorage, R2Storage } from './adapters/s3CompatibleStorage.js';
import { OperationConfig } from '../utils/operationUtils.js';
/**
 * Options for creating a storage adapter
 */
export interface StorageOptions {
    /**
     * The type of storage to use
     * - 'auto': Automatically select the best storage adapter based on the environment
     * - 'memory': Use in-memory storage
     * - 'opfs': Use Origin Private File System storage (browser only)
     * - 'filesystem': Use file system storage (Node.js only)
     * - 's3': Use Amazon S3 storage
     * - 'r2': Use Cloudflare R2 storage
     * - 'gcs': Use Google Cloud Storage
     */
    type?: 'auto' | 'memory' | 'opfs' | 'filesystem' | 's3' | 'r2' | 'gcs';
    /**
     * Force the use of memory storage even if other storage types are available
     */
    forceMemoryStorage?: boolean;
    /**
     * Force the use of file system storage even if other storage types are available
     */
    forceFileSystemStorage?: boolean;
    /**
     * Request persistent storage permission from the user (browser only)
     */
    requestPersistentStorage?: boolean;
    /**
     * Root directory for file system storage (Node.js only)
     */
    rootDirectory?: string;
    /**
     * Configuration for Amazon S3 storage
     */
    s3Storage?: {
        /**
         * S3 bucket name
         */
        bucketName: string;
        /**
         * AWS region (e.g., 'us-east-1')
         */
        region?: string;
        /**
         * AWS access key ID
         */
        accessKeyId: string;
        /**
         * AWS secret access key
         */
        secretAccessKey: string;
        /**
         * AWS session token (optional)
         */
        sessionToken?: string;
    };
    /**
     * Configuration for Cloudflare R2 storage
     */
    r2Storage?: {
        /**
         * R2 bucket name
         */
        bucketName: string;
        /**
         * Cloudflare account ID
         */
        accountId: string;
        /**
         * R2 access key ID
         */
        accessKeyId: string;
        /**
         * R2 secret access key
         */
        secretAccessKey: string;
    };
    /**
     * Configuration for Google Cloud Storage
     */
    gcsStorage?: {
        /**
         * GCS bucket name
         */
        bucketName: string;
        /**
         * GCS region (e.g., 'us-central1')
         */
        region?: string;
        /**
         * GCS access key ID
         */
        accessKeyId: string;
        /**
         * GCS secret access key
         */
        secretAccessKey: string;
        /**
         * GCS endpoint (e.g., 'https://storage.googleapis.com')
         */
        endpoint?: string;
    };
    /**
     * Configuration for custom S3-compatible storage
     */
    customS3Storage?: {
        /**
         * S3-compatible bucket name
         */
        bucketName: string;
        /**
         * S3-compatible region
         */
        region?: string;
        /**
         * S3-compatible endpoint URL
         */
        endpoint: string;
        /**
         * S3-compatible access key ID
         */
        accessKeyId: string;
        /**
         * S3-compatible secret access key
         */
        secretAccessKey: string;
        /**
         * S3-compatible service type (for logging and error messages)
         */
        serviceType?: string;
    };
    /**
     * Operation configuration for timeout and retry behavior
     */
    operationConfig?: OperationConfig;
    /**
     * Cache configuration for optimizing data access
     * Particularly important for S3 and other remote storage
     */
    cacheConfig?: {
        /**
         * Maximum size of the hot cache (most frequently accessed items)
         * For large datasets, consider values between 5000-50000 depending on available memory
         */
        hotCacheMaxSize?: number;
        /**
         * Threshold at which to start evicting items from the hot cache
         * Expressed as a fraction of hotCacheMaxSize (0.0 to 1.0)
         * Default: 0.8 (start evicting when cache is 80% full)
         */
        hotCacheEvictionThreshold?: number;
        /**
         * Time-to-live for items in the warm cache in milliseconds
         * Default: 3600000 (1 hour)
         */
        warmCacheTTL?: number;
        /**
         * Batch size for operations like prefetching
         * Larger values improve throughput but use more memory
         */
        batchSize?: number;
        /**
         * Whether to enable auto-tuning of cache parameters
         * When true, the system will automatically adjust cache sizes based on usage patterns
         * Default: true
         */
        autoTune?: boolean;
        /**
         * The interval (in milliseconds) at which to auto-tune cache parameters
         * Only applies when autoTune is true
         * Default: 60000 (1 minute)
         */
        autoTuneInterval?: number;
        /**
         * Whether the storage is in read-only mode
         * This affects cache sizing and prefetching strategies
         */
        readOnly?: boolean;
    };
}
/**
 * Create a storage adapter based on the environment and configuration
 * @param options Options for creating the storage adapter
 * @returns Promise that resolves to a storage adapter
 */
export declare function createStorage(options?: StorageOptions): Promise<StorageAdapter>;
/**
 * Export storage adapters
 */
export { MemoryStorage, OPFSStorage, S3CompatibleStorage, R2Storage };
