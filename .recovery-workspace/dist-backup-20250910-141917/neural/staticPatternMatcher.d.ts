/**
 * Static Pattern Matcher - NO runtime initialization, NO Brainy needed
 *
 * All patterns and embeddings are pre-computed at build time
 * This is pure pattern matching with zero dependencies
 */
import { EMBEDDED_PATTERNS } from './embeddedPatterns.js';
import type { Vector } from '../coreTypes.js';
import type { TripleQuery } from '../triple/TripleIntelligence.js';
/**
 * Match query against all patterns using embeddings
 */
export declare function findBestPatterns(queryEmbedding: Vector, k?: number): Array<{
    pattern: typeof EMBEDDED_PATTERNS[0];
    similarity: number;
}>;
/**
 * Match query against patterns using regex
 */
export declare function matchPatternByRegex(query: string): {
    pattern: typeof EMBEDDED_PATTERNS[0];
    slots: Record<string, string>;
    query: TripleQuery;
} | null;
/**
 * Convert natural language to structured query using STATIC patterns
 * NO initialization needed, NO Brainy required
 */
export declare function patternMatchQuery(query: string, queryEmbedding?: Vector): TripleQuery;
export declare const PATTERN_STATS: {
    totalPatterns: number;
    categories: string[];
    domains: string[];
    hasEmbeddings: boolean;
};
