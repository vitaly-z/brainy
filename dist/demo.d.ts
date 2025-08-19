/**
 * Demo-specific entry point for browser environments
 * This excludes all Node.js-specific functionality to avoid import issues
 */
import { MemoryStorage } from './storage/adapters/memoryStorage.js';
import { OPFSStorage } from './storage/adapters/opfsStorage.js';
export interface Vector extends Array<number> {
}
export interface SearchResult {
    id: string;
    score: number;
    metadata: any;
    text?: string;
}
export interface VerbData {
    id: string;
    source: string;
    target: string;
    verb: string;
    metadata: any;
    timestamp: number;
}
/**
 * Simplified BrainyData class for demo purposes
 * Only includes browser-compatible functionality
 */
export declare class DemoBrainyData {
    private storage;
    private embedder;
    private initialized;
    private vectors;
    private metadata;
    private verbs;
    constructor();
    /**
     * Initialize the database
     */
    init(): Promise<void>;
    /**
     * Add a document to the database
     */
    add(text: string, metadata?: any): Promise<string>;
    /**
     * Search for similar documents
     */
    searchText(query: string, limit?: number): Promise<SearchResult[]>;
    /**
     * Add a relationship between two documents
     */
    addVerb(sourceId: string, targetId: string, verb: string, metadata?: any): Promise<string>;
    /**
     * Get relationships from a source document
     */
    getVerbsBySource(sourceId: string): Promise<VerbData[]>;
    /**
     * Get a document by ID
     */
    get(id: string): Promise<any | null>;
    /**
     * Delete a document
     */
    delete(id: string): Promise<boolean>;
    /**
     * Update document metadata
     */
    updateMetadata(id: string, newMetadata: any): Promise<boolean>;
    /**
     * Get the number of documents
     */
    size(): number;
    /**
     * Generate a random ID
     */
    private generateId;
    /**
     * Get storage info
     */
    getStorage(): MemoryStorage | OPFSStorage;
}
export declare const NounType: {
    readonly Person: "Person";
    readonly Organization: "Organization";
    readonly Location: "Location";
    readonly Thing: "Thing";
    readonly Concept: "Concept";
    readonly Event: "Event";
    readonly Document: "Document";
    readonly Media: "Media";
    readonly File: "File";
    readonly Message: "Message";
    readonly Content: "Content";
};
export declare const VerbType: {
    readonly RelatedTo: "related_to";
    readonly Contains: "contains";
    readonly PartOf: "part_of";
    readonly LocatedAt: "located_at";
    readonly References: "references";
    readonly Owns: "owns";
    readonly CreatedBy: "created_by";
    readonly BelongsTo: "belongs_to";
    readonly Likes: "likes";
    readonly Follows: "follows";
};
export { DemoBrainyData as BrainyData };
export default DemoBrainyData;
