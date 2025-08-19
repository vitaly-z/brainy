/**
 * Enhanced Multi-Level Cache Manager with Predictive Prefetching
 * Optimized for HNSW search patterns and large-scale vector operations
 */
// Prefetch prediction strategies
var PrefetchStrategy;
(function (PrefetchStrategy) {
    PrefetchStrategy["GRAPH_CONNECTIVITY"] = "connectivity";
    PrefetchStrategy["VECTOR_SIMILARITY"] = "similarity";
    PrefetchStrategy["ACCESS_PATTERN"] = "pattern";
    PrefetchStrategy["HYBRID"] = "hybrid";
})(PrefetchStrategy || (PrefetchStrategy = {}));
/**
 * Enhanced cache manager with intelligent prefetching for HNSW operations
 * Provides multi-level caching optimized for vector search workloads
 */
export class EnhancedCacheManager {
    constructor(config = {}) {
        this.hotCache = new Map();
        this.warmCache = new Map();
        this.prefetchQueue = new Set();
        this.accessPatterns = new Map(); // Track access times
        this.vectorIndex = new Map(); // For similarity calculations
        this.prefetchInProgress = false;
        // Statistics and monitoring
        this.stats = {
            hotCacheHits: 0,
            hotCacheMisses: 0,
            warmCacheHits: 0,
            warmCacheMisses: 0,
            prefetchHits: 0,
            prefetchMisses: 0,
            totalPrefetched: 0,
            predictionAccuracy: 0,
            backgroundOptimizations: 0
        };
        this.config = {
            hotCacheMaxSize: 1000,
            hotCacheEvictionThreshold: 0.8,
            warmCacheMaxSize: 10000,
            warmCacheTTL: 300000, // 5 minutes
            prefetchEnabled: true,
            prefetchStrategy: PrefetchStrategy.HYBRID,
            prefetchBatchSize: 50,
            predictionLookahead: 3,
            similarityThreshold: 0.8,
            maxSimilarityDistance: 2.0,
            backgroundOptimization: true,
            statisticsCollection: true,
            ...config
        };
        // Start background optimization if enabled
        if (this.config.backgroundOptimization) {
            this.startBackgroundOptimization();
        }
    }
    /**
     * Set storage adapters for warm/cold storage operations
     */
    setStorageAdapters(storageAdapter, batchOperations) {
        this.storageAdapter = storageAdapter;
        this.batchOperations = batchOperations;
    }
    /**
     * Get item with intelligent prefetching
     */
    async get(id) {
        const startTime = Date.now();
        // Update access pattern
        this.recordAccess(id, startTime);
        // Check hot cache first
        let entry = this.hotCache.get(id);
        if (entry && !this.isExpired(entry)) {
            entry.lastAccessed = startTime;
            entry.accessCount++;
            this.stats.hotCacheHits++;
            // Trigger predictive prefetch
            if (this.config.prefetchEnabled) {
                this.schedulePrefetch(id, entry.data);
            }
            return entry.data;
        }
        this.stats.hotCacheMisses++;
        // Check warm cache
        entry = this.warmCache.get(id);
        if (entry && !this.isExpired(entry)) {
            entry.lastAccessed = startTime;
            entry.accessCount++;
            this.stats.warmCacheHits++;
            // Promote to hot cache if frequently accessed
            if (entry.accessCount > 3) {
                this.promoteToHotCache(id, entry);
            }
            return entry.data;
        }
        this.stats.warmCacheMisses++;
        // Load from storage
        const item = await this.loadFromStorage(id);
        if (item) {
            // Cache the item
            await this.set(id, item);
            // Trigger predictive prefetch
            if (this.config.prefetchEnabled) {
                this.schedulePrefetch(id, item);
            }
        }
        return item;
    }
    /**
     * Get multiple items efficiently with batch operations
     */
    async getMany(ids) {
        const result = new Map();
        const uncachedIds = [];
        // Check caches first
        for (const id of ids) {
            const cached = await this.get(id);
            if (cached) {
                result.set(id, cached);
            }
            else {
                uncachedIds.push(id);
            }
        }
        // Batch load uncached items
        if (uncachedIds.length > 0 && this.batchOperations) {
            const batchResult = await this.batchOperations.batchGetNodes(uncachedIds);
            // Cache loaded items
            for (const [id, item] of batchResult.items) {
                await this.set(id, item);
                result.set(id, item);
            }
        }
        return result;
    }
    /**
     * Set item in cache with metadata
     */
    async set(id, item) {
        const now = Date.now();
        const entry = {
            data: item,
            lastAccessed: now,
            accessCount: 1,
            expiresAt: now + this.config.warmCacheTTL,
            connectedNodes: this.extractConnectedNodes(item),
            predictionScore: 0
        };
        // Store vector for similarity calculations
        if ('vector' in item && item.vector) {
            this.vectorIndex.set(id, item.vector);
            entry.vectorSimilarity = 0;
        }
        // Add to warm cache initially
        this.warmCache.set(id, entry);
        // Clean up if needed
        if (this.warmCache.size > this.config.warmCacheMaxSize) {
            this.evictFromWarmCache();
        }
        // Update statistics
        this.stats.warmCacheHits++; // Count as a potential future hit
    }
    /**
     * Intelligent prefetch based on access patterns and graph structure
     */
    async schedulePrefetch(currentId, currentItem) {
        if (this.prefetchInProgress || !this.config.prefetchEnabled) {
            return;
        }
        // Use different strategies based on configuration
        let candidateIds = [];
        switch (this.config.prefetchStrategy) {
            case PrefetchStrategy.GRAPH_CONNECTIVITY:
                candidateIds = this.predictByConnectivity(currentId, currentItem);
                break;
            case PrefetchStrategy.VECTOR_SIMILARITY:
                candidateIds = await this.predictBySimilarity(currentId, currentItem);
                break;
            case PrefetchStrategy.ACCESS_PATTERN:
                candidateIds = this.predictByAccessPattern(currentId);
                break;
            case PrefetchStrategy.HYBRID:
                candidateIds = await this.hybridPrediction(currentId, currentItem);
                break;
        }
        // Filter out already cached items
        const uncachedIds = candidateIds.filter(id => !this.hotCache.has(id) && !this.warmCache.has(id)).slice(0, this.config.prefetchBatchSize);
        if (uncachedIds.length > 0) {
            this.executePrefetch(uncachedIds);
        }
    }
    /**
     * Predict next nodes based on graph connectivity
     */
    predictByConnectivity(currentId, currentItem) {
        const candidates = [];
        if ('connections' in currentItem && currentItem.connections) {
            const connections = currentItem.connections;
            // Add immediate neighbors with higher priority for lower levels
            for (const [level, nodeIds] of connections.entries()) {
                const priority = Math.max(1, 5 - level); // Higher priority for level 0
                for (const nodeId of nodeIds) {
                    // Add based on priority
                    for (let i = 0; i < priority; i++) {
                        candidates.push(nodeId);
                    }
                }
            }
        }
        // Shuffle and deduplicate
        const shuffled = candidates.sort(() => Math.random() - 0.5);
        return [...new Set(shuffled)];
    }
    /**
     * Predict next nodes based on vector similarity
     */
    async predictBySimilarity(currentId, currentItem) {
        if (!('vector' in currentItem) || !currentItem.vector) {
            return [];
        }
        const currentVector = currentItem.vector;
        const similarities = [];
        // Calculate similarities with vectors in cache
        for (const [id, vector] of this.vectorIndex.entries()) {
            if (id === currentId)
                continue;
            const similarity = this.cosineSimilarity(currentVector, vector);
            if (similarity > this.config.similarityThreshold) {
                similarities.push([id, similarity]);
            }
        }
        // Sort by similarity and return top candidates
        similarities.sort((a, b) => b[1] - a[1]);
        return similarities.slice(0, this.config.prefetchBatchSize).map(([id]) => id);
    }
    /**
     * Predict based on historical access patterns
     */
    predictByAccessPattern(currentId) {
        const currentPattern = this.accessPatterns.get(currentId);
        if (!currentPattern || currentPattern.length < 2) {
            return [];
        }
        // Find similar access patterns
        const candidates = [];
        for (const [id, pattern] of this.accessPatterns.entries()) {
            if (id === currentId || pattern.length < 2)
                continue;
            const similarity = this.patternSimilarity(currentPattern, pattern);
            if (similarity > 0.5) {
                candidates.push([id, similarity]);
            }
        }
        candidates.sort((a, b) => b[1] - a[1]);
        return candidates.slice(0, this.config.prefetchBatchSize).map(([id]) => id);
    }
    /**
     * Hybrid prediction combining multiple strategies
     */
    async hybridPrediction(currentId, currentItem) {
        const connectivityCandidates = this.predictByConnectivity(currentId, currentItem);
        const similarityCandidates = await this.predictBySimilarity(currentId, currentItem);
        const patternCandidates = this.predictByAccessPattern(currentId);
        // Weighted combination
        const candidateScores = new Map();
        // Connectivity gets highest weight (40%)
        connectivityCandidates.forEach((id, index) => {
            const score = (connectivityCandidates.length - index) / connectivityCandidates.length * 0.4;
            candidateScores.set(id, (candidateScores.get(id) || 0) + score);
        });
        // Similarity gets medium weight (35%)
        similarityCandidates.forEach((id, index) => {
            const score = (similarityCandidates.length - index) / similarityCandidates.length * 0.35;
            candidateScores.set(id, (candidateScores.get(id) || 0) + score);
        });
        // Pattern gets lower weight (25%)
        patternCandidates.forEach((id, index) => {
            const score = (patternCandidates.length - index) / patternCandidates.length * 0.25;
            candidateScores.set(id, (candidateScores.get(id) || 0) + score);
        });
        // Sort by combined score
        const sortedCandidates = Array.from(candidateScores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => id);
        return sortedCandidates.slice(0, this.config.prefetchBatchSize);
    }
    /**
     * Execute prefetch operation in background
     */
    async executePrefetch(ids) {
        if (this.prefetchInProgress || !this.batchOperations) {
            return;
        }
        this.prefetchInProgress = true;
        try {
            const batchResult = await this.batchOperations.batchGetNodes(ids);
            // Cache prefetched items
            for (const [id, item] of batchResult.items) {
                const entry = {
                    data: item,
                    lastAccessed: Date.now(),
                    accessCount: 0, // Prefetched items start with 0 access count
                    expiresAt: Date.now() + this.config.warmCacheTTL,
                    connectedNodes: this.extractConnectedNodes(item),
                    predictionScore: 1 // Mark as prefetched
                };
                this.warmCache.set(id, entry);
            }
            this.stats.totalPrefetched += batchResult.items.size;
        }
        catch (error) {
            console.warn('Prefetch operation failed:', error);
        }
        finally {
            this.prefetchInProgress = false;
        }
    }
    /**
     * Load item from storage adapter
     */
    async loadFromStorage(id) {
        if (!this.storageAdapter) {
            return null;
        }
        try {
            return await this.storageAdapter.get(id);
        }
        catch (error) {
            console.warn(`Failed to load ${id} from storage:`, error);
            return null;
        }
    }
    /**
     * Promote frequently accessed item to hot cache
     */
    promoteToHotCache(id, entry) {
        // Remove from warm cache
        this.warmCache.delete(id);
        // Add to hot cache
        this.hotCache.set(id, entry);
        // Evict if necessary
        if (this.hotCache.size > this.config.hotCacheMaxSize) {
            this.evictFromHotCache();
        }
    }
    /**
     * Evict least recently used items from hot cache
     */
    evictFromHotCache() {
        const threshold = Math.floor(this.config.hotCacheMaxSize * this.config.hotCacheEvictionThreshold);
        if (this.hotCache.size <= threshold) {
            return;
        }
        // Sort by last accessed time and access count
        const entries = Array.from(this.hotCache.entries())
            .sort((a, b) => {
            const scoreA = a[1].accessCount * 0.7 + (Date.now() - a[1].lastAccessed) * -0.3;
            const scoreB = b[1].accessCount * 0.7 + (Date.now() - b[1].lastAccessed) * -0.3;
            return scoreA - scoreB;
        });
        // Remove least valuable entries
        const toRemove = entries.slice(0, this.hotCache.size - threshold);
        for (const [id] of toRemove) {
            this.hotCache.delete(id);
        }
    }
    /**
     * Evict expired items from warm cache
     */
    evictFromWarmCache() {
        const now = Date.now();
        const toRemove = [];
        for (const [id, entry] of this.warmCache.entries()) {
            if (this.isExpired(entry)) {
                toRemove.push(id);
            }
        }
        // Remove expired items
        for (const id of toRemove) {
            this.warmCache.delete(id);
            this.vectorIndex.delete(id);
        }
        // If still over limit, remove LRU items
        if (this.warmCache.size > this.config.warmCacheMaxSize) {
            const entries = Array.from(this.warmCache.entries())
                .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            const excess = this.warmCache.size - this.config.warmCacheMaxSize;
            for (let i = 0; i < excess; i++) {
                const [id] = entries[i];
                this.warmCache.delete(id);
                this.vectorIndex.delete(id);
            }
        }
    }
    /**
     * Record access pattern for prediction
     */
    recordAccess(id, timestamp) {
        if (!this.config.statisticsCollection) {
            return;
        }
        let pattern = this.accessPatterns.get(id);
        if (!pattern) {
            pattern = [];
            this.accessPatterns.set(id, pattern);
        }
        pattern.push(timestamp);
        // Keep only recent accesses (last 10)
        if (pattern.length > 10) {
            pattern.shift();
        }
    }
    /**
     * Extract connected node IDs from HNSW item
     */
    extractConnectedNodes(item) {
        const connected = new Set();
        if ('connections' in item && item.connections) {
            const connections = item.connections;
            for (const nodeIds of connections.values()) {
                nodeIds.forEach(id => connected.add(id));
            }
        }
        return connected;
    }
    /**
     * Check if cache entry is expired
     */
    isExpired(entry) {
        return entry.expiresAt !== null && Date.now() > entry.expiresAt;
    }
    /**
     * Calculate cosine similarity between vectors
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }
    /**
     * Calculate pattern similarity between access patterns
     */
    patternSimilarity(pattern1, pattern2) {
        const minLength = Math.min(pattern1.length, pattern2.length);
        if (minLength < 2)
            return 0;
        // Calculate intervals between accesses
        const intervals1 = pattern1.slice(1).map((t, i) => t - pattern1[i]);
        const intervals2 = pattern2.slice(1).map((t, i) => t - pattern2[i]);
        // Compare interval patterns
        let similarity = 0;
        const compareLength = Math.min(intervals1.length, intervals2.length);
        for (let i = 0; i < compareLength; i++) {
            const diff = Math.abs(intervals1[i] - intervals2[i]);
            const maxInterval = Math.max(intervals1[i], intervals2[i]);
            similarity += maxInterval === 0 ? 1 : 1 - (diff / maxInterval);
        }
        return compareLength === 0 ? 0 : similarity / compareLength;
    }
    /**
     * Start background optimization process
     */
    startBackgroundOptimization() {
        setInterval(() => {
            this.runBackgroundOptimization();
        }, 60000); // Run every minute
    }
    /**
     * Run background optimization tasks
     */
    runBackgroundOptimization() {
        // Clean up expired entries
        this.evictFromWarmCache();
        this.evictFromHotCache();
        // Clean up old access patterns
        const cutoff = Date.now() - 3600000; // 1 hour
        for (const [id, pattern] of this.accessPatterns.entries()) {
            const recentAccesses = pattern.filter(t => t > cutoff);
            if (recentAccesses.length === 0) {
                this.accessPatterns.delete(id);
            }
            else {
                this.accessPatterns.set(id, recentAccesses);
            }
        }
        this.stats.backgroundOptimizations++;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            ...this.stats,
            hotCacheSize: this.hotCache.size,
            warmCacheSize: this.warmCache.size,
            prefetchQueueSize: this.prefetchQueue.size,
            accessPatternsTracked: this.accessPatterns.size
        };
    }
    /**
     * Clear all caches
     */
    clear() {
        this.hotCache.clear();
        this.warmCache.clear();
        this.prefetchQueue.clear();
        this.accessPatterns.clear();
        this.vectorIndex.clear();
    }
}
//# sourceMappingURL=enhancedCacheManager.js.map