/**
 * Enhanced Multi-Level Cache Manager with Predictive Prefetching
 * Optimized for HNSW search patterns and large-scale vector operations
 */
import { HNSWNoun, HNSWVerb } from '../coreTypes.js';
import { BatchS3Operations } from './adapters/batchS3Operations.js';
declare enum PrefetchStrategy {
    GRAPH_CONNECTIVITY = "connectivity",
    VECTOR_SIMILARITY = "similarity",
    ACCESS_PATTERN = "pattern",
    HYBRID = "hybrid"
}
interface EnhancedCacheConfig {
    hotCacheMaxSize?: number;
    hotCacheEvictionThreshold?: number;
    warmCacheMaxSize?: number;
    warmCacheTTL?: number;
    prefetchEnabled?: boolean;
    prefetchStrategy?: PrefetchStrategy;
    prefetchBatchSize?: number;
    predictionLookahead?: number;
    similarityThreshold?: number;
    maxSimilarityDistance?: number;
    backgroundOptimization?: boolean;
    statisticsCollection?: boolean;
}
/**
 * Enhanced cache manager with intelligent prefetching for HNSW operations
 * Provides multi-level caching optimized for vector search workloads
 */
export declare class EnhancedCacheManager<T extends HNSWNoun | HNSWVerb> {
    private hotCache;
    private warmCache;
    private prefetchQueue;
    private accessPatterns;
    private vectorIndex;
    private config;
    private batchOperations?;
    private storageAdapter?;
    private prefetchInProgress;
    private stats;
    constructor(config?: EnhancedCacheConfig);
    /**
     * Set storage adapters for warm/cold storage operations
     */
    setStorageAdapters(storageAdapter: any, batchOperations?: BatchS3Operations): void;
    /**
     * Get item with intelligent prefetching
     */
    get(id: string): Promise<T | null>;
    /**
     * Get multiple items efficiently with batch operations
     */
    getMany(ids: string[]): Promise<Map<string, T>>;
    /**
     * Set item in cache with metadata
     */
    set(id: string, item: T): Promise<void>;
    /**
     * Intelligent prefetch based on access patterns and graph structure
     */
    private schedulePrefetch;
    /**
     * Predict next nodes based on graph connectivity
     */
    private predictByConnectivity;
    /**
     * Predict next nodes based on vector similarity
     */
    private predictBySimilarity;
    /**
     * Predict based on historical access patterns
     */
    private predictByAccessPattern;
    /**
     * Hybrid prediction combining multiple strategies
     */
    private hybridPrediction;
    /**
     * Execute prefetch operation in background
     */
    private executePrefetch;
    /**
     * Load item from storage adapter
     */
    private loadFromStorage;
    /**
     * Promote frequently accessed item to hot cache
     */
    private promoteToHotCache;
    /**
     * Evict least recently used items from hot cache
     */
    private evictFromHotCache;
    /**
     * Evict expired items from warm cache
     */
    private evictFromWarmCache;
    /**
     * Record access pattern for prediction
     */
    private recordAccess;
    /**
     * Extract connected node IDs from HNSW item
     */
    private extractConnectedNodes;
    /**
     * Check if cache entry is expired
     */
    private isExpired;
    /**
     * Calculate cosine similarity between vectors
     */
    private cosineSimilarity;
    /**
     * Calculate pattern similarity between access patterns
     */
    private patternSimilarity;
    /**
     * Start background optimization process
     */
    private startBackgroundOptimization;
    /**
     * Run background optimization tasks
     */
    private runBackgroundOptimization;
    /**
     * Get cache statistics
     */
    getStats(): typeof this.stats & {
        hotCacheSize: number;
        warmCacheSize: number;
        prefetchQueueSize: number;
        accessPatternsTracked: number;
    };
    /**
     * Clear all caches
     */
    clear(): void;
}
export {};
