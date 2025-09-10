/**
 * Distributed Cache Synchronization
 * Provides cache coherence across multiple Brainy instances
 */
import { EventEmitter } from 'events';
/**
 * Distributed Cache Synchronizer
 */
export class CacheSync extends EventEmitter {
    constructor(config) {
        super();
        this.localCache = new Map();
        this.versionVector = new Map();
        this.syncQueue = [];
        this.isRunning = false;
        this.nodeId = config.nodeId;
        this.syncInterval = config.syncInterval || 1000;
        this.maxSyncBatchSize = config.maxSyncBatchSize || 100;
    }
    /**
     * Start cache synchronization
     */
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.startSyncTimer();
        this.emit('started', { nodeId: this.nodeId });
    }
    /**
     * Stop cache synchronization
     */
    stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = undefined;
        }
        this.emit('stopped', { nodeId: this.nodeId });
    }
    /**
     * Get a value from cache
     */
    get(key) {
        const entry = this.localCache.get(key);
        if (!entry)
            return undefined;
        // Check TTL
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
            this.localCache.delete(key);
            return undefined;
        }
        return entry.value;
    }
    /**
     * Set a value in cache and propagate
     */
    set(key, value, ttl) {
        const version = this.incrementVersion(key);
        const entry = {
            key,
            value,
            version,
            timestamp: Date.now(),
            ttl,
            nodeId: this.nodeId
        };
        this.localCache.set(key, entry);
        // Queue for sync
        this.queueSync('update', [entry]);
    }
    /**
     * Delete a value from cache and propagate
     */
    delete(key) {
        const existed = this.localCache.has(key);
        if (existed) {
            const version = this.incrementVersion(key);
            this.localCache.delete(key);
            // Queue deletion for sync
            this.queueSync('delete', [{
                    key,
                    value: null,
                    version,
                    timestamp: Date.now(),
                    nodeId: this.nodeId
                }]);
        }
        return existed;
    }
    /**
     * Invalidate a cache entry across all nodes
     */
    invalidate(key) {
        const version = this.incrementVersion(key);
        this.localCache.delete(key);
        // Queue invalidation
        this.queueSync('invalidate', [{
                key,
                value: null,
                version,
                timestamp: Date.now(),
                nodeId: this.nodeId
            }]);
    }
    /**
     * Clear all cache entries
     */
    clear() {
        const entries = [];
        for (const key of this.localCache.keys()) {
            const version = this.incrementVersion(key);
            entries.push({
                key,
                value: null,
                version,
                timestamp: Date.now(),
                nodeId: this.nodeId
            });
        }
        this.localCache.clear();
        if (entries.length > 0) {
            this.queueSync('delete', entries);
        }
    }
    /**
     * Handle incoming sync message from another node
     */
    handleSyncMessage(message) {
        if (message.source === this.nodeId)
            return; // Ignore own messages
        for (const entry of message.entries) {
            this.handleRemoteEntry(message.type, entry);
        }
        this.emit('synced', {
            type: message.type,
            entries: message.entries.length,
            source: message.source
        });
    }
    /**
     * Handle a remote cache entry
     */
    handleRemoteEntry(type, entry) {
        const localEntry = this.localCache.get(entry.key);
        const localVersion = this.versionVector.get(entry.key) || 0;
        // Version vector check - only accept if remote version is newer
        if (entry.version <= localVersion) {
            return; // Our version is newer or same, ignore
        }
        // Update version vector
        this.versionVector.set(entry.key, entry.version);
        switch (type) {
            case 'update':
            case 'batch':
                // Update local cache with remote value
                this.localCache.set(entry.key, entry);
                break;
            case 'delete':
            case 'invalidate':
                // Remove from local cache
                this.localCache.delete(entry.key);
                break;
        }
    }
    /**
     * Queue a sync message
     */
    queueSync(type, entries) {
        const message = {
            type,
            entries,
            source: this.nodeId,
            timestamp: Date.now()
        };
        this.syncQueue.push(message);
        // If queue is getting large, sync immediately
        if (this.syncQueue.length >= this.maxSyncBatchSize) {
            this.performSync();
        }
    }
    /**
     * Start sync timer
     */
    startSyncTimer() {
        this.syncTimer = setInterval(() => {
            this.performSync();
        }, this.syncInterval);
    }
    /**
     * Perform sync operation
     */
    performSync() {
        if (this.syncQueue.length === 0)
            return;
        // Batch multiple messages if possible
        const messages = this.syncQueue.splice(0, this.maxSyncBatchSize);
        if (messages.length === 1) {
            // Single message
            this.emit('sync', messages[0]);
        }
        else {
            // Batch multiple messages
            const batchedEntries = [];
            for (const msg of messages) {
                batchedEntries.push(...msg.entries);
            }
            const batchMessage = {
                type: 'batch',
                entries: batchedEntries,
                source: this.nodeId,
                timestamp: Date.now()
            };
            this.emit('sync', batchMessage);
        }
    }
    /**
     * Increment version for a key
     */
    incrementVersion(key) {
        const current = this.versionVector.get(key) || 0;
        const next = current + 1;
        this.versionVector.set(key, next);
        return next;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        // Estimate memory usage (rough approximation)
        let memoryUsage = 0;
        for (const entry of this.localCache.values()) {
            memoryUsage += JSON.stringify(entry).length;
        }
        return {
            entries: this.localCache.size,
            pendingSync: this.syncQueue.length,
            versionedKeys: this.versionVector.size,
            memoryUsage
        };
    }
    /**
     * Get cache entries for debugging
     */
    getEntries() {
        return Array.from(this.localCache.values());
    }
    /**
     * Merge cache state from another node (for recovery)
     */
    mergeState(entries) {
        for (const entry of entries) {
            this.handleRemoteEntry('update', entry);
        }
    }
}
/**
 * Create a cache sync instance
 */
export function createCacheSync(config) {
    return new CacheSync(config);
}
//# sourceMappingURL=cacheSync.js.map