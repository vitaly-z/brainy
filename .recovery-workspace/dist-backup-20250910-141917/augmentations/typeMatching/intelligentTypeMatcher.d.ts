/**
 * IntelligentTypeMatcher - Wrapper around BrainyTypes for testing
 *
 * Provides intelligent type detection using semantic embeddings
 * for matching data to our 31 noun types and 40 verb types.
 */
import { NounType, VerbType } from '../../types/graphTypes.js';
export interface TypeMatchOptions {
    threshold?: number;
    topK?: number;
    useCache?: boolean;
}
/**
 * Intelligent type matcher using semantic embeddings
 */
export declare class IntelligentTypeMatcher {
    private options;
    private brainyTypes;
    private cache;
    constructor(options?: TypeMatchOptions);
    /**
     * Initialize the type matcher
     */
    init(): Promise<void>;
    /**
     * Dispose of resources
     */
    dispose(): Promise<void>;
    /**
     * Match data to a noun type
     */
    matchNounType(data: any): Promise<{
        type: NounType;
        confidence: number;
        alternatives: Array<{
            type: NounType;
            confidence: number;
        }>;
    }>;
    /**
     * Match a relationship to a verb type
     */
    matchVerbType(source: any, target: any, relationship?: string): Promise<{
        type: VerbType;
        confidence: number;
        alternatives: Array<{
            type: VerbType;
            confidence: number;
        }>;
    }>;
    /**
     * Clear the cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
    };
}
export default IntelligentTypeMatcher;
