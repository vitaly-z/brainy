/**
 * Universal Neural Import API
 *
 * ALWAYS uses neural matching to map ANY data to our strict NounTypes and VerbTypes
 * Never falls back to rules - neural matching is MANDATORY
 *
 * Handles:
 * - Strings (text, JSON, CSV, YAML, Markdown)
 * - Files (local paths, any format)
 * - URLs (web pages, APIs, documents)
 * - Objects (structured data)
 * - Binary data (images, PDFs via extraction)
 */
import { NounType, VerbType } from '../types/graphTypes.js';
import { Vector } from '../coreTypes.js';
import type { Brainy } from '../brainy.js';
export interface ImportSource {
    type: 'string' | 'file' | 'url' | 'object' | 'binary';
    data: any;
    format?: string;
    metadata?: any;
}
export interface NeuralImportResult {
    entities: Array<{
        id: string;
        type: NounType;
        data: any;
        vector: Vector;
        confidence: number;
        metadata: any;
    }>;
    relationships: Array<{
        id: string;
        from: string;
        to: string;
        type: VerbType;
        weight: number;
        confidence: number;
        metadata?: any;
    }>;
    stats: {
        totalProcessed: number;
        entitiesCreated: number;
        relationshipsCreated: number;
        averageConfidence: number;
        processingTimeMs: number;
    };
}
export declare class UniversalImportAPI {
    private brain;
    private typeMatcher;
    private neuralImport;
    private embedCache;
    constructor(brain: Brainy<any>);
    /**
     * Initialize the neural import system
     */
    init(): Promise<void>;
    /**
     * Universal import - handles ANY data source
     * ALWAYS uses neural matching, NEVER falls back
     */
    import(source: ImportSource | string | any): Promise<NeuralImportResult>;
    /**
     * Import from URL - fetches and processes
     */
    importFromURL(url: string): Promise<NeuralImportResult>;
    /**
     * Import from file - reads and processes
     * Note: In browser environment, use File API instead
     */
    importFromFile(filePath: string): Promise<NeuralImportResult>;
    /**
     * Normalize any input to ImportSource
     */
    private normalizeSource;
    /**
     * Extract structured data from source
     */
    private extractData;
    /**
     * Extract data from URL
     */
    private extractFromURL;
    /**
     * Extract data from file
     */
    private extractFromFile;
    /**
     * Extract data from string based on format
     */
    private extractFromString;
    /**
     * Extract from binary data (images, PDFs, etc)
     */
    private extractFromBinary;
    /**
     * Extract entities from plain text
     */
    private extractFromText;
    /**
     * Neural processing - CORE of the system
     * ALWAYS uses embeddings and neural matching
     */
    private neuralProcess;
    /**
     * Generate embedding for any data
     */
    private generateEmbedding;
    /**
     * Convert any data to text for embedding
     */
    private dataToText;
    /**
     * Detect relationships using neural matching
     */
    private detectNeuralRelationships;
    /**
     * Check if a field looks like a reference
     */
    private looksLikeReference;
    /**
     * Store processed data in brain
     */
    private storeInBrain;
    private detectFormat;
    private parseCSV;
    private parseYAML;
    private parseMarkdown;
    private parseHTML;
    private generateId;
    private simpleHash;
    private hashBinary;
}
