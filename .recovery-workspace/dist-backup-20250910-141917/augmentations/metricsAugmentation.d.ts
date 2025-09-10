/**
 * Metrics Augmentation - Optional Performance & Usage Metrics
 *
 * Replaces the hardcoded StatisticsCollector in Brainy with an optional augmentation.
 * Tracks performance metrics, usage patterns, and system statistics.
 *
 * Zero-config: Automatically enabled for observability
 * Can be disabled or customized via augmentation registry
 */
import { BaseAugmentation } from './brainyAugmentation.js';
export interface MetricsConfig {
    enabled?: boolean;
    trackSearches?: boolean;
    trackContentTypes?: boolean;
    trackVerbTypes?: boolean;
    trackStorageSizes?: boolean;
    persistMetrics?: boolean;
    metricsInterval?: number;
}
/**
 * MetricsAugmentation - Makes metrics collection optional and pluggable
 *
 * Features:
 * - Performance tracking (search latency, throughput)
 * - Usage patterns (content types, verb types)
 * - Storage metrics (sizes, counts)
 * - Zero-config with smart defaults
 */
export declare class MetricsAugmentation extends BaseAugmentation {
    readonly metadata: "readonly";
    readonly name = "metrics";
    readonly timing: "after";
    operations: ("add" | "update" | "search" | "find" | "similar" | "delete" | "relate" | "unrelate" | "clear" | "all")[];
    readonly priority = 40;
    private statisticsCollector;
    protected config: MetricsConfig;
    private metricsTimer;
    constructor(config?: MetricsConfig);
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    /**
     * Execute augmentation - track metrics for operations
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Handle add operation metrics
     */
    private handleAdd;
    /**
     * Handle search operation metrics
     */
    private handleSearch;
    /**
     * Handle delete operation metrics
     */
    private handleDelete;
    /**
     * Handle clear operation - reset metrics
     */
    private handleClear;
    /**
     * Start periodic metrics update timer
     */
    private startMetricsTimer;
    /**
     * Update storage size metrics
     */
    private updateStorageMetrics;
    /**
     * Persist metrics to storage
     */
    private persistMetrics;
    /**
     * Get current metrics
     */
    getStatistics(): {
        enabled: boolean;
        totalSearches: number;
        totalUpdates: number;
        contentTypes: {};
        verbTypes: {};
        searchPerformance: {
            averageLatency: number;
            p95Latency: number;
            p99Latency: number;
        };
    } | {
        nounCount?: Record<string, number> | undefined;
        verbCount?: Record<string, number> | undefined;
        metadataCount?: Record<string, number> | undefined;
        hnswIndexSize?: number | undefined;
        totalNodes?: number | undefined;
        totalEdges?: number | undefined;
        totalMetadata?: number | undefined;
        operations?: {
            add: number;
            search: number;
            delete: number;
            update: number;
            relate: number;
            total: number;
        } | undefined;
        fieldNames?: Record<string, string[]> | undefined;
        standardFieldMappings?: Record<string, Record<string, string[]>> | undefined;
        contentTypes?: Record<string, number> | undefined;
        dataFreshness?: {
            oldestEntry: string;
            newestEntry: string;
            updatesLastHour: number;
            updatesLastDay: number;
            ageDistribution: {
                last24h: number;
                last7d: number;
                last30d: number;
                older: number;
            };
        } | undefined;
        storageMetrics?: {
            totalSizeBytes: number;
            nounsSizeBytes: number;
            verbsSizeBytes: number;
            metadataSizeBytes: number;
            indexSizeBytes: number;
        } | undefined;
        searchMetrics?: {
            totalSearches: number;
            averageSearchTimeMs: number;
            searchesLastHour: number;
            searchesLastDay: number;
            topSearchTerms?: string[];
        } | undefined;
        verbStatistics?: {
            totalVerbs: number;
            verbTypes: Record<string, number>;
            averageConnectionsPerVerb: number;
        } | undefined;
        serviceActivity?: Record<string, {
            firstActivity: string;
            lastActivity: string;
            totalOperations: number;
        }> | undefined;
        services?: import("../coreTypes.js").ServiceStatistics[] | undefined;
        throttlingMetrics?: {
            storage?: {
                currentlyThrottled: boolean;
                lastThrottleTime?: string;
                consecutiveThrottleEvents: number;
                currentBackoffMs: number;
                totalThrottleEvents: number;
                throttleEventsByHour?: number[];
                throttleReasons?: Record<string, number>;
            };
            operationImpact?: {
                delayedOperations: number;
                retriedOperations: number;
                failedDueToThrottling: number;
                averageDelayMs: number;
                totalDelayMs: number;
            };
            serviceThrottling?: Record<string, {
                throttleCount: number;
                lastThrottle: string;
                status: "normal" | "throttled" | "recovering";
            }>;
        } | undefined;
        lastUpdated?: string | undefined;
        distributedConfig?: import("../types/distributedTypes.js").SharedConfig | undefined;
        enabled: boolean;
        totalSearches?: undefined;
        totalUpdates?: undefined;
        verbTypes?: undefined;
        searchPerformance?: undefined;
    };
    /**
     * Record cache hit (called by cache augmentation)
     * Note: Cache metrics are tracked internally by StatisticsCollector
     */
    recordCacheHit(): void;
    /**
     * Record cache miss (called by cache augmentation)
     * Note: Cache metrics are tracked internally by StatisticsCollector
     */
    recordCacheMiss(): void;
    /**
     * Track custom metric
     * Note: Custom metrics would need to be implemented in StatisticsCollector
     */
    trackCustomMetric(name: string, value: number): void;
    /**
     * Reset all metrics
     */
    reset(): void;
}
/**
 * Factory function for zero-config metrics augmentation
 */
export declare function createMetricsAugmentation(config?: MetricsConfig): MetricsAugmentation;
