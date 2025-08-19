/**
 * Utility functions for retrieving statistics from Brainy
 */
/**
 * Get statistics about the current state of a BrainyData instance
 * This function provides access to statistics at the root level of the library
 *
 * @param instance A BrainyData instance to get statistics from
 * @param options Additional options for retrieving statistics
 * @returns Object containing counts of nouns, verbs, metadata entries, and HNSW index size
 * @throws Error if the instance is not provided or if statistics retrieval fails
 */
export async function getStatistics(instance, options = {}) {
    if (!instance) {
        throw new Error('BrainyData instance must be provided to getStatistics');
    }
    try {
        return await instance.getStatistics(options);
    }
    catch (error) {
        console.error('Failed to get statistics:', error);
        throw new Error(`Failed to get statistics: ${error}`);
    }
}
//# sourceMappingURL=statistics.js.map