/**
 * 🧠 Natural Language Query Processor - STATIC VERSION
 * No runtime initialization, no memory leaks, patterns pre-built at compile time
 *
 * Uses static pattern matching with 220 pre-built patterns
 */
import { Vector } from '../coreTypes.js';
import { TripleQuery } from '../triple/TripleIntelligence.js';
export interface NaturalQueryIntent {
    type: 'vector' | 'field' | 'graph' | 'combined';
    confidence: number;
    extractedTerms: {
        entities?: string[];
        fields?: string[];
        relationships?: string[];
        modifiers?: string[];
    };
}
export declare class NaturalLanguageProcessor {
    private queryHistory;
    constructor();
    /**
     * No initialization needed - patterns are pre-built!
     */
    init(): Promise<void>;
    /**
     * Process natural language query into structured Triple Intelligence query
     * @param naturalQuery The natural language query string
     * @param queryEmbedding Pre-computed embedding from Brainy (passed in to avoid circular dependency)
     */
    processNaturalQuery(naturalQuery: string, queryEmbedding?: Vector): Promise<TripleQuery>;
    /**
     * Analyze query intent using keywords
     */
    private analyzeIntent;
    /**
     * Extract field terms from query
     */
    private extractFieldTerms;
    /**
     * Extract relationship terms
     */
    private extractRelationshipTerms;
    /**
     * Build field constraints from extracted terms
     */
    private buildFieldConstraints;
    /**
     * Find similar queries from history (without using Brainy)
     */
    private findSimilarQueries;
    /**
     * Adapt a previous query for new input
     */
    private adaptQuery;
    /**
     * Extract entities from query
     */
    private extractEntities;
    /**
     * Build query from components
     */
    private buildQuery;
}
