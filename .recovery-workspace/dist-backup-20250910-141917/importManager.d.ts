/**
 * Import Manager - Comprehensive data import with intelligent type detection
 *
 * Handles multiple data sources:
 * - Direct data (objects, arrays)
 * - Files (JSON, CSV, text)
 * - URLs (fetch and parse)
 * - Streams (for large files)
 *
 * Uses NeuralImportAugmentation for intelligent processing
 */
import { NounType } from './types/graphTypes.js';
export interface ImportOptions {
    source?: 'data' | 'file' | 'url' | 'auto';
    format?: 'json' | 'csv' | 'text' | 'yaml' | 'auto';
    batchSize?: number;
    autoDetect?: boolean;
    typeHint?: NounType;
    extractRelationships?: boolean;
    csvDelimiter?: string;
    csvHeaders?: boolean;
    parallel?: boolean;
    maxConcurrency?: number;
}
export interface ImportResult {
    success: boolean;
    nouns: string[];
    verbs: string[];
    errors: string[];
    stats: {
        total: number;
        imported: number;
        failed: number;
        relationships: number;
    };
}
export declare class ImportManager {
    private neuralImport;
    private typeMatcher;
    private brain;
    constructor(brain: any);
    /**
     * Initialize the import manager
     */
    init(): Promise<void>;
    /**
     * Main import method - handles all sources
     */
    import(source: string | Buffer | any[] | any, options?: ImportOptions): Promise<ImportResult>;
    /**
     * Import from file
     */
    importFile(filePath: string, options?: ImportOptions): Promise<ImportResult>;
    /**
     * Import from URL
     */
    importUrl(url: string, options?: ImportOptions): Promise<ImportResult>;
    /**
     * Detect source type
     */
    private detectSourceType;
    /**
     * Detect format from file path
     */
    private detectFormatFromPath;
    /**
     * Read file
     */
    private readFile;
    /**
     * Fetch from URL
     */
    private fetchFromUrl;
}
/**
 * Create an import manager instance
 */
export declare function createImportManager(brain: any): ImportManager;
