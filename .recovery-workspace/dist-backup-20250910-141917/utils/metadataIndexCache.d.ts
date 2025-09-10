/**
 * MetadataIndexCache - Caches metadata index data for improved performance
 * Reuses the same pattern as SearchCache for consistency
 */
export interface MetadataCacheEntry {
    data: any;
    timestamp: number;
    hits: number;
}
export interface MetadataIndexCacheConfig {
    maxAge?: number;
    maxSize?: number;
    enabled?: boolean;
    hitCountWeight?: number;
}
export declare class MetadataIndexCache {
    private cache;
    private maxAge;
    private maxSize;
    private enabled;
    private hitCountWeight;
    private hits;
    private misses;
    private evictions;
    constructor(config?: MetadataIndexCacheConfig);
    /**
     * Get cached entry
     */
    get(key: string): any | undefined;
    /**
     * Set cache entry
     */
    set(key: string, data: any): void;
    /**
     * Evict least valuable entry based on age and hit count
     */
    private evictLeastValuable;
    /**
     * Invalidate cache entries matching a pattern
     */
    invalidatePattern(pattern: string): void;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        hits: number;
        misses: number;
        hitRate: number;
        evictions: number;
    };
    /**
     * Get estimated memory usage
     */
    getMemoryUsage(): number;
}
