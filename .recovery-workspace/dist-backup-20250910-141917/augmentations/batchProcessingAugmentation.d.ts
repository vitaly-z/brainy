/**
 * Batch Processing Augmentation
 *
 * Critical for enterprise-scale performance: 500,000+ operations/second
 * Automatically batches operations for maximum throughput
 * Handles streaming data, bulk imports, and high-frequency operations
 *
 * Performance Impact: 10-50x improvement for bulk operations
 */
import { BaseAugmentation } from './brainyAugmentation.js';
import { AugmentationManifest } from './manifest.js';
interface BatchConfig {
    enabled?: boolean;
    adaptiveMode?: boolean;
    immediateThreshold?: number;
    batchThreshold?: number;
    maxBatchSize?: number;
    maxWaitTime?: number;
    adaptiveBatching?: boolean;
    priorityLanes?: number;
    memoryLimit?: number;
}
interface BatchMetrics {
    totalOperations: number;
    batchesProcessed: number;
    averageBatchSize: number;
    averageLatency: number;
    throughputPerSecond: number;
    memoryUsage: number;
    adaptiveAdjustments: number;
}
export declare class BatchProcessingAugmentation extends BaseAugmentation {
    readonly metadata: "readonly";
    name: string;
    timing: "around";
    operations: ("add" | "addNoun" | "addVerb" | "saveNoun" | "saveVerb" | "storage")[];
    priority: number;
    protected config: Required<BatchConfig>;
    private batches;
    private flushTimers;
    private metrics;
    private currentMemoryUsage;
    private performanceHistory;
    constructor(config?: BatchConfig);
    getManifest(): AugmentationManifest;
    protected onInitialize(): Promise<void>;
    shouldExecute(operation: string, params: any): boolean;
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    private shouldBatch;
    /**
     * SMART WORKFLOW DETECTION METHODS
     * These methods detect critical patterns that must not be batched
     */
    private isEntityRegistryWorkflow;
    private isDependencyChainStart;
    private isWriteOnlyMode;
    private hasEntityRegistryMetadata;
    private getOperationContext;
    private getCurrentLoad;
    private addToBatch;
    private getOperationPriority;
    private getBatchKey;
    private getOperationType;
    private estimateOperationSize;
    private shouldFlushBatch;
    private extractPriorityFromKey;
    private setFlushTimer;
    private getAdaptiveWaitTime;
    private getPerformanceMultiplier;
    private flushBatch;
    private processBatch;
    private processBatchByType;
    private processBatchSave;
    private processBatchUpdate;
    private processBatchDelete;
    private processIndividually;
    private processWithConcurrency;
    private flushOldestBatch;
    private updateMetrics;
    private adjustBatchSize;
    private startMetricsCollection;
    /**
     * Get batch processing statistics
     */
    getStats(): BatchMetrics & {
        pendingBatches: number;
        pendingOperations: number;
        currentBatchSize: number;
        memoryUtilization: string;
    };
    /**
     * Force flush all pending batches
     */
    flushAll(): Promise<void>;
    protected onShutdown(): Promise<void>;
}
export {};
