/**
 * Entity Registry Augmentation
 * Fast external-ID to internal-UUID mapping for streaming data processing
 * Works in write-only mode for high-performance deduplication
 */
import { BaseAugmentation } from './brainyAugmentation.js';
/**
 * High-performance entity registry for external ID to Brainy UUID mapping
 * Optimized for streaming data scenarios like Bluesky firehose processing
 */
export class EntityRegistryAugmentation extends BaseAugmentation {
    constructor(config = {}) {
        super();
        this.metadata = 'readonly'; // Reads metadata to register entities
        this.name = 'entity-registry';
        this.description = 'Fast external-ID to internal-UUID mapping for streaming data';
        this.timing = 'before';
        this.operations = ['add', 'addNoun', 'addVerb'];
        this.priority = 90; // High priority for entity registration
        this.memoryIndex = new Map();
        this.fieldIndices = new Map(); // field -> value -> brainyId
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.config = {
            maxCacheSize: config.maxCacheSize ?? 100000,
            cacheTTL: config.cacheTTL ?? 300000, // 5 minutes
            indexedFields: config.indexedFields ?? ['did', 'handle', 'uri', 'id', 'external_id'],
            persistence: config.persistence ?? 'hybrid',
            syncInterval: config.syncInterval ?? 30000 // 30 seconds
        };
        // Initialize field indices
        for (const field of this.config.indexedFields) {
            this.fieldIndices.set(field, new Map());
        }
    }
    async initialize(context) {
        this.brain = context.brain;
        this.storage = context.storage;
        // Load existing mappings from storage
        if (this.config.persistence === 'storage' || this.config.persistence === 'hybrid') {
            await this.loadFromStorage();
        }
        // Start sync timer for hybrid mode
        if (this.config.persistence === 'hybrid') {
            this.syncTimer = setInterval(() => {
                this.syncToStorage().catch(console.error);
            }, this.config.syncInterval);
        }
        console.log(`🔍 EntityRegistry initialized: ${this.memoryIndex.size} cached mappings`);
    }
    async shutdown() {
        // Final sync before shutdown
        if (this.config.persistence === 'storage' || this.config.persistence === 'hybrid') {
            await this.syncToStorage();
        }
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
    }
    /**
     * Execute the augmentation
     */
    async execute(operation, params, next) {
        console.log(`🔍 [EntityRegistry] execute called: operation=${operation}`);
        // For add operations, check for duplicates first
        if (operation === 'add' || operation === 'addNoun') {
            const metadata = params.metadata || {};
            // Check if entity already exists
            for (const field of this.config.indexedFields) {
                const value = this.extractFieldValue(metadata, field);
                if (value) {
                    const existingId = await this.lookupEntity(field, value);
                    if (existingId) {
                        // Entity already exists, return the existing one
                        console.log(`🔍 Duplicate detected: ${field}:${value} → ${existingId}`);
                        return { id: existingId, duplicate: true };
                    }
                }
            }
        }
        // For addVerb operations, resolve external IDs to internal UUIDs
        if (operation === 'addVerb') {
            const sourceId = params.sourceId;
            const targetId = params.targetId;
            // Try to resolve source and target IDs if they look like external IDs
            for (const field of this.config.indexedFields) {
                // Check if sourceId matches an external ID pattern
                if (typeof sourceId === 'string' && this.looksLikeExternalId(sourceId, field)) {
                    const resolvedSourceId = await this.lookupEntity(field, sourceId);
                    if (resolvedSourceId) {
                        console.log(`🔍 [EntityRegistry] Resolved source: ${sourceId} → ${resolvedSourceId}`);
                        params.sourceId = resolvedSourceId;
                    }
                }
                // Check if targetId matches an external ID pattern
                if (typeof targetId === 'string' && this.looksLikeExternalId(targetId, field)) {
                    const resolvedTargetId = await this.lookupEntity(field, targetId);
                    if (resolvedTargetId) {
                        console.log(`🔍 [EntityRegistry] Resolved target: ${targetId} → ${resolvedTargetId}`);
                        params.targetId = resolvedTargetId;
                    }
                }
            }
        }
        // Proceed with the operation
        const result = await next();
        // Register the entity after successful add
        if ((operation === 'add' || operation === 'addNoun' || operation === 'addVerb') && result) {
            // Handle both formats: string UUID or object with id property
            const brainyId = typeof result === 'string' ? result : result.id;
            if (brainyId) {
                const metadata = params.metadata || {};
                const nounType = params.nounType || 'default';
                console.log(`🔍 [EntityRegistry] Registering entity: ${brainyId}`);
                await this.registerEntity(brainyId, metadata, nounType);
                console.log(`✅ [EntityRegistry] Entity registered successfully`);
            }
        }
        return result;
    }
    /**
     * Register a new entity mapping
     */
    async registerEntity(brainyId, metadata, nounType) {
        const now = Date.now();
        // Extract indexed fields from metadata
        for (const field of this.config.indexedFields) {
            const value = this.extractFieldValue(metadata, field);
            if (value) {
                const key = `${field}:${value}`;
                // Add to memory index
                const mapping = {
                    externalId: value,
                    field,
                    brainyId,
                    nounType,
                    lastAccessed: now,
                    metadata
                };
                this.memoryIndex.set(key, mapping);
                // Add to field-specific index
                const fieldIndex = this.fieldIndices.get(field);
                if (fieldIndex) {
                    fieldIndex.set(value, brainyId);
                }
            }
        }
        // Enforce cache size limit (LRU eviction)
        await this.evictOldEntries();
    }
    /**
     * Fast lookup: external ID → Brainy UUID
     * Works in write-only mode without search indexes
     */
    async lookupEntity(field, value) {
        const key = `${field}:${value}`;
        const cached = this.memoryIndex.get(key);
        if (cached) {
            // Update last accessed time
            cached.lastAccessed = Date.now();
            this.cacheHits++;
            return cached.brainyId;
        }
        this.cacheMisses++;
        // If not in cache and using storage persistence, try loading from storage
        if (this.config.persistence === 'storage' || this.config.persistence === 'hybrid') {
            const stored = await this.loadFromStorageByField(field, value);
            if (stored) {
                // Add to memory cache
                this.memoryIndex.set(key, stored);
                const fieldIndex = this.fieldIndices.get(field);
                if (fieldIndex) {
                    fieldIndex.set(value, stored.brainyId);
                }
                return stored.brainyId;
            }
        }
        return null;
    }
    /**
     * Batch lookup for multiple external IDs
     */
    async lookupBatch(lookups) {
        const results = new Map();
        const missingKeys = [];
        // Check memory cache first
        for (const lookup of lookups) {
            const key = `${lookup.field}:${lookup.value}`;
            const cached = this.memoryIndex.get(key);
            if (cached) {
                cached.lastAccessed = Date.now();
                results.set(key, cached.brainyId);
            }
            else {
                missingKeys.push({ ...lookup, key });
                results.set(key, null);
            }
        }
        // Batch load missing keys from storage
        if (missingKeys.length > 0 && (this.config.persistence === 'storage' || this.config.persistence === 'hybrid')) {
            const stored = await this.loadBatchFromStorage(missingKeys);
            for (const [key, mapping] of stored) {
                if (mapping) {
                    // Add to memory cache
                    this.memoryIndex.set(key, mapping);
                    const fieldIndex = this.fieldIndices.get(mapping.field);
                    if (fieldIndex) {
                        fieldIndex.set(mapping.externalId, mapping.brainyId);
                    }
                    results.set(key, mapping.brainyId);
                }
            }
        }
        return results;
    }
    /**
     * Check if entity exists (faster than lookupEntity for existence checks)
     */
    async hasEntity(field, value) {
        const fieldIndex = this.fieldIndices.get(field);
        if (fieldIndex && fieldIndex.has(value)) {
            return true;
        }
        return (await this.lookupEntity(field, value)) !== null;
    }
    /**
     * Get all entities by field (e.g., all DIDs)
     */
    async getEntitiesByField(field) {
        const fieldIndex = this.fieldIndices.get(field);
        return fieldIndex ? Array.from(fieldIndex.keys()) : [];
    }
    /**
     * Get registry statistics
     */
    getStats() {
        const fieldCounts = {};
        for (const [field, index] of this.fieldIndices) {
            fieldCounts[field] = index.size;
        }
        return {
            totalMappings: this.memoryIndex.size,
            fieldCounts,
            cacheHitRate: this.cacheHits > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
            memoryUsage: this.estimateMemoryUsage()
        };
    }
    /**
     * Clear all cached mappings
     */
    async clearCache() {
        this.memoryIndex.clear();
        for (const fieldIndex of this.fieldIndices.values()) {
            fieldIndex.clear();
        }
    }
    // Private helper methods
    /**
     * Check if an ID looks like it could be an external ID for a specific field
     */
    looksLikeExternalId(id, field) {
        // Basic heuristics to detect external ID patterns
        switch (field) {
            case 'did':
                return id.startsWith('did:');
            case 'handle':
                return id.includes('.') && (id.includes('bsky') || id.includes('social'));
            case 'external_id':
                return !id.match(/^[a-f0-9-]{36}$/i); // Not a UUID
            case 'uri':
                return id.startsWith('http') || id.startsWith('at://');
            case 'id':
                return !id.match(/^[a-f0-9-]{36}$/i); // Not a UUID
            default:
                // For custom fields, assume non-UUID strings might be external IDs
                return typeof id === 'string' && id.length > 3 && !id.match(/^[a-f0-9-]{36}$/i);
        }
    }
    extractFieldValue(metadata, field) {
        if (!metadata)
            return null;
        // Support nested field access (e.g., "author.did")
        const parts = field.split('.');
        let value = metadata;
        for (const part of parts) {
            value = value?.[part];
            if (value === undefined || value === null) {
                return null;
            }
        }
        return typeof value === 'string' ? value : String(value);
    }
    async evictOldEntries() {
        if (this.memoryIndex.size <= this.config.maxCacheSize) {
            return;
        }
        // Sort by last accessed time and remove oldest entries
        const entries = Array.from(this.memoryIndex.entries());
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
        const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize);
        for (const [key, mapping] of toRemove) {
            this.memoryIndex.delete(key);
            const fieldIndex = this.fieldIndices.get(mapping.field);
            if (fieldIndex) {
                fieldIndex.delete(mapping.externalId);
            }
        }
    }
    async loadFromStorage() {
        if (!this.brain)
            return;
        try {
            // Load registry data from a special storage location
            const registryData = await this.brain.storage?.getMetadata('__entity_registry__');
            if (registryData && registryData.mappings) {
                for (const mapping of registryData.mappings) {
                    const key = `${mapping.field}:${mapping.externalId}`;
                    this.memoryIndex.set(key, mapping);
                    const fieldIndex = this.fieldIndices.get(mapping.field);
                    if (fieldIndex) {
                        fieldIndex.set(mapping.externalId, mapping.brainyId);
                    }
                }
            }
        }
        catch (error) {
            console.warn('Failed to load entity registry from storage:', error);
        }
    }
    async syncToStorage() {
        if (!this.brain)
            return;
        try {
            const mappings = Array.from(this.memoryIndex.values());
            await this.brain.storage?.saveMetadata('__entity_registry__', {
                version: 1,
                lastSync: Date.now(),
                mappings
            });
        }
        catch (error) {
            console.warn('Failed to sync entity registry to storage:', error);
        }
    }
    async loadFromStorageByField(field, value) {
        // For now, this would require a full load. In production, you'd want
        // a more sophisticated storage index system
        return null;
    }
    async loadBatchFromStorage(keys) {
        // For now, return empty. In production, implement batch storage lookup
        return new Map();
    }
    estimateMemoryUsage() {
        // Rough estimate: 200 bytes per mapping on average
        return this.memoryIndex.size * 200;
    }
}
// Hook into Brainy's add operations to automatically register entities
export class AutoRegisterEntitiesAugmentation extends BaseAugmentation {
    constructor() {
        super(...arguments);
        this.metadata = 'readonly'; // Reads metadata for auto-registration
        this.name = 'auto-register-entities';
        this.description = 'Automatically register entities in the registry when added';
        this.timing = 'after';
        this.operations = ['add', 'addNoun', 'addVerb'];
        this.priority = 85; // After entity registry
    }
    async initialize(context) {
        this.brain = context.brain;
        // Find the entity registry augmentation from the registry
        this.registry = this.brain?.augmentations?.augmentations?.find((aug) => aug instanceof EntityRegistryAugmentation);
    }
    async execute(operation, params, next) {
        const result = await next();
        // After successful add, register the entity
        if ((operation === 'add' || operation === 'addNoun' || operation === 'addVerb') && result) {
            if (this.registry) {
                // Handle both formats: string UUID or object with id property
                const brainyId = typeof result === 'string' ? result : result.id;
                if (brainyId) {
                    const metadata = params.metadata || {};
                    const nounType = params.nounType || 'default';
                    await this.registry.registerEntity(brainyId, metadata, nounType);
                }
            }
        }
        return result;
    }
}
//# sourceMappingURL=entityRegistryAugmentation.js.map