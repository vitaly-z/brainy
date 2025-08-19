/**
 * Automatic Configuration System for Brainy Vector Database
 * Detects environment, resources, and data patterns to provide optimal settings
 */
export interface AutoConfigResult {
    environment: 'browser' | 'nodejs' | 'serverless' | 'unknown';
    availableMemory: number;
    cpuCores: number;
    threadingAvailable: boolean;
    persistentStorageAvailable: boolean;
    s3StorageDetected: boolean;
    recommendedConfig: {
        expectedDatasetSize: number;
        maxMemoryUsage: number;
        targetSearchLatency: number;
        enablePartitioning: boolean;
        enableCompression: boolean;
        enableDistributedSearch: boolean;
        enablePredictiveCaching: boolean;
        partitionStrategy: 'semantic' | 'hash';
        maxNodesPerPartition: number;
        semanticClusters: number;
    };
    optimizationFlags: {
        useMemoryMapping: boolean;
        aggressiveCaching: boolean;
        backgroundOptimization: boolean;
        compressionLevel: 'none' | 'light' | 'aggressive';
    };
}
export interface DatasetAnalysis {
    estimatedSize: number;
    vectorDimension?: number;
    growthRate?: number;
    accessPatterns?: 'read-heavy' | 'write-heavy' | 'balanced';
}
/**
 * Automatic configuration system that detects environment and optimizes settings
 */
export declare class AutoConfiguration {
    private static instance;
    private cachedConfig;
    private datasetStats;
    private constructor();
    static getInstance(): AutoConfiguration;
    /**
     * Detect environment and generate optimal configuration
     */
    detectAndConfigure(hints?: {
        expectedDataSize?: number;
        s3Available?: boolean;
        memoryBudget?: number;
    }): Promise<AutoConfigResult>;
    /**
     * Update configuration based on runtime dataset analysis
     */
    adaptToDataset(analysis: DatasetAnalysis): Promise<AutoConfigResult>;
    /**
     * Learn from performance metrics and adjust configuration
     */
    learnFromPerformance(metrics: {
        averageSearchTime: number;
        memoryUsage: number;
        cacheHitRate: number;
        errorRate: number;
    }): Promise<Partial<AutoConfigResult['recommendedConfig']>>;
    /**
     * Get minimal configuration for quick setup
     */
    getQuickSetupConfig(scenario: 'small' | 'medium' | 'large' | 'enterprise'): Promise<{
        expectedDatasetSize: number;
        maxMemoryUsage: number;
        targetSearchLatency: number;
        s3Required: boolean;
    }>;
    /**
     * Detect the current runtime environment
     */
    private detectEnvironment;
    /**
     * Detect available system resources
     */
    private detectResources;
    /**
     * Detect available storage capabilities
     */
    private detectStorageCapabilities;
    /**
     * Generate recommended configuration based on detected environment and resources
     */
    private generateRecommendedConfig;
    /**
     * Generate optimization flags based on environment and resources
     */
    private generateOptimizationFlags;
    /**
     * Adapt configuration based on actual dataset analysis
     */
    private adaptConfigurationToData;
    /**
     * Estimate dataset size if not provided
     */
    private estimateDatasetSize;
    /**
     * Reset cached configuration (for testing or manual refresh)
     */
    resetCache(): void;
}
/**
 * Convenience function for quick auto-configuration
 */
export declare function autoConfigureBrainy(hints?: {
    expectedDataSize?: number;
    s3Available?: boolean;
    memoryBudget?: number;
}): Promise<AutoConfigResult>;
/**
 * Get quick setup configuration for common scenarios
 */
export declare function getQuickSetup(scenario: 'small' | 'medium' | 'large' | 'enterprise'): Promise<{
    expectedDatasetSize: number;
    maxMemoryUsage: number;
    targetSearchLatency: number;
    s3Required: boolean;
}>;
