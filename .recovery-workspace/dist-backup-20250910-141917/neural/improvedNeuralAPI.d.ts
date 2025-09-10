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
import { Vector } from '../coreTypes.js';
import { SemanticCluster, DomainCluster, TemporalCluster, EnhancedSemanticCluster, SimilarityOptions, SimilarityResult, NeighborOptions, NeighborsResult, SemanticHierarchy, HierarchyOptions, ClusteringOptions, DomainClusteringOptions, TemporalClusteringOptions, StreamClusteringOptions, VisualizationOptions, VisualizationResult, OutlierOptions, Outlier, StreamingBatch, TimeWindow, PerformanceMetrics, NeuralAPIConfig } from './types.js';
export declare class ImprovedNeuralAPI {
    private brain;
    private config;
    private similarityCache;
    private clusterCache;
    private hierarchyCache;
    private neighborsCache;
    private performanceMetrics;
    constructor(brain: any, config?: NeuralAPIConfig);
    /**
     * Calculate similarity between any two items (auto-detection)
     * Supports: IDs, text strings, vectors, or mixed types
     */
    similar(a: string | Vector | any, b: string | Vector | any, options?: SimilarityOptions): Promise<number | SimilarityResult>;
    /**
     * Intelligent semantic clustering with auto-routing
     * - No input: Cluster all data
     * - Array: Cluster specific items
     * - String: Find clusters near this item
     * - Options object: Advanced configuration
     */
    clusters(input?: string | string[] | ClusteringOptions): Promise<SemanticCluster[]>;
    /**
     * Fast hierarchical clustering using HNSW levels
     */
    clusterFast(options?: {
        level?: number;
        maxClusters?: number;
    }): Promise<SemanticCluster[]>;
    /**
     * Large-scale clustering with intelligent sampling
     */
    clusterLarge(options?: {
        sampleSize?: number;
        strategy?: 'random' | 'diverse' | 'recent';
    }): Promise<SemanticCluster[]>;
    /**
     * Domain-aware clustering based on metadata fields
     */
    clusterByDomain(field: string, options?: DomainClusteringOptions): Promise<DomainCluster[]>;
    /**
     * Temporal clustering based on time windows
     */
    clusterByTime(timeField: string, windows: TimeWindow[], options?: TemporalClusteringOptions): Promise<TemporalCluster[]>;
    /**
     * Streaming clustering with real-time updates
     */
    clusterStream(options?: StreamClusteringOptions): AsyncIterableIterator<StreamingBatch>;
    /**
     * Incremental clustering - add new items to existing clusters
     */
    updateClusters(newItems: string[], options?: ClusteringOptions): Promise<SemanticCluster[]>;
    /**
     * Enhanced clustering with relationship analysis using verbs
     * Returns clusters with intra-cluster and inter-cluster relationship information
     *
     * Scalable for millions of nodes - uses efficient batching and filtering
     */
    clustersWithRelationships(input?: string | string[] | ClusteringOptions, options?: {
        batchSize?: number;
        maxRelationships?: number;
    }): Promise<EnhancedSemanticCluster[]>;
    /**
     * Find K-nearest semantic neighbors
     */
    neighbors(id: string, options?: NeighborOptions): Promise<NeighborsResult>;
    /**
     * Build semantic hierarchy around an item
     */
    hierarchy(id: string, options?: HierarchyOptions): Promise<SemanticHierarchy>;
    /**
     * Detect outliers and anomalous items
     */
    outliers(options?: OutlierOptions): Promise<Outlier[]>;
    /**
     * Generate visualization data for graph libraries
     */
    visualize(options?: VisualizationOptions): Promise<VisualizationResult>;
    private _routeClusteringAlgorithm;
    private _performClustering;
    /**
     * SEMANTIC-AWARE CLUSTERING: Uses existing NounType/VerbType taxonomy + HNSW
     */
    private _performSemanticClustering;
    /**
     * HIERARCHICAL CLUSTERING: Uses existing HNSW levels for O(n) clustering
     */
    private _performHierarchicalClustering;
    /**
     * K-MEANS CLUSTERING: Real implementation using existing distance functions
     */
    private _performKMeansClustering;
    /**
     * DBSCAN CLUSTERING: Density-based clustering with adaptive parameters using HNSW
     */
    private _performDBSCANClustering;
    /**
     * GRAPH COMMUNITY DETECTION: Uses existing verb relationships for clustering
     */
    private _performGraphClustering;
    /**
     * MULTI-MODAL FUSION: Combines vector + graph + semantic + Triple Intelligence
     */
    private _performMultiModalClustering;
    /**
     * SAMPLED CLUSTERING: For very large datasets using intelligent sampling
     */
    private _performSampledClustering;
    private _similarityById;
    private _similarityByVector;
    private _similarityByText;
    private _isId;
    private _isVector;
    private _convertToVector;
    private _createSimilarityKey;
    private _createClusteringKey;
    private _cacheResult;
    private _trackPerformance;
    private _createPerformanceMetrics;
    private _initializeCleanupTimer;
    /**
     * Build graph structure from existing verb relationships
     */
    private _buildGraphFromVerbs;
    /**
     * Detect communities using Louvain modularity optimization
     */
    private _detectCommunities;
    /**
     * Refine community boundaries using vector similarity
     */
    private _refineCommunitiesWithVectors;
    /**
     * Get items with their metadata including noun types
     */
    private _getItemsWithMetadata;
    /**
     * Group items by their semantic noun types
     */
    private _groupBySemanticType;
    private _getAllItemIds;
    private _getTotalItemCount;
    private _calculateTotalWeight;
    private _getNeighborCommunities;
    private _calculateModularityGain;
    private _getNodeDegree;
    private _getEdgesToCommunity;
    private _getCommunityWeight;
    private _calculateCommunityModularity;
    private _calculateCommunityDensity;
    private _findStrongestConnections;
    /**
     * Get items with their vector representations
     */
    private _getItemsWithVectors;
    /**
     * Calculate centroid from items using existing distance functions
     */
    private _calculateCentroidFromItems;
    /**
     * Initialize centroids using k-means++ algorithm for better convergence
     */
    private _initializeCentroidsKMeansPlusPlus;
    /**
     * Assign points to nearest centroids using existing distance functions
     */
    private _assignPointsToCentroids;
    /**
     * Update centroids based on current assignments
     */
    private _updateCentroids;
    /**
     * Calculate how much assignments have changed between iterations
     */
    private _calculateAssignmentChangeRate;
    /**
     * Calculate cluster confidence for k-means clusters
     */
    private _calculateKMeansClusterConfidence;
    /**
     * Estimate optimal eps parameter using k-nearest neighbor distances
     */
    private _estimateOptimalEps;
    /**
     * Find neighbors within epsilon distance using efficient vector operations
     */
    private _findNeighborsWithinEps;
    /**
     * Expand DBSCAN cluster by adding density-reachable points
     */
    private _expandCluster;
    /**
     * Calculate DBSCAN cluster confidence based on density
     */
    private _calculateDBSCANClusterConfidence;
    /**
     * Calculate squared Euclidean distance (more efficient than sqrt)
     */
    private _calculateSquaredDistance;
    /**
     * Calculate vector coherence for community refinement
     */
    private _calculateVectorCoherence;
    private _getItemsByField;
    /**
     * Generate intelligent cluster labels using Triple Intelligence
     */
    private _generateIntelligentClusterLabel;
    /**
     * Generate simple cluster labels based on semantic analysis
     */
    private _generateClusterLabel;
    /**
     * Fuse clustering results using Triple Intelligence consensus
     */
    private _fuseClusteringResultsWithTripleIntelligence;
    /**
     * Get items in a specific cluster from cluster sets
     */
    private _getItemsInCluster;
    /**
     * Count co-occurrences between two sets of assignments
     */
    private _countCoOccurrences;
    /**
     * Calculate fusion confidence based on algorithm agreement
     */
    private _calculateFusionConfidence;
    /**
     * Generate empty clustering result for edge cases
     */
    private _createEmptyResult;
    /**
     * Get sample using specified strategy for large dataset clustering
     */
    private _getSampleUsingStrategy;
    /**
     * Random sampling
     */
    private _getRandomSample;
    /**
     * Diverse sampling using vector space distribution
     */
    private _getDiverseSample;
    /**
     * Recent sampling based on creation time
     */
    private _getRecentSample;
    /**
     * Important sampling based on connection count and metadata
     */
    private _getImportantSample;
    /**
     * Project clusters back to full dataset using HNSW neighbors
     */
    private _projectClustersToFullDataset;
    private _groupByDomain;
    private _calculateDomainConfidence;
    private _findCrossDomainMembers;
    private _findCrossDomainClusters;
    private _getItemsByTimeWindow;
    private _calculateTemporalMetrics;
    private _mergeOverlappingTemporalClusters;
    private _adjustThresholdAdaptively;
    private _calculateItemToClusterSimilarity;
    private _recalculateClusterCentroid;
    private _calculateSimilarity;
    private _calculateEdgeWeight;
    private _sortNeighbors;
    private _buildSemanticHierarchy;
    private _detectOutliersClusterBased;
    private _detectOutliersIsolation;
    private _detectOutliersStatistical;
    private _generateVisualizationNodes;
    private _generateVisualizationEdges;
    private _generateVisualizationClusters;
    private _applyLayoutAlgorithm;
    private _manhattanDistance;
    private _calculateConfidence;
    private _generateSimilarityExplanation;
    /**
     * Get performance metrics for monitoring
     */
    getPerformanceMetrics(operation?: string): Map<string, PerformanceMetrics[]> | PerformanceMetrics[];
    /**
     * Clear all caches
     */
    clearCaches(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): Record<string, {
        size: number;
        maxSize: number;
    }>;
    /**
     * Analyze data characteristics for algorithm selection
     */
    private _analyzeDataCharacteristics;
    /**
     * Calculate centroid for a group of items
     */
    private _calculateGroupCentroid;
    /**
     * Cluster within semantic type using vector similarity
     */
    private _clusterWithinSemanticType;
    /**
     * Find cross-type connections via verbs
     */
    private _findCrossTypeConnections;
    /**
     * Merge semantic clusters based on connections
     */
    private _mergeSemanticClusters;
    /**
     * Get optimal clustering level for HNSW
     */
    private _getOptimalClusteringLevel;
    /**
     * Get nodes at HNSW level
     */
    private _getHNSWLevelNodes;
    /**
     * Find cluster members using HNSW neighbors
     */
    private _findClusterMembers;
    /**
     * Calculate hierarchical clustering confidence
     */
    private _calculateHierarchicalConfidence;
    /**
     * Assign unassigned items to nearest clusters
     */
    private _assignUnassignedItems;
}
