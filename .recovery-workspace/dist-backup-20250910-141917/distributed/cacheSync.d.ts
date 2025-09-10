/**
 * Distributed Cache Synchronization
 * Provides cache coherence across multiple Brainy instances
 */
import { EventEmitter } from 'events';
export interface CacheSyncConfig {
    nodeId: string;
    syncInterval?: number;
    maxSyncBatchSize?: number;
    compressionEnabled?: boolean;
}
export interface CacheEntry {
    key: string;
    value: any;
    version: number;
    timestamp: number;
    ttl?: number;
    nodeId: string;
}
export interface SyncMessage {
    type: 'invalidate' | 'update' | 'delete' | 'batch';
    entries: CacheEntry[];
    source: string;
    timestamp: number;
}
/**
 * Distributed Cache Synchronizer
 */
export declare class CacheSync extends EventEmitter {
    private nodeId;
    private localCache;
    private versionVector;
    private syncQueue;
    private syncInterval;
    private maxSyncBatchSize;
    private syncTimer?;
    private isRunning;
    constructor(config: CacheSyncConfig);
    /**
     * Start cache synchronization
     */
    start(): void;
    /**
     * Stop cache synchronization
     */
    stop(): void;
    /**
     * Get a value from cache
     */
    get(key: string): any | undefined;
    /**
     * Set a value in cache and propagate
     */
    set(key: string, value: any, ttl?: number): void;
    /**
     * Delete a value from cache and propagate
     */
    delete(key: string): boolean;
    /**
     * Invalidate a cache entry across all nodes
     */
    invalidate(key: string): void;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Handle incoming sync message from another node
     */
    handleSyncMessage(message: SyncMessage): void;
    /**
     * Handle a remote cache entry
     */
    private handleRemoteEntry;
    /**
     * Queue a sync message
     */
    private queueSync;
    /**
     * Start sync timer
     */
    private startSyncTimer;
    /**
     * Perform sync operation
     */
    private performSync;
    /**
     * Increment version for a key
     */
    private incrementVersion;
    /**
     * Get cache statistics
     */
    getStats(): {
        entries: number;
        pendingSync: number;
        versionedKeys: number;
        memoryUsage: number;
    };
    /**
     * Get cache entries for debugging
     */
    getEntries(): CacheEntry[];
    /**
     * Merge cache state from another node (for recovery)
     */
    mergeState(entries: CacheEntry[]): void;
}
/**
 * Create a cache sync instance
 */
export declare function createCacheSync(config: CacheSyncConfig): CacheSync;
