/**
 * Hash-based Partitioner
 * Provides deterministic partitioning for distributed writes
 */
import { SharedConfig } from '../types/distributedTypes.js';
export declare class HashPartitioner {
    private partitionCount;
    private partitionPrefix;
    constructor(config: SharedConfig);
    /**
     * Get partition for a given vector ID using deterministic hashing
     * @param vectorId - The unique identifier of the vector
     * @returns The partition path
     */
    getPartition(vectorId: string): string;
    /**
     * Get partition with domain metadata (domain stored as metadata, not in path)
     * @param vectorId - The unique identifier of the vector
     * @param domain - The domain identifier (for metadata only)
     * @returns The partition path
     */
    getPartitionWithDomain(vectorId: string, domain?: string): string;
    /**
     * Get all partition paths
     * @returns Array of all partition paths
     */
    getAllPartitions(): string[];
    /**
     * Get partition index from partition path
     * @param partitionPath - The partition path
     * @returns The partition index
     */
    getPartitionIndex(partitionPath: string): number;
    /**
     * Hash a string to a number for consistent partitioning
     * @param str - The string to hash
     * @returns A positive integer hash
     */
    private hashString;
    /**
     * Get partitions for batch operations
     * Groups vector IDs by their target partition
     * @param vectorIds - Array of vector IDs
     * @returns Map of partition to vector IDs
     */
    getPartitionsForBatch(vectorIds: string[]): Map<string, string[]>;
}
/**
 * Affinity-based Partitioner
 * Extends HashPartitioner to prefer certain partitions for a writer
 * while maintaining correctness
 */
export declare class AffinityPartitioner extends HashPartitioner {
    private preferredPartitions;
    private instanceId;
    constructor(config: SharedConfig, instanceId: string);
    /**
     * Calculate preferred partitions for this instance
     */
    private calculatePreferredPartitions;
    /**
     * Check if a partition is preferred for this instance
     * @param partitionPath - The partition path
     * @returns Whether this partition is preferred
     */
    isPreferredPartition(partitionPath: string): boolean;
    /**
     * Get all preferred partitions for this instance
     * @returns Array of preferred partition paths
     */
    getPreferredPartitions(): string[];
    /**
     * Update preferred partitions based on new config
     * @param config - The updated shared configuration
     */
    updatePreferences(config: SharedConfig): void;
}
