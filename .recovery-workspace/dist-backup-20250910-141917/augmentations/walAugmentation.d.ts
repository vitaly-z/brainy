/**
 * Write-Ahead Log (WAL) Augmentation
 *
 * Provides file-based durability and atomicity for storage operations
 * Automatically enabled for all critical storage operations
 *
 * Features:
 * - True file-based persistence for crash recovery
 * - Operation replay after startup
 * - Automatic log rotation and cleanup
 * - Cross-platform compatibility (filesystem, OPFS, cloud)
 */
import { BaseAugmentation } from './brainyAugmentation.js';
import { AugmentationManifest } from './manifest.js';
interface WALConfig {
    enabled?: boolean;
    immediateWrites?: boolean;
    adaptivePersistence?: boolean;
    walPrefix?: string;
    maxSize?: number;
    checkpointInterval?: number;
    autoRecover?: boolean;
    maxRetries?: number;
}
export declare class WALAugmentation extends BaseAugmentation {
    name: string;
    timing: "around";
    metadata: "readonly";
    operations: ("addNoun" | "addVerb" | "saveNoun" | "saveVerb" | "updateMetadata" | "delete" | "deleteVerb" | "clear")[];
    priority: number;
    readonly category: "internal";
    readonly description = "Write-ahead logging for durability and crash recovery";
    private currentLogId;
    private operationCounter;
    private checkpointTimer?;
    private isRecovering;
    constructor(config?: WALConfig);
    /**
     * Get the augmentation manifest for discovery
     */
    getManifest(): AugmentationManifest;
    /**
     * Handle runtime configuration changes
     */
    protected onConfigChange(newConfig: WALConfig, oldConfig: WALConfig): Promise<void>;
    protected onInitialize(): Promise<void>;
    shouldExecute(operation: string, params: any): boolean;
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Asynchronous WAL entry logging (fire-and-forget for immediate writes)
     */
    private logAsyncWALEntry;
    /**
     * Write WAL entry to persistent storage using storage adapter
     */
    private writeWALEntry;
    /**
     * Recover pending operations from all existing WAL files
     */
    private recoverPendingOperations;
    /**
     * Find all WAL files in storage
     */
    private findWALFiles;
    /**
     * Read WAL entries from a file
     */
    private readWALEntries;
    /**
     * Find operations that were started but not completed
     */
    private findPendingOperations;
    /**
     * Replay an operation during recovery
     */
    private replayOperation;
    /**
     * Create a checkpoint to mark a point in time
     */
    private createCheckpoint;
    /**
     * Check if log rotation is needed
     */
    private checkLogRotation;
    /**
     * Sanitize parameters for logging (remove large objects)
     */
    private sanitizeParams;
    /**
     * Get WAL statistics
     */
    getStats(): {
        enabled: boolean;
        currentLogId: string;
        operationCount: number;
        logSize: number;
        pendingOperations: number;
        failedOperations: number;
    };
    /**
     * Manually trigger checkpoint
     */
    checkpoint(): Promise<void>;
    /**
     * Manually trigger log rotation
     */
    rotate(): Promise<void>;
    /**
     * Write WAL data directly to storage without embedding
     * This bypasses the brain's AI processing pipeline for raw WAL data
     */
    private writeWALFileDirectly;
    /**
     * Read WAL data directly from storage without embedding
     */
    private readWALFileDirectly;
    protected onShutdown(): Promise<void>;
}
export {};
