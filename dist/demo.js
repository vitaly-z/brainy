/**
 * Demo-specific entry point for browser environments
 * This excludes all Node.js-specific functionality to avoid import issues
 */
// Import only browser-compatible modules
import { MemoryStorage } from './storage/adapters/memoryStorage.js';
import { TransformerEmbedding } from './utils/embedding.js';
import { cosineDistance } from './utils/distance.js';
/**
 * Simplified BrainyData class for demo purposes
 * Only includes browser-compatible functionality
 */
export class DemoBrainyData {
    constructor() {
        this.embedder = null;
        this.initialized = false;
        this.vectors = new Map();
        this.metadata = new Map();
        this.verbs = new Map();
        // Always use memory storage for demo simplicity
        this.storage = new MemoryStorage();
    }
    /**
     * Initialize the database
     */
    async init() {
        if (this.initialized)
            return;
        try {
            await this.storage.init();
            // Initialize the embedder
            this.embedder = new TransformerEmbedding({ verbose: false });
            await this.embedder.init();
            this.initialized = true;
            console.log('✅ Demo BrainyData initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize demo BrainyData:', error);
            throw error;
        }
    }
    /**
     * Add a document to the database
     */
    async add(text, metadata = {}) {
        if (!this.initialized || !this.embedder) {
            throw new Error('Database not initialized');
        }
        const id = this.generateId();
        try {
            // Generate embedding
            const vector = await this.embedder.embed(text);
            // Store data
            this.vectors.set(id, vector);
            this.metadata.set(id, { text, ...metadata, timestamp: Date.now() });
            return id;
        }
        catch (error) {
            console.error('Failed to add document:', error);
            throw error;
        }
    }
    /**
     * Search for similar documents
     */
    async searchText(query, limit = 10) {
        if (!this.initialized || !this.embedder) {
            throw new Error('Database not initialized');
        }
        try {
            // Generate query embedding
            const queryVector = await this.embedder.embed(query);
            // Calculate similarities
            const results = [];
            for (const [id, vector] of this.vectors.entries()) {
                const score = 1 - cosineDistance(queryVector, vector); // Convert distance to similarity
                const metadata = this.metadata.get(id);
                results.push({
                    id,
                    score,
                    metadata,
                    text: metadata?.text
                });
            }
            // Sort by score (highest first) and limit
            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        }
        catch (error) {
            console.error('Search failed:', error);
            throw error;
        }
    }
    /**
     * Add a relationship between two documents
     */
    async addVerb(sourceId, targetId, verb, metadata = {}) {
        const verbId = this.generateId();
        const verbData = {
            id: verbId,
            source: sourceId,
            target: targetId,
            verb,
            metadata,
            timestamp: Date.now()
        };
        if (!this.verbs.has(sourceId)) {
            this.verbs.set(sourceId, []);
        }
        this.verbs.get(sourceId).push(verbData);
        return verbId;
    }
    /**
     * Get relationships from a source document
     */
    async getVerbsBySource(sourceId) {
        return this.verbs.get(sourceId) || [];
    }
    /**
     * Get a document by ID
     */
    async get(id) {
        const metadata = this.metadata.get(id);
        const vector = this.vectors.get(id);
        if (!metadata || !vector)
            return null;
        return {
            id,
            vector,
            ...metadata
        };
    }
    /**
     * Delete a document
     */
    async delete(id) {
        const deleted = this.vectors.delete(id) && this.metadata.delete(id);
        this.verbs.delete(id);
        return deleted;
    }
    /**
     * Update document metadata
     */
    async updateMetadata(id, newMetadata) {
        const metadata = this.metadata.get(id);
        if (!metadata)
            return false;
        this.metadata.set(id, { ...metadata, ...newMetadata });
        return true;
    }
    /**
     * Get the number of documents
     */
    size() {
        return this.vectors.size;
    }
    /**
     * Generate a random ID
     */
    generateId() {
        return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }
    /**
     * Get storage info
     */
    getStorage() {
        return this.storage;
    }
}
// Export noun and verb types for compatibility
export const NounType = {
    Person: 'Person',
    Organization: 'Organization',
    Location: 'Location',
    Thing: 'Thing',
    Concept: 'Concept',
    Event: 'Event',
    Document: 'Document',
    Media: 'Media',
    File: 'File',
    Message: 'Message',
    Content: 'Content'
};
export const VerbType = {
    RelatedTo: 'related_to',
    Contains: 'contains',
    PartOf: 'part_of',
    LocatedAt: 'located_at',
    References: 'references',
    Owns: 'owns',
    CreatedBy: 'created_by',
    BelongsTo: 'belongs_to',
    Likes: 'likes',
    Follows: 'follows'
};
// Export the main class as BrainyData for compatibility
export { DemoBrainyData as BrainyData };
// Default export
export default DemoBrainyData;
//# sourceMappingURL=demo.js.map