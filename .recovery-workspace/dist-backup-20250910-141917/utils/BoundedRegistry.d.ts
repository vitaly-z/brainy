/**
 * Bounded Registry with LRU eviction
 * Prevents unbounded memory growth in production
 */
export declare class BoundedRegistry<T> {
    private items;
    private readonly maxSize;
    constructor(maxSize?: number);
    /**
     * Add item to registry, evicting oldest if at capacity
     */
    add(item: T): void;
    /**
     * Check if item exists
     */
    has(item: T): boolean;
    /**
     * Get all items
     */
    getAll(): T[];
    /**
     * Get size
     */
    get size(): number;
    /**
     * Clear all items
     */
    clear(): void;
}
