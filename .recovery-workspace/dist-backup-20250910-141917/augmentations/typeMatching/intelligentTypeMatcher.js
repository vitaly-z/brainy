/**
 * IntelligentTypeMatcher - Wrapper around BrainyTypes for testing
 *
 * Provides intelligent type detection using semantic embeddings
 * for matching data to our 31 noun types and 40 verb types.
 */
import { VerbType } from '../../types/graphTypes.js';
import { getBrainyTypes } from './brainyTypes.js';
/**
 * Intelligent type matcher using semantic embeddings
 */
export class IntelligentTypeMatcher {
    constructor(options = {}) {
        this.options = options;
        this.brainyTypes = null;
        this.cache = new Map();
        this.options = {
            threshold: 0.3,
            topK: 3,
            useCache: true,
            ...options
        };
    }
    /**
     * Initialize the type matcher
     */
    async init() {
        this.brainyTypes = await getBrainyTypes();
        await this.brainyTypes.init();
    }
    /**
     * Dispose of resources
     */
    async dispose() {
        if (this.brainyTypes) {
            await this.brainyTypes.dispose();
            this.brainyTypes = null;
        }
        this.cache.clear();
    }
    /**
     * Match data to a noun type
     */
    async matchNounType(data) {
        if (!this.brainyTypes) {
            throw new Error('IntelligentTypeMatcher not initialized. Call init() first.');
        }
        // Check cache if enabled
        const cacheKey = JSON.stringify(data);
        if (this.options.useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            return {
                type: cached.type,
                confidence: cached.confidence,
                alternatives: cached.alternatives?.map(alt => ({
                    type: alt.type,
                    confidence: alt.confidence
                })) || []
            };
        }
        // Detect type using BrainyTypes
        const result = await this.brainyTypes.matchNounType(data);
        // Convert to expected format
        const response = {
            type: result.type,
            confidence: result.confidence,
            alternatives: result.alternatives?.map(alt => ({
                type: alt.type,
                confidence: alt.confidence
            })) || []
        };
        // Cache the result if enabled
        if (this.options.useCache) {
            this.cache.set(cacheKey, result);
        }
        return response;
    }
    /**
     * Match a relationship to a verb type
     */
    async matchVerbType(source, target, relationship) {
        if (!this.brainyTypes) {
            throw new Error('IntelligentTypeMatcher not initialized. Call init() first.');
        }
        // Create context for verb detection
        const context = {
            source,
            target,
            relationship: relationship || 'related',
            description: relationship || ''
        };
        // Check cache if enabled
        const cacheKey = JSON.stringify(context);
        if (this.options.useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            return {
                type: cached.type || VerbType.RelatedTo,
                confidence: cached.confidence,
                alternatives: cached.alternatives?.map(alt => ({
                    type: alt.type || VerbType.RelatedTo,
                    confidence: alt.confidence
                })) || []
            };
        }
        // Detect verb type using BrainyTypes
        const result = await this.brainyTypes.matchVerbType(context.source, context.target, context.relationship);
        // Convert to expected format
        const response = {
            type: result.type || VerbType.RelatedTo,
            confidence: result.confidence,
            alternatives: result.alternatives?.map(alt => ({
                type: alt.type || VerbType.RelatedTo,
                confidence: alt.confidence
            })) || []
        };
        // Cache the result if enabled
        if (this.options.useCache) {
            this.cache.set(cacheKey, result);
        }
        return response;
    }
    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: 1000 // Default max cache size
        };
    }
}
export default IntelligentTypeMatcher;
//# sourceMappingURL=intelligentTypeMatcher.js.map