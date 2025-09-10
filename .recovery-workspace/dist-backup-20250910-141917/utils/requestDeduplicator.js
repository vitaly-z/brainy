/**
 * Request Deduplicator Utility
 * Provides key generation for request deduplication
 */
export class RequestDeduplicator {
    /**
     * Generate a unique key for search requests to enable deduplication
     */
    static getSearchKey(query, k, options) {
        // Create a consistent key from search parameters
        const optionsKey = options ? JSON.stringify({
            metadata: options.metadata,
            service: options.service,
            searchMode: options.searchMode,
            threshold: options.threshold,
            includeVectors: options.includeVectors,
            includeMetadata: options.includeMetadata,
            sortBy: options.sortBy,
            cursor: options.cursor
        }) : '{}';
        return `search:${query}:${k}:${optionsKey}`;
    }
}
//# sourceMappingURL=requestDeduplicator.js.map