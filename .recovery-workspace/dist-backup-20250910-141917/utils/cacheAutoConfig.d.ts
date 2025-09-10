/**
 * Intelligent cache auto-configuration system
 * Adapts cache settings based on environment, usage patterns, and storage type
 */
import { SearchCacheConfig } from './searchCache.js';
import { BrainyConfig } from '../brainy.js';
export interface CacheUsageStats {
    totalQueries: number;
    repeatQueries: number;
    avgQueryTime: number;
    memoryPressure: number;
    storageType: 'memory' | 'opfs' | 's3' | 'filesystem';
    isDistributed: boolean;
    changeFrequency: number;
    readWriteRatio: number;
}
export interface AutoConfigResult {
    cacheConfig: SearchCacheConfig;
    realtimeConfig: NonNullable<BrainyConfig['realtimeUpdates']>;
    reasoning: string[];
}
export declare class CacheAutoConfigurator {
    private stats;
    private configHistory;
    private lastOptimization;
    /**
     * Auto-detect optimal cache configuration based on current conditions
     */
    autoDetectOptimalConfig(storageConfig?: BrainyConfig['storage'], currentStats?: Partial<CacheUsageStats>): AutoConfigResult;
    /**
     * Dynamically adjust configuration based on runtime performance
     */
    adaptConfiguration(currentConfig: SearchCacheConfig, performanceMetrics: {
        hitRate: number;
        avgResponseTime: number;
        memoryUsage: number;
        externalChangesDetected: number;
        timeSinceLastChange: number;
    }): AutoConfigResult | null;
    /**
     * Get recommended configuration for specific use case
     */
    getRecommendedConfig(useCase: 'high-consistency' | 'balanced' | 'performance-first'): AutoConfigResult;
    /**
     * Learn from usage patterns and improve recommendations
     */
    learnFromUsage(usageData: {
        queryPatterns: string[];
        responseTime: number;
        cacheHits: number;
        totalQueries: number;
        dataChanges: number;
        timeWindow: number;
    }): void;
    private detectEnvironment;
    private generateOptimalConfig;
    private calculateRealtimeConfig;
    private detectMemoryConstraints;
    /**
     * Get human-readable explanation of current configuration
     */
    getConfigExplanation(config: AutoConfigResult): string;
}
