/**
 * File System Storage Adapter
 * File system storage adapter for Node.js environments
 */
import { GraphVerb, HNSWNoun, HNSWVerb, StatisticsData } from '../../coreTypes.js';
import { BaseStorage } from '../baseStorage.js';
type HNSWNode = HNSWNoun;
type Edge = HNSWVerb;
/**
 * File system storage adapter for Node.js environments
 * Uses the file system to store data in the specified directory structure
 */
export declare class FileSystemStorage extends BaseStorage {
    private rootDir;
    private nounsDir;
    private verbsDir;
    private metadataDir;
    private nounMetadataDir;
    private verbMetadataDir;
    private indexDir;
    private systemDir;
    private lockDir;
    private useDualWrite;
    private activeLocks;
    /**
     * Initialize the storage adapter
     * @param rootDirectory The root directory for storage
     */
    constructor(rootDirectory: string);
    /**
     * Initialize the storage adapter
     */
    init(): Promise<void>;
    /**
     * Check if a directory exists
     */
    private directoryExists;
    /**
     * Ensure a directory exists, creating it if necessary
     */
    private ensureDirectoryExists;
    /**
     * Save a node to storage
     */
    protected saveNode(node: HNSWNode): Promise<void>;
    /**
     * Get a node from storage
     */
    protected getNode(id: string): Promise<HNSWNode | null>;
    /**
     * Get all nodes from storage
     */
    protected getAllNodes(): Promise<HNSWNode[]>;
    /**
     * Get nodes by noun type
     * @param nounType The noun type to filter by
     * @returns Promise that resolves to an array of nodes of the specified noun type
     */
    protected getNodesByNounType(nounType: string): Promise<HNSWNode[]>;
    /**
     * Delete a node from storage
     */
    protected deleteNode(id: string): Promise<void>;
    /**
     * Save an edge to storage
     */
    protected saveEdge(edge: Edge): Promise<void>;
    /**
     * Get an edge from storage
     */
    protected getEdge(id: string): Promise<Edge | null>;
    /**
     * Get all edges from storage
     */
    protected getAllEdges(): Promise<Edge[]>;
    /**
     * Get edges by source
     */
    protected getEdgesBySource(sourceId: string): Promise<Edge[]>;
    /**
     * Get edges by target
     */
    protected getEdgesByTarget(targetId: string): Promise<Edge[]>;
    /**
     * Get edges by type
     */
    protected getEdgesByType(type: string): Promise<Edge[]>;
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
     * FileSystem implementation uses controlled concurrency to prevent too many file reads
     */
    getMetadataBatch(ids: string[]): Promise<Map<string, any>>;
    /**
     * Save noun metadata to storage
     */
    saveNounMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Get noun metadata from storage
     */
    getNounMetadata(id: string): Promise<any | null>;
    /**
     * Save verb metadata to storage
     */
    saveVerbMetadata(id: string, metadata: any): Promise<void>;
    /**
     * Get verb metadata from storage
     */
    getVerbMetadata(id: string): Promise<any | null>;
    /**
     * Get nouns with pagination support
     * @param options Pagination options
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
     * Implementation of abstract methods from BaseStorage
     */
    /**
     * Save a noun to storage
     */
    protected saveNoun_internal(noun: HNSWNoun): Promise<void>;
    /**
     * Get a noun from storage
     */
    protected getNoun_internal(id: string): Promise<HNSWNoun | null>;
    /**
     * Get nouns by noun type
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
     * Get verbs by source
     */
    protected getVerbsBySource_internal(sourceId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by target
     */
    protected getVerbsByTarget_internal(targetId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by type
     */
    protected getVerbsByType_internal(type: string): Promise<GraphVerb[]>;
    /**
     * Delete a verb from storage
     */
    protected deleteVerb_internal(id: string): Promise<void>;
    /**
     * Acquire a file-based lock for coordinating operations across multiple processes
     * @param lockKey The key to lock on
     * @param ttl Time to live for the lock in milliseconds (default: 30 seconds)
     * @returns Promise that resolves to true if lock was acquired, false otherwise
     */
    private acquireLock;
    /**
     * Release a file-based lock
     * @param lockKey The key to unlock
     * @param lockValue The value used when acquiring the lock (for verification)
     * @returns Promise that resolves when lock is released
     */
    private releaseLock;
    /**
     * Clean up expired lock files
     */
    private cleanupExpiredLocks;
    /**
     * Save statistics data to storage with file-based locking
     */
    protected saveStatisticsData(statistics: StatisticsData): Promise<void>;
    /**
     * Get statistics data from storage
     */
    protected getStatisticsData(): Promise<StatisticsData | null>;
    /**
     * Save statistics with backward compatibility (dual write)
     */
    private saveStatisticsWithBackwardCompat;
    /**
     * Get statistics with backward compatibility (dual read)
     */
    private getStatisticsWithBackwardCompat;
}
export {};
