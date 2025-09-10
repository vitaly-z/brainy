/**
 * 🧠 Natural Language Query Processor
 * Auto-breaks down natural language into structured Triple Intelligence queries
 *
 * Uses all of Brainy's sophisticated features:
 * - Embedding model for semantic understanding
 * - Pattern library with 100+ research-based patterns
 * - Entity Registry for concept mapping
 * - Progressive learning from usage
 */
import { TripleQuery } from '../triple/TripleIntelligence.js';
import { Brainy } from '../brainy.js';
export interface NaturalQueryIntent {
    type: 'vector' | 'field' | 'graph' | 'combined';
    primaryIntent: 'search' | 'filter' | 'aggregate' | 'navigate' | 'compare' | 'explain';
    confidence: number;
    extractedTerms: {
        searchTerms?: string[];
        fields?: Record<string, any>;
        connections?: {
            entities: string[];
            relationships: string[];
        };
        filters?: Record<string, any>;
        modifiers?: {
            recent?: boolean;
            popular?: boolean;
            limit?: number;
            boost?: string;
            sortBy?: string;
            groupBy?: string;
        };
    };
    context?: {
        domain?: string;
        temporalScope?: 'past' | 'present' | 'future' | 'all';
        complexity?: 'simple' | 'moderate' | 'complex';
    };
}
export declare class NaturalLanguageProcessor {
    private brain;
    private patternLibrary;
    private queryHistory;
    private initialized;
    private embeddingCache;
    constructor(brain: Brainy);
    /**
     * Get embedding using add/get/delete pattern
     */
    private getEmbedding;
    /**
     * Initialize the pattern library (lazy loading)
     */
    private ensureInitialized;
    /**
     * 🎯 MAIN METHOD: Convert natural language to Triple Intelligence query
     */
    processNaturalQuery(naturalQuery: string): Promise<TripleQuery>;
    /**
     * Hybrid parse when pattern matching fails
     */
    private hybridParse;
    /**
     * Analyze intent using keywords and structure with enhanced classification
     */
    private analyzeIntent;
    /**
     * Detect the domain of the query
     */
    private detectDomain;
    /**
     * Detect temporal scope in query
     */
    private detectTemporalScope;
    /**
     * Assess query complexity
     */
    private assessComplexity;
    /**
     * Step 2: Use neural analysis to decompose complex queries
     */
    private decomposeQuery;
    /**
     * Step 3: Map concepts using Entity Registry and taxonomy
     */
    private mapConcepts;
    /**
     * Step 4: Construct final Triple Intelligence query
     */
    private constructTripleQuery;
    /**
     * Initialize pattern recognition for common query types
     */
    private initializePatterns;
    /**
     * Detect field query patterns
     */
    private hasFieldPatterns;
    /**
     * Detect connection query patterns
     */
    private hasConnectionPatterns;
    /**
     * Extract terms and modifiers from query
     */
    private extractTerms;
    /**
     * Find entity matches using Brainy's search capabilities
     */
    private findEntityMatches;
    /**
     * Check if term is a known field name
     */
    private isKnownField;
    /**
     * Map colloquial terms to actual field names
     */
    private mapToFieldName;
    /**
     * Find similar successful queries from history
     * Uses Brainy's vector search to find semantically similar previous queries
     */
    private findSimilarQueries;
    /**
     * Extract entities from query using Brainy's semantic search
     * Identifies known entities, concepts, and relationships in the query text
     */
    private extractEntities;
    /**
     * Build final TripleQuery based on intent, entities, and query analysis
     * Constructs optimized query combining vector, graph, and field searches
     */
    private buildQuery;
    /**
     * Extract entities from text using NEURAL matching to strict NounTypes
     * ALWAYS uses neural matching, NEVER falls back to patterns
     */
    extract(text: string, options?: {
        types?: string[];
        includeMetadata?: boolean;
        confidence?: number;
    }): Promise<Array<{
        text: string;
        type: string;
        position: {
            start: number;
            end: number;
        };
        confidence: number;
        metadata?: any;
    }>>;
    /**
     * DEPRECATED - Old pattern-based extraction
     * This should NEVER be used - kept only for reference
     */
    private extractWithPatterns_DEPRECATED;
    /**
     * Analyze sentiment of text
     */
    sentiment(text: string, options?: {
        granularity?: 'document' | 'sentence' | 'aspect';
        aspects?: string[];
    }): Promise<{
        overall: {
            score: number;
            magnitude: number;
            label: 'positive' | 'negative' | 'neutral' | 'mixed';
        };
        sentences?: Array<{
            text: string;
            score: number;
            magnitude: number;
            label: string;
        }>;
        aspects?: Record<string, {
            score: number;
            magnitude: number;
            mentions: number;
        }>;
    }>;
    /**
     * Calculate confidence for entity extraction
     */
    private calculateConfidence;
}
