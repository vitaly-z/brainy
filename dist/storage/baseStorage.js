/**
 * Base Storage Adapter
 * Provides common functionality for all storage adapters
 */
import { BaseStorageAdapter } from './adapters/baseStorageAdapter.js';
// Common directory/prefix names
// Option A: Entity-Based Directory Structure
export const ENTITIES_DIR = 'entities';
export const NOUNS_VECTOR_DIR = 'entities/nouns/vectors';
export const NOUNS_METADATA_DIR = 'entities/nouns/metadata';
export const VERBS_VECTOR_DIR = 'entities/verbs/vectors';
export const VERBS_METADATA_DIR = 'entities/verbs/metadata';
export const INDEXES_DIR = 'indexes';
export const METADATA_INDEX_DIR = 'indexes/metadata';
// Legacy paths - kept for backward compatibility during migration
export const NOUNS_DIR = 'nouns'; // Legacy: now maps to entities/nouns/vectors
export const VERBS_DIR = 'verbs'; // Legacy: now maps to entities/verbs/vectors
export const METADATA_DIR = 'metadata'; // Legacy: now maps to entities/nouns/metadata
export const NOUN_METADATA_DIR = 'noun-metadata'; // Legacy: now maps to entities/nouns/metadata
export const VERB_METADATA_DIR = 'verb-metadata'; // Legacy: now maps to entities/verbs/metadata
export const INDEX_DIR = 'index'; // Legacy - kept for backward compatibility
export const SYSTEM_DIR = '_system'; // System config & metadata indexes
export const STATISTICS_KEY = 'statistics';
// Migration version to track compatibility
export const STORAGE_SCHEMA_VERSION = 3; // v3: Entity-Based Directory Structure (Option A)
// Configuration flag to enable new directory structure
export const USE_ENTITY_BASED_STRUCTURE = true; // Set to true to use Option A structure
/**
 * Get the appropriate directory path based on configuration
 */
export function getDirectoryPath(entityType, dataType) {
    if (USE_ENTITY_BASED_STRUCTURE) {
        // Option A: Entity-Based Structure
        if (entityType === 'noun') {
            return dataType === 'vector' ? NOUNS_VECTOR_DIR : NOUNS_METADATA_DIR;
        }
        else {
            return dataType === 'vector' ? VERBS_VECTOR_DIR : VERBS_METADATA_DIR;
        }
    }
    else {
        // Legacy structure
        if (entityType === 'noun') {
            return dataType === 'vector' ? NOUNS_DIR : METADATA_DIR;
        }
        else {
            return dataType === 'vector' ? VERBS_DIR : VERB_METADATA_DIR;
        }
    }
}
/**
 * Base storage adapter that implements common functionality
 * This is an abstract class that should be extended by specific storage adapters
 */
export class BaseStorage extends BaseStorageAdapter {
    constructor() {
        super(...arguments);
        this.isInitialized = false;
        this.readOnly = false;
    }
    /**
     * Ensure the storage adapter is initialized
     */
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.init();
        }
    }
    /**
     * Save a noun to storage
     */
    async saveNoun(noun) {
        await this.ensureInitialized();
        return this.saveNoun_internal(noun);
    }
    /**
     * Get a noun from storage
     */
    async getNoun(id) {
        await this.ensureInitialized();
        return this.getNoun_internal(id);
    }
    /**
     * Get nouns by noun type
     * @param nounType The noun type to filter by
     * @returns Promise that resolves to an array of nouns of the specified noun type
     */
    async getNounsByNounType(nounType) {
        await this.ensureInitialized();
        return this.getNounsByNounType_internal(nounType);
    }
    /**
     * Delete a noun from storage
     */
    async deleteNoun(id) {
        await this.ensureInitialized();
        return this.deleteNoun_internal(id);
    }
    /**
     * Save a verb to storage
     */
    async saveVerb(verb) {
        await this.ensureInitialized();
        // Extract the lightweight HNSWVerb data
        const hnswVerb = {
            id: verb.id,
            vector: verb.vector,
            connections: verb.connections || new Map()
        };
        // Extract and save the metadata separately
        const metadata = {
            sourceId: verb.sourceId || verb.source,
            targetId: verb.targetId || verb.target,
            source: verb.source || verb.sourceId,
            target: verb.target || verb.targetId,
            type: verb.type || verb.verb,
            verb: verb.verb || verb.type,
            weight: verb.weight,
            metadata: verb.metadata,
            data: verb.data,
            createdAt: verb.createdAt,
            updatedAt: verb.updatedAt,
            createdBy: verb.createdBy,
            embedding: verb.embedding
        };
        // Save both the HNSWVerb and metadata
        await this.saveVerb_internal(hnswVerb);
        await this.saveVerbMetadata(verb.id, metadata);
    }
    /**
     * Get a verb from storage
     */
    async getVerb(id) {
        await this.ensureInitialized();
        const hnswVerb = await this.getVerb_internal(id);
        if (!hnswVerb) {
            return null;
        }
        return this.convertHNSWVerbToGraphVerb(hnswVerb);
    }
    /**
     * Convert HNSWVerb to GraphVerb by combining with metadata
     */
    async convertHNSWVerbToGraphVerb(hnswVerb) {
        try {
            const metadata = await this.getVerbMetadata(hnswVerb.id);
            if (!metadata) {
                return null;
            }
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
                id: hnswVerb.id,
                vector: hnswVerb.vector,
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
                embedding: hnswVerb.vector
            };
        }
        catch (error) {
            console.error(`Failed to convert HNSWVerb to GraphVerb for ${hnswVerb.id}:`, error);
            return null;
        }
    }
    /**
     * Internal method for loading all verbs - used by performance optimizations
     * @internal - Do not use directly, use getVerbs() with pagination instead
     */
    async _loadAllVerbsForOptimization() {
        await this.ensureInitialized();
        // Only use this for internal optimizations when safe
        const result = await this.getVerbs({
            pagination: { limit: Number.MAX_SAFE_INTEGER }
        });
        // Convert GraphVerbs back to HNSWVerbs for internal use
        const hnswVerbs = [];
        for (const graphVerb of result.items) {
            const hnswVerb = {
                id: graphVerb.id,
                vector: graphVerb.vector,
                connections: new Map()
            };
            hnswVerbs.push(hnswVerb);
        }
        return hnswVerbs;
    }
    /**
     * Get verbs by source
     */
    async getVerbsBySource(sourceId) {
        await this.ensureInitialized();
        // Use the paginated getVerbs method with source filter
        const result = await this.getVerbs({
            filter: { sourceId }
        });
        return result.items;
    }
    /**
     * Get verbs by target
     */
    async getVerbsByTarget(targetId) {
        await this.ensureInitialized();
        // Use the paginated getVerbs method with target filter
        const result = await this.getVerbs({
            filter: { targetId }
        });
        return result.items;
    }
    /**
     * Get verbs by type
     */
    async getVerbsByType(type) {
        await this.ensureInitialized();
        // Use the paginated getVerbs method with type filter
        const result = await this.getVerbs({
            filter: { verbType: type }
        });
        return result.items;
    }
    /**
     * Internal method for loading all nouns - used by performance optimizations
     * @internal - Do not use directly, use getNouns() with pagination instead
     */
    async _loadAllNounsForOptimization() {
        await this.ensureInitialized();
        // Only use this for internal optimizations when safe
        const result = await this.getNouns({
            pagination: { limit: Number.MAX_SAFE_INTEGER }
        });
        return result.items;
    }
    /**
     * Get nouns with pagination and filtering
     * @param options Pagination and filtering options
     * @returns Promise that resolves to a paginated result of nouns
     */
    async getNouns(options) {
        await this.ensureInitialized();
        // Set default pagination values
        const pagination = options?.pagination || {};
        const limit = pagination.limit || 100;
        const offset = pagination.offset || 0;
        const cursor = pagination.cursor;
        // Optimize for common filter cases to avoid loading all nouns
        if (options?.filter) {
            // If filtering by nounType only, use the optimized method
            if (options.filter.nounType &&
                !options.filter.service &&
                !options.filter.metadata) {
                const nounType = Array.isArray(options.filter.nounType)
                    ? options.filter.nounType[0]
                    : options.filter.nounType;
                // Get nouns by type directly
                const nounsByType = await this.getNounsByNounType_internal(nounType);
                // Apply pagination
                const paginatedNouns = nounsByType.slice(offset, offset + limit);
                const hasMore = offset + limit < nounsByType.length;
                // Set next cursor if there are more items
                let nextCursor = undefined;
                if (hasMore && paginatedNouns.length > 0) {
                    const lastItem = paginatedNouns[paginatedNouns.length - 1];
                    nextCursor = lastItem.id;
                }
                return {
                    items: paginatedNouns,
                    totalCount: nounsByType.length,
                    hasMore,
                    nextCursor
                };
            }
        }
        // For more complex filtering or no filtering, use a paginated approach
        // that avoids loading all nouns into memory at once
        try {
            // First, try to get a count of total nouns (if the adapter supports it)
            let totalCount = undefined;
            try {
                // This is an optional method that adapters may implement
                if (typeof this.countNouns === 'function') {
                    totalCount = await this.countNouns(options?.filter);
                }
            }
            catch (countError) {
                // Ignore errors from count method, it's optional
                console.warn('Error getting noun count:', countError);
            }
            // Check if the adapter has a paginated method for getting nouns
            if (typeof this.getNounsWithPagination === 'function') {
                // Use the adapter's paginated method
                const result = await this.getNounsWithPagination({
                    limit,
                    cursor,
                    filter: options?.filter
                });
                // Apply offset if needed (some adapters might not support offset)
                const items = result.items.slice(offset);
                return {
                    items,
                    totalCount: result.totalCount || totalCount,
                    hasMore: result.hasMore,
                    nextCursor: result.nextCursor
                };
            }
            // Storage adapter does not support pagination
            console.error('Storage adapter does not support pagination. The deprecated getAllNouns_internal() method has been removed. Please implement getNounsWithPagination() in your storage adapter.');
            return {
                items: [],
                totalCount: 0,
                hasMore: false
            };
        }
        catch (error) {
            console.error('Error getting nouns with pagination:', error);
            return {
                items: [],
                totalCount: 0,
                hasMore: false
            };
        }
    }
    /**
     * Get verbs with pagination and filtering
     * @param options Pagination and filtering options
     * @returns Promise that resolves to a paginated result of verbs
     */
    async getVerbs(options) {
        await this.ensureInitialized();
        // Set default pagination values
        const pagination = options?.pagination || {};
        const limit = pagination.limit || 100;
        const offset = pagination.offset || 0;
        const cursor = pagination.cursor;
        // Optimize for common filter cases to avoid loading all verbs
        if (options?.filter) {
            // If filtering by sourceId only, use the optimized method
            if (options.filter.sourceId &&
                !options.filter.verbType &&
                !options.filter.targetId &&
                !options.filter.service &&
                !options.filter.metadata) {
                const sourceId = Array.isArray(options.filter.sourceId)
                    ? options.filter.sourceId[0]
                    : options.filter.sourceId;
                // Get verbs by source directly
                const verbsBySource = await this.getVerbsBySource_internal(sourceId);
                // Apply pagination
                const paginatedVerbs = verbsBySource.slice(offset, offset + limit);
                const hasMore = offset + limit < verbsBySource.length;
                // Set next cursor if there are more items
                let nextCursor = undefined;
                if (hasMore && paginatedVerbs.length > 0) {
                    const lastItem = paginatedVerbs[paginatedVerbs.length - 1];
                    nextCursor = lastItem.id;
                }
                return {
                    items: paginatedVerbs,
                    totalCount: verbsBySource.length,
                    hasMore,
                    nextCursor
                };
            }
            // If filtering by targetId only, use the optimized method
            if (options.filter.targetId &&
                !options.filter.verbType &&
                !options.filter.sourceId &&
                !options.filter.service &&
                !options.filter.metadata) {
                const targetId = Array.isArray(options.filter.targetId)
                    ? options.filter.targetId[0]
                    : options.filter.targetId;
                // Get verbs by target directly
                const verbsByTarget = await this.getVerbsByTarget_internal(targetId);
                // Apply pagination
                const paginatedVerbs = verbsByTarget.slice(offset, offset + limit);
                const hasMore = offset + limit < verbsByTarget.length;
                // Set next cursor if there are more items
                let nextCursor = undefined;
                if (hasMore && paginatedVerbs.length > 0) {
                    const lastItem = paginatedVerbs[paginatedVerbs.length - 1];
                    nextCursor = lastItem.id;
                }
                return {
                    items: paginatedVerbs,
                    totalCount: verbsByTarget.length,
                    hasMore,
                    nextCursor
                };
            }
            // If filtering by verbType only, use the optimized method
            if (options.filter.verbType &&
                !options.filter.sourceId &&
                !options.filter.targetId &&
                !options.filter.service &&
                !options.filter.metadata) {
                const verbType = Array.isArray(options.filter.verbType)
                    ? options.filter.verbType[0]
                    : options.filter.verbType;
                // Get verbs by type directly
                const verbsByType = await this.getVerbsByType_internal(verbType);
                // Apply pagination
                const paginatedVerbs = verbsByType.slice(offset, offset + limit);
                const hasMore = offset + limit < verbsByType.length;
                // Set next cursor if there are more items
                let nextCursor = undefined;
                if (hasMore && paginatedVerbs.length > 0) {
                    const lastItem = paginatedVerbs[paginatedVerbs.length - 1];
                    nextCursor = lastItem.id;
                }
                return {
                    items: paginatedVerbs,
                    totalCount: verbsByType.length,
                    hasMore,
                    nextCursor
                };
            }
        }
        // For more complex filtering or no filtering, use a paginated approach
        // that avoids loading all verbs into memory at once
        try {
            // First, try to get a count of total verbs (if the adapter supports it)
            let totalCount = undefined;
            try {
                // This is an optional method that adapters may implement
                if (typeof this.countVerbs === 'function') {
                    totalCount = await this.countVerbs(options?.filter);
                }
            }
            catch (countError) {
                // Ignore errors from count method, it's optional
                console.warn('Error getting verb count:', countError);
            }
            // Check if the adapter has a paginated method for getting verbs
            if (typeof this.getVerbsWithPagination === 'function') {
                // Use the adapter's paginated method
                const result = await this.getVerbsWithPagination({
                    limit,
                    cursor,
                    filter: options?.filter
                });
                // Apply offset if needed (some adapters might not support offset)
                const items = result.items.slice(offset);
                return {
                    items,
                    totalCount: result.totalCount || totalCount,
                    hasMore: result.hasMore,
                    nextCursor: result.nextCursor
                };
            }
            // Storage adapter does not support pagination
            console.error('Storage adapter does not support pagination. The deprecated getAllVerbs_internal() method has been removed. Please implement getVerbsWithPagination() in your storage adapter.');
            return {
                items: [],
                totalCount: 0,
                hasMore: false
            };
        }
        catch (error) {
            console.error('Error getting verbs with pagination:', error);
            return {
                items: [],
                totalCount: 0,
                hasMore: false
            };
        }
    }
    /**
     * Delete a verb from storage
     */
    async deleteVerb(id) {
        await this.ensureInitialized();
        return this.deleteVerb_internal(id);
    }
    /**
     * Helper method to convert a Map to a plain object for serialization
     */
    mapToObject(map, valueTransformer = (v) => v) {
        const obj = {};
        for (const [key, value] of map.entries()) {
            obj[key.toString()] = valueTransformer(value);
        }
        return obj;
    }
    /**
     * Save statistics data to storage (public interface)
     * @param statistics The statistics data to save
     */
    async saveStatistics(statistics) {
        return this.saveStatisticsData(statistics);
    }
    /**
     * Get statistics data from storage (public interface)
     * @returns Promise that resolves to the statistics data or null if not found
     */
    async getStatistics() {
        return this.getStatisticsData();
    }
}
//# sourceMappingURL=baseStorage.js.map