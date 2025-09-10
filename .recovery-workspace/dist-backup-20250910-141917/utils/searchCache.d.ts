/**
 * SearchCache - Caches search results for improved performance
 */
import { SearchResult } from '../coreTypes.js';
export interface CacheEntry<T = any> {
    results: SearchResult<T>[];
    timestamp: number;
    hits: number;
}
export interface SearchCacheConfig {
    maxAge?: number;
    maxSize?: number;
    enabled?: boolean;
    hitCountWeight?: number;
}
export declare class SearchCache<T = any> {
    private cache;
    private maxAge;
    private maxSize;
    private enabled;
    private hitCountWeight;
    private hits;
    private misses;
    private evictions;
    constructor(config?: SearchCacheConfig);
    /**
     * Generate cache key from search parameters
     */
    getCacheKey(query: any, k: number, options?: Record<string, any>): string;
    /**
     * Get cached results if available and not expired
     */
    get(key: string): SearchResult<T>[] | null;
    /**
     * Cache search results
     */
    set(key: string, results: SearchResult<T>[]): void;
    /**
     * Evict the oldest entry based on timestamp and hit count
     */
    private evictOldest;
    /**
     * Clear all cached results
     */
    clear(): void;
    /**
     * Invalidate cache entries that might be affected by data changes
     */
    invalidate(pattern?: string | RegExp): void;
    /**
     * Smart invalidation for real-time data updates
     * Only clears cache if it's getting stale or if data changes significantly
     */
    invalidateOnDataChange(changeType?: 'add' | 'update' | 'delete'): void;
    /**
     * Check if cache entries have expired and remove them
     * This is especially important in distributed scenarios where
     * real-time updates might be delayed or missed
     */
    cleanupExpiredEntries(): number;
    /**
     * Get cache statistics
     */
    getStats(): {
        hits: number;
        misses: number;
        evictions: number;
        hitRate: number;
        size: number;
        maxSize: number;
        enabled: boolean;
    };
    /**
     * Enable or disable caching
     */
    setEnabled(enabled: boolean): void;
    /**
     * Get memory usage estimate in bytes
     */
    getMemoryUsage(): number;
    /**
     * Get current cache configuration
     */
    getConfig(): SearchCacheConfig;
    /**
     * Update cache configuration dynamically
     */
    updateConfig(newConfig: Partial<SearchCacheConfig>): void;
    /**
     * Evict entries if cache exceeds maxSize
     */
    private evictIfNeeded;
}
