/**
 * Neural API Type Definitions
 * Comprehensive interfaces for clustering, similarity, and analysis
 */
export interface Vector {
    [index: number]: number;
    length: number;
}
export interface SemanticCluster {
    id: string;
    centroid: Vector;
    members: string[];
    size: number;
    confidence: number;
    label?: string;
    metadata?: Record<string, any>;
    cohesion?: number;
    level?: number;
}
export interface ClusterEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    weight?: number;
    isInterCluster: boolean;
    sourceCluster?: string;
    targetCluster?: string;
}
export interface EnhancedSemanticCluster extends SemanticCluster {
    intraClusterEdges: ClusterEdge[];
    interClusterEdges: ClusterEdge[];
    relationshipSummary: {
        totalEdges: number;
        intraClusterEdges: number;
        interClusterEdges: number;
        edgeTypes: Record<string, number>;
    };
}
export interface DomainCluster extends SemanticCluster {
    domain: string;
    domainConfidence: number;
    crossDomainMembers?: string[];
}
export interface TemporalCluster extends SemanticCluster {
    timeWindow: TimeWindow;
    trend?: 'increasing' | 'decreasing' | 'stable';
    temporal: {
        startTime: Date;
        endTime: Date;
        peakTime?: Date;
        frequency?: number;
    };
}
export interface ExplainableCluster extends SemanticCluster {
    explanation: {
        primaryFeatures: string[];
        commonTerms: string[];
        reasoning: string;
        confidence: number;
    };
    subClusters?: ExplainableCluster[];
}
export interface ConfidentCluster extends SemanticCluster {
    minConfidence: number;
    uncertainMembers: string[];
    certainMembers: string[];
}
export interface BaseClusteringOptions {
    maxClusters?: number;
    minClusterSize?: number;
    threshold?: number;
    cacheResults?: boolean;
}
export interface ClusteringOptions extends BaseClusteringOptions {
    algorithm?: 'auto' | 'hierarchical' | 'kmeans' | 'dbscan' | 'sample' | 'semantic' | 'graph' | 'multimodal';
    sampleSize?: number;
    strategy?: 'random' | 'diverse' | 'recent' | 'important';
    memoryLimit?: string;
    includeOutliers?: boolean;
    maxIterations?: number;
    tolerance?: number;
}
export interface DomainClusteringOptions extends BaseClusteringOptions {
    domainField?: string;
    crossDomainThreshold?: number;
    preserveDomainBoundaries?: boolean;
}
export interface TemporalClusteringOptions extends BaseClusteringOptions {
    timeField: string;
    windows: TimeWindow[];
    overlapStrategy?: 'merge' | 'separate' | 'hierarchical';
    trendAnalysis?: boolean;
}
export interface StreamClusteringOptions extends BaseClusteringOptions {
    batchSize?: number;
    updateInterval?: number;
    adaptiveThreshold?: boolean;
    decayFactor?: number;
}
export interface SimilarityOptions {
    detailed?: boolean;
    metric?: 'cosine' | 'euclidean' | 'manhattan' | 'jaccard';
    normalized?: boolean;
}
export interface SimilarityResult {
    score: number;
    confidence: number;
    explanation?: string;
    metric?: string;
}
export interface NeighborOptions {
    limit?: number;
    radius?: number;
    minSimilarity?: number;
    includeMetadata?: boolean;
    sortBy?: 'similarity' | 'importance' | 'recency';
}
export interface Neighbor {
    id: string;
    similarity: number;
    data?: any;
    metadata?: Record<string, any>;
    distance?: number;
}
export interface NeighborsResult {
    neighbors: Neighbor[];
    queryId: string;
    totalFound: number;
    averageSimilarity: number;
}
export interface SemanticHierarchy {
    self: {
        id: string;
        vector?: Vector;
        metadata?: any;
    };
    parent?: {
        id: string;
        similarity: number;
    };
    children?: Array<{
        id: string;
        similarity: number;
    }>;
    siblings?: Array<{
        id: string;
        similarity: number;
    }>;
    level?: number;
    depth?: number;
}
export interface HierarchyOptions {
    maxDepth?: number;
    minSimilarity?: number;
    includeMetadata?: boolean;
    buildStrategy?: 'similarity' | 'metadata' | 'mixed';
}
export interface VisualizationOptions {
    maxNodes?: number;
    dimensions?: 2 | 3;
    algorithm?: 'force' | 'spring' | 'circular' | 'hierarchical';
    includeEdges?: boolean;
    clusterColors?: boolean;
    nodeSize?: 'uniform' | 'importance' | 'connections';
}
export interface VisualizationNode {
    id: string;
    x: number;
    y: number;
    z?: number;
    cluster?: string;
    size?: number;
    color?: string;
    metadata?: Record<string, any>;
}
export interface VisualizationEdge {
    source: string;
    target: string;
    weight: number;
    color?: string;
    type?: string;
}
export interface VisualizationResult {
    nodes: VisualizationNode[];
    edges: VisualizationEdge[];
    clusters?: Array<{
        id: string;
        color: string;
        size: number;
        label?: string;
    }>;
    metadata: {
        algorithm: string;
        dimensions: number;
        totalNodes: number;
        totalEdges: number;
        generatedAt: Date;
    };
}
export interface TimeWindow {
    start: Date;
    end: Date;
    label?: string;
    weight?: number;
}
export interface ClusterFeedback {
    clusterId: string;
    action: 'merge' | 'split' | 'relabel' | 'adjust';
    parameters?: Record<string, any>;
    confidence?: number;
}
export interface OutlierOptions {
    threshold?: number;
    method?: 'isolation' | 'statistical' | 'cluster-based';
    minNeighbors?: number;
    includeReasons?: boolean;
}
export interface Outlier {
    id: string;
    score: number;
    reasons?: string[];
    nearestNeighbors?: Neighbor[];
    metadata?: Record<string, any>;
}
export interface PerformanceMetrics {
    executionTime: number;
    memoryUsed: number;
    itemsProcessed: number;
    cacheHits: number;
    cacheMisses: number;
    algorithm: string;
}
export interface ClusteringResult<T = SemanticCluster> {
    clusters: T[];
    metrics: PerformanceMetrics;
    metadata: {
        totalItems: number;
        clustersFound: number;
        averageClusterSize: number;
        silhouetteScore?: number;
        timestamp: Date;
        semanticTypes?: number;
        hnswLevel?: number;
        kValue?: number;
        hasConverged?: boolean;
        outlierCount?: number;
        eps?: number;
        minPts?: number;
        averageModularity?: number;
        fusionMethod?: string;
        componentAlgorithms?: string[];
        sampleSize?: number;
        samplingStrategy?: string;
    };
}
export interface StreamingBatch<T = SemanticCluster> {
    clusters: T[];
    batchNumber: number;
    isComplete: boolean;
    progress: {
        processed: number;
        total: number;
        percentage: number;
    };
    metrics: PerformanceMetrics;
}
export declare class NeuralAPIError extends Error {
    code: string;
    context?: Record<string, any> | undefined;
    constructor(message: string, code: string, context?: Record<string, any> | undefined);
}
export declare class ClusteringError extends NeuralAPIError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class SimilarityError extends NeuralAPIError {
    constructor(message: string, context?: Record<string, any>);
}
export interface NeuralAPIConfig {
    cacheSize?: number;
    defaultAlgorithm?: string;
    similarityMetric?: 'cosine' | 'euclidean' | 'manhattan';
    performanceTracking?: boolean;
    maxMemoryUsage?: string;
    parallelProcessing?: boolean;
    streamingBatchSize?: number;
}
