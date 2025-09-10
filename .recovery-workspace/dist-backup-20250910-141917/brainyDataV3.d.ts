/**
 * BrainyData V3 - Consistent API Design
 *
 * This is a proposed update to BrainyData with consistent method signatures.
 * All methods use object parameters for consistency and extensibility.
 */
import type { AddNounParams, AddVerbParams, SearchParams, SimilarityParams, RelatedParams, BatchNounsParams, BatchVerbsParams, GetNounsParams, GetVerbsParams, UpdateNounParams, MetadataParams, StatisticsParams, SearchResult, PaginatedResult, BatchResult, StatisticsResult } from './types/apiTypes.js';
/**
 * Proposed consistent API for BrainyData
 * All methods use object parameters
 */
export declare class BrainyDataV3 {
    constructor(config?: any);
    init(): Promise<void>;
    close(): Promise<void>;
    /**
     * Add a single noun
     * OLD: addNoun(data, type, metadata)
     * NEW: addNoun({ data, type, metadata })
     */
    addNoun(params: AddNounParams): Promise<string>;
    /**
     * Add multiple nouns in batch
     * NEW METHOD for better performance
     */
    addNouns(params: BatchNounsParams): Promise<BatchResult>;
    /**
     * Get a single noun by ID
     * OLD: getNoun(id)
     * NEW: getNoun(id) - unchanged, simple enough
     */
    getNoun(id: string): Promise<any | null>;
    /**
     * Get multiple nouns with filtering
     * NEW METHOD for batch retrieval
     */
    getNouns(params: GetNounsParams): Promise<PaginatedResult<any>>;
    /**
     * Update a noun
     * OLD: updateNoun(id, data, metadata) - scattered
     * NEW: updateNoun({ id, data, metadata })
     */
    updateNoun(params: UpdateNounParams): Promise<void>;
    /**
     * Delete a noun
     * OLD: deleteNoun(id)
     * NEW: deleteNoun(id) - unchanged, simple enough
     */
    deleteNoun(id: string): Promise<void>;
    /**
     * Add a single verb (relationship)
     * OLD: addVerb(source, target, type, metadata, weight)
     * NEW: addVerb({ source, target, type, weight, metadata })
     */
    addVerb(params: AddVerbParams): Promise<string>;
    /**
     * Add multiple verbs in batch
     * NEW METHOD for better performance
     */
    addVerbs(params: BatchVerbsParams): Promise<BatchResult>;
    /**
     * Get a single verb by ID
     * OLD: getVerb(id)
     * NEW: getVerb(id) - unchanged, simple enough
     */
    getVerb(id: string): Promise<any | null>;
    /**
     * Get multiple verbs with filtering
     * OLD: getVerbsBySource(id), getVerbsByTarget(id), etc.
     * NEW: getVerbs({ source?, target?, type? })
     */
    getVerbs(params: GetVerbsParams): Promise<PaginatedResult<any>>;
    /**
     * Delete a verb
     * OLD: deleteVerb(id)
     * NEW: deleteVerb(id) - unchanged, simple enough
     */
    deleteVerb(id: string): Promise<void>;
    /**
     * Unified search method
     * OLD: search(options), searchText(query, limit)
     * NEW: search({ query, limit, filter })
     */
    search(params: SearchParams): Promise<SearchResult[]>;
    /**
     * Find similar items
     * OLD: findSimilar(id, limit)
     * NEW: findSimilar({ id, limit, filter })
     */
    findSimilar(params: SimilarityParams): Promise<SearchResult[]>;
    /**
     * Find related items through graph traversal
     * OLD: getRelated(id, options)
     * NEW: findRelated({ id, depth, types })
     */
    findRelated(params: RelatedParams): Promise<PaginatedResult<any>>;
    /**
     * Get metadata for an entity
     * OLD: getMetadata(id)
     * NEW: getMetadata(id) - unchanged, simple enough
     */
    getMetadata(id: string): Promise<any | null>;
    /**
     * Update metadata for an entity
     * OLD: updateMetadata(id, metadata)
     * NEW: updateMetadata({ id, metadata, merge })
     */
    updateMetadata(params: MetadataParams): Promise<void>;
    /**
     * Get database statistics
     * OLD: getStatistics()
     * NEW: getStatistics({ detailed?, includeAugmentations? })
     */
    getStatistics(params?: StatisticsParams): Promise<StatisticsResult>;
    get neural(): {
        /**
         * Calculate similarity between two items
         * Already good: neural.similar(a, b)
         */
        similar: (a: any, b: any) => Promise<number>;
        /**
         * Cluster items semantically
         * Already good: neural.clusters(items?)
         */
        clusters: (items?: string[]) => Promise<any[]>;
        /**
         * Find nearest neighbors
         * Already good: neural.neighbors(id, { limit })
         */
        neighbors: (id: string, options?: any) => Promise<any[]>;
        /**
         * Build semantic hierarchy
         * Already good: neural.hierarchy(id)
         */
        hierarchy: (id: string) => Promise<any>;
        /**
         * Detect outliers
         * Already good: neural.outliers()
         */
        outliers: () => Promise<any[]>;
        /**
         * Get visualization data
         * Already good: neural.visualize()
         */
        visualize: () => Promise<any>;
    };
    get augmentations(): {
        add: (aug: any) => void;
        remove: (name: string) => void;
        get: (name: string) => null;
        execute: (op: string, params: any) => Promise<void>;
        getTypes: () => never[];
    };
}
/**
 * Migration wrapper for backward compatibility
 * This allows existing code to work with the new API
 */
export declare class BrainyDataMigrationWrapper extends BrainyDataV3 {
    /**
     * OLD SIGNATURE: addNoun(data, type, metadata)
     * Wraps to NEW: addNoun({ data, type, metadata })
     */
    addNoun(dataOrParams: any | AddNounParams, type?: string, metadata?: any): Promise<string>;
    /**
     * OLD SIGNATURE: addVerb(source, target, type, metadata, weight)
     * Wraps to NEW: addVerb({ source, target, type, weight, metadata })
     */
    addVerb(sourceOrParams: string | AddVerbParams, target?: string, type?: string, metadata?: any, weight?: number): Promise<string>;
    /**
     * OLD SIGNATURE: searchText(query, limit)
     * Wraps to NEW: search({ query, limit })
     */
    searchText(query: string, limit?: number): Promise<SearchResult[]>;
    /**
     * OLD SIGNATURE: findSimilar(id, limit)
     * Wraps to NEW: findSimilar({ id, limit })
     */
    findSimilar(idOrParams: string | SimilarityParams, limit?: number): Promise<SearchResult[]>;
    /**
     * OLD METHODS: getVerbsBySource, getVerbsByTarget
     * Wraps to NEW: getVerbs({ source }) or getVerbs({ target })
     */
    getVerbsBySource(sourceId: string): Promise<any[]>;
    getVerbsByTarget(targetId: string): Promise<any[]>;
}
