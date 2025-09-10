/**
 * Scaled HNSW System - Integration of All Optimization Strategies
 * Production-ready system for handling millions of vectors with sub-second search
 */
import { Vector, VectorDocument } from '../coreTypes.js';
import { PartitionConfig } from './partitionedHNSWIndex.js';
import { OptimizedHNSWConfig } from './optimizedHNSWIndex.js';
import { SearchStrategy } from './distributedSearch.js';
export interface ScaledHNSWConfig {
    expectedDatasetSize?: number;
    maxMemoryUsage?: number;
    targetSearchLatency?: number;
    s3Config?: {
        bucketName: string;
        region: string;
        endpoint?: string;
        accessKeyId?: string;
        secretAccessKey?: string;
    };
    autoConfigureEnvironment?: boolean;
    learningEnabled?: boolean;
    enablePartitioning?: boolean;
    enableCompression?: boolean;
    enableDistributedSearch?: boolean;
    enablePredictiveCaching?: boolean;
    partitionConfig?: Partial<PartitionConfig>;
    hnswConfig?: Partial<OptimizedHNSWConfig>;
    readOnlyMode?: boolean;
}
/**
 * High-performance HNSW system with all optimizations integrated
 * Handles datasets from thousands to millions of vectors
 */
export declare class ScaledHNSWSystem {
    private config;
    private autoConfig;
    private partitionedIndex?;
    private distributedSearch?;
    private cacheManager?;
    private batchOperations?;
    private readOnlyOptimizations?;
    private performanceMetrics;
    constructor(config?: ScaledHNSWConfig);
    /**
     * Initialize the optimized system based on configuration
     */
    private initializeOptimizedSystem;
    /**
     * Calculate optimal configuration based on dataset size and constraints
     */
    private calculateOptimalConfiguration;
    /**
     * Add vector to the scaled system
     */
    addVector(item: VectorDocument): Promise<string>;
    /**
     * Bulk insert vectors with optimizations
     */
    bulkInsert(items: VectorDocument[]): Promise<string[]>;
    /**
     * High-performance vector search with all optimizations
     */
    search(queryVector: Vector, k?: number, options?: {
        strategy?: SearchStrategy;
        useCache?: boolean;
        maxPartitions?: number;
    }): Promise<Array<[string, number]>>;
    /**
     * Get system performance metrics
     */
    getPerformanceMetrics(): typeof this.performanceMetrics & {
        partitionStats?: any;
        cacheStats?: any;
        compressionStats?: any;
        distributedSearchStats?: any;
    };
    /**
     * Optimize insertion order for better index quality
     */
    private optimizeInsertionOrder;
    /**
     * Calculate optimal batch size based on system resources
     */
    private calculateOptimalBatchSize;
    /**
     * Update search performance metrics
     */
    private updateSearchMetrics;
    /**
     * Estimate current memory usage
     */
    private estimateMemoryUsage;
    /**
     * Generate performance report
     */
    generatePerformanceReport(): string;
    /**
     * Get overall system status
     */
    private getSystemStatus;
    /**
     * Check if adaptive learning should be triggered
     */
    private shouldTriggerLearning;
    /**
     * Adaptively learn from performance and adjust configuration
     */
    private adaptivelyLearnFromPerformance;
    /**
     * Update dataset analysis for better auto-configuration
     */
    updateDatasetAnalysis(vectorCount: number, vectorDimension?: number): Promise<void>;
    /**
     * Infer access patterns from current metrics
     */
    private inferAccessPatterns;
    /**
     * Cleanup system resources
     */
    cleanup(): void;
}
/**
 * Create a fully auto-configured Brainy system - minimal setup required!
 * Just provide S3 config if you want persistence beyond the current session
 */
export declare function createAutoBrainy(s3Config?: {
    bucketName: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}): ScaledHNSWSystem;
/**
 * Create a Brainy system optimized for specific scenarios
 */
export declare function createQuickBrainy(scenario: 'small' | 'medium' | 'large' | 'enterprise', s3Config?: {
    bucketName: string;
    region?: string;
}): Promise<ScaledHNSWSystem>;
/**
 * Legacy factory function - still works but consider using createAutoBrainy() instead
 */
export declare function createScaledHNSWSystem(config?: ScaledHNSWConfig): ScaledHNSWSystem;
