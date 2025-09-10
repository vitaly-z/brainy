/**
 * Storage-based Discovery for Zero-Config Distributed Brainy
 * Uses shared storage (S3/GCS/R2) as coordination point
 * REAL PRODUCTION CODE - No mocks, no stubs!
 */
import { EventEmitter } from 'events';
import { StorageAdapter } from '../coreTypes.js';
export interface NodeInfo {
    id: string;
    endpoint: string;
    hostname: string;
    started: number;
    lastSeen: number;
    role: 'primary' | 'replica' | 'candidate';
    shards: string[];
    capacity: {
        cpu: number;
        memory: number;
        storage: number;
    };
    stats: {
        nouns: number;
        verbs: number;
        queries: number;
        latency: number;
    };
}
export interface ClusterConfig {
    version: number;
    created: number;
    updated: number;
    leader: string | null;
    nodes: Record<string, NodeInfo>;
    shards: {
        count: number;
        assignments: Record<string, string[]>;
    };
    settings: {
        replicationFactor: number;
        shardCount: number;
        autoRebalance: boolean;
        minNodes: number;
        maxNodesPerShard: number;
    };
}
export declare class StorageDiscovery extends EventEmitter {
    private nodeId;
    private storage;
    private nodeInfo;
    private clusterConfig;
    private heartbeatInterval;
    private discoveryInterval;
    private endpoint;
    private isRunning;
    private readonly HEARTBEAT_INTERVAL;
    private readonly DISCOVERY_INTERVAL;
    private readonly NODE_TIMEOUT;
    private readonly CLUSTER_PATH;
    constructor(storage: StorageAdapter, nodeId?: string);
    /**
     * Start discovery and registration
     */
    start(httpPort: number): Promise<ClusterConfig>;
    /**
     * Stop discovery and unregister
     */
    stop(): Promise<void>;
    /**
     * Initialize a new cluster (we're the first node)
     */
    private initializeCluster;
    /**
     * Join an existing cluster
     */
    private joinCluster;
    /**
     * Leave cluster cleanly
     */
    private leaveCluster;
    /**
     * Register node in storage
     */
    private registerNode;
    /**
     * Heartbeat to keep node alive
     */
    private startHeartbeat;
    /**
     * Discover other nodes and monitor health
     */
    private startDiscovery;
    /**
     * Discover nodes from storage
     */
    private discoverNodes;
    /**
     * Load node registry from storage
     */
    private loadNodeRegistry;
    /**
     * Update node registry in storage
     */
    private updateNodeRegistry;
    /**
     * Check health of known nodes
     */
    private checkNodeHealth;
    /**
     * Load cluster configuration from storage
     */
    private loadClusterConfig;
    /**
     * Save cluster configuration to storage
     */
    private saveClusterConfig;
    /**
     * Trigger leader election (simplified - not full Raft)
     */
    private triggerLeaderElection;
    /**
     * Request shard assignment for this node
     */
    private requestShardAssignment;
    /**
     * Check if rebalancing is needed
     */
    private shouldRebalance;
    /**
     * Trigger shard rebalancing
     */
    private triggerRebalance;
    /**
     * Redistribute shards among active nodes
     */
    private redistributeShards;
    /**
     * Detect our public endpoint
     */
    private detectEndpoint;
    /**
     * Generate unique node ID
     */
    private generateNodeId;
    /**
     * Get current cluster configuration
     */
    getClusterConfig(): ClusterConfig | null;
    /**
     * Get active nodes
     */
    getActiveNodes(): NodeInfo[];
    /**
     * Get shards assigned to this node
     */
    getMyShards(): string[];
    /**
     * Update node statistics
     */
    updateStats(stats: Partial<NodeInfo['stats']>): void;
}
