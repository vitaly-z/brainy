/**
 * OPFS (Origin Private File System) Storage Adapter
 * Provides persistent storage for the vector database using the Origin Private File System API
 */
import { GraphVerb, HNSWNoun, HNSWVerb, StatisticsData } from '../../coreTypes.js';
import { BaseStorage } from '../baseStorage.js';
import '../../types/fileSystemTypes.js';
type HNSWNode = HNSWNoun;
/**
 * Type alias for HNSWVerb to make the code more readable
 */
type Edge = HNSWVerb;
type HNSWNoun_internal = HNSWNoun;
/**
 * OPFS storage adapter for browser environments
 * Uses the Origin Private File System API to store data persistently
 */
export declare class OPFSStorage extends BaseStorage {
    private rootDir;
    private nounsDir;
    private verbsDir;
    private metadataDir;
    private nounMetadataDir;
    private verbMetadataDir;
    private indexDir;
    private isAvailable;
    private isPersistentRequested;
    private isPersistentGranted;
    private statistics;
    private activeLocks;
    private lockPrefix;
    constructor();
    /**
     * Initialize the storage adapter
     */
    init(): Promise<void>;
    /**
     * Check if OPFS is available in the current environment
     */
    isOPFSAvailable(): boolean;
    /**
     * Request persistent storage permission from the user
     * @returns Promise that resolves to true if permission was granted, false otherwise
     */
    requestPersistentStorage(): Promise<boolean>;
    /**
     * Check if persistent storage is granted
     * @returns Promise that resolves to true if persistent storage is granted, false otherwise
     */
    isPersistent(): Promise<boolean>;
    /**
     * Save a noun to storage
     */
    protected saveNoun_internal(noun: HNSWNoun_internal): Promise<void>;
    /**
     * Get a noun from storage
     */
    protected getNoun_internal(id: string): Promise<HNSWNoun_internal | null>;
    /**
     * Get nouns by noun type (internal implementation)
     * @param nounType The noun type to filter by
     * @returns Promise that resolves to an array of nouns of the specified noun type
     */
    protected getNounsByNounType_internal(nounType: string): Promise<HNSWNoun[]>;
    /**
     * Get nodes by noun type
     * @param nounType The noun type to filter by
     * @returns Promise that resolves to an array of nodes of the specified noun type
     */
    protected getNodesByNounType(nounType: string): Promise<HNSWNode[]>;
    /**
     * Delete a noun from storage (internal implementation)
     */
    protected deleteNoun_internal(id: string): Promise<void>;
    /**
     * Delete a node from storage
     */
    protected deleteNode(id: string): Promise<void>;
    /**
     * Save a verb to storage (internal implementation)
     */
    protected saveVerb_internal(verb: HNSWVerb): Promise<void>;
    /**
     * Save an edge to storage
     */
    protected saveEdge(edge: Edge): Promise<void>;
    /**
     * Get a verb from storage (internal implementation)
     */
    protected getVerb_internal(id: string): Promise<HNSWVerb | null>;
    /**
     * Get an edge from storage
     */
    protected getEdge(id: string): Promise<Edge | null>;
    /**
     * Get all edges from storage
     */
    protected getAllEdges(): Promise<Edge[]>;
    /**
     * Get verbs by source (internal implementation)
     */
    protected getVerbsBySource_internal(sourceId: string): Promise<GraphVerb[]>;
    /**
     * Get edges by source
     */
    protected getEdgesBySource(sourceId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by target (internal implementation)
     */
    protected getVerbsByTarget_internal(targetId: string): Promise<GraphVerb[]>;
    /**
     * Get edges by target
     */
    protected getEdgesByTarget(targetId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by type (internal implementation)
     */
    protected getVerbsByType_internal(type: string): Promise<GraphVerb[]>;
    /**
     * Get edges by type
     */
    protected getEdgesByType(type: string): Promise<GraphVerb[]>;
    /**
     * Delete a verb from storage (internal implementation)
     */
    protected deleteVerb_internal(id: string): Promise<void>;
    /**
     * Delete an edge from storage
     */
    protected deleteEdge(id: string): Promise<void>;
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
     * OPFS implementation uses controlled concurrency for file operations
     */
    getMetadataBatch(ids: string[]): Promise<Map<string, any>>;
    /**
     * Save verb metadata to storage
     */
    saveVerbMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Get verb metadata from storage
     */
    getVerbMetadata(id: string): Promise<any | null>;
    /**
     * Save noun metadata to storage
     */
    saveNounMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Get noun metadata from storage
     */
    getNounMetadata(id: string): Promise<any | null>;
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
     * Get the statistics key for a specific date
     * @param date The date to get the key for
     * @returns The statistics key for the specified date
     */
    private getStatisticsKeyForDate;
    /**
     * Get the current statistics key
     * @returns The current statistics key
     */
    private getCurrentStatisticsKey;
    /**
     * Get the legacy statistics key (for backward compatibility)
     * @returns The legacy statistics key
     */
    private getLegacyStatisticsKey;
    /**
     * Acquire a browser-based lock for coordinating operations across multiple tabs
     * @param lockKey The key to lock on
     * @param ttl Time to live for the lock in milliseconds (default: 30 seconds)
     * @returns Promise that resolves to true if lock was acquired, false otherwise
     */
    private acquireLock;
    /**
     * Release a browser-based lock
     * @param lockKey The key to unlock
     * @param lockValue The value used when acquiring the lock (for verification)
     * @returns Promise that resolves when lock is released
     */
    private releaseLock;
    /**
     * Clean up expired locks from localStorage
     */
    private cleanupExpiredLocks;
    /**
     * Save statistics data to storage with browser-based locking
     * @param statistics The statistics data to save
     */
    protected saveStatisticsData(statistics: StatisticsData): Promise<void>;
    /**
     * Get statistics data from storage
     * @returns Promise that resolves to the statistics data or null if not found
     */
    protected getStatisticsData(): Promise<StatisticsData | null>;
    /**
     * Get nouns with pagination support
     * @param options Pagination and filter options
     * @returns Promise that resolves to a paginated result of nouns
     */
    getNounsWithPagination(options?: {
        limit?: number;
        cursor?: string;
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
     * Get verbs with pagination support
     * @param options Pagination and filter options
     * @returns Promise that resolves to a paginated result of verbs
     */
    getVerbsWithPagination(options?: {
        limit?: number;
        cursor?: string;
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
}
export {};
