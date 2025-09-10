/**
 * Shard Manager for Horizontal Scaling
 * Implements consistent hashing for data distribution across shards
 */
import { EventEmitter } from 'events';
export interface ShardConfig {
    shardCount?: number;
    replicationFactor?: number;
    virtualNodes?: number;
    autoRebalance?: boolean;
}
export interface Shard {
    id: string;
    nodeId: string;
    virtualNodes: string[];
    itemCount: number;
    sizeBytes: number;
    status: 'active' | 'rebalancing' | 'offline';
}
export interface ShardAssignment {
    shardId: string;
    nodeId: string;
    replicas: string[];
}
/**
 * Shard Manager for distributing data across multiple nodes
 */
export declare class ShardManager extends EventEmitter {
    private hashRing;
    private shards;
    private nodeToShards;
    private shardCount;
    private replicationFactor;
    private autoRebalance;
    constructor(config?: ShardConfig);
    /**
     * Initialize shard configuration
     */
    private initializeShards;
    /**
     * Add a node to the cluster
     */
    addNode(nodeId: string): void;
    /**
     * Remove a node from the cluster
     */
    removeNode(nodeId: string): void;
    /**
     * Get shard assignment for a key
     */
    getShardForKey(key: string): ShardAssignment | null;
    /**
     * Get nodes responsible for a shard
     */
    getNodesForShard(shardId: string): string[];
    /**
     * Get total number of shards
     */
    getTotalShards(): number;
    /**
     * Update shard assignment to a new node
     */
    updateShardAssignment(shardId: string, newNodeId: string): void;
    /**
     * Get shard ID for a key
     */
    private getShardId;
    /**
     * Rebalance shards across nodes
     */
    private rebalanceShards;
    /**
     * Get shard assignment for all shards
     */
    getShardAssignments(): ShardAssignment[];
    /**
     * Get shard statistics
     */
    getShardStats(): {
        totalShards: number;
        activeShards: number;
        rebalancingShards: number;
        offlineShards: number;
        averageItemsPerShard: number;
    };
    /**
     * Update shard metrics
     */
    updateShardMetrics(shardId: string, itemCount: number, sizeBytes: number): void;
    /**
     * Get replication nodes for a shard
     */
    getReplicationNodes(shardId: string): string[];
    /**
     * Check if rebalancing is needed
     */
    needsRebalancing(): boolean;
    /**
     * Get cluster health
     */
    getHealth(): {
        healthy: boolean;
        nodes: number;
        shards: {
            total: number;
            active: number;
            inactive: number;
        };
    };
}
/**
 * Create a shard manager instance
 */
export declare function createShardManager(config?: ShardConfig): ShardManager;
