/**
 * Cache Augmentation - Optional Search Result Caching
 *
 * Replaces the hardcoded SearchCache in Brainy with an optional augmentation.
 * This reduces core size and allows custom cache implementations.
 *
 * Zero-config: Automatically enabled with sensible defaults
 * Can be disabled or customized via augmentation registry
 */
import { BaseAugmentation } from './brainyAugmentation.js';
import { AugmentationManifest } from './manifest.js';
import { SearchCache } from '../utils/searchCache.js';
import type { GraphNoun } from '../types/graphTypes.js';
export interface CacheConfig {
    maxSize?: number;
    ttl?: number;
    enabled?: boolean;
    invalidateOnWrite?: boolean;
}
/**
 * CacheAugmentation - Makes search caching optional and pluggable
 *
 * Features:
 * - Transparent search result caching
 * - Automatic invalidation on data changes
 * - Memory-aware cache management
 * - Zero-config with smart defaults
 */
export declare class CacheAugmentation extends BaseAugmentation {
    readonly name = "cache";
    readonly timing: "around";
    readonly metadata: "none";
    operations: ("search" | "find" | "similar" | "add" | "update" | "delete" | "clear" | "all")[];
    readonly priority = 50;
    readonly category: "core";
    readonly description = "Transparent search result caching with automatic invalidation";
    private searchCache;
    constructor(config?: CacheConfig);
    getManifest(): AugmentationManifest;
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    /**
     * Execute augmentation - wrap operations with caching logic
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Handle search operation with caching
     */
    private handleSearch;
    /**
     * Get cache statistics
     */
    getStats(): {
        enabled: boolean;
        hits: number;
        misses: number;
        size: number;
        memoryUsage: number;
    } | {
        memoryUsage: number;
        hits: number;
        misses: number;
        evictions: number;
        hitRate: number;
        size: number;
        maxSize: number;
        enabled: boolean;
    };
    /**
     * Clear the cache manually
     */
    clear(): void;
    /**
     * Handle runtime configuration changes
     */
    protected onConfigChange(newConfig: CacheConfig, oldConfig: CacheConfig): Promise<void>;
    /**
     * Clean up expired entries
     */
    cleanupExpiredEntries(): number;
    /**
     * Invalidate cache when data changes
     */
    invalidateOnDataChange(operation: 'add' | 'update' | 'delete'): void;
    /**
     * Get cache key for a query
     */
    getCacheKey(query: any, options?: any): string;
    /**
     * Direct cache get
     */
    get(key: string): any;
    /**
     * Direct cache set
     */
    set(key: string, value: any): void;
    /**
     * Get the underlying SearchCache instance (for compatibility)
     */
    getSearchCache(): SearchCache<GraphNoun> | null;
    /**
     * Get memory usage
     */
    getMemoryUsage(): number;
}
/**
 * Factory function for zero-config cache augmentation
 */
export declare function createCacheAugmentation(config?: CacheConfig): CacheAugmentation;
