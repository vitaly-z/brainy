/**
 * Base Storage Adapter
 * Provides common functionality for all storage adapters
 */
import { GraphVerb, HNSWNoun, HNSWVerb, StatisticsData } from '../coreTypes.js';
import { BaseStorageAdapter } from './adapters/baseStorageAdapter.js';
export declare const ENTITIES_DIR = "entities";
export declare const NOUNS_VECTOR_DIR = "entities/nouns/vectors";
export declare const NOUNS_METADATA_DIR = "entities/nouns/metadata";
export declare const VERBS_VECTOR_DIR = "entities/verbs/vectors";
export declare const VERBS_METADATA_DIR = "entities/verbs/metadata";
export declare const INDEXES_DIR = "indexes";
export declare const METADATA_INDEX_DIR = "indexes/metadata";
export declare const NOUNS_DIR = "nouns";
export declare const VERBS_DIR = "verbs";
export declare const METADATA_DIR = "metadata";
export declare const NOUN_METADATA_DIR = "noun-metadata";
export declare const VERB_METADATA_DIR = "verb-metadata";
export declare const INDEX_DIR = "index";
export declare const SYSTEM_DIR = "_system";
export declare const STATISTICS_KEY = "statistics";
export declare const STORAGE_SCHEMA_VERSION = 3;
export declare const USE_ENTITY_BASED_STRUCTURE = true;
/**
 * Get the appropriate directory path based on configuration
 */
export declare function getDirectoryPath(entityType: 'noun' | 'verb', dataType: 'vector' | 'metadata'): string;
/**
 * Base storage adapter that implements common functionality
 * This is an abstract class that should be extended by specific storage adapters
 */
export declare abstract class BaseStorage extends BaseStorageAdapter {
    protected isInitialized: boolean;
    protected readOnly: boolean;
    /**
     * Initialize the storage adapter
     * This method should be implemented by each specific adapter
     */
    abstract init(): Promise<void>;
    /**
     * Ensure the storage adapter is initialized
     */
    protected ensureInitialized(): Promise<void>;
    /**
     * Save a noun to storage
     */
    saveNoun(noun: HNSWNoun): Promise<void>;
    /**
     * Get a noun from storage
     */
    getNoun(id: string): Promise<HNSWNoun | null>;
    /**
     * Get nouns by noun type
     * @param nounType The noun type to filter by
     * @returns Promise that resolves to an array of nouns of the specified noun type
     */
    getNounsByNounType(nounType: string): Promise<HNSWNoun[]>;
    /**
     * Delete a noun from storage
     */
    deleteNoun(id: string): Promise<void>;
    /**
     * Save a verb to storage
     */
    saveVerb(verb: GraphVerb): Promise<void>;
    /**
     * Get a verb from storage
     */
    getVerb(id: string): Promise<GraphVerb | null>;
    /**
     * Convert HNSWVerb to GraphVerb by combining with metadata
     */
    protected convertHNSWVerbToGraphVerb(hnswVerb: HNSWVerb): Promise<GraphVerb | null>;
    /**
     * Internal method for loading all verbs - used by performance optimizations
     * @internal - Do not use directly, use getVerbs() with pagination instead
     */
    protected _loadAllVerbsForOptimization(): Promise<HNSWVerb[]>;
    /**
     * Get verbs by source
     */
    getVerbsBySource(sourceId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by target
     */
    getVerbsByTarget(targetId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by type
     */
    getVerbsByType(type: string): Promise<GraphVerb[]>;
    /**
     * Internal method for loading all nouns - used by performance optimizations
     * @internal - Do not use directly, use getNouns() with pagination instead
     */
    protected _loadAllNounsForOptimization(): Promise<HNSWNoun[]>;
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
    }): Promise<{
        items: HNSWNoun[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
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
    }): Promise<{
        items: GraphVerb[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Delete a verb from storage
     */
    deleteVerb(id: string): Promise<void>;
    /**
     * Clear all data from storage
     * This method should be implemented by each specific adapter
     */
    abstract clear(): Promise<void>;
    /**
     * Get information about storage usage and capacity
     * This method should be implemented by each specific adapter
     */
    abstract getStorageStatus(): Promise<{
        type: string;
        used: number;
        quota: number | null;
        details?: Record<string, any>;
    }>;
    /**
     * Save metadata to storage
     * This method should be implemented by each specific adapter
     */
    abstract saveMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Get metadata from storage
     * This method should be implemented by each specific adapter
     */
    abstract getMetadata(id: string): Promise<any | null>;
    /**
     * Save noun metadata to storage
     * This method should be implemented by each specific adapter
     */
    saveNounMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Internal method for saving noun metadata
     * This method should be implemented by each specific adapter
     */
    protected abstract saveNounMetadata_internal(id: string, metadata: any): Promise<void>;
    /**
     * Get noun metadata from storage
     * This method should be implemented by each specific adapter
     */
    abstract getNounMetadata(id: string): Promise<any | null>;
    /**
     * Save verb metadata to storage
     * This method should be implemented by each specific adapter
     */
    saveVerbMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Internal method for saving verb metadata
     * This method should be implemented by each specific adapter
     */
    protected abstract saveVerbMetadata_internal(id: string, metadata: any): Promise<void>;
    /**
     * Get verb metadata from storage
     * This method should be implemented by each specific adapter
     */
    abstract getVerbMetadata(id: string): Promise<any | null>;
    /**
     * Save a noun to storage
     * This method should be implemented by each specific adapter
     */
    protected abstract saveNoun_internal(noun: HNSWNoun): Promise<void>;
    /**
     * Get a noun from storage
     * This method should be implemented by each specific adapter
     */
    protected abstract getNoun_internal(id: string): Promise<HNSWNoun | null>;
    /**
     * Get nouns by noun type
     * This method should be implemented by each specific adapter
     */
    protected abstract getNounsByNounType_internal(nounType: string): Promise<HNSWNoun[]>;
    /**
     * Delete a noun from storage
     * This method should be implemented by each specific adapter
     */
    protected abstract deleteNoun_internal(id: string): Promise<void>;
    /**
     * Save a verb to storage
     * This method should be implemented by each specific adapter
     */
    protected abstract saveVerb_internal(verb: HNSWVerb): Promise<void>;
    /**
     * Get a verb from storage
     * This method should be implemented by each specific adapter
     */
    protected abstract getVerb_internal(id: string): Promise<HNSWVerb | null>;
    /**
     * Get verbs by source
     * This method should be implemented by each specific adapter
     */
    protected abstract getVerbsBySource_internal(sourceId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by target
     * This method should be implemented by each specific adapter
     */
    protected abstract getVerbsByTarget_internal(targetId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by type
     * This method should be implemented by each specific adapter
     */
    protected abstract getVerbsByType_internal(type: string): Promise<GraphVerb[]>;
    /**
     * Delete a verb from storage
     * This method should be implemented by each specific adapter
     */
    protected abstract deleteVerb_internal(id: string): Promise<void>;
    /**
     * Helper method to convert a Map to a plain object for serialization
     */
    protected mapToObject<K extends string | number, V>(map: Map<K, V>, valueTransformer?: (value: V) => any): Record<string, any>;
    /**
     * Save statistics data to storage (public interface)
     * @param statistics The statistics data to save
     */
    saveStatistics(statistics: StatisticsData): Promise<void>;
    /**
     * Get statistics data from storage (public interface)
     * @returns Promise that resolves to the statistics data or null if not found
     */
    getStatistics(): Promise<StatisticsData | null>;
    /**
     * Save statistics data to storage
     * This method should be implemented by each specific adapter
     * @param statistics The statistics data to save
     */
    protected abstract saveStatisticsData(statistics: StatisticsData): Promise<void>;
    /**
     * Get statistics data from storage
     * This method should be implemented by each specific adapter
     * @returns Promise that resolves to the statistics data or null if not found
     */
    protected abstract getStatisticsData(): Promise<StatisticsData | null>;
}
