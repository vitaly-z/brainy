/**
 * 🧠 BRAINY EMBEDDED PATTERNS
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Generated: 2025-09-09T17:55:32.179Z
 * Patterns: 220
 * Coverage: 94-98% of all queries
 *
 * This file contains ALL patterns and embeddings compiled into Brainy.
 * No external files needed, no runtime loading, instant availability!
 */
import type { Pattern } from './patternLibrary.js';
export declare const EMBEDDED_PATTERNS: Pattern[];
/**
 * Get pattern embeddings as a Map for fast lookup
 * This is called once at startup and cached
 */
export declare function getPatternEmbeddings(): Map<string, Float32Array>;
export declare const PATTERNS_METADATA: {
    version: string;
    totalPatterns: number;
    categories: string[];
    domains: string[];
    embeddingDimensions: number;
    averageConfidence: number;
    coverage: {
        general: string;
        programming: string;
        ai_ml: string;
        social: string;
        medical_legal: string;
        financial_academic: string;
        ecommerce: string;
        overall: string;
    };
    sizeBytes: {
        patterns: number;
        embeddings: number;
        total: number;
    };
};
