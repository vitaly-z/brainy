/**
 * Distributed Search System for Large-Scale HNSW Indices
 * Implements parallel search across multiple partitions and instances
 */
import { Vector } from '../coreTypes.js';
import { PartitionedHNSWIndex } from './partitionedHNSWIndex.js';
interface DistributedSearchConfig {
    maxConcurrentSearches?: number;
    searchTimeout?: number;
    resultMergeStrategy?: 'distance' | 'score' | 'hybrid';
    adaptivePartitionSelection?: boolean;
    redundantSearches?: number;
    loadBalancing?: boolean;
}
export declare enum SearchStrategy {
    BROADCAST = "broadcast",// Search all partitions
    SELECTIVE = "selective",// Search subset of partitions
    ADAPTIVE = "adaptive",// Dynamically adjust based on results
    HIERARCHICAL = "hierarchical"
}
interface SearchWorker {
    id: string;
    busy: boolean;
    tasksCompleted: number;
    averageTaskTime: number;
    lastTaskTime: number;
}
/**
 * Distributed search coordinator for large-scale vector search
 */
export declare class DistributedSearchSystem {
    private config;
    private searchWorkers;
    private searchQueue;
    private activeSearches;
    private partitionStats;
    private searchStats;
    constructor(config?: Partial<DistributedSearchConfig>);
    /**
     * Execute distributed search across multiple partitions
     */
    distributedSearch(partitionedIndex: PartitionedHNSWIndex, queryVector: Vector, k: number, strategy?: SearchStrategy): Promise<Array<[string, number]>>;
    /**
     * Select partitions to search based on strategy
     */
    private selectPartitions;
    /**
     * Adaptive partition selection based on historical performance
     */
    private adaptivePartitionSelection;
    /**
     * Select top-performing partitions
     */
    private selectTopPartitions;
    /**
     * Hierarchical partition selection for very large datasets
     */
    private hierarchicalPartitionSelection;
    /**
     * Create search tasks for parallel execution
     */
    private createSearchTasks;
    /**
     * Execute searches in parallel across selected partitions
     */
    private executeParallelSearches;
    /**
     * Execute search on a single partition
     */
    private executePartitionSearch;
    /**
     * Determine if search should use worker thread
     */
    private shouldUseWorkerThread;
    /**
     * Execute search in worker thread
     */
    private executeInWorkerThread;
    /**
     * Get available worker from pool
     */
    private getAvailableWorker;
    /**
     * Merge search results from multiple partitions
     */
    private mergeSearchResults;
    /**
     * Get partition quality score
     */
    private getPartitionQuality;
    /**
     * Update search statistics
     */
    private updateSearchStats;
    /**
     * Initialize worker thread pool
     */
    private initializeWorkerPool;
    /**
     * Generate unique search ID
     */
    private generateSearchId;
    /**
     * Get search performance statistics
     */
    getSearchStats(): typeof this.searchStats & {
        workerStats: SearchWorker[];
        partitionStats: Array<{
            id: string;
            stats: any;
        }>;
    };
    /**
     * Cleanup resources
     */
    cleanup(): void;
}
export {};
