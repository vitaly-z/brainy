/**
 * Entity Registry Augmentation
 * Fast external-ID to internal-UUID mapping for streaming data processing
 * Works in write-only mode for high-performance deduplication
 */
import { BaseAugmentation, AugmentationContext } from './brainyAugmentation.js';
export interface EntityRegistryConfig {
    /**
     * Maximum number of entries to keep in memory cache
     * Default: 100,000 entries
     */
    maxCacheSize?: number;
    /**
     * Time to live for cache entries in milliseconds
     * Default: 300,000 (5 minutes)
     */
    cacheTTL?: number;
    /**
     * Fields to index for fast lookup
     * Default: ['did', 'handle', 'uri', 'id', 'external_id']
     */
    indexedFields?: string[];
    /**
     * Persistence strategy
     * memory: Keep only in memory (fast, but lost on restart)
     * storage: Persist to storage (survives restarts)
     * hybrid: Memory + periodic storage sync
     */
    persistence?: 'memory' | 'storage' | 'hybrid';
    /**
     * How often to sync memory cache to storage (hybrid mode)
     * Default: 30000 (30 seconds)
     */
    syncInterval?: number;
}
export interface EntityMapping {
    externalId: string;
    field: string;
    brainyId: string;
    nounType: string;
    lastAccessed: number;
    metadata?: any;
}
/**
 * High-performance entity registry for external ID to Brainy UUID mapping
 * Optimized for streaming data scenarios like Bluesky firehose processing
 */
export declare class EntityRegistryAugmentation extends BaseAugmentation {
    readonly metadata: "readonly";
    readonly name = "entity-registry";
    readonly description = "Fast external-ID to internal-UUID mapping for streaming data";
    readonly timing: 'before' | 'after' | 'around' | 'replace';
    readonly operations: ("add" | "addNoun" | "addVerb")[];
    readonly priority = 90;
    protected config: Required<EntityRegistryConfig>;
    private memoryIndex;
    private fieldIndices;
    private syncTimer?;
    private brain?;
    private storage?;
    private cacheHits;
    private cacheMisses;
    constructor(config?: EntityRegistryConfig);
    initialize(context: AugmentationContext): Promise<void>;
    shutdown(): Promise<void>;
    /**
     * Execute the augmentation
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Register a new entity mapping
     */
    registerEntity(brainyId: string, metadata: any, nounType: string): Promise<void>;
    /**
     * Fast lookup: external ID → Brainy UUID
     * Works in write-only mode without search indexes
     */
    lookupEntity(field: string, value: string): Promise<string | null>;
    /**
     * Batch lookup for multiple external IDs
     */
    lookupBatch(lookups: Array<{
        field: string;
        value: string;
    }>): Promise<Map<string, string | null>>;
    /**
     * Check if entity exists (faster than lookupEntity for existence checks)
     */
    hasEntity(field: string, value: string): Promise<boolean>;
    /**
     * Get all entities by field (e.g., all DIDs)
     */
    getEntitiesByField(field: string): Promise<string[]>;
    /**
     * Get registry statistics
     */
    getStats(): {
        totalMappings: number;
        fieldCounts: Record<string, number>;
        cacheHitRate: number;
        memoryUsage: number;
    };
    /**
     * Clear all cached mappings
     */
    clearCache(): Promise<void>;
    /**
     * Check if an ID looks like it could be an external ID for a specific field
     */
    private looksLikeExternalId;
    private extractFieldValue;
    private evictOldEntries;
    private loadFromStorage;
    private syncToStorage;
    private loadFromStorageByField;
    private loadBatchFromStorage;
    private estimateMemoryUsage;
}
export declare class AutoRegisterEntitiesAugmentation extends BaseAugmentation {
    readonly metadata: "readonly";
    readonly name = "auto-register-entities";
    readonly description = "Automatically register entities in the registry when added";
    readonly timing: 'before' | 'after' | 'around' | 'replace';
    readonly operations: ("add" | "addNoun" | "addVerb")[];
    readonly priority = 85;
    private registry?;
    private brain?;
    initialize(context: AugmentationContext): Promise<void>;
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
}
