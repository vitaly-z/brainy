/**
 * Smart metadata filtering for vector search
 * Filters DURING search to ensure relevant results
 * Simple API that just works without configuration
 */
import { SearchResult, HNSWNoun } from '../coreTypes.js';
/**
 * Brainy Field Operators (BFO) - Our own field query system
 * Designed for performance, clarity, and patent independence
 */
export interface BrainyFieldOperators {
    equals?: any;
    notEquals?: any;
    is?: any;
    isNot?: any;
    greaterThan?: any;
    greaterEqual?: any;
    lessThan?: any;
    lessEqual?: any;
    between?: [any, any];
    oneOf?: any[];
    noneOf?: any[];
    contains?: any;
    excludes?: any;
    hasAll?: any[];
    length?: number;
    exists?: boolean;
    missing?: boolean;
    matches?: string | RegExp;
    startsWith?: string;
    endsWith?: string;
    allOf?: MetadataFilter[];
    anyOf?: MetadataFilter[];
    not?: MetadataFilter;
    eq?: any;
    ne?: any;
    gt?: any;
    gte?: any;
    lt?: any;
    lte?: any;
}
/**
 * Metadata filter definition
 */
export interface MetadataFilter {
    [key: string]: any | BrainyFieldOperators;
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
