/**
 * Shard Manager for Horizontal Scaling
 * Implements consistent hashing for data distribution across shards
 */
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
/**
 * Consistent Hash Ring for shard distribution
 */
class ConsistentHashRing {
    constructor(virtualNodes = 150) {
        this.ring = new Map();
        this.sortedKeys = [];
        this.virtualNodes = virtualNodes;
    }
    /**
     * Add a node to the hash ring
     */
    addNode(nodeId) {
        for (let i = 0; i < this.virtualNodes; i++) {
            const virtualNodeId = `${nodeId}:${i}`;
            const hash = this.hash(virtualNodeId);
            this.ring.set(hash, nodeId);
        }
        this.updateSortedKeys();
    }
    /**
     * Remove a node from the hash ring
     */
    removeNode(nodeId) {
        const keysToRemove = [];
        for (const [hash, node] of this.ring) {
            if (node === nodeId) {
                keysToRemove.push(hash);
            }
        }
        for (const key of keysToRemove) {
            this.ring.delete(key);
        }
        this.updateSortedKeys();
    }
    /**
     * Get the node responsible for a given key
     */
    getNode(key) {
        if (this.ring.size === 0)
            return null;
        const hash = this.hash(key);
        // Find the first node with hash >= key hash
        for (const nodeHash of this.sortedKeys) {
            if (nodeHash >= hash) {
                return this.ring.get(nodeHash) || null;
            }
        }
        // Wrap around to the first node
        return this.ring.get(this.sortedKeys[0]) || null;
    }
    /**
     * Get N nodes for replication
     */
    getNodes(key, count) {
        if (this.ring.size === 0)
            return [];
        const nodes = new Set();
        const hash = this.hash(key);
        // Start from the primary node position
        let startIdx = 0;
        for (let i = 0; i < this.sortedKeys.length; i++) {
            if (this.sortedKeys[i] >= hash) {
                startIdx = i;
                break;
            }
        }
        // Collect unique nodes
        let idx = startIdx;
        while (nodes.size < count && nodes.size < this.getUniqueNodeCount()) {
            const nodeHash = this.sortedKeys[idx % this.sortedKeys.length];
            const node = this.ring.get(nodeHash);
            if (node) {
                nodes.add(node);
            }
            idx++;
        }
        return Array.from(nodes);
    }
    /**
     * Get unique node count
     */
    getUniqueNodeCount() {
        return new Set(this.ring.values()).size;
    }
    /**
     * Update sorted keys for efficient lookup
     */
    updateSortedKeys() {
        this.sortedKeys = Array.from(this.ring.keys()).sort((a, b) => a - b);
    }
    /**
     * Hash function for consistent hashing
     */
    hash(key) {
        const hash = createHash('md5').update(key).digest();
        return hash.readUInt32BE(0);
    }
    /**
     * Get all nodes in the ring
     */
    getAllNodes() {
        return Array.from(new Set(this.ring.values()));
    }
}
/**
 * Shard Manager for distributing data across multiple nodes
 */
export class ShardManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.shards = new Map();
        this.nodeToShards = new Map();
        this.shardCount = config.shardCount || 64;
        this.replicationFactor = config.replicationFactor || 3;
        this.autoRebalance = config.autoRebalance ?? true;
        this.hashRing = new ConsistentHashRing(config.virtualNodes || 150);
        // Initialize shards
        this.initializeShards();
    }
    /**
     * Initialize shard configuration
     */
    initializeShards() {
        for (let i = 0; i < this.shardCount; i++) {
            const shardId = `shard-${i.toString().padStart(3, '0')}`;
            this.shards.set(shardId, {
                id: shardId,
                nodeId: '',
                virtualNodes: [],
                itemCount: 0,
                sizeBytes: 0,
                status: 'offline'
            });
        }
    }
    /**
     * Add a node to the cluster
     */
    addNode(nodeId) {
        this.hashRing.addNode(nodeId);
        this.nodeToShards.set(nodeId, new Set());
        // Assign shards to the new node
        this.rebalanceShards();
        this.emit('nodeAdded', { nodeId });
    }
    /**
     * Remove a node from the cluster
     */
    removeNode(nodeId) {
        const affectedShards = this.nodeToShards.get(nodeId) || new Set();
        this.hashRing.removeNode(nodeId);
        this.nodeToShards.delete(nodeId);
        // Reassign affected shards
        for (const shardId of affectedShards) {
            const shard = this.shards.get(shardId);
            if (shard) {
                shard.status = 'rebalancing';
            }
        }
        this.rebalanceShards();
        this.emit('nodeRemoved', { nodeId, affectedShards: Array.from(affectedShards) });
    }
    /**
     * Get shard assignment for a key
     */
    getShardForKey(key) {
        const shardId = this.getShardId(key);
        const nodes = this.hashRing.getNodes(shardId, this.replicationFactor);
        if (nodes.length === 0)
            return null;
        return {
            shardId,
            nodeId: nodes[0],
            replicas: nodes.slice(1)
        };
    }
    /**
     * Get nodes responsible for a shard
     */
    getNodesForShard(shardId) {
        const shard = this.shards.get(shardId);
        if (!shard)
            return [];
        // Return primary node and replicas
        const nodes = this.hashRing.getNodes(shardId, this.replicationFactor);
        return nodes;
    }
    /**
     * Get total number of shards
     */
    getTotalShards() {
        return this.shardCount;
    }
    /**
     * Update shard assignment to a new node
     */
    updateShardAssignment(shardId, newNodeId) {
        const shard = this.shards.get(shardId);
        if (!shard) {
            throw new Error(`Shard ${shardId} not found`);
        }
        // Remove from old node
        if (shard.nodeId) {
            const oldNodeShards = this.nodeToShards.get(shard.nodeId);
            if (oldNodeShards) {
                oldNodeShards.delete(shardId);
            }
        }
        // Add to new node
        shard.nodeId = newNodeId;
        const newNodeShards = this.nodeToShards.get(newNodeId);
        if (newNodeShards) {
            newNodeShards.add(shardId);
        }
        else {
            this.nodeToShards.set(newNodeId, new Set([shardId]));
        }
        this.emit('shardReassigned', { shardId, newNodeId });
    }
    /**
     * Get shard ID for a key
     */
    getShardId(key) {
        const hash = createHash('md5').update(key).digest();
        const shardIndex = hash.readUInt16BE(0) % this.shardCount;
        return `shard-${shardIndex.toString().padStart(3, '0')}`;
    }
    /**
     * Rebalance shards across nodes
     */
    rebalanceShards() {
        if (!this.autoRebalance)
            return;
        const nodes = this.hashRing.getAllNodes();
        if (nodes.length === 0)
            return;
        // Clear current assignments
        for (const nodeSet of this.nodeToShards.values()) {
            nodeSet.clear();
        }
        // Reassign each shard
        for (const [shardId, shard] of this.shards) {
            const assignedNodes = this.hashRing.getNodes(shardId, 1);
            if (assignedNodes.length > 0) {
                shard.nodeId = assignedNodes[0];
                shard.status = 'active';
                const nodeShards = this.nodeToShards.get(assignedNodes[0]);
                if (nodeShards) {
                    nodeShards.add(shardId);
                }
            }
            else {
                shard.status = 'offline';
            }
        }
        this.emit('rebalanced', { nodes, shardCount: this.shardCount });
    }
    /**
     * Get shard assignment for all shards
     */
    getShardAssignments() {
        const assignments = [];
        for (const [shardId, shard] of this.shards) {
            if (shard.nodeId) {
                assignments.push({
                    shardId,
                    nodeId: shard.nodeId,
                    replicas: this.hashRing.getNodes(shardId, this.replicationFactor).slice(1)
                });
            }
        }
        return assignments;
    }
    /**
     * Get shard statistics
     */
    getShardStats() {
        let activeShards = 0;
        let rebalancingShards = 0;
        let offlineShards = 0;
        let totalItems = 0;
        for (const shard of this.shards.values()) {
            switch (shard.status) {
                case 'active':
                    activeShards++;
                    break;
                case 'rebalancing':
                    rebalancingShards++;
                    break;
                case 'offline':
                    offlineShards++;
                    break;
            }
            totalItems += shard.itemCount;
        }
        return {
            totalShards: this.shardCount,
            activeShards,
            rebalancingShards,
            offlineShards,
            averageItemsPerShard: this.shardCount > 0 ? Math.floor(totalItems / this.shardCount) : 0
        };
    }
    /**
     * Update shard metrics
     */
    updateShardMetrics(shardId, itemCount, sizeBytes) {
        const shard = this.shards.get(shardId);
        if (shard) {
            shard.itemCount = itemCount;
            shard.sizeBytes = sizeBytes;
        }
    }
    /**
     * Get replication nodes for a shard
     */
    getReplicationNodes(shardId) {
        return this.hashRing.getNodes(shardId, this.replicationFactor);
    }
    /**
     * Check if rebalancing is needed
     */
    needsRebalancing() {
        const stats = this.getShardStats();
        return stats.offlineShards > 0 || stats.rebalancingShards > 0;
    }
    /**
     * Get cluster health
     */
    getHealth() {
        const nodes = this.hashRing.getAllNodes();
        const stats = this.getShardStats();
        return {
            healthy: stats.activeShards >= this.shardCount * 0.9, // 90% shards active
            nodes: nodes.length,
            shards: {
                total: this.shardCount,
                active: stats.activeShards,
                inactive: stats.offlineShards + stats.rebalancingShards
            }
        };
    }
}
/**
 * Create a shard manager instance
 */
export function createShardManager(config) {
    return new ShardManager(config);
}
//# sourceMappingURL=shardManager.js.map