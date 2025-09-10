/**
 * Memory Storage Adapter
 * In-memory storage adapter for environments where persistent storage is not available or needed
 */
import { GraphVerb, HNSWNoun, HNSWVerb, StatisticsData } from '../../coreTypes.js';
import { BaseStorage } from '../baseStorage.js';
import { PaginatedResult } from '../../types/paginationTypes.js';
/**
 * In-memory storage adapter
 * Uses Maps to store data in memory
 */
export declare class MemoryStorage extends BaseStorage {
    private nouns;
    private verbs;
    private metadata;
    private nounMetadata;
    private verbMetadata;
    private statistics;
    constructor();
    /**
     * Initialize the storage adapter
     * Nothing to initialize for in-memory storage
     */
    init(): Promise<void>;
    /**
     * Save a noun to storage
     */
    protected saveNoun_internal(noun: HNSWNoun): Promise<void>;
    /**
     * Get a noun from storage
     */
    protected getNoun_internal(id: string): Promise<HNSWNoun | null>;
    /**
     * Get nouns with pagination and filtering
     * @param options Pagination and filtering options
     * @returns Promise that resolves to a paginated result of nouns
     */
    getNouns(options?: {
        pagination?: {
            offset?: number;
            limit?: number;
            cursor?: string;
        };
        filter?: {
            nounType?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<PaginatedResult<HNSWNoun>>;
    /**
     * Get nouns with pagination - simplified interface for compatibility
     */
    getNounsWithPagination(options?: {
        limit?: number;
        cursor?: string;
        filter?: any;
    }): Promise<{
        items: HNSWNoun[];
        totalCount: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Get nouns by noun type
     * @param nounType The noun type to filter by
     * @returns Promise that resolves to an array of nouns of the specified noun type
     * @deprecated Use getNouns() with filter.nounType instead
     */
    protected getNounsByNounType_internal(nounType: string): Promise<HNSWNoun[]>;
    /**
     * Delete a noun from storage
     */
    protected deleteNoun_internal(id: string): Promise<void>;
    /**
     * Save a verb to storage
     */
    protected saveVerb_internal(verb: HNSWVerb): Promise<void>;
    /**
     * Get a verb from storage
     */
    protected getVerb_internal(id: string): Promise<HNSWVerb | null>;
    /**
     * Get verbs with pagination and filtering
     * @param options Pagination and filtering options
     * @returns Promise that resolves to a paginated result of verbs
     */
    getVerbs(options?: {
        pagination?: {
            offset?: number;
            limit?: number;
            cursor?: string;
        };
        filter?: {
            verbType?: string | string[];
            sourceId?: string | string[];
            targetId?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<PaginatedResult<GraphVerb>>;
    /**
     * Get verbs by source
     * @deprecated Use getVerbs() with filter.sourceId instead
     */
    protected getVerbsBySource_internal(sourceId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by target
     * @deprecated Use getVerbs() with filter.targetId instead
     */
    protected getVerbsByTarget_internal(targetId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by type
     * @deprecated Use getVerbs() with filter.verbType instead
     */
    protected getVerbsByType_internal(type: string): Promise<GraphVerb[]>;
    /**
     * Delete a verb from storage
     */
    protected deleteVerb_internal(id: string): Promise<void>;
    /**
     * Save metadata to storage
     */
    saveMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Get metadata from storage
     */
    getMetadata(id: string): Promise<any | null>;
    /**
     * Get multiple metadata objects in batches (CRITICAL: Prevents socket exhaustion)
     * Memory storage implementation is simple since all data is already in memory
     */
    getMetadataBatch(ids: string[]): Promise<Map<string, any>>;
    /**
     * Save noun metadata to storage (internal implementation)
     */
    protected saveNounMetadata_internal(id: string, metadata: any): Promise<void>;
    /**
     * Get noun metadata from storage
     */
    getNounMetadata(id: string): Promise<any | null>;
    /**
     * Save verb metadata to storage (internal implementation)
     */
    protected saveVerbMetadata_internal(id: string, metadata: any): Promise<void>;
    /**
     * Get verb metadata from storage
     */
    getVerbMetadata(id: string): Promise<any | null>;
    /**
     * Clear all data from storage
     */
    clear(): Promise<void>;
    /**
     * Get information about storage usage and capacity
     */
    getStorageStatus(): Promise<{
        type: string;
        used: number;
        quota: number | null;
        details?: Record<string, any>;
    }>;
    /**
     * Save statistics data to storage
     * @param statistics The statistics data to save
     */
    protected saveStatisticsData(statistics: StatisticsData): Promise<void>;
    /**
     * Get statistics data from storage
     * @returns Promise that resolves to the statistics data or null if not found
     */
    protected getStatisticsData(): Promise<StatisticsData | null>;
}
