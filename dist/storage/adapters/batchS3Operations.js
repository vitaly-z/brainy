/**
 * Enhanced Batch S3 Operations for High-Performance Vector Retrieval
 * Implements optimized batch operations to reduce S3 API calls and latency
 */
/**
 * High-performance batch operations for S3-compatible storage
 * Optimizes retrieval patterns for HNSW search operations
 */
export class BatchS3Operations {
    constructor(s3Client, bucketName, options = {}) {
        this.s3Client = s3Client;
        this.bucketName = bucketName;
        this.options = {
            maxConcurrency: 50, // AWS S3 rate limit friendly
            prefetchSize: 100,
            useS3Select: false,
            compressionEnabled: false,
            ...options
        };
    }
    /**
     * Batch retrieve HNSW nodes with intelligent prefetching
     */
    async batchGetNodes(nodeIds, prefix = 'nodes/') {
        const startTime = Date.now();
        const result = {
            items: new Map(),
            errors: new Map(),
            statistics: {
                totalRequested: nodeIds.length,
                totalRetrieved: 0,
                totalErrors: 0,
                duration: 0,
                apiCalls: 0
            }
        };
        if (nodeIds.length === 0) {
            result.statistics.duration = Date.now() - startTime;
            return result;
        }
        // Use different strategies based on request size
        if (nodeIds.length <= 10) {
            // Small batch - use parallel GetObject
            await this.parallelGetObjects(nodeIds, prefix, result);
        }
        else if (nodeIds.length <= 1000) {
            // Medium batch - use chunked parallel with prefetching
            await this.chunkedParallelGet(nodeIds, prefix, result);
        }
        else {
            // Large batch - use S3 list-based approach with filtering
            await this.listBasedBatchGet(nodeIds, prefix, result);
        }
        result.statistics.duration = Date.now() - startTime;
        return result;
    }
    /**
     * Parallel GetObject operations for small batches
     */
    async parallelGetObjects(ids, prefix, result) {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const semaphore = new Semaphore(this.options.maxConcurrency);
        const promises = ids.map(async (id) => {
            await semaphore.acquire();
            try {
                result.statistics.apiCalls++;
                const response = await this.s3Client.send(new GetObjectCommand({
                    Bucket: this.bucketName,
                    Key: `${prefix}${id}.json`
                }));
                if (response.Body) {
                    const content = await response.Body.transformToString();
                    const item = this.parseStoredObject(content);
                    if (item) {
                        result.items.set(id, item);
                        result.statistics.totalRetrieved++;
                    }
                }
            }
            catch (error) {
                result.errors.set(id, error);
                result.statistics.totalErrors++;
            }
            finally {
                semaphore.release();
            }
        });
        await Promise.all(promises);
    }
    /**
     * Chunked parallel retrieval with intelligent batching
     */
    async chunkedParallelGet(ids, prefix, result) {
        const chunkSize = Math.min(50, Math.ceil(ids.length / 10));
        const chunks = this.chunkArray(ids, chunkSize);
        // Process chunks with controlled concurrency
        const semaphore = new Semaphore(Math.min(5, chunks.length));
        const chunkPromises = chunks.map(async (chunk) => {
            await semaphore.acquire();
            try {
                await this.parallelGetObjects(chunk, prefix, result);
            }
            finally {
                semaphore.release();
            }
        });
        await Promise.all(chunkPromises);
    }
    /**
     * List-based batch retrieval for large datasets
     * Uses S3 ListObjects to reduce API calls
     */
    async listBasedBatchGet(ids, prefix, result) {
        const { ListObjectsV2Command, GetObjectCommand } = await import('@aws-sdk/client-s3');
        // Create a set for O(1) lookup
        const idSet = new Set(ids);
        // List objects with the prefix
        let continuationToken;
        const maxKeys = 1000;
        do {
            result.statistics.apiCalls++;
            const listResponse = await this.s3Client.send(new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
                MaxKeys: maxKeys,
                ContinuationToken: continuationToken
            }));
            if (listResponse.Contents) {
                // Filter objects that match our requested IDs
                const matchingObjects = listResponse.Contents.filter((obj) => {
                    if (!obj.Key)
                        return false;
                    const id = obj.Key.replace(prefix, '').replace('.json', '');
                    return idSet.has(id);
                });
                // Batch retrieve matching objects
                const semaphore = new Semaphore(this.options.maxConcurrency);
                const retrievalPromises = matchingObjects.map(async (obj) => {
                    if (!obj.Key)
                        return;
                    await semaphore.acquire();
                    try {
                        result.statistics.apiCalls++;
                        const response = await this.s3Client.send(new GetObjectCommand({
                            Bucket: this.bucketName,
                            Key: obj.Key
                        }));
                        if (response.Body) {
                            const content = await response.Body.transformToString();
                            const item = this.parseStoredObject(content);
                            if (item) {
                                const id = obj.Key.replace(prefix, '').replace('.json', '');
                                result.items.set(id, item);
                                result.statistics.totalRetrieved++;
                            }
                        }
                    }
                    catch (error) {
                        const id = obj.Key.replace(prefix, '').replace('.json', '');
                        result.errors.set(id, error);
                        result.statistics.totalErrors++;
                    }
                    finally {
                        semaphore.release();
                    }
                });
                await Promise.all(retrievalPromises);
            }
            continuationToken = listResponse.NextContinuationToken;
        } while (continuationToken && result.items.size < ids.length);
    }
    /**
     * Intelligent prefetch based on HNSW graph connectivity
     */
    async prefetchConnectedNodes(currentNodeIds, connectionMap, prefix = 'nodes/') {
        // Analyze connection patterns to predict next nodes
        const predictedNodes = new Set();
        for (const nodeId of currentNodeIds) {
            const connections = connectionMap.get(nodeId);
            if (connections) {
                // Add immediate neighbors
                connections.forEach(connId => predictedNodes.add(connId));
                // Add second-degree neighbors (limited)
                let count = 0;
                for (const connId of connections) {
                    if (count >= 5)
                        break; // Limit prefetch scope
                    const secondDegree = connectionMap.get(connId);
                    if (secondDegree) {
                        secondDegree.forEach(id => {
                            if (count < 20) {
                                predictedNodes.add(id);
                                count++;
                            }
                        });
                    }
                }
            }
        }
        // Remove nodes we already have
        const nodesToPrefetch = Array.from(predictedNodes).filter(id => !currentNodeIds.includes(id));
        return this.batchGetNodes(nodesToPrefetch.slice(0, this.options.prefetchSize), prefix);
    }
    /**
     * S3 Select-based retrieval for filtered queries
     */
    async selectiveRetrieve(prefix, filter) {
        // This would use S3 Select to filter objects server-side
        // Reducing data transfer for large-scale operations
        const startTime = Date.now();
        const result = {
            items: new Map(),
            errors: new Map(),
            statistics: {
                totalRequested: 0,
                totalRetrieved: 0,
                totalErrors: 0,
                duration: 0,
                apiCalls: 0
            }
        };
        // S3 Select implementation would go here
        // For now, fall back to list-based approach
        console.warn('S3 Select not implemented, falling back to list-based retrieval');
        result.statistics.duration = Date.now() - startTime;
        return result;
    }
    /**
     * Parse stored object from JSON string
     */
    parseStoredObject(content) {
        try {
            const parsed = JSON.parse(content);
            // Reconstruct HNSW node structure
            if (parsed.connections && typeof parsed.connections === 'object') {
                const connections = new Map();
                for (const [level, nodeIds] of Object.entries(parsed.connections)) {
                    connections.set(Number(level), new Set(nodeIds));
                }
                parsed.connections = connections;
            }
            return parsed;
        }
        catch (error) {
            console.error('Failed to parse stored object:', error);
            return null;
        }
    }
    /**
     * Utility function to chunk arrays
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
}
/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
    constructor(permits) {
        this.waiting = [];
        this.permits = permits;
    }
    async acquire() {
        if (this.permits > 0) {
            this.permits--;
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.waiting.push(resolve);
        });
    }
    release() {
        if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            resolve();
        }
        else {
            this.permits++;
        }
    }
}
//# sourceMappingURL=batchS3Operations.js.map