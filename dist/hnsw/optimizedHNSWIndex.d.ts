/**
 * Optimized HNSW Index for Large-Scale Vector Search
 * Implements dynamic parameter tuning and performance optimizations
 */
import { DistanceFunction, HNSWConfig, Vector, VectorDocument } from '../coreTypes.js';
import { HNSWIndex } from './hnswIndex.js';
export interface OptimizedHNSWConfig extends HNSWConfig {
    dynamicParameterTuning?: boolean;
    targetSearchLatency?: number;
    targetRecall?: number;
    maxNodes?: number;
    memoryBudget?: number;
    diskCacheEnabled?: boolean;
    compressionEnabled?: boolean;
    performanceTracking?: boolean;
    adaptiveEfSearch?: boolean;
    levelMultiplier?: number;
    seedConnections?: number;
    pruningStrategy?: 'simple' | 'diverse' | 'hybrid';
}
interface PerformanceMetrics {
    averageSearchTime: number;
    averageRecall: number;
    memoryUsage: number;
    indexSize: number;
    apiCalls: number;
    cacheHitRate: number;
}
interface DynamicParameters {
    efSearch: number;
    efConstruction: number;
    M: number;
    ml: number;
}
/**
 * Optimized HNSW Index with dynamic parameter tuning for large datasets
 */
export declare class OptimizedHNSWIndex extends HNSWIndex {
    private optimizedConfig;
    private performanceMetrics;
    private dynamicParams;
    private searchHistory;
    private parameterTuningInterval?;
    constructor(config?: Partial<OptimizedHNSWConfig>, distanceFunction?: DistanceFunction);
    /**
     * Optimized search with dynamic parameter adjustment
     */
    search(queryVector: Vector, k?: number, filter?: (id: string) => Promise<boolean>): Promise<Array<[string, number]>>;
    /**
     * Dynamically adjust efSearch based on performance requirements
     */
    private adjustEfSearch;
    /**
     * Record search performance metrics
     */
    private recordSearchMetrics;
    /**
     * Check memory usage and trigger optimizations
     */
    private checkMemoryUsage;
    /**
     * Compress index to reduce memory usage (placeholder)
     */
    private compressIndex;
    /**
     * Start automatic parameter tuning
     */
    private startParameterTuning;
    /**
     * Automatic parameter tuning based on performance metrics
     */
    private tuneParameters;
    /**
     * Get optimized configuration recommendations for current dataset size
     */
    getOptimizedConfig(): OptimizedHNSWConfig;
    /**
     * Get current performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics & {
        currentParams: DynamicParameters;
        searchHistorySize: number;
    };
    /**
     * Apply optimized bulk insertion strategy
     */
    bulkInsert(items: VectorDocument[]): Promise<string[]>;
    /**
     * Optimize insertion order to improve index quality
     */
    private optimizeInsertionOrder;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
export {};
