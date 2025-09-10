/**
 * BrainyTypes - Intelligent type detection using semantic embeddings
 *
 * This module uses our existing TransformerEmbedding and similarity functions
 * to intelligently match data to our 31 noun types and 40 verb types.
 *
 * Features:
 * - Semantic similarity matching using embeddings
 * - Context-aware type detection
 * - Confidence scoring
 * - Caching for performance
 */
/**
 * Result of type matching with confidence scores
 */
export interface TypeMatchResult {
    type: string;
    confidence: number;
    reasoning: string;
    alternatives: Array<{
        type: string;
        confidence: number;
    }>;
}
/**
 * BrainyTypes - Intelligent type detection for nouns and verbs
 */
export declare class BrainyTypes {
    private embedder;
    private nounEmbeddings;
    private verbEmbeddings;
    private initialized;
    private cache;
    constructor();
    /**
     * Initialize the type matcher by generating embeddings for all types
     */
    init(): Promise<void>;
    /**
     * Match an object to the most appropriate noun type
     */
    matchNounType(obj: any): Promise<TypeMatchResult>;
    /**
     * Match a relationship to the most appropriate verb type
     */
    matchVerbType(sourceObj: any, targetObj: any, relationshipHint?: string): Promise<TypeMatchResult>;
    /**
     * Create text representation of an object for embedding
     */
    private createTextRepresentation;
    /**
     * Create text representation of a relationship
     */
    private createRelationshipText;
    /**
     * Get a brief summary of an object
     */
    private getObjectSummary;
    /**
     * Apply heuristic rules for noun type detection
     */
    private applyNounHeuristics;
    /**
     * Apply heuristic rules for verb type detection
     */
    private applyVerbHeuristics;
    /**
     * Generate human-readable reasoning for the type selection
     */
    private generateReasoning;
    /**
     * Clear the cache
     */
    clearCache(): void;
    /**
     * Dispose of resources
     */
    dispose(): Promise<void>;
}
/**
 * Get or create the global BrainyTypes instance
 */
export declare function getBrainyTypes(): Promise<BrainyTypes>;
