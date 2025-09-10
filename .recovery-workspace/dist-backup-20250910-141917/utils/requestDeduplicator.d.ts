/**
 * Request Deduplicator Utility
 * Provides key generation for request deduplication
 */
export declare class RequestDeduplicator {
    /**
     * Generate a unique key for search requests to enable deduplication
     */
    static getSearchKey(query: string, k: number, options: any): string;
}
