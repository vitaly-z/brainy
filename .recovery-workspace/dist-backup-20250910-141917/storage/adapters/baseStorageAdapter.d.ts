/**
 * Base Storage Adapter
 * Provides common functionality for all storage adapters, including statistics tracking
 */
import { StatisticsData, StorageAdapter } from '../../coreTypes.js';
/**
 * Base class for storage adapters that implements statistics tracking
 */
export declare abstract class BaseStorageAdapter implements StorageAdapter {
    abstract init(): Promise<void>;
    abstract saveNoun(noun: any): Promise<void>;
    abstract getNoun(id: string): Promise<any | null>;
    abstract getNounsByNounType(nounType: string): Promise<any[]>;
    abstract deleteNoun(id: string): Promise<void>;
    abstract saveVerb(verb: any): Promise<void>;
    abstract getVerb(id: string): Promise<any | null>;
    abstract getVerbsBySource(sourceId: string): Promise<any[]>;
    abstract getVerbsByTarget(targetId: string): Promise<any[]>;
    abstract getVerbsByType(type: string): Promise<any[]>;
    abstract deleteVerb(id: string): Promise<void>;
    abstract saveMetadata(id: string, metadata: any): Promise<void>;
    abstract getMetadata(id: string): Promise<any | null>;
    abstract saveVerbMetadata(id: string, metadata: any): Promise<void>;
    abstract getVerbMetadata(id: string): Promise<any | null>;
    abstract clear(): Promise<void>;
    abstract getStorageStatus(): Promise<{
        type: string;
        used: number;
        quota: number | null;
        details?: Record<string, any>;
    }>;
    /**
     * Get nouns with pagination and filtering
     * @param options Pagination and filtering options
     * @returns Promise that resolves to a paginated result of nouns
     */
    abstract getNouns(options?: {
        pagination?: {
            offset?: number;
            limit?: number;
            cursor?: string;
        };
        filter?: {
            nounType?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<{
        items: any[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Get verbs with pagination and filtering
     * @param options Pagination and filtering options
     * @returns Promise that resolves to a paginated result of verbs
     */
    abstract getVerbs(options?: {
        pagination?: {
            offset?: number;
            limit?: number;
            cursor?: string;
        };
        filter?: {
            verbType?: string | string[];
            sourceId?: string | string[];
            targetId?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<{
        items: any[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Get nouns with pagination (internal implementation)
     * This method should be implemented by storage adapters to support efficient pagination
     * @param options Pagination options
     * @returns Promise that resolves to a paginated result of nouns
     */
    getNounsWithPagination?(options: {
        limit?: number;
        cursor?: string;
        filter?: {
            nounType?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<{
        items: any[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Get verbs with pagination (internal implementation)
     * This method should be implemented by storage adapters to support efficient pagination
     * @param options Pagination options
     * @returns Promise that resolves to a paginated result of verbs
     */
    getVerbsWithPagination?(options: {
        limit?: number;
        cursor?: string;
        filter?: {
            verbType?: string | string[];
            sourceId?: string | string[];
            targetId?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<{
        items: any[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
    protected statisticsCache: StatisticsData | null;
    protected statisticsBatchUpdateTimerId: NodeJS.Timeout | null;
    protected statisticsModified: boolean;
    protected lastStatisticsFlushTime: number;
    protected readonly MIN_FLUSH_INTERVAL_MS = 5000;
    protected readonly MAX_FLUSH_DELAY_MS = 30000;
    protected throttlingDetected: boolean;
    protected throttlingBackoffMs: number;
    protected maxBackoffMs: number;
    protected consecutiveThrottleEvents: number;
    protected lastThrottleTime: number;
    protected totalThrottleEvents: number;
    protected throttleEventsByHour: number[];
    protected throttleReasons: Record<string, number>;
    protected lastThrottleHourIndex: number;
    protected delayedOperations: number;
    protected retriedOperations: number;
    protected failedDueToThrottling: number;
    protected totalDelayMs: number;
    protected serviceThrottling: Map<string, {
        throttleCount: number;
        lastThrottle: number;
        status: 'normal' | 'throttled' | 'recovering';
    }>;
    protected abstract saveStatisticsData(statistics: StatisticsData): Promise<void>;
    protected abstract getStatisticsData(): Promise<StatisticsData | null>;
    /**
     * Save statistics data
     * @param statistics The statistics data to save
     */
    saveStatistics(statistics: StatisticsData): Promise<void>;
    /**
     * Get statistics data
     * @returns Promise that resolves to the statistics data
     */
    getStatistics(): Promise<StatisticsData | null>;
    /**
     * Schedule a batch update of statistics
     */
    protected scheduleBatchUpdate(): void;
    /**
     * Flush statistics to storage
     */
    protected flushStatistics(): Promise<void>;
    /**
     * Increment a statistic counter
     * @param type The type of statistic to increment ('noun', 'verb', 'metadata')
     * @param service The service that inserted the data
     * @param amount The amount to increment by (default: 1)
     */
    incrementStatistic(type: 'noun' | 'verb' | 'metadata', service: string, amount?: number): Promise<void>;
    /**
     * Track service activity (first/last activity, operation counts)
     * @param service The service name
     * @param operation The operation type
     */
    protected trackServiceActivity(service: string, operation: 'add' | 'update' | 'delete'): void;
    /**
     * Decrement a statistic counter
     * @param type The type of statistic to decrement ('noun', 'verb', 'metadata')
     * @param service The service that inserted the data
     * @param amount The amount to decrement by (default: 1)
     */
    decrementStatistic(type: 'noun' | 'verb' | 'metadata', service: string, amount?: number): Promise<void>;
    /**
     * Update the HNSW index size statistic
     * @param size The new size of the HNSW index
     */
    updateHnswIndexSize(size: number): Promise<void>;
    /**
     * Force an immediate flush of statistics to storage
     * This ensures that any pending statistics updates are written to persistent storage
     */
    flushStatisticsToStorage(): Promise<void>;
    /**
     * Track field names from a JSON document
     * @param jsonDocument The JSON document to extract field names from
     * @param service The service that inserted the data
     */
    trackFieldNames(jsonDocument: any, service: string): Promise<void>;
    /**
     * Get available field names by service
     * @returns Record of field names by service
     */
    getAvailableFieldNames(): Promise<Record<string, string[]>>;
    /**
     * Get standard field mappings
     * @returns Record of standard field mappings
     */
    getStandardFieldMappings(): Promise<Record<string, Record<string, string[]>>>;
    /**
     * Create default statistics data
     * @returns Default statistics data
     */
    protected createDefaultStatistics(): StatisticsData;
    /**
     * Detect if an error is a throttling error
     * Override this method in specific adapters for custom detection
     */
    protected isThrottlingError(error: any): boolean;
    /**
     * Track a throttling event
     * @param error The error that caused throttling
     * @param service Optional service that was throttled
     */
    protected trackThrottlingEvent(error: any, service?: string): void;
    /**
     * Get the reason for throttling from an error
     */
    protected getThrottleReason(error: any): string;
    /**
     * Clear throttling state after successful operations
     */
    protected clearThrottlingState(): void;
    /**
     * Handle throttling by implementing exponential backoff
     * @param error The error that triggered throttling
     * @param service Optional service that was throttled
     */
    handleThrottling(error: any, service?: string): Promise<void>;
    /**
     * Track a retried operation
     */
    protected trackRetriedOperation(): void;
    /**
     * Track an operation that failed due to throttling
     */
    protected trackFailedDueToThrottling(): void;
    /**
     * Get current throttling metrics
     */
    protected getThrottlingMetrics(): StatisticsData['throttlingMetrics'];
    /**
     * Include throttling metrics in statistics
     */
    getStatisticsWithThrottling(): Promise<StatisticsData | null>;
}
