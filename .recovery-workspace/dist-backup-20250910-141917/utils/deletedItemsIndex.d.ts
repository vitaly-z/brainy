/**
 * Dedicated index for tracking soft-deleted items
 * This is MUCH more efficient than checking every item in the database
 *
 * Performance characteristics:
 * - Add deleted item: O(1)
 * - Remove deleted item: O(1)
 * - Check if deleted: O(1)
 * - Get all deleted: O(d) where d = number of deleted items << total items
 */
export declare class DeletedItemsIndex {
    private deletedIds;
    private deletedCount;
    /**
     * Mark an item as deleted
     */
    markDeleted(id: string): void;
    /**
     * Mark an item as not deleted (restored)
     */
    markRestored(id: string): void;
    /**
     * Check if an item is deleted - O(1)
     */
    isDeleted(id: string): boolean;
    /**
     * Get all deleted item IDs - O(d)
     */
    getAllDeleted(): string[];
    /**
     * Filter out deleted items from results - O(k) where k = result count
     */
    filterDeleted<T extends {
        id?: string;
    }>(items: T[]): T[];
    /**
     * Get statistics
     */
    getStats(): {
        deletedCount: number;
        memoryUsage: number;
    };
    /**
     * Clear all deleted items (for testing)
     */
    clear(): void;
    /**
     * Serialize for persistence
     */
    serialize(): string;
    /**
     * Deserialize from persistence
     */
    deserialize(data: string): void;
}
/**
 * Global singleton for deleted items tracking
 */
export declare const deletedItemsIndex: DeletedItemsIndex;
