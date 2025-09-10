/**
 * Bounded Registry with LRU eviction
 * Prevents unbounded memory growth in production
 */
export class BoundedRegistry {
    constructor(maxSize = 10000) {
        this.items = new Map(); // item -> last accessed timestamp
        this.maxSize = maxSize;
    }
    /**
     * Add item to registry, evicting oldest if at capacity
     */
    add(item) {
        // Update timestamp if already exists
        if (this.items.has(item)) {
            this.items.delete(item); // Remove to re-add at end
            this.items.set(item, Date.now());
            return;
        }
        // Evict oldest if at capacity
        if (this.items.size >= this.maxSize) {
            const oldest = this.items.entries().next().value;
            if (oldest) {
                this.items.delete(oldest[0]);
            }
        }
        this.items.set(item, Date.now());
    }
    /**
     * Check if item exists
     */
    has(item) {
        return this.items.has(item);
    }
    /**
     * Get all items
     */
    getAll() {
        return Array.from(this.items.keys());
    }
    /**
     * Get size
     */
    get size() {
        return this.items.size;
    }
    /**
     * Clear all items
     */
    clear() {
        this.items.clear();
    }
}
//# sourceMappingURL=BoundedRegistry.js.map