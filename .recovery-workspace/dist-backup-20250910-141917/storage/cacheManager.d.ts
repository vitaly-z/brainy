/**
 * Multi-level Cache Manager
 *
 * Implements a three-level caching strategy:
 * - Level 1: Hot cache (most accessed nodes) - RAM (automatically detecting and adjusting in each environment)
 * - Level 2: Warm cache (recent nodes) - OPFS, Filesystem or S3 depending on environment
 * - Level 3: Cold storage (all nodes) - OPFS, Filesystem or S3 depending on environment
 */
import { HNSWNoun, GraphVerb, HNSWVerb } from '../coreTypes.js';
declare global {
    interface Navigator {
        deviceMemory?: number;
    }
    interface WorkerGlobalScope {
        storage?: {
            getDirectory?: () => Promise<any>;
            [key: string]: any;
        };
    }
}
type HNSWNode = HNSWNoun;
type Edge = GraphVerb;
interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    maxSize: number;
    hotCacheSize: number;
    warmCacheSize: number;
    hotCacheHits: number;
    hotCacheMisses: number;
    warmCacheHits: number;
    warmCacheMisses: number;
}
/**
 * Multi-level cache manager for efficient data access
 */
export declare class CacheManager<T extends HNSWNode | Edge | HNSWVerb> {
    private hotCache;
    private stats;
    private environment;
    private warmStorageType;
    private coldStorageType;
    private hotCacheMaxSize;
    private hotCacheEvictionThreshold;
    private warmCacheTTL;
    private batchSize;
    private autoTune;
    private lastAutoTuneTime;
    private autoTuneInterval;
    private storageStatistics;
    private warmStorage;
    private coldStorage;
    private options;
    /**
     * Initialize the cache manager
     * @param options Configuration options
     */
    constructor(options?: {
        hotCacheMaxSize?: number;
        hotCacheEvictionThreshold?: number;
        warmCacheTTL?: number;
        batchSize?: number;
        autoTune?: boolean;
        warmStorage?: any;
        coldStorage?: any;
        readOnly?: boolean;
        environmentConfig?: {
            node?: {
                hotCacheMaxSize?: number;
                hotCacheEvictionThreshold?: number;
                warmCacheTTL?: number;
                batchSize?: number;
            };
            browser?: {
                hotCacheMaxSize?: number;
                hotCacheEvictionThreshold?: number;
                warmCacheTTL?: number;
                batchSize?: number;
            };
            worker?: {
                hotCacheMaxSize?: number;
                hotCacheEvictionThreshold?: number;
                warmCacheTTL?: number;
                batchSize?: number;
            };
            [key: string]: {
                hotCacheMaxSize?: number;
                hotCacheEvictionThreshold?: number;
                warmCacheTTL?: number;
                batchSize?: number;
            } | undefined;
        };
    });
    /**
     * Detect the current environment
     */
    private detectEnvironment;
    /**
     * Detect the optimal cache size based on available memory and operating mode
     *
     * Enhanced to better handle large datasets in S3 or other storage:
     * - Increases cache size for read-only mode
     * - Adjusts based on total dataset size when available
     * - Provides more aggressive caching for large datasets
     * - Optimizes memory usage based on environment
     */
    private detectOptimalCacheSize;
    /**
     * Async version of detectOptimalCacheSize that uses dynamic imports
     * to access system information in Node.js environments
     *
     * This method provides more accurate memory detection by using
     * the OS module's dynamic import in Node.js environments
     */
    private detectOptimalCacheSizeAsync;
    /**
     * Detects available memory across different environments
     *
     * This method uses different techniques to detect memory in:
     * - Node.js: Uses the OS module with dynamic import
     * - Browser: Uses performance.memory or navigator.deviceMemory
     * - Worker: Uses performance.memory if available
     *
     * @returns An object with totalMemory and freeMemory in bytes, or null if detection fails
     */
    private detectAvailableMemory;
    /**
     * Tune cache parameters based on statistics and environment
     * This method is called periodically if auto-tuning is enabled
     *
     * The auto-tuning process:
     * 1. Retrieves storage statistics if available
     * 2. Tunes each parameter based on statistics and environment
     * 3. Logs the tuned parameters if debug is enabled
     *
     * Auto-tuning helps optimize cache performance by adapting to:
     * - The current environment (Node.js, browser, worker)
     * - Available system resources (memory, CPU)
     * - Usage patterns (read-heavy vs. write-heavy workloads)
     * - Cache efficiency (hit/miss ratios)
     */
    private tuneParameters;
    /**
     * Tune hot cache size based on statistics, environment, and operating mode
     *
     * The hot cache size is tuned based on:
     * 1. Available memory in the current environment
     * 2. Total number of nodes and edges in the system
     * 3. Cache hit/miss ratio
     * 4. Operating mode (read-only vs. read-write)
     * 5. Storage type (S3, filesystem, memory)
     *
     * Enhanced algorithm:
     * - Start with a size based on available memory and operating mode
     * - For large datasets in S3 or other remote storage, use more aggressive caching
     * - Adjust based on access patterns (read-heavy vs. write-heavy)
     * - For read-only mode, prioritize cache size over eviction speed
     * - Dynamically adjust based on hit/miss ratio and query patterns
     */
    private tuneHotCacheSize;
    /**
     * Tune eviction threshold based on statistics
     *
     * The eviction threshold determines when items start being evicted from the hot cache.
     * It is tuned based on:
     * 1. Cache hit/miss ratio
     * 2. Operation patterns (read-heavy vs. write-heavy workloads)
     * 3. Memory pressure and available resources
     *
     * Algorithm:
     * - Start with a default threshold of 0.8 (80% of max size)
     * - For high hit ratios, increase the threshold to keep more items in cache
     * - For low hit ratios, decrease the threshold to evict items more aggressively
     * - For read-heavy workloads, use a higher threshold
     * - For write-heavy workloads, use a lower threshold
     * - Under memory pressure, use a lower threshold to conserve resources
     *
     * @param cacheStats Optional cache statistics for more adaptive tuning
     */
    private tuneEvictionThreshold;
    /**
     * Tune warm cache TTL based on statistics
     *
     * The warm cache TTL determines how long items remain in the warm cache.
     * It is tuned based on:
     * 1. Update frequency from operation statistics
     * 2. Warm cache hit/miss ratio
     * 3. Access patterns and frequency
     * 4. Available storage resources
     *
     * Algorithm:
     * - Start with a default TTL of 24 hours
     * - For frequently updated data, use a shorter TTL
     * - For rarely updated data, use a longer TTL
     * - For frequently accessed data, use a longer TTL
     * - For rarely accessed data, use a shorter TTL
     * - Under storage pressure, use a shorter TTL
     *
     * @param cacheStats Optional cache statistics for more adaptive tuning
     */
    private tuneWarmCacheTTL;
    /**
     * Tune batch size based on environment, statistics, and operating mode
     *
     * The batch size determines how many items are processed in a single batch
     * for operations like prefetching. It is tuned based on:
     * 1. Current environment (Node.js, browser, worker)
     * 2. Available memory
     * 3. Operation patterns
     * 4. Cache hit/miss ratio
     * 5. Operating mode (read-only vs. read-write)
     * 6. Storage type (S3, filesystem, memory)
     * 7. Dataset size
     * 8. Cache efficiency and access patterns
     *
     * Enhanced algorithm:
     * - Start with a default based on the environment
     * - For large datasets in S3 or other remote storage, use larger batches
     * - For read-only mode, use larger batches to improve throughput
     * - Dynamically adjust based on network latency and throughput
     * - Balance between memory usage and performance
     * - Adapt to cache hit/miss patterns
     *
     * @param cacheStats Optional cache statistics for more adaptive tuning
     */
    private tuneBatchSize;
    /**
     * Detect the appropriate warm storage type based on environment
     */
    private detectWarmStorageType;
    /**
     * Detect the appropriate cold storage type based on environment
     */
    private detectColdStorageType;
    /**
     * Initialize warm storage adapter
     */
    private initializeWarmStorage;
    /**
     * Initialize cold storage adapter
     */
    private initializeColdStorage;
    /**
     * Get an item from cache, trying each level in order
     * @param id The item ID
     * @returns The cached item or null if not found
     */
    get(id: string): Promise<T | null>;
    /**
     * Get an item from warm cache
     * @param id The item ID
     * @returns The cached item or null if not found
     */
    private getFromWarmCache;
    /**
     * Get an item from cold storage
     * @param id The item ID
     * @returns The item or null if not found
     */
    private getFromColdStorage;
    /**
     * Add an item to hot cache
     * @param id The item ID
     * @param item The item to cache
     */
    private addToHotCache;
    /**
     * Add an item to warm cache
     * @param id The item ID
     * @param item The item to cache
     */
    private addToWarmCache;
    /**
     * Evict items from hot cache based on LRU policy
     */
    private evictFromHotCache;
    /**
     * Set an item in all cache levels
     * @param id The item ID
     * @param item The item to cache
     */
    set(id: string, item: T): Promise<void>;
    /**
     * Delete an item from all cache levels
     * @param id The item ID to delete
     */
    delete(id: string): Promise<void>;
    /**
     * Clear all cache levels
     */
    clear(): Promise<void>;
    /**
     * Get cache statistics
     * @returns Cache statistics
     */
    getStats(): CacheStats;
    /**
     * Prefetch items based on ID patterns or relationships
     * @param ids Array of IDs to prefetch
     */
    prefetch(ids: string[]): Promise<void>;
    /**
     * Check if it's time to tune parameters and do so if needed
     * This is called before operations that might benefit from tuned parameters
     *
     * This method serves as a checkpoint for auto-tuning, ensuring that:
     * 1. Parameters are tuned periodically based on the auto-tune interval
     * 2. Tuning happens before critical operations that would benefit from optimized parameters
     * 3. Tuning doesn't happen too frequently, which could impact performance
     *
     * By calling this method before get(), getMany(), and prefetch() operations,
     * we ensure that the cache parameters are optimized for the current workload
     * without adding unnecessary overhead to every operation.
     */
    private checkAndTuneParameters;
    /**
     * Get multiple items at once, optimizing for batch retrieval
     * @param ids Array of IDs to get
     * @returns Map of ID to item
     */
    getMany(ids: string[]): Promise<Map<string, T>>;
    /**
     * Set the storage adapters for warm and cold caches
     * @param warmStorage Warm cache storage adapter
     * @param coldStorage Cold storage adapter
     */
    setStorageAdapters(warmStorage: any, coldStorage: any): void;
}
export {};
