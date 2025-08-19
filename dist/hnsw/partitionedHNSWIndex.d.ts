/**
 * Partitioned HNSW Index for Large-Scale Vector Search
 * Implements sharding strategies to handle millions of vectors efficiently
 */
import { DistanceFunction, HNSWConfig, Vector, VectorDocument } from '../coreTypes.js';
export interface PartitionConfig {
    maxNodesPerPartition: number;
    partitionStrategy: 'semantic' | 'hash';
    semanticClusters?: number;
    autoTuneSemanticClusters?: boolean;
}
export interface PartitionMetadata {
    id: string;
    nodeCount: number;
    bounds?: {
        centroid: Vector;
        radius: number;
    };
    strategy: string;
    created: Date;
}
/**
 * Partitioned HNSW Index that splits large datasets across multiple smaller indices
 * This enables efficient search across millions of vectors by reducing memory usage
 * and parallelizing search operations
 */
export declare class PartitionedHNSWIndex {
    private partitions;
    private partitionMetadata;
    private config;
    private hnswConfig;
    private distanceFunction;
    private dimension;
    private nextPartitionId;
    constructor(partitionConfig?: Partial<PartitionConfig>, hnswConfig?: Partial<HNSWConfig>, distanceFunction?: DistanceFunction);
    /**
     * Add a vector to the partitioned index
     */
    addItem(item: VectorDocument): Promise<string>;
    /**
     * Search across all partitions for nearest neighbors
     */
    search(queryVector: Vector, k?: number, searchScope?: {
        partitionIds?: string[];
        maxPartitions?: number;
    }): Promise<Array<[string, number]>>;
    /**
     * Select the appropriate partition for a new item
     * Automatically chooses semantic partitioning when beneficial, falls back to hash
     */
    private selectPartition;
    /**
     * Hash-based partitioning for even distribution
     */
    private hashPartition;
    /**
     * Semantic clustering partitioning
     */
    private semanticPartition;
    /**
     * Auto-tune semantic clusters based on dataset size and performance
     */
    private autoTuneSemanticClusters;
    /**
     * Select which partitions to search based on query
     */
    private selectSearchPartitions;
    /**
     * Update partition bounds for semantic clustering
     */
    private updatePartitionBounds;
    /**
     * Split an overgrown partition into smaller partitions
     */
    private splitPartition;
    /**
     * Simple hash function for consistent partitioning
     */
    private simpleHash;
    /**
     * Get partition statistics
     */
    getPartitionStats(): {
        totalPartitions: number;
        totalNodes: number;
        averageNodesPerPartition: number;
        partitionDetails: PartitionMetadata[];
    };
    /**
     * Remove an item from the index
     */
    removeItem(id: string): Promise<boolean>;
    /**
     * Clear all partitions
     */
    clear(): void;
    /**
     * Get total size across all partitions
     */
    size(): number;
}
