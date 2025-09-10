/**
 * Triple Intelligence Engine
 * Revolutionary unified search combining Vector + Graph + Field intelligence
 *
 * This is Brainy's killer feature - no other database can do this!
 */
/**
 * The Triple Intelligence Engine
 * Unifies vector, graph, and field search into one beautiful API
 */
export class TripleIntelligenceEngine {
    constructor(brain) {
        this.planCache = new Map();
        this.brain = brain;
        this.api = brain.getTripleIntelligenceAPI();
        // Query history removed - unnecessary complexity for minimal gain
    }
    /**
     * The magic happens here - one query to rule them all
     */
    async find(query) {
        const startTime = Date.now();
        // Generate optimal query plan
        const plan = await this.optimizeQuery(query);
        // Execute based on plan
        let results;
        if (plan.canParallelize) {
            // Run all three paths in parallel for maximum speed
            results = await this.parallelSearch(query, plan);
        }
        else {
            // Progressive filtering for efficiency
            results = await this.progressiveSearch(query, plan);
        }
        // Apply boosts if requested
        if (query.boost) {
            results = this.applyBoosts(results, query.boost);
        }
        // Add explanations if requested
        if (query.explain) {
            const timing = Date.now() - startTime;
            results = this.addExplanations(results, plan, timing);
        }
        // Query history removed - no learning needed
        // Apply limit
        if (query.limit) {
            results = results.slice(0, query.limit);
        }
        return results;
    }
    /**
     * Generate optimal execution plan based on query shape and statistics
     */
    async optimizeQuery(query) {
        // Short-circuit optimization for single-signal queries
        const hasVector = !!(query.like || query.similar);
        const hasGraph = !!(query.connected);
        const hasField = !!(query.where && Object.keys(query.where).length > 0);
        const signalCount = [hasVector, hasGraph, hasField].filter(Boolean).length;
        // Single signal - skip fusion entirely!
        if (signalCount === 1) {
            const singleType = hasVector ? 'vector' : hasGraph ? 'graph' : 'field';
            return {
                startWith: singleType,
                canParallelize: false,
                estimatedCost: 1,
                steps: [{
                        type: singleType,
                        operation: 'direct', // Direct execution, no fusion
                        estimated: 50
                    }]
            };
        }
        // Check cache first
        const cacheKey = JSON.stringify(query);
        if (this.planCache.has(cacheKey)) {
            return this.planCache.get(cacheKey);
        }
        // Get real statistics for cost-based optimization
        const stats = await this.api.getStatistics();
        // Calculate costs for each operation
        const costs = await this.calculateOperationCosts(query, stats);
        // Build optimal plan based on actual costs
        const plan = this.buildOptimalPlan(query, costs, stats);
        this.planCache.set(cacheKey, plan);
        return plan;
    }
    /**
     * Calculate real costs for each operation based on statistics
     */
    async calculateOperationCosts(query, stats) {
        const costs = {
            vector: Infinity,
            graph: Infinity,
            field: Infinity
        };
        // Vector search cost - O(log n) with HNSW
        if (query.like || query.similar) {
            // HNSW search complexity: O(log n) * ef
            const ef = 200; // exploration factor
            costs.vector = Math.log2(stats.totalCount) * ef;
        }
        // Graph traversal cost - depends on connectivity
        if (query.connected) {
            const depth = query.connected.maxDepth || query.connected.depth || 2;
            // Assume average branching factor of 10
            const branchingFactor = 10;
            costs.graph = Math.pow(branchingFactor, depth);
        }
        // Field filter cost - depends on selectivity
        if (query.where) {
            const selectivity = await this.estimateFieldSelectivity(query.where, stats);
            costs.field = stats.totalCount * selectivity;
            // If we have an index, cost is O(log n)
            if (this.api.hasMetadataIndex()) {
                costs.field = Math.log2(stats.totalCount) + costs.field;
            }
        }
        return costs;
    }
    /**
     * Estimate selectivity of field filters
     */
    async estimateFieldSelectivity(where, stats) {
        let selectivity = 1.0;
        for (const [field, condition] of Object.entries(where)) {
            const fieldStats = stats.fieldStats[field];
            if (!fieldStats) {
                // Unknown field - assume 10% selectivity
                selectivity *= 0.1;
                continue;
            }
            if (typeof condition === 'object' && condition !== null) {
                // Handle operators
                if ('$eq' in condition) {
                    // Equality - 1/cardinality
                    selectivity *= 1.0 / (fieldStats.cardinality || 100);
                }
                else if ('$gt' in condition || '$gte' in condition) {
                    // Range query - estimate based on distribution
                    const threshold = condition.$gt || condition.$gte;
                    if (typeof threshold === 'number' && fieldStats.type === 'number') {
                        const range = fieldStats.max - fieldStats.min;
                        const remainingRange = fieldStats.max - threshold;
                        selectivity *= remainingRange / range;
                    }
                    else {
                        selectivity *= 0.3; // Default for non-numeric
                    }
                }
                else if ('$lt' in condition || '$lte' in condition) {
                    // Range query - estimate based on distribution
                    const threshold = condition.$lt || condition.$lte;
                    if (typeof threshold === 'number' && fieldStats.type === 'number') {
                        const range = fieldStats.max - fieldStats.min;
                        const remainingRange = threshold - fieldStats.min;
                        selectivity *= remainingRange / range;
                    }
                    else {
                        selectivity *= 0.3; // Default for non-numeric
                    }
                }
                else if ('$in' in condition) {
                    // IN query
                    selectivity *= condition.$in.length / (fieldStats.cardinality || 100);
                }
            }
            else {
                // Direct equality
                selectivity *= 1.0 / (fieldStats.cardinality || 100);
            }
        }
        return Math.max(0.0001, Math.min(1.0, selectivity));
    }
    /**
     * Build optimal execution plan based on costs
     */
    buildOptimalPlan(query, costs, stats) {
        const hasVector = !!(query.like || query.similar);
        const hasGraph = !!(query.connected);
        const hasField = !!(query.where && Object.keys(query.where).length > 0);
        // Find the most selective operation
        const sortedOps = Object.entries(costs)
            .filter(([op]) => {
            return (op === 'vector' && hasVector) ||
                (op === 'graph' && hasGraph) ||
                (op === 'field' && hasField);
        })
            .sort((a, b) => a[1] - b[1]);
        // If the most selective operation filters out > 99%, start with it
        const mostSelective = sortedOps[0];
        if (mostSelective && mostSelective[1] < stats.totalCount * 0.01) {
            // Progressive plan - start with most selective
            return {
                startWith: mostSelective[0],
                canParallelize: false,
                estimatedCost: mostSelective[1],
                steps: this.buildProgressiveSteps(sortedOps, query)
            };
        }
        // If operations have similar costs, parallelize
        if (sortedOps.length > 1) {
            const ratio = sortedOps[1][1] / sortedOps[0][1];
            if (ratio < 10) {
                // Costs are within 10x - parallelize
                return {
                    startWith: sortedOps[0][0],
                    canParallelize: true,
                    estimatedCost: Math.max(...sortedOps.map(op => op[1])),
                    steps: this.buildParallelSteps(sortedOps, query)
                };
            }
        }
        // Default progressive plan
        return {
            startWith: sortedOps[0][0],
            canParallelize: false,
            estimatedCost: sortedOps.reduce((sum, op) => sum + op[1], 0),
            steps: this.buildProgressiveSteps(sortedOps, query)
        };
    }
    /**
     * Build progressive execution steps
     */
    buildProgressiveSteps(sortedOps, query) {
        const steps = [];
        for (const [op, cost] of sortedOps) {
            steps.push({
                type: op,
                operation: op === 'vector' ? 'search' : op === 'graph' ? 'traverse' : 'filter',
                estimated: Math.round(cost)
            });
        }
        // Add fusion step if multiple operations
        if (steps.length > 1) {
            steps.push({
                type: 'fusion',
                operation: 'rank',
                estimated: Math.round(sortedOps.length * 50)
            });
        }
        return steps;
    }
    /**
     * Build parallel execution steps
     */
    buildParallelSteps(sortedOps, query) {
        const steps = sortedOps.map(([op, cost]) => ({
            type: op,
            operation: op === 'vector' ? 'search' : op === 'graph' ? 'traverse' : 'filter',
            estimated: Math.round(cost)
        }));
        // Always add fusion for parallel execution
        steps.push({
            type: 'fusion',
            operation: 'rank',
            estimated: Math.round(sortedOps.length * 100)
        });
        return steps;
    }
    /**
     * Execute searches in parallel for maximum speed
     */
    async parallelSearch(query, plan) {
        // Check for single-signal optimization
        if (plan.steps.length === 1 && plan.steps[0].operation === 'direct') {
            // Skip fusion for single signal queries
            const results = await this.executeSingleSignal(query, plan.steps[0].type);
            return results.map(r => ({
                ...r,
                fusionScore: r.score || 1.0,
                score: r.score || 1.0
            }));
        }
        const tasks = [];
        // Vector search
        if (query.like || query.similar) {
            tasks.push(this.vectorSearch(query.like || query.similar, query.limit));
        }
        // Graph traversal
        if (query.connected) {
            tasks.push(this.graphTraversal(query.connected));
        }
        // Field filtering  
        if (query.where) {
            tasks.push(this.fieldFilter(query.where));
        }
        // Run all in parallel
        const results = await Promise.all(tasks);
        // Fusion ranking combines all signals
        return this.fusionRank(results, query);
    }
    /**
     * Progressive filtering for efficiency
     */
    async progressiveSearch(query, plan) {
        let candidates = [];
        for (const step of plan.steps) {
            switch (step.type) {
                case 'field':
                    if (candidates.length === 0) {
                        // Initial field filter
                        candidates = await this.fieldFilter(query.where);
                    }
                    else {
                        // Filter existing candidates
                        candidates = this.applyFieldFilter(candidates, query.where);
                    }
                    break;
                case 'vector':
                    // CRITICAL: If we have a previous step that returned 0 candidates, 
                    // we must respect that and not do a fresh search
                    if (candidates.length === 0 && plan.steps[0].type === 'vector') {
                        // This is the first step - do initial vector search
                        const results = await this.vectorSearch(query.like || query.similar, query.limit);
                        candidates = results;
                    }
                    else if (candidates.length > 0) {
                        // Vector search within existing candidates
                        candidates = await this.vectorSearchWithin(query.like || query.similar, candidates);
                    }
                    // If candidates.length === 0 and this isn't the first step, keep empty candidates
                    break;
                case 'graph':
                    // CRITICAL: Same logic as vector - respect empty candidates from previous steps
                    if (candidates.length === 0 && plan.steps[0].type === 'graph') {
                        // This is the first step - do initial graph traversal
                        candidates = await this.graphTraversal(query.connected);
                    }
                    else if (candidates.length > 0) {
                        // Graph expansion from existing candidates
                        candidates = await this.graphExpand(candidates);
                    }
                    // If candidates.length === 0 and this isn't the first step, keep empty candidates
                    break;
                case 'fusion':
                    // Final fusion ranking
                    return this.fusionRank([candidates], query);
            }
        }
        return candidates;
    }
    /**
     * Vector similarity search
     */
    async vectorSearch(query, limit) {
        // Use clean internal vector search API to avoid circular dependency
        // This is the proper architecture: find() uses internal methods, not public search()
        return this.api.vectorSearch(query, limit || 100);
    }
    /**
     * Graph traversal
     */
    async graphTraversal(connected) {
        // Get starting nodes
        const startNodes = connected.from ?
            (Array.isArray(connected.from) ? connected.from : [connected.from]) :
            connected.to ?
                (Array.isArray(connected.to) ? connected.to : [connected.to]) :
                [];
        // Use the API for graph traversal
        const options = {
            start: startNodes,
            type: connected.type,
            direction: connected.direction || 'both',
            maxDepth: connected.maxDepth || connected.depth || 2
        };
        const results = await this.api.graphTraversal(options);
        // Convert to expected format
        return results.map(r => ({
            id: r.id,
            type: connected.type || 'relates_to',
            score: r.score
        }));
    }
    /**
     * Field-based filtering using MetadataIndex for O(log n) performance
     * NO FALLBACKS - Requires proper where clause and MetadataIndex
     */
    async fieldFilter(where) {
        // Require a valid where clause - no empty queries allowed
        if (!where || Object.keys(where).length === 0) {
            throw new Error('Field filter requires a where clause. ' +
                'For retrieving all items, use a different query type or specify explicit criteria.');
        }
        // Verify MetadataIndex is available
        if (!this.api.hasMetadataIndex || !this.api.hasMetadataIndex()) {
            throw new Error('MetadataIndex not available - cannot perform O(log n) field queries. ' +
                'Initialize Brainy with enableMetadataIndex: true');
        }
        // Use the MetadataIndex for O(log n) performance
        // This uses B-tree indexes for range queries and hash indexes for exact matches
        const startTime = performance.now();
        const matchingIds = await this.api.metadataQuery(where);
        // Verify we got results from the fast path
        if (!matchingIds) {
            throw new Error('MetadataIndex query failed - no fallback allowed');
        }
        // Track performance metrics
        const queryTime = performance.now() - startTime;
        const expectedTime = Math.log2(1000000) * 5; // Assume max 1M items, 5ms per log operation
        if (queryTime > expectedTime * 2) {
            console.warn(`Field filter performance warning: ${queryTime.toFixed(2)}ms > expected ${expectedTime.toFixed(2)}ms`);
        }
        // Convert matching IDs to result format with full entities
        const results = [];
        const idsArray = Array.from(matchingIds);
        // Process results in batches for efficiency
        const batchSize = 100;
        for (let i = 0; i < Math.min(idsArray.length, 1000); i += batchSize) {
            const batch = idsArray.slice(i, i + batchSize);
            const entities = await Promise.all(batch.map(id => this.api.getEntity(id)));
            for (let j = 0; j < entities.length; j++) {
                const entity = entities[j];
                if (entity) {
                    results.push({
                        id: batch[j],
                        score: 1.0, // Field matches are binary
                        entity,
                        metadata: entity.metadata || {}
                    });
                }
            }
        }
        return results;
    }
    /**
     * Execute a single signal query directly
     */
    async executeSingleSignal(query, signalType) {
        switch (signalType) {
            case 'vector':
                return this.vectorSearch(query.like || query.similar, query.limit);
            case 'graph':
                return this.graphTraversal(query.connected);
            case 'field':
                return this.fieldFilter(query.where);
            default:
                throw new Error(`Unknown signal type: ${signalType}`);
        }
    }
    /**
     * Expand graph connections from existing candidates
     */
    async graphExpand(candidates) {
        const expanded = [];
        const visited = new Set();
        // For each candidate, find its graph neighbors
        for (const candidate of candidates) {
            const id = candidate.id || candidate;
            if (visited.has(id))
                continue;
            visited.add(id);
            // Get connections for this node
            const [sourceVerbs, targetVerbs] = await Promise.all([
                this.api.getVerbsBySource(id),
                this.api.getVerbsByTarget(id)
            ]);
            // Add the original candidate
            expanded.push(candidate);
            // Add connected nodes
            for (const verb of sourceVerbs) {
                if (!visited.has(verb.targetId)) {
                    const entity = await this.api.getEntity(verb.targetId);
                    if (entity) {
                        expanded.push({
                            id: verb.targetId,
                            score: (candidate.score || 1.0) * 0.8, // Decay score by distance
                            entity,
                            metadata: entity.metadata
                        });
                    }
                }
            }
            for (const verb of targetVerbs) {
                if (!visited.has(verb.sourceId)) {
                    const entity = await this.api.getEntity(verb.sourceId);
                    if (entity) {
                        expanded.push({
                            id: verb.sourceId,
                            score: (candidate.score || 1.0) * 0.8, // Decay score by distance
                            entity,
                            metadata: entity.metadata
                        });
                    }
                }
            }
        }
        return expanded;
    }
    /**
     * Vector search within existing candidates
     */
    async vectorSearchWithin(query, candidates) {
        // Get the query vector
        const queryVector = typeof query === 'string' ?
            (await this.api.vectorSearch(query, 1))[0]?.entity?.vector :
            query;
        if (!queryVector)
            return candidates;
        // Score each candidate by vector similarity
        const scored = [];
        for (const candidate of candidates) {
            const entity = candidate.entity || await this.api.getEntity(candidate.id);
            if (entity && entity.vector) {
                const similarity = this.cosineSimilarity(queryVector, entity.vector);
                scored.push({
                    ...candidate,
                    score: similarity,
                    entity
                });
            }
        }
        // Sort by similarity and return
        return scored.sort((a, b) => b.score - a.score);
    }
    /**
     * Apply field filter to existing candidates
     */
    applyFieldFilter(candidates, where) {
        return candidates.filter(candidate => {
            const metadata = candidate.metadata || candidate.entity?.metadata || {};
            return this.matchesFilter(metadata, where);
        });
    }
    /**
     * Check if metadata matches filter conditions
     */
    matchesFilter(metadata, where) {
        for (const [field, condition] of Object.entries(where)) {
            const value = metadata[field];
            if (typeof condition === 'object' && condition !== null) {
                // Handle operators
                if ('$eq' in condition && value !== condition.$eq)
                    return false;
                if ('$ne' in condition && value === condition.$ne)
                    return false;
                if ('$gt' in condition && !(value > condition.$gt))
                    return false;
                if ('$gte' in condition && !(value >= condition.$gte))
                    return false;
                if ('$lt' in condition && !(value < condition.$lt))
                    return false;
                if ('$lte' in condition && !(value <= condition.$lte))
                    return false;
                if ('$in' in condition && !condition.$in.includes(value))
                    return false;
                if ('$nin' in condition && condition.$nin.includes(value))
                    return false;
            }
            else {
                // Direct equality
                if (value !== condition)
                    return false;
            }
        }
        return true;
    }
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
    /**
     * Fusion ranking using Reciprocal Rank Fusion (RRF)
     * This is the same algorithm used by Google and Elasticsearch
     */
    fusionRank(resultSets, query) {
        // RRF constant - 60 is empirically proven optimal
        const k = 60;
        // Calculate dynamic weights based on query
        const weights = this.calculateSignalWeights(query);
        // Determine which result sets we have based on query
        let vectorResultsIdx = -1;
        let graphResultsIdx = -1;
        let metadataResultsIdx = -1;
        let currentIdx = 0;
        if (query.like || query.similar) {
            vectorResultsIdx = currentIdx++;
        }
        if (query.where) {
            metadataResultsIdx = currentIdx++;
        }
        // If we have metadata filters AND other searches, apply intersection
        if (metadataResultsIdx >= 0 && resultSets.length > 1) {
            const metadataResults = resultSets[metadataResultsIdx];
            // CRITICAL: If metadata filter returned no results, entire query should return empty
            if (metadataResults.length === 0) {
                return [];
            }
            const metadataIds = new Set(metadataResults.map(r => r.id || r));
            // Filter ALL other result sets to only include items that match metadata
            for (let i = 0; i < resultSets.length; i++) {
                if (i !== metadataResultsIdx) {
                    resultSets[i] = resultSets[i].filter(r => metadataIds.has(r.id || r));
                }
            }
        }
        // Build fusion scores using RRF
        const fusionScores = new Map();
        // Process each result set with RRF
        resultSets.forEach((results, setIndex) => {
            // Determine signal type
            let signalType;
            let weight = 1.0;
            if (setIndex === vectorResultsIdx) {
                signalType = 'vector';
                weight = weights.vector;
            }
            else if (setIndex === graphResultsIdx) {
                signalType = 'graph';
                weight = weights.graph;
            }
            else if (setIndex === metadataResultsIdx) {
                signalType = 'field';
                weight = weights.field;
            }
            else {
                return; // Skip unknown signal types
            }
            // Apply RRF to each result
            results.forEach((result, rank) => {
                const id = result.id || result;
                // Calculate RRF score: 1 / (k + rank + 1)
                const rrfScore = weight * (1.0 / (k + rank + 1));
                if (!fusionScores.has(id)) {
                    fusionScores.set(id, {
                        entity: result.entity || result,
                        vectorScore: 0,
                        graphScore: 0,
                        fieldScore: 0,
                        rrfScore: 0,
                        fusionScore: 0,
                        metadata: result.metadata || {}
                    });
                }
                const fusion = fusionScores.get(id);
                // Track individual signal scores
                if (signalType === 'vector') {
                    fusion.vectorScore = result.score || 1.0;
                }
                else if (signalType === 'graph') {
                    fusion.graphScore = result.score || 1.0;
                }
                else if (signalType === 'field') {
                    fusion.fieldScore = result.score || 1.0;
                }
                // Accumulate RRF score
                fusion.rrfScore += rrfScore;
            });
        });
        // Convert to results array
        const results = Array.from(fusionScores.entries()).map(([id, fusion]) => ({
            id,
            entity: fusion.entity,
            score: fusion.rrfScore, // Use RRF score as primary score
            vector: fusion.entity?.vector || new Float32Array(0), // Include vector for SearchResult compatibility
            vectorScore: fusion.vectorScore,
            graphScore: fusion.graphScore,
            fieldScore: fusion.fieldScore,
            fusionScore: fusion.rrfScore, // RRF score is the fusion score
            metadata: fusion.metadata
        }));
        // Sort by fusion score (descending)
        results.sort((a, b) => b.fusionScore - a.fusionScore);
        // Apply offset and limit
        let final = results;
        if (query.offset && query.offset > 0) {
            final = final.slice(query.offset);
        }
        if (query.limit) {
            final = final.slice(0, query.limit);
        }
        return final;
    }
    /**
     * Calculate dynamic signal weights based on query characteristics
     */
    calculateSignalWeights(query) {
        const hasVector = !!(query.like || query.similar);
        const hasGraph = !!(query.connected);
        const hasField = !!(query.where && Object.keys(query.where).length > 0);
        // Count active signals
        const activeSignals = [hasVector, hasGraph, hasField].filter(Boolean).length;
        if (activeSignals === 1) {
            // Single signal - full weight
            return {
                vector: hasVector ? 1.0 : 0,
                graph: hasGraph ? 1.0 : 0,
                field: hasField ? 1.0 : 0
            };
        }
        // Multiple signals - adaptive weights
        if (hasVector && hasGraph && hasField) {
            // All three signals - balanced with slight vector preference
            return {
                vector: 0.4, // Semantic search is often most relevant
                graph: 0.35, // Relationships are important
                field: 0.25 // Metadata is supportive
            };
        }
        else if (hasVector && hasGraph) {
            // Vector + Graph - emphasize semantics
            return {
                vector: 0.6,
                graph: 0.4,
                field: 0
            };
        }
        else if (hasVector && hasField) {
            // Vector + Field - balanced
            return {
                vector: 0.5,
                graph: 0,
                field: 0.5
            };
        }
        else if (hasGraph && hasField) {
            // Graph + Field - emphasize relationships
            return {
                vector: 0,
                graph: 0.6,
                field: 0.4
            };
        }
        // Default balanced weights
        return {
            vector: 0.34,
            graph: 0.33,
            field: 0.33
        };
    }
    /**
     * Apply boost strategies
     */
    applyBoosts(results, boost) {
        return results.map(r => {
            let boostFactor = 1.0;
            switch (boost) {
                case 'recent':
                    // Boost recent items
                    const age = Date.now() - (r.metadata?.timestamp || 0);
                    boostFactor = Math.exp(-age / (30 * 24 * 60 * 60 * 1000)); // 30-day half-life
                    break;
                case 'popular':
                    // Boost by view count or connections
                    boostFactor = Math.log10((r.metadata?.views || 0) + 10) / 2;
                    break;
                case 'verified':
                    // Boost verified content
                    boostFactor = r.metadata?.verified ? 1.5 : 1.0;
                    break;
            }
            return {
                ...r,
                fusionScore: r.fusionScore * boostFactor
            };
        });
    }
    /**
     * Add query explanations for debugging
     */
    addExplanations(results, plan, totalTime) {
        return results.map(r => ({
            ...r,
            explanation: {
                plan: plan.steps.map(s => `${s.type}:${s.operation}`).join(' → '),
                timing: {
                    total: totalTime,
                    ...plan.steps.reduce((acc, step) => ({
                        ...acc,
                        [step.type]: step.estimated
                    }), {})
                },
                boosts: []
            }
        }));
    }
    // Query learning removed - unnecessary complexity
    /**
     * Optimize plan based on historical patterns
     */
    // Query optimization from history removed
    /**
     * Clear query optimization cache
     */
    clearCache() {
        this.planCache.clear();
    }
    /**
     * Get optimization statistics
     */
    getStats() {
        return {
            cachedPlans: this.planCache.size,
            historySize: 0 // Query history removed
        };
    }
}
// Export a beautiful, simple API
export async function find(brain, query) {
    const engine = new TripleIntelligenceEngine(brain);
    return engine.find(query);
}
//# sourceMappingURL=TripleIntelligence.js.map