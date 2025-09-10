/**
 * Universal Display Augmentation - Intelligent Caching System
 *
 * High-performance LRU cache with smart eviction and batch optimization
 * Designed for minimal memory footprint and maximum hit ratio
 */
import type { ComputedDisplayFields, DisplayAugmentationStats } from './types.js';
/**
 * LRU (Least Recently Used) Cache for computed display fields
 * Optimized for the display augmentation use case
 */
export declare class DisplayCache {
    private cache;
    private readonly maxSize;
    private stats;
    constructor(maxSize?: number);
    /**
     * Get cached display fields with LRU update
     * @param key Cache key
     * @returns Cached fields or null if not found
     */
    get(key: string): ComputedDisplayFields | null;
    /**
     * Store computed display fields in cache
     * @param key Cache key
     * @param fields Computed display fields
     * @param computationTime Time taken to compute (for stats)
     */
    set(key: string, fields: ComputedDisplayFields, computationTime?: number): void;
    /**
     * Check if a key exists in cache without affecting LRU order
     * @param key Cache key
     * @returns True if key exists
     */
    has(key: string): boolean;
    /**
     * Generate cache key from data
     * @param id Entity ID (preferred)
     * @param data Fallback data for key generation
     * @param entityType Type of entity (noun/verb)
     * @returns Cache key string
     */
    generateKey(id?: string, data?: any, entityType?: 'noun' | 'verb'): string;
    /**
     * Clear all cached entries
     */
    clear(): void;
    /**
     * Get cache statistics
     * @returns Cache performance statistics
     */
    getStats(): DisplayAugmentationStats;
    /**
     * Get current cache size
     * @returns Number of cached entries
     */
    size(): number;
    /**
     * Get cache capacity
     * @returns Maximum cache size
     */
    capacity(): number;
    /**
     * Evict least recently used entry
     */
    private evictOldest;
    /**
     * Simple hash function for cache keys
     * @param str String to hash
     * @returns Simple hash number
     */
    private simpleHash;
    /**
     * Optimize cache by removing stale entries
     * Called periodically to maintain cache health
     */
    optimizeCache(): void;
    /**
     * Precompute display fields for a batch of entities
     * @param entities Array of entities with their compute functions
     * @returns Promise resolving when batch is complete
     */
    batchPrecompute<T>(entities: Array<{
        key: string;
        computeFn: () => Promise<ComputedDisplayFields>;
    }>): Promise<void>;
}
/**
 * Request deduplicator for batch processing
 * Prevents duplicate computations for the same data
 */
export declare class RequestDeduplicator {
    private pendingRequests;
    private readonly batchSize;
    constructor(batchSize?: number);
    /**
     * Deduplicate computation request
     * @param key Unique key for the computation
     * @param computeFn Function to compute the result
     * @returns Promise that resolves to the computed fields
     */
    deduplicate(key: string, computeFn: () => Promise<ComputedDisplayFields>): Promise<ComputedDisplayFields>;
    /**
     * Get number of pending requests
     * @returns Number of pending computations
     */
    getPendingCount(): number;
    /**
     * Clear all pending requests
     */
    clear(): void;
    /**
     * Shutdown the deduplicator
     */
    shutdown(): void;
}
/**
 * Get global display cache instance
 * @param maxSize Optional cache size (only used on first call)
 * @returns Shared display cache instance
 */
export declare function getGlobalDisplayCache(maxSize?: number): DisplayCache;
/**
 * Clear global cache (for testing or memory management)
 */
export declare function clearGlobalDisplayCache(): void;
/**
 * Shutdown global cache and cleanup
 */
export declare function shutdownGlobalDisplayCache(): void;
