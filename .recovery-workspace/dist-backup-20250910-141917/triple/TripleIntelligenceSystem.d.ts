/**
 * Triple Intelligence System - Consolidated, Production-Ready Implementation
 *
 * NO FALLBACKS - NO MOCKS - NO STUBS - REAL PERFORMANCE
 *
 * This is the single source of truth for Triple Intelligence operations.
 * All operations MUST use fast paths or FAIL LOUDLY.
 *
 * Performance Guarantees:
 * - Vector search: O(log n) via HNSW
 * - Range queries: O(log n) via B-tree indexes
 * - Graph traversal: O(1) adjacency list lookups
 * - Fusion: O(k log k) where k = result count
 */
import { HNSWIndex } from '../hnsw/hnswIndex.js';
import { MetadataIndexManager } from '../utils/metadataIndex.js';
import { Vector } from '../coreTypes.js';
export interface TripleQuery {
    similar?: string;
    like?: string;
    vector?: Vector;
    where?: Record<string, any>;
    connected?: {
        from?: string;
        to?: string;
        type?: string;
        direction?: 'in' | 'out' | 'both';
        depth?: number;
    };
    limit?: number;
}
export interface TripleOptions {
    fusion?: {
        strategy?: 'rrf' | 'weighted' | 'adaptive';
        weights?: Record<string, number>;
        k?: number;
    };
}
interface GraphAdjacencyIndex {
    getNeighbors(id: string, direction?: 'in' | 'out' | 'both'): Promise<string[]>;
    size(): number;
}
/**
 * Performance metrics for monitoring and assertions
 */
export declare class PerformanceMetrics {
    private operations;
    private slowQueries;
    private totalItems;
    recordOperation(type: string, elapsed: number, itemCount?: number): void;
    private getExpectedTime;
    setTotalItems(count: number): void;
    getReport(): PerformanceReport;
    reset(): void;
}
/**
 * The main Triple Intelligence System
 */
export declare class TripleIntelligenceSystem {
    private metadataIndex;
    private hnswIndex;
    private graphIndex;
    private metrics;
    private planner;
    private embedder;
    private storage;
    constructor(metadataIndex: MetadataIndexManager, hnswIndex: HNSWIndex, graphIndex: GraphAdjacencyIndex, embedder: (text: string) => Promise<Vector>, storage: any);
    /**
     * Main find method - executes Triple Intelligence queries
     */
    find(query: TripleQuery, options?: TripleOptions): Promise<TripleResult[]>;
    /**
     * Vector search using HNSW for O(log n) performance
     */
    private vectorSearch;
    /**
     * Field filtering using MetadataIndex for O(log n) performance
     */
    private fieldFilter;
    /**
     * Graph traversal using adjacency lists for O(1) lookups
     */
    private graphTraversal;
    /**
     * Execute the query plan
     */
    private executeQueryPlan;
    /**
     * Fuse results using Reciprocal Rank Fusion (RRF)
     */
    private fuseResults;
    /**
     * Validate query parameters
     */
    private validateQuery;
    /**
     * Verify required indexes are available
     */
    private verifyIndexes;
    /**
     * Assert performance guarantees
     */
    private assertPerformance;
    /**
     * Check if where clause has range operators
     */
    private hasRangeOperators;
    /**
     * Update item count for metrics
     */
    private updateItemCount;
    /**
     * Get total item count across all indexes
     */
    private getTotalItems;
    /**
     * Get performance metrics
     */
    getMetrics(): PerformanceMetrics;
    /**
     * Reset performance metrics
     */
    resetMetrics(): void;
}
interface QueryLog {
    type: string;
    elapsed: number;
    expectedTime: number;
    timestamp: number;
    itemCount: number;
}
interface PerformanceReport {
    operations: Record<string, {
        avgTime: number;
        maxTime: number;
        minTime: number;
        violations: number;
        violationRate: number;
        totalCalls: number;
    }>;
    violations: Array<{
        type: string;
        count: number;
        rate: number;
    }>;
    slowQueries: QueryLog[];
}
interface TripleResult {
    id: string;
    score: number;
    entity: any;
    metadata: Record<string, any>;
    vectorScore?: number;
    fieldScore?: number;
    graphScore?: number;
    fusionScore?: number;
    depth?: number;
}
export {};
