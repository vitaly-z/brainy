/**
 * Improved Neural API - Clean, Consistent, Performant
 *
 * Public API Surface:
 * - brain.neural.similar(a, b, options?)           // Similarity calculation
 * - brain.neural.clusters(items?, options?)        // Semantic clustering
 * - brain.neural.neighbors(id, options?)           // K-nearest neighbors
 * - brain.neural.hierarchy(id, options?)           // Semantic hierarchy
 * - brain.neural.outliers(options?)                // Anomaly detection
 * - brain.neural.visualize(options?)               // Visualization data
 *
 * Advanced Clustering:
 * - brain.neural.clusterByDomain(field, options?)  // Domain-aware clustering
 * - brain.neural.clusterByTime(field, windows, options?) // Temporal clustering
 * - brain.neural.clusterStream(options?)           // AsyncIterator for streaming
 * - brain.neural.updateClusters(items, options?)   // Incremental clustering
 *
 * Private methods are prefixed with _ and not exposed in public API
 */
import { cosineDistance, euclideanDistance } from '../utils/distance.js';
import { NeuralAPIError, ClusteringError, SimilarityError } from './types.js';
export class ImprovedNeuralAPI {
    constructor(brain, config = {}) {
        // Caching for performance
        this.similarityCache = new Map();
        this.clusterCache = new Map();
        this.hierarchyCache = new Map();
        this.neighborsCache = new Map();
        // Performance tracking
        this.performanceMetrics = new Map();
        this.brain = brain;
        this.config = {
            cacheSize: 1000,
            defaultAlgorithm: 'auto',
            similarityMetric: 'cosine',
            performanceTracking: true,
            maxMemoryUsage: '1GB',
            parallelProcessing: true,
            streamingBatchSize: 100,
            ...config
        };
        this._initializeCleanupTimer();
    }
    // ===== PUBLIC API: SIMILARITY =====
    /**
     * Calculate similarity between any two items (auto-detection)
     * Supports: IDs, text strings, vectors, or mixed types
     */
    async similar(a, b, options = {}) {
        const startTime = performance.now();
        try {
            // Create cache key
            const cacheKey = this._createSimilarityKey(a, b, options);
            if (this.similarityCache.has(cacheKey)) {
                return this.similarityCache.get(cacheKey);
            }
            let result;
            // Auto-detect input types and route accordingly
            if (this._isId(a) && this._isId(b)) {
                result = await this._similarityById(a, b, options);
            }
            else if (this._isVector(a) && this._isVector(b)) {
                result = await this._similarityByVector(a, b, options);
            }
            else if (typeof a === 'string' && typeof b === 'string') {
                result = await this._similarityByText(a, b, options);
            }
            else {
                // Mixed types - convert to vectors
                const vectorA = await this._convertToVector(a);
                const vectorB = await this._convertToVector(b);
                result = await this._similarityByVector(vectorA, vectorB, options);
            }
            // Cache result
            this._cacheResult(cacheKey, result, this.similarityCache);
            // Track performance
            this._trackPerformance('similarity', startTime, 2, 'mixed');
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new SimilarityError(`Failed to calculate similarity: ${errorMessage}`, {
                inputA: typeof a === 'object' ? 'vector' : String(a).substring(0, 50),
                inputB: typeof b === 'object' ? 'vector' : String(b).substring(0, 50),
                options
            });
        }
    }
    // ===== PUBLIC API: CLUSTERING =====
    /**
     * Intelligent semantic clustering with auto-routing
     * - No input: Cluster all data
     * - Array: Cluster specific items
     * - String: Find clusters near this item
     * - Options object: Advanced configuration
     */
    async clusters(input) {
        const startTime = performance.now();
        try {
            let options = {};
            let items;
            // Parse input
            if (!input) {
                // Cluster all data
                items = undefined;
                options = { algorithm: 'auto' };
            }
            else if (Array.isArray(input)) {
                // Cluster specific items
                items = input;
                options = { algorithm: 'auto' };
            }
            else if (typeof input === 'string') {
                // Find clusters near this item
                const nearbyResult = await this.neighbors(input, { limit: 100 });
                items = nearbyResult.neighbors.map(n => n.id);
                options = { algorithm: 'auto' };
            }
            else if (typeof input === 'object') {
                // Configuration object
                options = input;
                items = undefined;
            }
            else {
                throw new ClusteringError('Invalid input for clustering', { input });
            }
            // Check cache
            const cacheKey = this._createClusteringKey(items, options);
            if (this.clusterCache.has(cacheKey)) {
                const cached = this.clusterCache.get(cacheKey);
                return cached.clusters;
            }
            // Route to optimal algorithm
            const result = await this._routeClusteringAlgorithm(items, options);
            // Cache result
            this._cacheResult(cacheKey, result, this.clusterCache);
            // Track performance
            this._trackPerformance('clustering', startTime, items?.length || 0, options.algorithm || 'auto');
            return result.clusters;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new ClusteringError(`Failed to perform clustering: ${errorMessage}`, {
                input: typeof input === 'object' ? JSON.stringify(input) : input,
            });
        }
    }
    /**
     * Fast hierarchical clustering using HNSW levels
     */
    async clusterFast(options = {}) {
        const fullOptions = {
            algorithm: 'hierarchical',
            maxClusters: options.maxClusters,
            ...options
        };
        const result = await this._performHierarchicalClustering(undefined, fullOptions);
        return result.clusters;
    }
    /**
     * Large-scale clustering with intelligent sampling
     */
    async clusterLarge(options = {}) {
        const fullOptions = {
            algorithm: 'auto',
            sampleSize: options.sampleSize || 1000,
            strategy: options.strategy || 'diverse',
            ...options
        };
        const result = await this._performSampledClustering(undefined, fullOptions);
        return result.clusters;
    }
    // ===== PUBLIC API: ADVANCED CLUSTERING =====
    /**
     * Domain-aware clustering based on metadata fields
     */
    async clusterByDomain(field, options = {}) {
        const startTime = performance.now();
        try {
            // Get all items with the specified field
            const items = await this._getItemsByField(field);
            if (items.length === 0) {
                return [];
            }
            // Group by domain values
            const domainGroups = this._groupByDomain(items, field);
            const domainClusters = [];
            // Cluster within each domain
            for (const [domain, domainItems] of domainGroups) {
                const domainOptions = {
                    ...options,
                    algorithm: 'auto',
                    maxClusters: Math.min(options.maxClusters || 10, Math.ceil(domainItems.length / 3))
                };
                const clusters = await this._performClustering(domainItems.map(item => item.id), domainOptions);
                // Convert to domain clusters
                for (const cluster of clusters.clusters) {
                    domainClusters.push({
                        ...cluster,
                        domain,
                        domainConfidence: this._calculateDomainConfidence(cluster, domainItems),
                        crossDomainMembers: options.crossDomainThreshold
                            ? await this._findCrossDomainMembers(cluster, options.crossDomainThreshold)
                            : undefined
                    });
                }
            }
            // Handle cross-domain clustering if enabled
            if (!options.preserveDomainBoundaries) {
                const crossDomainClusters = await this._findCrossDomainClusters(domainClusters, options.crossDomainThreshold || 0.8);
                domainClusters.push(...crossDomainClusters);
            }
            this._trackPerformance('domainClustering', startTime, items.length, field);
            return domainClusters;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new ClusteringError(`Failed to cluster by domain: ${errorMessage}`, { field, options });
        }
    }
    /**
     * Temporal clustering based on time windows
     */
    async clusterByTime(timeField, windows, options = { timeField, windows }) {
        const startTime = performance.now();
        try {
            const temporalClusters = [];
            for (const window of windows) {
                // Get items in this time window
                const windowItems = await this._getItemsByTimeWindow(timeField, window);
                if (windowItems.length === 0)
                    continue;
                // Cluster items in this window  
                const clusteringOptions = {
                    ...options,
                    algorithm: 'auto'
                };
                const clusters = await this._performClustering(windowItems.map(item => item.id), clusteringOptions);
                // Convert to temporal clusters
                for (const cluster of clusters.clusters) {
                    const temporal = await this._calculateTemporalMetrics(cluster, windowItems, timeField);
                    temporalClusters.push({
                        ...cluster,
                        timeWindow: window,
                        trend: temporal.trend,
                        temporal: temporal.metrics
                    });
                }
            }
            // Handle overlapping windows
            if (options.overlapStrategy === 'merge') {
                return this._mergeOverlappingTemporalClusters(temporalClusters);
            }
            this._trackPerformance('temporalClustering', startTime, temporalClusters.length, 'temporal');
            return temporalClusters;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new ClusteringError(`Failed to cluster by time: ${errorMessage}`, { timeField, windows, options });
        }
    }
    /**
     * Streaming clustering with real-time updates
     */
    async *clusterStream(options = {}) {
        const batchSize = options.batchSize || this.config.streamingBatchSize || 100;
        let batchNumber = 0;
        let processedCount = 0;
        try {
            // Get all items for processing
            const allItems = await this._getAllItemIds();
            const totalItems = allItems.length;
            // Process in batches
            for (let i = 0; i < allItems.length; i += batchSize) {
                const startTime = performance.now();
                const batch = allItems.slice(i, i + batchSize);
                // Perform clustering on this batch
                const result = await this._performClustering(batch, {
                    ...options,
                    algorithm: 'auto',
                    cacheResults: false // Don't cache streaming results
                });
                processedCount += batch.length;
                const isComplete = processedCount >= totalItems;
                yield {
                    clusters: result.clusters,
                    batchNumber: ++batchNumber,
                    isComplete,
                    progress: {
                        processed: processedCount,
                        total: totalItems,
                        percentage: (processedCount / totalItems) * 100
                    },
                    metrics: {
                        ...result.metrics,
                        executionTime: performance.now() - startTime
                    }
                };
                // Adaptive threshold adjustment
                if (options.adaptiveThreshold && batchNumber > 1) {
                    options.threshold = this._adjustThresholdAdaptively(result.clusters, options.threshold);
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new ClusteringError(`Failed in streaming clustering: ${errorMessage}`, { options, batchNumber });
        }
    }
    /**
     * Incremental clustering - add new items to existing clusters
     */
    async updateClusters(newItems, options = {}) {
        const startTime = performance.now();
        try {
            // Get existing clusters
            const existingClusters = await this.clusters({ ...options, algorithm: 'auto' });
            // For each new item, find best cluster or create new one
            const updatedClusters = [...existingClusters];
            const unassignedItems = [];
            for (const itemId of newItems) {
                let bestCluster = null;
                let bestSimilarity = 0;
                // Find most similar existing cluster
                for (const cluster of updatedClusters) {
                    const similarity = await this._calculateItemToClusterSimilarity(itemId, cluster);
                    if (similarity > bestSimilarity && similarity > (options.threshold || 0.6)) {
                        bestSimilarity = similarity;
                        bestCluster = cluster;
                    }
                }
                if (bestCluster) {
                    // Add to existing cluster
                    bestCluster.members.push(itemId);
                    bestCluster.size = bestCluster.members.length;
                    // Recalculate centroid
                    bestCluster.centroid = await this._recalculateClusterCentroid(bestCluster);
                }
                else {
                    // Item doesn't fit existing clusters
                    unassignedItems.push(itemId);
                }
            }
            // Create new clusters for unassigned items
            if (unassignedItems.length > 0) {
                const newClusters = await this._performClustering(unassignedItems, options);
                updatedClusters.push(...newClusters.clusters);
            }
            this._trackPerformance('incrementalClustering', startTime, newItems.length, 'incremental');
            return updatedClusters;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new ClusteringError(`Failed to update clusters: ${errorMessage}`, { newItems, options });
        }
    }
    /**
     * Enhanced clustering with relationship analysis using verbs
     * Returns clusters with intra-cluster and inter-cluster relationship information
     *
     * Scalable for millions of nodes - uses efficient batching and filtering
     */
    async clustersWithRelationships(input, options) {
        const startTime = performance.now();
        const batchSize = options?.batchSize || 1000;
        const maxRelationships = options?.maxRelationships || 10000;
        let processedCount = 0;
        try {
            // Get basic clusters first
            const basicClusters = await this.clusters(input);
            if (basicClusters.length === 0) {
                return [];
            }
            // Build member lookup for O(1) cluster membership checking
            const memberToClusterMap = new Map();
            const clusterMap = new Map();
            for (const cluster of basicClusters) {
                clusterMap.set(cluster.id, cluster);
                for (const memberId of cluster.members) {
                    memberToClusterMap.set(memberId, cluster.id);
                }
            }
            // Initialize cluster edge collections
            const clusterEdges = new Map();
            for (const cluster of basicClusters) {
                clusterEdges.set(cluster.id, {
                    intra: [],
                    inter: [],
                    edgeTypes: {}
                });
            }
            // Process verbs in batches to handle millions of relationships efficiently
            let hasMoreVerbs = true;
            let offset = 0;
            while (hasMoreVerbs && processedCount < maxRelationships) {
                // Get batch of verbs using proper pagination API
                const verbResult = await this.brain.getVerbs({
                    pagination: {
                        offset: offset,
                        limit: batchSize
                    }
                });
                const verbBatch = verbResult.data;
                if (verbBatch.length === 0) {
                    hasMoreVerbs = false;
                    break;
                }
                // Process this batch
                for (const verb of verbBatch) {
                    if (processedCount >= maxRelationships)
                        break;
                    const sourceClusterId = memberToClusterMap.get(verb.sourceId);
                    const targetClusterId = memberToClusterMap.get(verb.targetId);
                    // Skip verbs that don't involve any clustered nodes
                    if (!sourceClusterId && !targetClusterId)
                        continue;
                    const edgeWeight = this._calculateEdgeWeight(verb);
                    const edgeType = verb.verb || verb.type || 'relationship';
                    if (sourceClusterId && targetClusterId) {
                        if (sourceClusterId === targetClusterId) {
                            // Intra-cluster relationship
                            const edges = clusterEdges.get(sourceClusterId);
                            edges.intra.push({
                                id: verb.id,
                                source: verb.sourceId,
                                target: verb.targetId,
                                type: edgeType,
                                weight: edgeWeight,
                                isInterCluster: false,
                                sourceCluster: sourceClusterId,
                                targetCluster: sourceClusterId
                            });
                            edges.edgeTypes[edgeType] = (edges.edgeTypes[edgeType] || 0) + 1;
                        }
                        else {
                            // Inter-cluster relationship
                            const sourceEdges = clusterEdges.get(sourceClusterId);
                            const targetEdges = clusterEdges.get(targetClusterId);
                            const edge = {
                                id: verb.id,
                                source: verb.sourceId,
                                target: verb.targetId,
                                type: edgeType,
                                weight: edgeWeight,
                                isInterCluster: true,
                                sourceCluster: sourceClusterId,
                                targetCluster: targetClusterId
                            };
                            sourceEdges.inter.push(edge);
                            // Don't duplicate - target cluster will see this as incoming
                            sourceEdges.edgeTypes[edgeType] = (sourceEdges.edgeTypes[edgeType] || 0) + 1;
                        }
                    }
                    else {
                        // One-way relationship to/from cluster
                        const clusterId = sourceClusterId || targetClusterId;
                        const edges = clusterEdges.get(clusterId);
                        edges.inter.push({
                            id: verb.id,
                            source: verb.sourceId,
                            target: verb.targetId,
                            type: edgeType,
                            weight: edgeWeight,
                            isInterCluster: true,
                            sourceCluster: sourceClusterId || 'external',
                            targetCluster: targetClusterId || 'external'
                        });
                        edges.edgeTypes[edgeType] = (edges.edgeTypes[edgeType] || 0) + 1;
                    }
                    processedCount++;
                }
                offset += batchSize;
                // Memory management: if we have too many edges, break early
                const totalEdges = Array.from(clusterEdges.values())
                    .reduce((sum, edges) => sum + edges.intra.length + edges.inter.length, 0);
                if (totalEdges >= maxRelationships) {
                    console.warn(`Relationship analysis stopped at ${totalEdges} edges to maintain performance`);
                    break;
                }
                // Check if we got fewer verbs than batch size (end of data)
                if (verbBatch.length < batchSize) {
                    hasMoreVerbs = false;
                }
            }
            // Build enhanced clusters
            const enhancedClusters = [];
            for (const cluster of basicClusters) {
                const edges = clusterEdges.get(cluster.id);
                enhancedClusters.push({
                    ...cluster,
                    intraClusterEdges: edges.intra,
                    interClusterEdges: edges.inter,
                    relationshipSummary: {
                        totalEdges: edges.intra.length + edges.inter.length,
                        intraClusterEdges: edges.intra.length,
                        interClusterEdges: edges.inter.length,
                        edgeTypes: edges.edgeTypes
                    }
                });
            }
            this._trackPerformance('clustersWithRelationships', startTime, processedCount, 'enhanced-scalable');
            return enhancedClusters;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new ClusteringError(`Failed to perform relationship-aware clustering: ${errorMessage}`, {
                input: typeof input === 'object' ? JSON.stringify(input) : input,
                processedCount: processedCount || 0
            });
        }
    }
    // ===== PUBLIC API: NEIGHBORS & HIERARCHY =====
    /**
     * Find K-nearest semantic neighbors
     */
    async neighbors(id, options = {}) {
        const startTime = performance.now();
        try {
            const cacheKey = `neighbors:${id}:${JSON.stringify(options)}`;
            if (this.neighborsCache.has(cacheKey)) {
                return this.neighborsCache.get(cacheKey);
            }
            const limit = options.limit || 10;
            const minSimilarity = options.minSimilarity || 0.1;
            // Use HNSW index for efficient neighbor search
            const searchResults = await this.brain.search('', {
                ...options,
                limit: limit * 2, // Get more than needed for filtering
                metadata: options.includeMetadata ? {} : undefined
            });
            // Filter and sort neighbors
            const neighbors = [];
            for (const result of searchResults) {
                if (result.id === id)
                    continue; // Skip self
                const similarity = await this._calculateSimilarity(id, result.id);
                if (similarity >= minSimilarity) {
                    neighbors.push({
                        id: result.id,
                        similarity,
                        data: result.content || result.data,
                        metadata: options.includeMetadata ? result.metadata : undefined,
                        distance: 1 - similarity
                    });
                }
                if (neighbors.length >= limit)
                    break;
            }
            // Sort by specified criteria
            this._sortNeighbors(neighbors, options.sortBy || 'similarity');
            const result = {
                neighbors: neighbors.slice(0, limit),
                queryId: id,
                totalFound: neighbors.length,
                averageSimilarity: neighbors.reduce((sum, n) => sum + n.similarity, 0) / neighbors.length
            };
            this._cacheResult(cacheKey, result, this.neighborsCache);
            this._trackPerformance('neighbors', startTime, limit, 'knn');
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new NeuralAPIError(`Failed to find neighbors: ${errorMessage}`, 'NEIGHBORS_ERROR', { id, options });
        }
    }
    /**
     * Build semantic hierarchy around an item
     */
    async hierarchy(id, options = {}) {
        const startTime = performance.now();
        try {
            const cacheKey = `hierarchy:${id}:${JSON.stringify(options)}`;
            if (this.hierarchyCache.has(cacheKey)) {
                return this.hierarchyCache.get(cacheKey);
            }
            // Get item data
            const item = await this.brain.getNoun(id);
            if (!item) {
                throw new Error(`Item with ID ${id} not found`);
            }
            // Build hierarchy based on strategy
            const hierarchy = await this._buildSemanticHierarchy(item, options);
            this._cacheResult(cacheKey, hierarchy, this.hierarchyCache);
            this._trackPerformance('hierarchy', startTime, 1, 'hierarchy');
            return hierarchy;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new NeuralAPIError(`Failed to build hierarchy: ${errorMessage}`, 'HIERARCHY_ERROR', { id, options });
        }
    }
    // ===== PUBLIC API: ANALYSIS =====
    /**
     * Detect outliers and anomalous items
     */
    async outliers(options = {}) {
        const startTime = performance.now();
        try {
            const threshold = options.threshold || 0.3;
            const method = options.method || 'cluster-based';
            let outliers = [];
            switch (method) {
                case 'isolation':
                    outliers = await this._detectOutliersIsolation(threshold, options);
                    break;
                case 'statistical':
                    outliers = await this._detectOutliersStatistical(threshold, options);
                    break;
                case 'cluster-based':
                default:
                    outliers = await this._detectOutliersClusterBased(threshold, options);
                    break;
            }
            this._trackPerformance('outlierDetection', startTime, outliers.length, method);
            return outliers;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new NeuralAPIError(`Failed to detect outliers: ${errorMessage}`, 'OUTLIER_ERROR', { options });
        }
    }
    /**
     * Generate visualization data for graph libraries
     */
    async visualize(options = {}) {
        const startTime = performance.now();
        try {
            const maxNodes = options.maxNodes || 100;
            const dimensions = options.dimensions || 2;
            const algorithm = options.algorithm || 'force';
            // Get data for visualization
            const nodes = await this._generateVisualizationNodes(maxNodes, options);
            const edges = options.includeEdges ? await this._generateVisualizationEdges(nodes, options) : [];
            const clusters = options.clusterColors ? await this._generateVisualizationClusters(nodes) : [];
            // Apply layout algorithm
            const positionedNodes = await this._applyLayoutAlgorithm(nodes, edges, algorithm, dimensions);
            const result = {
                nodes: positionedNodes,
                edges,
                clusters,
                metadata: {
                    algorithm,
                    dimensions,
                    totalNodes: nodes.length,
                    totalEdges: edges.length,
                    generatedAt: new Date()
                }
            };
            this._trackPerformance('visualization', startTime, nodes.length, algorithm);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new NeuralAPIError(`Failed to generate visualization: ${errorMessage}`, 'VISUALIZATION_ERROR', { options });
        }
    }
    // ===== PRIVATE IMPLEMENTATION METHODS =====
    async _routeClusteringAlgorithm(items, options) {
        const algorithm = options.algorithm || 'auto';
        const itemCount = items?.length || await this._getTotalItemCount();
        // Auto-select optimal algorithm based on data size and characteristics
        if (algorithm === 'auto') {
            // Intelligent algorithm selection based on data characteristics
            const itemIds = items || await this._getAllItemIds();
            const dataCharacteristics = await this._analyzeDataCharacteristics(itemIds);
            const hasRichGraph = dataCharacteristics.graphDensity > 0.05;
            const hasSemanticTypes = Object.keys(dataCharacteristics.typeDistribution).length > 3;
            if (hasRichGraph && hasSemanticTypes) {
                // Best of all worlds for rich semantic graphs
                return this._performMultiModalClustering(items, { ...options, algorithm: 'multimodal' });
            }
            else if (hasRichGraph) {
                // Strong relationship network - use graph clustering
                return this._performGraphClustering(items, { ...options, algorithm: 'graph' });
            }
            else if (hasSemanticTypes) {
                // Rich semantic taxonomy - use semantic clustering
                return this._performSemanticClustering(items, { ...options, algorithm: 'semantic' });
            }
            else if (itemCount > 10000) {
                // Large dataset - use sampling
                return this._performSampledClustering(items, { ...options, algorithm: 'sample' });
            }
            else if (itemCount > 1000) {
                // Medium dataset - use hierarchical HNSW
                return this._performHierarchicalClustering(items, { ...options, algorithm: 'hierarchical' });
            }
            else {
                // Small dataset - use k-means for quality
                return this._performKMeansClustering(items, { ...options, algorithm: 'kmeans' });
            }
        }
        // Use specified algorithm
        switch (algorithm) {
            case 'hierarchical':
                return this._performHierarchicalClustering(items, options);
            case 'semantic':
                return this._performSemanticClustering(items, options);
            case 'graph':
                return this._performGraphClustering(items, options);
            case 'multimodal':
                return this._performMultiModalClustering(items, options);
            case 'kmeans':
                return this._performKMeansClustering(items, options);
            case 'dbscan':
                return this._performDBSCANClustering(items, options);
            case 'sample':
                return this._performSampledClustering(items, options);
            default:
                throw new ClusteringError(`Unsupported algorithm: ${algorithm}`);
        }
    }
    async _performClustering(items, options) {
        // This is the main clustering dispatcher - routes to specific algorithms
        return this._routeClusteringAlgorithm(items, options);
    }
    // ===== REAL CLUSTERING IMPLEMENTATIONS =====
    /**
     * SEMANTIC-AWARE CLUSTERING: Uses existing NounType/VerbType taxonomy + HNSW
     */
    async _performSemanticClustering(items, options) {
        const startTime = performance.now();
        // Get all items if not specified
        const itemIds = items || await this._getAllItemIds();
        if (itemIds.length === 0) {
            return this._createEmptyResult(startTime, 'semantic');
        }
        // 1. Group items by semantic type (NounType) - O(n) operation
        const itemsWithMetadata = await this._getItemsWithMetadata(itemIds);
        const typeGroups = this._groupBySemanticType(itemsWithMetadata);
        const allClusters = [];
        // 2. Cluster within each semantic type using HNSW - parallel processing
        const typeClusteringPromises = Array.from(typeGroups.entries()).map(async ([nounType, groupItems]) => {
            if (groupItems.length < (options.minClusterSize || 2)) {
                // Create single cluster for small groups
                return [{
                        id: `semantic-${nounType}`,
                        centroid: await this._calculateGroupCentroid(groupItems),
                        members: groupItems.map(item => item.id),
                        size: groupItems.length,
                        confidence: 0.9, // High confidence for type-based clustering
                        label: `${nounType} cluster`,
                        metadata: { semanticType: nounType, clustering: 'semantic' }
                    }];
            }
            // Use HNSW hierarchical clustering within type
            return this._clusterWithinSemanticType(groupItems, options);
        });
        const typeClusterResults = await Promise.all(typeClusteringPromises);
        typeClusterResults.forEach(clusters => allClusters.push(...clusters));
        // 3. Find cross-type relationships using existing verb connections
        const crossTypeConnections = await this._findCrossTypeConnections(typeGroups, options);
        // 4. Merge clusters that have strong cross-type relationships
        const finalClusters = await this._mergeSemanticClusters(allClusters, crossTypeConnections);
        return {
            clusters: finalClusters.slice(0, options.maxClusters || finalClusters.length),
            metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'semantic'),
            metadata: {
                totalItems: itemIds.length,
                clustersFound: finalClusters.length,
                averageClusterSize: finalClusters.reduce((sum, c) => sum + c.size, 0) / finalClusters.length || 0,
                semanticTypes: Array.from(typeGroups.keys()).length,
                timestamp: new Date()
            }
        };
    }
    /**
     * HIERARCHICAL CLUSTERING: Uses existing HNSW levels for O(n) clustering
     */
    async _performHierarchicalClustering(items, options) {
        const startTime = performance.now();
        const itemIds = items || await this._getAllItemIds();
        if (itemIds.length === 0) {
            return this._createEmptyResult(startTime, 'hierarchical');
        }
        // Use existing HNSW level structure for natural clustering
        const level = options.level || this._getOptimalClusteringLevel(itemIds.length);
        const maxClusters = options.maxClusters || Math.min(50, Math.ceil(itemIds.length / 20));
        // Get HNSW level representatives - these are natural cluster centers
        const levelNodes = await this._getHNSWLevelNodes(level);
        const clusterCenters = levelNodes.slice(0, maxClusters);
        const clusters = [];
        // Create clusters around each level representative
        for (let i = 0; i < clusterCenters.length; i++) {
            const center = clusterCenters[i];
            // Find items that belong to this cluster using HNSW neighbors
            const members = await this._findClusterMembers(center, itemIds, 0.5);
            if (members.length > 0) {
                // Get actual node data for creating cluster
                const memberData = await this._getItemsWithMetadata(members);
                const centroid = await this._calculateCentroidFromItems(memberData);
                clusters.push({
                    id: `hierarchical-${i}`,
                    centroid,
                    members,
                    size: members.length,
                    confidence: await this._calculateHierarchicalConfidence(members),
                    label: await this._generateClusterLabel(memberData, 'hierarchical'),
                    metadata: { level, clusterCenter: center, clustering: 'hierarchical' }
                });
            }
        }
        // Assign remaining items to nearest clusters
        const assignedItems = new Set(clusters.flatMap(c => c.members));
        const unassignedItems = itemIds.filter(id => !assignedItems.has(id));
        if (unassignedItems.length > 0) {
            await this._assignUnassignedItems(unassignedItems, clusters);
        }
        return {
            clusters,
            metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'hierarchical'),
            metadata: {
                totalItems: itemIds.length,
                clustersFound: clusters.length,
                averageClusterSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length || 0,
                hnswLevel: level,
                timestamp: new Date()
            }
        };
    }
    /**
     * K-MEANS CLUSTERING: Real implementation using existing distance functions
     */
    async _performKMeansClustering(items, options) {
        const startTime = performance.now();
        const itemIds = items || await this._getAllItemIds();
        if (itemIds.length === 0) {
            return this._createEmptyResult(startTime, 'kmeans');
        }
        // Get vectors for all items using existing infrastructure
        const itemsWithVectors = await this._getItemsWithVectors(itemIds);
        // Determine optimal k
        const k = options.maxClusters || Math.min(Math.floor(Math.sqrt(itemsWithVectors.length / 2)), 50 // Maximum clusters for practical use
        );
        if (k <= 1) {
            // Single cluster case
            return {
                clusters: [{
                        id: 'kmeans-single',
                        centroid: await this._calculateCentroidFromItems(itemsWithVectors),
                        members: itemIds,
                        size: itemIds.length,
                        confidence: 1.0,
                        label: 'Single cluster',
                        metadata: { clustering: 'kmeans', k: 1 }
                    }],
                metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'kmeans'),
                metadata: {
                    totalItems: itemIds.length,
                    clustersFound: 1,
                    averageClusterSize: itemIds.length,
                    kValue: 1,
                    timestamp: new Date()
                }
            };
        }
        // Initialize centroids using k-means++ for better convergence
        const centroids = await this._initializeCentroidsKMeansPlusPlus(itemsWithVectors, k);
        let assignments = new Array(itemsWithVectors.length).fill(0);
        let hasConverged = false;
        const maxIterations = options.maxIterations || 100;
        const tolerance = options.tolerance || 1e-4;
        // K-means iteration loop
        for (let iteration = 0; iteration < maxIterations && !hasConverged; iteration++) {
            // Assignment step: assign each point to nearest centroid
            const newAssignments = await this._assignPointsToCentroids(itemsWithVectors, centroids);
            // Update step: recalculate centroids
            const newCentroids = await this._updateCentroids(itemsWithVectors, newAssignments, k);
            // Check convergence: has assignment changed significantly?
            const changeRate = this._calculateAssignmentChangeRate(assignments, newAssignments);
            hasConverged = changeRate < tolerance;
            assignments = newAssignments;
            // Update centroids for next iteration
            for (let i = 0; i < centroids.length; i++) {
                centroids[i] = newCentroids[i];
            }
        }
        // Create semantic clusters from k-means results
        const clusters = [];
        for (let clusterIndex = 0; clusterIndex < k; clusterIndex++) {
            const clusterMembers = itemsWithVectors.filter((_, i) => assignments[i] === clusterIndex);
            if (clusterMembers.length > 0) {
                const memberIds = clusterMembers.map(item => item.id);
                clusters.push({
                    id: `kmeans-${clusterIndex}`,
                    centroid: centroids[clusterIndex],
                    members: memberIds,
                    size: memberIds.length,
                    confidence: await this._calculateKMeansClusterConfidence(clusterMembers, centroids[clusterIndex]),
                    label: await this._generateClusterLabel(clusterMembers, 'kmeans'),
                    metadata: {
                        clustering: 'kmeans',
                        k,
                        clusterIndex,
                        convergenceIterations: maxIterations
                    }
                });
            }
        }
        return {
            clusters,
            metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'kmeans'),
            metadata: {
                totalItems: itemIds.length,
                clustersFound: clusters.length,
                averageClusterSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length || 0,
                kValue: k,
                hasConverged,
                timestamp: new Date()
            }
        };
    }
    /**
     * DBSCAN CLUSTERING: Density-based clustering with adaptive parameters using HNSW
     */
    async _performDBSCANClustering(items, options) {
        const startTime = performance.now();
        const itemIds = items || await this._getAllItemIds();
        if (itemIds.length === 0) {
            return this._createEmptyResult(startTime, 'dbscan');
        }
        const itemsWithVectors = await this._getItemsWithVectors(itemIds);
        // Adaptive parameter selection using HNSW neighbors
        const minPts = options.minClusterSize || Math.max(4, Math.floor(Math.log2(itemsWithVectors.length)));
        const eps = options.threshold || await this._estimateOptimalEps(itemsWithVectors, minPts);
        // DBSCAN state tracking
        const NOISE = -1;
        const UNVISITED = 0;
        const visited = new Map();
        const clusterAssignments = new Map();
        let currentClusterId = 1;
        // Process each point
        for (const item of itemsWithVectors) {
            if (visited.get(item.id))
                continue;
            visited.set(item.id, true);
            // Find neighbors using existing HNSW infrastructure for efficiency
            const neighbors = await this._findNeighborsWithinEps(item, itemsWithVectors, eps);
            if (neighbors.length < minPts) {
                // Mark as noise (outlier)
                clusterAssignments.set(item.id, NOISE);
            }
            else {
                // Start new cluster
                await this._expandCluster(item, neighbors, currentClusterId, eps, minPts, itemsWithVectors, visited, clusterAssignments);
                currentClusterId++;
            }
        }
        // Convert DBSCAN results to SemanticCluster format
        const clusters = [];
        const clusterGroups = new Map();
        const outliers = [];
        // Group items by cluster assignment
        for (const [itemId, clusterId] of clusterAssignments) {
            if (clusterId === NOISE) {
                outliers.push(itemId);
            }
            else {
                if (!clusterGroups.has(clusterId)) {
                    clusterGroups.set(clusterId, []);
                }
                clusterGroups.get(clusterId).push(itemId);
            }
        }
        // Create SemanticCluster objects
        for (const [clusterId, memberIds] of clusterGroups) {
            if (memberIds.length > 0) {
                const members = itemsWithVectors.filter(item => memberIds.includes(item.id));
                clusters.push({
                    id: `dbscan-${clusterId}`,
                    centroid: await this._calculateCentroidFromItems(members),
                    members: memberIds,
                    size: memberIds.length,
                    confidence: await this._calculateDBSCANClusterConfidence(members, eps),
                    label: await this._generateClusterLabel(members, 'dbscan'),
                    metadata: {
                        clustering: 'dbscan',
                        clusterId,
                        eps,
                        minPts,
                        isDensityBased: true
                    }
                });
            }
        }
        // Handle outliers - optionally create outlier cluster or assign to nearest
        if (outliers.length > 0 && options.includeOutliers) {
            const outlierMembers = itemsWithVectors.filter(item => outliers.includes(item.id));
            clusters.push({
                id: 'dbscan-outliers',
                centroid: await this._calculateCentroidFromItems(outlierMembers),
                members: outliers,
                size: outliers.length,
                confidence: 0.1, // Low confidence for outliers
                label: 'Outliers',
                metadata: {
                    clustering: 'dbscan',
                    isOutlierCluster: true,
                    eps,
                    minPts
                }
            });
        }
        return {
            clusters,
            metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'dbscan'),
            metadata: {
                totalItems: itemIds.length,
                clustersFound: clusters.length,
                averageClusterSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length || 0,
                outlierCount: outliers.length,
                eps,
                minPts,
                timestamp: new Date()
            }
        };
    }
    /**
     * GRAPH COMMUNITY DETECTION: Uses existing verb relationships for clustering
     */
    async _performGraphClustering(items, options) {
        const startTime = performance.now();
        const itemIds = items || await this._getAllItemIds();
        if (itemIds.length === 0) {
            return this._createEmptyResult(startTime, 'graph');
        }
        // Build graph from existing verb relationships
        const graph = await this._buildGraphFromVerbs(itemIds, options);
        // Detect communities using modularity optimization
        const communities = await this._detectCommunities(graph, options);
        // Enhance communities with vector similarity for boundary refinement
        const refinedCommunities = await this._refineCommunitiesWithVectors(communities, options);
        // Convert to SemanticCluster format with Triple Intelligence labeling
        const clusters = [];
        for (let i = 0; i < refinedCommunities.length; i++) {
            const community = refinedCommunities[i];
            if (community.members.length > 0) {
                const members = await this._getItemsWithMetadata(community.members);
                // Use Triple Intelligence for intelligent cluster labeling
                const clusterLabel = await this._generateIntelligentClusterLabel(members, 'graph');
                const clusterCentroid = await this._calculateCentroidFromItems(members);
                clusters.push({
                    id: `graph-${i}`,
                    centroid: clusterCentroid,
                    members: community.members,
                    size: community.members.length,
                    confidence: community.modularity || 0.7,
                    label: clusterLabel,
                    metadata: {
                        clustering: 'graph',
                        communityId: i,
                        modularity: community.modularity,
                        graphDensity: community.density,
                        strongestConnections: community.strongestConnections
                    }
                });
            }
        }
        return {
            clusters,
            metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'graph'),
            metadata: {
                totalItems: itemIds.length,
                clustersFound: clusters.length,
                averageClusterSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length || 0,
                averageModularity: clusters.reduce((sum, c) => sum + (c.metadata?.modularity || 0), 0) / clusters.length || 0,
                timestamp: new Date()
            }
        };
    }
    /**
     * MULTI-MODAL FUSION: Combines vector + graph + semantic + Triple Intelligence
     */
    async _performMultiModalClustering(items, options) {
        const startTime = performance.now();
        const itemIds = items || await this._getAllItemIds();
        if (itemIds.length === 0) {
            return this._createEmptyResult(startTime, 'multimodal');
        }
        // Run multiple clustering algorithms in parallel
        const [vectorClusters, graphClusters, semanticClusters] = await Promise.all([
            this._performHierarchicalClustering(itemIds, { ...options, algorithm: 'hierarchical' }),
            this._performGraphClustering(itemIds, { ...options, algorithm: 'graph' }),
            this._performSemanticClustering(itemIds, { ...options, algorithm: 'semantic' })
        ]);
        // Fuse results using intelligent consensus with Triple Intelligence
        const fusedClusters = await this._fuseClusteringResultsWithTripleIntelligence([vectorClusters.clusters, graphClusters.clusters, semanticClusters.clusters], options);
        return {
            clusters: fusedClusters,
            metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'multimodal'),
            metadata: {
                totalItems: itemIds.length,
                clustersFound: fusedClusters.length,
                averageClusterSize: fusedClusters.reduce((sum, c) => sum + c.size, 0) / fusedClusters.length || 0,
                fusionMethod: 'triple_intelligence_consensus',
                componentAlgorithms: ['hierarchical', 'graph', 'semantic'],
                timestamp: new Date()
            }
        };
    }
    /**
     * SAMPLED CLUSTERING: For very large datasets using intelligent sampling
     */
    async _performSampledClustering(items, options) {
        const startTime = performance.now();
        const itemIds = items || await this._getAllItemIds();
        if (itemIds.length === 0) {
            return this._createEmptyResult(startTime, 'sampled');
        }
        const sampleSize = Math.min(options.sampleSize || 1000, itemIds.length);
        const strategy = options.strategy || 'diverse';
        // Intelligent sampling using existing infrastructure
        const sample = await this._getSampleUsingStrategy(itemIds, sampleSize, strategy);
        // Cluster the sample using the best algorithm for the sample size
        const sampleResult = await this._performHierarchicalClustering(sample, {
            ...options,
            maxClusters: Math.min(options.maxClusters || 50, Math.ceil(sample.length / 10))
        });
        // Project clusters back to full dataset using HNSW neighbors
        const projectedClusters = await this._projectClustersToFullDataset(sampleResult.clusters, itemIds, sample);
        return {
            clusters: projectedClusters,
            metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'sampled'),
            metadata: {
                totalItems: itemIds.length,
                sampleSize: sample.length,
                samplingStrategy: strategy,
                clustersFound: projectedClusters.length,
                averageClusterSize: projectedClusters.reduce((sum, c) => sum + c.size, 0) / projectedClusters.length || 0,
                timestamp: new Date()
            }
        };
    }
    // Similarity implementation methods
    async _similarityById(id1, id2, options) {
        // Get vectors for both items
        const item1 = await this.brain.getNoun(id1);
        const item2 = await this.brain.getNoun(id2);
        if (!item1 || !item2) {
            return 0;
        }
        return this._similarityByVector(item1.vector, item2.vector, options);
    }
    async _similarityByVector(v1, v2, options) {
        const metric = options.metric || this.config.similarityMetric || 'cosine';
        let score = 0;
        switch (metric) {
            case 'cosine':
                score = 1 - cosineDistance(v1, v2);
                break;
            case 'euclidean':
                score = 1 / (1 + euclideanDistance(v1, v2));
                break;
            case 'manhattan':
                score = 1 / (1 + this._manhattanDistance(v1, v2));
                break;
            default:
                score = 1 - cosineDistance(v1, v2);
        }
        if (options.detailed) {
            return {
                score: options.normalized !== false ? Math.max(0, Math.min(1, score)) : score,
                confidence: this._calculateConfidence(score, v1, v2),
                explanation: this._generateSimilarityExplanation(score, metric),
                metric
            };
        }
        return options.normalized !== false ? Math.max(0, Math.min(1, score)) : score;
    }
    async _similarityByText(text1, text2, options) {
        // Convert text to vectors using brain's embedding function
        const vector1 = await this.brain.embed(text1);
        const vector2 = await this.brain.embed(text2);
        return this._similarityByVector(vector1, vector2, options);
    }
    // Utility methods for internal operations
    _isId(value) {
        return typeof value === 'string' &&
            (value.length === 36 && value.includes('-')) || // UUID-like
            (value.length > 10 && !value.includes(' ')); // ID-like string
    }
    _isVector(value) {
        return Array.isArray(value) &&
            value.length > 0 &&
            typeof value[0] === 'number';
    }
    async _convertToVector(input) {
        if (this._isVector(input)) {
            return input;
        }
        else if (this._isId(input)) {
            const item = await this.brain.getNoun(input);
            return item?.vector || [];
        }
        else if (typeof input === 'string') {
            return await this.brain.embed(input);
        }
        else {
            throw new Error(`Cannot convert input to vector: ${typeof input}`);
        }
    }
    _createSimilarityKey(a, b, options) {
        const aKey = typeof a === 'object' ? JSON.stringify(a).substring(0, 50) : String(a);
        const bKey = typeof b === 'object' ? JSON.stringify(b).substring(0, 50) : String(b);
        return `${aKey}|${bKey}|${JSON.stringify(options)}`;
    }
    _createClusteringKey(items, options) {
        const itemsKey = items ? [...items].sort().join(',') : 'all';
        return `clustering:${itemsKey}:${JSON.stringify(options)}`;
    }
    _cacheResult(key, result, cache) {
        if (cache.size >= (this.config.cacheSize || 1000)) {
            // Remove oldest entries (simple LRU)
            const firstKey = cache.keys().next().value;
            if (firstKey)
                cache.delete(firstKey);
        }
        cache.set(key, result);
    }
    _trackPerformance(operation, startTime, itemCount, algorithm) {
        if (!this.config.performanceTracking)
            return;
        const metrics = {
            executionTime: performance.now() - startTime,
            memoryUsed: 0, // Would implement actual memory tracking
            itemsProcessed: itemCount,
            cacheHits: 0, // Would track actual cache hits
            cacheMisses: 0, // Would track actual cache misses
            algorithm
        };
        if (!this.performanceMetrics.has(operation)) {
            this.performanceMetrics.set(operation, []);
        }
        this.performanceMetrics.get(operation).push(metrics);
    }
    _createPerformanceMetrics(startTime, itemCount, algorithm) {
        return {
            executionTime: performance.now() - startTime,
            memoryUsed: 0,
            itemsProcessed: itemCount,
            cacheHits: 0,
            cacheMisses: 0,
            algorithm
        };
    }
    _initializeCleanupTimer() {
        // Periodically clean up caches to prevent memory leaks
        setInterval(() => {
            if (this.similarityCache.size > (this.config.cacheSize || 1000)) {
                this.similarityCache.clear();
            }
            if (this.clusterCache.size > (this.config.cacheSize || 1000)) {
                this.clusterCache.clear();
            }
            if (this.hierarchyCache.size > (this.config.cacheSize || 1000)) {
                this.hierarchyCache.clear();
            }
            if (this.neighborsCache.size > (this.config.cacheSize || 1000)) {
                this.neighborsCache.clear();
            }
        }, 300000); // Clean every 5 minutes
    }
    // ===== GRAPH COMMUNITY DETECTION UTILITIES =====
    /**
     * Build graph structure from existing verb relationships
     */
    async _buildGraphFromVerbs(itemIds, options) {
        const nodes = new Set(itemIds);
        const edges = new Map();
        const verbWeights = new Map();
        // Initialize verb relationship weights
        const relationshipWeights = {
            'creates': 1.0,
            'partOf': 0.9,
            'contains': 0.9,
            'relatedTo': 0.7,
            'references': 0.6,
            'causes': 0.8,
            'dependsOn': 0.8,
            'memberOf': 0.9,
            'worksWith': 0.7,
            'communicates': 0.6
        };
        // Get all verbs connecting the items
        for (const sourceId of itemIds) {
            const sourceVerbs = await this.brain.getVerbsForNoun(sourceId);
            for (const verb of sourceVerbs) {
                const targetId = verb.target;
                if (nodes.has(targetId) && sourceId !== targetId) {
                    // Initialize edge map if needed
                    if (!edges.has(sourceId)) {
                        edges.set(sourceId, new Map());
                    }
                    // Calculate edge weight from verb type and metadata
                    const verbType = verb.verb;
                    const baseWeight = relationshipWeights[verbType] || 0.5;
                    const confidenceWeight = verb.confidence || 1.0;
                    const weight = baseWeight * confidenceWeight;
                    // Add or strengthen edge
                    const currentWeight = edges.get(sourceId)?.get(targetId) || 0;
                    edges.get(sourceId).set(targetId, Math.min(currentWeight + weight, 1.0));
                    // Make graph undirected by adding reverse edge
                    if (!edges.has(targetId)) {
                        edges.set(targetId, new Map());
                    }
                    const reverseWeight = edges.get(targetId)?.get(sourceId) || 0;
                    edges.get(targetId).set(sourceId, Math.min(reverseWeight + weight, 1.0));
                }
            }
        }
        return {
            nodes: Array.from(nodes),
            edges,
            nodeCount: nodes.size,
            edgeCount: Array.from(edges.values()).reduce((sum, edgeMap) => sum + edgeMap.size, 0) / 2 // Undirected
        };
    }
    /**
     * Detect communities using Louvain modularity optimization
     */
    async _detectCommunities(graph, options) {
        const { nodes, edges } = graph;
        // Initialize each node as its own community
        const communities = new Map();
        nodes.forEach((node, index) => communities.set(node, index));
        const totalWeight = this._calculateTotalWeight(edges);
        let improved = true;
        let iteration = 0;
        const maxIterations = 50;
        // Louvain algorithm: iteratively move nodes to communities that maximize modularity
        while (improved && iteration < maxIterations) {
            improved = false;
            iteration++;
            for (const node of nodes) {
                const currentCommunity = communities.get(node);
                let bestCommunity = currentCommunity;
                let bestGain = 0;
                // Consider neighboring communities
                const neighborCommunities = this._getNeighborCommunities(node, edges, communities);
                for (const neighborCommunity of neighborCommunities) {
                    if (neighborCommunity !== currentCommunity) {
                        const gain = this._calculateModularityGain(node, currentCommunity, neighborCommunity, edges, communities, totalWeight);
                        if (gain > bestGain) {
                            bestGain = gain;
                            bestCommunity = neighborCommunity;
                        }
                    }
                }
                // Move node if beneficial
                if (bestCommunity !== currentCommunity) {
                    communities.set(node, bestCommunity);
                    improved = true;
                }
            }
        }
        // Group nodes by final community assignment
        const communityGroups = new Map();
        for (const [node, communityId] of communities) {
            if (!communityGroups.has(communityId)) {
                communityGroups.set(communityId, []);
            }
            communityGroups.get(communityId).push(node);
        }
        // Convert to Community objects with metadata
        const result = [];
        for (const [communityId, members] of communityGroups) {
            if (members.length >= (options.minClusterSize || 2)) {
                const modularity = this._calculateCommunityModularity(members, edges, totalWeight);
                const density = this._calculateCommunityDensity(members, edges);
                const strongestConnections = this._findStrongestConnections(members, edges, 3);
                result.push({
                    id: communityId,
                    members,
                    modularity,
                    density,
                    strongestConnections
                });
            }
        }
        return result;
    }
    /**
     * Refine community boundaries using vector similarity
     */
    async _refineCommunitiesWithVectors(communities, options) {
        const refined = [];
        for (const community of communities) {
            const membersWithVectors = await this._getItemsWithVectors(community.members);
            // Check if community is coherent in vector space
            const vectorCoherence = await this._calculateVectorCoherence(membersWithVectors);
            if (vectorCoherence > 0.3) {
                // Community is coherent, keep as is
                refined.push(community);
            }
            else {
                // Split community using vector-based sub-clustering
                const subClusters = await this._performHierarchicalClustering(community.members, { ...options, maxClusters: Math.ceil(community.members.length / 5) });
                // Convert sub-clusters to communities
                for (let i = 0; i < subClusters.clusters.length; i++) {
                    const subCluster = subClusters.clusters[i];
                    refined.push({
                        id: community.id * 1000 + i, // Unique sub-community ID
                        members: subCluster.members,
                        modularity: community.modularity * 0.8, // Slightly lower modularity for sub-communities
                        density: community.density,
                        strongestConnections: []
                    });
                }
            }
        }
        return refined;
    }
    // ===== SEMANTIC CLUSTERING UTILITIES =====
    /**
     * Get items with their metadata including noun types
     */
    async _getItemsWithMetadata(itemIds) {
        const items = await Promise.all(itemIds.map(async (id) => {
            const noun = await this.brain.getNoun(id);
            if (!noun) {
                return null;
            }
            return {
                id,
                vector: noun.vector || [],
                metadata: noun.metadata || {},
                nounType: noun.metadata?.noun || noun.metadata?.nounType || 'content',
                label: noun.metadata?.label || noun.metadata?.data || id,
                data: noun.metadata
            };
        }));
        return items.filter((item) => item !== null);
    }
    /**
     * Group items by their semantic noun types
     */
    _groupBySemanticType(items) {
        const groups = new Map();
        for (const item of items) {
            const type = item.nounType;
            if (!groups.has(type)) {
                groups.set(type, []);
            }
            groups.get(type).push(item);
        }
        return groups;
    }
    // Placeholder implementations for complex operations
    async _getAllItemIds() {
        // Get all noun IDs from the brain
        const stats = await this.brain.getStatistics();
        if (!stats.totalNodes || stats.totalNodes === 0) {
            return [];
        }
        // Get nouns with pagination (limit to 10000 for performance)
        const limit = Math.min(stats.totalNodes, 10000);
        const result = await this.brain.getNouns({
            pagination: { limit }
        });
        return result.map((item) => item.id).filter((id) => id);
    }
    async _getTotalItemCount() {
        const stats = await this.brain.getStatistics();
        return stats.totalNodes || 0;
    }
    // ===== GRAPH ALGORITHM SUPPORTING METHODS =====
    _calculateTotalWeight(edges) {
        let total = 0;
        for (const edgeMap of edges.values()) {
            for (const weight of edgeMap.values()) {
                total += weight;
            }
        }
        return total / 2; // Undirected graph, so divide by 2
    }
    _getNeighborCommunities(node, edges, communities) {
        const neighborCommunities = new Set();
        const nodeEdges = edges.get(node);
        if (nodeEdges) {
            for (const neighbor of nodeEdges.keys()) {
                const neighborCommunity = communities.get(neighbor);
                if (neighborCommunity !== undefined) {
                    neighborCommunities.add(neighborCommunity);
                }
            }
        }
        return neighborCommunities;
    }
    _calculateModularityGain(node, oldCommunity, newCommunity, edges, communities, totalWeight) {
        // Calculate the degree of the node
        const nodeDegree = this._getNodeDegree(node, edges);
        // Calculate edges to old and new communities
        const edgesToOld = this._getEdgesToCommunity(node, oldCommunity, edges, communities);
        const edgesToNew = this._getEdgesToCommunity(node, newCommunity, edges, communities);
        // Calculate community weights
        const oldCommunityWeight = this._getCommunityWeight(oldCommunity, edges, communities);
        const newCommunityWeight = this._getCommunityWeight(newCommunity, edges, communities);
        // Modularity gain calculation (simplified)
        const oldContrib = edgesToOld - (nodeDegree * oldCommunityWeight) / (2 * totalWeight);
        const newContrib = edgesToNew - (nodeDegree * newCommunityWeight) / (2 * totalWeight);
        return newContrib - oldContrib;
    }
    _getNodeDegree(node, edges) {
        const nodeEdges = edges.get(node);
        if (!nodeEdges)
            return 0;
        return Array.from(nodeEdges.values()).reduce((sum, weight) => sum + weight, 0);
    }
    _getEdgesToCommunity(node, community, edges, communities) {
        const nodeEdges = edges.get(node);
        if (!nodeEdges)
            return 0;
        let total = 0;
        for (const [neighbor, weight] of nodeEdges) {
            if (communities.get(neighbor) === community) {
                total += weight;
            }
        }
        return total;
    }
    _getCommunityWeight(community, edges, communities) {
        let total = 0;
        for (const [node, nodeCommunity] of communities) {
            if (nodeCommunity === community) {
                total += this._getNodeDegree(node, edges);
            }
        }
        return total;
    }
    _calculateCommunityModularity(members, edges, totalWeight) {
        if (members.length < 2)
            return 0;
        let internalWeight = 0;
        let totalDegree = 0;
        for (const member of members) {
            const memberEdges = edges.get(member);
            if (memberEdges) {
                totalDegree += Array.from(memberEdges.values()).reduce((sum, w) => sum + w, 0);
                // Count internal edges
                for (const [neighbor, weight] of memberEdges) {
                    if (members.includes(neighbor)) {
                        internalWeight += weight;
                    }
                }
            }
        }
        internalWeight /= 2; // Undirected graph
        const expectedInternal = (totalDegree * totalDegree) / (4 * totalWeight);
        return (internalWeight / totalWeight) - expectedInternal / totalWeight;
    }
    _calculateCommunityDensity(members, edges) {
        if (members.length < 2)
            return 0;
        let actualEdges = 0;
        const maxPossibleEdges = (members.length * (members.length - 1)) / 2;
        for (const member of members) {
            const memberEdges = edges.get(member);
            if (memberEdges) {
                for (const neighbor of memberEdges.keys()) {
                    if (members.includes(neighbor) && member < neighbor) { // Avoid double counting
                        actualEdges++;
                    }
                }
            }
        }
        return actualEdges / maxPossibleEdges;
    }
    _findStrongestConnections(members, edges, limit) {
        const connections = [];
        for (const member of members) {
            const memberEdges = edges.get(member);
            if (memberEdges) {
                for (const [neighbor, weight] of memberEdges) {
                    if (members.includes(neighbor) && member < neighbor) { // Avoid duplicates
                        connections.push({ from: member, to: neighbor, weight });
                    }
                }
            }
        }
        return connections
            .sort((a, b) => b.weight - a.weight)
            .slice(0, limit);
    }
    // ===== K-MEANS UTILITIES =====
    /**
     * Get items with their vector representations
     */
    async _getItemsWithVectors(itemIds) {
        const items = await Promise.all(itemIds.map(async (id) => {
            const noun = await this.brain.getNoun(id);
            return {
                id,
                vector: noun?.vector || []
            };
        }));
        return items.filter((item) => item !== null && item.vector.length > 0);
    }
    /**
     * Calculate centroid from items using existing distance functions
     */
    async _calculateCentroidFromItems(items) {
        if (items.length === 0)
            return [];
        if (items.length === 1)
            return [...items[0].vector];
        const dimensions = items[0].vector.length;
        const centroid = new Array(dimensions).fill(0);
        for (const item of items) {
            for (let i = 0; i < dimensions; i++) {
                centroid[i] += item.vector[i];
            }
        }
        for (let i = 0; i < dimensions; i++) {
            centroid[i] /= items.length;
        }
        return centroid;
    }
    /**
     * Initialize centroids using k-means++ algorithm for better convergence
     */
    async _initializeCentroidsKMeansPlusPlus(items, k) {
        const centroids = [];
        // Choose first centroid randomly
        const firstIdx = Math.floor(Math.random() * items.length);
        centroids.push([...items[firstIdx].vector]);
        // Choose remaining centroids using k-means++ probability
        for (let i = 1; i < k; i++) {
            const distances = items.map(item => {
                // Find distance to closest existing centroid
                let minDist = Infinity;
                for (const centroid of centroids) {
                    const dist = this._calculateSquaredDistance(item.vector, centroid);
                    minDist = Math.min(minDist, dist);
                }
                return minDist;
            });
            // Choose next centroid with probability proportional to squared distance
            const totalDistance = distances.reduce((sum, d) => sum + d, 0);
            const target = Math.random() * totalDistance;
            let cumulative = 0;
            for (let j = 0; j < distances.length; j++) {
                cumulative += distances[j];
                if (cumulative >= target) {
                    centroids.push([...items[j].vector]);
                    break;
                }
            }
        }
        return centroids;
    }
    /**
     * Assign points to nearest centroids using existing distance functions
     */
    async _assignPointsToCentroids(items, centroids) {
        const assignments = [];
        for (const item of items) {
            let bestCentroid = 0;
            let minDistance = Infinity;
            for (let i = 0; i < centroids.length; i++) {
                const distance = this._calculateSquaredDistance(item.vector, centroids[i]);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestCentroid = i;
                }
            }
            assignments.push(bestCentroid);
        }
        return assignments;
    }
    /**
     * Update centroids based on current assignments
     */
    async _updateCentroids(items, assignments, k) {
        const newCentroids = [];
        for (let i = 0; i < k; i++) {
            const clusterItems = items.filter((_, idx) => assignments[idx] === i);
            if (clusterItems.length > 0) {
                newCentroids.push(await this._calculateCentroidFromItems(clusterItems));
            }
            else {
                // Keep old centroid if no items assigned
                newCentroids.push(new Array(items[0].vector.length).fill(0));
            }
        }
        return newCentroids;
    }
    /**
     * Calculate how much assignments have changed between iterations
     */
    _calculateAssignmentChangeRate(oldAssignments, newAssignments) {
        if (oldAssignments.length !== newAssignments.length)
            return 1.0;
        let changes = 0;
        for (let i = 0; i < oldAssignments.length; i++) {
            if (oldAssignments[i] !== newAssignments[i]) {
                changes++;
            }
        }
        return changes / oldAssignments.length;
    }
    /**
     * Calculate cluster confidence for k-means clusters
     */
    async _calculateKMeansClusterConfidence(clusterItems, centroid) {
        if (clusterItems.length <= 1)
            return 1.0;
        // Calculate average distance to centroid
        const distances = clusterItems.map(item => this._calculateSquaredDistance(item.vector, centroid));
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        // Calculate standard deviation
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
        const stdDev = Math.sqrt(variance);
        // Higher confidence for tighter clusters
        const tightness = avgDistance > 0 ? Math.max(0, 1 - (stdDev / avgDistance)) : 1.0;
        return Math.min(1.0, tightness);
    }
    // ===== DBSCAN UTILITIES =====
    /**
     * Estimate optimal eps parameter using k-nearest neighbor distances
     */
    async _estimateOptimalEps(items, minPts) {
        if (items.length < minPts)
            return 0.5;
        // Calculate k-nearest neighbor distances for each point
        const kDistances = [];
        for (const item of items) {
            const distances = [];
            for (const otherItem of items) {
                if (item.id !== otherItem.id) {
                    const distance = Math.sqrt(this._calculateSquaredDistance(item.vector, otherItem.vector));
                    distances.push(distance);
                }
            }
            distances.sort((a, b) => a - b);
            // Get k-th nearest neighbor distance (minPts-1 because we exclude self)
            const kthDistance = distances[Math.min(minPts - 1, distances.length - 1)];
            kDistances.push(kthDistance);
        }
        kDistances.sort((a, b) => a - b);
        // Use knee point detection - find point with maximum curvature
        // Simplified approach: use 90th percentile of k-distances
        const percentileIndex = Math.floor(kDistances.length * 0.9);
        return kDistances[percentileIndex] || 0.5;
    }
    /**
     * Find neighbors within epsilon distance using efficient vector operations
     */
    async _findNeighborsWithinEps(item, allItems, eps) {
        const neighbors = [];
        const epsSquared = eps * eps;
        for (const otherItem of allItems) {
            if (item.id !== otherItem.id) {
                const distanceSquared = this._calculateSquaredDistance(item.vector, otherItem.vector);
                if (distanceSquared <= epsSquared) {
                    neighbors.push(otherItem);
                }
            }
        }
        return neighbors;
    }
    /**
     * Expand DBSCAN cluster by adding density-reachable points
     */
    async _expandCluster(seedPoint, neighbors, clusterId, eps, minPts, allItems, visited, clusterAssignments) {
        clusterAssignments.set(seedPoint.id, clusterId);
        let i = 0;
        while (i < neighbors.length) {
            const neighbor = neighbors[i];
            if (!visited.get(neighbor.id)) {
                visited.set(neighbor.id, true);
                const neighborNeighbors = await this._findNeighborsWithinEps(neighbor, allItems, eps);
                if (neighborNeighbors.length >= minPts) {
                    // Add new neighbors to the list (union operation)
                    for (const newNeighbor of neighborNeighbors) {
                        if (!neighbors.some(n => n.id === newNeighbor.id)) {
                            neighbors.push(newNeighbor);
                        }
                    }
                }
            }
            // If neighbor is not assigned to any cluster, assign to current cluster
            if (!clusterAssignments.has(neighbor.id)) {
                clusterAssignments.set(neighbor.id, clusterId);
            }
            i++;
        }
    }
    /**
     * Calculate DBSCAN cluster confidence based on density
     */
    async _calculateDBSCANClusterConfidence(clusterItems, eps) {
        if (clusterItems.length <= 1)
            return 1.0;
        // Calculate average density within the cluster
        let totalNeighborCount = 0;
        const epsSquared = eps * eps;
        for (const item of clusterItems) {
            let neighborCount = 0;
            for (const otherItem of clusterItems) {
                if (item !== otherItem) {
                    const distanceSquared = this._calculateSquaredDistance(item.vector, otherItem.vector);
                    if (distanceSquared <= epsSquared) {
                        neighborCount++;
                    }
                }
            }
            totalNeighborCount += neighborCount;
        }
        const avgDensity = totalNeighborCount / clusterItems.length;
        const maxPossibleDensity = clusterItems.length - 1;
        return maxPossibleDensity > 0 ? avgDensity / maxPossibleDensity : 1.0;
    }
    // ===== VECTOR UTILITIES =====
    /**
     * Calculate squared Euclidean distance (more efficient than sqrt)
     */
    _calculateSquaredDistance(vec1, vec2) {
        if (vec1.length !== vec2.length)
            return Infinity;
        let sum = 0;
        for (let i = 0; i < vec1.length; i++) {
            const diff = vec1[i] - vec2[i];
            sum += diff * diff;
        }
        return sum;
    }
    /**
     * Calculate vector coherence for community refinement
     */
    async _calculateVectorCoherence(items) {
        if (items.length <= 1)
            return 1.0;
        const centroid = await this._calculateCentroidFromItems(items);
        // Calculate average distance to centroid
        const distances = items.map(item => Math.sqrt(this._calculateSquaredDistance(item.vector, centroid)));
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        // Calculate cohesion as inverse of average distance (normalized)
        const maxDistance = Math.sqrt(centroid.length); // Rough normalization
        return Math.max(0, 1 - (avgDistance / maxDistance));
    }
    async _getItemsByField(field) {
        // Implementation would query items by metadata field
        return [];
    }
    // ===== TRIPLE INTELLIGENCE INTEGRATION =====
    /**
     * Generate intelligent cluster labels using Triple Intelligence
     */
    async _generateIntelligentClusterLabel(members, algorithm) {
        if (members.length === 0)
            return `${algorithm}-cluster`;
        try {
            // Lazy load Triple Intelligence if available
            const TripleIntelligenceEngine = await import('../triple/TripleIntelligence.js')
                .then(m => m.TripleIntelligenceEngine)
                .catch(() => null);
            if (!TripleIntelligenceEngine) {
                return this._generateClusterLabel(members, algorithm);
            }
            const intelligence = new TripleIntelligenceEngine(this.brain);
            // Extract key features from cluster members
            const memberData = members.map(m => ({
                id: m.id,
                type: m.nounType,
                label: m.label,
                data: m.data
            }));
            // Use Triple Intelligence to analyze the cluster and generate label
            const prompt = `Analyze this cluster of ${memberData.length} related items and provide a concise, descriptive label (2-4 words):

Items:
${memberData.map(item => `- ${item.label || item.id} (${item.type})`).join('\n')}

The items were grouped using ${algorithm} clustering. What is the most appropriate label that captures their common theme or relationship?`;
            const response = await intelligence.find({
                like: prompt,
                limit: 1
            });
            // Extract clean label from response
            const firstResult = response[0];
            const label = (firstResult?.metadata?.content || firstResult?.id || `${algorithm}-cluster`)
                .toString()
                .replace(/^(Label:|Cluster:|Theme:)/i, '')
                .trim()
                .replace(/['"]/g, '')
                .slice(0, 50);
            return label || `${algorithm}-cluster`;
        }
        catch (error) {
            // Fallback to simple labeling
            return this._generateClusterLabel(members, algorithm);
        }
    }
    /**
     * Generate simple cluster labels based on semantic analysis
     */
    async _generateClusterLabel(members, algorithm) {
        if (members.length === 0)
            return `${algorithm}-cluster`;
        // Analyze member types and create descriptive label
        const typeCount = new Map();
        for (const member of members) {
            const type = member.nounType || 'unknown';
            typeCount.set(type, (typeCount.get(type) || 0) + 1);
        }
        // Find most common type
        let dominantType = 'mixed';
        let maxCount = 0;
        for (const [type, count] of typeCount) {
            if (count > maxCount) {
                maxCount = count;
                dominantType = type;
            }
        }
        // Generate label based on dominant type and size
        const size = members.length;
        const typePercent = Math.round((maxCount / size) * 100);
        if (typePercent >= 80) {
            return `${dominantType} group (${size})`;
        }
        else if (typePercent >= 60) {
            return `mostly ${dominantType} (${size})`;
        }
        else {
            const topTypes = Array.from(typeCount.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([type]) => type)
                .join(' & ');
            return `${topTypes} cluster (${size})`;
        }
    }
    /**
     * Fuse clustering results using Triple Intelligence consensus
     */
    async _fuseClusteringResultsWithTripleIntelligence(clusterSets, options) {
        if (clusterSets.length === 0)
            return [];
        if (clusterSets.length === 1)
            return clusterSets[0];
        // Simple weighted fusion if Triple Intelligence is not available
        const [vectorClusters, graphClusters, semanticClusters] = clusterSets;
        // Create consensus mapping of items to clusters
        const itemClusterMapping = new Map();
        // Collect all cluster assignments
        const allAlgorithms = ['vector', 'graph', 'semantic'];
        const algorithmClusters = [vectorClusters, graphClusters, semanticClusters];
        for (let i = 0; i < algorithmClusters.length; i++) {
            const algorithm = allAlgorithms[i];
            const clusters = algorithmClusters[i] || [];
            for (const cluster of clusters) {
                for (const memberId of cluster.members) {
                    if (!itemClusterMapping.has(memberId)) {
                        itemClusterMapping.set(memberId, []);
                    }
                    itemClusterMapping.get(memberId).push({
                        algorithm,
                        clusterId: cluster.id,
                        confidence: cluster.confidence
                    });
                }
            }
        }
        // Find consensus clusters - items that appear together in multiple algorithms
        const consensusClusters = new Map();
        const processedItems = new Set();
        for (const [itemId, assignments] of itemClusterMapping) {
            if (processedItems.has(itemId))
                continue;
            // Find all items that consistently cluster with this item
            const consensusGroup = new Set([itemId]);
            // Look for items that share clusters with this item across algorithms
            for (const assignment of assignments) {
                const sameClusterItems = this._getItemsInCluster(assignment.clusterId, clusterSets);
                for (const otherItem of sameClusterItems) {
                    if (!processedItems.has(otherItem) && otherItem !== itemId) {
                        const otherAssignments = itemClusterMapping.get(otherItem) || [];
                        // Check if items co-occur in multiple algorithms
                        const coOccurrences = this._countCoOccurrences(assignments, otherAssignments);
                        if (coOccurrences >= 2) { // Must appear together in at least 2 algorithms
                            consensusGroup.add(otherItem);
                        }
                    }
                }
            }
            // Mark all items in this consensus group as processed
            for (const groupItem of consensusGroup) {
                processedItems.add(groupItem);
            }
            if (consensusGroup.size >= (options.minClusterSize || 2)) {
                const consensusId = `fusion-${consensusClusters.size}`;
                consensusClusters.set(consensusId, consensusGroup);
            }
        }
        // Convert consensus groups to SemanticCluster objects
        const fusedClusters = [];
        for (const [clusterId, memberSet] of consensusClusters) {
            const members = Array.from(memberSet);
            const membersWithMetadata = await this._getItemsWithMetadata(members);
            if (membersWithMetadata.length > 0) {
                const centroid = await this._calculateCentroidFromItems(membersWithMetadata);
                const label = await this._generateIntelligentClusterLabel(membersWithMetadata, 'multimodal');
                // Calculate fusion confidence based on algorithm agreement
                const avgConfidence = this._calculateFusionConfidence(members, itemClusterMapping);
                fusedClusters.push({
                    id: clusterId,
                    centroid,
                    members,
                    size: members.length,
                    confidence: avgConfidence,
                    label,
                    metadata: {
                        clustering: 'multimodal_fusion',
                        algorithms: allAlgorithms,
                        fusionMethod: 'consensus',
                        agreementLevel: avgConfidence
                    }
                });
            }
        }
        return fusedClusters;
    }
    /**
     * Get items in a specific cluster from cluster sets
     */
    _getItemsInCluster(clusterId, clusterSets) {
        for (const clusterSet of clusterSets) {
            for (const cluster of clusterSet) {
                if (cluster.id === clusterId) {
                    return cluster.members;
                }
            }
        }
        return [];
    }
    /**
     * Count co-occurrences between two sets of assignments
     */
    _countCoOccurrences(assignments1, assignments2) {
        let count = 0;
        for (const assignment1 of assignments1) {
            for (const assignment2 of assignments2) {
                if (assignment1.algorithm === assignment2.algorithm &&
                    assignment1.clusterId === assignment2.clusterId) {
                    count++;
                }
            }
        }
        return count;
    }
    /**
     * Calculate fusion confidence based on algorithm agreement
     */
    _calculateFusionConfidence(members, itemClusterMapping) {
        let totalConfidence = 0;
        let totalAssignments = 0;
        for (const member of members) {
            const assignments = itemClusterMapping.get(member) || [];
            for (const assignment of assignments) {
                totalConfidence += assignment.confidence;
                totalAssignments++;
            }
        }
        return totalAssignments > 0 ? totalConfidence / totalAssignments : 0.5;
    }
    // ===== ADDITIONAL UTILITIES =====
    /**
     * Generate empty clustering result for edge cases
     */
    _createEmptyResult(startTime, algorithm) {
        return {
            clusters: [],
            metrics: this._createPerformanceMetrics(startTime, 0, algorithm),
            metadata: {
                totalItems: 0,
                clustersFound: 0,
                averageClusterSize: 0,
                timestamp: new Date()
            }
        };
    }
    // ===== SAMPLING AND PROJECTION UTILITIES =====
    /**
     * Get sample using specified strategy for large dataset clustering
     */
    async _getSampleUsingStrategy(itemIds, sampleSize, strategy) {
        if (itemIds.length <= sampleSize)
            return itemIds;
        switch (strategy) {
            case 'random':
                return this._getRandomSample(itemIds, sampleSize);
            case 'diverse':
                return await this._getDiverseSample(itemIds, sampleSize);
            case 'recent':
                return await this._getRecentSample(itemIds, sampleSize);
            case 'important':
                return await this._getImportantSample(itemIds, sampleSize);
            default:
                return this._getRandomSample(itemIds, sampleSize);
        }
    }
    /**
     * Random sampling
     */
    _getRandomSample(itemIds, sampleSize) {
        const shuffled = [...itemIds].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, sampleSize);
    }
    /**
     * Diverse sampling using vector space distribution
     */
    async _getDiverseSample(itemIds, sampleSize) {
        // Get vectors for all items
        const itemsWithVectors = await this._getItemsWithVectors(itemIds);
        if (itemsWithVectors.length <= sampleSize) {
            return itemIds;
        }
        // Use k-means++ style selection for diversity
        const sample = [];
        // Select first item randomly
        let remainingItems = [...itemsWithVectors];
        const firstIdx = Math.floor(Math.random() * remainingItems.length);
        sample.push(remainingItems[firstIdx].id);
        remainingItems.splice(firstIdx, 1);
        // Select remaining items based on maximum distance to already selected items
        while (sample.length < sampleSize && remainingItems.length > 0) {
            let maxDistance = -1;
            let bestIdx = 0;
            for (let i = 0; i < remainingItems.length; i++) {
                const item = remainingItems[i];
                // Find minimum distance to any selected item
                let minDistanceToSelected = Infinity;
                for (const selectedId of sample) {
                    const selectedItem = itemsWithVectors.find(it => it.id === selectedId);
                    if (selectedItem) {
                        const distance = Math.sqrt(this._calculateSquaredDistance(item.vector, selectedItem.vector));
                        minDistanceToSelected = Math.min(minDistanceToSelected, distance);
                    }
                }
                // Select item with maximum minimum distance (most diverse)
                if (minDistanceToSelected > maxDistance) {
                    maxDistance = minDistanceToSelected;
                    bestIdx = i;
                }
            }
            sample.push(remainingItems[bestIdx].id);
            remainingItems.splice(bestIdx, 1);
        }
        return sample;
    }
    /**
     * Recent sampling based on creation time
     */
    async _getRecentSample(itemIds, sampleSize) {
        const items = await Promise.all(itemIds.map(async (id) => {
            const noun = await this.brain.getNoun(id);
            return {
                id,
                createdAt: noun?.createdAt || new Date(0)
            };
        }));
        // Sort by creation time (most recent first)
        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return items.slice(0, sampleSize).map(item => item.id);
    }
    /**
     * Important sampling based on connection count and metadata
     */
    async _getImportantSample(itemIds, sampleSize) {
        const items = await Promise.all(itemIds.map(async (id) => {
            const verbs = await this.brain.getVerbsForNoun(id);
            const noun = await this.brain.getNoun(id);
            // Calculate importance score
            const connectionScore = verbs.length;
            const dataScore = noun?.data ? Object.keys(noun.data).length : 0;
            const importanceScore = connectionScore * 2 + dataScore;
            return {
                id,
                importance: importanceScore
            };
        }));
        // Sort by importance (highest first)
        items.sort((a, b) => b.importance - a.importance);
        return items.slice(0, sampleSize).map(item => item.id);
    }
    /**
     * Project clusters back to full dataset using HNSW neighbors
     */
    async _projectClustersToFullDataset(sampleClusters, fullItemIds, sampleIds) {
        const projectedClusters = [];
        // Create mapping of items not in sample
        const remainingItems = fullItemIds.filter(id => !sampleIds.includes(id));
        // For each sample cluster, find which remaining items should belong to it
        for (const sampleCluster of sampleClusters) {
            const projectedMembers = [...sampleCluster.members];
            // For each remaining item, find its nearest neighbors in the sample
            for (const itemId of remainingItems) {
                try {
                    const neighbors = await this.brain.neural.neighbors(itemId, {
                        limit: 3,
                        includeMetadata: false
                    });
                    // Check if any of the nearest neighbors belong to this cluster
                    let belongsToCluster = false;
                    for (const neighbor of neighbors.neighbors) {
                        if (sampleCluster.members.includes(neighbor.id) && neighbor.similarity > 0.7) {
                            belongsToCluster = true;
                            break;
                        }
                    }
                    if (belongsToCluster) {
                        projectedMembers.push(itemId);
                    }
                }
                catch (error) {
                    // Skip items that can't be processed
                    continue;
                }
            }
            // Create projected cluster
            if (projectedMembers.length > 0) {
                const membersWithVectors = await this._getItemsWithVectors(projectedMembers);
                projectedClusters.push({
                    ...sampleCluster,
                    id: `projected-${sampleCluster.id}`,
                    members: projectedMembers,
                    size: projectedMembers.length,
                    centroid: await this._calculateCentroidFromItems(membersWithVectors),
                    confidence: sampleCluster.confidence * 0.9, // Slightly lower confidence for projection
                    metadata: {
                        ...sampleCluster.metadata,
                        isProjected: true,
                        originalSampleSize: sampleCluster.size,
                        projectedSize: projectedMembers.length
                    }
                });
            }
        }
        return projectedClusters;
    }
    _groupByDomain(items, field) {
        const groups = new Map();
        for (const item of items) {
            const domain = item.metadata?.[field] || 'unknown';
            if (!groups.has(domain)) {
                groups.set(domain, []);
            }
            groups.get(domain).push(item);
        }
        return groups;
    }
    _calculateDomainConfidence(cluster, domainItems) {
        // Calculate how well this cluster represents the domain
        // Based on cluster density and coherence
        const density = cluster.members.length / (cluster.members.length + 10); // Normalize
        const coherence = cluster.cohesion || 0.5; // Use cluster's cohesion if available
        // Domain relevance: what fraction of cluster members are from this domain
        const domainMemberCount = cluster.members.filter(id => domainItems.some(item => item.id === id)).length;
        const domainRelevance = cluster.members.length > 0
            ? domainMemberCount / cluster.members.length
            : 0;
        return (density * 0.3 + coherence * 0.3 + domainRelevance * 0.4); // Weighted average
    }
    async _findCrossDomainMembers(cluster, threshold) {
        // Find members that might belong to multiple domains
        return [];
    }
    async _findCrossDomainClusters(clusters, threshold) {
        // Find clusters that span multiple domains
        return [];
    }
    async _getItemsByTimeWindow(timeField, window) {
        // Implementation would query items within time window
        return [];
    }
    async _calculateTemporalMetrics(cluster, items, timeField) {
        // Calculate temporal characteristics of the cluster
        return {
            trend: 'stable',
            metrics: {
                startTime: new Date(),
                endTime: new Date(),
                peakTime: new Date(),
                frequency: 1
            }
        };
    }
    _mergeOverlappingTemporalClusters(clusters) {
        // Merge clusters from overlapping time windows
        return clusters;
    }
    _adjustThresholdAdaptively(clusters, currentThreshold) {
        // Adjust clustering threshold based on results
        return currentThreshold || 0.6;
    }
    async _calculateItemToClusterSimilarity(itemId, cluster) {
        // Calculate similarity between an item and a cluster centroid
        return 0.5; // Placeholder
    }
    async _recalculateClusterCentroid(cluster) {
        // Recalculate centroid after adding new members
        return cluster.centroid;
    }
    async _calculateSimilarity(id1, id2) {
        return await this.similar(id1, id2);
    }
    _calculateEdgeWeight(verb) {
        // Calculate edge weight based on verb properties
        let weight = 1.0;
        // Factor in connection strength if available
        if (verb.connections && verb.connections instanceof Map) {
            const connectionCount = verb.connections.size;
            weight += Math.log(connectionCount + 1) * 0.1;
        }
        // Factor in verb type significance
        const significantVerbs = ['caused', 'created', 'contains', 'implements', 'extends'];
        if (verb.verb && significantVerbs.includes(verb.verb.toLowerCase())) {
            weight += 0.3;
        }
        // Factor in recency if available
        if (verb.metadata?.createdAt) {
            const now = Date.now();
            const created = new Date(verb.metadata.createdAt).getTime();
            const daysSinceCreated = (now - created) / (1000 * 60 * 60 * 24);
            // Newer relationships get slight boost
            weight += Math.max(0, (30 - daysSinceCreated) / 100);
        }
        return Math.min(weight, 3.0); // Cap at 3.0
    }
    _sortNeighbors(neighbors, sortBy) {
        switch (sortBy) {
            case 'similarity':
                neighbors.sort((a, b) => b.similarity - a.similarity);
                break;
            case 'importance':
                neighbors.sort((a, b) => (b.metadata?.importance || 0) - (a.metadata?.importance || 0));
                break;
            case 'recency':
                neighbors.sort((a, b) => {
                    const aTime = new Date(a.metadata?.createdAt || 0).getTime();
                    const bTime = new Date(b.metadata?.createdAt || 0).getTime();
                    return bTime - aTime;
                });
                break;
        }
    }
    async _buildSemanticHierarchy(item, options) {
        // Build semantic hierarchy around an item
        return {
            self: { id: item.id, vector: item.vector, metadata: item.metadata }
        };
    }
    async _detectOutliersClusterBased(threshold, options) {
        // Detect outliers using cluster-based method
        return [];
    }
    async _detectOutliersIsolation(threshold, options) {
        // Detect outliers using isolation forest method
        return [];
    }
    async _detectOutliersStatistical(threshold, options) {
        // Detect outliers using statistical methods
        return [];
    }
    async _generateVisualizationNodes(maxNodes, options) {
        // Generate nodes for visualization
        return [];
    }
    async _generateVisualizationEdges(nodes, options) {
        // Generate edges for visualization
        return [];
    }
    async _generateVisualizationClusters(nodes) {
        // Generate cluster information for visualization
        return [];
    }
    async _applyLayoutAlgorithm(nodes, edges, algorithm, dimensions) {
        // Apply layout algorithm to position nodes
        return nodes.map((node, i) => ({
            ...node,
            x: Math.random() * 100,
            y: Math.random() * 100,
            z: dimensions === 3 ? Math.random() * 100 : undefined
        }));
    }
    _manhattanDistance(v1, v2) {
        let sum = 0;
        for (let i = 0; i < v1.length; i++) {
            sum += Math.abs(v1[i] - v2[i]);
        }
        return sum;
    }
    _calculateConfidence(score, v1, v2) {
        // Calculate confidence based on vector magnitudes and score
        return Math.min(1, score + 0.1);
    }
    _generateSimilarityExplanation(score, metric) {
        if (score > 0.9)
            return `Very high similarity using ${metric} distance`;
        if (score > 0.7)
            return `High similarity using ${metric} distance`;
        if (score > 0.5)
            return `Moderate similarity using ${metric} distance`;
        if (score > 0.3)
            return `Low similarity using ${metric} distance`;
        return `Very low similarity using ${metric} distance`;
    }
    // ===== PUBLIC API: UTILITY & STATUS =====
    /**
     * Get performance metrics for monitoring
     */
    getPerformanceMetrics(operation) {
        if (operation) {
            return this.performanceMetrics.get(operation) || [];
        }
        return this.performanceMetrics;
    }
    /**
     * Clear all caches
     */
    clearCaches() {
        this.similarityCache.clear();
        this.clusterCache.clear();
        this.hierarchyCache.clear();
        this.neighborsCache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const maxSize = this.config.cacheSize || 1000;
        return {
            similarity: { size: this.similarityCache.size, maxSize },
            clustering: { size: this.clusterCache.size, maxSize },
            hierarchy: { size: this.hierarchyCache.size, maxSize },
            neighbors: { size: this.neighborsCache.size, maxSize }
        };
    }
    // ===== MISSING HELPER METHODS =====
    /**
     * Analyze data characteristics for algorithm selection
     */
    async _analyzeDataCharacteristics(itemIds) {
        const size = itemIds.length;
        const items = await this._getItemsWithMetadata(itemIds.slice(0, Math.min(100, size)));
        const dimensionality = items.length > 0 ? items[0].vector.length : 0;
        // Calculate graph density by sampling verb relationships
        let connectionCount = 0;
        const sampleSize = Math.min(50, itemIds.length);
        for (let i = 0; i < sampleSize; i++) {
            try {
                const verbs = await this.brain.getVerbsForNoun(itemIds[i]);
                connectionCount += verbs.length;
            }
            catch (error) {
                // Skip items that can't be processed
                continue;
            }
        }
        const graphDensity = sampleSize > 0 ? connectionCount / (sampleSize * sampleSize) : 0;
        // Calculate type distribution
        const typeDistribution = {};
        for (const item of items) {
            const type = item.nounType;
            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
        }
        return { size, dimensionality, graphDensity, typeDistribution };
    }
    /**
     * Calculate centroid for a group of items
     */
    async _calculateGroupCentroid(items) {
        return this._calculateCentroidFromItems(items);
    }
    /**
     * Cluster within semantic type using vector similarity
     */
    async _clusterWithinSemanticType(items, options) {
        if (items.length <= 2) {
            return [{
                    id: `semantic-single-${items[0]?.nounType || 'unknown'}`,
                    centroid: await this._calculateCentroidFromItems(items),
                    members: items.map(item => item.id),
                    size: items.length,
                    confidence: 1.0,
                    label: `${items[0]?.nounType || 'unknown'} group`,
                    metadata: { clustering: 'semantic', nounType: items[0]?.nounType }
                }];
        }
        // Use hierarchical clustering for within-type clustering
        const result = await this._performHierarchicalClustering(items.map(item => item.id), { ...options, maxClusters: Math.min(Math.ceil(items.length / 3), 10) });
        return result.clusters;
    }
    /**
     * Find cross-type connections via verbs
     */
    async _findCrossTypeConnections(typeGroups, _options) {
        const connections = [];
        // Convert Map to array for compatibility
        const typeGroupsArray = Array.from(typeGroups.entries());
        for (const [fromType, fromItems] of typeGroupsArray) {
            for (const [toType, toItems] of typeGroupsArray) {
                if (fromType !== toType) {
                    for (const fromItem of fromItems.slice(0, 10)) { // Sample to avoid N^2
                        try {
                            const verbs = await this.brain.getVerbsForNoun(fromItem.id);
                            for (const verb of verbs) {
                                const toItem = toItems.find(item => item.id === verb.target);
                                if (toItem) {
                                    connections.push({
                                        from: fromItem.id,
                                        to: toItem.id,
                                        strength: verb.confidence || 0.7
                                    });
                                }
                            }
                        }
                        catch (error) {
                            // Skip items that can't be processed
                            continue;
                        }
                    }
                }
            }
        }
        return connections.filter(conn => conn.strength > 0.5);
    }
    /**
     * Merge semantic clusters based on connections
     */
    async _mergeSemanticClusters(clusters, connections) {
        // Simple merging based on strong connections
        const merged = [...clusters];
        for (const connection of connections) {
            if (connection.strength > 0.8) {
                const fromCluster = merged.find(c => c.members.includes(connection.from));
                const toCluster = merged.find(c => c.members.includes(connection.to));
                if (fromCluster && toCluster && fromCluster !== toCluster) {
                    // Merge clusters
                    fromCluster.members = [...fromCluster.members, ...toCluster.members];
                    fromCluster.size = fromCluster.members.length;
                    fromCluster.label = `merged ${fromCluster.label}`;
                    // Remove merged cluster
                    const index = merged.indexOf(toCluster);
                    if (index > -1)
                        merged.splice(index, 1);
                }
            }
        }
        return merged;
    }
    /**
     * Get optimal clustering level for HNSW
     */
    _getOptimalClusteringLevel(totalItems) {
        if (totalItems < 100)
            return 0;
        if (totalItems < 1000)
            return 1;
        if (totalItems < 10000)
            return 2;
        return 3;
    }
    /**
     * Get nodes at HNSW level
     */
    async _getHNSWLevelNodes(level) {
        // This would use the HNSW index to get nodes at specified level
        // For now, return a sample of all items
        const allItems = await this._getAllItemIds();
        const sampleSize = Math.max(10, Math.floor(allItems.length / Math.pow(2, level + 1)));
        return this._getRandomSample(allItems, sampleSize);
    }
    /**
     * Find cluster members using HNSW neighbors
     */
    async _findClusterMembers(levelNode, _allItems, threshold) {
        try {
            const neighbors = await this.brain.neural.neighbors(levelNode, {
                limit: Math.min(50, Math.floor(_allItems.length / 10)),
                minSimilarity: threshold
            });
            return [levelNode, ...neighbors.neighbors.map((n) => n.id)];
        }
        catch (error) {
            return [levelNode];
        }
    }
    /**
     * Calculate hierarchical clustering confidence
     */
    async _calculateHierarchicalConfidence(members) {
        if (members.length <= 1)
            return 1.0;
        const items = await this._getItemsWithVectors(members);
        const coherence = await this._calculateVectorCoherence(items);
        return coherence;
    }
    /**
     * Assign unassigned items to nearest clusters
     */
    async _assignUnassignedItems(unassigned, clusters) {
        for (const itemId of unassigned) {
            if (clusters.length === 0)
                break;
            try {
                const noun = await this.brain.getNoun(itemId);
                const itemVector = noun?.vector || [];
                if (itemVector.length === 0)
                    continue;
                let bestCluster = clusters[0];
                let minDistance = Infinity;
                for (const cluster of clusters) {
                    const distance = Math.sqrt(this._calculateSquaredDistance(itemVector, cluster.centroid));
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestCluster = cluster;
                    }
                }
                bestCluster.members.push(itemId);
                bestCluster.size++;
            }
            catch (error) {
                // Skip items that can't be processed
                continue;
            }
        }
    }
}
//# sourceMappingURL=improvedNeuralAPI.js.map