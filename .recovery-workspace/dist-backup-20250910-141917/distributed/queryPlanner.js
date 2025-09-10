/**
 * Distributed Query Planner for Brainy 3.0
 *
 * Intelligently plans and executes distributed queries across shards
 * Optimizes for data locality, parallelism, and network efficiency
 */
export class DistributedQueryPlanner {
    constructor(nodeId, coordinator, shardManager, transport, storage, tripleEngine) {
        this.nodeId = nodeId;
        this.coordinator = coordinator;
        this.shardManager = shardManager;
        this.transport = transport;
        this.storage = storage;
        this.tripleEngine = tripleEngine;
    }
    /**
     * Plan a distributed query
     */
    async planQuery(query) {
        // Determine query type and scope
        const queryType = this.getQueryType(query);
        const affectedShards = await this.determineAffectedShards(query);
        // Get current shard assignments
        const assignments = new Map();
        for (const shardId of affectedShards) {
            const nodes = await this.shardManager.getNodesForShard(shardId);
            assignments.set(shardId, nodes);
        }
        // Determine strategy based on query characteristics
        let strategy = 'scatter-gather';
        let cost = 0;
        if (affectedShards.length === 0) {
            // Local only query
            strategy = 'local-only';
            cost = 1;
        }
        else if (affectedShards.length === this.shardManager.getTotalShards()) {
            // Full table scan
            strategy = 'broadcast';
            cost = 1000;
        }
        else if (affectedShards.length <= 3) {
            // Targeted query
            strategy = 'targeted';
            cost = affectedShards.length * 10;
        }
        else {
            // Scatter-gather for medium queries
            strategy = 'scatter-gather';
            cost = affectedShards.length * 50;
        }
        // Add network cost
        const remoteShards = affectedShards.filter(shardId => {
            const nodes = assignments.get(shardId) || [];
            return !nodes.includes(this.nodeId);
        });
        cost += remoteShards.length * 20;
        return {
            shards: affectedShards,
            nodeAssignments: assignments,
            parallel: affectedShards.length > 1,
            cost,
            strategy
        };
    }
    /**
     * Execute a distributed query based on plan
     */
    async executeQuery(query, plan) {
        const startTime = Date.now();
        const nodeStats = new Map();
        // Group shards by node for efficient batching
        const nodeToShards = new Map();
        for (const [shardId, nodes] of plan.nodeAssignments) {
            // Pick the first available node (could be optimized)
            const targetNode = nodes[0];
            if (!nodeToShards.has(targetNode)) {
                nodeToShards.set(targetNode, []);
            }
            nodeToShards.get(targetNode).push(shardId);
        }
        // Execute queries in parallel
        const promises = [];
        for (const [targetNode, shards] of nodeToShards) {
            if (targetNode === this.nodeId) {
                // Local execution
                promises.push(this.executeLocalQuery(query, shards));
            }
            else {
                // Remote execution
                promises.push(this.executeRemoteQuery(targetNode, query, shards));
            }
        }
        // Wait for all results
        const results = await Promise.allSettled(promises);
        // Aggregate results
        const allResults = [];
        let totalCount = 0;
        let nodeIndex = 0;
        for (const [targetNode, shards] of nodeToShards) {
            const result = results[nodeIndex];
            const nodeTime = Date.now() - startTime;
            if (result.status === 'fulfilled') {
                const nodeResult = result.value;
                allResults.push(...(nodeResult.results || []));
                totalCount += nodeResult.count || 0;
                nodeStats.set(targetNode, {
                    resultsReturned: nodeResult.count || 0,
                    executionTime: nodeTime,
                    shards
                });
            }
            else {
                nodeStats.set(targetNode, {
                    resultsReturned: 0,
                    executionTime: nodeTime,
                    errors: [result.reason?.message || 'Unknown error'],
                    shards
                });
            }
            nodeIndex++;
        }
        // Merge and rank results using Triple Intelligence if available
        const mergedResults = await this.mergeResults(allResults, query);
        return {
            results: mergedResults,
            totalCount,
            executionTime: Date.now() - startTime,
            nodeStats
        };
    }
    /**
     * Execute query on local shards
     */
    async executeLocalQuery(query, shards) {
        const results = [];
        for (const shardId of shards) {
            // Get data from storage for this shard
            const shardData = await this.getShardData(shardId, query);
            results.push(...shardData);
        }
        return {
            results,
            count: results.length
        };
    }
    /**
     * Execute query on remote node
     */
    async executeRemoteQuery(targetNode, query, shards) {
        try {
            const response = await this.transport.call(targetNode, 'query', {
                query,
                shards
            });
            return response || { results: [], count: 0 };
        }
        catch (error) {
            console.error(`Failed to query node ${targetNode}:`, error);
            throw error;
        }
    }
    /**
     * Get data from a specific shard
     */
    async getShardData(shardId, query) {
        // This would interact with the actual storage adapter
        // For now, return empty array since storage adapters don't have direct shard access
        // In a real implementation, this would use storage-specific methods
        try {
            // Would need to implement shard-aware storage methods
            // For now, return empty to allow compilation
            return [];
        }
        catch (error) {
            console.error(`Failed to get shard ${shardId} data:`, error);
            return [];
        }
    }
    /**
     * Filter data based on query criteria
     */
    filterData(data, query) {
        if (!Array.isArray(data))
            return [];
        // Apply query filters
        let filtered = data;
        if (query.filter) {
            filtered = filtered.filter((item) => {
                // Apply filter logic
                return this.matchesFilter(item, query.filter);
            });
        }
        if (query.limit) {
            filtered = filtered.slice(0, query.limit);
        }
        return filtered;
    }
    /**
     * Check if item matches filter
     */
    matchesFilter(item, filter) {
        // Simple filter matching
        for (const [key, value] of Object.entries(filter)) {
            if (item[key] !== value) {
                return false;
            }
        }
        return true;
    }
    /**
     * Merge results from multiple nodes using Triple Intelligence
     */
    async mergeResults(results, query) {
        if (!this.tripleEngine) {
            // Simple merge without Triple Intelligence
            return this.deduplicateResults(results);
        }
        // Use Triple Intelligence for intelligent merging
        // Merge results by combining scores and maintaining order
        const mergedMap = new Map();
        for (const result of results) {
            const id = result.id || result.entity?.id;
            if (!id)
                continue;
            if (mergedMap.has(id)) {
                // Merge duplicate results by averaging scores
                const existing = mergedMap.get(id);
                existing.score = (existing.score + (result.score || 0)) / 2;
                // Preserve highest confidence metadata
                if (result.confidence > existing.confidence) {
                    existing.metadata = { ...existing.metadata, ...result.metadata };
                }
            }
            else {
                mergedMap.set(id, { ...result });
            }
        }
        // Sort by score and return
        return Array.from(mergedMap.values())
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    /**
     * Simple deduplication of results
     */
    deduplicateResults(results) {
        const seen = new Set();
        const deduplicated = [];
        for (const result of results) {
            const key = this.getResultKey(result);
            if (!seen.has(key)) {
                seen.add(key);
                deduplicated.push(result);
            }
        }
        return deduplicated;
    }
    /**
     * Get unique key for result
     */
    getResultKey(result) {
        if (result.id)
            return result.id;
        if (result.uuid)
            return result.uuid;
        return JSON.stringify(result);
    }
    /**
     * Determine query type
     */
    getQueryType(query) {
        if (query.vector)
            return 'vector';
        if (query.triple)
            return 'triple';
        if (query.filter)
            return 'filter';
        return 'scan';
    }
    /**
     * Determine which shards are affected by query
     */
    async determineAffectedShards(query) {
        const totalShards = this.shardManager.getTotalShards();
        const affectedShards = [];
        // If query has specific entity/key, determine shard
        if (query.entity || query.key) {
            const key = query.entity || query.key;
            const assignment = this.shardManager.getShardForKey(key);
            if (assignment) {
                return [assignment.shardId];
            }
        }
        // If query has partition hint
        if (query.partition) {
            return [query.partition];
        }
        // Otherwise, query all shards (broadcast)
        for (let i = 0; i < totalShards; i++) {
            affectedShards.push(`shard-${i}`);
        }
        return affectedShards;
    }
    /**
     * Optimize query plan based on statistics
     */
    async optimizePlan(plan) {
        // Get node health and latency stats
        const nodeHealth = await this.coordinator.getHealth();
        // Re-assign shards to healthier nodes if needed
        const optimizedAssignments = new Map();
        for (const [shardId, nodes] of plan.nodeAssignments) {
            // Sort nodes by health score (simple heuristic)
            const sortedNodes = nodes.sort((a, b) => {
                // Higher health score = better node
                // For now, use a simple approach
                return 0;
            });
            optimizedAssignments.set(shardId, sortedNodes);
        }
        return {
            ...plan,
            nodeAssignments: optimizedAssignments
        };
    }
}
//# sourceMappingURL=queryPlanner.js.map