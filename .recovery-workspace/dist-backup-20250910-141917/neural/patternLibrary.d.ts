/**
 * 🧠 Pattern Library for Natural Language Processing
 * Manages pre-computed pattern embeddings and smart matching
 *
 * Uses Brainy's own features for self-leveraging intelligence:
 * - Embeddings for semantic similarity
 * - Pattern caching for performance
 * - Progressive learning from usage
 */
import { Vector } from '../coreTypes.js';
import { Brainy } from '../brainy.js';
export interface Pattern {
    id: string;
    category: string;
    examples: string[];
    pattern: string;
    template: any;
    confidence: number;
    embedding?: Vector;
    domain?: string;
    frequency?: number | string;
    slots?: SlotDefinition[];
}
export interface SlotDefinition {
    name: string;
    type: 'text' | 'number' | 'date' | 'entity' | 'location' | 'person' | 'any';
    required?: boolean;
    default?: any;
    pattern?: string;
    transform?: (value: string) => any;
}
export interface SlotExtraction {
    slots: Record<string, any>;
    confidence: number;
    errors?: string[];
}
export declare class PatternLibrary {
    private patterns;
    private patternEmbeddings;
    private brain;
    private embeddingCache;
    private successMetrics;
    constructor(brain: Brainy);
    /**
     * Initialize pattern library with pre-computed embeddings
     */
    init(): Promise<void>;
    /**
     * Pre-compute embeddings for all patterns for fast matching
     */
    private precomputeEmbeddings;
    /**
     * Get embedding with caching
     */
    private getEmbedding;
    /**
     * Find best matching patterns for a query
     */
    findBestPatterns(queryEmbedding: Vector, k?: number): Promise<Array<{
        pattern: Pattern;
        similarity: number;
    }>>;
    /**
     * Extract slots from query based on pattern with enhanced fuzzy matching
     */
    extractSlots(query: string, pattern: Pattern): SlotExtraction;
    /**
     * Extract named slots with type validation
     */
    private extractNamedSlots;
    /**
     * Fuzzy extraction using Levenshtein distance
     */
    private fuzzyExtractSlots;
    /**
     * Fuzzy extraction for named slots
     */
    private fuzzyExtractNamedSlots;
    /**
     * Find slot value in tokens based on type
     */
    private findSlotValueInTokens;
    /**
     * Get default regex pattern for slot type
     */
    private getDefaultPatternForType;
    /**
     * Transform value based on type
     */
    private transformByType;
    /**
     * Validate slot value against definition
     */
    private validateSlotValue;
    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance;
    /**
     * Align two strings for slot extraction
     */
    private alignStrings;
    /**
     * Find best token match using fuzzy comparison
     */
    private findBestTokenMatch;
    /**
     * Extract slots from string alignment
     */
    private extractSlotsFromAlignment;
    /**
     * Fill template with extracted slots
     */
    fillTemplate(template: any, slots: Record<string, any>): any;
    /**
     * Update pattern success metrics based on usage
     */
    updateSuccessMetric(patternId: string, success: boolean): void;
    /**
     * Learn new pattern from successful query
     */
    learnPattern(query: string, result: any): Promise<void>;
    /**
     * Helper: Average multiple vectors
     */
    private averageVectors;
    /**
     * Helper: Calculate cosine similarity
     */
    private cosineSimilarity;
    /**
     * Helper: Simple tokenization
     */
    private tokenize;
    /**
     * Helper: Post-process extracted slots
     */
    private postProcessSlots;
    /**
     * Helper: Generate regex pattern from query
     */
    private generateRegexFromQuery;
    /**
     * Get pattern statistics for monitoring
     */
    getStatistics(): {
        totalPatterns: number;
        categories: Record<string, number>;
        averageConfidence: number;
        topPatterns: Array<{
            id: string;
            success: number;
        }>;
    };
}
