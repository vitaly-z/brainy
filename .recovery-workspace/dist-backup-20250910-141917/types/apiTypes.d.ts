/**
 * Consistent API Types for Brainy
 *
 * These types provide a uniform interface for all public methods,
 * using object parameters for consistency and extensibility.
 */
import type { Vector } from '../coreTypes.js';
import type { NounType, VerbType } from './graphTypes.js';
/**
 * Parameters for adding a noun
 */
export interface AddNounParams {
    data: any | Vector;
    type: NounType | string;
    metadata?: any;
    id?: string;
    service?: string;
}
/**
 * Parameters for updating a noun
 */
export interface UpdateNounParams {
    id: string;
    data?: any;
    metadata?: any;
    type?: NounType | string;
}
/**
 * Parameters for getting nouns
 */
export interface GetNounsParams {
    ids?: string[];
    type?: NounType | string | string[];
    limit?: number;
    offset?: number;
    cursor?: string;
    filter?: Record<string, any>;
    service?: string;
}
/**
 * Parameters for adding a verb (relationship)
 */
export interface AddVerbParams {
    source: string;
    target: string;
    type: VerbType | string;
    weight?: number;
    metadata?: any;
    service?: string;
}
/**
 * Parameters for getting verbs
 */
export interface GetVerbsParams {
    source?: string;
    target?: string;
    type?: VerbType | string | string[];
    limit?: number;
    offset?: number;
    cursor?: string;
    filter?: Record<string, any>;
    service?: string;
}
/**
 * Unified search parameters
 */
export interface SearchParams {
    query: string | Vector;
    limit?: number;
    threshold?: number;
    filter?: {
        type?: NounType | string | string[];
        metadata?: Record<string, any>;
        service?: string;
    };
    includeMetadata?: boolean;
    includeVectors?: boolean;
}
/**
 * Parameters for similarity search
 */
export interface SimilarityParams {
    id?: string;
    data?: any | Vector;
    limit?: number;
    threshold?: number;
    filter?: {
        type?: NounType | string | string[];
        metadata?: Record<string, any>;
        service?: string;
    };
}
/**
 * Parameters for related items search
 */
export interface RelatedParams {
    id: string;
    depth?: number;
    limit?: number;
    types?: VerbType[] | string[];
    direction?: 'outgoing' | 'incoming' | 'both';
}
/**
 * Parameters for batch noun operations
 */
export interface BatchNounsParams {
    items: AddNounParams[];
    parallel?: boolean;
    chunkSize?: number;
    onProgress?: (completed: number, total: number) => void;
}
/**
 * Parameters for batch verb operations
 */
export interface BatchVerbsParams {
    items: AddVerbParams[];
    parallel?: boolean;
    chunkSize?: number;
    onProgress?: (completed: number, total: number) => void;
}
/**
 * Parameters for statistics queries
 */
export interface StatisticsParams {
    detailed?: boolean;
    includeAugmentations?: boolean;
    includeMemory?: boolean;
    service?: string;
}
/**
 * Parameters for metadata operations
 */
export interface MetadataParams {
    id: string;
    metadata: any;
    merge?: boolean;
}
/**
 * Dynamic configuration update parameters
 */
export interface ConfigUpdateParams {
    embeddings?: {
        model?: string;
        precision?: 'q8' | 'fp32';
        cache?: boolean;
    };
    augmentations?: {
        [name: string]: boolean | Record<string, any>;
    };
    storage?: {
        type?: string;
        config?: any;
    };
    performance?: {
        batchSize?: number;
        maxConcurrency?: number;
        cacheSize?: number;
    };
}
/**
 * API for Triple Intelligence Engine to access Brainy internals
 * This provides type-safe access without 'as any' casts
 */
export interface TripleIntelligenceAPI {
    vectorSearch(vector: Vector | string, limit: number): Promise<Array<{
        id: string;
        score: number;
        entity?: any;
    }>>;
    graphTraversal(options: {
        start: string | string[];
        type?: string | string[];
        direction?: 'in' | 'out' | 'both';
        maxDepth?: number;
    }): Promise<Array<{
        id: string;
        score: number;
        depth: number;
    }>>;
    metadataQuery(where: Record<string, any>): Promise<Set<string>>;
    getEntity(id: string): Promise<any>;
    getVerbsBySource(sourceId: string): Promise<any[]>;
    getVerbsByTarget(targetId: string): Promise<any[]>;
    getStatistics(): Promise<{
        totalCount: number;
        fieldStats: Record<string, {
            min: number;
            max: number;
            cardinality: number;
            type: string;
        }>;
    }>;
    getAllNouns(): Map<string, any>;
    hasMetadataIndex(): boolean;
}
/**
 * Unified search result
 */
export interface SearchResult<T = any> {
    id: string;
    score: number;
    data?: T;
    metadata?: any;
    vector?: Vector;
    type?: string;
    distance?: number;
}
/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
    items: T[];
    total?: number;
    hasMore: boolean;
    nextCursor?: string;
    previousCursor?: string;
}
/**
 * Batch operation result
 */
export interface BatchResult {
    successful: string[];
    failed: Array<{
        index: number;
        error: string;
        item?: any;
    }>;
    total: number;
    duration: number;
}
/**
 * Statistics result
 */
export interface StatisticsResult {
    nouns: {
        total: number;
        byType: Record<string, number>;
    };
    verbs: {
        total: number;
        byType: Record<string, number>;
    };
    storage: {
        used: number;
        type: string;
    };
    performance?: {
        avgLatency: number;
        throughput: number;
        cacheHitRate?: number;
    };
    augmentations?: Record<string, any>;
    memory?: {
        used: number;
        limit: number;
    };
}
/**
 * Structured error for API operations
 */
export declare class BrainyAPIError extends Error {
    code: string;
    statusCode: number;
    details?: any | undefined;
    constructor(message: string, code: string, statusCode?: number, details?: any | undefined);
}
export declare const ErrorCodes: {
    readonly INVALID_TYPE: "INVALID_TYPE";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly DUPLICATE_ID: "DUPLICATE_ID";
    readonly INVALID_VECTOR: "INVALID_VECTOR";
    readonly STORAGE_ERROR: "STORAGE_ERROR";
    readonly EMBEDDING_ERROR: "EMBEDDING_ERROR";
    readonly AUGMENTATION_ERROR: "AUGMENTATION_ERROR";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
};
