/**
 * Universal Display Augmentation - Intelligent Caching System
 *
 * High-performance LRU cache with smart eviction and batch optimization
 * Designed for minimal memory footprint and maximum hit ratio
 */
/**
 * LRU (Least Recently Used) Cache for computed display fields
 * Optimized for the display augmentation use case
 */
export class DisplayCache {
    constructor(maxSize = 1000) {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalComputations: 0,
            totalComputationTime: 0
        };
        this.maxSize = maxSize;
    }
    /**
     * Get cached display fields with LRU update
     * @param key Cache key
     * @returns Cached fields or null if not found
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        // Update LRU - move to end
        this.cache.delete(key);
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        this.cache.set(key, entry);
        this.stats.hits++;
        return entry.fields;
    }
    /**
     * Store computed display fields in cache
     * @param key Cache key
     * @param fields Computed display fields
     * @param computationTime Time taken to compute (for stats)
     */
    set(key, fields, computationTime) {
        // Remove if already exists (for LRU update)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Create cache entry
        const entry = {
            fields,
            lastAccessed: Date.now(),
            accessCount: 1
        };
        // Add to end (most recently used)
        this.cache.set(key, entry);
        // Update stats
        this.stats.totalComputations++;
        if (computationTime) {
            this.stats.totalComputationTime += computationTime;
        }
        // Evict oldest if over capacity
        if (this.cache.size > this.maxSize) {
            this.evictOldest();
        }
    }
    /**
     * Check if a key exists in cache without affecting LRU order
     * @param key Cache key
     * @returns True if key exists
     */
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Generate cache key from data
     * @param id Entity ID (preferred)
     * @param data Fallback data for key generation
     * @param entityType Type of entity (noun/verb)
     * @returns Cache key string
     */
    generateKey(id, data, entityType = 'noun') {
        // Use ID if available (most reliable)
        if (id) {
            return `${entityType}:${id}`;
        }
        // Generate hash from data
        if (data) {
            const dataString = JSON.stringify(data, Object.keys(data).sort());
            const hash = this.simpleHash(dataString);
            return `${entityType}:hash:${hash}`;
        }
        // Fallback to timestamp (not ideal but prevents crashes)
        return `${entityType}:temp:${Date.now()}:${Math.random()}`;
    }
    /**
     * Clear all cached entries
     */
    clear() {
        this.cache.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalComputations: 0,
            totalComputationTime: 0
        };
    }
    /**
     * Get cache statistics
     * @returns Cache performance statistics
     */
    getStats() {
        const hitRatio = this.stats.hits + this.stats.misses > 0
            ? this.stats.hits / (this.stats.hits + this.stats.misses)
            : 0;
        const avgComputationTime = this.stats.totalComputations > 0
            ? this.stats.totalComputationTime / this.stats.totalComputations
            : 0;
        // Analyze cached types for common types statistics
        const typeCount = new Map();
        let fastestComputation = Infinity;
        let slowestComputation = 0;
        for (const entry of this.cache.values()) {
            const type = entry.fields.type;
            typeCount.set(type, (typeCount.get(type) || 0) + 1);
        }
        const commonTypes = Array.from(typeCount.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([type, count]) => ({
            type,
            count,
            percentage: Math.round((count / this.cache.size) * 100)
        }));
        return {
            totalComputations: this.stats.totalComputations,
            cacheHitRatio: Math.round(hitRatio * 100) / 100,
            averageComputationTime: Math.round(avgComputationTime * 100) / 100,
            commonTypes,
            performance: {
                fastestComputation,
                slowestComputation,
                totalComputationTime: this.stats.totalComputationTime
            }
        };
    }
    /**
     * Get current cache size
     * @returns Number of cached entries
     */
    size() {
        return this.cache.size;
    }
    /**
     * Get cache capacity
     * @returns Maximum cache size
     */
    capacity() {
        return this.maxSize;
    }
    /**
     * Evict least recently used entry
     */
    evictOldest() {
        // First entry is oldest (LRU)
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
            this.cache.delete(firstKey);
            this.stats.evictions++;
        }
    }
    /**
     * Simple hash function for cache keys
     * @param str String to hash
     * @returns Simple hash number
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    /**
     * Optimize cache by removing stale entries
     * Called periodically to maintain cache health
     */
    optimizeCache() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        const minAccessCount = 2; // Minimum access count to keep
        const toDelete = [];
        for (const [key, entry] of this.cache.entries()) {
            // Remove very old entries with low access count
            if (now - entry.lastAccessed > maxAge && entry.accessCount < minAccessCount) {
                toDelete.push(key);
            }
        }
        // Remove stale entries
        for (const key of toDelete) {
            this.cache.delete(key);
            this.stats.evictions++;
        }
    }
    /**
     * Precompute display fields for a batch of entities
     * @param entities Array of entities with their compute functions
     * @returns Promise resolving when batch is complete
     */
    async batchPrecompute(entities) {
        const promises = entities.map(async ({ key, computeFn }) => {
            if (!this.has(key)) {
                const startTime = Date.now();
                try {
                    const fields = await computeFn();
                    const computationTime = Date.now() - startTime;
                    this.set(key, fields, computationTime);
                }
                catch (error) {
                    console.warn(`Batch precompute failed for key ${key}:`, error);
                }
            }
        });
        await Promise.all(promises);
    }
}
/**
 * Request deduplicator for batch processing
 * Prevents duplicate computations for the same data
 */
export class RequestDeduplicator {
    constructor(batchSize = 50) {
        this.pendingRequests = new Map();
        this.batchSize = batchSize;
    }
    /**
     * Deduplicate computation request
     * @param key Unique key for the computation
     * @param computeFn Function to compute the result
     * @returns Promise that resolves to the computed fields
     */
    async deduplicate(key, computeFn) {
        // Return existing promise if already pending
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }
        // Create new computation promise
        const promise = computeFn().finally(() => {
            // Remove from pending when complete
            this.pendingRequests.delete(key);
        });
        this.pendingRequests.set(key, promise);
        return promise;
    }
    /**
     * Get number of pending requests
     * @returns Number of pending computations
     */
    getPendingCount() {
        return this.pendingRequests.size;
    }
    /**
     * Clear all pending requests
     */
    clear() {
        this.pendingRequests.clear();
    }
    /**
     * Shutdown the deduplicator
     */
    shutdown() {
        this.clear();
    }
}
/**
 * Global cache instance management
 * Provides singleton access to display cache
 */
let globalDisplayCache = null;
/**
 * Get global display cache instance
 * @param maxSize Optional cache size (only used on first call)
 * @returns Shared display cache instance
 */
export function getGlobalDisplayCache(maxSize) {
    if (!globalDisplayCache) {
        globalDisplayCache = new DisplayCache(maxSize);
        // Set up periodic optimization
        setInterval(() => {
            globalDisplayCache?.optimizeCache();
        }, 60 * 60 * 1000); // Every hour
    }
    return globalDisplayCache;
}
/**
 * Clear global cache (for testing or memory management)
 */
export function clearGlobalDisplayCache() {
    if (globalDisplayCache) {
        globalDisplayCache.clear();
    }
}
/**
 * Shutdown global cache and cleanup
 */
export function shutdownGlobalDisplayCache() {
    if (globalDisplayCache) {
        globalDisplayCache.clear();
        globalDisplayCache = null;
    }
}
//# sourceMappingURL=cache.js.map