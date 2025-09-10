/**
 * Metadata Index System
 * Maintains inverted indexes for fast metadata filtering
 * Automatically updates indexes when data changes
 */
import { StorageAdapter } from '../coreTypes.js';
export interface MetadataIndexEntry {
    field: string;
    value: string | number | boolean;
    ids: Set<string>;
    lastUpdated: number;
}
export interface FieldIndexData {
    values: Record<string, number>;
    lastUpdated: number;
}
export interface MetadataIndexStats {
    totalEntries: number;
    totalIds: number;
    fieldsIndexed: string[];
    lastRebuild: number;
    indexSize: number;
}
export interface MetadataIndexConfig {
    maxIndexSize?: number;
    rebuildThreshold?: number;
    autoOptimize?: boolean;
    indexedFields?: string[];
    excludeFields?: string[];
}
export declare class MetadataIndexManager {
    private storage;
    private config;
    private indexCache;
    private dirtyEntries;
    private isRebuilding;
    private metadataCache;
    private fieldIndexes;
    private dirtyFields;
    private lastFlushTime;
    private autoFlushThreshold;
    private sortedIndices;
    private numericFields;
    private unifiedCache;
    constructor(storage: StorageAdapter, config?: MetadataIndexConfig);
    /**
     * Get index key for field and value
     */
    private getIndexKey;
    /**
     * Ensure sorted index exists for a field (for range queries)
     */
    private ensureSortedIndex;
    /**
     * Build sorted index for a field from hash index
     */
    private buildSortedIndex;
    /**
     * Binary search for range start (inclusive or exclusive)
     */
    private binarySearchStart;
    /**
     * Binary search for range end (inclusive or exclusive)
     */
    private binarySearchEnd;
    /**
     * Get IDs matching a range query
     */
    private getIdsForRange;
    /**
     * Generate field index filename for filter discovery
     */
    private getFieldIndexFilename;
    /**
     * Generate value chunk filename for scalable storage
     */
    private getValueChunkFilename;
    /**
     * Make a value safe for use in filenames
     */
    private makeSafeFilename;
    /**
     * Normalize value for consistent indexing
     */
    private normalizeValue;
    /**
     * Create a short hash for long values to avoid filesystem filename limits
     */
    private hashValue;
    /**
     * Check if field should be indexed
     */
    private shouldIndexField;
    /**
     * Extract indexable field-value pairs from metadata
     */
    private extractIndexableFields;
    /**
     * Add item to metadata indexes
     */
    addToIndex(id: string, metadata: any, skipFlush?: boolean): Promise<void>;
    /**
     * Update field index with value count
     */
    private updateFieldIndex;
    /**
     * Remove item from metadata indexes
     */
    removeFromIndex(id: string, metadata?: any): Promise<void>;
    /**
     * Get all IDs in the index
     */
    getAllIds(): Promise<string[]>;
    /**
     * Get IDs for a specific field-value combination with caching
     */
    getIds(field: string, value: any): Promise<string[]>;
    /**
     * Get all available values for a field (for filter discovery)
     */
    getFilterValues(field: string): Promise<string[]>;
    /**
     * Get all indexed fields (for filter discovery)
     */
    getFilterFields(): Promise<string[]>;
    /**
     * Convert Brainy Field Operator filter to simple field-value criteria for indexing
     */
    private convertFilterToCriteria;
    /**
     * Get IDs matching Brainy Field Operator metadata filter using indexes where possible
     */
    getIdsForFilter(filter: any): Promise<string[]>;
    /**
     * DEPRECATED - Old implementation for backward compatibility
     */
    private getIdsForFilterOld;
    /**
     * Get IDs matching multiple criteria (intersection) - LEGACY METHOD
     * @deprecated Use getIdsForFilter instead
     */
    getIdsForCriteria(criteria: Record<string, any>): Promise<string[]>;
    /**
     * Flush dirty entries to storage (non-blocking version)
     */
    flush(): Promise<void>;
    /**
     * Yield control back to the Node.js event loop
     * Prevents blocking during long-running operations
     */
    private yieldToEventLoop;
    /**
     * Load field index from storage
     */
    private loadFieldIndex;
    /**
     * Save field index to storage
     */
    private saveFieldIndex;
    /**
     * Save sorted index to storage for range queries
     */
    private saveSortedIndex;
    /**
     * Load sorted index from storage
     */
    private loadSortedIndex;
    /**
     * Get index statistics
     */
    getStats(): Promise<MetadataIndexStats>;
    /**
     * Rebuild entire index from scratch using pagination
     * Non-blocking version that yields control back to event loop
     */
    rebuild(): Promise<void>;
    /**
     * Load index entry from storage using safe filenames
     */
    private loadIndexEntry;
    /**
     * Save index entry to storage using safe filenames
     */
    private saveIndexEntry;
    /**
     * Delete index entry from storage using safe filenames
     */
    private deleteIndexEntry;
}
