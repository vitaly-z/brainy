/**
 * Operational Modes for Distributed Brainy
 * Defines different modes with optimized caching strategies
 */
import { OperationalMode, CacheStrategy, InstanceRole } from '../types/distributedTypes.js';
/**
 * Base operational mode
 */
export declare abstract class BaseOperationalMode implements OperationalMode {
    abstract canRead: boolean;
    abstract canWrite: boolean;
    abstract canDelete: boolean;
    abstract cacheStrategy: CacheStrategy;
    /**
     * Validate operation is allowed in this mode
     */
    validateOperation(operation: 'read' | 'write' | 'delete'): void;
}
/**
 * Read-only mode optimized for query performance
 */
export declare class ReaderMode extends BaseOperationalMode {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    cacheStrategy: CacheStrategy;
    /**
     * Get optimized cache configuration for readers
     */
    getCacheConfig(): {
        hotCacheMaxSize: number;
        hotCacheEvictionThreshold: number;
        warmCacheTTL: number;
        batchSize: number;
        autoTune: boolean;
        autoTuneInterval: number;
        readOnly: boolean;
    };
}
/**
 * Write-only mode optimized for ingestion
 */
export declare class WriterMode extends BaseOperationalMode {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    cacheStrategy: CacheStrategy;
    /**
     * Get optimized cache configuration for writers
     */
    getCacheConfig(): {
        hotCacheMaxSize: number;
        hotCacheEvictionThreshold: number;
        warmCacheTTL: number;
        batchSize: number;
        autoTune: boolean;
        writeOnly: boolean;
    };
}
/**
 * Hybrid mode that can both read and write
 */
export declare class HybridMode extends BaseOperationalMode {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    cacheStrategy: CacheStrategy;
    private readWriteRatio;
    /**
     * Get balanced cache configuration
     */
    getCacheConfig(): {
        hotCacheMaxSize: number;
        hotCacheEvictionThreshold: number;
        warmCacheTTL: number;
        batchSize: number;
        autoTune: boolean;
        autoTuneInterval: number;
    };
    /**
     * Update cache strategy based on workload
     * @param readCount - Number of recent reads
     * @param writeCount - Number of recent writes
     */
    updateWorkloadBalance(readCount: number, writeCount: number): void;
}
/**
 * Factory for creating operational modes
 */
export declare class OperationalModeFactory {
    /**
     * Create operational mode based on role
     * @param role - The instance role
     * @returns The appropriate operational mode
     */
    static createMode(role: InstanceRole): BaseOperationalMode;
    /**
     * Create mode with custom cache strategy
     * @param role - The instance role
     * @param customStrategy - Custom cache strategy overrides
     * @returns The operational mode with custom strategy
     */
    static createModeWithStrategy(role: InstanceRole, customStrategy: Partial<CacheStrategy>): BaseOperationalMode;
}
