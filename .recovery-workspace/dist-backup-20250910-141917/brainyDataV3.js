/**
 * BrainyData V3 - Consistent API Design
 *
 * This is a proposed update to BrainyData with consistent method signatures.
 * All methods use object parameters for consistency and extensibility.
 */
/**
 * Proposed consistent API for BrainyData
 * All methods use object parameters
 */
export class BrainyDataV3 {
    // ============= INITIALIZATION =============
    constructor(config) {
        // Same as before
    }
    async init() {
        // Same as before
    }
    async close() {
        // Same as before
    }
    // ============= NOUN OPERATIONS =============
    /**
     * Add a single noun
     * OLD: addNoun(data, type, metadata)
     * NEW: addNoun({ data, type, metadata })
     */
    async addNoun(params) {
        // Implementation
        return 'id';
    }
    /**
     * Add multiple nouns in batch
     * NEW METHOD for better performance
     */
    async addNouns(params) {
        // Implementation
        return {
            successful: [],
            failed: [],
            total: 0,
            duration: 0
        };
    }
    /**
     * Get a single noun by ID
     * OLD: getNoun(id)
     * NEW: getNoun(id) - unchanged, simple enough
     */
    async getNoun(id) {
        // Implementation
        return null;
    }
    /**
     * Get multiple nouns with filtering
     * NEW METHOD for batch retrieval
     */
    async getNouns(params) {
        // Implementation
        return {
            items: [],
            hasMore: false
        };
    }
    /**
     * Update a noun
     * OLD: updateNoun(id, data, metadata) - scattered
     * NEW: updateNoun({ id, data, metadata })
     */
    async updateNoun(params) {
        // Implementation
    }
    /**
     * Delete a noun
     * OLD: deleteNoun(id)
     * NEW: deleteNoun(id) - unchanged, simple enough
     */
    async deleteNoun(id) {
        // Implementation
    }
    // ============= VERB OPERATIONS =============
    /**
     * Add a single verb (relationship)
     * OLD: addVerb(source, target, type, metadata, weight)
     * NEW: addVerb({ source, target, type, weight, metadata })
     */
    async addVerb(params) {
        // Implementation
        return 'id';
    }
    /**
     * Add multiple verbs in batch
     * NEW METHOD for better performance
     */
    async addVerbs(params) {
        // Implementation
        return {
            successful: [],
            failed: [],
            total: 0,
            duration: 0
        };
    }
    /**
     * Get a single verb by ID
     * OLD: getVerb(id)
     * NEW: getVerb(id) - unchanged, simple enough
     */
    async getVerb(id) {
        // Implementation
        return null;
    }
    /**
     * Get multiple verbs with filtering
     * OLD: getVerbsBySource(id), getVerbsByTarget(id), etc.
     * NEW: getVerbs({ source?, target?, type? })
     */
    async getVerbs(params) {
        // Implementation
        return {
            items: [],
            hasMore: false
        };
    }
    /**
     * Delete a verb
     * OLD: deleteVerb(id)
     * NEW: deleteVerb(id) - unchanged, simple enough
     */
    async deleteVerb(id) {
        // Implementation
    }
    // ============= SEARCH OPERATIONS =============
    /**
     * Unified search method
     * OLD: search(options), searchText(query, limit)
     * NEW: search({ query, limit, filter })
     */
    async search(params) {
        // Implementation
        return [];
    }
    /**
     * Find similar items
     * OLD: findSimilar(id, limit)
     * NEW: findSimilar({ id, limit, filter })
     */
    async findSimilar(params) {
        // Implementation
        return [];
    }
    /**
     * Find related items through graph traversal
     * OLD: getRelated(id, options)
     * NEW: findRelated({ id, depth, types })
     */
    async findRelated(params) {
        // Implementation
        return {
            items: [],
            hasMore: false
        };
    }
    // ============= METADATA OPERATIONS =============
    /**
     * Get metadata for an entity
     * OLD: getMetadata(id)
     * NEW: getMetadata(id) - unchanged, simple enough
     */
    async getMetadata(id) {
        // Implementation
        return null;
    }
    /**
     * Update metadata for an entity
     * OLD: updateMetadata(id, metadata)
     * NEW: updateMetadata({ id, metadata, merge })
     */
    async updateMetadata(params) {
        // Implementation
    }
    // ============= STATISTICS =============
    /**
     * Get database statistics
     * OLD: getStatistics()
     * NEW: getStatistics({ detailed?, includeAugmentations? })
     */
    async getStatistics(params) {
        // Implementation
        return {
            nouns: { total: 0, byType: {} },
            verbs: { total: 0, byType: {} },
            storage: { used: 0, type: 'memory' }
        };
    }
    // ============= NEURAL API (unchanged - already good) =============
    get neural() {
        return {
            /**
             * Calculate similarity between two items
             * Already good: neural.similar(a, b)
             */
            similar: async (a, b) => {
                // Implementation
                return 0;
            },
            /**
             * Cluster items semantically
             * Already good: neural.clusters(items?)
             */
            clusters: async (items) => {
                // Implementation
                return [];
            },
            /**
             * Find nearest neighbors
             * Already good: neural.neighbors(id, { limit })
             */
            neighbors: async (id, options) => {
                // Implementation
                return [];
            },
            /**
             * Build semantic hierarchy
             * Already good: neural.hierarchy(id)
             */
            hierarchy: async (id) => {
                // Implementation
                return {};
            },
            /**
             * Detect outliers
             * Already good: neural.outliers()
             */
            outliers: async () => {
                // Implementation
                return [];
            },
            /**
             * Get visualization data
             * Already good: neural.visualize()
             */
            visualize: async () => {
                // Implementation
                return {};
            }
        };
    }
    // ============= AUGMENTATIONS (unchanged - already consistent) =============
    get augmentations() {
        return {
            add: (aug) => { },
            remove: (name) => { },
            get: (name) => null,
            execute: async (op, params) => { },
            getTypes: () => []
        };
    }
}
/**
 * Migration wrapper for backward compatibility
 * This allows existing code to work with the new API
 */
export class BrainyDataMigrationWrapper extends BrainyDataV3 {
    /**
     * OLD SIGNATURE: addNoun(data, type, metadata)
     * Wraps to NEW: addNoun({ data, type, metadata })
     */
    async addNoun(dataOrParams, type, metadata) {
        // If called with object params (new style)
        if (arguments.length === 1 && typeof dataOrParams === 'object' && 'type' in dataOrParams) {
            return super.addNoun(dataOrParams);
        }
        // If called with positional params (old style)
        console.warn('Deprecated: Use addNoun({ data, type, metadata }) instead');
        return super.addNoun({
            data: dataOrParams,
            type: type,
            metadata
        });
    }
    /**
     * OLD SIGNATURE: addVerb(source, target, type, metadata, weight)
     * Wraps to NEW: addVerb({ source, target, type, weight, metadata })
     */
    async addVerb(sourceOrParams, target, type, metadata, weight) {
        // If called with object params (new style)
        if (arguments.length === 1 && typeof sourceOrParams === 'object' && 'source' in sourceOrParams) {
            return super.addVerb(sourceOrParams);
        }
        // If called with positional params (old style)
        console.warn('Deprecated: Use addVerb({ source, target, type, weight, metadata }) instead');
        return super.addVerb({
            source: sourceOrParams,
            target: target,
            type: type,
            weight,
            metadata
        });
    }
    /**
     * OLD SIGNATURE: searchText(query, limit)
     * Wraps to NEW: search({ query, limit })
     */
    async searchText(query, limit) {
        console.warn('Deprecated: Use search({ query, limit }) instead');
        return this.search({ query, limit });
    }
    /**
     * OLD SIGNATURE: findSimilar(id, limit)
     * Wraps to NEW: findSimilar({ id, limit })
     */
    async findSimilar(idOrParams, limit) {
        // If called with object params (new style)
        if (typeof idOrParams === 'object') {
            return super.findSimilar(idOrParams);
        }
        // If called with positional params (old style)
        console.warn('Deprecated: Use findSimilar({ id, limit }) instead');
        return super.findSimilar({ id: idOrParams, limit });
    }
    /**
     * OLD METHODS: getVerbsBySource, getVerbsByTarget
     * Wraps to NEW: getVerbs({ source }) or getVerbs({ target })
     */
    async getVerbsBySource(sourceId) {
        console.warn('Deprecated: Use getVerbs({ source }) instead');
        const result = await this.getVerbs({ source: sourceId });
        return result.items;
    }
    async getVerbsByTarget(targetId) {
        console.warn('Deprecated: Use getVerbs({ target }) instead');
        const result = await this.getVerbs({ target: targetId });
        return result.items;
    }
}
//# sourceMappingURL=brainyDataV3.js.map