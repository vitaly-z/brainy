/**
 * Neural API - Unified Semantic Intelligence
 *
 * Best-of-both: Complete functionality + Enterprise performance
 * Combines rich features with O(n) algorithms for millions of items
 */
import { Vector } from '../coreTypes.js';
export interface SimilarityResult {
    score: number;
    method?: string;
    confidence?: number;
    explanation?: string;
    hierarchy?: {
        sharedParent?: string;
        distance?: number;
    };
    breakdown?: {
        semantic?: number;
        taxonomic?: number;
        contextual?: number;
    };
}
export interface SimilarityOptions {
    explain?: boolean;
    includeBreakdown?: boolean;
    method?: 'cosine' | 'euclidean' | 'hybrid';
}
export interface SemanticCluster {
    id: string;
    centroid: Vector;
    members: string[];
    label?: string;
    confidence: number;
    depth?: number;
    size?: number;
    level?: number;
    center?: any;
}
export interface SemanticHierarchy {
    self: {
        id: string;
        type?: string;
        vector: Vector;
    };
    parent?: {
        id: string;
        type?: string;
        similarity: number;
    };
    grandparent?: {
        id: string;
        type?: string;
        similarity: number;
    };
    root?: {
        id: string;
        type?: string;
        similarity: number;
    };
    siblings?: Array<{
        id: string;
        similarity: number;
    }>;
    children?: Array<{
        id: string;
        similarity: number;
    }>;
    depth?: number;
}
export interface NeighborGraph {
    center: string;
    neighbors: Array<{
        id: string;
        similarity: number;
        type?: string;
        connections?: number;
    }>;
    edges?: Array<{
        source: string;
        target: string;
        weight: number;
        type?: string;
    }>;
}
export interface ClusterOptions {
    algorithm?: 'hierarchical' | 'kmeans' | 'sample' | 'stream';
    maxClusters?: number;
    threshold?: number;
    sampleSize?: number;
    strategy?: 'random' | 'diverse' | 'recent';
    level?: number;
    batchSize?: number;
}
export interface VisualizationData {
    format: 'force-directed' | 'hierarchical' | 'radial';
    nodes: Array<{
        id: string;
        x: number;
        y: number;
        z?: number;
        type?: string;
        cluster?: string;
        size?: number;
    }>;
    edges: Array<{
        source: string;
        target: string;
        weight: number;
        type?: string;
    }>;
    layout?: {
        dimensions: number;
        algorithm: string;
        bounds?: {
            width: number;
            height: number;
            depth?: number;
        };
    };
    clusters?: Array<{
        id: string;
        color: string;
        label?: string;
        size: number;
    }>;
}
export interface ClusteringStrategy {
    type: 'sample' | 'hierarchical' | 'stream' | 'hybrid';
    sampleSize?: number;
    maxClusters?: number;
    minClusterSize?: number;
}
export interface LODConfig {
    levels: number;
    itemsPerLevel: number[];
    zoomThresholds: number[];
}
/**
 * Neural API - Unified best-of-both implementation
 */
export declare class NeuralAPI {
    private brain;
    private similarityCache;
    private clusterCache;
    private hierarchyCache;
    constructor(brain: any);
    /**
     * Calculate similarity between any two items (smart detection)
     */
    similar(a: any, b: any, options?: SimilarityOptions): Promise<number | SimilarityResult>;
    /**
     * Find semantic clusters (auto-detects best approach)
     * Now with enterprise performance!
     */
    clusters(input?: any): Promise<SemanticCluster[]>;
    /**
     * Get semantic hierarchy for an item
     */
    hierarchy(id: string): Promise<SemanticHierarchy>;
    /**
     * Find semantic neighbors for visualization
     */
    neighbors(id: string, options?: {
        radius?: number;
        limit?: number;
        includeEdges?: boolean;
    }): Promise<NeighborGraph>;
    /**
     * Find semantic path between two items
     */
    semanticPath(fromId: string, toId: string, options?: {
        maxHops?: number;
        algorithm?: 'breadth' | 'dijkstra';
    }): Promise<Array<{
        id: string;
        similarity: number;
        hop: number;
    }>>;
    /**
     * Detect semantic outliers
     */
    outliers(threshold?: number): Promise<string[]>;
    /**
     * Generate visualization data
     */
    visualize(options?: {
        maxNodes?: number;
        dimensions?: 2 | 3;
        algorithm?: 'force' | 'hierarchical' | 'radial';
        includeEdges?: boolean;
    }): Promise<VisualizationData>;
    /**
     * Fast clustering using HNSW levels - O(n) instead of O(n²)
     */
    clusterFast(options?: {
        level?: number;
        maxClusters?: number;
    }): Promise<SemanticCluster[]>;
    /**
     * Large-scale clustering for massive datasets (millions of items)
     */
    clusterLarge(options?: {
        sampleSize?: number;
        strategy?: 'random' | 'diverse' | 'recent';
    }): Promise<SemanticCluster[]>;
    /**
     * Streaming clustering for progressive refinement
     */
    clusterStream(options?: {
        batchSize?: number;
        maxBatches?: number;
    }): AsyncGenerator<SemanticCluster[]>;
    /**
     * Level-of-detail for massive visualization
     */
    getLOD(zoomLevel: number, viewport?: {
        center: Vector;
        radius: number;
    }): Promise<any>;
    private isId;
    private similarityById;
    private similarityByText;
    private similarityByVector;
    private smartSimilarity;
    private toVector;
    private getOptimalClusteringLevel;
    private getHNSWLevelNodes;
    private findClusterMembers;
    private getSample;
    private shuffleArray;
    private getDiverseSample;
    private performFastClustering;
    private calculateCentroid;
    private projectClustersToFullDataset;
    private mergeClusters;
    private averageVectors;
    private getBatch;
    private clusterAll;
    private clusterItems;
    private clustersNear;
    private clusterWithConfig;
    private buildHierarchy;
    private buildEdges;
    private dijkstraPath;
    private breadthFirstPath;
    private outliersViaSampling;
    private outliersByDistance;
    private getVisualizationNodes;
    private applyLayout;
    private buildVisualizationEdges;
    private detectOptimalFormat;
    private calculateBounds;
    private getViewportLOD;
    private getGlobalLOD;
}
