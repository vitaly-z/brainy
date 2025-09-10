/**
 * Read/Write Separation for Distributed Scaling
 * Implements primary-replica architecture for scalable reads
 */
import { EventEmitter } from 'events';
/**
 * Read/Write Separation Manager
 */
export class ReadWriteSeparation extends EventEmitter {
    constructor(config, coordinator, _shardManager, cacheSync) {
        super();
        this.replicas = new Map();
        this.isRunning = false;
        this.config = config;
        this.nodeId = config.nodeId;
        this.role = config.role === 'auto' ? this.determineRole() : (config.role || 'replica');
        this.coordinator = coordinator;
        this.cacheSync = cacheSync;
        this.replicationLog = {
            operations: [],
            lastSequence: 0,
            primaryVersion: 0
        };
        // Setup connections based on role
        this.setupConnections();
    }
    /**
     * Start read/write separation
     */
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        // Start components
        await this.coordinator.start();
        // Setup role-specific behavior
        if (this.role === 'primary') {
            this.startAsPrimary();
        }
        else {
            this.startAsReplica();
        }
        this.emit('started', { nodeId: this.nodeId, role: this.role });
    }
    /**
     * Stop read/write separation
     */
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = undefined;
        }
        await this.coordinator.stop();
        this.emit('stopped', { nodeId: this.nodeId });
    }
    /**
     * Execute a write operation (primary only)
     */
    async write(operation) {
        if (this.role !== 'primary') {
            // Forward to primary
            if (this.primaryConnection) {
                return this.primaryConnection.forwardWrite(operation);
            }
            throw new Error('Cannot write: not connected to primary');
        }
        // Generate operation metadata
        const writeOp = {
            id: this.generateOperationId(),
            ...operation,
            timestamp: Date.now(),
            version: ++this.replicationLog.primaryVersion
        };
        // Add to replication log
        this.replicationLog.operations.push(writeOp);
        this.replicationLog.lastSequence++;
        // Propagate to replicas
        this.propagateToReplicas(writeOp);
        // Update cache
        if (operation.type !== 'delete') {
            this.cacheSync.set(writeOp.id, operation.data);
        }
        else {
            this.cacheSync.delete(writeOp.id);
        }
        this.emit('write', writeOp);
        return writeOp.id;
    }
    /**
     * Execute a read operation
     */
    async read(key, options) {
        const consistency = options?.consistency || this.config.consistencyLevel || 'eventual';
        if (consistency === 'strong' && this.role === 'replica') {
            // For strong consistency, read from primary
            if (this.primaryConnection) {
                return this.primaryConnection.read(key);
            }
            throw new Error('Cannot guarantee strong consistency: not connected to primary');
        }
        // Check cache first
        const cached = this.cacheSync.get(key);
        if (cached !== undefined) {
            return cached;
        }
        // Read from appropriate source based on preference
        if (this.config.readPreference === 'primary' && this.primaryConnection) {
            return this.primaryConnection.read(key);
        }
        // Read locally (replica or primary)
        return this.readLocal(key);
    }
    /**
     * Get replication lag (replica only)
     */
    getReplicationLag() {
        if (this.role === 'primary')
            return 0;
        if (this.primaryConnection) {
            return Date.now() - this.primaryConnection.lastSync;
        }
        return -1; // Unknown
    }
    /**
     * Setup connections based on role
     */
    setupConnections() {
        if (this.role === 'primary') {
            // Setup replica connections
            if (this.config.replicaUrls) {
                for (const url of this.config.replicaUrls) {
                    const replica = new ReplicaConnection(url);
                    this.replicas.set(url, replica);
                }
            }
        }
        else {
            // Setup primary connection
            if (this.config.primaryUrl) {
                this.primaryConnection = new PrimaryConnection(this.config.primaryUrl);
            }
        }
    }
    /**
     * Start as primary node
     */
    startAsPrimary() {
        // Start accepting writes
        this.emit('roleEstablished', { role: 'primary' });
        // Start replication timer
        this.syncTimer = setInterval(() => {
            this.syncReplicas();
        }, this.config.syncInterval || 1000);
    }
    /**
     * Start as replica node
     */
    startAsReplica() {
        // Start syncing from primary
        this.emit('roleEstablished', { role: 'replica' });
        // Start sync timer
        this.syncTimer = setInterval(() => {
            this.syncFromPrimary();
        }, this.config.syncInterval || 1000);
    }
    /**
     * Sync replicas (primary only)
     */
    async syncReplicas() {
        const batch = this.replicationLog.operations.slice(-100); // Last 100 ops
        for (const [url, replica] of this.replicas) {
            try {
                await replica.sync(batch, this.replicationLog.primaryVersion);
            }
            catch (error) {
                this.emit('replicaSyncError', { url, error });
            }
        }
    }
    /**
     * Sync from primary (replica only)
     */
    async syncFromPrimary() {
        if (!this.primaryConnection)
            return;
        try {
            const updates = await this.primaryConnection.getUpdates(this.replicationLog.lastSequence);
            // Apply updates
            for (const op of updates) {
                await this.applyOperation(op);
            }
            this.emit('synced', { operations: updates.length });
        }
        catch (error) {
            this.emit('primarySyncError', { error });
        }
    }
    /**
     * Apply a replicated operation
     */
    async applyOperation(op) {
        // Update local state
        this.replicationLog.operations.push(op);
        this.replicationLog.lastSequence = Math.max(this.replicationLog.lastSequence, op.version);
        // Update cache
        switch (op.type) {
            case 'add':
            case 'update':
                this.cacheSync.set(op.id, op.data);
                break;
            case 'delete':
                this.cacheSync.delete(op.id);
                break;
        }
        this.emit('operationApplied', op);
    }
    /**
     * Propagate operation to replicas
     */
    propagateToReplicas(op) {
        for (const replica of this.replicas.values()) {
            replica.sendOperation(op).catch(error => {
                this.emit('replicationError', { replica, error });
            });
        }
    }
    /**
     * Determine role automatically
     */
    determineRole() {
        // Use coordinator's leader election
        return this.coordinator.isLeader() ? 'primary' : 'replica';
    }
    /**
     * Read from local storage
     */
    async readLocal(key) {
        // This would connect to actual storage
        // For now, return from cache or undefined
        return this.cacheSync.get(key);
    }
    /**
     * Generate unique operation ID
     */
    generateOperationId() {
        return `${this.nodeId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    /**
     * Get replication statistics
     */
    getStats() {
        return {
            role: this.role,
            replicas: this.replicas.size,
            replicationLag: this.getReplicationLag(),
            operationsInLog: this.replicationLog.operations.length,
            primaryVersion: this.replicationLog.primaryVersion
        };
    }
    /**
     * Check if node can accept writes
     */
    canWrite() {
        return this.role === 'primary';
    }
    /**
     * Check if node can serve reads
     */
    canRead() {
        if (this.config.consistencyLevel === 'strong') {
            return this.role === 'primary' || this.primaryConnection !== undefined;
        }
        return true;
    }
    /**
     * Set whether this node is primary (for leader election integration)
     */
    setPrimary(isPrimary) {
        const newRole = isPrimary ? 'primary' : 'replica';
        if (this.role !== newRole) {
            this.role = newRole;
            this.emit('roleChange', { oldRole: this.role, newRole });
            if (isPrimary) {
                // Became primary - stop syncing from old primary
                this.primaryConnection = undefined;
            }
            else {
                // Became replica - connect to new primary if URL is known
                if (this.config.primaryUrl) {
                    this.primaryConnection = new PrimaryConnection(this.config.primaryUrl);
                }
            }
        }
    }
}
/**
 * Connection to a replica (used by primary)
 */
class ReplicaConnection {
    constructor(url) {
        this.url = url;
        // Store URL for connection
        void this.url;
    }
    async sync(_operations, _version) {
        // In real implementation, this would use HTTP/gRPC to this.url
        // For now, simulate network call
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    async sendOperation(_op) {
        // Send single operation to replica at this.url
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}
/**
 * Connection to primary (used by replicas)
 */
class PrimaryConnection {
    constructor(url) {
        this.url = url;
        this.lastSync = Date.now();
        // Store URL for connection
        void this.url;
    }
    async getUpdates(_fromSequence) {
        // In real implementation, fetch from primary at this.url
        this.lastSync = Date.now();
        return [];
    }
    async forwardWrite(_operation) {
        // Forward write to primary at this.url
        await new Promise(resolve => setTimeout(resolve, 20));
        return `forwarded-${Date.now()}`;
    }
    async read(_key) {
        // Read from primary at this.url for strong consistency
        await new Promise(resolve => setTimeout(resolve, 10));
        return undefined;
    }
}
/**
 * Create read/write separation manager
 */
export function createReadWriteSeparation(config, coordinator, shardManager, cacheSync) {
    return new ReadWriteSeparation(config, coordinator, shardManager, cacheSync);
}
//# sourceMappingURL=readWriteSeparation.js.map