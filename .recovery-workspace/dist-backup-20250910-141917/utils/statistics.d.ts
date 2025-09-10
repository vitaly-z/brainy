/**
 * Utility functions for retrieving statistics from Brainy
 */
import { Brainy } from '../brainy.js';
/**
 * Get statistics about the current state of a Brainy instance
 * This function provides access to statistics at the root level of the library
 *
 * @param instance A Brainy instance to get statistics from
 * @param options Additional options for retrieving statistics
 * @returns Object containing counts of nouns, verbs, metadata entries, and HNSW index size
 * @throws Error if the instance is not provided or if statistics retrieval fails
 */
export declare function getStatistics(instance: Brainy, options?: {
    service?: string | string[];
}): Promise<{
    nounCount: number;
    verbCount: number;
    metadataCount: number;
    hnswIndexSize: number;
    serviceBreakdown?: {
        [service: string]: {
            nounCount: number;
            verbCount: number;
            metadataCount: number;
        };
    };
}>;
