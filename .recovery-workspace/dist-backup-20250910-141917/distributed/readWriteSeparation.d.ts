/**
 * Read/Write Separation for Distributed Scaling
 * Implements primary-replica architecture for scalable reads
 */
import { EventEmitter } from 'events';
import { DistributedCoordinator } from './coordinator.js';
import { ShardManager } from './shardManager.js';
import { CacheSync } from './cacheSync.js';
export interface ReplicationConfig {
    nodeId: string;
    role?: 'primary' | 'replica' | 'auto';
    primaryUrl?: string;
    replicaUrls?: string[];
    syncInterval?: number;
    readPreference?: 'primary' | 'replica' | 'nearest';
    consistencyLevel?: 'eventual' | 'strong' | 'bounded';
    maxStaleness?: number;
}
export interface WriteOperation {
    id: string;
    type: 'add' | 'update' | 'delete';
    data: any;
    timestamp: number;
    version: number;
}
export interface ReplicationLog {
    operations: WriteOperation[];
    lastSequence: number;
    primaryVersion: number;
}
/**
 * Read/Write Separation Manager
 */
export declare class ReadWriteSeparation extends EventEmitter {
    private nodeId;
    private role;
    private coordinator;
    private cacheSync;
    private replicationLog;
    private replicas;
    private primaryConnection?;
    private config;
    private syncTimer?;
    private isRunning;
    constructor(config: ReplicationConfig, coordinator: DistributedCoordinator, _shardManager: ShardManager, cacheSync: CacheSync);
    /**
     * Start read/write separation
     */
    start(): Promise<void>;
    /**
     * Stop read/write separation
     */
    stop(): Promise<void>;
    /**
     * Execute a write operation (primary only)
     */
    write(operation: Omit<WriteOperation, 'id' | 'timestamp' | 'version'>): Promise<string>;
    /**
     * Execute a read operation
     */
    read(key: string, options?: {
        consistency?: 'eventual' | 'strong';
    }): Promise<any>;
    /**
     * Get replication lag (replica only)
     */
    getReplicationLag(): number;
    /**
     * Setup connections based on role
     */
    private setupConnections;
    /**
     * Start as primary node
     */
    private startAsPrimary;
    /**
     * Start as replica node
     */
    private startAsReplica;
    /**
     * Sync replicas (primary only)
     */
    private syncReplicas;
    /**
     * Sync from primary (replica only)
     */
    private syncFromPrimary;
    /**
     * Apply a replicated operation
     */
    private applyOperation;
    /**
     * Propagate operation to replicas
     */
    private propagateToReplicas;
    /**
     * Determine role automatically
     */
    private determineRole;
    /**
     * Read from local storage
     */
    private readLocal;
    /**
     * Generate unique operation ID
     */
    private generateOperationId;
    /**
     * Get replication statistics
     */
    getStats(): {
        role: string;
        replicas: number;
        replicationLag: number;
        operationsInLog: number;
        primaryVersion: number;
    };
    /**
     * Check if node can accept writes
     */
    canWrite(): boolean;
    /**
     * Check if node can serve reads
     */
    canRead(): boolean;
    /**
     * Set whether this node is primary (for leader election integration)
     */
    setPrimary(isPrimary: boolean): void;
}
/**
 * Create read/write separation manager
 */
export declare function createReadWriteSeparation(config: ReplicationConfig, coordinator: DistributedCoordinator, shardManager: ShardManager, cacheSync: CacheSync): ReadWriteSeparation;
