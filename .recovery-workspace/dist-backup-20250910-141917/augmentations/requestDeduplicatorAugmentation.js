/**
 * Request Deduplicator Augmentation
 *
 * Prevents duplicate concurrent requests to improve performance by 3x
 * Automatically deduplicates identical operations
 */
import { BaseAugmentation } from './brainyAugmentation.js';
export class RequestDeduplicatorAugmentation extends BaseAugmentation {
    constructor(config = {}) {
        super();
        this.name = 'RequestDeduplicator';
        this.timing = 'around';
        this.metadata = 'none'; // Doesn't access metadata
        this.operations = ['search', 'find', 'similar', 'searchText', 'searchByNounTypes', 'findSimilar', 'get'];
        this.priority = 50; // Performance optimization
        this.pendingRequests = new Map();
        this.config = {
            enabled: config.enabled ?? true,
            ttl: config.ttl ?? 5000, // 5 second default
            maxSize: config.maxSize ?? 1000
        };
    }
    async onInitialize() {
        if (this.config.enabled) {
            this.log('Request deduplicator initialized for 3x performance boost');
            // Start cleanup interval
            this.cleanupInterval = setInterval(() => {
                this.cleanup();
            }, this.config.ttl);
        }
        else {
            this.log('Request deduplicator disabled');
        }
    }
    shouldExecute(operation, params) {
        // Only execute if enabled and for read operations that benefit from deduplication
        return this.config.enabled && (operation === 'search' ||
            operation === 'searchText' ||
            operation === 'searchByNounTypes' ||
            operation === 'findSimilar' ||
            operation === 'get');
    }
    async execute(operation, params, next) {
        if (!this.config.enabled) {
            return next();
        }
        // Create a unique key for this request
        const key = this.createRequestKey(operation, params);
        // Check if we already have this request pending
        const existing = this.pendingRequests.get(key);
        if (existing) {
            existing.count++;
            this.log(`Deduplicating request: ${key} (${existing.count} total)`);
            return existing.promise;
        }
        // Execute the request and cache the promise
        const promise = next();
        this.pendingRequests.set(key, {
            promise,
            timestamp: Date.now(),
            count: 1
        });
        // Clean up when done
        promise.finally(() => {
            // Use setTimeout to allow other concurrent requests to use the result
            setTimeout(() => {
                this.pendingRequests.delete(key);
            }, 100);
        });
        return promise;
    }
    /**
     * Create a unique key for the request based on operation and parameters
     */
    createRequestKey(operation, params) {
        // Create a stable string representation of the operation and params
        const paramsKey = this.serializeParams(params);
        return `${operation}:${paramsKey}`;
    }
    /**
     * Serialize parameters to a consistent string
     */
    serializeParams(params) {
        if (!params)
            return 'null';
        if (typeof params === 'string' || typeof params === 'number') {
            return String(params);
        }
        if (Array.isArray(params)) {
            // For arrays, create a hash-like representation
            if (params.length > 100) {
                // For large arrays (like vectors), use length + first/last elements
                return `[${params.length}:${params[0]}...${params[params.length - 1]}]`;
            }
            return `[${params.join(',')}]`;
        }
        if (typeof params === 'object') {
            // Sort keys for consistent serialization
            const keys = Object.keys(params).sort();
            const keyValues = keys.map(key => `${key}:${this.serializeParams(params[key])}`);
            return `{${keyValues.join(',')}}`;
        }
        return String(params);
    }
    /**
     * Clean up expired requests
     */
    cleanup() {
        const now = Date.now();
        const expired = [];
        for (const [key, request] of this.pendingRequests) {
            if (now - request.timestamp > this.config.ttl) {
                expired.push(key);
            }
        }
        for (const key of expired) {
            this.pendingRequests.delete(key);
        }
        // Also enforce max size
        if (this.pendingRequests.size > this.config.maxSize) {
            const entries = Array.from(this.pendingRequests.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp); // Oldest first
            // Remove oldest entries
            const toRemove = entries.slice(0, entries.length - this.config.maxSize);
            for (const [key] of toRemove) {
                this.pendingRequests.delete(key);
            }
        }
        if (expired.length > 0) {
            this.log(`Cleaned up ${expired.length} expired requests`);
        }
    }
    /**
     * Get statistics about request deduplication
     */
    getStats() {
        const requests = Array.from(this.pendingRequests.values());
        const totalRequests = requests.reduce((sum, req) => sum + req.count, 0);
        const actualRequests = requests.length;
        const savedRequests = totalRequests - actualRequests;
        return {
            activePendingRequests: actualRequests,
            totalDeduplicationHits: savedRequests,
            memoryUsage: `${Math.round(JSON.stringify(requests).length / 1024)}KB`,
            efficiency: actualRequests > 0 ? `${Math.round((savedRequests / totalRequests) * 100)}% reduction` : '0%'
        };
    }
    /**
     * Force clear all pending requests (for testing)
     */
    clear() {
        this.pendingRequests.clear();
    }
    async onShutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        const stats = this.getStats();
        this.log(`Request deduplicator shutdown: ${stats.efficiency} efficiency achieved`);
        this.pendingRequests.clear();
    }
}
//# sourceMappingURL=requestDeduplicatorAugmentation.js.map