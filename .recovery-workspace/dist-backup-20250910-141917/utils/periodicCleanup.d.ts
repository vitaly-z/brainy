/**
 * Periodic Cleanup for Soft-Deleted Items
 *
 * SAFETY-FIRST APPROACH:
 * - Maintains durability guarantees (storage-first)
 * - Coordinates HNSW and metadata index consistency
 * - Isolated from live operations
 * - Graceful failure handling
 */
import type { StorageAdapter } from '../coreTypes.js';
import type { HNSWIndex } from '../hnsw/hnswIndex.js';
import type { MetadataIndexManager } from './metadataIndex.js';
export interface CleanupConfig {
    /** Age in milliseconds after which soft-deleted items are eligible for cleanup */
    maxAge: number;
    /** Maximum number of items to clean up in one batch */
    batchSize: number;
    /** Interval between cleanup runs (milliseconds) */
    cleanupInterval: number;
    /** Whether to run cleanup automatically */
    enabled: boolean;
}
export interface CleanupStats {
    itemsProcessed: number;
    itemsDeleted: number;
    errors: number;
    lastRun: number;
    nextRun: number;
}
/**
 * Coordinates safe cleanup of old soft-deleted items across all indexes
 *
 * CRITICAL SAFETY FEATURES:
 * 1. Storage-first deletion (durability)
 * 2. Index consistency coordination
 * 3. Batch processing with limits
 * 4. Error isolation and recovery
 */
export declare class PeriodicCleanup {
    private storage;
    private hnswIndex;
    private metadataIndex;
    private config;
    private stats;
    private cleanupTimer;
    private running;
    constructor(storage: StorageAdapter, hnswIndex: HNSWIndex, metadataIndex: MetadataIndexManager | null, config?: Partial<CleanupConfig>);
    /**
     * Start periodic cleanup
     */
    start(): void;
    /**
     * Stop periodic cleanup
     */
    stop(): void;
    /**
     * Run cleanup manually
     */
    runNow(): Promise<CleanupStats>;
    /**
     * Get current cleanup statistics
     */
    getStats(): CleanupStats;
    private scheduleNext;
    /**
     * CRITICAL: Coordinated cleanup across all indexes
     *
     * SAFETY PROTOCOL:
     * 1. Find eligible items (old + soft-deleted)
     * 2. Remove from storage FIRST (durability)
     * 3. Remove from HNSW (graph consistency)
     * 4. Remove from metadata index (search consistency)
     * 5. Track stats and errors
     */
    private performCleanup;
    /**
     * Find items eligible for cleanup (old + soft-deleted)
     */
    private findEligibleItems;
    /**
     * Process a batch of items for cleanup
     *
     * CRITICAL: This maintains the durability-first approach:
     * Storage → HNSW → Metadata Index
     */
    private processBatch;
}
