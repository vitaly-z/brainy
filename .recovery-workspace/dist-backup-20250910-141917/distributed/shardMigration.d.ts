/**
 * Shard Migration System for Brainy 3.0
 *
 * Handles zero-downtime migration of data between nodes
 * Uses streaming for efficient transfer of large datasets
 */
import { EventEmitter } from 'events';
import type { StorageAdapter } from '../coreTypes.js';
import type { ShardManager } from './shardManager.js';
import type { HTTPTransport } from './httpTransport.js';
import type { DistributedCoordinator } from './coordinator.js';
export interface MigrationTask {
    id: string;
    shardId: string;
    sourceNode: string;
    targetNode: string;
    status: 'pending' | 'transferring' | 'validating' | 'switching' | 'completed' | 'failed';
    progress: number;
    itemsTransferred: number;
    totalItems: number;
    startTime: number;
    endTime?: number;
    error?: string;
}
export interface MigrationOptions {
    batchSize?: number;
    validateData?: boolean;
    maxRetries?: number;
    timeout?: number;
}
export declare class ShardMigrationManager extends EventEmitter {
    private storage;
    private shardManager;
    private transport;
    private coordinator;
    private nodeId;
    private activeMigrations;
    private migrationQueue;
    private maxConcurrentMigrations;
    constructor(nodeId: string, storage: StorageAdapter, shardManager: ShardManager, transport: HTTPTransport, coordinator: DistributedCoordinator);
    /**
     * Initiate migration of a shard to a new node
     */
    migrateShard(shardId: string, targetNode: string, options?: MigrationOptions): Promise<MigrationTask>;
    /**
     * Process migration queue
     */
    private processMigrationQueue;
    /**
     * Execute a single migration task
     */
    private executeMigration;
    /**
     * Transfer data from source to target node
     */
    private transferData;
    /**
     * Get items from a shard
     */
    private getShardItems;
    /**
     * Get count of items in a shard
     */
    private getShardItemCount;
    /**
     * Validate transferred data
     */
    private validateData;
    /**
     * Switch shard ownership atomically
     */
    private switchOwnership;
    /**
     * Wait for consensus on migration
     */
    private waitForConsensus;
    /**
     * Cleanup local shard data after migration
     */
    private cleanupShardData;
    /**
     * Handle incoming migration batch (when we're the target)
     */
    receiveMigrationBatch(data: {
        migrationId: string;
        shardId: string;
        items: any[];
        offset: number;
        total: number;
    }): Promise<void>;
    /**
     * Validate received migration data
     */
    validateMigration(data: {
        migrationId: string;
        shardId: string;
        expectedCount: number;
    }): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Get status of all active migrations
     */
    getActiveMigrations(): MigrationTask[];
    /**
     * Cancel a migration
     */
    cancelMigration(migrationId: string): Promise<void>;
}
