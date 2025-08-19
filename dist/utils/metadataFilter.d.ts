/**
 * Smart metadata filtering for vector search
 * Filters DURING search to ensure relevant results
 * Simple API that just works without configuration
 */
import { SearchResult, HNSWNoun } from '../coreTypes.js';
/**
 * MongoDB-style query operators
 */
export interface QueryOperators {
    $eq?: any;
    $ne?: any;
    $gt?: any;
    $gte?: any;
    $lt?: any;
    $lte?: any;
    $in?: any[];
    $nin?: any[];
    $exists?: boolean;
    $regex?: string | RegExp;
    $includes?: any;
    $all?: any[];
    $size?: number;
    $and?: MetadataFilter[];
    $or?: MetadataFilter[];
    $not?: MetadataFilter;
}
/**
 * Metadata filter definition
 */
export interface MetadataFilter {
    [key: string]: any | QueryOperators;
}
/**
 * Options for metadata filtering
 */
export interface MetadataFilterOptions {
    metadata?: MetadataFilter;
    scoring?: {
        vectorWeight?: number;
        metadataWeight?: number;
        metadataBoosts?: Record<string, number | ((value: any, query: any) => number)>;
    };
}
/**
 * Check if metadata matches the filter
 */
export declare function matchesMetadataFilter(metadata: any, filter: MetadataFilter): boolean;
/**
 * Calculate metadata boost score
 */
export declare function calculateMetadataScore(metadata: any, filter: MetadataFilter, scoring?: MetadataFilterOptions['scoring']): number;
/**
 * Apply compound scoring to search results
 */
export declare function applyCompoundScoring<T>(results: SearchResult<T>[], filter: MetadataFilter, scoring?: MetadataFilterOptions['scoring']): SearchResult<T>[];
/**
 * Filter search results by metadata
 */
export declare function filterSearchResultsByMetadata<T>(results: SearchResult<T>[], filter: MetadataFilter): SearchResult<T>[];
/**
 * Filter nouns by metadata before search
 */
export declare function filterNounsByMetadata(nouns: HNSWNoun[], filter: MetadataFilter): HNSWNoun[];
/**
 * Aggregate search results for faceted search
 */
export interface FacetConfig {
    field: string;
    limit?: number;
}
export interface FacetResult {
    [value: string]: number;
}
export interface AggregationResult<T> {
    results: SearchResult<T>[];
    facets: Record<string, FacetResult>;
}
export declare function aggregateSearchResults<T>(results: SearchResult<T>[], facets: Record<string, FacetConfig>): AggregationResult<T>;
