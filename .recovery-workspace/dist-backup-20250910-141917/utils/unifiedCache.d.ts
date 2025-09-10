/**
 * UnifiedCache - Single cache for both HNSW and MetadataIndex
 * Prevents resource competition with cost-aware eviction
 */
export interface CacheItem {
    key: string;
    type: 'hnsw' | 'metadata' | 'embedding' | 'other';
    data: any;
    size: number;
    rebuildCost: number;
    lastAccess: number;
    accessCount: number;
}
export interface UnifiedCacheConfig {
    maxSize?: number;
    enableRequestCoalescing?: boolean;
    enableFairnessCheck?: boolean;
    fairnessCheckInterval?: number;
    persistPatterns?: boolean;
}
export declare class UnifiedCache {
    private cache;
    private access;
    private loadingPromises;
    private typeAccessCounts;
    private totalAccessCount;
    private currentSize;
    private readonly maxSize;
    private readonly config;
    constructor(config?: UnifiedCacheConfig);
    /**
     * Get item from cache with request coalescing
     */
    get(key: string, loadFn?: () => Promise<any>): Promise<any>;
    /**
     * Set item in cache with cost-aware eviction
     */
    set(key: string, data: any, type: 'hnsw' | 'metadata' | 'embedding' | 'other', size: number, rebuildCost?: number): void;
    /**
     * Evict item with lowest value (access count / rebuild cost)
     */
    private evictLowestValue;
    /**
     * Size-aware eviction - try to match needed size
     */
    evictForSize(bytesNeeded: number): boolean;
    /**
     * Fairness monitoring - prevent one type from hogging cache
     */
    private startFairnessMonitor;
    private checkFairness;
    /**
     * Force evict items of a specific type
     */
    private evictType;
    /**
     * Delete specific item from cache
     */
    delete(key: string): boolean;
    /**
     * Clear cache or specific type
     */
    clear(type?: 'hnsw' | 'metadata' | 'embedding' | 'other'): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        totalSize: number;
        maxSize: number;
        utilization: number;
        itemCount: number;
        typeSizes: {
            hnsw: number;
            metadata: number;
            embedding: number;
            other: number;
        };
        typeCounts: {
            hnsw: number;
            metadata: number;
            embedding: number;
            other: number;
        };
        typeAccessCounts: {
            hnsw: number;
            metadata: number;
            embedding: number;
            other: number;
        };
        totalAccessCount: number;
        hitRate: number;
    };
    /**
     * Save access patterns for cold start optimization
     */
    saveAccessPatterns(): Promise<any>;
    /**
     * Load access patterns for warm start
     */
    loadAccessPatterns(patterns: any): Promise<void>;
}
export declare function getGlobalCache(config?: UnifiedCacheConfig): UnifiedCache;
export declare function clearGlobalCache(): void;
