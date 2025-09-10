/**
 * Neural Entity Extractor using Brainy's NounTypes
 * Uses embeddings and similarity matching for accurate type detection
 */
import { NounType } from '../types/graphTypes.js';
import { Vector } from '../coreTypes.js';
import type { Brainy } from '../brainy.js';
export interface ExtractedEntity {
    text: string;
    type: NounType;
    position: {
        start: number;
        end: number;
    };
    confidence: number;
    vector?: Vector;
    metadata?: any;
}
export declare class NeuralEntityExtractor {
    private brain;
    private typeEmbeddings;
    private initialized;
    constructor(brain: Brainy | Brainy<any>);
    /**
     * Initialize type embeddings for neural matching
     */
    private initializeTypeEmbeddings;
    /**
     * Extract entities from text using neural matching
     */
    extract(text: string, options?: {
        types?: NounType[];
        confidence?: number;
        includeVectors?: boolean;
        neuralMatching?: boolean;
    }): Promise<ExtractedEntity[]>;
    /**
     * Extract candidate entities using patterns
     */
    private extractCandidates;
    /**
     * Get context-based confidence boost for type matching
     */
    private getContextBoost;
    /**
     * Rule-based classification fallback
     */
    private classifyByRules;
    /**
     * Get embedding for text
     */
    private getEmbedding;
    /**
     * Calculate cosine similarity between vectors
     */
    private cosineSimilarity;
    /**
     * Simple hash function for fallback
     */
    private simpleHash;
    /**
     * Remove duplicate and overlapping entities
     */
    private deduplicateEntities;
}
