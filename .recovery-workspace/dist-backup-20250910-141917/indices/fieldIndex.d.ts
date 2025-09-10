/**
 * Field Index for efficient field-based queries
 * Provides O(log n) lookups for field values and range queries
 */
interface RangeQueryOptions {
    field: string;
    min?: any;
    max?: any;
    includeMin?: boolean;
    includeMax?: boolean;
}
export declare class FieldIndex {
    private indices;
    private sortedIndices;
    private indexedFields;
    /**
     * Add a document to the field index
     */
    add(id: string, metadata: Record<string, any>): void;
    /**
     * Remove a document from the field index
     */
    remove(id: string, metadata: Record<string, any>): void;
    /**
     * Query for exact field value match
     * O(1) hash lookup
     */
    queryExact(field: string, value: any): string[];
    /**
     * Query for multiple values (IN operator)
     * O(k) where k is number of values
     */
    queryIn(field: string, values: any[]): string[];
    /**
     * Query for range of values
     * O(log n + m) where m is number of results
     */
    queryRange(options: RangeQueryOptions): string[];
    /**
     * Query with complex where clause
     */
    query(where: Record<string, any>): string[];
    /**
     * Mark sorted index as needing rebuild
     */
    private markSortedIndexDirty;
    /**
     * Ensure sorted index is up to date for a field
     */
    private ensureSortedIndex;
    /**
     * Binary search for start position (inclusive)
     */
    private binarySearch;
    /**
     * Binary search for end position (inclusive)
     */
    private binarySearchEnd;
    /**
     * Debug method to inspect index contents
     */
    debugIndex(field?: string): any;
    /**
     * Get statistics about the index
     */
    getStats(): {
        indexedFields: number;
        totalValues: number;
        totalMappings: number;
    };
    /**
     * Clear all indices
     */
    clear(): void;
}
export {};
