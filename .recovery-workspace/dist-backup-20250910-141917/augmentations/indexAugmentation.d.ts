/**
 * Index Augmentation - Optional Metadata Indexing
 *
 * Replaces the hardcoded MetadataIndex in Brainy with an optional augmentation.
 * Provides O(1) metadata filtering and field lookups.
 *
 * Zero-config: Automatically enabled for better search performance
 * Can be disabled or customized via augmentation registry
 */
import { BaseAugmentation } from './brainyAugmentation.js';
import { MetadataIndexManager } from '../utils/metadataIndex.js';
export interface IndexConfig {
    enabled?: boolean;
    maxFieldValues?: number;
    maxIndexSize?: number;
    autoRebuild?: boolean;
    rebuildThreshold?: number;
    flushInterval?: number;
}
/**
 * IndexAugmentation - Makes metadata indexing optional and pluggable
 *
 * Features:
 * - O(1) metadata field lookups
 * - Fast pre-filtering for searches
 * - Automatic index maintenance
 * - Zero-config with smart defaults
 */
export declare class IndexAugmentation extends BaseAugmentation {
    readonly metadata: "readonly";
    readonly name = "index";
    readonly timing: "after";
    operations: ("add" | "update" | "updateMetadata" | "delete" | "clear" | "all")[];
    readonly priority = 60;
    readonly category: "core";
    readonly description = "Fast metadata field indexing for O(1) filtering and lookups";
    private metadataIndex;
    protected config: IndexConfig;
    private flushTimer;
    constructor(config?: IndexConfig);
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    /**
     * Execute augmentation - maintain index on data operations
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Handle add operation - index new metadata
     */
    private handleAdd;
    /**
     * Handle update operation - reindex metadata
     */
    private handleUpdate;
    /**
     * Handle delete operation - remove from index
     */
    private handleDelete;
    /**
     * Handle clear operation - clear index
     */
    private handleClear;
    /**
     * Start periodic flush timer
     */
    private startFlushTimer;
    /**
     * Get IDs that match metadata filter (for pre-filtering)
     */
    getIdsForFilter(filter: Record<string, any>): Promise<string[]>;
    /**
     * Get available values for a field
     */
    getFilterValues(field: string): Promise<any[]>;
    /**
     * Get all indexed fields
     */
    getFilterFields(): Promise<string[]>;
    /**
     * Get index statistics
     */
    getStats(): Promise<{
        enabled: boolean;
        totalEntries: number;
        fieldsIndexed: never[];
        memoryUsage: number;
    } | {
        totalEntries: number;
        totalIds: number;
        fieldsIndexed: string[];
        lastRebuild: number;
        indexSize: number;
        enabled: boolean;
        memoryUsage?: undefined;
    }>;
    /**
     * Rebuild the index from storage
     */
    rebuild(): Promise<void>;
    /**
     * Flush index to storage
     */
    flush(): Promise<void>;
    /**
     * Add entry to index (public method for direct access)
     */
    addToIndex(id: string, metadata: Record<string, any>): Promise<void>;
    /**
     * Remove entry from index (public method for direct access)
     */
    removeFromIndex(id: string, metadata: Record<string, any>): Promise<void>;
    /**
     * Get the underlying MetadataIndexManager instance
     */
    getMetadataIndex(): MetadataIndexManager | null;
}
/**
 * Factory function for zero-config index augmentation
 */
export declare function createIndexAugmentation(config?: IndexConfig): IndexAugmentation;
