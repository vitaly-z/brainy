/**
 * Optimized S3 Search and Pagination
 * Provides efficient search and pagination capabilities for S3-compatible storage
 */
import { createModuleLogger } from '../../utils/logger.js';
import { getDirectoryPath } from '../baseStorage.js';
const logger = createModuleLogger('OptimizedS3Search');
/**
 * Optimized search implementation for S3-compatible storage
 */
export class OptimizedS3Search {
    constructor(storage) {
        this.storage = storage;
    }
    /**
     * Get nouns with optimized pagination and filtering
     */
    async getNounsWithPagination(options = {}) {
        const limit = options.limit || 100;
        const cursor = options.cursor;
        try {
            // List noun objects with pagination
            const listResult = await this.storage.listObjectKeys(`${getDirectoryPath('noun', 'vector')}/`, limit * 2, cursor);
            if (!listResult.keys.length) {
                return {
                    items: [],
                    hasMore: false
                };
            }
            // Load nouns in parallel batches
            const nouns = [];
            const batchSize = 10;
            for (let i = 0; i < listResult.keys.length && nouns.length < limit; i += batchSize) {
                const batch = listResult.keys.slice(i, i + batchSize);
                const batchPromises = batch.map(key => this.storage.getObject(key));
                const batchResults = await Promise.all(batchPromises);
                for (const noun of batchResults) {
                    if (!noun)
                        continue;
                    // Apply filters
                    if (options.filter && !(await this.matchesNounFilter(noun, options.filter))) {
                        continue;
                    }
                    nouns.push(noun);
                    if (nouns.length >= limit) {
                        break;
                    }
                }
            }
            // Determine if there are more items
            const hasMore = listResult.hasMore || nouns.length >= limit;
            // Set next cursor
            let nextCursor;
            if (hasMore && nouns.length > 0) {
                nextCursor = nouns[nouns.length - 1].id;
            }
            return {
                items: nouns.slice(0, limit),
                hasMore,
                nextCursor
            };
        }
        catch (error) {
            logger.error('Failed to get nouns with pagination:', error);
            return {
                items: [],
                hasMore: false
            };
        }
    }
    /**
     * Get verbs with optimized pagination and filtering
     */
    async getVerbsWithPagination(options = {}) {
        const limit = options.limit || 100;
        const cursor = options.cursor;
        try {
            // List verb objects with pagination
            const listResult = await this.storage.listObjectKeys(`${getDirectoryPath('verb', 'vector')}/`, limit * 2, cursor);
            if (!listResult.keys.length) {
                return {
                    items: [],
                    hasMore: false
                };
            }
            // Load verbs in parallel batches
            const verbs = [];
            const batchSize = 10;
            for (let i = 0; i < listResult.keys.length && verbs.length < limit; i += batchSize) {
                const batch = listResult.keys.slice(i, i + batchSize);
                // Load verbs and their metadata in parallel
                const batchPromises = batch.map(async (key) => {
                    const verbData = await this.storage.getObject(key);
                    if (!verbData)
                        return null;
                    // Get metadata
                    const verbId = key.replace(`${getDirectoryPath('verb', 'vector')}/`, '').replace('.json', '');
                    const metadata = await this.storage.getMetadata(verbId, 'verb');
                    // Combine into GraphVerb
                    return this.combineVerbWithMetadata(verbData, metadata);
                });
                const batchResults = await Promise.all(batchPromises);
                for (const verb of batchResults) {
                    if (!verb)
                        continue;
                    // Apply filters
                    if (options.filter && !this.matchesVerbFilter(verb, options.filter)) {
                        continue;
                    }
                    verbs.push(verb);
                    if (verbs.length >= limit) {
                        break;
                    }
                }
            }
            // Determine if there are more items
            const hasMore = listResult.hasMore || verbs.length >= limit;
            // Set next cursor
            let nextCursor;
            if (hasMore && verbs.length > 0) {
                nextCursor = verbs[verbs.length - 1].id;
            }
            return {
                items: verbs.slice(0, limit),
                hasMore,
                nextCursor
            };
        }
        catch (error) {
            logger.error('Failed to get verbs with pagination:', error);
            return {
                items: [],
                hasMore: false
            };
        }
    }
    /**
     * Check if a noun matches the filter criteria
     */
    async matchesNounFilter(noun, filter) {
        // Get metadata for filtering
        const metadata = await this.storage.getMetadata(noun.id, 'noun');
        // Filter by noun type
        if (filter.nounType) {
            const nounTypes = Array.isArray(filter.nounType) ? filter.nounType : [filter.nounType];
            const nounType = metadata?.type || metadata?.noun;
            if (!nounType || !nounTypes.includes(nounType)) {
                return false;
            }
        }
        // Filter by service
        if (filter.service) {
            const services = Array.isArray(filter.service) ? filter.service : [filter.service];
            if (!metadata?.service || !services.includes(metadata.service)) {
                return false;
            }
        }
        // Filter by metadata
        if (filter.metadata) {
            if (!metadata)
                return false;
            for (const [key, value] of Object.entries(filter.metadata)) {
                if (metadata[key] !== value) {
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Check if a verb matches the filter criteria
     */
    matchesVerbFilter(verb, filter) {
        // Filter by verb type
        if (filter.verbType) {
            const verbTypes = Array.isArray(filter.verbType) ? filter.verbType : [filter.verbType];
            if (!verb.type || !verbTypes.includes(verb.type)) {
                return false;
            }
        }
        // Filter by source ID
        if (filter.sourceId) {
            const sourceIds = Array.isArray(filter.sourceId) ? filter.sourceId : [filter.sourceId];
            if (!verb.sourceId || !sourceIds.includes(verb.sourceId)) {
                return false;
            }
        }
        // Filter by target ID
        if (filter.targetId) {
            const targetIds = Array.isArray(filter.targetId) ? filter.targetId : [filter.targetId];
            if (!verb.targetId || !targetIds.includes(verb.targetId)) {
                return false;
            }
        }
        // Filter by service
        if (filter.service) {
            const services = Array.isArray(filter.service) ? filter.service : [filter.service];
            if (!verb.metadata?.service || !services.includes(verb.metadata.service)) {
                return false;
            }
        }
        // Filter by metadata
        if (filter.metadata) {
            if (!verb.metadata)
                return false;
            for (const [key, value] of Object.entries(filter.metadata)) {
                if (verb.metadata[key] !== value) {
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Combine HNSWVerb data with metadata to create GraphVerb
     */
    combineVerbWithMetadata(verbData, metadata) {
        if (!verbData || !metadata)
            return null;
        // Create default timestamp if not present
        const defaultTimestamp = {
            seconds: Math.floor(Date.now() / 1000),
            nanoseconds: (Date.now() % 1000) * 1000000
        };
        // Create default createdBy if not present
        const defaultCreatedBy = {
            augmentation: 'unknown',
            version: '1.0'
        };
        return {
            id: verbData.id,
            vector: verbData.vector,
            sourceId: metadata.sourceId,
            targetId: metadata.targetId,
            source: metadata.source,
            target: metadata.target,
            verb: metadata.verb,
            type: metadata.type,
            weight: metadata.weight || 1.0,
            metadata: metadata.metadata || {},
            createdAt: metadata.createdAt || defaultTimestamp,
            updatedAt: metadata.updatedAt || defaultTimestamp,
            createdBy: metadata.createdBy || defaultCreatedBy,
            data: metadata.data,
            embedding: verbData.vector
        };
    }
}
//# sourceMappingURL=optimizedS3Search.js.map