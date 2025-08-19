/**
 * Lightweight statistics collector for Brainy
 * Designed to have minimal performance impact even with millions of entries
 */
import { StatisticsData } from '../coreTypes.js';
export declare class StatisticsCollector {
    private contentTypes;
    private oldestTimestamp;
    private newestTimestamp;
    private updateTimestamps;
    private searchMetrics;
    private verbTypes;
    private storageSizeCache;
    private throttlingMetrics;
    private readonly MAX_TIMESTAMPS;
    private readonly MAX_SEARCH_TERMS;
    private readonly SIZE_UPDATE_INTERVAL;
    /**
     * Track content type (very lightweight)
     */
    trackContentType(type: string): void;
    /**
     * Track data update timestamp (lightweight)
     */
    trackUpdate(timestamp?: number): void;
    /**
     * Track search performance (lightweight)
     */
    trackSearch(searchTerm: string, durationMs: number): void;
    /**
     * Track verb type (lightweight)
     */
    trackVerbType(type: string): void;
    /**
     * Update storage size estimates (called periodically, not on every operation)
     */
    updateStorageSizes(sizes: {
        nouns: number;
        verbs: number;
        metadata: number;
        index: number;
    }): void;
    /**
     * Track a throttling event
     */
    trackThrottlingEvent(reason: string, service?: string): void;
    /**
     * Clear throttling state after successful operations
     */
    clearThrottlingState(): void;
    /**
     * Track delayed operation
     */
    trackDelayedOperation(delayMs: number): void;
    /**
     * Track retried operation
     */
    trackRetriedOperation(): void;
    /**
     * Track operation failed due to throttling
     */
    trackFailedDueToThrottling(): void;
    /**
     * Update throttling metrics from storage adapter
     */
    updateThrottlingMetrics(metrics: {
        currentlyThrottled: boolean;
        lastThrottleTime: number;
        consecutiveThrottleEvents: number;
        currentBackoffMs: number;
        totalThrottleEvents: number;
        throttleEventsByHour: number[];
        throttleReasons: Record<string, number>;
        delayedOperations: number;
        retriedOperations: number;
        failedDueToThrottling: number;
        totalDelayMs: number;
    }): void;
    /**
     * Get comprehensive statistics
     */
    getStatistics(): Partial<StatisticsData>;
    /**
     * Merge statistics from storage (for distributed systems)
     */
    mergeFromStorage(stored: Partial<StatisticsData>): void;
    /**
     * Reset statistics (for testing)
     */
    reset(): void;
    private pruneSearchTerms;
}
