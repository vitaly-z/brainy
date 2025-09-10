/**
 * Triple Intelligence Engine
 * Revolutionary unified search combining Vector + Graph + Field intelligence
 *
 * This is Brainy's killer feature - no other database can do this!
 */
import { Vector, SearchResult } from '../coreTypes.js';
import type { Brainy } from '../brainy.js';
export interface TripleQuery {
    like?: string | Vector | any;
    similar?: string | Vector | any;
    connected?: {
        to?: string | string[];
        from?: string | string[];
        type?: string | string[];
        depth?: number;
        maxDepth?: number;
        direction?: 'in' | 'out' | 'both';
    };
    where?: Record<string, any>;
    limit?: number;
    offset?: number;
    mode?: 'auto' | 'vector' | 'graph' | 'metadata' | 'fusion';
    boost?: 'recent' | 'popular' | 'verified' | string;
    explain?: boolean;
    threshold?: number;
}
export interface TripleResult extends SearchResult {
    vectorScore?: number;
    graphScore?: number;
    fieldScore?: number;
    fusionScore: number;
    explanation?: {
        plan: string;
        timing: Record<string, number>;
        boosts: string[];
    };
}
export interface QueryPlan {
    startWith: 'vector' | 'graph' | 'field';
    canParallelize: boolean;
    estimatedCost: number;
    steps: QueryStep[];
}
export interface QueryStep {
    type: 'vector' | 'graph' | 'field' | 'fusion';
    operation: string;
    estimated: number;
}
/**
 * The Triple Intelligence Engine
 * Unifies vector, graph, and field search into one beautiful API
 */
export declare class TripleIntelligenceEngine {
    private brain;
    private api;
    private planCache;
    constructor(brain: Brainy<any>);
    /**
     * The magic happens here - one query to rule them all
     */
    find(query: TripleQuery): Promise<TripleResult[]>;
    /**
     * Generate optimal execution plan based on query shape and statistics
     */
    private optimizeQuery;
    /**
     * Calculate real costs for each operation based on statistics
     */
    private calculateOperationCosts;
    /**
     * Estimate selectivity of field filters
     */
    private estimateFieldSelectivity;
    /**
     * Build optimal execution plan based on costs
     */
    private buildOptimalPlan;
    /**
     * Build progressive execution steps
     */
    private buildProgressiveSteps;
    /**
     * Build parallel execution steps
     */
    private buildParallelSteps;
    /**
     * Execute searches in parallel for maximum speed
     */
    private parallelSearch;
    /**
     * Progressive filtering for efficiency
     */
    private progressiveSearch;
    /**
     * Vector similarity search
     */
    private vectorSearch;
    /**
     * Graph traversal
     */
    private graphTraversal;
    /**
     * Field-based filtering using MetadataIndex for O(log n) performance
     * NO FALLBACKS - Requires proper where clause and MetadataIndex
     */
    private fieldFilter;
    /**
     * Execute a single signal query directly
     */
    private executeSingleSignal;
    /**
     * Expand graph connections from existing candidates
     */
    private graphExpand;
    /**
     * Vector search within existing candidates
     */
    private vectorSearchWithin;
    /**
     * Apply field filter to existing candidates
     */
    private applyFieldFilter;
    /**
     * Check if metadata matches filter conditions
     */
    private matchesFilter;
    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity;
    /**
     * Fusion ranking using Reciprocal Rank Fusion (RRF)
     * This is the same algorithm used by Google and Elasticsearch
     */
    private fusionRank;
    /**
     * Calculate dynamic signal weights based on query characteristics
     */
    private calculateSignalWeights;
    /**
     * Apply boost strategies
     */
    private applyBoosts;
    /**
     * Add query explanations for debugging
     */
    private addExplanations;
    /**
     * Optimize plan based on historical patterns
     */
    /**
     * Clear query optimization cache
     */
    clearCache(): void;
    /**
     * Get optimization statistics
     */
    getStats(): any;
}
export declare function find(brain: Brainy<any>, query: TripleQuery): Promise<TripleResult[]>;
