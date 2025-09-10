/**
 * Shard Migration System for Brainy 3.0
 *
 * Handles zero-downtime migration of data between nodes
 * Uses streaming for efficient transfer of large datasets
 */
import { EventEmitter } from 'events';
export class ShardMigrationManager extends EventEmitter {
    constructor(nodeId, storage, shardManager, transport, coordinator) {
        super();
        this.activeMigrations = new Map();
        this.migrationQueue = [];
        this.maxConcurrentMigrations = 2;
        this.nodeId = nodeId;
        this.storage = storage;
        this.shardManager = shardManager;
        this.transport = transport;
        this.coordinator = coordinator;
    }
    /**
     * Initiate migration of a shard to a new node
     */
    async migrateShard(shardId, targetNode, options = {}) {
        const task = {
            id: `migration-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            shardId,
            sourceNode: this.nodeId,
            targetNode,
            status: 'pending',
            progress: 0,
            itemsTransferred: 0,
            totalItems: 0,
            startTime: Date.now()
        };
        // Add to queue
        this.migrationQueue.push(task);
        this.processMigrationQueue();
        return task;
    }
    /**
     * Process migration queue
     */
    async processMigrationQueue() {
        while (this.migrationQueue.length > 0 &&
            this.activeMigrations.size < this.maxConcurrentMigrations) {
            const task = this.migrationQueue.shift();
            this.activeMigrations.set(task.id, task);
            // Execute migration in background
            this.executeMigration(task).catch(error => {
                console.error(`Migration ${task.id} failed:`, error);
                task.status = 'failed';
                task.error = error.message;
                this.emit('migrationFailed', task);
            });
        }
    }
    /**
     * Execute a single migration task
     */
    async executeMigration(task) {
        try {
            this.emit('migrationStarted', task);
            // Phase 1: Start transferring data
            task.status = 'transferring';
            await this.transferData(task);
            // Phase 2: Validate transferred data
            task.status = 'validating';
            await this.validateData(task);
            // Phase 3: Switch ownership atomically
            task.status = 'switching';
            await this.switchOwnership(task);
            // Phase 4: Cleanup source
            task.status = 'completed';
            task.endTime = Date.now();
            task.progress = 100;
            this.activeMigrations.delete(task.id);
            this.emit('migrationCompleted', task);
            // Process next in queue
            this.processMigrationQueue();
        }
        catch (error) {
            task.status = 'failed';
            task.error = error.message;
            this.activeMigrations.delete(task.id);
            throw error;
        }
    }
    /**
     * Transfer data from source to target node
     */
    async transferData(task) {
        const batchSize = 1000;
        let offset = 0;
        // Get total count
        const totalItems = await this.getShardItemCount(task.shardId);
        task.totalItems = totalItems;
        while (offset < totalItems) {
            // Get batch of items
            const items = await this.getShardItems(task.shardId, offset, batchSize);
            if (items.length === 0)
                break;
            // Send batch to target node
            await this.transport.call(task.targetNode, 'receiveMigrationBatch', {
                migrationId: task.id,
                shardId: task.shardId,
                items,
                offset,
                total: totalItems
            });
            offset += items.length;
            task.itemsTransferred = offset;
            task.progress = Math.floor((offset / totalItems) * 80); // 80% for transfer
            this.emit('migrationProgress', task);
        }
    }
    /**
     * Get items from a shard
     */
    async getShardItems(shardId, offset, limit) {
        // Get all noun IDs for this shard
        const nounKey = `shard:${shardId}:nouns`;
        const verbKey = `shard:${shardId}:verbs`;
        const items = [];
        try {
            // Get nouns
            const nouns = await this.storage.getNounsByNounType('*');
            const shardNouns = nouns.filter(n => {
                const assignment = this.shardManager.getShardForKey(n.id);
                return assignment?.shardId === shardId;
            }).slice(offset, offset + limit);
            items.push(...shardNouns.map(n => ({ type: 'noun', data: n })));
            // Get verbs if we have room
            if (items.length < limit) {
                const verbs = await this.storage.getVerbsByType('*');
                const shardVerbs = verbs.filter(v => {
                    const assignment = this.shardManager.getShardForKey(v.id);
                    return assignment?.shardId === shardId;
                }).slice(0, limit - items.length);
                items.push(...shardVerbs.map(v => ({ type: 'verb', data: v })));
            }
        }
        catch (error) {
            console.error(`Failed to get shard items for ${shardId}:`, error);
        }
        return items;
    }
    /**
     * Get count of items in a shard
     */
    async getShardItemCount(shardId) {
        // For now, estimate based on total items / shard count
        // In production, maintain accurate per-shard counts
        const status = await this.storage.getStorageStatus();
        const totalShards = this.shardManager.getTotalShards();
        return Math.ceil(status.used / totalShards);
    }
    /**
     * Validate transferred data
     */
    async validateData(task) {
        // Request validation from target node
        const response = await this.transport.call(task.targetNode, 'validateMigration', {
            migrationId: task.id,
            shardId: task.shardId,
            expectedCount: task.totalItems
        });
        if (!response.valid) {
            throw new Error(`Validation failed: ${response.error}`);
        }
        task.progress = 90; // 90% after validation
        this.emit('migrationProgress', task);
    }
    /**
     * Switch shard ownership atomically
     */
    async switchOwnership(task) {
        // Coordinate with all nodes to update shard assignment
        await this.coordinator.proposeMigration({
            shardId: task.shardId,
            fromNode: task.sourceNode,
            toNode: task.targetNode,
            migrationId: task.id
        });
        // Wait for consensus
        await this.waitForConsensus(task.id);
        // Update local shard manager
        this.shardManager.updateShardAssignment(task.shardId, task.targetNode);
        task.progress = 95; // 95% after ownership switch
        this.emit('migrationProgress', task);
        // Cleanup local data
        await this.cleanupShardData(task.shardId);
    }
    /**
     * Wait for consensus on migration
     */
    async waitForConsensus(migrationId) {
        const maxWait = 30000; // 30 seconds
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
            const status = await this.coordinator.getMigrationStatus(migrationId);
            if (status === 'committed') {
                return;
            }
            else if (status === 'rejected') {
                throw new Error('Migration rejected by cluster');
            }
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error('Consensus timeout');
    }
    /**
     * Cleanup local shard data after migration
     */
    async cleanupShardData(shardId) {
        // Mark shard data for deletion
        // Don't delete immediately in case of rollback
        const cleanupKey = `cleanup:${shardId}:${Date.now()}`;
        await this.storage.saveMetadata(cleanupKey, {
            shardId,
            scheduledFor: Date.now() + 3600000 // Delete after 1 hour
        });
    }
    /**
     * Handle incoming migration batch (when we're the target)
     */
    async receiveMigrationBatch(data) {
        // Store items
        for (const item of data.items) {
            if (item.type === 'noun') {
                await this.storage.saveNoun(item.data);
            }
            else if (item.type === 'verb') {
                await this.storage.saveVerb(item.data);
            }
        }
        // Track progress
        const progress = {
            migrationId: data.migrationId,
            shardId: data.shardId,
            received: data.offset + data.items.length,
            total: data.total
        };
        await this.storage.saveMetadata(`migration:${data.migrationId}:progress`, progress);
    }
    /**
     * Validate received migration data
     */
    async validateMigration(data) {
        // Check if we received all expected items
        const progressKey = `migration:${data.migrationId}:progress`;
        const progress = await this.storage.getMetadata(progressKey);
        if (!progress) {
            return { valid: false, error: 'No migration progress found' };
        }
        if (progress.received !== data.expectedCount) {
            return {
                valid: false,
                error: `Expected ${data.expectedCount} items, received ${progress.received}`
            };
        }
        // Verify data integrity (could add checksums)
        return { valid: true };
    }
    /**
     * Get status of all active migrations
     */
    getActiveMigrations() {
        return Array.from(this.activeMigrations.values());
    }
    /**
     * Cancel a migration
     */
    async cancelMigration(migrationId) {
        const task = this.activeMigrations.get(migrationId);
        if (!task) {
            throw new Error(`Migration ${migrationId} not found`);
        }
        task.status = 'failed';
        task.error = 'Cancelled by user';
        this.activeMigrations.delete(migrationId);
        // Notify target node
        await this.transport.call(task.targetNode, 'cancelMigration', {
            migrationId
        });
        this.emit('migrationCancelled', task);
    }
}
//# sourceMappingURL=shardMigration.js.map