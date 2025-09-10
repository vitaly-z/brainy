/**
 * Distributed Query Planner for Brainy 3.0
 *
 * Intelligently plans and executes distributed queries across shards
 * Optimizes for data locality, parallelism, and network efficiency
 */
import type { StorageAdapter } from '../coreTypes.js';
import type { DistributedCoordinator } from './coordinator.js';
import type { ShardManager } from './shardManager.js';
import type { HTTPTransport } from './httpTransport.js';
import type { TripleIntelligenceEngine } from '../triple/TripleIntelligence.js';
export interface QueryPlan {
    /**
     * Shards that need to be queried
     */
    shards: string[];
    /**
     * Nodes responsible for each shard
     */
    nodeAssignments: Map<string, string[]>;
    /**
     * Whether query can be parallelized
     */
    parallel: boolean;
    /**
     * Estimated cost (0-1000)
     */
    cost: number;
    /**
     * Query strategy
     */
    strategy: 'broadcast' | 'targeted' | 'scatter-gather' | 'local-only';
}
export interface DistributedQueryResult {
    results: any[];
    totalCount: number;
    executionTime: number;
    nodeStats: Map<string, {
        resultsReturned: number;
        executionTime: number;
        errors?: string[];
    }>;
}
export declare class DistributedQueryPlanner {
    private nodeId;
    private coordinator;
    private shardManager;
    private transport;
    private tripleEngine?;
    private storage;
    constructor(nodeId: string, coordinator: DistributedCoordinator, shardManager: ShardManager, transport: HTTPTransport, storage: StorageAdapter, tripleEngine?: TripleIntelligenceEngine);
    /**
     * Plan a distributed query
     */
    planQuery(query: any): Promise<QueryPlan>;
    /**
     * Execute a distributed query based on plan
     */
    executeQuery(query: any, plan: QueryPlan): Promise<DistributedQueryResult>;
    /**
     * Execute query on local shards
     */
    private executeLocalQuery;
    /**
     * Execute query on remote node
     */
    private executeRemoteQuery;
    /**
     * Get data from a specific shard
     */
    private getShardData;
    /**
     * Filter data based on query criteria
     */
    private filterData;
    /**
     * Check if item matches filter
     */
    private matchesFilter;
    /**
     * Merge results from multiple nodes using Triple Intelligence
     */
    private mergeResults;
    /**
     * Simple deduplication of results
     */
    private deduplicateResults;
    /**
     * Get unique key for result
     */
    private getResultKey;
    /**
     * Determine query type
     */
    private getQueryType;
    /**
     * Determine which shards are affected by query
     */
    private determineAffectedShards;
    /**
     * Optimize query plan based on statistics
     */
    optimizePlan(plan: QueryPlan): Promise<QueryPlan>;
}
