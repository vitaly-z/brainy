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
export class DeletedItemsIndex {
    constructor() {
        this.deletedIds = new Set();
        this.deletedCount = 0;
    }
    /**
     * Mark an item as deleted
     */
    markDeleted(id) {
        if (!this.deletedIds.has(id)) {
            this.deletedIds.add(id);
            this.deletedCount++;
        }
    }
    /**
     * Mark an item as not deleted (restored)
     */
    markRestored(id) {
        if (this.deletedIds.delete(id)) {
            this.deletedCount--;
        }
    }
    /**
     * Check if an item is deleted - O(1)
     */
    isDeleted(id) {
        return this.deletedIds.has(id);
    }
    /**
     * Get all deleted item IDs - O(d)
     */
    getAllDeleted() {
        return Array.from(this.deletedIds);
    }
    /**
     * Filter out deleted items from results - O(k) where k = result count
     */
    filterDeleted(items) {
        if (this.deletedCount === 0) {
            // Fast path - no deleted items
            return items;
        }
        return items.filter(item => {
            const id = item.id;
            return id ? !this.deletedIds.has(id) : true;
        });
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            deletedCount: this.deletedCount,
            memoryUsage: this.deletedCount * 100 // Rough estimate: 100 bytes per ID
        };
    }
    /**
     * Clear all deleted items (for testing)
     */
    clear() {
        this.deletedIds.clear();
        this.deletedCount = 0;
    }
    /**
     * Serialize for persistence
     */
    serialize() {
        return JSON.stringify(Array.from(this.deletedIds));
    }
    /**
     * Deserialize from persistence
     */
    deserialize(data) {
        try {
            const ids = JSON.parse(data);
            this.deletedIds = new Set(ids);
            this.deletedCount = this.deletedIds.size;
        }
        catch (e) {
            console.warn('Failed to deserialize deleted items index');
        }
    }
}
/**
 * Global singleton for deleted items tracking
 */
export const deletedItemsIndex = new DeletedItemsIndex();
//# sourceMappingURL=deletedItemsIndex.js.map