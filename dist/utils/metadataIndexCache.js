/**
 * MetadataIndexCache - Caches metadata index data for improved performance
 * Reuses the same pattern as SearchCache for consistency
 */
export class MetadataIndexCache {
    constructor(config = {}) {
        this.cache = new Map();
        // Cache statistics
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.maxAge = config.maxAge ?? 5 * 60 * 1000; // 5 minutes
        this.maxSize = config.maxSize ?? 500; // More entries than SearchCache since indexes are smaller
        this.enabled = config.enabled ?? true;
        this.hitCountWeight = config.hitCountWeight ?? 0.3;
    }
    /**
     * Get cached entry
     */
    get(key) {
        if (!this.enabled)
            return undefined;
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return undefined;
        }
        // Check if entry is expired
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }
        // Update hit count
        entry.hits++;
        this.hits++;
        return entry.data;
    }
    /**
     * Set cache entry
     */
    set(key, data) {
        if (!this.enabled)
            return;
        // Evict entries if at max size
        if (this.cache.size >= this.maxSize) {
            this.evictLeastValuable();
        }
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            hits: 0
        });
    }
    /**
     * Evict least valuable entry based on age and hit count
     */
    evictLeastValuable() {
        let leastValuableKey = null;
        let lowestScore = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            const age = Date.now() - entry.timestamp;
            const ageScore = age / this.maxAge;
            const hitScore = entry.hits * this.hitCountWeight;
            const score = hitScore - ageScore;
            if (score < lowestScore) {
                lowestScore = score;
                leastValuableKey = key;
            }
        }
        if (leastValuableKey) {
            this.cache.delete(leastValuableKey);
            this.evictions++;
        }
    }
    /**
     * Invalidate cache entries matching a pattern
     */
    invalidatePattern(pattern) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }
    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.hits / (this.hits + this.misses) || 0,
            evictions: this.evictions
        };
    }
    /**
     * Get estimated memory usage
     */
    getMemoryUsage() {
        // Rough estimate: 100 bytes per entry + data size
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            totalSize += 100; // Base overhead
            totalSize += JSON.stringify(entry.data).length * 2; // Unicode chars
        }
        return totalSize;
    }
}
//# sourceMappingURL=metadataIndexCache.js.map