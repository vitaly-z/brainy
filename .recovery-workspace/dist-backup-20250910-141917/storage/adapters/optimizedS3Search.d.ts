/**
 * Optimized S3 Search and Pagination
 * Provides efficient search and pagination capabilities for S3-compatible storage
 */
import { HNSWNoun, GraphVerb } from '../../coreTypes.js';
/**
 * Pagination result interface
 */
export interface PaginationResult<T> {
    items: T[];
    totalCount?: number;
    hasMore: boolean;
    nextCursor?: string;
}
/**
 * Filter interface for nouns
 */
export interface NounFilter {
    nounType?: string | string[];
    service?: string | string[];
    metadata?: Record<string, any>;
}
/**
 * Filter interface for verbs
 */
export interface VerbFilter {
    verbType?: string | string[];
    sourceId?: string | string[];
    targetId?: string | string[];
    service?: string | string[];
    metadata?: Record<string, any>;
}
/**
 * Interface for storage operations needed by optimized search
 */
export interface StorageOperations {
    listObjectKeys(prefix: string, limit: number, cursor?: string): Promise<{
        keys: string[];
        hasMore: boolean;
        nextCursor?: string;
    }>;
    getObject<T>(key: string): Promise<T | null>;
    getMetadata(id: string, type: 'noun' | 'verb'): Promise<any | null>;
}
/**
 * Optimized search implementation for S3-compatible storage
 */
export declare class OptimizedS3Search {
    private storage;
    constructor(storage: StorageOperations);
    /**
     * Get nouns with optimized pagination and filtering
     */
    getNounsWithPagination(options?: {
        limit?: number;
        cursor?: string;
        filter?: NounFilter;
    }): Promise<PaginationResult<HNSWNoun>>;
    /**
     * Get verbs with optimized pagination and filtering
     */
    getVerbsWithPagination(options?: {
        limit?: number;
        cursor?: string;
        filter?: VerbFilter;
    }): Promise<PaginationResult<GraphVerb>>;
    /**
     * Check if a noun matches the filter criteria
     */
    private matchesNounFilter;
    /**
     * Check if a verb matches the filter criteria
     */
    private matchesVerbFilter;
    /**
     * Combine HNSWVerb data with metadata to create GraphVerb
     */
    private combineVerbWithMetadata;
}
