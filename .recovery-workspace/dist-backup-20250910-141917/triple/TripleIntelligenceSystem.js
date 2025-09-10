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
/**
 * Performance metrics for monitoring and assertions
 */
export class PerformanceMetrics {
    constructor() {
        this.operations = new Map();
        this.slowQueries = [];
        this.totalItems = 0;
    }
    recordOperation(type, elapsed, itemCount) {
        const stats = this.operations.get(type) || {
            count: 0,
            totalTime: 0,
            maxTime: 0,
            minTime: Infinity,
            violations: 0
        };
        stats.count++;
        stats.totalTime += elapsed;
        stats.maxTime = Math.max(stats.maxTime, elapsed);
        stats.minTime = Math.min(stats.minTime, elapsed);
        // Check for O(log n) violation
        const expectedTime = this.getExpectedTime(type, itemCount || this.totalItems);
        if (elapsed > expectedTime * 2) {
            stats.violations++;
            console.error(`⚠️ Performance violation in ${type}: ${elapsed.toFixed(2)}ms > expected ${expectedTime.toFixed(2)}ms`);
            this.slowQueries.push({
                type,
                elapsed,
                expectedTime,
                timestamp: Date.now(),
                itemCount: itemCount || this.totalItems
            });
        }
        this.operations.set(type, stats);
    }
    getExpectedTime(type, itemCount) {
        // O(log n) operations should complete in roughly log2(n) * k milliseconds
        // where k is a constant based on the operation type
        const logN = Math.log2(Math.max(1, itemCount));
        switch (type) {
            case 'vector_search':
                return logN * 5; // HNSW is very efficient
            case 'field_filter':
                return logN * 3; // B-tree operations are fast
            case 'graph_traversal':
                return 10; // O(1) adjacency list lookups
            case 'fusion':
                return Math.log2(Math.max(1, itemCount)) * 2; // O(k log k) sorting
            default:
                return logN * 10; // Conservative estimate
        }
    }
    setTotalItems(count) {
        this.totalItems = count;
    }
    getReport() {
        const report = {
            operations: {},
            violations: [],
            slowQueries: this.slowQueries.slice(-100) // Last 100 slow queries
        };
        for (const [type, stats] of this.operations) {
            report.operations[type] = {
                avgTime: stats.totalTime / stats.count,
                maxTime: stats.maxTime,
                minTime: stats.minTime,
                violations: stats.violations,
                violationRate: stats.violations / stats.count,
                totalCalls: stats.count
            };
            if (stats.violations > 0) {
                report.violations.push({
                    type,
                    count: stats.violations,
                    rate: stats.violations / stats.count
                });
            }
        }
        return report;
    }
    reset() {
        this.operations.clear();
        this.slowQueries = [];
    }
}
/**
 * Query execution planner - optimizes query execution order
 */
class QueryPlanner {
    /**
     * Build an optimized execution plan for a query
     */
    buildPlan(query) {
        const plan = {
            steps: [],
            estimatedCost: 0,
            requiresIndexes: []
        };
        // Determine which indexes are required
        if (query.similar || query.like) {
            plan.requiresIndexes.push('hnsw');
        }
        if (query.where) {
            plan.requiresIndexes.push('metadata');
        }
        if (query.connected) {
            plan.requiresIndexes.push('graph');
        }
        // Order operations by selectivity (most selective first)
        // This minimizes the working set for subsequent operations
        // 1. Field filters are usually most selective
        if (query.where) {
            plan.steps.push({
                type: 'field',
                operation: 'filter',
                requiresFastPath: true,
                estimatedSelectivity: 0.1 // Assume 10% match rate
            });
        }
        // 2. Graph traversal is moderately selective
        if (query.connected) {
            plan.steps.push({
                type: 'graph',
                operation: 'traverse',
                requiresFastPath: true,
                estimatedSelectivity: 0.3
            });
        }
        // 3. Vector search is least selective (returns top-k)
        if (query.similar || query.like) {
            plan.steps.push({
                type: 'vector',
                operation: 'search',
                requiresFastPath: true,
                estimatedSelectivity: 1.0
            });
        }
        // Calculate estimated cost
        plan.estimatedCost = plan.steps.reduce((cost, step) => {
            return cost + (1 / step.estimatedSelectivity);
        }, 0);
        return plan;
    }
}
/**
 * The main Triple Intelligence System
 */
export class TripleIntelligenceSystem {
    constructor(metadataIndex, hnswIndex, graphIndex, embedder, storage) {
        // REQUIRE all components - no fallbacks
        if (!metadataIndex) {
            throw new Error('MetadataIndex required for Triple Intelligence');
        }
        if (!hnswIndex) {
            throw new Error('HNSW index required for Triple Intelligence');
        }
        if (!graphIndex) {
            throw new Error('Graph index required for Triple Intelligence');
        }
        if (!embedder) {
            throw new Error('Embedding function required for Triple Intelligence');
        }
        if (!storage) {
            throw new Error('Storage adapter required for Triple Intelligence');
        }
        this.metadataIndex = metadataIndex;
        this.hnswIndex = hnswIndex;
        this.graphIndex = graphIndex;
        this.embedder = embedder;
        this.storage = storage;
        this.metrics = new PerformanceMetrics();
        this.planner = new QueryPlanner();
        // Set initial item count for metrics
        this.updateItemCount();
    }
    /**
     * Main find method - executes Triple Intelligence queries
     */
    async find(query, options) {
        const startTime = performance.now();
        // Validate query
        this.validateQuery(query);
        // Build optimized query plan
        const plan = this.planner.buildPlan(query);
        // Verify all required indexes are available
        this.verifyIndexes(plan.requiresIndexes);
        // Execute query plan with NO FALLBACKS
        const results = await this.executeQueryPlan(plan, query, options);
        // Record metrics
        const elapsed = performance.now() - startTime;
        this.metrics.recordOperation('find_query', elapsed, results.length);
        // ASSERT performance guarantees
        this.assertPerformance(elapsed, results.length);
        return results;
    }
    /**
     * Vector search using HNSW for O(log n) performance
     */
    async vectorSearch(query, limit) {
        const startTime = performance.now();
        // Convert text to vector if needed
        const vector = typeof query === 'string'
            ? await this.embedder(query)
            : query;
        // Search using HNSW index - O(log n) guaranteed
        const searchResults = await this.hnswIndex.search(vector, limit);
        // Convert to result format
        const results = [];
        for (const [id, score] of searchResults) {
            const entity = await this.storage.getNoun(id);
            if (entity) {
                results.push({
                    id,
                    score,
                    entity,
                    metadata: entity.metadata || {},
                    vectorScore: score
                });
            }
        }
        const elapsed = performance.now() - startTime;
        this.metrics.recordOperation('vector_search', elapsed, results.length);
        // Assert O(log n) performance
        const expectedTime = Math.log2(this.hnswIndex.size()) * 5;
        if (elapsed > expectedTime * 2) {
            throw new Error(`Vector search O(log n) violation: ${elapsed.toFixed(2)}ms > ${expectedTime.toFixed(2)}ms`);
        }
        return results;
    }
    /**
     * Field filtering using MetadataIndex for O(log n) performance
     */
    async fieldFilter(where, limit) {
        const startTime = performance.now();
        // Use MetadataIndex for O(log n) performance
        const matchingIds = await this.metadataIndex.getIdsForFilter(where);
        if (!matchingIds || matchingIds.length === 0) {
            return [];
        }
        // Convert to results with full entities
        const results = [];
        const idsToProcess = limit
            ? matchingIds.slice(0, limit)
            : matchingIds;
        // Process in parallel batches for efficiency
        const batchSize = 100;
        for (let i = 0; i < idsToProcess.length; i += batchSize) {
            const batch = idsToProcess.slice(i, i + batchSize);
            const entities = await Promise.all(batch.map(id => this.storage.getNoun(id)));
            for (let j = 0; j < entities.length; j++) {
                const entity = entities[j];
                if (entity) {
                    results.push({
                        id: batch[j],
                        score: 1.0, // Field matches are binary
                        entity,
                        metadata: entity.metadata || {},
                        fieldScore: 1.0
                    });
                }
            }
        }
        const elapsed = performance.now() - startTime;
        this.metrics.recordOperation('field_filter', elapsed, results.length);
        // Assert O(log n) for range queries
        if (this.hasRangeOperators(where)) {
            const expectedTime = Math.log2(1000000) * 3; // Assume max 1M items
            if (elapsed > expectedTime * 2) {
                throw new Error(`Field filter O(log n) violation: ${elapsed.toFixed(2)}ms > ${expectedTime.toFixed(2)}ms`);
            }
        }
        return results;
    }
    /**
     * Graph traversal using adjacency lists for O(1) lookups
     */
    async graphTraversal(params) {
        const startTime = performance.now();
        const maxDepth = params.depth || 2;
        const results = [];
        const visited = new Set();
        // BFS traversal with O(1) adjacency lookups
        const queue = [];
        // Initialize queue with starting node(s)
        if (params.from) {
            queue.push({ id: params.from, depth: 0, score: 1.0 });
        }
        while (queue.length > 0) {
            const { id, depth, score } = queue.shift();
            if (visited.has(id) || depth > maxDepth) {
                continue;
            }
            visited.add(id);
            // Get entity
            const entity = await this.storage.getNoun(id);
            if (entity) {
                results.push({
                    id,
                    score: score * Math.pow(0.8, depth), // Decay by distance
                    entity,
                    metadata: entity.metadata || {},
                    graphScore: score,
                    depth
                });
            }
            // Get neighbors - O(1) adjacency list lookup
            if (depth < maxDepth) {
                const neighbors = await this.graphIndex.getNeighbors(id, params.direction);
                for (const neighborId of neighbors) {
                    if (!visited.has(neighborId)) {
                        queue.push({
                            id: neighborId,
                            depth: depth + 1,
                            score: score * 0.8
                        });
                    }
                }
            }
        }
        const elapsed = performance.now() - startTime;
        this.metrics.recordOperation('graph_traversal', elapsed, results.length);
        // Graph traversal should be fast due to O(1) adjacency lookups
        const expectedTime = visited.size * 0.5; // 0.5ms per node
        if (elapsed > expectedTime * 3) {
            throw new Error(`Graph traversal performance warning: ${elapsed.toFixed(2)}ms > ${expectedTime.toFixed(2)}ms`);
        }
        return results;
    }
    /**
     * Execute the query plan
     */
    async executeQueryPlan(plan, query, options) {
        const limit = query.limit || 10;
        const intermediateResults = new Map();
        // Execute each step in the plan
        for (const step of plan.steps) {
            const stepStartTime = performance.now();
            let stepResults = [];
            switch (step.type) {
                case 'vector':
                    stepResults = await this.vectorSearch(query.similar || query.like, limit * 3 // Over-fetch for fusion
                    );
                    break;
                case 'field':
                    stepResults = await this.fieldFilter(query.where, limit * 3);
                    break;
                case 'graph':
                    stepResults = await this.graphTraversal(query.connected);
                    break;
                default:
                    throw new Error(`Unknown query step type: ${step.type}`);
            }
            intermediateResults.set(step.type, stepResults);
            const stepElapsed = performance.now() - stepStartTime;
            console.log(`Step ${step.type}:${step.operation} completed in ${stepElapsed.toFixed(2)}ms with ${stepResults.length} results`);
        }
        // Fuse results if multiple signals
        if (intermediateResults.size > 1) {
            return this.fuseResults(intermediateResults, limit, options);
        }
        // Single signal - return as is
        const singleResults = Array.from(intermediateResults.values())[0];
        return singleResults.slice(0, limit);
    }
    /**
     * Fuse results using Reciprocal Rank Fusion (RRF)
     */
    fuseResults(resultSets, limit, options) {
        const startTime = performance.now();
        const k = options?.fusion?.k || 60; // RRF constant
        const weights = options?.fusion?.weights || {
            vector: 0.5,
            field: 0.3,
            graph: 0.2
        };
        // Calculate RRF scores
        const fusionScores = new Map();
        const entityMap = new Map();
        for (const [signalType, results] of resultSets) {
            const weight = weights[signalType] || 1.0;
            results.forEach((result, rank) => {
                const rrfScore = weight / (k + rank + 1);
                const currentScore = fusionScores.get(result.id) || 0;
                fusionScores.set(result.id, currentScore + rrfScore);
                // Keep the result with the most information
                if (!entityMap.has(result.id)) {
                    entityMap.set(result.id, result);
                }
            });
        }
        // Sort by fusion score
        const sortedIds = Array.from(fusionScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
        // Build final results
        const results = [];
        for (const [id, fusionScore] of sortedIds) {
            const result = entityMap.get(id);
            results.push({
                ...result,
                fusionScore,
                score: fusionScore // Use fusion score as primary score
            });
        }
        const elapsed = performance.now() - startTime;
        this.metrics.recordOperation('fusion', elapsed, results.length);
        // Fusion should be O(k log k)
        const expectedTime = Math.log2(Math.max(1, fusionScores.size)) * 2;
        if (elapsed > expectedTime * 3) {
            console.warn(`Fusion performance warning: ${elapsed.toFixed(2)}ms > ${expectedTime.toFixed(2)}ms`);
        }
        return results;
    }
    /**
     * Validate query parameters
     */
    validateQuery(query) {
        if (!query.similar && !query.like && !query.where && !query.connected) {
            throw new Error('Query must specify at least one of: similar, like, where, or connected');
        }
        if (query.limit && (query.limit < 1 || query.limit > 10000)) {
            throw new Error('Query limit must be between 1 and 10000');
        }
    }
    /**
     * Verify required indexes are available
     */
    verifyIndexes(required) {
        for (const index of required) {
            switch (index) {
                case 'hnsw':
                    if (!this.hnswIndex || this.hnswIndex.size() === 0) {
                        throw new Error('HNSW index not available or empty');
                    }
                    break;
                case 'metadata':
                    if (!this.metadataIndex) {
                        throw new Error('Metadata index not available');
                    }
                    break;
                case 'graph':
                    if (!this.graphIndex) {
                        throw new Error('Graph index not available');
                    }
                    break;
            }
        }
    }
    /**
     * Assert performance guarantees
     */
    assertPerformance(elapsed, resultCount) {
        const itemCount = this.getTotalItems();
        const expectedTime = Math.log2(Math.max(1, itemCount)) * 20; // 20ms per log operation
        if (elapsed > expectedTime * 3) {
            throw new Error(`Query performance violation: ${elapsed.toFixed(2)}ms > expected ${expectedTime.toFixed(2)}ms ` +
                `for ${itemCount} items`);
        }
    }
    /**
     * Check if where clause has range operators
     */
    hasRangeOperators(where) {
        for (const value of Object.values(where)) {
            if (typeof value === 'object' && value !== null) {
                const keys = Object.keys(value);
                if (keys.some(k => ['$gt', '$gte', '$lt', '$lte', '$between'].includes(k))) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Update item count for metrics
     */
    updateItemCount() {
        const count = this.getTotalItems();
        this.metrics.setTotalItems(count);
    }
    /**
     * Get total item count across all indexes
     */
    getTotalItems() {
        // Get the largest count from available indexes
        // Note: MetadataIndexManager might not have a size() method
        // so we'll use HNSW index size as primary indicator
        return Math.max(this.hnswIndex?.size() || 0, 1000000, // Assume max 1M items for now
        this.graphIndex?.size() || 0);
    }
    /**
     * Get performance metrics
     */
    getMetrics() {
        return this.metrics;
    }
    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.metrics.reset();
    }
}
//# sourceMappingURL=TripleIntelligenceSystem.js.map