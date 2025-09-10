/**
 * Neural Import Augmentation - AI-Powered Data Understanding
 *
 * 🧠 Built-in AI augmentation for intelligent data processing
 * ⚛️ Always free, always included, always enabled
 *
 * Now using the unified BrainyAugmentation interface!
 */
import { BaseAugmentation } from './brainyAugmentation.js';
export interface NeuralAnalysisResult {
    detectedEntities: DetectedEntity[];
    detectedRelationships: DetectedRelationship[];
    confidence: number;
    insights: NeuralInsight[];
}
export interface DetectedEntity {
    originalData: any;
    nounType: string;
    confidence: number;
    suggestedId: string;
    reasoning: string;
    alternativeTypes: Array<{
        type: string;
        confidence: number;
    }>;
}
export interface DetectedRelationship {
    sourceId: string;
    targetId: string;
    verbType: string;
    confidence: number;
    weight: number;
    reasoning: string;
    context: string;
    metadata?: Record<string, any>;
}
export interface NeuralInsight {
    type: 'hierarchy' | 'cluster' | 'pattern' | 'anomaly' | 'opportunity';
    description: string;
    confidence: number;
    affectedEntities: string[];
    recommendation?: string;
}
export interface NeuralImportConfig {
    confidenceThreshold: number;
    enableWeights: boolean;
    skipDuplicates: boolean;
    categoryFilter?: string[];
    dataType?: string;
}
/**
 * Neural Import Augmentation - Unified Implementation
 * Processes data with AI before storage operations
 */
export declare class NeuralImportAugmentation extends BaseAugmentation {
    readonly name = "neural-import";
    readonly timing: "before";
    readonly metadata: {
        reads: "*";
        writes: string[];
    };
    operations: ("add" | "addNoun" | "addVerb" | "all")[];
    readonly priority = 80;
    protected config: NeuralImportConfig;
    private analysisCache;
    private typeMatcher;
    constructor(config?: Partial<NeuralImportConfig>);
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    /**
     * Execute augmentation - process data with AI before storage
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Extract raw data from operation params
     */
    private extractRawData;
    /**
     * Get the full neural analysis result (for external use)
     */
    getNeuralAnalysis(rawData: Buffer | string, dataType?: string): Promise<NeuralAnalysisResult>;
    /**
     * Parse raw data based on type
     */
    private parseRawData;
    /**
     * Parse CSV data - handles quoted values, escaped quotes, and edge cases
     */
    private parseCSV;
    /**
     * Parse YAML data
     */
    private parseYAML;
    /**
     * Parse a YAML value (handle strings, numbers, booleans, null)
     */
    private parseYAMLValue;
    /**
     * Perform neural analysis on parsed data
     */
    private performNeuralAnalysis;
    /**
     * Infer noun type from object structure using intelligent type matching
     */
    private inferNounType;
    /**
     * Detect relationships from object references
     */
    private detectRelationships;
    /**
     * Infer verb type from field name using intelligent type matching
     */
    private inferVerbType;
    /**
     * Group entities by type
     */
    private groupByType;
    /**
     * Store neural analysis results
     */
    private storeNeuralAnalysis;
    /**
     * Helper to get data type from file path
     */
    private getDataTypeFromPath;
    /**
     * PUBLIC API: Process raw data (for external use, like Synapses)
     * This maintains compatibility with code that wants to use Neural Import directly
     */
    processRawData(rawData: Buffer | string, dataType: string, options?: Record<string, unknown>): Promise<{
        success: boolean;
        data: {
            nouns: string[];
            verbs: string[];
            confidence?: number;
            insights?: Array<{
                type: string;
                description: string;
                confidence: number;
            }>;
            metadata?: Record<string, unknown>;
        };
        error?: string;
    }>;
}
